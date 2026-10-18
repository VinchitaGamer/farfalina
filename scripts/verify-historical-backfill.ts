import path from "path";
import fs from "fs";
import { prisma } from "../lib/db";
import { syncHistoricalConversationsAction } from "../app/actions/omnichannel";

async function main() {
  console.log("================================================================================");
  console.log("  VERIFICACIÓN AUTOMATIZADA: SINCRONIZACIÓN RETROACTIVA (BACKFILL M4)");
  console.log("================================================================================\n");

  const environment = "farfalina";

  // Step 1: Verificar credenciales en ChannelConfig
  console.log("[1/6] Verificando credenciales activas en ChannelConfig...");
  const config = await prisma.channelConfig.findFirst({
    where: {
      channel: "Instagram",
      environment,
      status: "CONNECTED",
    },
  });

  if (!config?.instagramAccessToken) {
    throw new Error(`No se encontró token activo de Instagram en ChannelConfig para environment=${environment}`);
  }
  console.log(`✓ Token de Instagram activo verificado:`);
  console.log(`  - Account ID: ${config.instagramAccountId}`);
  console.log(`  - Token: ${config.instagramAccessToken.slice(0, 15)}... (longitud: ${config.instagramAccessToken.length} chars)\n`);

  // Step 2: Conteo previo en SQLite
  console.log("[2/6] Inspeccionando estado actual de la base de datos (prisma/dev.db)...");
  const initialThreads = await prisma.chatThread.findMany({
    where: { channel: "Instagram", environment },
    include: { messages: true },
  });
  const initialThreadCount = initialThreads.length;
  const initialMessageCount = initialThreads.reduce((acc, t) => acc + t.messages.length, 0);
  console.log(`  - Hilos previos de Instagram: ${initialThreadCount}`);
  console.log(`  - Mensajes previos de Instagram: ${initialMessageCount}\n`);

  // Step 3: Ejecutar syncHistoricalConversationsAction (Primera pasada)
  console.log("[3/6] Ejecutando syncHistoricalConversationsAction (Primera pasada de importación)...");
  const startTime = Date.now();
  const res1 = await syncHistoricalConversationsAction({
    environment,
    limitConversations: 5,
    maxMessagesPerThread: 25,
    downloadMedia: true,
  });
  const duration1Ms = Date.now() - startTime;

  if (!res1.success || !res1.data) {
    throw new Error(`syncHistoricalConversationsAction falló: ${res1.error || "Sin datos"}`);
  }

  console.log(`✓ Primera sincronización completada en ${duration1Ms}ms:`);
  console.log(`  - Conversaciones procesadas: ${res1.data.syncedConversations}`);
  console.log(`  - Mensajes importados: ${res1.data.syncedMessages}`);
  console.log(`  - Mensajes duplicados omitidos: ${res1.data.skippedDuplicates}\n`);

  if (res1.data.syncedConversations === 0) {
    throw new Error("Se esperaba al menos 1 conversación sincronizada desde Meta Graph API");
  }

  // Step 4: Validar persistencia y estructura en SQLite
  console.log("[4/6] Verificando registros persistidos en SQLite...");
  const currentThreads = await prisma.chatThread.findMany({
    where: { channel: "Instagram", environment },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`✓ Total hilos de Instagram en SQLite: ${currentThreads.length}`);
  let totalCurrentMessages = 0;

  for (const thread of currentThreads) {
    totalCurrentMessages += thread.messages.length;
    console.log(`  • Hilo [${thread.id}]:`);
    console.log(`    - Cliente: ${thread.clientName}`);
    console.log(`    - Teléfono/IGSID: ${thread.phone}`);
    console.log(`    - External ID (Conv): ${thread.externalId || "N/A"}`);
    console.log(`    - Avatar: ${thread.profilePicUrl || "N/A"}`);
    console.log(`    - Último mensaje: ${thread.lastMessage.slice(0, 50)}...`);
    console.log(`    - Mensajes en hilo: ${thread.messages.length}`);

    if (!thread.phone || !thread.clientName) {
      throw new Error(`Hilo ${thread.id} tiene campos obligatorios incompletos`);
    }

    // Validar mensajes individuales
    for (const msg of thread.messages.slice(0, 3)) {
      if (!msg.externalId) {
        console.warn(`    ⚠️ Mensaje ${msg.id} no tiene externalId`);
      }
      if (!["customer", "agent", "bot"].includes(msg.sender)) {
        throw new Error(`Mensaje ${msg.id} tiene rol de remitente inválido: ${msg.sender}`);
      }
    }
  }

  console.log(`✓ Total mensajes de Instagram en SQLite: ${totalCurrentMessages}\n`);

  // Step 5: Ejecutar syncHistoricalConversationsAction (Segunda pasada — Prueba de Deduplicación e Idempotencia)
  console.log("[5/6] Ejecutando syncHistoricalConversationsAction por segunda vez (Prueba de Idempotencia)...");
  const startTime2 = Date.now();
  const res2 = await syncHistoricalConversationsAction({
    environment,
    limitConversations: 5,
    maxMessagesPerThread: 25,
    downloadMedia: true,
  });
  const duration2Ms = Date.now() - startTime2;

  if (!res2.success || !res2.data) {
    throw new Error(`Segunda ejecución falló: ${res2.error || "Sin datos"}`);
  }

  console.log(`✓ Segunda sincronización completada en ${duration2Ms}ms:`);
  console.log(`  - Conversaciones procesadas: ${res2.data.syncedConversations}`);
  console.log(`  - Nuevos mensajes insertados: ${res2.data.syncedMessages}`);
  console.log(`  - Mensajes duplicados omitidos: ${res2.data.skippedDuplicates}`);

  if (res2.data.syncedMessages !== 0) {
    throw new Error(
      `Fallo de deduplicación: Se insertaron ${res2.data.syncedMessages} mensajes duplicados en la segunda pasada!`
    );
  }

  // Verificar que el conteo en base de datos es idéntico
  const postSecondSyncMessagesCount = await prisma.chatMessage.count({
    where: {
      thread: { channel: "Instagram", environment },
    },
  });

  if (postSecondSyncMessagesCount !== totalCurrentMessages) {
    throw new Error(
      `Fallo de idempotencia: el conteo de mensajes cambió de ${totalCurrentMessages} a ${postSecondSyncMessagesCount}`
    );
  }
  console.log(`✓ Conteo en SQLite post-segunda ejecución se mantiene idéntico (${postSecondSyncMessagesCount} mensajes).`);
  console.log(`✓ Deduplicación 100% exitosa (0 duplicados creados).\n`);

  // Step 6: Verificar archivos multimedia descargados y cacheados en disco si existen
  console.log("[6/6] Verificando persistencia física de adjuntos multimedia y avatares...");
  const messagesWithMedia = await prisma.chatMessage.findMany({
    where: {
      thread: { channel: "Instagram", environment },
      mediaUrl: { not: null },
    },
    take: 5,
  });

  console.log(`  - Mensajes con archivo multimedia: ${messagesWithMedia.length}`);
  for (const m of messagesWithMedia) {
    if (m.mediaUrl && m.mediaUrl.startsWith("/uploads/")) {
      const diskPath = path.join(process.cwd(), "public", m.mediaUrl.replace(/^\//, ""));
      const exists = fs.existsSync(diskPath);
      console.log(`    • ${m.mediaUrl} -> En disco: ${exists ? "SÍ (" + fs.statSync(diskPath).size + " bytes)" : "NO"}`);
    } else {
      console.log(`    • URL remota: ${m.mediaUrl}`);
    }
  }

  console.log("\n================================================================================");
  console.log("  RESULTADO: VERIFICACIÓN DE BACKFILL HISTÓRICO (M4) 100% EXITOSA");
  console.log("================================================================================");
}

main()
  .catch((err) => {
    console.error("\n❌ ERROR EN VERIFICACIÓN DE BACKFILL:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
