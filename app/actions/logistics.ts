"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { ActionResponse } from "@/types/action-response";
import { calculateLoyaltyTier, sanitizeClientPhoneAndName } from "@/lib/crm-utils";

const CreateOrderSchema = z.object({
  clientName: z.string().min(2, "El nombre del cliente es requerido"),
  clientPhone: z.string().optional(),
  recipientName: z.string().min(2, "El destinatario es requerido"),
  deliveryType: z.enum(["delivery", "pickup"]).default("delivery"),
  address: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim() : "Retiro en Tienda / Local")),
  zone: z.string().optional().transform((val) => (val && val.trim().length > 0 ? val.trim() : "Tienda Central")),
  deliveryDate: z.string().min(1, "La fecha es requerida"),
  deliveryTime: z.string().min(1, "La hora es requerida"),
  arrangementName: z.string().min(2, "El nombre del arreglo es requerido"),
  salePrice: z.number().min(0).default(0),
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
      recipeItems = [],
    } = parsed.data;

    const orderNumber = `PED-${Date.now().toString().slice(-6)}`;
    const ticketNumber = `TCK-${Date.now().toString().slice(-6)}`;

    const dateParts = deliveryDate.split("T")[0];
    const parsedDate = new Date(`${dateParts}T12:00:00.000Z`);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Stock check & decrement for recipe items
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

      // 2. Create OrderDelivery
      const order = await tx.orderDelivery.create({
        data: {
          orderNumber,
          clientName,
          clientPhone: clientPhone || "",
          recipientName,
          address,
          zone,
          deliveryDate: parsedDate,
          deliveryTime,
          status: "En preparación",
          arrangementName,
          salePrice,
          deliveryFee,
          total,
          paymentMethod,
          dedicationMessage,
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

      // 3. Create POSTicket and attach to active shift if available
      const ticket = await tx.pOSTicket.create({
        data: {
          ticketNumber,
          customerName: clientName,
          customerPhone: clientPhone || "",
          totalAmount: total,
          paymentMethod,
          ticketItems: {
            create: [
              {
                itemName: arrangementName,
                price: salePrice,
                quantity: 1,
              },
              ...(deliveryFee > 0
                ? [
                    {
                      itemName: `Servicio de Delivery (${zone})`,
                      price: deliveryFee,
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

      // 5. Auto-capture / update CRMClient for loyalty and customer directory
      const sanitized = sanitizeClientPhoneAndName(clientPhone || "", clientName?.trim() || "Cliente Farfalina");
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
  clientName: z.string().min(2, "El nombre del cliente es requerido"),
  clientPhone: z.string().optional().nullable(),
  recipientName: z.string().min(2, "El destinatario es requerido"),
  deliveryType: z.enum(["delivery", "pickup"]).default("delivery"),
  address: z.string().optional().nullable().transform((val) => (val && val.trim().length > 0 ? val.trim() : "Retiro en Tienda / Local")),
  zone: z.string().optional().nullable().transform((val) => (val && val.trim().length > 0 ? val.trim() : "Tienda Central")),
  deliveryDate: z.string().min(1, "La fecha es requerida"),
  deliveryTime: z.string().min(1, "La hora es requerida"),
  arrangementName: z.string().min(2, "El nombre del arreglo es requerido"),
  salePrice: z.number().min(0).default(0),
  deliveryFee: z.number().min(0).default(0),
  total: z.number().positive("El total debe ser positivo"),
  paymentMethod: z.enum(["Efectivo", "QR", "Tarjeta"]).default("Efectivo"),
  dedicationMessage: z.string().min(1, "La dedicatoria es requerida"),
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
      status,
    } = parsed.data;

    const dateParts = deliveryDate.split("T")[0];
    const parsedDate = new Date(`${dateParts}T12:00:00.000Z`);

    const updated = await prisma.orderDelivery.update({
      where: { id },
      data: {
        clientName,
        clientPhone: clientPhone || "",
        recipientName,
        address,
        zone,
        deliveryDate: parsedDate,
        deliveryTime,
        arrangementName,
        salePrice,
        deliveryFee,
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
      // 1. Revert flower inventory (RawIngredient available stock)
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

      // 2. Delete OrderDelivery (OrderRecipeItem is cascade-deleted)
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

