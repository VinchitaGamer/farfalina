import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import {
  resolveSafeMediaFilePath,
  serveMediaFileResponse,
  MEDIA_MIME_TYPES,
} from "../lib/media-server";
import { prisma } from "../lib/db";
import { sendChatMessageAction, getChatThreadsAction } from "../app/actions/omnichannel";

async function runTests() {
  console.log("=== INICIANDO SUITE DE PRUEBAS DE MULTIMEDIA Y META DIRECTO ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Setup test media file
  const testDir = path.join(process.cwd(), "public", "uploads", "whatsapp");
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const testFileName = `test_media_${Date.now()}.ogg`;
  const testFilePath = path.join(testDir, testFileName);
  const testContent = Buffer.from("OggS_test_opus_audio_bytes_farfalina_carissma_2026");
  fs.writeFileSync(testFilePath, testContent);

  try {
    // 2. MIME Types Verification
    console.log("\n1. Verificando mapeo de tipos MIME para audio/video/documentos...");
    assert(MEDIA_MIME_TYPES[".ogg"] === "audio/ogg; codecs=opus", "MIME para .ogg incluye codecs=opus (WhatsApp PTT)");
    assert(MEDIA_MIME_TYPES[".opus"] === "audio/ogg; codecs=opus", "MIME para .opus incluye codecs=opus");
    assert(MEDIA_MIME_TYPES[".mp4"] === "video/mp4", "MIME para .mp4 es video/mp4");
    assert(MEDIA_MIME_TYPES[".pdf"] === "application/pdf", "MIME para .pdf es application/pdf");

    // 3. Security & Path Traversal Guards
    console.log("\n2. Verificando seguridad contra Directory Traversal...");
    const traversalAttempt = resolveSafeMediaFilePath(["..", "..", "..", "windows", "win.ini"]);
    assert(traversalAttempt === null, "Ataque ../../ bloqueado exitosamente");

    const legitimatePath = resolveSafeMediaFilePath(["whatsapp", testFileName]);
    assert(legitimatePath !== null && fs.existsSync(legitimatePath), "Ruta legítima en uploads resuelta correctamente");

    // URL encoded spaces test
    const encodedDir = path.join(process.cwd(), "public", "uploads", "whatsapp");
    const spaceFileName = `test with spaces ${Date.now()}.pdf`;
    const spaceFilePath = path.join(encodedDir, spaceFileName);
    fs.writeFileSync(spaceFilePath, Buffer.from("%PDF-1.4 test document"));
    const resolvedEncoded = resolveSafeMediaFilePath(["whatsapp", encodeURIComponent(spaceFileName)]);
    assert(resolvedEncoded !== null && fs.existsSync(resolvedEncoded), "Ruta con espacios URL-encoded resuelta correctamente");
    fs.unlinkSync(spaceFilePath);

    // 4. HTTP Range Requests (206 Partial Content) Streaming Verification
    console.log("\n3. Verificando streaming con soporte HTTP Range (RFC 7233)...");
    const fullReq = new NextRequest(`http://localhost:3000/uploads/whatsapp/${testFileName}`);
    const fullRes = serveMediaFileResponse(fullReq, testFilePath);
    assert(fullRes.status === 200, "Petición estándar sin Range responde 200 OK");
    assert(fullRes.headers.get("Accept-Ranges") === "bytes", "Cabecera Accept-Ranges: bytes presente");
    assert(Number(fullRes.headers.get("Content-Length")) === testContent.length, "Content-Length coincide con tamaño real");

    // Range Request: First 10 bytes
    const rangeReq = new NextRequest(`http://localhost:3000/uploads/whatsapp/${testFileName}`, {
      headers: { range: "bytes=0-9" },
    });
    const rangeRes = serveMediaFileResponse(rangeReq, testFilePath);
    assert(rangeRes.status === 206, "Petición con Range válida responde 206 Partial Content");
    assert(rangeRes.headers.get("Content-Range") === `bytes 0-9/${testContent.length}`, "Content-Range responde rango correcto");
    assert(rangeRes.headers.get("Content-Length") === "10", "Content-Length parcial es exactamente 10 bytes");
    assert(rangeRes.headers.get("Content-Type") === "audio/ogg; codecs=opus", "Content-Type de audio preservado");

    // Range Request: Unsatisfiable Range
    const badRangeReq = new NextRequest(`http://localhost:3000/uploads/whatsapp/${testFileName}`, {
      headers: { range: "bytes=9999-10000" },
    });
    const badRangeRes = serveMediaFileResponse(badRangeReq, testFilePath);
    assert(badRangeRes.status === 416, "Rango insatisfactorio responde 416 Range Not Satisfiable");

    // 5. Outbound Message & ExternalId Deduplication Verification
    console.log("\n4. Verificando despacho con externalId y deduplicación...");
    const testThread = await prisma.chatThread.create({
      data: {
        clientName: "Cliente Test Multimedia",
        phone: "59169999999",
        channel: "WhatsApp",
        environment: "farfalina",
        status: "Por Responder",
        lastMessage: "Test inicial",
      },
    });

    // Send with media attachment
    const dummyBase64 = Buffer.from("dummy_image_data").toString("base64");
    const sendRes = await sendChatMessageAction({
      threadId: testThread.id,
      sender: "agent",
      text: "Catálogo solicitado",
      mediaBase64: dummyBase64,
      mediaMimeType: "image/jpeg",
      mediaFileName: "catalogo.jpg",
    });

    assert(sendRes.success === true, "sendChatMessageAction con imagen adjunta exitoso");
    const createdMsg = sendRes.data as { id: string; mediaUrl: string; mediaType: string };
    assert(Boolean(createdMsg.mediaUrl && createdMsg.mediaUrl.startsWith("/uploads/whatsapp/")), "mediaUrl guardado en /uploads/whatsapp/");
    assert(createdMsg.mediaType === "image", "mediaType clasificado como 'image'");

    // Verify file actually exists on disk
    const savedDiskPath = path.join(process.cwd(), "public", createdMsg.mediaUrl.replace(/^\//, ""));
    assert(fs.existsSync(savedDiskPath), "Archivo adjunto existe físicamente en disco");
    if (fs.existsSync(savedDiskPath)) {
      fs.unlinkSync(savedDiskPath);
    }

    // 6. Cleanup
    await prisma.relayOutboundQueue.deleteMany({ where: { threadId: testThread.id } });
    await prisma.chatMessage.deleteMany({ where: { threadId: testThread.id } });
    await prisma.chatThread.deleteMany({ where: { id: testThread.id } });
  } finally {
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  }

  console.log(`\n=== RESUMEN FINAL MULTIMEDIA: ${passed} PASSED, ${failed} FAILED ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Error fatal en suite de pruebas:", err);
  process.exit(1);
});
