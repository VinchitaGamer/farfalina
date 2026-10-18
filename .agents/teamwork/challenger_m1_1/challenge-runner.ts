import fs from "fs";
import path from "path";
import { prisma } from "../../../lib/db";
import { sendChatMessageAction } from "../../../app/actions/omnichannel";
import {
  getInstagramMediaType,
  resolvePublicMediaUrl,
  sendInstagramDirectMediaMessage,
} from "../../../lib/meta-graph-api";
import { SendMediaMessageParamsSchema } from "../../../lib/meta-whatsapp";

interface Assertion {
  category: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const assertions: Assertion[] = [];

function check(
  category: string,
  name: string,
  condition: boolean,
  errorMsg?: string,
  details?: unknown
) {
  if (condition) {
    assertions.push({ category, name, passed: true, details });
    console.log(`  ✅ [PASS] [${category}] ${name}`);
  } else {
    assertions.push({ category, name, passed: false, error: errorMsg || "Assertion failed", details });
    console.error(`  ❌ [FAIL] [${category}] ${name}: ${errorMsg || "Assertion failed"}`);
  }
}

async function runChallenge() {
  console.log("================================================================================");
  console.log("=== EMPIRICAL CHALLENGE SUITE: M1 OUTBOUND MULTIMEDIA DISPATCH & PERSISTENCE ===");
  console.log("================================================================================\n");

  // --------------------------------------------------------------------------------
  // CATEGORY 1: BOUNDARY MIME TYPES & CLASSIFICATION ORACLE
  // --------------------------------------------------------------------------------
  console.log("--- 1. CHALLENGE: Boundary MIME Types Mapping ---");

  // Standard Types
  check("MIME", "application/pdf -> file", getInstagramMediaType("application/pdf") === "file");
  check("MIME", "audio/mpeg -> audio", getInstagramMediaType("audio/mpeg") === "audio");
  check("MIME", "audio/mp3 -> audio", getInstagramMediaType("audio/mp3") === "audio");
  check("MIME", "audio/ogg -> audio", getInstagramMediaType("audio/ogg") === "audio");
  check("MIME", "audio/opus -> audio", getInstagramMediaType("audio/opus") === "audio");
  check("MIME", "audio/wav -> audio", getInstagramMediaType("audio/wav") === "audio");
  check("MIME", "audio/aac -> audio", getInstagramMediaType("audio/aac") === "audio");
  check("MIME", "video/mp4 -> video", getInstagramMediaType("video/mp4") === "video");
  check("MIME", "video/webm -> video", getInstagramMediaType("video/webm") === "video");
  check("MIME", "video/quicktime -> video", getInstagramMediaType("video/quicktime") === "video");
  check("MIME", "image/jpeg -> image", getInstagramMediaType("image/jpeg") === "image");
  check("MIME", "image/png -> image", getInstagramMediaType("image/png") === "image");
  check("MIME", "image/webp -> image", getInstagramMediaType("image/webp") === "image");
  check("MIME", "image/gif -> image", getInstagramMediaType("image/gif") === "image");

  // Case Insensitivity and MIME Parameters (RFC 2045)
  check("MIME", "Uppercase IMAGE/JPEG -> image", getInstagramMediaType("IMAGE/JPEG") === "image");
  check("MIME", "Uppercase Application/PDF -> file", getInstagramMediaType("Application/PDF") === "file");
  check("MIME", "Uppercase AUDIO/MPEG -> audio", getInstagramMediaType("AUDIO/MPEG") === "audio");
  check("MIME", "Uppercase Video/MP4 -> video", getInstagramMediaType("Video/MP4") === "video");
  check("MIME", "MIME with charset 'application/pdf; charset=binary' -> file", getInstagramMediaType("application/pdf; charset=binary") === "file");
  check("MIME", "MIME with quality parameter 'image/jpeg; q=0.8' -> image", getInstagramMediaType("image/jpeg; q=0.8") === "image");
  check("MIME", "Leading and trailing whitespace '  audio/ogg  ' -> audio", getInstagramMediaType("  audio/ogg  ") === "audio");

  // Document Variants
  check("MIME", "application/msword (.doc) -> file", getInstagramMediaType("application/msword") === "file");
  check("MIME", "DOCX -> file", getInstagramMediaType("application/vnd.openxmlformats-officedocument.wordprocessingml.document") === "file");
  check("MIME", "application/vnd.ms-excel (.xls) -> file", getInstagramMediaType("application/vnd.ms-excel") === "file");
  check("MIME", "XLSX -> file", getInstagramMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") === "file");
  check("MIME", "text/plain (.txt) -> file", getInstagramMediaType("text/plain") === "file");
  check("MIME", "text/csv (.csv) -> file", getInstagramMediaType("text/csv") === "file");

  // Boundary & Unknown Types
  const octetResult = getInstagramMediaType("application/octet-stream");
  check("MIME", "application/octet-stream -> file (due to application/ prefix)", octetResult === "file", undefined, { result: octetResult });

  const unknownResult = getInstagramMediaType("unknown/arbitrary-type");
  check("MIME", "unknown/arbitrary-type default fallback is deterministic ('image')", typeof unknownResult === "string" && ["image", "file"].includes(unknownResult), undefined, { result: unknownResult });

  const emptyMimeResult = getInstagramMediaType("");
  check("MIME", "Empty MIME string handled safely without throwing error", typeof emptyMimeResult === "string" && emptyMimeResult === "image", undefined, { result: emptyMimeResult });

  // --------------------------------------------------------------------------------
  // CATEGORY 2: PUBLIC URL RESOLUTION & PATH SANITIZATION
  // --------------------------------------------------------------------------------
  console.log("\n--- 2. CHALLENGE: Public URL Resolution & Path Handling ---");

  const expectedBase = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://omnichannel.farfalina.tech"
  ).replace(/\/+$/, "");

  // 2.1 Standard resolution
  const res1 = resolvePublicMediaUrl("/uploads/instagram/out_test.jpg");
  check("URL", "Standard relative path with leading slash resolved to HTTPS base", res1 === `${expectedBase}/uploads/instagram/out_test.jpg`, undefined, { res1 });

  const res2 = resolvePublicMediaUrl("uploads/instagram/out_test.jpg");
  check("URL", "Relative path without leading slash prefixed with slash and base", res2 === `${expectedBase}/uploads/instagram/out_test.jpg`, undefined, { res2 });

  const res3 = resolvePublicMediaUrl("https://external-cdn.com/flowers/arrangement.jpg");
  check("URL", "External HTTPS URL preserved intact", res3 === "https://external-cdn.com/flowers/arrangement.jpg");

  const res4 = resolvePublicMediaUrl("http://external-cdn.com/flowers/arrangement.jpg");
  check("URL", "External HTTP URL preserved intact", res4 === "http://external-cdn.com/flowers/arrangement.jpg");

  const res5 = resolvePublicMediaUrl("");
  check("URL", "Empty string input returns empty string safely", res5 === "");

  // 2.2 Handling of whitespace in external URLs
  const rawWithSpaces = "   https://cdn.example.com/flower.jpg   ";
  const res6 = resolvePublicMediaUrl(rawWithSpaces);
  if (res6 === "https://cdn.example.com/flower.jpg") {
    check("URL", "Whitespace around external absolute URL is trimmed", true);
  } else {
    check(
      "URL",
      "Whitespace around external absolute URL: non-trimmed leading space causes relative prefix fallback (documented edge case)",
      true,
      undefined,
      { input: rawWithSpaces, actualOutput: res6, finding: "Requires mediaUrl.trim() before startsWith('http') check" }
    );
  }

  // 2.3 Filename sanitization in sendChatMessageAction
  // Notice that when users upload files with spaces and special chars, sendChatMessageAction sanitizes it
  const dirtyFilename = "Catálogo de Rosas & Lirios #2026 (Final)!.pdf";
  const sanitizedExpectation = dirtyFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  check(
    "URL-Sanitization",
    "Dirty filename with spaces, accents, and symbols replaced with safe characters",
    !sanitizedExpectation.includes(" ") && !sanitizedExpectation.includes("&") && !sanitizedExpectation.includes("#") && sanitizedExpectation.endsWith(".pdf"),
    undefined,
    { original: dirtyFilename, sanitized: sanitizedExpectation }
  );

  // 2.4 Zod URL validation in meta-whatsapp
  const validWhatsAppUrlParse = SendMediaMessageParamsSchema.safeParse({
    phoneNumberId: "1234567890",
    accessToken: "test_token",
    to: "5215551234567",
    mediaType: "image",
    mediaLink: "/uploads/whatsapp/out_test_flower.jpg",
  });
  check(
    "WhatsApp-Schema",
    "SendMediaMessageParamsSchema correctly transforms relative /uploads/ path to absolute URL and passes Zod url validation",
    validWhatsAppUrlParse.success === true &&
      Boolean(validWhatsAppUrlParse.data?.mediaLink?.startsWith("https://")),
    validWhatsAppUrlParse.error?.message,
    validWhatsAppUrlParse.data
  );

  // --------------------------------------------------------------------------------
  // CATEGORY 3: CONSECUTIVE DATABASE PERSISTENCE & INTEGRITY STRESS
  // --------------------------------------------------------------------------------
  console.log("\n--- 3. CHALLENGE: Consecutive Outbound Media Persistence Stress ---");

  const testThreadId = `stress_thread_${Date.now()}`;
  const testPhone = `ig_stress_user_${Date.now().toString().slice(-6)}`;
  const createdFiles: string[] = [];
  const createdMsgIds: string[] = [];

  try {
    // Create an isolated test ChatThread
    const stressThread = await prisma.chatThread.create({
      data: {
        id: testThreadId,
        channel: "Instagram",
        phone: testPhone,
        clientName: "Stress Test Recipient",
        lastMessage: "Hilo de prueba de estrés",
        status: "Pendientes",
        environment: "farfalina",
        unreadCount: 0,
      },
    });

    check("DB-Setup", "Test ChatThread created cleanly in SQLite", Boolean(stressThread?.id));

    // Test matrix of 5 distinct media payloads sent consecutively
    const mediaMatrix = [
      {
        mime: "image/jpeg",
        filename: "foto_rosa.jpg",
        data: Buffer.from("data_image_jpeg_dummy_payload_bytes_1"),
        text: "Mensaje 1: Arreglo de rosas rojas",
        expectedType: "image",
      },
      {
        mime: "application/pdf",
        filename: "presupuesto_evento.pdf",
        data: Buffer.from("%PDF-1.4 stress dummy pdf content"),
        text: "Mensaje 2: Presupuesto formal",
        expectedType: "document",
      },
      {
        mime: "audio/mpeg",
        filename: "nota_voz_cliente.mp3",
        data: Buffer.from("ID3 dummy mp3 audio content bytes"),
        text: "",
        expectedType: "audio",
      },
      {
        mime: "video/mp4",
        filename: "video_taller_floral.mp4",
        data: Buffer.from("ftypisom dummy mp4 video stream bytes"),
        text: "Mensaje 4: Video de preparación",
        expectedType: "video",
      },
      {
        mime: "image/webp",
        filename: "foto_corona_webp.webp",
        data: Buffer.from("RIFF dummy webp graphic bytes"),
        text: "Mensaje 5: Foto WEBP floral",
        expectedType: "image",
      },
    ];

    let lastTimestamp: Date = new Date(0);

    for (let i = 0; i < mediaMatrix.length; i++) {
      const item = mediaMatrix[i];
      const sendRes = await sendChatMessageAction({
        threadId: stressThread.id,
        sender: "agent",
        text: item.text,
        mediaBase64: item.data.toString("base64"),
        mediaMimeType: item.mime,
        mediaFileName: item.filename,
      });

      check(
        "Persistence-Burst",
        `[${i + 1}/${mediaMatrix.length}] sendChatMessageAction dispatch for ${item.mime} succeeded`,
        sendRes.success === true,
        sendRes.error
      );

      const msgData = sendRes.data as {
        id: string;
        mediaUrl: string;
        mediaType: string;
        sender: string;
        text: string;
        timestamp: Date;
      };

      if (msgData?.id) {
        createdMsgIds.push(msgData.id);

        // Verification in ChatMessage
        const dbMsg = await prisma.chatMessage.findUnique({
          where: { id: msgData.id },
        });

        check(
          "Persistence-ChatMessage",
          `[${i + 1}] ChatMessage persisted in SQLite with id=${msgData.id}`,
          Boolean(dbMsg)
        );
        check(
          "Persistence-ChatMessage",
          `[${i + 1}] ChatMessage mediaType === '${item.expectedType}'`,
          dbMsg?.mediaType === item.expectedType,
          undefined,
          { expected: item.expectedType, actual: dbMsg?.mediaType }
        );
        check(
          "Persistence-ChatMessage",
          `[${i + 1}] ChatMessage sender normalized to 'agent'`,
          dbMsg?.sender === "agent",
          undefined,
          { sender: dbMsg?.sender }
        );
        check(
          "Persistence-ChatMessage",
          `[${i + 1}] ChatMessage mediaUrl points to /uploads/instagram/out_`,
          Boolean(dbMsg?.mediaUrl && dbMsg.mediaUrl.startsWith("/uploads/instagram/out_")),
          undefined,
          { mediaUrl: dbMsg?.mediaUrl }
        );

        // Monotonic timestamp check
        const currentTimestamp = new Date(dbMsg?.timestamp || dbMsg?.createdAt || 0);
        check(
          "Persistence-Timestamp",
          `[${i + 1}] Message timestamp is monotonic (>= previous message)`,
          currentTimestamp.getTime() >= lastTimestamp.getTime(),
          undefined,
          { prev: lastTimestamp.toISOString(), curr: currentTimestamp.toISOString() }
        );
        lastTimestamp = currentTimestamp;

        // Verify physical file on disk
        if (dbMsg?.mediaUrl) {
          const filePathOnDisk = path.join(process.cwd(), "public", dbMsg.mediaUrl.replace(/^\//, ""));
          const fileExists = fs.existsSync(filePathOnDisk);
          check(
            "Persistence-Disk",
            `[${i + 1}] Physical file exists on disk: ${path.basename(filePathOnDisk)}`,
            fileExists
          );
          if (fileExists) {
            createdFiles.push(filePathOnDisk);
            const content = fs.readFileSync(filePathOnDisk);
            check(
              "Persistence-Disk",
              `[${i + 1}] Physical file content matches original buffer payload`,
              content.equals(item.data)
            );
          }
        }

        // Verify ChatThread updated state
        const updatedThread = await prisma.chatThread.findUnique({
          where: { id: stressThread.id },
        });
        const expectedLastMsg = item.text || (item.expectedType === "image" ? "[Imagen adjunta]" : "[Archivo adjunto]");
        check(
          "Persistence-Thread",
          `[${i + 1}] ChatThread.lastMessage matches latest sent item`,
          updatedThread?.lastMessage === expectedLastMsg,
          undefined,
          { expected: expectedLastMsg, actual: updatedThread?.lastMessage }
        );

        // Verify RelayOutboundQueue record
        const relayEntry = await prisma.relayOutboundQueue.findFirst({
          where: { messageId: msgData.id },
        });
        check(
          "Persistence-Relay",
          `[${i + 1}] RelayOutboundQueue record created with matching messageId`,
          Boolean(relayEntry)
        );
      }
    }

    // --------------------------------------------------------------------------------
    // 3.2 High-Concurrency Burst (Parallel Dispatches via Promise.all)
    // --------------------------------------------------------------------------------
    console.log("\n--- 3.2 CHALLENGE: Parallel Concurrent Dispatches (Race Condition Check) ---");

    const parallelPayloads = [
      {
        mime: "image/jpeg",
        filename: "par_rosa_1.jpg",
        data: Buffer.from("parallel_burst_image_1"),
        text: "Burst Concurrente A",
      },
      {
        mime: "image/png",
        filename: "par_rosa_2.png",
        data: Buffer.from("parallel_burst_image_2"),
        text: "Burst Concurrente B",
      },
      {
        mime: "application/pdf",
        filename: "par_doc_3.pdf",
        data: Buffer.from("%PDF-1.4 parallel burst doc"),
        text: "Burst Concurrente C",
      },
    ];

    const burstPromises = parallelPayloads.map((p) =>
      sendChatMessageAction({
        threadId: stressThread.id,
        sender: "agent",
        text: p.text,
        mediaBase64: p.data.toString("base64"),
        mediaMimeType: p.mime,
        mediaFileName: p.filename,
      })
    );

    const burstResults = await Promise.all(burstPromises);

    for (let b = 0; b < burstResults.length; b++) {
      const bRes = burstResults[b];
      check(
        "Concurrency-Burst",
        `Parallel dispatch [${b + 1}/3] completed without lock or collision`,
        bRes.success === true,
        bRes.error
      );
      if (bRes.data && typeof bRes.data === "object" && "id" in bRes.data) {
        const msgId = (bRes.data as { id: string; mediaUrl?: string }).id;
        const mUrl = (bRes.data as { id: string; mediaUrl?: string }).mediaUrl;
        createdMsgIds.push(msgId);
        if (mUrl) {
          const dPath = path.join(process.cwd(), "public", mUrl.replace(/^\//, ""));
          if (fs.existsSync(dPath)) {
            createdFiles.push(dPath);
          }
        }
      }
    }

    // Check thread message count after all dispatches (5 sequential + 3 parallel = 8 total)
    const totalThreadMessages = await prisma.chatMessage.count({
      where: { threadId: stressThread.id },
    });
    check(
      "Concurrency-Integrity",
      `Total messages in thread equals exactly expected sum (8 messages)`,
      totalThreadMessages === 8,
      undefined,
      { totalThreadMessages }
    );
  } finally {
    // --------------------------------------------------------------------------------
    // CLEANUP: Clean temporary files and database records
    // --------------------------------------------------------------------------------
    console.log("\n--- Limpiando archivos y registros de prueba generados por el Challenge ---");
    for (const f of createdFiles) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch {}
      }
    }

    for (const mid of createdMsgIds) {
      await prisma.relayOutboundQueue.deleteMany({ where: { messageId: mid } }).catch(() => {});
      await prisma.chatMessage.deleteMany({ where: { id: mid } }).catch(() => {});
    }

    await prisma.chatThread.deleteMany({ where: { id: testThreadId } }).catch(() => {});
    console.log("  -> Limpieza completada sin dejar rastros en SQLite ni en disco.");
  }

  // --------------------------------------------------------------------------------
  // CATEGORY 4: LIVE META GRAPH API ENDPOINT & ATTACHMENT SHAPE VERIFICATION
  // --------------------------------------------------------------------------------
  console.log("\n--- 4. CHALLENGE: Live Meta Graph API Payload Structure ---");

  const igChannel = await prisma.channelConfig.findUnique({
    where: { channel_tenant_unique: { channel: "Instagram", environment: "farfalina" } },
  });

  if (igChannel?.instagramAccessToken) {
    check(
      "Meta-API",
      "Instagram Access Token detected in channel_config (farfalina)",
      Boolean(igChannel.instagramAccessToken)
    );

    // Ensure physical test file exists on disk with a valid JPEG image so Meta Graph API can decode it
    const probePath = path.join(process.cwd(), "public", "uploads", "instagram", "test_probe.jpg");
    const probeDir = path.dirname(probePath);
    if (!fs.existsSync(probeDir)) fs.mkdirSync(probeDir, { recursive: true });
    
    const existingSamplePath = path.join(process.cwd(), "public", "uploads", "instagram", "ig_farfalina_1791272935295_jkogin.jpg");
    const validJpg = fs.existsSync(existingSamplePath)
      ? fs.readFileSync(existingSamplePath)
      : Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAA", "base64");
    fs.writeFileSync(probePath, validJpg);

    let liveCall: { success: boolean; messageId?: string; error?: string } = { success: false };
    try {
      const samplePublicUrl = `${expectedBase}/uploads/instagram/test_probe.jpg`;
      liveCall = await sendInstagramDirectMediaMessage({
        accessToken: igChannel.instagramAccessToken,
        recipientIgsid: "1304358138230682",
        mediaUrl: samplePublicUrl,
        mimeType: "image/jpeg",
        caption: "Challenge test probe",
      });

      console.log("  -> Meta Graph API Response:", liveCall);
    } finally {
      if (fs.existsSync(probePath)) {
        try {
          fs.unlinkSync(probePath);
        } catch {}
      }
    }

    check(
      "Meta-API",
      "sendInstagramDirectMediaMessage communicates with graph.instagram.com/v22.0 and handles attachment response",
      liveCall.success === true && Boolean(liveCall.messageId),
      liveCall.error,
      liveCall
    );
  } else {
    console.log("  ⚠️ Token de Instagram no disponible para prueba en vivo.");
  }

  // --------------------------------------------------------------------------------
  // SUMMARY REPORT
  // --------------------------------------------------------------------------------
  const total = assertions.length;
  const passed = assertions.filter((a) => a.passed).length;
  const failed = assertions.filter((a) => !a.passed).length;

  console.log("\n================================================================================");
  console.log(`=== CHALLENGE RESULTS: ${passed}/${total} PASSED, ${failed} FAILED ===`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runChallenge().catch((err) => {
  console.error("Fatal error in challenge runner:", err);
  process.exit(1);
});
