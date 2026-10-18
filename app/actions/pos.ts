"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { ActionResponse } from "@/types/action-response";
import { calculateLoyaltyTier, sanitizeClientPhoneAndName } from "@/lib/crm-utils";

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
    const ticketNumber = `TCK-${Date.now().toString().slice(-6)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Stock validation guard: calculate total requirements and ensure availability
      const neededMap = new Map<string, number>();
      for (const item of items) {
        if (item.rawIngredientId) {
          const current = neededMap.get(item.rawIngredientId) || 0;
          neededMap.set(item.rawIngredientId, current + item.quantity);
        }
        if (item.recipeItems && item.recipeItems.length > 0) {
          for (const ri of item.recipeItems) {
            const current = neededMap.get(ri.rawIngredientId) || 0;
            neededMap.set(ri.rawIngredientId, current + (ri.quantityNeeded * item.quantity));
          }
        }
      }

      for (const [ingredientId, quantityNeeded] of neededMap.entries()) {
        const ingredient = await tx.rawIngredient.findUnique({
          where: { id: ingredientId },
        });
        if (!ingredient) {
          throw new Error(`Insumo floral con ID ${ingredientId} no encontrado.`);
        }
        if (ingredient.available < quantityNeeded) {
          throw new Error(
            `Stock insuficiente para "${ingredient.name}". Disponible: ${ingredient.available} ${ingredient.unit}, Requerido: ${quantityNeeded} ${ingredient.unit}.`
          );
        }
      }

      // 2. Create Ticket
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

      // 3. Deduct ingredient stock
      for (const [ingredientId, quantityNeeded] of neededMap.entries()) {
        await tx.rawIngredient.update({
          where: { id: ingredientId },
          data: {
            available: {
              decrement: quantityNeeded,
            },
          },
        });
      }

      // 4. Update current active CashRegisterShift if open
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

      // 4. Auto-update or create CRMClient for loyalty and customer directory
      const sanitized = sanitizeClientPhoneAndName(customerPhone || "", customerName?.trim() || "Cliente POS");
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

      // 2. Decrement available quantity in RawIngredient
      await tx.rawIngredient.update({
        where: { id: rawIngredientId },
        data: {
          available: {
            decrement: quantityLost,
          },
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

    const todayStr = new Date().toISOString().split("T")[0];

    const newShift = await prisma.cashRegisterShift.create({
      data: {
        shiftDate: todayStr,
        openingBalance,
        status: "Open",
        totalSalesCash: 0,
        totalSalesQR: 0,
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

    // Theoretical Cash Balance = Opening Balance + Cash Sales - Expenses
    const theoreticalCash = shift.openingBalance + shift.totalSalesCash - shift.totalExpenses;
    const discrepancy = declaredCash - theoreticalCash;

    // Retrieve all tickets generated during shift
    const tickets = await prisma.pOSTicket.findMany({
      where: {
        createdAt: {
          gte: shift.createdAt,
        },
      },
      include: { ticketItems: true },
      orderBy: { createdAt: "asc" },
    });

    let updatedShift: import("@prisma/client").CashRegisterShift | null = null;
    try {
      updatedShift = await prisma.cashRegisterShift.update({
        where: { id: shiftId },
        data: {
          closingBalance: declaredCash,
          declaredCash,
          discrepancy,
          cashierName,
          status: "Closed",
          notes: notes || "Cierre de caja completado con informe de arqueo",
          closedAt: new Date(),
        },
      });
    } catch (_prismaErr) {
      // Fallback for stale HMR PrismaClient cache: raw SQLite query update
      const nowIso = new Date().toISOString();
      await prisma.$executeRawUnsafe(
        `UPDATE CashRegisterShift SET closingBalance = ?, declaredCash = ?, discrepancy = ?, cashierName = ?, status = 'Closed', notes = ?, closedAt = ? WHERE id = ?`,
        declaredCash,
        declaredCash,
        discrepancy,
        cashierName,
        notes || "Cierre de caja completado con informe de arqueo",
        nowIso,
        shiftId
      );

      updatedShift = await prisma.cashRegisterShift.findUnique({
        where: { id: shiftId },
      });
    }

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
    const closedShifts = await prisma.cashRegisterShift.findMany({
      where: { status: "Closed" },
      orderBy: { closedAt: "desc" },
    });

    return {
      success: true,
      data: closedShifts,
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
