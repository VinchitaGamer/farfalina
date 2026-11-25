"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { ActionResponse } from "@/types/action-response";
import { calculateLoyaltyTier, sanitizeClientPhoneAndName, buildPhoneLookupCandidates } from "@/lib/crm-utils";
import { getBoliviaDateStr } from "@/lib/utils";

const ProcessSaleSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  totalAmount: z.number().positive("El total debe ser positivo"),
  discountAmount: z.number().min(0).default(0),
  paymentMethod: z.enum(["Efectivo", "QR", "Tarjeta"]).default("Efectivo"),
  items: z
    .array(
      z.object({
        itemName: z.string().min(1),
        price: z.number().positive(),
        quantity: z.number().int().positive(),
        rawIngredientId: z.string().optional(),
        recipeItems: z
          .array(
            z.object({
              rawIngredientId: z.string(),
              quantityNeeded: z.number().int().positive(),
            })
          )
          .optional(),
      })
    )
    .min(1, "Debe incluir al menos un ítem"),
});

export type ProcessSaleInput = z.infer<typeof ProcessSaleSchema>;

const RecordMermaSchema = z.object({
  rawIngredientId: z.string().min(1, "El insumo es requerido"),
  quantityLost: z.number().int().positive("La cantidad debe ser mayor a 0"),
  reason: z.enum(["Marchitamiento", "Daño Transporte", "Defecto"]),
});

export type RecordMermaInput = z.infer<typeof RecordMermaSchema>;

export async function processPOSSaleAction(rawInput: ProcessSaleInput): Promise<ActionResponse> {
  try {
    const parsed = ProcessSaleSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de venta inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { customerName, customerPhone, totalAmount, discountAmount, paymentMethod, items } = parsed.data;
    const ticketNumber = `TCK-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Ticket (decoupled from mandatory recipe stock blocking)
      const ticket = await tx.pOSTicket.create({
        data: {
          ticketNumber,
          customerName: customerName || "Cliente Mostrador",
          customerPhone: customerPhone || "",
          totalAmount,
          discountAmount,
          paymentMethod,
          ticketItems: {
            create: items.map((i) => ({
              itemName: i.itemName,
              price: i.price,
              quantity: i.quantity,
            })),
          },
        },
        include: {
          ticketItems: true,
        },
      });

      // 2. Non-blocking stock deduction for direct rawIngredientId sales AND arrangement recipeItems
      for (const item of items) {
        if (item.rawIngredientId) {
          const ingredient = await tx.rawIngredient.findUnique({
            where: { id: item.rawIngredientId },
          });
          if (ingredient && ingredient.available > 0) {
            const deductQty = Math.min(ingredient.available, item.quantity);
            await tx.rawIngredient.update({
              where: { id: item.rawIngredientId },
              data: { available: { decrement: deductQty } },
            });
          }
        } else if (item.recipeItems && item.recipeItems.length > 0) {
          for (const r of item.recipeItems) {
            const ingredient = await tx.rawIngredient.findUnique({
              where: { id: r.rawIngredientId },
            });
            const totalNeeded = r.quantityNeeded * item.quantity;
            if (ingredient && ingredient.available > 0 && totalNeeded > 0) {
              const deductQty = Math.min(ingredient.available, totalNeeded);
              await tx.rawIngredient.update({
                where: { id: r.rawIngredientId },
                data: { available: { decrement: deductQty } },
              });
            }
          }
        }
      }

      // 3. Update current active CashRegisterShift if open
      const activeShift = await tx.cashRegisterShift.findFirst({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
      });

      if (activeShift) {
        await tx.cashRegisterShift.update({
          where: { id: activeShift.id },
          data: {
            totalSalesCash: paymentMethod === "Efectivo" ? { increment: totalAmount } : undefined,
            totalSalesQR: paymentMethod === "QR" ? { increment: totalAmount } : undefined,
            totalSalesCard: paymentMethod === "Tarjeta" ? { increment: totalAmount } : undefined,
          },
        });
      }

      // 4. Auto-update or create CRMClient isolated to Farfalina environment
      const sanitized = sanitizeClientPhoneAndName(customerPhone || "", customerName?.trim() || "Cliente POS");
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
              name: (existingClient.name.includes("Cliente") && cleanClientName !== "Cliente POS") ? cleanClientName : existingClient.name,
              purchaseCount: { increment: 1 },
              totalSpent: { increment: totalAmount },
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
              totalSpent: totalAmount,
              loyaltyTier: "Bronce",
              lastPurchaseAt: new Date(),
            },
          });
        }
      }

      return ticket;
    });

    return {
      success: true,
      data: result,
    };

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al procesar la venta";
    return {
      success: false,
      error: errorMessage,
      code: "POS_SALE_ERROR",
    };
  }
}



export async function recordMermaAction(rawInput: RecordMermaInput): Promise<ActionResponse> {
  try {
    const parsed = RecordMermaSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de merma inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { rawIngredientId, quantityLost, reason } = parsed.data;

    const ingredient = await prisma.rawIngredient.findUnique({
      where: { id: rawIngredientId },
    });

    if (!ingredient) {
      return {
        success: false,
        error: "El insumo seleccionado no existe",
        code: "NOT_FOUND",
      };
    }

    if (quantityLost > ingredient.available) {
      return {
        success: false,
        error: `No puedes descartar ${quantityLost} ${ingredient.unit}; solo hay ${ingredient.available} ${ingredient.unit} disponibles en stock.`,
        code: "INSUFFICIENT_STOCK",
      };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create MermaLog
      const log = await tx.mermaLog.create({
        data: {
          rawIngredientId,
          quantityLost,
          reason,
        },
        include: {
          rawIngredient: true,
        },
      });

      // 2. Decrement available quantity in RawIngredient safely
      await tx.rawIngredient.update({
        where: { id: rawIngredientId },
        data: {
          available: Math.max(0, ingredient.available - quantityLost),
        },
      });

      return log;
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al registrar merma";
    return {
      success: false,
      error: errorMessage,
      code: "MERMA_RECORD_ERROR",
    };
  }
}



export async function getShiftStatusAction(): Promise<ActionResponse> {
  try {
    const activeShift = await prisma.cashRegisterShift.findFirst({
      where: { status: "Open" },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: activeShift || null,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al consultar caja";
    return {
      success: false,
      error: errorMessage,
      code: "SHIFT_FETCH_ERROR",
    };
  }
}

export async function openCashShiftAction(openingBalance: number): Promise<ActionResponse> {
  try {
    if (openingBalance < 0) {
      return {
        success: false,
        error: "El saldo inicial no puede ser negativo",
        code: "VALIDATION_ERROR",
      };
    }

    const existingOpen = await prisma.cashRegisterShift.findFirst({
      where: { status: "Open" },
      orderBy: { createdAt: "desc" },
    });

    if (existingOpen) {
      return {
        success: false,
        error: "Ya existe un turno de caja abierto. Ciérralo antes de abrir uno nuevo.",
        code: "SHIFT_ALREADY_OPEN",
      };
    }

    const todayStr = getBoliviaDateStr();

    const newShift = await prisma.cashRegisterShift.create({
      data: {
        shiftDate: todayStr,
        openingBalance,
        status: "Open",
        totalSalesCash: 0,
        totalSalesQR: 0,
        totalSalesCard: 0,
        totalExpenses: 0,
        notes: "Apertura de turno",
      },
    });

    return {
      success: true,
      data: newShift,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al abrir la caja";
    return {
      success: false,
      error: errorMessage,
      code: "SHIFT_OPEN_ERROR",
    };
  }
}

const CloseShiftSchema = z.object({
  shiftId: z.string().min(1, "ID de turno no provisto"),
  declaredCash: z.number().min(0, "El saldo declarado no puede ser negativo"),
  cashierName: z.string().default("Agente de Turno"),
  notes: z.string().optional(),
});

export type CloseShiftInput = z.infer<typeof CloseShiftSchema>;

export async function closeCashShiftAction(rawInput: CloseShiftInput): Promise<ActionResponse> {
  try {
    const parsed = CloseShiftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de cierre inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { shiftId, declaredCash, cashierName, notes } = parsed.data;

    const shift = await prisma.cashRegisterShift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      return {
        success: false,
        error: "Turno de caja no encontrado",
        code: "NOT_FOUND",
      };
    }

    if (shift.status === "Closed") {
      return {
        success: false,
        error: "Este turno de caja ya fue cerrado previamente",
        code: "SHIFT_ALREADY_CLOSED",
      };
    }

    const closedAtNow = new Date();
    // Theoretical Cash Balance = Opening Balance + Cash Sales - Expenses
    const theoreticalCash = shift.openingBalance + shift.totalSalesCash - shift.totalExpenses;
    const discrepancy = declaredCash - theoreticalCash;

    // Retrieve all tickets generated during shift
    const tickets = await prisma.pOSTicket.findMany({
      where: {
        createdAt: {
          gte: shift.createdAt,
          lte: closedAtNow,
        },
      },
      include: { ticketItems: true },
      orderBy: { createdAt: "asc" },
    });

    const updatedShift = await prisma.cashRegisterShift.update({
      where: { id: shiftId },
      data: {
        closingBalance: declaredCash,
        declaredCash,
        discrepancy,
        cashierName,
        status: "Closed",
        notes: notes || "Cierre de caja completado con informe de arqueo",
        closedAt: closedAtNow,
      },
    });

    return {
      success: true,
      data: {
        shift: updatedShift,
        theoreticalCash,
        discrepancy,
        tickets,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al cerrar la caja";
    return {
      success: false,
      error: errorMessage,
      code: "SHIFT_CLOSE_ERROR",
    };
  }
}

export async function getArchivedShiftsAction(): Promise<ActionResponse> {
  try {
    const [closedShifts, allTickets] = await Promise.all([
      prisma.cashRegisterShift.findMany({
        where: { status: "Closed" },
        orderBy: { closedAt: "desc" },
      }),
      prisma.pOSTicket.findMany({
        include: { ticketItems: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const enrichedShifts = closedShifts.map((s) => {
      const endBound = s.closedAt ? new Date(s.closedAt) : new Date();
      const tickets = allTickets.filter(
        (t) => t.createdAt >= s.createdAt && t.createdAt <= endBound
      );
      return { ...s, tickets };
    });

    return {
      success: true,
      data: enrichedShifts,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener cierres de caja archivados";
    return {
      success: false,
      error: errorMessage,
      code: "ARCHIVED_SHIFTS_FETCH_ERROR",
    };
  }
}
