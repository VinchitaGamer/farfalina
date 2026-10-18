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

const RelayCreateOrderSchema = z.object({
  clientName: z.string().min(2, "El nombre del cliente es requerido"),
  clientPhone: z.string().optional().default(""),
  recipientName: z.string().optional().default(""),
  deliveryType: z.enum(["delivery", "pickup"]).default("delivery"),
  address: z.string().optional().default(""),
  zone: z.string().optional().default("Calacoto, Zona Sur"),
  deliveryDate: z.string().min(1, "La fecha de entrega es requerida"),
  deliveryTime: z.string().min(1, "La hora de entrega es requerida"),
  arrangementName: z.string().min(2, "El nombre del arreglo es requerido"),
  salePrice: z.number().min(0, "El precio debe ser mayor o igual a 0"),
  deliveryFee: z.number().min(0).default(0),
  total: z.number().positive("El total debe ser positivo"),
  paymentMethod: z.enum(["Efectivo", "QR", "Tarjeta"]).default("Efectivo"),
  dedicationMessage: z.string().min(1, "La dedicatoria es requerida"),
  recipeItems: z
    .array(
      z.object({
        rawIngredientId: z.string(),
        quantityNeeded: z.number().int().positive(),
        unitCost: z.number().min(0).default(0),
      })
    )
    .optional()
    .default([]),
  threadId: z.string().optional().nullable(),
  channel: z.string().optional().default("WhatsApp"),
  environment: z.enum(["farfalina", "carissma"]).default("farfalina"),
});

export type RelayCreateOrderInput = z.infer<typeof RelayCreateOrderSchema>;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = RelayCreateOrderSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: parsed.error.issues[0]?.message || "Datos de pedido inválidos",
          code: "VALIDATION_ERROR",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const {
      clientName,
      clientPhone,
      recipientName,
      deliveryType,
      address,
      zone,
      deliveryDate,
      deliveryTime,
      arrangementName,
      salePrice,
      deliveryFee,
      total,
      paymentMethod,
      dedicationMessage,
      recipeItems,
      threadId,
      channel,
      environment,
    } = parsed.data;

    const finalRecipient = recipientName?.trim() || clientName.trim();
    const finalAddress =
      deliveryType === "pickup"
        ? "Retiro en Tienda / Local"
        : (address?.trim() || "Dirección a coordinar");
    const finalZone = deliveryType === "pickup" ? "Tienda Central" : zone;
    const finalDeliveryFee = deliveryType === "pickup" ? 0 : deliveryFee;
    const finalTotal = salePrice + finalDeliveryFee;

    const orderNumber = `PED-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const ticketNumber = `TCK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    const dateParts = deliveryDate.split("T")[0];
    const parsedDate = new Date(`${dateParts}T12:00:00.000Z`);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Resolve and validate recipe items
      const validRecipeItems: Array<{
        rawIngredientId: string;
        quantityNeeded: number;
        unitCost: number;
      }> = [];

      if (recipeItems && recipeItems.length > 0) {
        for (const item of recipeItems) {
          const ing = await tx.rawIngredient.findUnique({
            where: { id: item.rawIngredientId },
          });
          if (ing) {
            validRecipeItems.push({
              rawIngredientId: ing.id,
              quantityNeeded: item.quantityNeeded,
              unitCost: item.unitCost || ing.costPerUnit || 0,
            });
            if (ing.available >= item.quantityNeeded) {
              await tx.rawIngredient.update({
                where: { id: ing.id },
                data: {
                  available: {
                    decrement: item.quantityNeeded,
                  },
                },
              });
            }
          }
        }
      }

      // If no explicit recipeItems provided, auto-link from catalog arrangement
      if (validRecipeItems.length === 0 && arrangementName) {
        const matchingArrangement = await tx.arrangement.findFirst({
          where: {
            OR: [
              { name: arrangementName.trim() },
              { name: { contains: arrangementName.trim() } },
            ],
          },
          include: {
            recipeItems: {
              include: { rawIngredient: true },
            },
          },
        });

        if (matchingArrangement && matchingArrangement.recipeItems.length > 0) {
          for (const item of matchingArrangement.recipeItems) {
            validRecipeItems.push({
              rawIngredientId: item.rawIngredientId,
              quantityNeeded: item.quantityNeeded,
              unitCost: item.rawIngredient.costPerUnit || 0,
            });
            if (item.rawIngredient.available >= item.quantityNeeded) {
              await tx.rawIngredient.update({
                where: { id: item.rawIngredientId },
                data: {
                  available: {
                    decrement: item.quantityNeeded,
                  },
                },
              });
            }
          }
        }
      }

      // 2. Create OrderDelivery
      const order = await tx.orderDelivery.create({
        data: {
          orderNumber,
          clientName: clientName.trim(),
          clientPhone: clientPhone?.trim() || "",
          recipientName: finalRecipient,
          address: finalAddress,
          zone: finalZone,
          deliveryDate: parsedDate,
          deliveryTime,
          status: "En preparación",
          arrangementName: arrangementName.trim(),
          salePrice,
          deliveryFee: finalDeliveryFee,
          total: finalTotal,
          paymentMethod,
          dedicationMessage: dedicationMessage.trim(),
          recipeItems: {
            create: validRecipeItems,
          },
        },
        include: {
          recipeItems: {
            include: { rawIngredient: true },
          },
        },
      });

      // 3. Create POSTicket
      const ticket = await tx.pOSTicket.create({
        data: {
          ticketNumber,
          customerName: clientName.trim(),
          customerPhone: clientPhone?.trim() || "",
          totalAmount: finalTotal,
          paymentMethod,
          ticketItems: {
            create: [
              {
                itemName: arrangementName.trim(),
                price: salePrice,
                quantity: 1,
              },
              ...(finalDeliveryFee > 0
                ? [
                    {
                      itemName: `Servicio de Delivery (${finalZone})`,
                      price: finalDeliveryFee,
                      quantity: 1,
                    },
                  ]
                : []),
            ],
          },
        },
      });

      // 4. Update CashRegisterShift if an Open shift exists
      const activeShift = await tx.cashRegisterShift.findFirst({
        where: { status: "Open" },
      });

      if (activeShift) {
        if (paymentMethod === "Efectivo") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesCash: { increment: finalTotal } },
          });
        } else if (paymentMethod === "QR") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesQR: { increment: finalTotal } },
          });
        } else if (paymentMethod === "Tarjeta") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesCard: { increment: finalTotal } },
          });
        }
      }

      // 5. CRM Client capture/update
      const sanitized = sanitizeClientPhoneAndName(
        clientPhone || "",
        clientName?.trim() || "Cliente Farfalina"
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
              totalSpent: { increment: finalTotal },
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
              totalSpent: finalTotal,
              loyaltyTier: "Bronce",
              lastPurchaseAt: new Date(),
            },
          });
        }
      }

      // 6. Find thread safely and insert confirmation message
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
          `🌸 *Pedido Confirmado #${orderNumber}*\n` +
          `• Arreglo: ${arrangementName}\n` +
          `• Modalidad: ${deliveryType === "pickup" ? "Recoger en Tienda" : `Envío a ${finalRecipient} (${finalZone})`}\n` +
          `• Fecha: ${deliveryDate} a las ${deliveryTime}\n` +
          `• Total: ${finalTotal} Bs (${paymentMethod})\n` +
          `• Dedicatoria: "${dedicationMessage.trim()}"`;

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
            lastMessage: `Pedido #${orderNumber} emitido exitosamente.`,
            lastMessageAt: now,
            updatedAt: now,
          },
        });
      }

      return { order, ticket, orderNumber };
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
    const errorMsg = err instanceof Error ? err.message : "Error al crear pedido desde Relay";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMsg,
        code: "RELAY_ORDER_CREATE_ERROR",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
