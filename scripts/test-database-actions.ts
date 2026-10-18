import "dotenv/config";
import { getArrangementsAction, getRawIngredientsAction } from "../app/actions/arrangements";
import { getDressesAction, getCarissmaConfigAction } from "../app/actions/carissma";
import { getCRMDataAction } from "../app/actions/crm";
import { getOrdersAction } from "../app/actions/logistics";
import { getChannelConfigsAction, getQuickRepliesAction, getChatThreadsAction } from "../app/actions/omnichannel";
import { prisma } from "../lib/db";

async function testDatabaseActions() {
  console.log("=== TESTING FULL SERVER ACTION SUITE ON SUPABASE ===");

  // 1. Arrangements & Ingredients
  const arrRes = await getArrangementsAction();
  console.log(`- Arrangements: ${arrRes.success ? (arrRes.data as any[]).length : "FAILED: " + arrRes.error}`);
  if (!arrRes.success || (arrRes.data as any[]).length !== 6) throw new Error("Arrangements action failed");

  const ingRes = await getRawIngredientsAction();
  console.log(`- Raw Ingredients: ${ingRes.success ? (ingRes.data as any[]).length : "FAILED: " + ingRes.error}`);
  if (!ingRes.success || (ingRes.data as any[]).length !== 34) throw new Error("Ingredients action failed");

  // 2. Dresses & Carissma Config
  const dressRes = await getDressesAction();
  console.log(`- Dresses: ${dressRes.success ? (dressRes.data as any[]).length : "FAILED: " + dressRes.error}`);
  if (!dressRes.success || (dressRes.data as any[]).length !== 29) throw new Error("Dresses action failed");

  const carissmaConfigRes = await getCarissmaConfigAction();
  console.log(`- Carissma Config: ${carissmaConfigRes.success ? "LOADED" : "FAILED: " + carissmaConfigRes.error}`);
  if (!carissmaConfigRes.success) throw new Error("Carissma Config action failed");

  // 3. CRM Clients
  const crmRes = await getCRMDataAction();
  console.log(`- CRM Clients: ${crmRes.success ? (crmRes.data as any).clients.length : "FAILED: " + crmRes.error}`);
  if (!crmRes.success || (crmRes.data as any).clients.length !== 5) throw new Error("CRM action failed");

  // 4. Logistics
  const ordersRes = await getOrdersAction();
  console.log(`- Orders: ${ordersRes.success ? (ordersRes.data as any[]).length : "FAILED: " + ordersRes.error}`);
  if (!ordersRes.success) throw new Error("Orders action failed");

  // 5. Omnichannel configs & threads
  const channelRes = await getChannelConfigsAction("farfalina");
  console.log(`- Channel Configs: ${channelRes.success ? (channelRes.data as any[]).length : "FAILED: " + channelRes.error}`);
  if (!channelRes.success) throw new Error("Channel configs action failed");

  const quickRepliesRes = await getQuickRepliesAction();
  console.log(`- Quick Replies: ${quickRepliesRes.success ? (quickRepliesRes.data as any[]).length : "FAILED: " + quickRepliesRes.error}`);
  if (!quickRepliesRes.success || (quickRepliesRes.data as any[]).length !== 4) throw new Error("Quick replies action failed");

  const threadsRes = await getChatThreadsAction("Todos", "farfalina");
  console.log(`- Chat Threads: ${threadsRes.success ? (threadsRes.data as any[]).length : "FAILED: " + threadsRes.error}`);
  if (!threadsRes.success) throw new Error("Chat threads action failed");

  await prisma.$disconnect();
  console.log("\n✅ ALL CORE SERVER ACTIONS EXECUTED AGAINST SUPABASE FLAWLESSLY!");
}

testDatabaseActions().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
