import { prisma } from "../../../lib/db";

async function main() {
  console.log("=== Instagram ChannelConfigs ===");
  const igConfigs = await prisma.channelConfig.findMany({
    where: { channel: "Instagram" }
  });
  console.log(JSON.stringify(igConfigs, null, 2));

  console.log("=== Instagram ChatThreads ===");
  const igThreads = await prisma.chatThread.findMany({
    where: { channel: "Instagram" },
    include: {
      messages: true
    }
  });
  console.log(JSON.stringify(igThreads, null, 2));

  console.log("=== CRMClients with Instagram notes or non-numeric/long phones ===");
  const igClients = await prisma.cRMClient.findMany({
    where: {
      OR: [
        { notes: { contains: "Instagram" } },
        { phone: { contains: "29643476368611224" } },
        { phone: { contains: "12334" } },
        { name: { contains: "Instagram" } }
      ]
    }
  });
  console.log(JSON.stringify(igClients, null, 2));
}

main().catch(console.error);
