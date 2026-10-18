import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { calculateLoyaltyTier, sanitizeClientPhoneAndName } from "@/lib/crm-utils";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-relay-client, X-Relay-Client",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

const RelayCreateRentalSchema = z.object({
  clientName: z.string().min(2, "El nombre de la clienta es requerido"),
  clientPhone: z.string().optional().default(""),
  dressId: z.string().min(1, "Debe seleccionar un vestido"),
  dressName: z.string().optional().nullable(),
  rentalStartDate: z.string().min(1, "La fecha de inicio de renta es requerida"),
  rentalEndDate: z.string().min(1, "La fecha de devolución es requerida"),
  rentalPrice: z.number().positive("El precio de renta debe ser mayor a 0"),
  guaranteeAmount: z.number().min(0, "La garantía no puede ser negativa"),
  paymentMethod: z.enum(["Efectivo", "QR", "Tarjeta"]).default("Efectivo"),
  notes: z.string().optional().default(""),
  threadId: z.string().optional().nullable(),
  environment: z.enum(["farfalina", "carissma"]).default("carissma"),
});

export type RelayCreateRentalInput = z.infer<typeof RelayCreateRentalSchema>;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = RelayCreateRentalSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: parsed.error.issues[0]?.message || "Datos de reserva inválidos",
          code: "VALIDATION_ERROR",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const {
      clientName,
      clientPhone,
      dressId,
      dressName,
      rentalStartDate,
      rentalEndDate,
      rentalPrice,
      guaranteeAmount,
      paymentMethod,
      notes,
      threadId,
      environment,
    } = parsed.data;

    let dress = await prisma.dress.findUnique({ where: { id: dressId } });
    if (!dress && dressName) {
      dress = await prisma.dress.findFirst({
        where: {
          OR: [
            { name: { equals: dressName } },
            { name: { contains: dressName } },
          ],
        },
      });
    }
    if (!dress) {
      dress = await prisma.dress.findFirst({
        where: {
          OR: [
            { id: dressId },
            { name: { contains: dressId } },
          ],
        },
      });
    }
    if (!dress) {
      dress = await prisma.dress.findFirst({
        where: { status: "Disponible" },
      });
    }

    if (!dress) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "El vestido seleccionado no existe en inventario",
          code: "DRESS_NOT_FOUND",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    const contractNumber = `ALQ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const startDt = new Date(rentalStartDate);
    const endDt = new Date(rentalEndDate);
    startDt.setHours(0, 0, 0, 0);
    endDt.setHours(23, 59, 59, 999);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Anti-overbooking: check for conflicting active bookings
      const overlappingBooking = await tx.rentalBooking.findFirst({
        where: {
          dressId: dress.id,
          rentalStatus: { notIn: ["Finalizado"] },
          OR: [
            {
              rentalStartDate: { lte: endDt },
              rentalEndDate: { gte: startDt },
            },
          ],
        },
      });

      if (overlappingBooking) {
        throw new Error(
          `La prenda "${dress.name}" ya cuenta con una reserva activa (Contrato ${overlappingBooking.contractNumber}) en ese rango de fechas.`
        );
      }

      // 2. Check open Carissma cash shift
      const currentShift = await tx.carissmaCashShift.findFirst({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
      });

      // 3. Create RentalBooking
      const booking = await tx.rentalBooking.create({
        data: {
          contractNumber,
          clientName: clientName.trim(),
          clientPhone: clientPhone?.trim() || null,
          dressId: dress.id,
          dressName: dress.name,
          dressSize: dress.size,
          dressColor: dress.color,
          rentalStartDate: startDt,
          rentalEndDate: endDt,
          rentalPrice,
          guaranteeAmount,
          penaltyFee: 0,
          paymentMethod,
          rentalStatus: "Reservado",
          guaranteeStatus: "En Custodia",
          notes: notes || null,
          shiftId: currentShift ? currentShift.id : null,
        },
        include: {
          dress: true,
        },
      });

      // 4. Update Dress status to 'Reservado'
      await tx.dress.update({
        where: { id: dress.id },
        data: {
          status: "Reservado",
        },
      });

      // 5. Update shift balances if open
      if (currentShift) {
        await tx.carissmaCashShift.update({
          where: { id: currentShift.id },
          data: {
            totalSalesCash: paymentMethod === "Efectivo" ? { increment: rentalPrice } : undefined,
            totalSalesQR: paymentMethod === "QR" ? { increment: rentalPrice } : undefined,
            totalSalesCard: paymentMethod === "Tarjeta" ? { increment: rentalPrice } : undefined,
            totalGuaranteesInCustody: { increment: guaranteeAmount },
          },
        });
      }

      // 6. CRM Client capture/update
      const sanitized = sanitizeClientPhoneAndName(
        clientPhone || "",
        clientName.trim()
      );
      const cleanPhone = sanitized.phone;
      const cleanClientName = sanitized.name;

      if (cleanPhone && cleanPhone.length >= 6) {
        const existingClient = await tx.cRMClient.findUnique({
          where: { phone: cleanPhone },
        });

        if (existingClient) {
          const newCount = existingClient.purchaseCount + 1;
          const tier = calculateLoyaltyTier(newCount);
          await tx.cRMClient.update({
            where: { id: existingClient.id },
            data: {
              name: existingClient.name.includes("Cliente") ? cleanClientName : existingClient.name,
              purchaseCount: { increment: 1 },
              totalSpent: { increment: rentalPrice },
              loyaltyTier: tier,
              lastPurchaseAt: new Date(),
            },
          });
        } else {
          await tx.cRMClient.create({
            data: {
              name: cleanClientName,
              phone: cleanPhone,
              purchaseCount: 1,
              totalSpent: rentalPrice,
              loyaltyTier: "Bronce",
              lastPurchaseAt: new Date(),
            },
          });
        }
      }

      // 7. Find thread safely and insert confirmation message
      let targetThread = null;
      if (threadId) {
        targetThread = await tx.chatThread.findFirst({
          where: {
            environment,
            OR: [
              { id: threadId },
              { phone: threadId },
            ],
          },
        });
      }
      if (!targetThread && clientPhone) {
        targetThread = await tx.chatThread.findFirst({
          where: {
            environment,
            phone: clientPhone.trim(),
          },
        });
      }
      if (!targetThread && clientName) {
        targetThread = await tx.chatThread.findFirst({
          where: {
            environment,
            clientName: { contains: clientName.trim() },
          },
        });
      }

      if (targetThread) {
        const chatMsg =
          `👗 *Reserva Confirmada #${contractNumber}*\n` +
          `• Vestido: ${dress.name} (${dress.color}, Talla ${dress.size})\n` +
          `• Periodo: ${rentalStartDate} al ${rentalEndDate}\n` +
          `• Alquiler: ${rentalPrice} Bs | Garantía: ${guaranteeAmount} Bs (${paymentMethod})\n` +
          `• Clienta: ${clientName.trim()}`;

        const now = new Date();
        await tx.chatMessage.create({
          data: {
            threadId: targetThread.id,
            sender: "bot",
            text: chatMsg,
            environment,
            timestamp: now,
            createdAt: now,
          },
        });

        await tx.chatThread.update({
          where: { id: targetThread.id },
          data: {
            status: "Pendientes",
            lastMessage: `Reserva #${contractNumber} confirmada.`,
            lastMessageAt: now,
            updatedAt: now,
          },
        });
      }

      return booking;
    }, {
      maxWait: 15000,
      timeout: 30000,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        error: null,
        code: null,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al crear reserva de alquiler desde Relay";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMsg,
        code: "RELAY_RENTAL_CREATE_ERROR",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
