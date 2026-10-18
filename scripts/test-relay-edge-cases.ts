import "dotenv/config";
import { POST as postOrder } from "../app/api/relay/order/route";
import { POST as postRental } from "../app/api/relay/rental/route";
import { prisma } from "../lib/db";
import { NextRequest } from "next/server";

async function runEdgeCaseTests() {
  console.log("=== RUNNING EXTENSIVE RELAY EDGE-CASE & STRESS TESTS ===");

  // -------------------------------------------------------------
  // Test 1: Validation Error Handling on Order (Missing clientName)
  // -------------------------------------------------------------
  console.log("\n[Edge Case 1] Order with invalid payload (missing clientName)...");
  const badOrderReq = new NextRequest("http://localhost:3000/api/relay/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      salePrice: 150,
      total: 150,
      deliveryDate: "2026-11-01",
      deliveryTime: "10:00",
      dedicationMessage: "Test",
    }),
  });
  const badOrderRes = await postOrder(badOrderReq);
  const badOrderJson = await badOrderRes.json();
  if (badOrderRes.status !== 400 || badOrderJson.success !== false) {
    throw new Error(`Expected 400 validation error, got status ${badOrderRes.status}`);
  }
  console.log("✓ Correctly returned 400 VALIDATION_ERROR:", badOrderJson.error);

  // -------------------------------------------------------------
  // Test 2: Pickup Order (Retiro en Tienda)
  // -------------------------------------------------------------
  console.log("\n[Edge Case 2] Order with deliveryType='pickup'...");
  const pickupPayload = {
    clientName: "Cliente Pickup Test",
    clientPhone: "+59171122334",
    deliveryType: "pickup",
    deliveryDate: "2026-11-05",
    deliveryTime: "11:00",
    arrangementName: "Ramo Express",
    salePrice: 120,
    deliveryFee: 50, // Should be overridden to 0 because it's pickup
    total: 120,
    paymentMethod: "QR",
    dedicationMessage: "Recojo personal",
    environment: "farfalina",
  };
  const pickupReq = new NextRequest("http://localhost:3000/api/relay/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pickupPayload),
  });
  const pickupRes = await postOrder(pickupReq);
  const pickupJson = await pickupRes.json();
  if (!pickupJson.success) {
    throw new Error(`Pickup order failed: ${pickupJson.error}`);
  }
  if (pickupJson.data.order.address !== "Retiro en Tienda / Local" || pickupJson.data.order.deliveryFee !== 0) {
    throw new Error(`Pickup logic failed: fee=${pickupJson.data.order.deliveryFee}, addr=${pickupJson.data.order.address}`);
  }
  console.log("✓ Pickup order handled correctly with fee=0 and Tienda address.");

  // Clean up pickup test order
  await prisma.pOSTicketItem.deleteMany({ where: { ticketId: pickupJson.data.ticket.id } });
  await prisma.pOSTicket.delete({ where: { id: pickupJson.data.ticket.id } });
  await prisma.orderDelivery.delete({ where: { id: pickupJson.data.order.id } });
  await prisma.cRMClient.deleteMany({ where: { phone: "59171122334" } });
  console.log("✓ Pickup test order cleaned up.");

  // -------------------------------------------------------------
  // Test 3: Validation Error on Rental (Rental price <= 0)
  // -------------------------------------------------------------
  console.log("\n[Edge Case 3] Rental with invalid price (<= 0)...");
  const badRentalReq = new NextRequest("http://localhost:3000/api/relay/rental", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientName: "Clienta Test",
      dressId: "some-id",
      rentalStartDate: "2026-11-01",
      rentalEndDate: "2026-11-04",
      rentalPrice: -50,
      guaranteeAmount: 100,
    }),
  });
  const badRentalRes = await postRental(badRentalReq);
  const badRentalJson = await badRentalRes.json();
  if (badRentalRes.status !== 400 || badRentalJson.success !== false) {
    throw new Error(`Expected 400 validation error on rental, got status ${badRentalRes.status}`);
  }
  console.log("✓ Correctly returned 400 VALIDATION_ERROR on rental:", badRentalJson.error);

  // -------------------------------------------------------------
  // Test 4: Anti-Overbooking Conflict Check on Rental
  // -------------------------------------------------------------
  console.log("\n[Edge Case 4] Anti-Overbooking: Conflicting rental dates...");
  const sampleDress = await prisma.dress.findFirst({ where: { status: "Disponible" } });
  if (!sampleDress) throw new Error("No available dress found for overbooking test");

  // Booking A: Nov 10 to Nov 15
  const rentalA = {
    clientName: "Clienta A",
    clientPhone: "+59172233445",
    dressId: sampleDress.id,
    dressName: sampleDress.name,
    rentalStartDate: "2026-11-10",
    rentalEndDate: "2026-11-15",
    rentalPrice: 300,
    guaranteeAmount: 100,
    paymentMethod: "Efectivo",
    environment: "carissma",
  };
  const reqA = new NextRequest("http://localhost:3000/api/relay/rental", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rentalA),
  });
  const resA = await postRental(reqA);
  const jsonA = await resA.json();
  if (!jsonA.success) throw new Error(`Booking A failed: ${jsonA.error}`);
  console.log("✓ Initial booking A created (Contract:", jsonA.data.contractNumber, ")");

  // Booking B (Overlapping: Nov 12 to Nov 14 on same dress) - MUST FAIL!
  const rentalB = {
    clientName: "Clienta B (Conflicto)",
    clientPhone: "+59173344556",
    dressId: sampleDress.id,
    dressName: sampleDress.name,
    rentalStartDate: "2026-11-12",
    rentalEndDate: "2026-11-14",
    rentalPrice: 300,
    guaranteeAmount: 100,
    paymentMethod: "Efectivo",
    environment: "carissma",
  };
  const reqB = new NextRequest("http://localhost:3000/api/relay/rental", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rentalB),
  });
  const resB = await postRental(reqB);
  const jsonB = await resB.json();

  if (jsonB.success !== false || !jsonB.error.includes("ya cuenta con una reserva activa")) {
    throw new Error(`Anti-overbooking FAILED! Allowed conflicting booking: ${JSON.stringify(jsonB)}`);
  }
  console.log("✓ Anti-overbooking protection successfully caught conflict:", jsonB.error);

  // Clean up Booking A
  await prisma.rentalBooking.delete({ where: { id: jsonA.data.id } });
  await prisma.dress.update({ where: { id: sampleDress.id }, data: { status: "Disponible" } });
  await prisma.cRMClient.deleteMany({ where: { phone: "59172233445" } });
  console.log("✓ Booking A cleaned up and dress restored to Disponible.");

  await prisma.$disconnect();
  console.log("\n=======================================================");
  console.log("✅ ALL RELAY EDGE CASES & CONCURRENCY CHECKS PASSED!");
  console.log("=======================================================");
}

runEdgeCaseTests().catch((err) => {
  console.error("Edge case test failed:", err);
  process.exit(1);
});
