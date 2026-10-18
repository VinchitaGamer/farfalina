import { prisma } from "../../../lib/db";

async function main() {
  const configs = await prisma.channelConfig.findMany();
  console.log("=== ChannelConfigs ===");
  console.log(JSON.stringify(configs, null, 2));

  const clientCount = await prisma.cRMClient.count();
  const sampleClients = await prisma.cRMClient.findMany({ take: 3 });
  console.log(`=== CRMClient count: ${clientCount} ===`);
  console.log(JSON.stringify(sampleClients, null, 2));

  const threadCount = await prisma.chatThread.count();
  const sampleThreads = await prisma.chatThread.findMany({ take: 3 });
  console.log(`=== ChatThread count: ${threadCount} ===`);
  console.log(JSON.stringify(sampleThreads, null, 2));

  const messageCount = await prisma.chatMessage.count();
  const sampleMessages = await prisma.chatMessage.findMany({ take: 3, orderBy: { createdAt: "desc" } });
  console.log(`=== ChatMessage count: ${messageCount} ===`);
  console.log(JSON.stringify(sampleMessages, null, 2));
}

main().catch(console.error);
