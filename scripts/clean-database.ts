import { prisma } from "../lib/db";

async function cleanSystemData() {
  console.log("🧹 Iniciando limpieza completa de datos ficticios del sistema...");

  // 1. Limpiar Recetas de Pedidos y Arreglos
  await prisma.orderRecipeItem.deleteMany({});
  await prisma.arrangementRecipeItem.deleteMany({});
  console.log("✓ Recetas eliminadas");

  // 2. Limpiar Merma e Insumos Vivos
  await prisma.mermaLog.deleteMany({});
  await prisma.rawIngredient.deleteMany({});
  console.log("✓ Insumos vivos y registros de merma eliminados");

  // 3. Limpiar Catálogo de Arreglos
  await prisma.arrangement.deleteMany({});
  console.log("✓ Catálogo de arreglos eliminado");

  // 4. Limpiar Tickets POS y Turnos de Caja
  await prisma.pOSTicketItem.deleteMany({});
  await prisma.pOSTicket.deleteMany({});
  await prisma.cashRegisterShift.deleteMany({});
  console.log("✓ Ventas POS, tickets y turnos de caja eliminados");

  // 5. Limpiar Pedidos y Logística
  await prisma.orderDelivery.deleteMany({});
  console.log("✓ Pedidos y logística de entregas eliminados");

  // 6. Limpiar CRM y Eventos
  await prisma.cRMSpecialEvent.deleteMany({});
  await prisma.cRMClient.deleteMany({});
  console.log("✓ Clientes CRM y eventos eliminados");

  // 7. Limpiar Inventario de Vestidos Carissma
  await prisma.dress.deleteMany({});
  console.log("✓ Vestidos de Carissma eliminados");

  // 8. Limpiar Contabilidad y Egresos
  await prisma.financialExpense.deleteMany({});
  console.log("✓ Egresos financieros eliminados");

  // 9. Limpiar Mensajes y Conversaciones de Omnicanalidad (MANTENIENDO ChannelConfig)
  await prisma.chatMessage.deleteMany({});
  await prisma.chatThread.deleteMany({});
  console.log("✓ Historial y caché de mensajes de chat eliminados");

  // 10. Verificar que ChannelConfig se mantenga intacto
  const configs = await prisma.channelConfig.findMany();
  console.log(`🔒 Canales de omnicanalidad preservados (${configs.length} configuraciones):`);
  configs.forEach((c) => {
    console.log(`   - ${c.channel}: Estado ${c.status}, Token guardado: ${c.facebookPageToken || c.instagramAccessToken || c.tiktokAppId || c.qrCodeData ? "SÍ" : "NO"}`);
  });

  console.log("✨ Base de datos limpia al 100% con configuraciones de conexión intactas.");
}

cleanSystemData()
  .catch((e) => {
    console.error("Error durante la limpieza:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
