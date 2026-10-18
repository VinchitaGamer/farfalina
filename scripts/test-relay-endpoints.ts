import "dotenv/config";
import { GET as getCatalog } from "../app/api/relay/catalog/route";
import { POST as postOrder } from "../app/api/relay/order/route";
import { POST as postRental } from "../app/api/relay/rental/route";
import { prisma } from "../lib/db";
import { NextRequest } from "next/server";

async function testRelayEndpoints() {
  console.log("=== TESTING RELAY ENDPOINTS ON SUPABASE ===");

  // 1. GET /api/relay/catalog
  console.log("\n1. Testing GET /api/relay/catalog...");
  const catalogRes = await getCatalog();
  const catalogJson = await catalogRes.json();

  if (!catalogJson.success) {
    throw new Error(`Catalog failed: ${catalogJson.error}`);
  }
  console.log("✓ Catalog success!");
  console.log(`  - Arrangements count: ${catalogJson.data.arrangements.length}`);
  console.log(`  - Dresses count: ${catalogJson.data.dresses.length}`);
  console.log(`  - Raw ingredients count: ${catalogJson.data.ingredients.length}`);

  if (
    catalogJson.data.arrangements.length !== 6 ||
    catalogJson.data.dresses.length !== 29 ||
    catalogJson.data.ingredients.length !== 34
  ) {
    throw new Error("Catalog item count mismatch!");
  }

  // 2. POST /api/relay/order
  console.log("\n2. Testing POST /api/relay/order...");
  const sampleArrangement = catalogJson.data.arrangements[0];
  const orderPayload = {
    clientName: "Cliente Prueba Relay",
    clientPhone: "+59170012345",
    recipientName: "Destinatario Prueba",
    deliveryType: "delivery",
    address: "Av. Ballivián Calle 12 Calacoto",
    zone: "Zona Sur",
    deliveryDate: new Date().toISOString().split("T")[0],
    deliveryTime: "15:00",
    arrangementName: sampleArrangement.name,
    salePrice: sampleArrangement.price,
    deliveryFee: 20,
    total: sampleArrangement.price + 20,
    paymentMethod: "Efectivo",
    dedicationMessage: "Mensaje de prueba Relay",
    environment: "farfalina",
  };

  const orderReq = new NextRequest("http://localhost:3000/api/relay/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderPayload),
  });

  const orderRes = await postOrder(orderReq);
  const orderJson = await orderRes.json();

  if (!orderJson.success) {
    throw new Error(`Order failed: ${orderJson.error}`);
  }
  console.log("✓ Order created successfully!");
  console.log(`  - Order Number: ${orderJson.data.orderNumber}`);
  console.log(`  - Order ID: ${orderJson.data.order.id}`);
  console.log(`  - Ticket ID: ${orderJson.data.ticket.id}`);

  // Clean up test order
  await prisma.pOSTicketItem.deleteMany({ where: { ticketId: orderJson.data.ticket.id } });
  await prisma.pOSTicket.delete({ where: { id: orderJson.data.ticket.id } });
  await prisma.orderRecipeItem.deleteMany({ where: { orderId: orderJson.data.order.id } });
  await prisma.orderDelivery.delete({ where: { id: orderJson.data.order.id } });
  // Clean up any test chat messages created by the order
  await prisma.chatMessage.deleteMany({ where: { text: { contains: orderJson.data.orderNumber } } });
  // Clean up CRM client if created
  await prisma.cRMClient.deleteMany({ where: { phone: "59170012345" } });
  console.log("✓ Test order cleaned up cleanly.");

  // 3. POST /api/relay/rental
  console.log("\n3. Testing POST /api/relay/rental...");
  const sampleDress = catalogJson.data.dresses.find((d: any) => d.status === "Disponible") || catalogJson.data.dresses[0];
  const rentalPayload = {
    clientName: "Clienta Prueba Alquiler",
    clientPhone: "+59170098765",
    dressId: sampleDress.id,
    dressName: sampleDress.name,
    rentalStartDate: "2026-11-01",
    rentalEndDate: "2026-11-04",
    rentalPrice: sampleDress.baseRentalPrice || 350,
    guaranteeAmount: sampleDress.requiredGuarantee || 100,
    paymentMethod: "Efectivo",
    notes: "Prueba técnica de endpoint rental",
    environment: "carissma",
  };

  const rentalReq = new NextRequest("http://localhost:3000/api/relay/rental", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rentalPayload),
  });

  const rentalRes = await postRental(rentalReq);
  const rentalJson = await rentalRes.json();

  if (!rentalJson.success) {
    throw new Error(`Rental failed: ${rentalJson.error}`);
  }
  console.log("✓ Rental created successfully!");
  console.log(`  - Contract Number: ${rentalJson.data.contractNumber}`);
  console.log(`  - Booking ID: ${rentalJson.data.id}`);

  // Clean up test rental booking
  await prisma.rentalBooking.delete({ where: { id: rentalJson.data.id } });
  await prisma.dress.update({ where: { id: sampleDress.id }, data: { status: sampleDress.status } });
  await prisma.chatMessage.deleteMany({ where: { text: { contains: rentalJson.data.contractNumber } } });
  await prisma.cRMClient.deleteMany({ where: { phone: "59170098765" } });
  console.log("✓ Test rental cleaned up cleanly.");

  await prisma.$disconnect();
  console.log("\n=======================================================");
  console.log("✅ ALL 3 RELAY ENDPOINTS TESTED AND 100% OPERATIONAL!");
  console.log("=======================================================");
}

testRelayEndpoints().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
