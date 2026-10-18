const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const path = require("path");

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const raw = await prisma.rawIngredient.count();
  const arr = await prisma.arrangement.count();
  const dress = await prisma.dress.count();
  const clients = await prisma.cRMClient.count();
  const orders = await prisma.orderDelivery.count();

  console.log("RESULT:" + JSON.stringify({ rawIngredients: raw, arrangements: arr, dresses: dress, clients, orders }));
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
