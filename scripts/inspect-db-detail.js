const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const path = require("path");

const dbPath = path.join(process.cwd(), "prisma", "dev.db");
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const ingredients = await prisma.rawIngredient.findMany({ select: { id: true, name: true, type: true, available: true } });
  console.log("INGREDIENTS IN DB (" + ingredients.length + "):");
  console.log(JSON.stringify(ingredients.slice(0, 10), null, 2));

  const allTables = ["Arrangement", "Dress", "POSTicket", "OrderDelivery", "CRMClient", "RawIngredient"];
  for (const t of allTables) {
    const c = await prisma[t.charAt(0).toLowerCase() + t.slice(1)].count();
    console.log(`${t}: ${c}`);
  }
}

main().finally(() => prisma.$disconnect());
