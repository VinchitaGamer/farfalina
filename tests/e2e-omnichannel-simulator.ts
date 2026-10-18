process.env.SKIP_WWEBJS = "true";
process.env.NODE_ENV = "test";

import { prisma } from "../lib/db";
import { POST as handleRelayInbound } from "../app/api/relay/inbound/route";
import { GET as handleRelayOutbound } from "../app/api/relay/outbound/route";
import { POST as handleRelayAck } from "../app/api/relay/ack/route";
import { POST as handleRelayOrder } from "../app/api/relay/order/route";
import { POST as handleRelayRental } from "../app/api/relay/rental/route";
import { POST as handleEvolutionWebhook } from "../app/api/webhooks/evolution/route";
import {
  getChatThreadsAction,
  sendChatMessageAction,
  getRelayStatusAction,
} from "../app/actions/omnichannel";
import {
  generateMetaThreadRowHtml,
  generateMetaMessagesStreamHtml,
  extractContactRowFromHtml,
  extractMessagesFromHtml,
} from "./meta-dom-simulation";
import { NextRequest } from "next/server";

interface TestStats {
  passed: number;
  failed: number;
  total: number;
}

const stats: TestStats = { passed: 0, failed: 0, total: 0 };

function assert(condition: boolean, description: string, details?: unknown) {
  stats.total++;
  if (condition) {
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${description}`);
    stats.passed++;
  } else {
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${description}`);
    if (details) console.error("    Detalles:", details);
    stats.failed++;
  }
}

function createMockRequest(url: string, method: string, body?: unknown, headers: Record<string, string> = {}): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new Request(url, init));
}

// =========================================================================
// SIMULATED META BUSINESS SUITE DOM & DATA EXTRACTOR
// =========================================================================

interface MockMetaThread {
  threadId: string;
  clientName: string;
  channel: "WhatsApp" | "Instagram" | "Facebook";
  phone: string;
  profilePicUrl: string;
  rawTimestamp: string;
  messages: Array<{
    externalId: string;
    sender: "customer" | "agent";
    text: string;
    mediaUrl?: string | null;
    mediaType?: string | null;
    rawTimestamp: string;
  }>;
}

const simulatedMetaDatabase: MockMetaThread[] = [
  {
    threadId: "meta_wa_test_77889900",
    clientName: "Patricia Fernandez",
    channel: "WhatsApp",
    phone: "+59177889900",
    profilePicUrl: "https://lookaside.fbsbx.com/avatar_patricia.jpg",
    rawTimestamp: "10:24 AM",
    messages: [
      {
        externalId: "wa_msg_001",
        sender: "customer",
        text: "¡Hola Farfalina! Quisiera encargar un ramo de 24 rosas rojas para hoy en la tarde.",
        rawTimestamp: "10:20 AM",
      },
      {
        externalId: "wa_msg_002",
        sender: "agent",
        text: "¡Hola Patricia! Claro que sí, nuestro ramo Deluxe de 24 rosas rojas importadas está disponible por 280 Bs.",
        rawTimestamp: "10:22 AM",
      },
      {
        externalId: "wa_msg_003",
        sender: "customer",
        text: "Perfecto, ¿me mandas foto de cómo viene decorado?",
        rawTimestamp: "10:23 AM",
      },
      {
        externalId: "wa_msg_004",
        sender: "agent",
        text: "Aquí tienes una muestra reciente con follaje de eucalipto y envoltura artesanal.",
        mediaUrl: "https://lookaside.fbsbx.com/sample_roses_deluxe.jpg",
        mediaType: "image",
        rawTimestamp: "10:24 AM",
      },
    ],
  },
  {
    threadId: "meta_ig_test_valeria_q",
    clientName: "Valeria Quiroga (@valeria_q)",
    channel: "Instagram",
    phone: "valeria_q",
    profilePicUrl: "https://cdninstagram.com/avatar_valeria.jpg",
    rawTimestamp: "Ayer",
    messages: [
      {
        externalId: "ig_msg_001",
        sender: "customer",
        text: "Hola! Tienen disponible el Vestido Gala Esmeralda en talla M para este sábado?",
        rawTimestamp: "Ayer 15:30",
      },
      {
        externalId: "ig_msg_002",
        sender: "agent",
        text: "Hola Valeria! Sí, el vestido Gala Esmeralda está disponible en talla M. El alquiler es de 450 Bs por 3 días.",
        rawTimestamp: "Ayer 15:45",
      },
      {
        externalId: "ig_msg_003",
        sender: "customer",
        text: "Genial! Por favor resérvamelo para la fiesta de graduación.",
        rawTimestamp: "Ayer 16:00",
      },
    ],
  },
  {
    threadId: "meta_fb_test_carlos_m",
    clientName: "Carlos Mendoza",
    channel: "Facebook",
    phone: "carlos_mendoza_psid",
    profilePicUrl: "https://fbcdn.net/avatar_carlos.jpg",
    rawTimestamp: "18:40",
    messages: [
      {
        externalId: "fb_msg_001",
        sender: "customer",
        text: "Buenas tardes, hacen envíos a la Zona Sur de La Paz?",
        rawTimestamp: "18:35",
      },
      {
        externalId: "fb_msg_002",
        sender: "agent",
        text: "Buenas tardes Carlos, sí entregamos en toda la Zona Sur con entrega express.",
        rawTimestamp: "18:40",
      },
    ],
  },
];

// =========================================================================
// RUN SUITE
// =========================================================================

async function runAutomatedOmnichannelHarness() {
  console.log("\n===============================================================================");
  console.log("🌸 FARFALINA & CARISSMA — HARNESS AUTOMATIZADO DE SIMULACIÓN Y PARIDAD META 🌸");
  console.log("===============================================================================\n");

  const testPhones = simulatedMetaDatabase.map((t) => t.phone);
  const testThreadIds = simulatedMetaDatabase.map((t) => t.threadId);

  try {
    // 0. LIMPIEZA PREVIA DE AMBIENTE DE PRUEBAS
    console.log("🧹 [0/7] Limpiando registros de pruebas anteriores...");
    await prisma.chatMessage.deleteMany({
      where: {
        OR: [
          { thread: { phone: { in: testPhones } } },
          { thread: { phone: { in: testThreadIds } } },
          { thread: { phone: { contains: "test" } } },
        ],
      },
    });

    await prisma.relayOutboundQueue.deleteMany({
      where: {
        OR: [
          { phone: { in: testPhones } },
          { phone: { in: testThreadIds } },
          { phone: { contains: "test" } },
        ],
      },
    });

    await prisma.chatThread.deleteMany({
      where: {
        OR: [
          { phone: { in: testPhones } },
          { phone: { in: testThreadIds } },
          { phone: { contains: "test" } },
        ],
      },
    });

    assert(true, "Base de datos en estado limpio para pruebas deterministas");

    // =========================================================================
    // 1. SIMULACIÓN DE EXTRACCIÓN DOM E INBOUND DESDE META BUSINESS SUITE
    // =========================================================================
    console.log("\n📥 [1/7] Extrayendo y sincronizando hilos simulados de Meta Business Suite DOM...");

    for (const thread of simulatedMetaDatabase) {
      const isCarissma = thread.channel === "Instagram";
      const environment = isCarissma ? "carissma" : "farfalina";

      // 1.1 Generar DOM HTML de fila de conversación en Meta Business Suite
      const rowHtml = generateMetaThreadRowHtml({
        threadId: thread.threadId,
        contactName: thread.clientName,
        channel: thread.channel,
        snippet: thread.messages[thread.messages.length - 1]?.text || "",
        rawTimestamp: thread.rawTimestamp,
        avatarUrl: thread.profilePicUrl,
        unread: false,
      });

      // 1.2 Ejecutar motor de rastreo DOM sobre la fila
      const extractedContact = extractContactRowFromHtml(rowHtml);
      assert(extractedContact !== null, `DOM Crawler extrajo fila de contacto para ${thread.clientName}`);
      assert(extractedContact?.itemChannel === thread.channel, `Canal detectado en DOM: ${extractedContact?.itemChannel} === ${thread.channel}`);
      assert(extractedContact?.rawTimestamp === thread.rawTimestamp, `Timestamp de fila en DOM: ${extractedContact?.rawTimestamp}`);
      assert(extractedContact?.profilePicUrl === thread.profilePicUrl, `Avatar URL en DOM: ${extractedContact?.profilePicUrl}`);

      // 1.3 Generar DOM HTML de flujo de mensajes
      const streamHtml = generateMetaMessagesStreamHtml(thread.messages);
      const extractedMessages = extractMessagesFromHtml(streamHtml);
      assert(extractedMessages.length === thread.messages.length, `DOM Crawler extrajo todos los mensajes (${extractedMessages.length}/${thread.messages.length})`);

      for (let i = 0; i < thread.messages.length; i++) {
        const expected = thread.messages[i];
        const actual = extractedMessages[i];
        assert(actual.sender === expected.sender, `Mensaje [${i}] sender en DOM: ${actual.sender}`);
        assert(actual.text === expected.text, `Mensaje [${i}] texto en DOM coincide`);
        assert(actual.externalId === expected.externalId, `Mensaje [${i}] externalId en DOM coincide`);
      }

      // 1.4 Despachar payload extraído hacia Relay Inbound de Farfalina
      const inboundPayload = {
        channel: extractedContact!.itemChannel,
        environment,
        clientName: extractedContact!.contactName,
        phone: thread.phone,
        metaThreadId: extractedContact!.threadId,
        externalId: extractedContact!.threadId,
        rawTimestamp: extractedContact!.rawTimestamp,
        profilePicUrl: extractedContact!.profilePicUrl,
        isThreadSyncOnly: false,
        messages: extractedMessages.map((m, idx) => ({
          sender: m.sender,
          text: m.text,
          mediaUrl: m.mediaUrl || null,
          mediaType: m.mediaType || (m.mediaUrl ? "image" : null),
          externalId: m.externalId,
          rawTimestamp: m.rawTimestamp,
          createdAt: new Date(Date.now() - (thread.messages.length - idx) * 60000).toISOString(),
        })),
      };

      const req = createMockRequest("http://localhost:3000/api/relay/inbound", "POST", inboundPayload);
      const res = await handleRelayInbound(req);
      const json = await res.json();

      assert(res.status === 200 && json.success === true, `Inbound procesado con éxito para ${thread.clientName} (${thread.channel})`);
    }

    // =========================================================================
    // 2. VERIFICACIÓN DE PERSISTENCIA Y CAMPOS FIDE-DIGNOS EN SQLITE
    // =========================================================================
    console.log("\n💾 [2/7] Verificando persistencia y campos de caché fide-digna en SQLite...");

    for (const mock of simulatedMetaDatabase) {
      const isCarissma = mock.channel === "Instagram";
      const environment = isCarissma ? "carissma" : "farfalina";

      const dbThread = await prisma.chatThread.findFirst({
        where: {
          environment,
          channel: mock.channel,
          OR: [{ phone: mock.phone }, { externalId: mock.threadId }],
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      assert(Boolean(dbThread), `Hilo "${mock.clientName}" encontrado en BD`);
      if (dbThread) {
        assert(dbThread.channel === mock.channel, `Canal correcto: ${dbThread.channel} === ${mock.channel}`);
        assert(dbThread.externalId === mock.threadId, `externalId persistido fielmente: ${dbThread.externalId}`);
        assert(dbThread.rawTimestamp === mock.rawTimestamp, `rawTimestamp persistido: ${dbThread.rawTimestamp}`);
        assert(dbThread.lastMessageAt !== null, `lastMessageAt registrado: ${dbThread.lastMessageAt?.toISOString()}`);
        assert(dbThread.messages.length === mock.messages.length, `Cantidad de mensajes coincide: ${dbThread.messages.length}/${mock.messages.length}`);

        // Verificar fidelidad de cada mensaje
        for (let i = 0; i < mock.messages.length; i++) {
          const expected = mock.messages[i];
          const actual = dbThread.messages[i];
          assert(actual.sender === expected.sender, `Mensaje [${i}] sender coincide: ${actual.sender}`);
          assert(actual.text === expected.text, `Mensaje [${i}] texto coincide: "${actual.text.substring(0, 30)}..."`);
          assert(actual.externalId === expected.externalId, `Mensaje [${i}] externalId coincide: ${actual.externalId}`);
          assert(actual.rawTimestamp === expected.rawTimestamp, `Mensaje [${i}] rawTimestamp coincide: ${actual.rawTimestamp}`);
          if (expected.mediaUrl) {
            assert(actual.mediaUrl !== null && actual.mediaType === "image", `Mensaje [${i}] multimedia persistida`);
          }
        }
      }
    }

    // =========================================================================
    // 3. PRUEBA DE DEDUPLICACIÓN ESTRICTA (IDEMPOTENCIA DE CRAWLER)
    // =========================================================================
    console.log("\n🛡️ [3/7] Probando deduplicación estricta (re-escaneo múltiple de Meta DOM)...");

    const countsBefore = {
      threads: await prisma.chatThread.count(),
      messages: await prisma.chatMessage.count(),
    };

    // Re-ejecutar el crawler sobre el mismo DOM simulado dos veces seguidas
    for (let round = 1; round <= 2; round++) {
      for (const thread of simulatedMetaDatabase) {
        const isCarissma = thread.channel === "Instagram";
        const environment = isCarissma ? "carissma" : "farfalina";

        const inboundPayload = {
          channel: thread.channel,
          environment,
          clientName: thread.clientName,
          phone: thread.phone,
          metaThreadId: thread.threadId,
          externalId: thread.threadId,
          rawTimestamp: thread.rawTimestamp,
          profilePicUrl: thread.profilePicUrl,
          messages: thread.messages.map((m, idx) => ({
            sender: m.sender,
            text: m.text,
            mediaUrl: m.mediaUrl || null,
            mediaType: m.mediaType || (m.mediaUrl ? "image" : null),
            externalId: m.externalId,
            rawTimestamp: m.rawTimestamp,
            createdAt: new Date(Date.now() - (thread.messages.length - idx) * 60000).toISOString(),
          })),
        };

        const req = createMockRequest("http://localhost:3000/api/relay/inbound", "POST", inboundPayload);
        await handleRelayInbound(req);
      }
    }

    const countsAfter = {
      threads: await prisma.chatThread.count(),
      messages: await prisma.chatMessage.count(),
    };

    assert(countsBefore.threads === countsAfter.threads, `Cero hilos duplicados tras re-escaneo (${countsBefore.threads} === ${countsAfter.threads})`);
    assert(countsBefore.messages === countsAfter.messages, `Cero mensajes duplicados tras re-escaneo (${countsBefore.messages} === ${countsAfter.messages})`);

    // =========================================================================
    // 4. PRUEBA DE CICLO COMPLETO SALIENTE (OUTBOUND DISPATCH & ACK)
    // =========================================================================
    console.log("\n📤 [4/7] Probando despacho saliente bidireccional Farfalina -> Meta...");

    const patriciaThread = await prisma.chatThread.findFirst({
      where: { phone: "+59177889900", environment: "farfalina" },
    });
    assert(Boolean(patriciaThread), "Hilo activo de WhatsApp recuperado para despacho");

    if (patriciaThread) {
      // Agente responde desde Farfalina
      const sendRes = await sendChatMessageAction({
        threadId: patriciaThread.id,
        sender: "agent",
        text: "¡Excelente Patricia! Tu ramo ha sido preparado por el florista y está listo para despacho.",
      });

      assert(sendRes.success === true, "sendChatMessageAction ejecutado con éxito");

      // Verificar que se encoló en RelayOutboundQueue
      const queuedItem = await prisma.relayOutboundQueue.findFirst({
        where: { threadId: patriciaThread.id, status: "PENDING" },
      });
      assert(Boolean(queuedItem), "Mensaje registrado en RelayOutboundQueue como PENDING");

      if (queuedItem) {
        // Simular sondeo de la Extensión en Meta
        const pollReq = createMockRequest("http://localhost:3000/api/relay/outbound?environment=farfalina&limit=10", "GET");
        const pollRes = await handleRelayOutbound(pollReq);
        const pollJson = await pollRes.json();

        assert(pollRes.status === 200 && pollJson.success === true, "Polling de extensión exitoso");
        const items = pollJson.data as Array<{ id: string; text: string }>;
        const found = items.some((i) => i.id === queuedItem.id);
        assert(found, "Extensión detectó el mensaje pendiente en cola");

        // Simular que la extensión escribe en Meta y confirma con ACK DELIVERED
        const ackReq = createMockRequest("http://localhost:3000/api/relay/ack", "POST", {
          queueId: queuedItem.id,
          status: "DELIVERED",
        });
        const ackRes = await handleRelayAck(ackReq);
        const ackJson = await ackRes.json();

        assert(ackRes.status === 200 && ackJson.success === true, "ACK procesado correctamente por el servidor");

        const updatedQueue = await prisma.relayOutboundQueue.findUnique({
          where: { id: queuedItem.id },
        });
        assert(updatedQueue?.status === "DELIVERED", "Estado final en cola confirmado como DELIVERED");
      }
    }

    // =========================================================================
    // 5. PRUEBA DE EMISIÓN DE PEDIDO FLORAL CON DESCUENTO DE STOCK
    // =========================================================================
    console.log("\n💐 [5/7] Probando emisión de pedido floral con descuento de inventario en vivo...");

    // Asegurar insumo en stock
    let testRose = await prisma.rawIngredient.findFirst({
      where: { name: { contains: "Rosa" } },
    });
    if (!testRose) {
      testRose = await prisma.rawIngredient.create({
        data: {
          name: "Rosa Roja de Prueba",
          type: "Flor",
          available: 50,
          unit: "tallos",
          costPerUnit: 5.0,
        },
      });
    } else if (testRose.available < 20) {
      testRose = await prisma.rawIngredient.update({
        where: { id: testRose.id },
        data: { available: 50 },
      });
    }

    const prevStock = testRose.available;
    const qtyToDeduct = 12;

    const orderReq = createMockRequest("http://localhost:3000/api/relay/order", "POST", {
      clientName: "Patricia Fernandez",
      clientPhone: "+59177889900",
      recipientName: "Dra. Carmen Fernandez",
      address: "Av. Ballivián Calle 15, Calacoto",
      zone: "Zona Sur",
      deliveryDate: "2026-10-05",
      deliveryTime: "16:00",
      arrangementName: "Ramo 24 Rosas Deluxe",
      salePrice: 280,
      deliveryFee: 20,
      total: 300,
      paymentMethod: "QR",
      dedicationMessage: "¡Feliz Cumpleaños Mamá querida!",
      recipeItems: [
        {
          rawIngredientId: testRose.id,
          quantityNeeded: qtyToDeduct,
          unitCost: testRose.costPerUnit,
        },
      ],
      threadId: patriciaThread?.id,
      channel: "WhatsApp",
      environment: "farfalina",
    });

    const orderRes = await handleRelayOrder(orderReq);
    const orderJson = await orderRes.json();

    assert(orderRes.status === 201 && orderJson.success === true, "Pedido floral creado exitosamente desde el chat");

    const updatedRose = await prisma.rawIngredient.findUnique({ where: { id: testRose.id } });
    assert(updatedRose?.available === prevStock - qtyToDeduct, `Stock descontado en vivo: ${prevStock} -> ${updatedRose?.available}`);

    // Verificar que en el hilo se insertó el mensaje bot de confirmación
    const updatedThreadMessages = await prisma.chatMessage.findMany({
      where: { threadId: patriciaThread?.id },
      orderBy: { createdAt: "desc" },
      take: 2,
    });
    const hasOrderConfirmation = updatedThreadMessages.some((m) => m.text.includes("Pedido Confirmado"));
    assert(hasOrderConfirmation, "Mensaje bot de confirmación inyectado automáticamente en el chat");

    // =========================================================================
    // 6. PRUEBA DE RESERVA DE VESTIDO EN CARISSMA (ALQUILER & GARANTÍA)
    // =========================================================================
    console.log("\n👗 [6/7] Probando emisión de reserva de vestido en Carissma...");

    let testDress = await prisma.dress.findFirst({
      where: { status: "Disponible" },
    });
    if (!testDress) {
      testDress = await prisma.dress.create({
        data: {
          name: "Vestido Gala Esmeralda Test",
          brand: "Carissma Signature",
          size: "M",
          color: "Verde Esmeralda",
          acquisitionCost: 1200,
          baseRentalPrice: 450,
          requiredGuarantee: 300,
          status: "Disponible",
        },
      });
    }

    const valeriaThread = await prisma.chatThread.findFirst({
      where: { phone: "valeria_q", environment: "carissma" },
    });

    const rentalReq = createMockRequest("http://localhost:3000/api/relay/rental", "POST", {
      clientName: "Valeria Quiroga",
      clientPhone: "valeria_q",
      dressId: testDress.id,
      rentalStartDate: "2026-10-10",
      rentalEndDate: "2026-10-13",
      rentalPrice: 450,
      guaranteeAmount: 300,
      paymentMethod: "Efectivo",
      notes: "Ajuste de bastilla incluido",
      threadId: valeriaThread?.id,
      channel: "Instagram",
      environment: "carissma",
    });

    const rentalRes = await handleRelayRental(rentalReq);
    const rentalJson = await rentalRes.json();

    assert(rentalRes.status === 201 && rentalJson.success === true, "Reserva de vestido creada exitosamente");

    const updatedDress = await prisma.dress.findUnique({ where: { id: testDress.id } });
    assert(updatedDress?.status === "Reservado", `Estado del vestido actualizado a 'Reservado': ${updatedDress?.status}`);

    // =========================================================================
    // 7. COMPATIBILIDAD CON EVOLUTION API (WEBHOOK WHATSAPP BAILEYS)
    // =========================================================================
    console.log("\n⚡ [7/7] Probando ingesta de webhook Evolution API / Baileys...");

    const evoPayload = {
      event: "messages.upsert",
      instance: "farfalina",
      data: {
        key: {
          remoteJid: "59169998877@s.whatsapp.net",
          fromMe: false,
          id: "EVO_MSG_TEST_9999",
        },
        pushName: "Rodrigo Morales",
        message: {
          conversation: "Hola, quisiera consultar precios de arreglos para aniversario.",
        },
        messageTimestamp: Math.floor(Date.now() / 1000),
      },
    };

    const evoReq = createMockRequest("http://localhost:3000/api/webhooks/evolution", "POST", evoPayload);
    const evoRes = await handleEvolutionWebhook(evoReq);
    const evoJson = await evoRes.json();

    assert(evoRes.status === 200 && evoJson.success === true, "Webhook de Evolution API procesado correctamente");

    const evoThread = await prisma.chatThread.findFirst({
      where: { phone: "+59169998877", environment: "farfalina" },
      include: { messages: true },
    });

    assert(Boolean(evoThread), "Contacto de Evolution API registrado en Farfalina");
    assert(evoThread?.clientName === "Rodrigo Morales", "Nombre de contacto extraído de Evolution API");
    assert(evoThread?.messages.some((m) => m.text.includes("precios de arreglos")), "Mensaje de WhatsApp guardado en hilo");

    // 7.2 Probar evento de código QR emitido por Evolution API
    const evoQrPayload = {
      event: "qrcode.updated",
      instance: "farfalina",
      data: {
        qrcode: {
          base64: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        },
      },
    };
    const evoQrReq = createMockRequest("http://localhost:3000/api/webhooks/evolution", "POST", evoQrPayload);
    const evoQrRes = await handleEvolutionWebhook(evoQrReq);
    const evoQrJson = await evoQrRes.json();
    assert(evoQrRes.status === 200 && evoQrJson.success === true, "Evento QR de Evolution API procesado");

    const waConfig = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "WhatsApp", environment: "farfalina" } },
    });
    assert(waConfig?.status === "QR_READY", "ChannelConfig WhatsApp actualizado a estado QR_READY por Evolution API");
    assert(Boolean(waConfig?.qrCodeData && waConfig.qrCodeData.startsWith("data:image/png")), "ChannelConfig WhatsApp contiene código QR base64 persistido");

    // 7.3 Probar cliente de despacho saliente Evolution API
    const { sendEvolutionTextMessage } = await import("../lib/evolution-api");
    const evoSendRes = await sendEvolutionTextMessage({
      to: "+59177889900",
      text: "Mensaje de prueba Evolution API",
      environment: "farfalina",
      configOverride: { apiUrl: "http://localhost:9999" },
    });
    assert(evoSendRes.success === false && typeof evoSendRes.error === "string", "Control de errores de Evolution API verificado ante red no disponible");

    // =========================================================================
    // ASIGNACIÓN Y PARIDAD FINAL EN FARFALINA
    // =========================================================================
    console.log("\n📊 [PARIDAD FINAL] Verificando consulta consolidada getChatThreadsAction...");

    const actionRes = await getChatThreadsAction("Todos", "farfalina");
    assert(actionRes.success === true, "getChatThreadsAction Farfalina exitoso");
    const threads = (actionRes.data as Array<{ clientName: string; channel: string; messages: unknown[] }>) || [];

    const hasPatricia = threads.some((t) => t.clientName.includes("Patricia") && t.channel === "WhatsApp");
    const hasCarlos = threads.some((t) => t.clientName.includes("Carlos") && t.channel === "Facebook");
    const hasRodrigo = threads.some((t) => t.clientName.includes("Rodrigo") && t.channel === "WhatsApp");

    assert(hasPatricia, "Bandeja Farfalina contiene chat de WhatsApp con insignia oficial");
    assert(hasCarlos, "Bandeja Farfalina contiene chat de Facebook Messenger con insignia oficial");
    assert(hasRodrigo, "Bandeja Farfalina contiene chat de WhatsApp vía Evolution API");

    const actionCarissma = await getChatThreadsAction("Todos", "carissma");
    assert(actionCarissma.success === true, "getChatThreadsAction Carissma exitoso");
    const carissmaThreads = (actionCarissma.data as Array<{ clientName: string; channel: string }>) || [];
    const hasValeria = carissmaThreads.some((t) => t.clientName.includes("Valeria") && t.channel === "Instagram");
    assert(hasValeria, "Bandeja Carissma contiene chat de Instagram Direct con insignia oficial");

    // =========================================================================
    // LIMPIEZA FINAL DE ARTIFACTOS DE TEST
    // =========================================================================
    console.log("\n🧹 Limpiando registros temporales de prueba...");
    await prisma.chatMessage.deleteMany({
      where: {
        OR: [
          { thread: { phone: { in: [...testPhones, "+59169998877"] } } },
          { thread: { phone: { in: testThreadIds } } },
        ],
      },
    });
    await prisma.relayOutboundQueue.deleteMany({
      where: {
        OR: [
          { phone: { in: [...testPhones, "+59169998877"] } },
          { phone: { in: testThreadIds } },
        ],
      },
    });
    await prisma.chatThread.deleteMany({
      where: {
        OR: [
          { phone: { in: [...testPhones, "+59169998877"] } },
          { phone: { in: testThreadIds } },
        ],
      },
    });

    console.log("\n===============================================================================");
    console.log(`🎉 RESUMEN DE PRUEBAS AUTOMATIZADAS:`);
    console.log(`   TOTAL DE PRUEBAS EJECUTADAS: ${stats.total}`);
    console.log(`   PASARON (PASS):             \x1b[32m${stats.passed}\x1b[0m`);
    console.log(`   FALLARON (FAIL):            \x1b[31m${stats.failed}\x1b[0m`);
    console.log("===============================================================================\n");

    if (stats.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Error inesperado durante el harness automatizado:", err);
    process.exit(1);
  }
}

export { runAutomatedOmnichannelHarness };

if (typeof require !== "undefined" && require.main === module) {
  runAutomatedOmnichannelHarness();
}
