const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const fs = require("fs");

const paths = [
  "C:/Users/Lenovo/Desktop/Floreria_Farfalina_Sistema_Local_Completo/prisma/dev.db",
  "C:/Users/Lenovo/Desktop/Floreria_Farfalina_Sistema_Local/prisma/dev.db"
];

async function inspect(dbPath) {
  if (!fs.existsSync(dbPath)) {
    console.log("NOT FOUND:", dbPath);
    return;
  }
  const stat = fs.statSync(dbPath);
  console.log(`\n========================================`);
  console.log(`FILE: ${dbPath}`);
  console.log(`SIZE: ${stat.size} bytes | MODIFIED: ${stat.mtime.toISOString()}`);
  
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const prisma = new PrismaClient({ adapter });

  try {
    const [raw, arr, recipes, dress, bookings, tickets, shifts, clients, events, orders, expenses] = await Promise.all([
      prisma.rawIngredient.count().catch(e => `err: ${e.message}`),
      prisma.arrangement.count().catch(e => `err: ${e.message}`),
      prisma.arrangementRecipeItem.count().catch(e => `err: ${e.message}`),
      prisma.dress.count().catch(e => `err: ${e.message}`),
      prisma.rentalBooking.count().catch(e => `err: ${e.message}`),
      prisma.pOSTicket.count().catch(e => `err: ${e.message}`),
      prisma.cashRegisterShift.count().catch(e => `err: ${e.message}`),
      prisma.cRMClient.count().catch(e => `err: ${e.message}`),
      prisma.cRMSpecialEvent.count().catch(e => `err: ${e.message}`),
      prisma.orderDelivery.count().catch(e => `err: ${e.message}`),
      prisma.financialExpense.count().catch(e => `err: ${e.message}`),
    ]);

    console.log({
      rawIngredients: raw,
      arrangements: arr,
      recipes: recipes,
      dresses: dress,
      rentalBookings: bookings,
      posTickets: tickets,
      shifts: shifts,
      crmClients: clients,
      specialEvents: events,
      orderDeliveries: orders,
      financialExpenses: expenses
    });

    if (typeof arr === "number" && arr > 0) {
      const arrSample = await prisma.arrangement.findMany({ take: 3, select: { id: true, name: true, price: true } });
      console.log("Sample Arrangements:", arrSample);
    }
    if (typeof dress === "number" && dress > 0) {
      const dressSample = await prisma.dress.findMany({ take: 3, select: { id: true, name: true, brand: true, baseRentalPrice: true } });
      console.log("Sample Dresses:", dressSample);
    }
  } catch (err) {
    console.error("Error inspecting:", err);
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  for (const p of paths) {
    await inspect(p);
  }
}

run();
