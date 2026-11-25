"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { ActionResponse } from "@/types/action-response";
import { calculateLoyaltyTier, sanitizeClientPhoneAndName, buildPhoneLookupCandidates } from "@/lib/crm-utils";
import { getBoliviaDateStr, extractCalendarDateStr } from "@/lib/utils";

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
  defaultRentalDays: z.number().int().min(1, "Los días de alquiler deben ser al menos 1").optional(),
  defaultGuaranteePercent: z.number().min(0).max(100, "El porcentaje de garantía debe estar entre 0 y 100").optional(),
  decayRatePerUsage: z.number().min(0).max(50, "La tasa de depreciación debe estar entre 0% y 50%").optional(),
  minPriceFloorPercent: z.number().min(10).max(100, "El piso mínimo debe ser al menos 10%").optional(),
  lateFeePerDay: z.number().min(0, "La penalización diaria no puede ser negativa").optional(),
  storeName: z.string().optional().nullable(),
  storeSubtitle: z.string().optional().nullable(),
  storeAddress: z.string().optional().nullable(),
  storeCity: z.string().optional().nullable(),
  storePhone: z.string().optional().nullable(),
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
  nextDressStatus: z
    .enum(["Devuelto / Revisión", "En Lavandería", "Disponible", "Requiere Mantenimiento"])
    .default("En Lavandería"),
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

    const bookingsCount = await prisma.rentalBooking.count({ where: { dressId: id } });
    if (bookingsCount > 0) {
      return {
        success: false,
        error:
          "No se puede eliminar un vestido que tiene contratos o reservas registradas en el historial contable. Puedes marcarlo en Mantenimiento o Lavandería.",
        code: "DRESS_HAS_BOOKINGS",
      };
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
        defaultRentalDays: parsed.data.defaultRentalDays ?? 3,
        defaultGuaranteePercent: parsed.data.defaultGuaranteePercent ?? 30.0,
        decayRatePerUsage: parsed.data.decayRatePerUsage ?? 5.0,
        minPriceFloorPercent: parsed.data.minPriceFloorPercent ?? 40.0,
        lateFeePerDay: parsed.data.lateFeePerDay ?? 50.0,
        storeName: parsed.data.storeName ?? null,
        storeSubtitle: parsed.data.storeSubtitle ?? null,
        storeAddress: parsed.data.storeAddress ?? null,
        storeCity: parsed.data.storeCity ?? null,
        storePhone: parsed.data.storePhone ?? null,
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

    const contractNumber = `ALQ-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const startYmd = extractCalendarDateStr(rentalStartDate);
    const endYmd = extractCalendarDateStr(rentalEndDate);
    if (endYmd < startYmd) {
      return {
        success: false,
        error: "La fecha de devolución no puede ser anterior a la fecha de inicio de renta.",
        code: "INVALID_DATE_RANGE",
      };
    }

    const todayYmd = getBoliviaDateStr();
    if (startYmd <= todayYmd && (dress.status === "En Lavandería" || dress.condition === "Requiere Mantenimiento")) {
      return {
        success: false,
        error: `La prenda "${dress.name}" se encuentra actualmente en ${
          dress.condition === "Requiere Mantenimiento" ? "Mantenimiento" : "Lavandería"
        } para entrega inmediata.`,
        code: "DRESS_UNAVAILABLE_TODAY",
      };
    }

    // Store at 12:00:00.000Z (08:00 AM Bolivia) so date never shifts -1 day in UTC-4
    const startDt = new Date(`${startYmd}T12:00:00.000Z`);
    const endDt = new Date(`${endYmd}T12:00:00.000Z`);
    const overlapStartBound = new Date(`${startYmd}T00:00:00.000Z`);
    const overlapEndBound = new Date(`${endYmd}T23:59:59.999Z`);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Anti-overbooking: check if there's an active booking that overlaps with the requested calendar dates
      const overlappingBooking = await tx.rentalBooking.findFirst({
        where: {
          dressId,
          rentalStatus: { notIn: ["Finalizado"] },
          OR: [
            {
              rentalStartDate: { lte: overlapEndBound },
              rentalEndDate: { gte: overlapStartBound },
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

      // 4. Update Dress status to 'Reservado' only if currently 'Disponible'
      if (dress.status === "Disponible") {
        await tx.dress.update({
          where: { id: dressId },
          data: { status: "Reservado" },
        });
      }

      // 5. Update Shift sales and PHYSICAL cash guarantee in custody if open
      if (currentShift) {
        await tx.carissmaCashShift.update({
          where: { id: currentShift.id },
          data: {
            totalSalesCash: paymentMethod === "Efectivo" ? { increment: rentalPrice } : undefined,
            totalSalesQR: paymentMethod === "QR" ? { increment: rentalPrice } : undefined,
            totalSalesCard: paymentMethod === "Tarjeta" ? { increment: rentalPrice } : undefined,
            totalGuaranteesInCustody:
              paymentMethod === "Efectivo" && guaranteeAmount > 0 ? { increment: guaranteeAmount } : undefined,
          },
        });
      }

      // 6. Sync or create CRM Client record strictly isolated to Carissma environment
      const sanitized = sanitizeClientPhoneAndName(clientPhone || "", clientName);
      const cleanPhone = sanitized.phone;
      const cleanClientName = sanitized.name;

      if (cleanPhone && cleanPhone.length >= 6) {
        const phoneCandidates = buildPhoneLookupCandidates(cleanPhone);
        const existingClient = await tx.cRMClient.findFirst({
          where: {
            environment: "carissma",
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
              environment: "carissma",
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

      const wasBeforeDelivery =
        booking.rentalStatus === "Reservado" || booking.rentalStatus === "En Prueba";

      // Mirror dress status cleanly across both forward and backward transitions
      if (newStatus === "Reservado" || newStatus === "En Prueba") {
        await tx.dress.update({
          where: { id: booking.dressId },
          data: { status: "Reservado" },
        });
      } else if (newStatus === "Entregado") {
        await tx.dress.update({
          where: { id: booking.dressId },
          data: {
            status: "En Uso",
            ...(wasBeforeDelivery ? { timesUsed: { increment: 1 } } : {}),
          },
        });
      } else if (newStatus === "Devuelto / Revisión") {
        await tx.dress.update({
          where: { id: booking.dressId },
          data: { status: "En Lavandería" },
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

    const wasInCustody = booking.guaranteeStatus === "En Custodia";
    const effectivePenalty =
      guaranteeStatus === "Retenida Total"
        ? Math.max(penaltyFee || 0, booking.guaranteeAmount)
        : guaranteeStatus === "Devuelta"
        ? 0
        : penaltyFee || 0;

    const nextBookingStatus =
      nextDressStatus === "Devuelto / Revisión"
        ? "Devuelto / Revisión"
        : nextDressStatus === "En Lavandería" || nextDressStatus === "Requiere Mantenimiento"
        ? "En Lavandería"
        : "Finalizado";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Current open shift for Carissma
      const currentShift = await tx.carissmaCashShift.findFirst({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
      });

      // 2. Update RentalBooking with accurate penaltyFee
      const updatedBooking = await tx.rentalBooking.update({
        where: { id: bookingId },
        data: {
          actualReturnDate: new Date(),
          penaltyFee: effectivePenalty,
          guaranteeStatus,
          rentalStatus: nextBookingStatus,
          notes: notes ? (booking.notes ? `${booking.notes} | ${notes}` : notes) : booking.notes,
        },
      });

      // 3. Update Dress status (check if other active bookings exist before setting Disponible)
      const otherActive = await tx.rentalBooking.findFirst({
        where: {
          id: { not: bookingId },
          dressId: booking.dressId,
          rentalStatus: { not: "Finalizado" },
        },
      });

      const resolvedDressStatus =
        nextDressStatus === "Disponible"
          ? otherActive
            ? "Reservado"
            : "Disponible"
          : "En Lavandería";

      await tx.dress.update({
        where: { id: booking.dressId },
        data: {
          status: resolvedDressStatus,
          condition: nextDressStatus === "Requiere Mantenimiento" ? "Requiere Mantenimiento" : undefined,
        },
      });

      // 4. Update physical cash shift balances ONLY once when guarantee leaves 'En Custodia'
      if (currentShift && wasInCustody && booking.paymentMethod === "Efectivo") {
        const g = booking.guaranteeAmount;
        const returnedCash =
          guaranteeStatus === "Devuelta"
            ? g
            : guaranteeStatus === "Retenida Parcial"
            ? Math.max(0, g - effectivePenalty)
            : 0;

        const isSameShift = booking.shiftId === currentShift.id;
        const custodyDecrement = isSameShift ? Math.min(g, effectivePenalty) : 0;
        const cashPenaltyIncrement = isSameShift ? effectivePenalty : Math.max(0, effectivePenalty - g);

        await tx.carissmaCashShift.update({
          where: { id: currentShift.id },
          data: {
            totalGuaranteesInCustody:
              custodyDecrement > 0
                ? Math.max(0, currentShift.totalGuaranteesInCustody - custodyDecrement)
                : undefined,
            totalGuaranteesReturned: returnedCash > 0 ? { increment: returnedCash } : undefined,
            totalPenalties: cashPenaltyIncrement > 0 ? { increment: cashPenaltyIncrement } : undefined,
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
    if (!booking) {
      return { success: false, error: "Reserva no encontrada o ya eliminada", code: "NOT_FOUND" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete the rental booking
      await tx.rentalBooking.delete({ where: { id } });

      // 2. Revert open shift buckets if booking belonged to an Open shift
      if (booking.shiftId) {
        const shift = await tx.carissmaCashShift.findUnique({ where: { id: booking.shiftId } });
        if (shift && shift.status === "Open") {
          await tx.carissmaCashShift.update({
            where: { id: shift.id },
            data: {
              totalSalesCash:
                booking.paymentMethod === "Efectivo"
                  ? Math.max(0, shift.totalSalesCash - booking.rentalPrice)
                  : undefined,
              totalSalesQR:
                booking.paymentMethod === "QR"
                  ? Math.max(0, shift.totalSalesQR - booking.rentalPrice)
                  : undefined,
              totalSalesCard:
                booking.paymentMethod === "Tarjeta"
                  ? Math.max(0, shift.totalSalesCard - booking.rentalPrice)
                  : undefined,
              totalGuaranteesInCustody:
                booking.paymentMethod === "Efectivo" && booking.guaranteeStatus === "En Custodia"
                  ? Math.max(0, shift.totalGuaranteesInCustody - booking.guaranteeAmount)
                  : undefined,
            },
          });
        }
      }

      // 3. Revert CRMClient stats if clientPhone belonged to a Carissma client
      if (booking.clientPhone) {
        const phoneCandidates = buildPhoneLookupCandidates(booking.clientPhone);
        if (phoneCandidates.length > 0) {
          const client = await tx.cRMClient.findFirst({
            where: { environment: "carissma", phone: { in: phoneCandidates } },
          });
          if (client) {
            const nextCount = Math.max(0, client.purchaseCount - 1);
            await tx.cRMClient.update({
              where: { id: client.id },
              data: {
                purchaseCount: nextCount,
                totalSpent: Math.max(0, client.totalSpent - booking.rentalPrice),
                loyaltyTier: calculateLoyaltyTier(nextCount),
              },
            });
          }
        }
      }

      // 4. Liberate dress and revert timesUsed if it had already been delivered
      const hadBeenUsed = ["Entregado", "Devuelto / Revisión", "En Lavandería", "Finalizado"].includes(
        booking.rentalStatus
      );
      const currentDress = await tx.dress.findUnique({ where: { id: booking.dressId } });
      const otherActive = await tx.rentalBooking.findFirst({
        where: {
          dressId: booking.dressId,
          rentalStatus: { not: "Finalizado" },
        },
      });

      if (currentDress) {
        await tx.dress.update({
          where: { id: booking.dressId },
          data: {
            status: otherActive ? "Reservado" : "Disponible",
            timesUsed: hadBeenUsed ? Math.max(0, currentDress.timesUsed - 1) : undefined,
          },
        });
      }
    });

    return { success: true, data: { id } };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar reserva";
    return { success: false, error: errorMessage, code: "BOOKING_DELETE_ERROR" };
  }
}

export async function deleteCarissmaExpenseAction(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return { success: false, error: "ID de gasto requerido", code: "VALIDATION_ERROR" };
    }
    const existing = await prisma.carissmaExpense.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "Gasto no encontrado", code: "NOT_FOUND" };
    }

    await prisma.$transaction(async (tx) => {
      if (existing.shiftId) {
        const shift = await tx.carissmaCashShift.findUnique({ where: { id: existing.shiftId } });
        if (shift && shift.status === "Open") {
          await tx.carissmaCashShift.update({
            where: { id: shift.id },
            data: { totalExpenses: Math.max(0, shift.totalExpenses - existing.amount) },
          });
        }
      }
      await tx.carissmaExpense.delete({ where: { id } });
    });

    return { success: true, data: { id } };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar gasto";
    return { success: false, error: errorMessage, code: "EXPENSE_DELETE_ERROR" };
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

    const todayStr = getBoliviaDateStr();

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
        bookings,
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

