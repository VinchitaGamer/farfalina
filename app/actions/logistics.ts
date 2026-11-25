"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { ActionResponse } from "@/types/action-response";
import { calculateLoyaltyTier, sanitizeClientPhoneAndName, buildPhoneLookupCandidates } from "@/lib/crm-utils";

const CreateOrderSchema = z.object({
  clientName: z
    .string()
    .optional()
    .default("")
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : "Cliente Mostrador")),
  clientPhone: z.string().optional().default(""),
  recipientName: z
    .string()
    .optional()
    .default("")
    .transform((val) => val?.trim() || ""),
  recipientPhone: z.string().optional().nullable().default(""),
  deliveryType: z.enum(["delivery", "pickup"]).default("delivery"),
  address: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : "Retiro en Tienda / Local")),
  zone: z
    .string()
    .optional()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : "Sin zona especificada")),
  mapsUrl: z.string().optional().nullable().default(""),
  deliveryDate: z.string().min(1, "La fecha es requerida"),
  deliveryTime: z
    .string()
    .optional()
    .default("")
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : "Por coordinar")),
  arrangementName: z.string().min(2, "El nombre del arreglo es requerido"),
  salePrice: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
  total: z.number().positive("El total debe ser positivo"),
  paymentMethod: z.enum(["Efectivo", "QR", "Tarjeta"]).default("Efectivo"),
  dedicationMessage: z
    .string()
    .optional()
    .default("")
    .transform((val) => val?.trim() || ""),
  recipeItems: z
    .array(
      z.object({
        rawIngredientId: z.string(),
        quantityNeeded: z.number().int().positive(),
        unitCost: z.number().min(0).default(0),
      })
    )
    .optional(),
});

export type CreateOrderInput = z.input<typeof CreateOrderSchema>;

export async function getOrdersAction(): Promise<ActionResponse> {
  try {
    const orders = await prisma.orderDelivery.findMany({
      include: {
        recipeItems: {
          include: {
            rawIngredient: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: orders,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener pedidos";
    return {
      success: false,
      error: errorMessage,
      code: "ORDERS_FETCH_ERROR",
    };
  }
}

const UpdateOrderStatusSchema = z.object({
  id: z.string().min(1, "ID de pedido no provisto"),
  status: z.enum(["En preparación", "En camino", "Entregado"]),
});

export async function createUnifiedTicketAction(rawInput: CreateOrderInput): Promise<ActionResponse> {
  try {
    const parsed = CreateOrderSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del ticket inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const {
      clientName,
      clientPhone,
      recipientName,
      recipientPhone,
      deliveryType,
      address,
      zone,
      mapsUrl,
      deliveryDate,
      deliveryTime,
      arrangementName,
      salePrice,
      deliveryFee,
      total,
      paymentMethod,
      dedicationMessage,
      recipeItems = [],
    } = parsed.data;

    const finalRecipient = recipientName || clientName;
    const finalAddress = deliveryType === "pickup" ? "Retiro en Tienda / Local" : address;
    const finalZone = deliveryType === "pickup" ? "Tienda Central" : zone;
    const finalDeliveryFee = deliveryType === "pickup" ? 0 : deliveryFee;

    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const orderNumber = `PED-${suffix}`;
    const ticketNumber = `TCK-${suffix}`;

    const dateParts = deliveryDate.split("T")[0];
    const parsedDate = new Date(`${dateParts}T12:00:00.000Z`);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Optional non-blocking stock decrement if explicit recipe items were provided
      for (const item of recipeItems) {
        const ing = await tx.rawIngredient.findUnique({
          where: { id: item.rawIngredientId },
        });
        if (ing && ing.available >= item.quantityNeeded) {
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

      // 2. Create OrderDelivery with linkedTicketNumber for zero double-counting & clean cascade delete
      const order = await tx.orderDelivery.create({
        data: {
          orderNumber,
          clientName,
          clientPhone: clientPhone?.trim() || "",
          recipientName: finalRecipient,
          recipientPhone: recipientPhone?.trim() || null,
          address: finalAddress,
          zone: finalZone,
          mapsUrl: deliveryType === "pickup" ? null : mapsUrl?.trim() || null,
          deliveryDate: parsedDate,
          deliveryTime,
          status: "En preparación",
          arrangementName,
          salePrice,
          deliveryFee: finalDeliveryFee,
          total,
          paymentMethod,
          dedicationMessage,
          linkedTicketNumber: ticketNumber,
          recipeItems: {
            create: recipeItems.map((r) => ({
              rawIngredientId: r.rawIngredientId,
              quantityNeeded: r.quantityNeeded,
              unitCost: r.unitCost || 0,
            })),
          },
        },
        include: {
          recipeItems: {
            include: { rawIngredient: true },
          },
        },
      });

      // 3. Create paired POSTicket for printable receipt & shift log
      const ticket = await tx.pOSTicket.create({
        data: {
          ticketNumber,
          customerName: clientName,
          customerPhone: clientPhone?.trim() || "",
          totalAmount: total,
          paymentMethod,
          ticketItems: {
            create: [
              {
                itemName: arrangementName,
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
        orderBy: { createdAt: "desc" },
      });

      if (activeShift) {
        if (paymentMethod === "Efectivo") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesCash: { increment: total } },
          });
        } else if (paymentMethod === "QR") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesQR: { increment: total } },
          });
        } else if (paymentMethod === "Tarjeta") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesCard: { increment: total } },
          });
        }
      }

      // 5. Auto-capture / update CRMClient isolated to Farfalina environment
      const sanitized = sanitizeClientPhoneAndName(clientPhone || "", clientName?.trim() || "Cliente Farfalina");
      const cleanPhone = sanitized.phone;
      const cleanClientName = sanitized.name;

      if (cleanPhone && cleanPhone.length >= 6) {
        const phoneCandidates = buildPhoneLookupCandidates(cleanPhone);
        const existingClient = await tx.cRMClient.findFirst({
          where: {
            environment: "farfalina",
            phone: { in: phoneCandidates },
          },
        });

        if (existingClient) {
          const newCount = existingClient.purchaseCount + 1;
          const tier = calculateLoyaltyTier(newCount);
          await tx.cRMClient.update({
            where: { id: existingClient.id },
            data: {
              name: existingClient.name.includes("Cliente") ? cleanClientName : existingClient.name,
              purchaseCount: { increment: 1 },
              totalSpent: { increment: total },
              loyaltyTier: tier,
              lastPurchaseAt: new Date(),
            },
          });
        } else {
          await tx.cRMClient.create({
            data: {
              name: cleanClientName,
              phone: cleanPhone,
              environment: "farfalina",
              purchaseCount: 1,
              totalSpent: total,
              loyaltyTier: "Bronce",
              lastPurchaseAt: new Date(),
            },
          });
        }
      }

      return { order, ticket };
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al generar ticket unificado";
    return {
      success: false,
      error: errorMessage,
      code: "UNIFIED_TICKET_CREATE_ERROR",
    };
  }
}

export async function updateOrderStatusAction(
  id: string,
  status: "En preparación" | "En camino" | "Entregado"
): Promise<ActionResponse> {
  try {
    const parsed = UpdateOrderStatusSchema.safeParse({ id, status });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de estado inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const updatedOrder = await prisma.orderDelivery.update({
      where: { id: parsed.data.id },
      data: { status: parsed.data.status },
      include: {
        recipeItems: {
          include: { rawIngredient: true },
        },
      },
    });

    return {
      success: true,
      data: updatedOrder,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar estado del pedido";
    return {
      success: false,
      error: errorMessage,
      code: "ORDER_STATUS_UPDATE_ERROR",
    };
  }
}

const UpdateOrderSchema = z.object({
  id: z.string().min(1, "ID de pedido es requerido"),
  clientName: z
    .string()
    .optional()
    .default("")
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : "Cliente Mostrador")),
  clientPhone: z.string().optional().nullable(),
  recipientName: z
    .string()
    .optional()
    .default("")
    .transform((val) => val?.trim() || ""),
  recipientPhone: z.string().optional().nullable(),
  deliveryType: z.enum(["delivery", "pickup"]).default("delivery"),
  address: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : "Retiro en Tienda / Local")),
  zone: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : "Sin zona especificada")),
  mapsUrl: z.string().optional().nullable(),
  deliveryDate: z.string().min(1, "La fecha es requerida"),
  deliveryTime: z
    .string()
    .optional()
    .default("")
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : "Por coordinar")),
  arrangementName: z.string().min(2, "El nombre del arreglo es requerido"),
  salePrice: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
  total: z.number().positive("El total debe ser positivo"),
  paymentMethod: z.enum(["Efectivo", "QR", "Tarjeta"]).default("Efectivo"),
  dedicationMessage: z
    .string()
    .optional()
    .nullable()
    .transform((val) => val?.trim() || ""),
  status: z.enum(["En preparación", "En camino", "Entregado"]).default("En preparación"),
});

export type UpdateOrderInput = z.input<typeof UpdateOrderSchema>;

export async function updateOrderAction(rawInput: UpdateOrderInput): Promise<ActionResponse> {
  try {
    const parsed = UpdateOrderSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del pedido inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const {
      id,
      clientName,
      clientPhone,
      recipientName,
      recipientPhone,
      deliveryType,
      address,
      zone,
      mapsUrl,
      deliveryDate,
      deliveryTime,
      arrangementName,
      salePrice,
      deliveryFee,
      total,
      paymentMethod,
      dedicationMessage,
      status,
    } = parsed.data;

    const existingOrder = await prisma.orderDelivery.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return {
        success: false,
        error: "El pedido no existe",
        code: "NOT_FOUND",
      };
    }

    const dateParts = deliveryDate.split("T")[0];
    const parsedDate = new Date(`${dateParts}T12:00:00.000Z`);
    const finalDeliveryFee = deliveryType === "pickup" ? 0 : deliveryFee;
    const finalZone = deliveryType === "pickup" ? "Tienda Central" : zone;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.orderDelivery.update({
        where: { id },
        data: {
          clientName,
          clientPhone: clientPhone?.trim() || "",
          recipientName: recipientName || clientName,
          recipientPhone: recipientPhone?.trim() || null,
          address: deliveryType === "pickup" ? "Retiro en Tienda / Local" : address,
          zone: finalZone,
          mapsUrl: deliveryType === "pickup" ? null : mapsUrl?.trim() || null,
          deliveryDate: parsedDate,
          deliveryTime,
          arrangementName,
          salePrice,
          deliveryFee: finalDeliveryFee,
          total,
          paymentMethod,
          dedicationMessage,
          status,
        },
        include: {
          recipeItems: {
            include: { rawIngredient: true },
          },
        },
      });

      // Keep paired POSTicket synchronized when price, items, or payment method changes
      const candidateTickets: string[] = [];
      if (existingOrder.linkedTicketNumber) candidateTickets.push(existingOrder.linkedTicketNumber);
      if (existingOrder.orderNumber.startsWith("PED-")) {
        candidateTickets.push(`TCK-${existingOrder.orderNumber.slice(4)}`);
      }
      if (candidateTickets.length > 0) {
        const pairedTicket = await tx.pOSTicket.findFirst({
          where: { ticketNumber: { in: candidateTickets } },
        });
        if (pairedTicket) {
          await tx.pOSTicketItem.deleteMany({ where: { ticketId: pairedTicket.id } });
          await tx.pOSTicket.update({
            where: { id: pairedTicket.id },
            data: {
              customerName: clientName,
              customerPhone: clientPhone?.trim() || "",
              totalAmount: total,
              paymentMethod,
              ticketItems: {
                create: [
                  { itemName: arrangementName, price: salePrice, quantity: 1 },
                  ...(finalDeliveryFee > 0
                    ? [{ itemName: `Servicio de Delivery (${finalZone})`, price: finalDeliveryFee, quantity: 1 }]
                    : []),
                ],
              },
            },
          });
        }
      }

      // Adjust Open CashRegisterShift buckets if order belongs to the active shift
      if (existingOrder.total !== total || existingOrder.paymentMethod !== paymentMethod) {
        const activeShift = await tx.cashRegisterShift.findFirst({
          where: { status: "Open" },
          orderBy: { createdAt: "desc" },
        });
        if (activeShift && existingOrder.createdAt >= activeShift.createdAt) {
          let nextCash = activeShift.totalSalesCash;
          let nextQR = activeShift.totalSalesQR;
          let nextCard = activeShift.totalSalesCard;

          if (existingOrder.paymentMethod === "Efectivo") nextCash = Math.max(0, nextCash - existingOrder.total);
          else if (existingOrder.paymentMethod === "QR") nextQR = Math.max(0, nextQR - existingOrder.total);
          else if (existingOrder.paymentMethod === "Tarjeta") nextCard = Math.max(0, nextCard - existingOrder.total);

          if (paymentMethod === "Efectivo") nextCash += total;
          else if (paymentMethod === "QR") nextQR += total;
          else if (paymentMethod === "Tarjeta") nextCard += total;

          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: {
              totalSalesCash: nextCash,
              totalSalesQR: nextQR,
              totalSalesCard: nextCard,
            },
          });
        }
      }

      // Adjust CRMClient totalSpent if total changed
      if (existingOrder.total !== total && existingOrder.clientPhone) {
        const phoneCandidates = buildPhoneLookupCandidates(existingOrder.clientPhone);
        if (phoneCandidates.length > 0) {
          const client = await tx.cRMClient.findFirst({
            where: { environment: "farfalina", phone: { in: phoneCandidates } },
          });
          if (client) {
            await tx.cRMClient.update({
              where: { id: client.id },
              data: {
                totalSpent: Math.max(0, client.totalSpent - existingOrder.total + total),
              },
            });
          }
        }
      }

      return updatedOrder;
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar pedido";
    return {
      success: false,
      error: errorMessage,
      code: "ORDER_UPDATE_ERROR",
    };
  }
}

export async function deleteOrderAction(id: string): Promise<ActionResponse> {
  try {
    if (!id || typeof id !== "string") {
      return {
        success: false,
        error: "ID de pedido no provisto",
        code: "VALIDATION_ERROR",
      };
    }

    const order = await prisma.orderDelivery.findUnique({
      where: { id },
      include: {
        recipeItems: true,
      },
    });

    if (!order) {
      return {
        success: false,
        error: "El pedido no fue encontrado o ya ha sido eliminado",
        code: "NOT_FOUND",
      };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Revert flower inventory if any recipe items were attached
      for (const item of order.recipeItems) {
        if (item.rawIngredientId && item.quantityNeeded > 0) {
          await tx.rawIngredient.update({
            where: { id: item.rawIngredientId },
            data: {
              available: {
                increment: item.quantityNeeded,
              },
            },
          });
        }
      }

      // 2. Delete paired POSTicket so it NEVER remains orphaned in Contabilidad
      const candidateTicketNumbers = new Set<string>();
      if (order.linkedTicketNumber) {
        candidateTicketNumbers.add(order.linkedTicketNumber);
      }
      if (order.orderNumber.startsWith("PED-")) {
        candidateTicketNumbers.add(`TCK-${order.orderNumber.slice(4)}`);
      }
      if (candidateTicketNumbers.size > 0) {
        await tx.pOSTicket.deleteMany({
          where: {
            ticketNumber: {
              in: Array.from(candidateTicketNumbers),
            },
          },
        });
      }

      // 3. Revert active open cash shift bucket if this order was created during the open shift
      const activeShift = await tx.cashRegisterShift.findFirst({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
      });
      if (activeShift && order.createdAt >= activeShift.createdAt) {
        if (order.paymentMethod === "Efectivo") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesCash: Math.max(0, activeShift.totalSalesCash - order.total) },
          });
        } else if (order.paymentMethod === "QR") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesQR: Math.max(0, activeShift.totalSalesQR - order.total) },
          });
        } else if (order.paymentMethod === "Tarjeta") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesCard: Math.max(0, activeShift.totalSalesCard - order.total) },
          });
        }
      }

      // 4. Revert CRMClient stats if order belonged to a Farfalina client
      if (order.clientPhone) {
        const phoneCandidates = buildPhoneLookupCandidates(order.clientPhone);
        if (phoneCandidates.length > 0) {
          const client = await tx.cRMClient.findFirst({
            where: { environment: "farfalina", phone: { in: phoneCandidates } },
          });
          if (client) {
            const nextCount = Math.max(0, client.purchaseCount - 1);
            await tx.cRMClient.update({
              where: { id: client.id },
              data: {
                purchaseCount: nextCount,
                totalSpent: Math.max(0, client.totalSpent - order.total),
                loyaltyTier: calculateLoyaltyTier(nextCount),
              },
            });
          }
        }
      }

      // 5. Delete OrderDelivery (OrderRecipeItem is cascade-deleted)
      await tx.orderDelivery.delete({
        where: { id },
      });
    });

    return {
      success: true,
      data: { id, orderNumber: order.orderNumber },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar el pedido";
    return {
      success: false,
      error: errorMessage,
      code: "ORDER_DELETE_ERROR",
    };
  }
}
