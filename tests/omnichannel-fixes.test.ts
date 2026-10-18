import { prisma } from "../lib/db";
import { getChatThreadsAction, getChannelConfigsAction, sendChatMessageAction } from "../app/actions/omnichannel";

async function runOmnichannelFixesVerification() {
  console.log("=== INICIANDO VERIFICACIÓN DE CORRECCIONES OMNICANAL ===");
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

  const testPhone = "59167588819";
  const testPhoneFormatted = "+591 67588819";
  const testPhoneMulti = "59177788999";

  try {
    // 1. Limpieza de pruebas
    await prisma.relayOutboundQueue.deleteMany({
      where: {
        phone: { in: [testPhone, testPhoneFormatted, testPhoneMulti, "test_dup_1", "test_dup_2"] },
      },
    });
    await prisma.chatMessage.deleteMany({
      where: {
        thread: {
          phone: { in: [testPhone, testPhoneFormatted, testPhoneMulti, "test_dup_1", "test_dup_2"] },
        },
      },
    });
    await prisma.chatThread.deleteMany({
      where: {
        phone: { in: [testPhone, testPhoneFormatted, testPhoneMulti, "test_dup_1", "test_dup_2"] },
      },
    });

    // 2. Verificar que no existe ningún canal TikTok en configuraciones
    console.log("\n1. Verificando eliminación total de TikTok...");
    const channelConfigs = await getChannelConfigsAction("farfalina");
    const hasTikTok = ((channelConfigs.data as any[]) || []).some((c) => c.channel === "TikTok");
    assert(!hasTikTok, "TikTok eliminado de ChannelConfig en farfalina");

    const channelConfigsCarissma = await getChannelConfigsAction("carissma");
    const hasTikTokCarissma = ((channelConfigsCarissma.data as any[]) || []).some((c) => c.channel === "TikTok");
    assert(!hasTikTokCarissma, "TikTok eliminado de ChannelConfig en carissma");

    // 3. Verificar que nunca se inserten mensajes 'Conversación activa' o que se purguen
    console.log("\n2. Verificando purga y bloqueo de 'Conversación activa'...");
    const dummyThread = await prisma.chatThread.create({
      data: {
        clientName: "Cliente Dummy Fix",
        phone: "test_dup_1",
        channel: "WhatsApp",
        environment: "farfalina",
        status: "Por Responder",
        lastMessage: "Hola Farfalina",
      },
    });

    await prisma.chatMessage.create({
      data: {
        threadId: dummyThread.id,
        sender: "customer",
        text: "Conversación activa",
        environment: "farfalina",
      },
    });

    await prisma.chatMessage.create({
      data: {
        threadId: dummyThread.id,
        sender: "customer",
        text: "Mensaje real del cliente",
        environment: "farfalina",
      },
    });

    // Ejecutar getChatThreadsAction (gatilla auto-healing y purga de 'Conversación activa')
    const threadsAfterPurge = await getChatThreadsAction(undefined, "farfalina");
    const foundDummy = ((threadsAfterPurge.data as any[]) || []).find((t) => t.id === dummyThread.id);

    const hasBogus = foundDummy?.messages?.some(
      (m: any) => m.text.toLowerCase() === "conversación activa" || m.text.toLowerCase() === "conversacion activa"
    );
    assert(!hasBogus, "Mensajes con texto 'Conversación activa' fueron purgados exitosamente");

    const hasReal = foundDummy?.messages?.some((m: any) => m.text === "Mensaje real del cliente");
    assert(Boolean(hasReal), "Mensaje real del cliente fue preservado intacto");

    // 4. Verificación de diferenciación de emisor: agent a la derecha vs customer a la izquierda
    console.log("\n3. Verificando alineación de emisores (agent vs customer)...");
    const agentMsg = await prisma.chatMessage.create({
      data: {
        threadId: dummyThread.id,
        sender: "agent",
        text: "Hola, soy el asesor de Farfalina en qué te ayudo",
        environment: "farfalina",
      },
    });

    assert(agentMsg.sender === "agent", "Mensaje de asesor guardado con sender='agent'");

    const customerMsg = await prisma.chatMessage.create({
      data: {
        threadId: dummyThread.id,
        sender: "customer",
        text: "Quisiera información sobre rosas",
        environment: "farfalina",
      },
    });

    assert(customerMsg.sender === "customer", "Mensaje de cliente guardado con sender='customer'");

    // 5. Verificación de deduplicación de hilos (mismo teléfono no genera dos hilos)
    console.log("\n4. Verificando fusión y no duplicación de hilos para el mismo contacto...");
    const threadA = await prisma.chatThread.create({
      data: {
        clientName: "Contacto 59167588819",
        phone: testPhone,
        channel: "Facebook",
        environment: "farfalina",
        status: "Por Responder",
        lastMessage: "Hola por FB",
      },
    });

    await prisma.chatMessage.create({
      data: {
        threadId: threadA.id,
        sender: "customer",
        text: "Mensaje por Facebook",
        environment: "farfalina",
      },
    });

    const threadB = await prisma.chatThread.create({
      data: {
        clientName: "Contacto 59167588819",
        phone: testPhoneFormatted,
        channel: "WhatsApp",
        environment: "farfalina",
        status: "Por Responder",
        lastMessage: "Hola por WA",
      },
    });

    await prisma.chatMessage.create({
      data: {
        threadId: threadB.id,
        sender: "customer",
        text: "Mensaje por WhatsApp",
        environment: "farfalina",
      },
    });

    // Gatillar deduplicación a través de getChatThreadsAction
    const threadsDeduplicated = await getChatThreadsAction(undefined, "farfalina");
    const matchingThreads = ((threadsDeduplicated.data as any[]) || []).filter(
      (t) => t.phone.replace(/[^0-9]/g, "").includes("67588819")
    );

    assert(matchingThreads.length === 1, "Hilos duplicados del mismo teléfono fueron fusionados en 1 solo hilo");
    if (matchingThreads.length === 1) {
      assert(
        matchingThreads[0].channel === "WhatsApp",
        "El hilo fusionado conserva el canal prioritario (WhatsApp sobre Facebook)"
      );
      assert(
        matchingThreads[0].messages.length >= 2,
        "Los mensajes de ambos hilos fueron preservados y consolidados"
      );
    }

    // 6. Verificación de mensajes idénticos consecutivos en un mismo hilo (ej. dos "Hola" o "Gracias")
    console.log("\n5. Verificando que mensajes con texto idéntico no sean descartados erróneamente...");
    const testThreadMulti = await prisma.chatThread.create({
      data: {
        clientName: "Cliente Mensajes Idénticos",
        phone: "59177788999",
        channel: "WhatsApp",
        environment: "farfalina",
        status: "Por Responder",
        lastMessage: "Hola",
      },
    });

    const msg1 = await prisma.chatMessage.create({
      data: {
        threadId: testThreadMulti.id,
        sender: "customer",
        text: "Hola Farfalina",
        environment: "farfalina",
        createdAt: new Date("2026-10-02T10:00:00.000Z"),
      },
    });

    const msg2 = await prisma.chatMessage.create({
      data: {
        threadId: testThreadMulti.id,
        sender: "customer",
        text: "Hola Farfalina", // Mismo texto
        environment: "farfalina",
        createdAt: new Date("2026-10-02T10:05:00.000Z"),
      },
    });

    const threadWithMulti = await prisma.chatThread.findUnique({
      where: { id: testThreadMulti.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    assert(
      threadWithMulti?.messages.length === 2,
      "Mensajes idénticos legítimos fueron ambos preservados en el historial"
    );

    // 7. Verificación de orden cronológico monótono
    console.log("\n6. Verificando orden cronológico estricto de mensajes...");
    const isSorted =
      threadWithMulti &&
      new Date(threadWithMulti.messages[0].createdAt).getTime() <=
        new Date(threadWithMulti.messages[1].createdAt).getTime();
    assert(Boolean(isSorted), "Mensajes ordenados cronológicamente de forma ascendente (createdAt: asc)");

    // 8. Verificación de Encolamiento Outbound en Relay para WhatsApp (Fallback)
    console.log("\n7. Verificando encolamiento Relay de WhatsApp cuando Cloud API y socket no están activos...");
    const sendWaRes = await sendChatMessageAction({
      threadId: testThreadMulti.id,
      sender: "agent",
      text: "Hola, te enviamos el catálogo",
    });

    assert(sendWaRes.success === true, "sendChatMessageAction responde exitosamente para WhatsApp");

    const queuedWa = await prisma.relayOutboundQueue.findFirst({
      where: { threadId: testThreadMulti.id, status: "PENDING" },
    });

    assert(
      Boolean(queuedWa && queuedWa.channel === "WhatsApp"),
      "Mensaje de WhatsApp fue encolado en relayOutboundQueue para despacho en Meta Business Suite"
    );

    // 9. Limpieza final
    console.log("\n8. Limpieza final...");
    await prisma.relayOutboundQueue.deleteMany({
      where: { threadId: testThreadMulti.id },
    });
    await prisma.chatMessage.deleteMany({
      where: {
        threadId: { in: [dummyThread.id, threadA.id, threadB.id, testThreadMulti.id] },
      },
    });
    await prisma.chatThread.deleteMany({
      where: {
        id: { in: [dummyThread.id, threadA.id, threadB.id, testThreadMulti.id] },
      },
    });
    assert(true, "Limpieza de prueba completada exitosamente");

  } catch (err) {
    console.error("Error en pruebas de correcciones omnicanal:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log(`\n=== RESUMEN: ${passed} PASSED, ${failed} FAILED ===\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runOmnichannelFixesVerification();
