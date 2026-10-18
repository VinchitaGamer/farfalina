import { prisma } from "../lib/db";

async function verify() {
  console.log("=== VERIFYING SUPABASE DATABASE COUNTS ===");

  const counts: Record<string, number> = {
    RawIngredient: await prisma.rawIngredient.count(),
    Dress: await prisma.dress.count(),
    Arrangement: await prisma.arrangement.count(),
    ArrangementRecipeItem: await prisma.arrangementRecipeItem.count(),
    CRMClient: await prisma.cRMClient.count(),
    POSTicket: await prisma.pOSTicket.count(),
    POSTicketItem: await prisma.pOSTicketItem.count(),
    LoyaltyConfig: await prisma.loyaltyConfig.count(),
    CarissmaConfig: await prisma.carissmaConfig.count(),
    ChannelConfig: await prisma.channelConfig.count(),
    QuickReply: await prisma.quickReply.count(),
    ChatThread: await prisma.chatThread.count(),
    ChatMessage: await prisma.chatMessage.count(),
  };

  let total = 0;
  for (const [table, count] of Object.entries(counts)) {
    console.log(`- ${table}: ${count}`);
    total += count;
  }

  console.log("----------------------------------------");
  console.log(`TOTAL RESTORED IN SUPABASE: ${total} / 135`);

  if (total !== 135) {
    throw new Error(`Count mismatch! Expected 135, got ${total}`);
  }

  // Check sample records
  const sampleIngredient = await prisma.rawIngredient.findFirst();
  console.log("Sample RawIngredient:", sampleIngredient?.name, `(ID: ${sampleIngredient?.id})`);

  const sampleDress = await prisma.dress.findFirst();
  console.log("Sample Dress:", sampleDress?.name, `(ID: ${sampleDress?.id})`);

  const sampleArrangement = await prisma.arrangement.findFirst();
  console.log("Sample Arrangement:", sampleArrangement?.name, `(ID: ${sampleArrangement?.id})`);

  await prisma.$disconnect();
  console.log("✅ VERIFICATION PASSED PERFECTLY!");
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
