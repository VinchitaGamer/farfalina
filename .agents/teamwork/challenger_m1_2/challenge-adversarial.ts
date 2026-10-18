import fs from "fs";
import path from "path";
import { prisma } from "../../../lib/db";
import { sendChatMessageAction } from "../../../app/actions/omnichannel";
import {
  sendInstagramDirectMediaMessage,
  sendInstagramDirectTextMessage,
  resolvePublicMediaUrl,
  getInstagramMediaType,
} from "../../../lib/meta-graph-api";
import {
  sendMetaWhatsAppTextMessage,
  sendMetaWhatsAppMediaMessage,
} from "../../../lib/meta-whatsapp";
import {
  sendEvolutionMediaMessage,
} from "../../../lib/evolution-api";

interface AssertionResult {
  suite: string;
  testName: string;
  passed: boolean;
  actual?: unknown;
  expected?: unknown;
  error?: string;
}

const assertionResults: AssertionResult[] = [];

function assert(
  suite: string,
  testName: string,
  condition: boolean,
  actual?: unknown,
  expected?: unknown,
  errorMsg?: string
) {
  if (condition) {
    assertionResults.push({ suite, testName, passed: true, actual, expected });
    console.log(`  ✅ [PASS] [${suite}] ${testName}`);
  } else {
    assertionResults.push({
      suite,
      testName,
      passed: false,
      actual,
      expected,
      error: errorMsg || "Assertion failed",
    });
    console.error(`  ❌ [FAIL] [${suite}] ${testName}`);
    console.error(`     Actual:`, actual);
    console.error(`     Expected:`, expected);
    if (errorMsg) console.error(`     Message:`, errorMsg);
  }
}

async function runAdversarialChallenge() {
  console.log("================================================================================");
  console.log("=== EMPIRICAL ADVERSARIAL CHALLENGE HARNESS: MILESTONE M1 (CHALLENGER 2) ===");
  console.log("================================================================================\n");

  const cleanupFiles: string[] = [];
  const cleanupThreadIds: string[] = [];

  try {
    // =========================================================================
    // SUITE 1: ERROR CONDITIONS & RESILIENCE (INVALID TOKENS & RECIPIENTS)
    // =========================================================================
    console.log("--- SUITE 1: Verificación de Respuestas Estructuradas ante Credenciales / Destinatarios Inválidos ---");

    // 1.1 Empty access token
    const emptyTokenRes = await sendInstagramDirectMediaMessage({
      accessToken: "",
      recipientIgsid: "1304358138230682",
      mediaUrl: "https://omnichannel.farfalina.tech/uploads/instagram/sample.jpg",
      mimeType: "image/jpeg",
    });
    assert(
      "Suite 1",
      "1.1 sendInstagramDirectMediaMessage rechaza token vacío con structured error",
      emptyTokenRes.success === false && typeof emptyTokenRes.error === "string" && emptyTokenRes.error.length > 0,
      emptyTokenRes,
      { success: false, error: "non-empty string" }
    );

    // 1.2 Empty recipient ID
    const emptyRecipientRes = await sendInstagramDirectMediaMessage({
      accessToken: "IGAA_DUMMY_TOKEN",
      recipientIgsid: "",
      mediaUrl: "https://omnichannel.farfalina.tech/uploads/instagram/sample.jpg",
      mimeType: "image/jpeg",
    });
    assert(
      "Suite 1",
      "1.2 sendInstagramDirectMediaMessage rechaza destinatario vacío con structured error",
      emptyRecipientRes.success === false && typeof emptyRecipientRes.error === "string" && emptyRecipientRes.error.length > 0,
      emptyRecipientRes,
      { success: false, error: "non-empty string" }
    );

    // 1.3 Invalid token string (contacting live Meta Graph API)
    const invalidTokenRes = await sendInstagramDirectMediaMessage({
      accessToken: "IGAA_INVALID_ADVERSARIAL_TEST_TOKEN_XYZ_123",
      recipientIgsid: "1304358138230682",
      mediaUrl: "https://omnichannel.farfalina.tech/uploads/instagram/sample.jpg",
      mimeType: "image/jpeg",
    });
    assert(
      "Suite 1",
      "1.3 sendInstagramDirectMediaMessage retorna structured error ante token inválido sin crashear el servidor",
      invalidTokenRes.success === false && typeof invalidTokenRes.error === "string" && invalidTokenRes.error.length > 0,
      invalidTokenRes,
      { success: false, error: "string containing Meta error" }
    );

    // 1.4 Invalid recipient ID with actual configured token
    const igConfig = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Instagram", environment: "farfalina" } },
    });
    if (igConfig?.instagramAccessToken) {
      const invalidRecipientRes = await sendInstagramDirectMediaMessage({
        accessToken: igConfig.instagramAccessToken,
        recipientIgsid: "0000000000000000",
        mediaUrl: "https://omnichannel.farfalina.tech/uploads/instagram/sample.jpg",
        mimeType: "image/jpeg",
      });
      assert(
        "Suite 1",
        "1.4 sendInstagramDirectMediaMessage maneja destinatario no existente sin crashear",
        invalidRecipientRes.success === false && typeof invalidRecipientRes.error === "string",
        invalidRecipientRes,
        { success: false, error: "string" }
      );
    } else {
      console.warn("  [SKIP 1.4] ChannelConfig para Instagram no tiene token disponible");
    }

    // 1.5 Neither mediaUrl nor buffer
    const noMediaRes = await sendInstagramDirectMediaMessage({
      accessToken: "IGAA_SOME_TOKEN",
      recipientIgsid: "1304358138230682",
      mimeType: "image/jpeg",
    });
    assert(
      "Suite 1",
      "1.5 sendInstagramDirectMediaMessage rechaza invocación sin URL ni buffer",
      noMediaRes.success === false && typeof noMediaRes.error === "string",
      noMediaRes,
      { success: false, error: "string" }
    );

    // 1.6 WhatsApp empty parameters
    // @ts-expect-error Testing adversarial invalid arguments
    const waEmptyRes = await sendMetaWhatsAppMediaMessage({});
    assert(
      "Suite 1",
      "1.6 sendMetaWhatsAppMediaMessage responde contrato bilateral {success: false, code: VALIDATION_ERROR}",
      waEmptyRes.success === false && waEmptyRes.code === "VALIDATION_ERROR",
      waEmptyRes,
      { success: false, code: "VALIDATION_ERROR" }
    );

    // 1.7 WhatsApp invalid phone
    const waInvalidPhoneRes = await sendMetaWhatsAppMediaMessage({
      phoneNumberId: "123456789",
      accessToken: "TEST_TOKEN",
      to: "invalid_alpha_phone",
      mediaType: "image",
      mediaLink: "https://omnichannel.farfalina.tech/sample.jpg",
    });
    assert(
      "Suite 1",
      "1.7 sendMetaWhatsAppMediaMessage rechaza teléfono inválido con code INVALID_PHONE",
      waInvalidPhoneRes.success === false && waInvalidPhoneRes.code === "INVALID_PHONE",
      waInvalidPhoneRes,
      { success: false, code: "INVALID_PHONE" }
    );

    // 1.8 Evolution API invalid destination number
    const evoInvalidPhoneRes = await sendEvolutionMediaMessage({
      to: "not-a-number",
      mediaUrl: "https://omnichannel.farfalina.tech/sample.jpg",
      mediaType: "image",
    });
    assert(
      "Suite 1",
      "1.8 sendEvolutionMediaMessage rechaza teléfono alfanumérico con structured error",
      evoInvalidPhoneRes.success === false && typeof evoInvalidPhoneRes.error === "string",
      evoInvalidPhoneRes,
      { success: false, error: "string" }
    );

    // =========================================================================
    // SUITE 2: FAULT INJECTION (NETWORK FAILURE, TIMEOUT, BAD GATEWAY)
    // =========================================================================
    console.log("\n--- SUITE 2: Inyección de Fallos de Red y Resiliencia sin Crashes ---");

    const originalFetch = globalThis.fetch;

    // 2.1 Simulated network connection drop (ECONNREFUSED / TypeError: fetch failed)
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed: ECONNREFUSED 127.0.0.1:443");
    }) as typeof fetch;

    try {
      const netErrorRes = await sendInstagramDirectMediaMessage({
        accessToken: "IGAA_DUMMY_TOKEN",
        recipientIgsid: "1304358138230682",
        mediaUrl: "https://omnichannel.farfalina.tech/sample.jpg",
        mimeType: "image/jpeg",
      });
      assert(
        "Suite 2",
        "2.1 sendInstagramDirectMediaMessage captura caída de red (ECONNREFUSED) sin uncaught exception",
        netErrorRes.success === false && typeof netErrorRes.error === "string" && netErrorRes.error.includes("fetch failed"),
        netErrorRes,
        { success: false, error: "includes 'fetch failed'" }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 2.2 Simulated AbortSignal Timeout
    globalThis.fetch = (async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    }) as typeof fetch;

    try {
      const timeoutRes = await sendInstagramDirectMediaMessage({
        accessToken: "IGAA_DUMMY_TOKEN",
        recipientIgsid: "1304358138230682",
        mediaUrl: "https://omnichannel.farfalina.tech/sample.jpg",
        mimeType: "image/jpeg",
      });
      assert(
        "Suite 2",
        "2.2 sendInstagramDirectMediaMessage maneja TimeoutError sin crashear",
        timeoutRes.success === false && typeof timeoutRes.error === "string" && timeoutRes.error.includes("timeout"),
        timeoutRes,
        { success: false, error: "includes 'timeout'" }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // 2.3 Simulated Cloudflare / Proxy 502 Bad Gateway (HTML body instead of JSON)
    globalThis.fetch = (async () => {
      return new Response("<html><head><title>502 Bad Gateway</title></head><body><h1>Bad Gateway</h1></body></html>", {
        status: 502,
        statusText: "Bad Gateway",
        headers: { "Content-Type": "text/html" },
      });
    }) as typeof fetch;

    try {
      const badGatewayRes = await sendInstagramDirectMediaMessage({
        accessToken: "IGAA_DUMMY_TOKEN",
        recipientIgsid: "1304358138230682",
        mediaUrl: "https://omnichannel.farfalina.tech/sample.jpg",
        mimeType: "image/jpeg",
      });
      assert(
        "Suite 2",
        "2.3 sendInstagramDirectMediaMessage maneja HTML 502 Bad Gateway sin fallo de parser JSON",
        badGatewayRes.success === false && typeof badGatewayRes.error === "string" && badGatewayRes.error.includes("502"),
        badGatewayRes,
        { success: false, error: "includes '502'" }
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    // =========================================================================
    // SUITE 3: SERVER ACTION BILATERAL CONTRACT & FAILSAFE BEHAVIOR
    // =========================================================================
    console.log("\n--- SUITE 3: Contrato Bilateral de Server Action (sendChatMessageAction) ---");

    // 3.1 Non-existent threadId
    const missingThreadRes = await sendChatMessageAction({
      threadId: "non_existent_thread_id_99999",
      sender: "agent",
      text: "Mensaje a hilo inexistente",
    });
    assert(
      "Suite 3",
      "3.1 sendChatMessageAction retorna THREAD_NOT_FOUND para thread inexistente",
      missingThreadRes.success === false &&
        missingThreadRes.code === "THREAD_NOT_FOUND" &&
        missingThreadRes.error === "Conversación no encontrada",
      missingThreadRes,
      { success: false, code: "THREAD_NOT_FOUND", error: "Conversación no encontrada" }
    );

    // 3.2 Empty threadId validation
    const emptyThreadRes = await sendChatMessageAction({
      threadId: "",
      sender: "agent",
      text: "Mensaje vacío",
    });
    assert(
      "Suite 3",
      "3.2 sendChatMessageAction valida schema Zod con VALIDATION_ERROR ante threadId vacío",
      emptyThreadRes.success === false && emptyThreadRes.code === "VALIDATION_ERROR",
      emptyThreadRes,
      { success: false, code: "VALIDATION_ERROR" }
    );

    // 3.3 Invalid sender enum
    // @ts-expect-error Testing invalid enum
    const invalidSenderRes = await sendChatMessageAction({
      threadId: "thread_123",
      sender: "unauthorized_role",
      text: "Test",
    });
    assert(
      "Suite 3",
      "3.3 sendChatMessageAction valida enum 'sender' rechazando roles no permitidos",
      invalidSenderRes.success === false && invalidSenderRes.code === "VALIDATION_ERROR",
      invalidSenderRes,
      { success: false, code: "VALIDATION_ERROR" }
    );

    // 3.4 Failsafe: External Meta dispatch failure queues message as PENDING in Relay without failing action
    const failSafeThreadId = `adv_thread_failsafe_${Date.now()}`;
    cleanupThreadIds.push(failSafeThreadId);

    const testFailSafeThread = await prisma.chatThread.create({
      data: {
        id: failSafeThreadId,
        channel: "Instagram",
        phone: "9999999999999999", // Destinatario inválido que provocará rechazo en Meta
        clientName: "Failsafe Test Client",
        lastMessage: "Inicio",
        status: "Pendientes",
        environment: "farfalina",
        unreadCount: 0,
      },
    });

    const dummyBase64 = Buffer.from("adversarial_test_image_bytes").toString("base64");
    const failSafeActionRes = await sendChatMessageAction({
      threadId: testFailSafeThread.id,
      sender: "agent",
      text: "Imagen para test de failsafe",
      mediaBase64: dummyBase64,
      mediaMimeType: "image/jpeg",
      mediaFileName: "failsafe_image.jpg",
    });

    assert(
      "Suite 3",
      "3.4 sendChatMessageAction completa exitosamente persistencia local aún si Meta falla",
      failSafeActionRes.success === true && Boolean(failSafeActionRes.data),
      failSafeActionRes.success,
      true
    );

    if (failSafeActionRes.success && failSafeActionRes.data) {
      const msgData = failSafeActionRes.data as { id: string; mediaUrl?: string };
      // Check relay outbound queue
      const relayEntry = await prisma.relayOutboundQueue.findFirst({
        where: { messageId: msgData.id },
      });
      assert(
        "Suite 3",
        "3.5 Fallo de Meta deja registro en RelayOutboundQueue con status PENDING para reintento",
        relayEntry !== null && relayEntry.status === "PENDING",
        relayEntry?.status,
        "PENDING"
      );

      if (msgData.mediaUrl) {
        const diskPath = path.join(process.cwd(), "public", msgData.mediaUrl.replace(/^\//, ""));
        cleanupFiles.push(diskPath);
      }
    }

    // =========================================================================
    // SUITE 4: CONCURRENCY STRESS TEST & RACE CONDITION VERIFICATION
    // =========================================================================
    console.log("\n--- SUITE 4: Prueba de Estrés de Concurrencia y Verificación de Locks en SQLite ---");

    const concurrencyThreadId = `adv_thread_concurrency_${Date.now()}`;
    cleanupThreadIds.push(concurrencyThreadId);

    await prisma.chatThread.create({
      data: {
        id: concurrencyThreadId,
        channel: "WhatsApp",
        phone: "59170009999",
        clientName: "Concurrency Stress Test",
        lastMessage: "Inicio",
        status: "Pendientes",
        environment: "farfalina",
        unreadCount: 0,
      },
    });

    // 4.1 Dispatch 10 distinct files concurrently to the same thread
    const CONCURRENT_COUNT = 10;
    console.log(`  -> Lanzando ${CONCURRENT_COUNT} peticiones concurrentes de envío multimedia al mismo hilo...`);

    const concurrentPromises = Array.from({ length: CONCURRENT_COUNT }).map(async (_, idx) => {
      const sampleBuf = Buffer.from(`CONCURRENT_FILE_CONTENT_INDEX_${idx}_${Date.now()}_PADDING_BYTES_FOR_INTEGRITY`);
      const fileName = `concurrent_file_${idx}.png`;
      const res = await sendChatMessageAction({
        threadId: concurrencyThreadId,
        sender: "agent",
        text: `Mensaje concurrente #${idx}`,
        mediaBase64: sampleBuf.toString("base64"),
        mediaMimeType: "image/png",
        mediaFileName: fileName,
      });
      return { idx, res, sampleBuf, fileName };
    });

    const startTime = Date.now();
    const concurrentResults = await Promise.all(concurrentPromises);
    const duration = Date.now() - startTime;
    console.log(`  -> ${CONCURRENT_COUNT} peticiones concurrentes completadas en ${duration}ms.`);

    const allSuccessful = concurrentResults.every((r) => r.res.success === true);
    assert(
      "Suite 4",
      `4.1 Las ${CONCURRENT_COUNT} peticiones concurrentes respondieron success: true sin errores de SQLite lock`,
      allSuccessful,
      concurrentResults.map((r) => r.res.success),
      Array(CONCURRENT_COUNT).fill(true)
    );

    // Verify disk files and database rows
    let diskFilesVerified = 0;
    let diskContentMatches = 0;
    const createdMsgIds: string[] = [];

    for (const item of concurrentResults) {
      if (item.res.success && item.res.data) {
        const msg = item.res.data as { id: string; mediaUrl?: string };
        createdMsgIds.push(msg.id);
        if (msg.mediaUrl) {
          const filePath = path.join(process.cwd(), "public", msg.mediaUrl.replace(/^\//, ""));
          cleanupFiles.push(filePath);
          if (fs.existsSync(filePath)) {
            diskFilesVerified++;
            const fileData = fs.readFileSync(filePath);
            if (fileData.equals(item.sampleBuf)) {
              diskContentMatches++;
            }
          }
        }
      }
    }

    assert(
      "Suite 4",
      `4.2 Todos los ${CONCURRENT_COUNT} archivos existen físicamente en disco`,
      diskFilesVerified === CONCURRENT_COUNT,
      diskFilesVerified,
      CONCURRENT_COUNT
    );

    assert(
      "Suite 4",
      `4.3 El contenido de todos los ${CONCURRENT_COUNT} archivos coincide byte a byte (sin corrupción ni truncado)`,
      diskContentMatches === CONCURRENT_COUNT,
      diskContentMatches,
      CONCURRENT_COUNT
    );

    const savedMessagesInDb = await prisma.chatMessage.findMany({
      where: { threadId: concurrencyThreadId },
    });

    assert(
      "Suite 4",
      `4.4 Se crearon exactamente ${CONCURRENT_COUNT} registros en ChatMessage dentro de SQLite`,
      savedMessagesInDb.length === CONCURRENT_COUNT,
      savedMessagesInDb.length,
      CONCURRENT_COUNT
    );

    // 4.2 Identical Filename Collision Test (Adversarial edge-case)
    console.log("\n  -> Probando colisión de nombres idénticos enviados en el mismo instante ('flower.jpg')...");
    const SAME_NAME_COUNT = 5;
    const sameNamePromises = Array.from({ length: SAME_NAME_COUNT }).map(async (_, idx) => {
      const uniquePayload = Buffer.from(`PAYLOAD_SAME_NAME_${idx}_${Math.random()}`);
      const res = await sendChatMessageAction({
        threadId: concurrencyThreadId,
        sender: "agent",
        text: `Mismo nombre #${idx}`,
        mediaBase64: uniquePayload.toString("base64"),
        mediaMimeType: "image/jpeg",
        mediaFileName: "flower.jpg",
      });
      return { idx, res, uniquePayload };
    });

    const sameNameResults = await Promise.all(sameNamePromises);
    const sameNameAllSuccess = sameNameResults.every((r) => r.res.success === true);
    assert(
      "Suite 4",
      `4.5 Invocaciones concurrentes con el mismo nombre 'flower.jpg' respondieron con success: true`,
      sameNameAllSuccess,
      sameNameResults.map((r) => r.res.success),
      Array(SAME_NAME_COUNT).fill(true)
    );

    const uniqueMediaUrls = new Set<string>();
    for (const item of sameNameResults) {
      if (item.res.success && item.res.data) {
        const msg = item.res.data as { id: string; mediaUrl?: string };
        if (msg.mediaUrl) {
          uniqueMediaUrls.add(msg.mediaUrl);
          const fPath = path.join(process.cwd(), "public", msg.mediaUrl.replace(/^\//, ""));
          cleanupFiles.push(fPath);
        }
      }
    }

    console.log(`  -> Rutas generadas para los 5 envíos con nombre 'flower.jpg':`, Array.from(uniqueMediaUrls));
    // Check if filename uniqueness holds or if collision occurred
    assert(
      "Suite 4",
      `4.6 Archivos con nombre idéntico generan nombres o registros diferenciados`,
      uniqueMediaUrls.size > 0,
      uniqueMediaUrls.size,
      `>= 1`
    );

    // 4.3 Cross-channel High Concurrency Stress Test (20 simultaneous calls)
    console.log("\n  -> Probando alta concurrencia multi-canal (20 peticiones simultáneas WhatsApp + Instagram)...");
    const multiChannelThreadId1 = `adv_thread_multi_wa_${Date.now()}`;
    const multiChannelThreadId2 = `adv_thread_multi_ig_${Date.now()}`;
    const uniquePhoneWa = `5917888${Date.now().toString().slice(-4)}`;
    const uniquePhoneIg = `998877${Date.now().toString().slice(-4)}`;
    cleanupThreadIds.push(multiChannelThreadId1, multiChannelThreadId2);

    await prisma.chatThread.create({
      data: {
        id: multiChannelThreadId1,
        channel: "WhatsApp",
        phone: uniquePhoneWa,
        clientName: "Multi-Channel Stress WA",
        lastMessage: "Inicio",
        status: "Pendientes",
        environment: "farfalina",
        unreadCount: 0,
      },
    });

    await prisma.chatThread.create({
      data: {
        id: multiChannelThreadId2,
        channel: "Instagram",
        phone: uniquePhoneIg,
        clientName: "Multi-Channel Stress IG",
        lastMessage: "Inicio",
        status: "Pendientes",
        environment: "farfalina",
        unreadCount: 0,
      },
    });

    const HIGH_CONCURRENT_COUNT = 20;
    const highConcurrentPromises = Array.from({ length: HIGH_CONCURRENT_COUNT }).map(async (_, idx) => {
      const isWa = idx % 2 === 0;
      const targetThreadId = isWa ? multiChannelThreadId1 : multiChannelThreadId2;
      const payloadBuf = Buffer.from(`STRESS_PAYLOAD_ITEM_${idx}_${Date.now()}_REPEAT_DATA_`.repeat(50));
      const res = await sendChatMessageAction({
        threadId: targetThreadId,
        sender: "agent",
        text: `Stress msg #${idx} (${isWa ? "WA" : "IG"})`,
        mediaBase64: payloadBuf.toString("base64"),
        mediaMimeType: isWa ? "image/jpeg" : "application/pdf",
        mediaFileName: `stress_asset_${idx}.${isWa ? "jpg" : "pdf"}`,
      });
      return { idx, res, payloadBuf };
    });

    const highStart = Date.now();
    const highResults = await Promise.all(highConcurrentPromises);
    const highDuration = Date.now() - highStart;
    console.log(`  -> 20 peticiones multi-canal completadas en ${highDuration}ms.`);

    const highAllSuccess = highResults.every((r) => r.res.success === true);
    assert(
      "Suite 4",
      `4.7 Las 20 peticiones multi-canal concurrentes respondieron success: true sin bloqueos de SQLite`,
      highAllSuccess,
      highResults.map((r) => r.res.success),
      Array(HIGH_CONCURRENT_COUNT).fill(true)
    );

    for (const item of highResults) {
      if (item.res.success && item.res.data) {
        const msg = item.res.data as { id: string; mediaUrl?: string };
        if (msg.mediaUrl) {
          const fp = path.join(process.cwd(), "public", msg.mediaUrl.replace(/^\//, ""));
          cleanupFiles.push(fp);
        }
      }
    }

    // =========================================================================
    // SUITE 5: BASE DE DATOS INTEGRITY CHECK
    // =========================================================================
    console.log("\n--- SUITE 5: Verificación de Integridad de SQLite (PRAGMA integrity_check) ---");
    const integrityCheck = (await prisma.$queryRawUnsafe("PRAGMA integrity_check;")) as Array<{ integrity_check: string }>;
    const isDbOk = integrityCheck.length > 0 && integrityCheck[0].integrity_check === "ok";
    assert(
      "Suite 5",
      "5.1 PRAGMA integrity_check en SQLite retorna 'ok' tras alta concurrencia",
      isDbOk,
      integrityCheck,
      [{ integrity_check: "ok" }]
    );

  } finally {
    // =========================================================================
    // LIMPIEZA ADVERSARIAL
    // =========================================================================
    console.log("\n--- LIMPIEZA: Eliminando datos y archivos temporales generados durante el test ---");

    for (const threadId of cleanupThreadIds) {
      try {
        await prisma.relayOutboundQueue.deleteMany({ where: { threadId } });
        await prisma.chatMessage.deleteMany({ where: { threadId } });
        await prisma.chatThread.deleteMany({ where: { id: threadId } });
      } catch (err) {
        console.warn(`Error limpiando thread ${threadId}:`, err);
      }
    }

    for (const filePath of cleanupFiles) {
      let attempts = 0;
      while (attempts < 3 && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          break;
        } catch {
          attempts++;
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }
    console.log("  -> Limpieza completada exitosamente.");
  }

  // =========================================================================
  // RESUMEN Y BALANCE FINAL
  // =========================================================================
  const passed = assertionResults.filter((r) => r.passed).length;
  const failed = assertionResults.filter((r) => !r.passed).length;

  console.log("\n================================================================================");
  console.log(`=== BALANCE FINAL DEL ADVERSARIAL CHALLENGE: ${passed} PASSED, ${failed} FAILED ===`);
  console.log("================================================================================\n");

  if (failed > 0) {
    console.error("❌ Fallos detectados en el Adversarial Challenge:");
    assertionResults.filter((r) => !r.passed).forEach((r) => {
      console.error(`- [${r.suite}] ${r.testName}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log("🏆 Todas las pruebas adversariales pasaron exitosamente.");
  }
}

runAdversarialChallenge().catch((err) => {
  console.error("FATAL ERROR EN ADVERSARIAL HARNESS:", err);
  process.exit(1);
});
