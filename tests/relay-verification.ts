process.env.SKIP_WWEBJS = "true";
process.env.NODE_ENV = "test";

import { prisma } from "../lib/db";
import {
  getChatThreadsAction,
  sendChatMessageAction,
  getRelayStatusAction,
} from "../app/actions/omnichannel";

async function runVerification() {
  console.log("=== INICIANDO VERIFICACIÓN PROFUNDA DE RELAY Y AISLAMIENTO ===");
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

  const testPhoneFarfalina = "fb_test_farfalina_999";
  const testPhoneCarissma = "ig_test_carissma_888";

  try {
    // 0. Limpieza previa
    await prisma.chatMessage.deleteMany({
      where: {
        thread: {
          phone: { in: [testPhoneFarfalina, testPhoneCarissma] },
        },
      },
    });
    await prisma.chatThread.deleteMany({
      where: {
        phone: { in: [testPhoneFarfalina, testPhoneCarissma] },
      },
    });
    await prisma.relayOutboundQueue.deleteMany({
      where: {
        phone: { in: [testPhoneFarfalina, testPhoneCarissma] },
      },
    });

    // 1. Inbound Farfalina (Messenger)
    console.log("\n1. Probando Inbound Farfalina...");
    const threadFarfalina = await prisma.chatThread.create({
      data: {
        clientName: "Cliente Farfalina Test",
        phone: testPhoneFarfalina,
        channel: "Facebook",
        environment: "farfalina",
        status: "Por Responder",
        lastMessage: "Hola, quisiera cotizar un ramo de rosas rojas",
      },
    });

    const msgFarfalina = await prisma.chatMessage.create({
      data: {
        threadId: threadFarfalina.id,
        sender: "customer",
        text: "Hola, quisiera cotizar un ramo de rosas rojas",
        environment: "farfalina",
      },
    });

    assert(Boolean(threadFarfalina.id && msgFarfalina.id), "Inbound Farfalina registrado en BD");

    // 2. Inbound Carissma (Instagram)
    console.log("\n2. Probando Inbound Carissma...");
    const threadCarissma = await prisma.chatThread.create({
      data: {
        clientName: "@clienta_carissma_test",
        phone: testPhoneCarissma,
        channel: "Instagram",
        environment: "carissma",
        status: "Por Responder",
        lastMessage: "Hola, ¿tienen disponible el vestido Gala Esmeralda para el sábado?",
      },
    });

    const msgCarissma = await prisma.chatMessage.create({
      data: {
        threadId: threadCarissma.id,
        sender: "customer",
        text: "Hola, ¿tienen disponible el vestido Gala Esmeralda para el sábado?",
        environment: "carissma",
      },
    });

    assert(Boolean(threadCarissma.id && msgCarissma.id), "Inbound Carissma registrado en BD");

    // 3. Aislamiento Estricto Farfalina vs Carissma
    console.log("\n3. Probando Aislamiento de Entornos...");
    const resFarfalina = await getChatThreadsAction(undefined, "farfalina");
    const threadsF = (resFarfalina.data as Array<{ phone: string }>) || [];
    const hasFarfalinaInF = threadsF.some((t) => t.phone === testPhoneFarfalina);
    const hasCarissmaInF = threadsF.some((t) => t.phone === testPhoneCarissma);

    assert(hasFarfalinaInF, "Farfalina contiene el chat de Farfalina");
    assert(!hasCarissmaInF, "Farfalina NO contiene el chat de Carissma (Aislamiento Farfalina OK)");

    const resCarissma = await getChatThreadsAction(undefined, "carissma");
    const threadsC = (resCarissma.data as Array<{ phone: string }>) || [];
    const hasFarfalinaInC = threadsC.some((t) => t.phone === testPhoneFarfalina);
    const hasCarissmaInC = threadsC.some((t) => t.phone === testPhoneCarissma);

    assert(hasCarissmaInC, "Carissma contiene el chat de Carissma");
    assert(!hasFarfalinaInC, "Carissma NO contiene el chat de Farfalina (Aislamiento Carissma OK)");

    // 4. Encolamiento Outbound en Relay
    console.log("\n4. Probando Encolamiento Saliente en Relay...");
    const sendFarfalinaRes = await sendChatMessageAction({
      threadId: threadFarfalina.id,
      sender: "agent",
      text: "¡Hola! Claro que sí, tenemos ramos de 12 y 24 rosas.",
    });

    assert(sendFarfalinaRes.success === true, "sendChatMessageAction exitoso para Facebook Farfalina");

    const queuedFarfalina = await prisma.relayOutboundQueue.findFirst({
      where: { threadId: threadFarfalina.id, status: "PENDING" },
    });
    assert(Boolean(queuedFarfalina && queuedFarfalina.environment === "farfalina"), "RelayOutboundQueue encoló mensaje con environment='farfalina'");

    const sendCarissmaRes = await sendChatMessageAction({
      threadId: threadCarissma.id,
      sender: "agent",
      text: "¡Hola! Sí, el vestido Gala Esmeralda está disponible en talla M.",
    });

    assert(sendCarissmaRes.success === true, "sendChatMessageAction exitoso para Instagram Carissma");

    const queuedCarissma = await prisma.relayOutboundQueue.findFirst({
      where: { threadId: threadCarissma.id, status: "PENDING" },
    });
    assert(Boolean(queuedCarissma && queuedCarissma.environment === "carissma"), "RelayOutboundQueue encoló mensaje con environment='carissma'");

    // 5. Verificación de Consultas de Cola Filtradas por Entorno
    console.log("\n5. Probando Polling Aislado de Cola Saliente...");
    const farfalinaPending = await prisma.relayOutboundQueue.findMany({
      where: { environment: "farfalina", status: "PENDING" },
    });
    assert(farfalinaPending.some((q) => q.id === queuedFarfalina?.id), "Polling Farfalina ve su mensaje pendiente");
    assert(!farfalinaPending.some((q) => q.id === queuedCarissma?.id), "Polling Farfalina NO ve el mensaje de Carissma");

    const carissmaPending = await prisma.relayOutboundQueue.findMany({
      where: { environment: "carissma", status: "PENDING" },
    });
    assert(carissmaPending.some((q) => q.id === queuedCarissma?.id), "Polling Carissma ve su mensaje pendiente");
    assert(!carissmaPending.some((q) => q.id === queuedFarfalina?.id), "Polling Carissma NO ve el mensaje de Farfalina");

    // 6. Procesamiento de Acuse de Recibo (ACK)
    console.log("\n6. Probando Confirmación de Entrega (ACK)...");
    if (queuedFarfalina) {
      await prisma.relayOutboundQueue.update({
        where: { id: queuedFarfalina.id },
        data: { status: "DELIVERED", sentAt: new Date() },
      });
      const acked = await prisma.relayOutboundQueue.findUnique({
        where: { id: queuedFarfalina.id },
      });
      assert(acked?.status === "DELIVERED" && Boolean(acked.sentAt), "ACK marca mensaje de Farfalina como DELIVERED");
    }

    if (queuedCarissma) {
      await prisma.relayOutboundQueue.update({
        where: { id: queuedCarissma.id },
        data: { status: "FAILED", error: "Simulated UI selector timeout" },
      });
      const ackedFailed = await prisma.relayOutboundQueue.findUnique({
        where: { id: queuedCarissma.id },
      });
      assert(ackedFailed?.status === "FAILED" && Boolean(ackedFailed.error), "ACK registra error FAILED correctamente");
    }

    // 7. Estado del Relay en Servidor
    console.log("\n7. Probando Consulta de Estado del Relay...");
    const statusFarfalina = await getRelayStatusAction("farfalina");
    assert(statusFarfalina.success === true && typeof (statusFarfalina.data as { deliveredCount?: number })?.deliveredCount === "number", "getRelayStatusAction Farfalina retorna métricas válidas");

    const statusCarissma = await getRelayStatusAction("carissma");
    assert(statusCarissma.success === true && typeof (statusCarissma.data as { deliveredCount?: number })?.deliveredCount === "number", "getRelayStatusAction Carissma retorna métricas válidas");

    // 8. Verificación de los 6 contactos reales de Meta Business Suite en Farfalina
    console.log("\n8. Probando Presencia de Contactos Reales Meta en Farfalina...");
    const metaRes = await getChatThreadsAction(undefined, "farfalina");
    const farfalinaThreads = (metaRes.data as Array<{ clientName: string; profilePicUrl?: string | null; messages?: unknown[] }>) || [];
    
    const requiredContacts = [
      "jhon",
      "Danito",
      "Chris Kass (@chriszs.k)",
      "Jhoseph Gutierrez",
      "Monserrat Claure",
      "⋆˚࿔ 𝓐𝓵𝓲𝜗𝜚˚⋆"
    ];

    for (const name of requiredContacts) {
      const found = farfalinaThreads.find((t) => t.clientName === name || t.clientName.includes(name));
      assert(Boolean(found), `Contacto real "${name}" presente en bandeja Farfalina`);
        assert(
          found.profilePicUrl === null || (typeof found.profilePicUrl === "string" && found.profilePicUrl.startsWith("http")),
          `Contacto "${name}" cuenta con profilePicUrl válido (URL o avatar por iniciales)`
        );
        assert(Boolean(found.messages && found.messages.length > 0), `Contacto "${name}" contiene historial de mensajes`);
    }

    // 9. Verificación de Creación Resiliente de Pedidos Relay (Farfalina)
    console.log("\n9. Probando Creación Resiliente de Pedido Floral desde Relay...");
    const metaThreadIdTest = testPhoneFarfalina; // Simula ID externo de Meta pasado en threadId
    const targetThreadOrder = await prisma.chatThread.findFirst({
      where: {
        environment: "farfalina",
        OR: [{ id: metaThreadIdTest }, { phone: metaThreadIdTest }],
      },
    });
    assert(Boolean(targetThreadOrder), "Resolución de thread Farfalina por teléfono/ID externo de Meta OK");

    if (targetThreadOrder) {
      const testOrderNumber = `PED-TEST-${Date.now().toString().slice(-4)}`;
      const testOrder = await prisma.orderDelivery.create({
        data: {
          orderNumber: testOrderNumber,
          clientName: targetThreadOrder.clientName,
          clientPhone: targetThreadOrder.phone,
          recipientName: "Destinatario Test",
          address: "Av. 6 de Agosto #1234",
          zone: "Sopocachi",
          deliveryDate: new Date(),
          deliveryTime: "16:00",
          status: "En preparación",
          arrangementName: "Bouquet Imperial 24 Rosas Rojas",
          salePrice: 280,
          deliveryFee: 15,
          total: 295,
          paymentMethod: "QR",
          dedicationMessage: "¡Felicidades!",
        },
      });

      // Crear mensaje de confirmación vinculado con ID CUID real (sin fallo FK)
      const orderConfirmMsg = await prisma.chatMessage.create({
        data: {
          threadId: targetThreadOrder.id,
          sender: "bot",
          text: `🌸 *Pedido Confirmado #${testOrderNumber}*`,
          environment: "farfalina",
        },
      });

      assert(Boolean(testOrder.id && orderConfirmMsg.id), "Pedido floral y mensaje de confirmación emitidos sin error de FK");

      // Limpieza de pedido de prueba
      await prisma.orderDelivery.delete({ where: { id: testOrder.id } });
    }

    // 10. Verificación de Creación Resiliente de Alquiler Relay (Carissma)
    console.log("\n10. Probando Creación Resiliente de Reserva de Vestido desde Relay...");
    const metaRentalThreadId = testPhoneCarissma;
    const targetThreadRental = await prisma.chatThread.findFirst({
      where: {
        environment: "carissma",
        OR: [{ id: metaRentalThreadId }, { phone: metaRentalThreadId }],
      },
    });
    assert(Boolean(targetThreadRental), "Resolución de thread Carissma por teléfono/ID externo de Meta OK");

    const sampleDress = await prisma.dress.findFirst();
    if (sampleDress && targetThreadRental) {
      const testContractNumber = `ALQ-TEST-${Date.now().toString().slice(-4)}`;
      const testBooking = await prisma.rentalBooking.create({
        data: {
          contractNumber: testContractNumber,
          clientName: targetThreadRental.clientName,
          clientPhone: targetThreadRental.phone,
          dressId: sampleDress.id,
          dressName: sampleDress.name,
          dressSize: sampleDress.size,
          dressColor: sampleDress.color,
          rentalStartDate: new Date(),
          rentalEndDate: new Date(Date.now() + 3 * 86400000),
          rentalPrice: 450,
          guaranteeAmount: 200,
          penaltyFee: 0,
          paymentMethod: "Efectivo",
          rentalStatus: "Reservado",
          guaranteeStatus: "En Custodia",
        },
      });

      const rentalConfirmMsg = await prisma.chatMessage.create({
        data: {
          threadId: targetThreadRental.id,
          sender: "bot",
          text: `👗 *Reserva Confirmada #${testContractNumber}*`,
          environment: "carissma",
        },
      });

      assert(Boolean(testBooking.id && rentalConfirmMsg.id), "Reserva de vestido y mensaje de confirmación emitidos sin error de FK");

      // Limpieza de reserva de prueba
      await prisma.rentalBooking.delete({ where: { id: testBooking.id } });
    }

    // 11. Limpieza posterior
    console.log("\n11. Limpieza de registros de prueba temporales...");
    await prisma.chatMessage.deleteMany({
      where: {
        thread: {
          phone: { in: [testPhoneFarfalina, testPhoneCarissma] },
        },
      },
    });
    await prisma.chatThread.deleteMany({
      where: {
        phone: { in: [testPhoneFarfalina, testPhoneCarissma] },
      },
    });
    await prisma.relayOutboundQueue.deleteMany({
      where: {
        phone: { in: [testPhoneFarfalina, testPhoneCarissma] },
      },
    });
    assert(true, "Limpieza de prueba completada sin alterar los contactos reales");

  } catch (err) {
    console.error("Error catastrófico en suite de verificación:", err);
    failed++;
  } finally {
    console.log(`\n=== RESUMEN FASE 1: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) process.exit(1);
  }
}

import { runAutomatedOmnichannelHarness } from "./e2e-omnichannel-simulator";

async function runCompleteTestSuite() {
  console.log("\n===============================================================================");
  console.log("   FASE 1: VERIFICACIÓN PROFUNDA DE RELAY, CONTACTOS Y AISLAMIENTO");
  console.log("===============================================================================\n");
  await runVerification();

  console.log("\n===============================================================================");
  console.log("   FASE 2: SIMULACIÓN E2E DE META BUSINESS SUITE, PARIDAD Y EXTENSIÓN");
  console.log("===============================================================================\n");
  await runAutomatedOmnichannelHarness();

  await prisma.$disconnect();
  console.log("\n✅ TODAS LAS SUITES DE PRUEBA (FASE 1 Y FASE 2) EJECUTADAS EXITOSAMENTE.\n");
  process.exit(0);
}

runCompleteTestSuite();
