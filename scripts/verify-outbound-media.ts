import fs from "fs";
import path from "path";
import { prisma } from "../lib/db";
import { sendChatMessageAction } from "../app/actions/omnichannel";
import {
  getInstagramMediaType,
  resolvePublicMediaUrl,
  sendInstagramDirectMediaMessage,
} from "../lib/meta-graph-api";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, errorMsg?: string, details?: unknown) {
  if (condition) {
    results.push({ name, passed: true, details });
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    results.push({ name, passed: false, error: errorMsg || "Assertion failed", details });
    console.error(`  ❌ [FAIL] ${name}: ${errorMsg || "Assertion failed"}`);
  }
}

async function runVerification() {
  console.log("=== VERIFICACIÓN AUTOMATIZADA: MULTIMEDIA SALIENTE (INSTAGRAM & WHATSAPP) ===\n");

  // ---------------------------------------------------------
  // 1. Verificación de Mapeo de MIME Types a Instagram Attachment Types
  // ---------------------------------------------------------
  console.log("1. Verificando mapeo de tipos MIME para Instagram Graph API...");
  assert(getInstagramMediaType("image/jpeg") === "image", "MIME image/jpeg -> 'image'");
  assert(getInstagramMediaType("image/png") === "image", "MIME image/png -> 'image'");
  assert(getInstagramMediaType("image/webp") === "image", "MIME image/webp -> 'image'");
  assert(getInstagramMediaType("audio/ogg") === "audio", "MIME audio/ogg -> 'audio'");
  assert(getInstagramMediaType("audio/opus") === "audio", "MIME audio/opus -> 'audio'");
  assert(getInstagramMediaType("audio/mpeg") === "audio", "MIME audio/mpeg -> 'audio'");
  assert(getInstagramMediaType("video/mp4") === "video", "MIME video/mp4 -> 'video'");
  assert(getInstagramMediaType("application/pdf") === "file", "MIME application/pdf -> 'file'");
  assert(
    getInstagramMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document") === "file",
    "MIME docx -> 'file'"
  );
  assert(getInstagramMediaType("text/plain") === "file", "MIME text/plain -> 'file'");

  // ---------------------------------------------------------
  // 2. Verificación de Generación de URL Pública con Túnel Cloudflare
  // ---------------------------------------------------------
  console.log("\n2. Verificando generación y resolución de URL pública...");
  const publicTunnelUrl = resolvePublicMediaUrl("/uploads/instagram/out_sample_flower.jpg");
  assert(
    publicTunnelUrl.startsWith("https://") && publicTunnelUrl.includes("/uploads/instagram/out_sample_flower.jpg"),
    "Ruta relativa /uploads/... resuelta a HTTPS absoluto con túnel",
    undefined,
    { resolved: publicTunnelUrl }
  );

  const existingAbsolute = "https://cdn.example.com/external-photo.jpg";
  assert(
    resolvePublicMediaUrl(existingAbsolute) === existingAbsolute,
    "URL absoluta previa preservada intacta"
  );

  // ---------------------------------------------------------
  // 3. Verificación de Guardado Físico y Persistencia en Base de Datos (Instagram)
  // ---------------------------------------------------------
  console.log("\n3. Verificando guardado físico y persistencia en ChatMessage (Canal Instagram)...");
  const testThreadId = `test_ig_media_thread_${Date.now()}`;
  const testRecipientIgsid = "1304358138230682";
  const existingSamplePath = path.join(process.cwd(), "public", "uploads", "whatsapp", "wa_1791252148359_3AF28B52AD5C923201D1.jpg");
  const fallbackSamplePath = path.join(process.cwd(), "public", "uploads", "instagram", "ig_farfalina_1791272935295_jkogin.jpg");
  const sampleImageBuf = fs.existsSync(existingSamplePath)
    ? fs.readFileSync(existingSamplePath)
    : fs.existsSync(fallbackSamplePath)
    ? fs.readFileSync(fallbackSamplePath)
    : Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAA", "base64");
  const createdFiles: string[] = [];

  try {
    // Buscar conversación existente para el destinatario de Instagram o crear una
    let testThread = await prisma.chatThread.findFirst({
      where: {
        channel: "Instagram",
        phone: testRecipientIgsid,
        environment: "farfalina",
      },
    });

    const isNewlyCreated = !testThread;
    if (!testThread) {
      testThread = await prisma.chatThread.create({
        data: {
          id: testThreadId,
          channel: "Instagram",
          phone: testRecipientIgsid,
          clientName: "Test Instagram User",
          lastMessage: "Mensaje inicial de prueba",
          status: "Pendientes",
          environment: "farfalina",
          unreadCount: 0,
        },
      });
    }

    // Enviar imagen a través de sendChatMessageAction
    const sendRes = await sendChatMessageAction({
      threadId: testThread.id,
      sender: "agent",
      text: "Fotografía de arreglo floral",
      mediaBase64: sampleImageBuf.toString("base64"),
      mediaMimeType: "image/jpeg",
      mediaFileName: "rosa_roja.jpg",
    });

    assert(sendRes.success === true, "sendChatMessageAction respondió con success: true", sendRes.error);

    const createdMsg = sendRes.data as {
      id: string;
      mediaUrl: string;
      mediaType: string;
      sender: string;
      text: string;
    };

    assert(Boolean(createdMsg?.id), "Mensaje generado con ID único en ChatMessage");
    assert(
      Boolean(createdMsg?.mediaUrl && createdMsg.mediaUrl.startsWith("/uploads/instagram/out_")),
      "mediaUrl guardado con prefijo '/uploads/instagram/out_'",
      undefined,
      { mediaUrl: createdMsg?.mediaUrl }
    );
    assert(createdMsg?.mediaType === "image", "mediaType clasificado como 'image'");
    assert(
      createdMsg?.sender?.toLowerCase() === "agent",
      "sender registrado con rol 'agent'",
      undefined,
      { sender: createdMsg?.sender }
    );

    // Verificar archivo físico en disco
    const diskPath = path.join(process.cwd(), "public", createdMsg.mediaUrl.replace(/^\//, ""));
    assert(fs.existsSync(diskPath), "Archivo adjunto existe físicamente en disco", undefined, { diskPath });
    if (fs.existsSync(diskPath)) {
      createdFiles.push(diskPath);
      const diskContent = fs.readFileSync(diskPath);
      assert(diskContent.equals(sampleImageBuf), "Contenido en disco coincide exactamente con el Buffer transmitido");
    }

    // ---------------------------------------------------------
    // 4. Verificación de Despacho de Documentos (PDF / File)
    // ---------------------------------------------------------
    console.log("\n4. Verificando guardado y tipado de documentos (PDF)...");
    const dummyPdfContent = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
    const pdfSendRes = await sendChatMessageAction({
      threadId: testThread.id,
      sender: "agent",
      text: "Catálogo PDF adjunto",
      mediaBase64: dummyPdfContent.toString("base64"),
      mediaMimeType: "application/pdf",
      mediaFileName: "catalogo_farfalina.pdf",
    });

    assert(pdfSendRes.success === true, "sendChatMessageAction para PDF exitoso", pdfSendRes.error);
    const pdfMsg = pdfSendRes.data as { id: string; mediaUrl: string; mediaType: string };
    assert(pdfMsg?.mediaType === "document", "PDF clasificado como 'document' en ChatMessage");

    const pdfDiskPath = path.join(process.cwd(), "public", pdfMsg.mediaUrl.replace(/^\//, ""));
    assert(fs.existsSync(pdfDiskPath), "Archivo PDF existe físicamente en disco", undefined, { pdfDiskPath });
    if (fs.existsSync(pdfDiskPath)) {
      createdFiles.push(pdfDiskPath);
    }

    // ---------------------------------------------------------
    // 5. Verificación de Estructura de Payload y Graph API
    // ---------------------------------------------------------
    console.log("\n5. Verificando estructura de llamada a Meta Graph API...");
    // Consultar token de Instagram configurado
    const igConfig = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Instagram", environment: "farfalina" } },
    });

    assert(Boolean(igConfig?.instagramAccessToken), "Token de Instagram disponible en ChannelConfig");

    if (igConfig?.instagramAccessToken) {
      // Probar despacho directo a Instagram Send API con la URL pública
      const testPublicUrl = resolvePublicMediaUrl(createdMsg.mediaUrl);
      console.log(`  -> URL pública para Graph API: ${testPublicUrl}`);

      const dispatchResult = await sendInstagramDirectMediaMessage({
        accessToken: igConfig.instagramAccessToken,
        recipientIgsid: testRecipientIgsid,
        mediaUrl: testPublicUrl,
        mimeType: "image/jpeg",
        caption: "Prueba automatizada de verificación de multimedia",
      });

      console.log("  -> Resultado de Meta Graph API:", dispatchResult);

      assert(
        dispatchResult.success === true && Boolean(dispatchResult.messageId),
        "Graph API aceptó el payload con attachment.payload.url y retornó message_id",
        dispatchResult.error,
        dispatchResult
      );
    }

    // Limpieza de datos de prueba en base de datos
    if (createdMsg?.id) {
      await prisma.relayOutboundQueue.deleteMany({ where: { messageId: createdMsg.id } }).catch(() => {});
      await prisma.chatMessage.deleteMany({ where: { id: createdMsg.id } }).catch(() => {});
    }
    if (pdfMsg?.id) {
      await prisma.relayOutboundQueue.deleteMany({ where: { messageId: pdfMsg.id } }).catch(() => {});
      await prisma.chatMessage.deleteMany({ where: { id: pdfMsg.id } }).catch(() => {});
    }
    if (isNewlyCreated) {
      await prisma.chatThread.deleteMany({ where: { id: testThread.id } }).catch(() => {});
    }
    console.log("\n  -> Registros de prueba en SQLite limpiados correctamente.");
  } finally {
    // Limpieza de archivos temporales en disco
    for (const f of createdFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {}
      }
    }
  }

  // ---------------------------------------------------------
  // Resumen Final
  // ---------------------------------------------------------
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log(`\n=============================================================`);
  console.log(`=== RESUMEN DE VERIFICACIÓN: ${passedCount} PASSED, ${failedCount} FAILED ===`);
  console.log(`=============================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error("Error fatal en verificación:", err);
  process.exit(1);
});
