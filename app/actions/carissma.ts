"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { ActionResponse } from "@/types/action-response";
import { calculateLoyaltyTier, sanitizeClientPhoneAndName } from "@/lib/crm-utils";

// ==========================================
// 1. ZOD SCHEMAS & TYPES
// ==========================================

const DressSizeEnum = z.enum(["XS", "S", "M", "L", "XL"]);
const DressConditionEnum = z.enum(["Excelente", "Bueno", "Requiere Mantenimiento"]);
const DressStatusEnum = z.enum(["Disponible", "Reservado", "En Uso", "En Lavandería"]);

const CreateDressSchema = z.object({
  name: z.string().min(2, "El nombre del vestido es requerido"),
  brand: z.string().min(1, "La marca es requerida"),
  size: DressSizeEnum,
  category: z.string().default("Gala"),
  imageUrl: z.string().optional().nullable(),
  baseRentalPrice: z.number().positive("El precio base de renta debe ser mayor a 0"),
  acquisitionCost: z.number().positive("El costo de adquisición debe ser positivo"),
  requiredGuarantee: z.number().min(0, "La garantía no puede ser negativa"),
  color: z.string().min(1, "El color es requerido"),
});

export type CreateDressInput = z.infer<typeof CreateDressSchema>;

const UpdateDressSchema = z.object({
  id: z.string().min(1, "ID del vestido requerido"),
  name: z.string().min(2).optional(),
  brand: z.string().min(1).optional(),
  size: DressSizeEnum.optional(),
  category: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
  baseRentalPrice: z.number().positive().optional(),
  acquisitionCost: z.number().positive().optional(),
  requiredGuarantee: z.number().min(0).optional(),
  color: z.string().min(1).optional(),
  condition: DressConditionEnum.optional(),
  status: DressStatusEnum.optional(),
});

export type UpdateDressInput = z.infer<typeof UpdateDressSchema>;

const UpdateCarissmaConfigSchema = z.object({
  defaultRentalDays: z.number().int().min(1, "Los días de alquiler deben ser al menos 1"),
  defaultGuaranteePercent: z.number().min(0).max(100, "El porcentaje de garantía debe estar entre 0 y 100"),
  decayRatePerUsage: z.number().min(0).max(50, "La tasa de depreciación debe estar entre 0% y 50%"),
  minPriceFloorPercent: z.number().min(10).max(100, "El piso mínimo debe ser al menos 10%"),
  lateFeePerDay: z.number().min(0, "La penalización diaria no puede ser negativa"),
});

export type UpdateCarissmaConfigInput = z.infer<typeof UpdateCarissmaConfigSchema>;

const CreateRentalBookingSchema = z.object({
  clientName: z.string().min(2, "El nombre de la clienta es requerido"),
  clientPhone: z.string().optional(),
  dressId: z.string().min(1, "Debe seleccionar un vestido"),
  rentalStartDate: z.string().or(z.date()),
  rentalEndDate: z.string().or(z.date()),
  rentalPrice: z.number().positive("El precio de renta debe ser mayor a 0"),
  guaranteeAmount: z.number().min(0, "La garantía no puede ser negativa"),
  paymentMethod: z.enum(["Efectivo", "QR", "Tarjeta"]).default("Efectivo"),
  notes: z.string().optional(),
});

export type CreateRentalBookingInput = z.infer<typeof CreateRentalBookingSchema>;

const ReturnRentalDressSchema = z.object({
  bookingId: z.string().min(1, "ID de reserva requerido"),
  penaltyFee: z.number().min(0).default(0),
  guaranteeStatus: z.enum(["Devuelta", "Retenida Parcial", "Retenida Total"]).default("Devuelta"),
  nextDressStatus: z.enum(["En Lavandería", "Disponible", "Requiere Mantenimiento"]).default("En Lavandería"),
  notes: z.string().optional(),
});

export type ReturnRentalDressInput = z.infer<typeof ReturnRentalDressSchema>;

const CloseCarissmaShiftSchema = z.object({
  shiftId: z.string().min(1, "ID de turno requerido"),
  declaredCash: z.number().min(0, "El saldo declarado no puede ser negativo"),
  cashierName: z.string().default("Agente Carissma"),
  notes: z.string().optional(),
});

export type CloseCarissmaShiftInput = z.infer<typeof CloseCarissmaShiftSchema>;

const CreateCarissmaExpenseSchema = z.object({
  category: z.enum(["Tintorería/Lavandería", "Modistería/Arreglos", "Bolsas/Empaques", "Accesorios", "Servicios", "Otros"]),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  description: z.string().min(3, "La descripción es requerida"),
});

export type CreateCarissmaExpenseInput = z.infer<typeof CreateCarissmaExpenseSchema>;

// ==========================================
// 2. DRESS INVENTORY SERVER ACTIONS
// ==========================================

export async function getDressesAction(): Promise<ActionResponse> {
  try {
    const dresses = await prisma.dress.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        bookings: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });

    return {
      success: true,
      data: dresses,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener vestidos";
    return {
      success: false,
      error: errorMessage,
      code: "DRESSES_FETCH_ERROR",
    };
  }
}

export async function createDressAction(rawInput: CreateDressInput): Promise<ActionResponse> {
  try {
    const parsed = CreateDressSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de vestido inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { name, brand, size, category, imageUrl, baseRentalPrice, acquisitionCost, requiredGuarantee, color } = parsed.data;

    const newDress = await prisma.dress.create({
      data: {
        name,
        brand,
        size,
        category: category || "Gala",
        imageUrl: imageUrl || null,
        baseRentalPrice,
        acquisitionCost,
        requiredGuarantee,
        color,
        status: "Disponible",
        condition: "Excelente",
        timesUsed: 0,
      },
    });

    return {
      success: true,
      data: newDress,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al crear el vestido";
    return {
      success: false,
      error: errorMessage,
      code: "DRESS_CREATE_ERROR",
    };
  }
}

export async function updateDressAction(rawInput: UpdateDressInput): Promise<ActionResponse> {
  try {
    const parsed = UpdateDressSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Parámetros inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { id, ...dataToUpdate } = parsed.data;

    const updated = await prisma.dress.update({
      where: { id },
      data: dataToUpdate,
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar vestido";
    return {
      success: false,
      error: errorMessage,
      code: "DRESS_UPDATE_ERROR",
    };
  }
}

export async function deleteDressAction(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return { success: false, error: "ID de vestido no provisto", code: "VALIDATION_ERROR" };
    }

    await prisma.dress.delete({ where: { id } });

    return { success: true, data: { id } };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar vestido";
    return { success: false, error: errorMessage, code: "DRESS_DELETE_ERROR" };
  }
}

export async function updateDressStatusAction(
  id: string,
  status: "Disponible" | "Reservado" | "En Uso" | "En Lavandería",
  condition?: "Excelente" | "Bueno" | "Requiere Mantenimiento"
): Promise<ActionResponse> {
  try {
    if (!id) {
      return { success: false, error: "ID no provisto", code: "VALIDATION_ERROR" };
    }

    const updatedDress = await prisma.dress.update({
      where: { id },
      data: {
        status,
        condition: condition || undefined,
        timesUsed: status === "En Uso" ? { increment: 1 } : undefined,
      },
    });

    return {
      success: true,
      data: updatedDress,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar estado del vestido";
    return {
      success: false,
      error: errorMessage,
      code: "DRESS_UPDATE_ERROR",
    };
  }
}

// ==========================================
// 3. CARISSMA CONFIG (SIN HARDCODING)
// ==========================================

export async function getCarissmaConfigAction(): Promise<ActionResponse> {
  try {
    let config = await prisma.carissmaConfig.findUnique({
      where: { id: "default" },
    });

    if (!config) {
      config = await prisma.carissmaConfig.create({
        data: {
          id: "default",
          defaultRentalDays: 3,
          defaultGuaranteePercent: 30.0,
          decayRatePerUsage: 5.0,
          minPriceFloorPercent: 40.0,
          lateFeePerDay: 50.0,
        },
      });
    }

    return {
      success: true,
      data: config,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener configuración";
    return {
      success: false,
      error: errorMessage,
      code: "CONFIG_FETCH_ERROR",
    };
  }
}

export async function updateCarissmaConfigAction(rawInput: UpdateCarissmaConfigInput): Promise<ActionResponse> {
  try {
    const parsed = UpdateCarissmaConfigSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Configuración inválida",
        code: "VALIDATION_ERROR",
      };
    }

    const updated = await prisma.carissmaConfig.upsert({
      where: { id: "default" },
      update: parsed.data,
      create: {
        id: "default",
        ...parsed.data,
      },
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al guardar configuración";
    return {
      success: false,
      error: errorMessage,
      code: "CONFIG_UPDATE_ERROR",
    };
  }
}

// ==========================================
// 4. RENTAL BOOKINGS (RESERVAS Y CONTRATOS)
// ==========================================

export async function getRentalBookingsAction(): Promise<ActionResponse> {
  try {
    const bookings = await prisma.rentalBooking.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        dress: true,
        shift: true,
      },
    });

    return {
      success: true,
      data: bookings,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener reservas";
    return {
      success: false,
      error: errorMessage,
      code: "RENTAL_BOOKINGS_FETCH_ERROR",
    };
  }
}

export async function createRentalBookingAction(rawInput: CreateRentalBookingInput): Promise<ActionResponse> {
  try {
    const parsed = CreateRentalBookingSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de reserva inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { clientName, clientPhone, dressId, rentalStartDate, rentalEndDate, rentalPrice, guaranteeAmount, paymentMethod, notes } = parsed.data;

    const dress = await prisma.dress.findUnique({ where: { id: dressId } });
    if (!dress) {
      return { success: false, error: "El vestido seleccionado no existe", code: "NOT_FOUND" };
    }

    const contractNumber = `ALQ-${Date.now().toString().slice(-6)}`;
    const startDt = new Date(rentalStartDate);
    const endDt = new Date(rentalEndDate);
    startDt.setHours(0, 0, 0, 0);
    endDt.setHours(23, 59, 59, 999);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Anti-overbooking: check if there's an active booking that overlaps with the requested dates
      const overlappingBooking = await tx.rentalBooking.findFirst({
        where: {
          dressId,
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
          dressId,
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
        where: { id: dressId },
        data: { status: "Reservado" },
      });

      // 4. Update Shift sales and guarantee in custody if open
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

      // 5. Sync or create CRM Client record
      const sanitized = sanitizeClientPhoneAndName(clientPhone || "", clientName);
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
              totalSpent: { increment: rentalPrice },
              purchaseCount: { increment: 1 },
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
              notes: `Alquiler vestido: ${dress.name} (${dress.size})`,
            },
          });
        }
      }

      return booking;
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al crear la reserva de alquiler";
    return {
      success: false,
      error: errorMessage,
      code: "BOOKING_CREATE_ERROR",
    };
  }
}

export async function updateRentalStatusAction(
  bookingId: string,
  newStatus: "Reservado" | "En Prueba" | "Entregado" | "Devuelto / Revisión" | "En Lavandería" | "Finalizado"
): Promise<ActionResponse> {
  try {
    if (!bookingId) {
      return { success: false, error: "ID de reserva requerido", code: "VALIDATION_ERROR" };
    }

    const booking = await prisma.rentalBooking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return { success: false, error: "Reserva no encontrada", code: "NOT_FOUND" };
    }

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.rentalBooking.update({
        where: { id: bookingId },
        data: { rentalStatus: newStatus },
      });

      // Mirror dress status
      if (newStatus === "Entregado") {
        await tx.dress.update({
          where: { id: booking.dressId },
          data: { status: "En Uso", timesUsed: { increment: 1 } },
        });
      } else if (newStatus === "En Lavandería") {
        await tx.dress.update({
          where: { id: booking.dressId },
          data: { status: "En Lavandería" },
        });
      } else if (newStatus === "Finalizado") {
        await tx.dress.update({
          where: { id: booking.dressId },
          data: { status: "Disponible" },
        });
      }

      return b;
    });

    return { success: true, data: updated };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar estado del alquiler";
    return { success: false, error: errorMessage, code: "RENTAL_STATUS_UPDATE_ERROR" };
  }
}

export async function returnRentalDressAction(rawInput: ReturnRentalDressInput): Promise<ActionResponse> {
  try {
    const parsed = ReturnRentalDressSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Parámetros inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { bookingId, penaltyFee, guaranteeStatus, nextDressStatus, notes } = parsed.data;

    const booking = await prisma.rentalBooking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return { success: false, error: "Reserva no encontrada", code: "NOT_FOUND" };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Current open shift for Carissma
      const currentShift = await tx.carissmaCashShift.findFirst({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
      });

      // 2. Update RentalBooking
      const updatedBooking = await tx.rentalBooking.update({
        where: { id: bookingId },
        data: {
          actualReturnDate: new Date(),
          penaltyFee,
          guaranteeStatus,
          rentalStatus: nextDressStatus === "En Lavandería" ? "En Lavandería" : "Finalizado",
          notes: notes ? (booking.notes ? `${booking.notes} | ${notes}` : notes) : booking.notes,
        },
      });

      // 3. Update Dress status
      await tx.dress.update({
        where: { id: booking.dressId },
        data: {
          status: nextDressStatus === "En Lavandería" ? "En Lavandería" : "Disponible",
          condition: nextDressStatus === "Requiere Mantenimiento" ? "Requiere Mantenimiento" : undefined,
        },
      });

      // 4. Update Shift guarantees returned or penalties
      if (currentShift) {
        let returnedGuarantee = 0;
        let penaltyRecorded = penaltyFee || 0;

        if (guaranteeStatus === "Devuelta") {
          returnedGuarantee = booking.guaranteeAmount;
        } else if (guaranteeStatus === "Retenida Parcial") {
          returnedGuarantee = Math.max(0, booking.guaranteeAmount - penaltyRecorded);
        } else if (guaranteeStatus === "Retenida Total") {
          penaltyRecorded = Math.max(penaltyRecorded, booking.guaranteeAmount);
          returnedGuarantee = 0;
        }

        await tx.carissmaCashShift.update({
          where: { id: currentShift.id },
          data: {
            totalGuaranteesReturned: returnedGuarantee > 0 ? { increment: returnedGuarantee } : undefined,
            totalPenalties: penaltyRecorded > 0 ? { increment: penaltyRecorded } : undefined,
          },
        });
      }

      return updatedBooking;
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al procesar devolución";
    return {
      success: false,
      error: errorMessage,
      code: "RETURN_PROCESS_ERROR",
    };
  }
}

export async function deleteRentalBookingAction(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return { success: false, error: "ID no provisto", code: "VALIDATION_ERROR" };
    }

    const booking = await prisma.rentalBooking.findUnique({ where: { id } });
    if (booking) {
      // Liberate dress if reserved
      await prisma.dress.update({
        where: { id: booking.dressId },
        data: { status: "Disponible" },
      });
      await prisma.rentalBooking.delete({ where: { id } });
    }

    return { success: true, data: { id } };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar reserva";
    return { success: false, error: errorMessage, code: "BOOKING_DELETE_ERROR" };
  }
}

// ==========================================
// 5. CAJA REGISTRADORA Y ARQUEO CARISSMA
// ==========================================

export async function getCarissmaCurrentShiftAction(): Promise<ActionResponse> {
  try {
    const shift = await prisma.carissmaCashShift.findFirst({
      where: { status: "Open" },
      orderBy: { createdAt: "desc" },
      include: {
        bookings: true,
        expenses: true,
      },
    });

    return {
      success: true,
      data: shift,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener turno activo";
    return {
      success: false,
      error: errorMessage,
      code: "SHIFT_FETCH_ERROR",
    };
  }
}

export async function openCarissmaCashShiftAction(openingBalance: number, cashierName = "Agente Carissma"): Promise<ActionResponse> {
  try {
    if (openingBalance < 0) {
      return { success: false, error: "El saldo inicial no puede ser negativo", code: "VALIDATION_ERROR" };
    }

    // Check if open shift already exists
    const existing = await prisma.carissmaCashShift.findFirst({
      where: { status: "Open" },
    });
    if (existing) {
      return { success: false, error: "Ya existe un turno de caja abierto en Carissma", code: "ALREADY_OPEN" };
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const newShift = await prisma.carissmaCashShift.create({
      data: {
        shiftDate: todayStr,
        cashierName: cashierName.trim() || "Agente Carissma",
        openingBalance,
        status: "Open",
        totalSalesCash: 0,
        totalSalesQR: 0,
        totalSalesCard: 0,
        totalGuaranteesInCustody: 0,
        totalGuaranteesReturned: 0,
        totalPenalties: 0,
        totalExpenses: 0,
        notes: "Apertura de turno de Alquileres Carissma",
      },
    });

    return {
      success: true,
      data: newShift,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al abrir caja de Carissma";
    return {
      success: false,
      error: errorMessage,
      code: "SHIFT_OPEN_ERROR",
    };
  }
}

export async function closeCarissmaCashShiftAction(rawInput: CloseCarissmaShiftInput): Promise<ActionResponse> {
  try {
    const parsed = CloseCarissmaShiftSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de cierre inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { shiftId, declaredCash, cashierName, notes } = parsed.data;

    const shift = await prisma.carissmaCashShift.findUnique({
      where: { id: shiftId },
      include: { bookings: true, expenses: true },
    });

    if (!shift) {
      return { success: false, error: "Turno no encontrado", code: "NOT_FOUND" };
    }

    // Theoretical Cash = Opening + Cash Rentals + Penalties + Guarantees in Custody - Guarantees Returned - Expenses
    const theoreticalCash =
      shift.openingBalance +
      shift.totalSalesCash +
      shift.totalPenalties +
      shift.totalGuaranteesInCustody -
      shift.totalGuaranteesReturned -
      shift.totalExpenses;

    const discrepancy = declaredCash - theoreticalCash;

    const updatedShift = await prisma.carissmaCashShift.update({
      where: { id: shiftId },
      data: {
        closingBalance: declaredCash,
        declaredCash,
        discrepancy,
        cashierName,
        status: "Closed",
        notes: notes || "Cierre de caja Carissma completado",
        closedAt: new Date(),
      },
    });

    return {
      success: true,
      data: {
        shift: updatedShift,
        theoreticalCash,
        discrepancy,
        bookings: shift.bookings,
        expenses: shift.expenses,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al cerrar caja de Carissma";
    return {
      success: false,
      error: errorMessage,
      code: "SHIFT_CLOSE_ERROR",
    };
  }
}

export async function getCarissmaArchivedShiftsAction(): Promise<ActionResponse> {
  try {
    const closedShifts = await prisma.carissmaCashShift.findMany({
      where: { status: "Closed" },
      orderBy: { closedAt: "desc" },
      include: {
        bookings: true,
        expenses: true,
      },
    });

    return {
      success: true,
      data: closedShifts,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener cierres archivados";
    return {
      success: false,
      error: errorMessage,
      code: "ARCHIVED_SHIFTS_FETCH_ERROR",
    };
  }
}

// ==========================================
// 6. GASTOS Y FINANZAS CARISSMA
// ==========================================

export async function createCarissmaExpenseAction(rawInput: CreateCarissmaExpenseInput): Promise<ActionResponse> {
  try {
    const parsed = CreateCarissmaExpenseSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de gasto inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { category, amount, description } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const currentShift = await tx.carissmaCashShift.findFirst({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
      });

      const expense = await tx.carissmaExpense.create({
        data: {
          category,
          amount,
          description: description.trim(),
          shiftId: currentShift ? currentShift.id : null,
        },
      });

      if (currentShift) {
        await tx.carissmaCashShift.update({
          where: { id: currentShift.id },
          data: {
            totalExpenses: { increment: amount },
          },
        });
      }

      return expense;
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al registrar gasto";
    return {
      success: false,
      error: errorMessage,
      code: "EXPENSE_CREATE_ERROR",
    };
  }
}

export async function getCarissmaExpensesAction(): Promise<ActionResponse> {
  try {
    const expenses = await prisma.carissmaExpense.findMany({
      orderBy: { expenseDate: "desc" },
    });

    return {
      success: true,
      data: expenses,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener gastos";
    return {
      success: false,
      error: errorMessage,
      code: "EXPENSES_FETCH_ERROR",
    };
  }
}

export async function getCarissmaFinancialSummaryAction(): Promise<ActionResponse> {
  try {
    const [bookings, expenses, dresses] = await Promise.all([
      prisma.rentalBooking.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.carissmaExpense.findMany({ orderBy: { expenseDate: "desc" } }),
      prisma.dress.findMany(),
    ]);

    const totalRentalsRevenue = bookings.reduce((sum, b) => sum + b.rentalPrice, 0);
    const totalPenaltiesRevenue = bookings.reduce((sum, b) => sum + b.penaltyFee, 0);
    const totalGuaranteesInCustody = bookings.reduce((sum, b) => (b.guaranteeStatus === "En Custodia" ? sum + b.guaranteeAmount : sum), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const totalAcquisitionAssetValue = dresses.reduce((sum, d) => sum + d.acquisitionCost, 0);
    const netProfit = totalRentalsRevenue + totalPenaltiesRevenue - totalExpenses;

    return {
      success: true,
      data: {
        totalRentalsRevenue,
        totalPenaltiesRevenue,
        totalGuaranteesInCustody,
        totalExpenses,
        totalAcquisitionAssetValue,
        netProfit,
        totalBookingsCount: bookings.length,
        totalDressesCount: dresses.length,
        recentBookings: bookings.slice(0, 10),
        recentExpenses: expenses.slice(0, 10),
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener resumen financiero";
    return {
      success: false,
      error: errorMessage,
      code: "FINANCIAL_SUMMARY_ERROR",
    };
  }
}

