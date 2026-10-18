const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const adapter = new PrismaBetterSqlite3({ url: "file:/var/www/floreria/prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Testing RawIngredient count...");
  const rawCount = await prisma.rawIngredient.count();
  console.log("RawIngredient count:", rawCount);

  console.log("\nTesting ChannelConfig upsert for farfalina...");
  const f = await prisma.channelConfig.upsert({
    where: { channel_tenant_unique: { channel: "WhatsApp", environment: "farfalina" } },
    update: { status: "DISCONNECTED", qrCodeData: null },
    create: { channel: "WhatsApp", environment: "farfalina", status: "DISCONNECTED" }
  });
  console.log("Farfalina WhatsApp:", f);

  console.log("\nTesting ChannelConfig upsert for carissma...");
  const c = await prisma.channelConfig.upsert({
    where: { channel_tenant_unique: { channel: "WhatsApp", environment: "carissma" } },
    update: { status: "CONNECTED", qrCodeData: null },
    create: { channel: "WhatsApp", environment: "carissma", status: "CONNECTED" }
  });
  console.log("Carissma WhatsApp:", c);

  console.log("\nVerifying independence: Farfalina status vs Carissma status:");
  const allWa = await prisma.channelConfig.findMany({ where: { channel: "WhatsApp" } });
  console.log(allWa.map(w => ({ env: w.environment, status: w.status })));
}

run().catch(e => console.error("ERROR:", e)).finally(() => prisma.$disconnect());