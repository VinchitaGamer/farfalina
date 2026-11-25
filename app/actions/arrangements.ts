"use server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { ActionResponse } from "@/types/action-response";
import { getBoliviaDateStr, extractCalendarDateStr } from "@/lib/utils";

const ImageStringSchema = z
  .string()
  .min(1, "La URL de imagen es requerida")
  .refine(
    (v) =>
      v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("/") ||
      v.startsWith("data:image/"),
    "Debe ingresar una URL válida de imagen (https://...)"
  );

const CreateArrangementSchema = z.object({
  name: z.string().min(2, "El nombre del arreglo es requerido"),
  category: z.string().min(1, "La categoría es requerida"),
  price: z.number().positive("El precio debe ser positivo"),
  featured: z.boolean().default(false),
  image: ImageStringSchema,
  description: z.string().optional().default("").transform((v) => v.trim() || "Arreglo floral Florería Farfalina"),
  recipeItems: z
    .array(
      z.object({
        rawIngredientId: z.string(),
        quantityNeeded: z.number().int().positive(),
      })
    )
    .optional()
    .default([]),
});

export type CreateArrangementInput = z.input<typeof CreateArrangementSchema>;

export async function getArrangementsAction(): Promise<ActionResponse> {
  try {
    const arrangements = await prisma.arrangement.findMany({
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
      data: arrangements,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener arreglos";
    return {
      success: false,
      error: errorMessage,
      code: "ARRANGEMENTS_FETCH_ERROR",
    };
  }
}

export async function getRawIngredientsAction(): Promise<ActionResponse> {
  try {
    const ingredients = await prisma.rawIngredient.findMany({
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: ingredients,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener insumos";
    return {
      success: false,
      error: errorMessage,
      code: "RAW_INGREDIENTS_FETCH_ERROR",
    };
  }
}

const CreateRawIngredientSchema = z.object({
  name: z.string().min(2, "El nombre del insumo es requerido"),
  type: z.string().min(1, "La categoría del insumo es requerida"),
  available: z.number().int().min(0),
  unit: z.string().min(1, "La unidad es requerida"),
  warningThreshold: z.number().int().min(0).default(15),
  costPerUnit: z.number().min(0),
  packageCost: z.number().min(0).nullable().optional(),
  packageCount: z.number().int().min(0).nullable().optional(),
  unitsPerPackage: z.number().int().min(0).nullable().optional(),
  salePrice: z.number().min(0).nullable().optional(),
  entryDate: z.string().optional().transform((val) => (val ? new Date(`${val.split("T")[0]}T12:00:00.000Z`) : new Date())),
  shelfLifeDays: z.number().int().min(0).nullable().optional(),
  recordExpense: z.boolean().optional().default(true),
});

export type CreateRawIngredientInput = z.input<typeof CreateRawIngredientSchema>;

export async function createRawIngredientAction(
  rawInput: CreateRawIngredientInput
): Promise<ActionResponse> {
  try {
    const parsed = CreateRawIngredientSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del insumo inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const {
      name,
      type,
      available,
      unit,
      warningThreshold,
      costPerUnit,
      packageCost,
      packageCount,
      unitsPerPackage,
      salePrice,
      entryDate,
      shelfLifeDays,
      recordExpense,
    } = parsed.data;

    const hasPackageMath =
      typeof packageCost === "number" &&
      packageCost > 0 &&
      typeof packageCount === "number" &&
      packageCount > 0 &&
      typeof unitsPerPackage === "number" &&
      unitsPerPackage > 0;

    const computedUnits = hasPackageMath ? packageCount * unitsPerPackage : available;
    const computedTotalCost = hasPackageMath
      ? Number((packageCost * packageCount).toFixed(2))
      : Number((available * costPerUnit).toFixed(2));
    const computedUnitCost = hasPackageMath
      ? Number((packageCost / unitsPerPackage).toFixed(2))
      : costPerUnit;

    const newIngredient = await prisma.$transaction(async (tx) => {
      const created = await tx.rawIngredient.create({
        data: {
          name: name.trim(),
          type: type.trim(),
          available: computedUnits,
          unit: unit.trim(),
          warningThreshold,
          costPerUnit: computedUnitCost,
          packageCost: packageCost ?? null,
          packageCount: packageCount ?? null,
          unitsPerPackage: unitsPerPackage ?? null,
          salePrice: salePrice ?? null,
          entryDate,
          shelfLifeDays: shelfLifeDays ?? null,
        },
      });

      if (computedUnits > 0 && computedTotalCost > 0) {
        await tx.ingredientPurchaseLog.create({
          data: {
            rawIngredientId: created.id,
            ingredientName: created.name,
            ingredientType: created.type,
            unit: created.unit,
            packageCost: packageCost ?? null,
            packageCount: packageCount ?? null,
            unitsPerPackage: unitsPerPackage ?? null,
            totalUnits: computedUnits,
            unitCost: computedUnitCost,
            totalCost: computedTotalCost,
            salePrice: salePrice ?? null,
            notes: "Registro inicial de insumo",
            purchasedAt: entryDate,
          },
        });

        if (recordExpense) {
          const packageInfo = hasPackageMath
            ? ` (${packageCount} paq × ${unitsPerPackage} ${created.unit} @ ${packageCost} Bs/paq)`
            : ` (${computedUnits} ${created.unit} @ ${computedUnitCost} Bs/u)`;
          await tx.financialExpense.create({
            data: {
              category: "Insumos/Proveedores",
              amount: computedTotalCost,
              description: `Compra inventario: ${created.name}${packageInfo}`,
              expenseDate: entryDate,
            },
          });
        }
      }

      return created;
    });

    return {
      success: true,
      data: newIngredient,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al agregar insumo al inventario";
    return {
      success: false,
      error: errorMessage,
      code: "INGREDIENT_CREATE_ERROR",
    };
  }
}

const UpdateRawIngredientSchema = z.object({
  id: z.string().min(1, "ID de insumo requerido"),
  name: z.string().min(2, "El nombre del insumo es requerido"),
  type: z.string().min(1, "La categoría del insumo es requerida"),
  available: z.number().int().min(0),
  unit: z.string().min(1, "La unidad es requerida"),
  warningThreshold: z.number().int().min(0).default(15),
  costPerUnit: z.number().min(0),
  packageCost: z.number().min(0).nullable().optional(),
  packageCount: z.number().int().min(0).nullable().optional(),
  unitsPerPackage: z.number().int().min(0).nullable().optional(),
  salePrice: z.number().min(0).nullable().optional(),
  entryDate: z.string().optional().transform((val) => (val ? new Date(`${val.split("T")[0]}T12:00:00.000Z`) : undefined)),
  shelfLifeDays: z.number().int().min(0).nullable().optional(),
});

export type UpdateRawIngredientInput = z.input<typeof UpdateRawIngredientSchema>;

export async function updateRawIngredientAction(
  rawInput: UpdateRawIngredientInput
): Promise<ActionResponse> {
  try {
    const parsed = UpdateRawIngredientSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del insumo inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const {
      id,
      name,
      type,
      available,
      unit,
      warningThreshold,
      costPerUnit,
      packageCost,
      packageCount,
      unitsPerPackage,
      salePrice,
      entryDate,
      shelfLifeDays,
    } = parsed.data;

    const updated = await prisma.rawIngredient.update({
      where: { id },
      data: {
        name: name.trim(),
        type: type.trim(),
        available,
        unit: unit.trim(),
        warningThreshold,
        costPerUnit,
        packageCost: packageCost ?? null,
        packageCount: packageCount ?? null,
        unitsPerPackage: unitsPerPackage ?? null,
        salePrice: salePrice ?? null,
        ...(entryDate ? { entryDate } : {}),
        shelfLifeDays: shelfLifeDays ?? null,
      },
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar insumo";
    return {
      success: false,
      error: errorMessage,
      code: "INGREDIENT_UPDATE_ERROR",
    };
  }
}

const RestockRawIngredientSchema = z.object({
  id: z.string().min(1, "ID de insumo no provisto"),
  quantityToAdd: z.number().int().positive("La cantidad a reabastecer debe ser mayor a 0"),
  newCostPerUnit: z.number().min(0).optional(),
  packageCost: z.number().min(0).nullable().optional(),
  packageCount: z.number().int().min(0).nullable().optional(),
  unitsPerPackage: z.number().int().min(0).nullable().optional(),
  newSalePrice: z.number().min(0).nullable().optional(),
  newShelfLifeDays: z.number().int().min(0).nullable().optional(),
  recordExpense: z.boolean().optional().default(true),
});

export type RestockRawIngredientInput = z.input<typeof RestockRawIngredientSchema>;

export async function restockRawIngredientAction(
  rawInput: RestockRawIngredientInput
): Promise<ActionResponse> {
  try {
    const parsed = RestockRawIngredientSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de re-stock inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const {
      id,
      quantityToAdd,
      newCostPerUnit,
      packageCost,
      packageCount,
      unitsPerPackage,
      newSalePrice,
      newShelfLifeDays,
      recordExpense,
    } = parsed.data;

    const existing = await prisma.rawIngredient.findUnique({ where: { id } });
    if (!existing) {
      return {
        success: false,
        error: "Insumo no encontrado",
        code: "NOT_FOUND",
      };
    }

    const hasPackageMath =
      typeof packageCost === "number" &&
      packageCost > 0 &&
      typeof packageCount === "number" &&
      packageCount > 0 &&
      typeof unitsPerPackage === "number" &&
      unitsPerPackage > 0;

    const unitsAdded = hasPackageMath ? packageCount * unitsPerPackage : quantityToAdd;
    const unitCostUsed = hasPackageMath
      ? Number((packageCost / unitsPerPackage).toFixed(2))
      : newCostPerUnit !== undefined && newCostPerUnit > 0
      ? newCostPerUnit
      : existing.costPerUnit;
    const totalCost = hasPackageMath
      ? Number((packageCost * packageCount).toFixed(2))
      : Number((unitsAdded * unitCostUsed).toFixed(2));

    const updated = await prisma.$transaction(async (tx) => {
      const ing = await tx.rawIngredient.update({
        where: { id },
        data: {
          available: { increment: unitsAdded },
          entryDate: new Date(),
          costPerUnit: unitCostUsed,
          ...(packageCost !== undefined && { packageCost }),
          ...(packageCount !== undefined && { packageCount }),
          ...(unitsPerPackage !== undefined && { unitsPerPackage }),
          ...(newSalePrice !== undefined && { salePrice: newSalePrice }),
          ...(newShelfLifeDays !== undefined && { shelfLifeDays: newShelfLifeDays }),
        },
      });

      if (unitsAdded > 0 && totalCost > 0) {
        await tx.ingredientPurchaseLog.create({
          data: {
            rawIngredientId: ing.id,
            ingredientName: ing.name,
            ingredientType: ing.type,
            unit: ing.unit,
            packageCost: packageCost ?? null,
            packageCount: packageCount ?? null,
            unitsPerPackage: unitsPerPackage ?? null,
            totalUnits: unitsAdded,
            unitCost: unitCostUsed,
            totalCost,
            salePrice: newSalePrice ?? ing.salePrice ?? null,
            notes: "Re-Stock de inventario",
            purchasedAt: new Date(),
          },
        });

        if (recordExpense) {
          const packageInfo = hasPackageMath
            ? ` (${packageCount} paq × ${unitsPerPackage} ${ing.unit} @ ${packageCost} Bs/paq)`
            : ` (+${unitsAdded} ${ing.unit} @ ${unitCostUsed} Bs/u)`;
          await tx.financialExpense.create({
            data: {
              category: "Insumos/Proveedores",
              amount: totalCost,
              description: `Re-Stock inventario: ${ing.name}${packageInfo}`,
              expenseDate: new Date(),
            },
          });
        }
      }

      return ing;
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al reabastecer insumo";
    return {
      success: false,
      error: errorMessage,
      code: "RESTOCK_ERROR",
    };
  }
}

export async function deleteRawIngredientAction(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return {
        success: false,
        error: "ID de insumo no provisto",
        code: "VALIDATION_ERROR",
      };
    }

    await prisma.$transaction([
      prisma.arrangementRecipeItem.deleteMany({ where: { rawIngredientId: id } }),
      prisma.orderRecipeItem.deleteMany({ where: { rawIngredientId: id } }),
      prisma.mermaLog.deleteMany({ where: { rawIngredientId: id } }),
      prisma.rawIngredient.delete({ where: { id } }),
    ]);

    return {
      success: true,
      data: { id },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar el insumo";
    return {
      success: false,
      error: errorMessage,
      code: "INGREDIENT_DELETE_ERROR",
    };
  }
}

const ConsumptionQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  ingredientId: z.string().optional(),
});

export type ConsumptionQueryInput = z.infer<typeof ConsumptionQuerySchema>;

const ConsumptionRowSchema = z.object({
  date: z.string(),
  ingredientId: z.string(),
  ingredientName: z.string(),
  type: z.string(),
  unit: z.string(),
  unitCost: z.number(),
  posSoldQty: z.number(),
  orderUsedQty: z.number(),
  mermaLostQty: z.number(),
  totalQuantity: z.number(),
  totalCostBs: z.number(),
});
export type ConsumptionRow = z.infer<typeof ConsumptionRowSchema>;

const InventoryProductRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  unit: z.string(),
  available: z.number(),
  warningThreshold: z.number(),
  unitCost: z.number(),
  packageCost: z.number().nullable().optional(),
  packageCount: z.number().nullable().optional(),
  unitsPerPackage: z.number().nullable().optional(),
  salePrice: z.number().nullable().optional(),
  entryDate: z.string(),
  shelfLifeDays: z.number().nullable().optional(),
  stockValueBs: z.number(),
  status: z.enum(["Disponible", "Stock Bajo", "Agotado"]),
  posSoldQty: z.number(),
  orderUsedQty: z.number(),
  mermaLostQty: z.number(),
  totalPeriodQuantity: z.number(),
  totalPeriodCostBs: z.number(),
});
export type InventoryProductRow = z.infer<typeof InventoryProductRowSchema>;

const PurchaseHistoryRowSchema = z.object({
  id: z.string(),
  purchasedAt: z.string(),
  ingredientName: z.string(),
  ingredientType: z.string(),
  unit: z.string(),
  packageCost: z.number().nullable(),
  packageCount: z.number().nullable(),
  unitsPerPackage: z.number().nullable(),
  totalUnits: z.number(),
  unitCost: z.number(),
  totalCost: z.number(),
  salePrice: z.number().nullable(),
  notes: z.string().nullable(),
});
export type PurchaseHistoryRow = z.infer<typeof PurchaseHistoryRowSchema>;

const ConsumptionAnalyticsDataSchema = z.object({
  inventoryProducts: z.array(InventoryProductRowSchema),
  rows: z.array(ConsumptionRowSchema),
  purchaseLogs: z.array(PurchaseHistoryRowSchema),
  summary: z.object({
    totalStockUnits: z.number(),
    totalStockValuationBs: z.number(),
    totalProductsCount: z.number(),
    totalLowStockCount: z.number(),
    totalUnits: z.number(),
    totalCostBs: z.number(),
    totalMermas: z.number(),
    totalPurchasedBs: z.number(),
    topConsumedName: z.string(),
  }),
});
export type ConsumptionAnalyticsData = z.infer<typeof ConsumptionAnalyticsDataSchema>;

export async function getIngredientConsumptionAnalyticsAction(
  query?: ConsumptionQueryInput
): Promise<ActionResponse<ConsumptionAnalyticsData>> {
  try {
    const todayYmd = getBoliviaDateStr();
    const [bolYearStr, bolMonthStr] = todayYmd.split("-");
    const bolYear = Number(bolYearStr);
    const bolMonth = Number(bolMonthStr);
    const lastDayOfMonth = new Date(bolYear, bolMonth, 0).getDate();
    const defaultStartYmd = `${bolYearStr}-${bolMonthStr}-01`;
    const defaultEndYmd = `${bolYearStr}-${bolMonthStr}-${String(lastDayOfMonth).padStart(2, "0")}`;

    const start = query?.startDate
      ? new Date(`${query.startDate.split("T")[0]}T00:00:00.000-04:00`)
      : new Date(`${defaultStartYmd}T00:00:00.000-04:00`);
    const end = query?.endDate
      ? new Date(`${query.endDate.split("T")[0]}T23:59:59.999-04:00`)
      : new Date(`${defaultEndYmd}T23:59:59.999-04:00`);

    const ingredients = await prisma.rawIngredient.findMany({
      where: query?.ingredientId ? { id: query.ingredientId } : undefined,
      orderBy: { name: "asc" },
    });

    // 1. Fetch OrderRecipeItems in date range
    const orderItems = await prisma.orderRecipeItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
        },
        ...(query?.ingredientId && { rawIngredientId: query.ingredientId }),
      },
      include: {
        order: { select: { createdAt: true } },
        rawIngredient: true,
      },
    });

    // 2. Fetch MermaLogs in date range
    const mermas = await prisma.mermaLog.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(query?.ingredientId && { rawIngredientId: query.ingredientId }),
      },
      include: {
        rawIngredient: true,
      },
    });

    // 3. Fetch POS Tickets in date range
    const posTickets = await prisma.pOSTicket.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      include: {
        ticketItems: true,
      },
    });

    // 4. Fetch Historical Purchase Logs in date range
    const rawPurchaseLogs = await prisma.ingredientPurchaseLog.findMany({
      where: {
        purchasedAt: { gte: start, lte: end },
        ...(query?.ingredientId && { rawIngredientId: query.ingredientId }),
      },
      orderBy: { purchasedAt: "desc" },
    });

    const purchaseLogs: PurchaseHistoryRow[] = rawPurchaseLogs.map((log) => ({
      id: log.id,
      purchasedAt: extractCalendarDateStr(log.purchasedAt),
      ingredientName: log.ingredientName,
      ingredientType: log.ingredientType,
      unit: log.unit,
      packageCost: log.packageCost ?? null,
      packageCount: log.packageCount ?? null,
      unitsPerPackage: log.unitsPerPackage ?? null,
      totalUnits: log.totalUnits,
      unitCost: log.unitCost,
      totalCost: log.totalCost,
      salePrice: log.salePrice ?? null,
      notes: log.notes ?? null,
    }));
    const totalPurchasedBs = purchaseLogs.reduce((acc, p) => acc + p.totalCost, 0);

    // Accumulators per ingredient ID for the whole period
    const ingPeriodStats = new Map<string, { pos: number; order: number; merma: number }>();
    ingredients.forEach((ing) => {
      ingPeriodStats.set(ing.id, { pos: 0, order: 0, merma: 0 });
    });

    // Aggregate consumption per Date (YYYY-MM-DD) and IngredientId
    const aggregationMap = new Map<string, ConsumptionRow>();

    const getEntry = (dateStr: string, ing: { id: string; name: string; type: string; unit: string; costPerUnit: number }) => {
      const key = `${dateStr}__${ing.id}`;
      if (!aggregationMap.has(key)) {
        aggregationMap.set(key, {
          date: dateStr,
          ingredientId: ing.id,
          ingredientName: ing.name,
          type: ing.type,
          unit: ing.unit,
          unitCost: ing.costPerUnit,
          posSoldQty: 0,
          orderUsedQty: 0,
          mermaLostQty: 0,
          totalQuantity: 0,
          totalCostBs: 0,
        });
      }
      return aggregationMap.get(key)!;
    };

    // Process Orders
    for (const oi of orderItems) {
      if (!oi.rawIngredient) continue;
      const dateStr = getBoliviaDateStr(oi.order.createdAt);
      const entry = getEntry(dateStr, oi.rawIngredient);
      entry.orderUsedQty += oi.quantityNeeded;

      const stat = ingPeriodStats.get(oi.rawIngredient.id);
      if (stat) stat.order += oi.quantityNeeded;
    }

    // Process Mermas
    for (const m of mermas) {
      if (!m.rawIngredient) continue;
      const dateStr = getBoliviaDateStr(m.createdAt);
      const entry = getEntry(dateStr, m.rawIngredient);
      entry.mermaLostQty += m.quantityLost;

      const stat = ingPeriodStats.get(m.rawIngredient.id);
      if (stat) stat.merma += m.quantityLost;
    }

    // Process POS items
    for (const t of posTickets) {
      const dateStr = getBoliviaDateStr(t.createdAt);
      for (const item of t.ticketItems) {
        const matchingIng = ingredients.find(
          (ing) => item.itemName.toLowerCase().includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(item.itemName.toLowerCase())
        );
        if (matchingIng) {
          const entry = getEntry(dateStr, matchingIng);
          entry.posSoldQty += item.quantity;

          const stat = ingPeriodStats.get(matchingIng.id);
          if (stat) stat.pos += item.quantity;
        }
      }
    }

    // Build complete inventory product rows
    let totalStockUnits = 0;
    let totalStockValuationBs = 0;
    let totalLowStockCount = 0;

    const inventoryProducts: InventoryProductRow[] = ingredients.map((ing) => {
      const available = ing.available || 0;
      const costPerUnit = ing.costPerUnit || 0;
      const warningThreshold = ing.warningThreshold || 15;
      const stockValueBs = available * costPerUnit;

      totalStockUnits += available;
      totalStockValuationBs += stockValueBs;

      const isAgotado = available <= 0;
      const isLow = available <= warningThreshold;
      if (isLow) totalLowStockCount++;

      const status: "Disponible" | "Stock Bajo" | "Agotado" = isAgotado ? "Agotado" : isLow ? "Stock Bajo" : "Disponible";

      const stats = ingPeriodStats.get(ing.id) || { pos: 0, order: 0, merma: 0 };
      const totalPeriodQty = stats.pos + stats.order + stats.merma;
      const totalPeriodCost = totalPeriodQty * costPerUnit;

      return {
        id: ing.id,
        name: ing.name,
        type: ing.type || "Flor",
        unit: ing.unit || "uds",
        available,
        warningThreshold,
        unitCost: costPerUnit,
        packageCost: ing.packageCost ?? null,
        packageCount: ing.packageCount ?? null,
        unitsPerPackage: ing.unitsPerPackage ?? null,
        salePrice: ing.salePrice ?? null,
        entryDate: ing.entryDate ? extractCalendarDateStr(ing.entryDate) : todayYmd,
        shelfLifeDays: ing.shelfLifeDays ?? null,
        stockValueBs,
        status,
        posSoldQty: stats.pos,
        orderUsedQty: stats.order,
        mermaLostQty: stats.merma,
        totalPeriodQuantity: totalPeriodQty,
        totalPeriodCostBs: totalPeriodCost,
      };
    });

    // Calculate totals for each row
    const rows = Array.from(aggregationMap.values()).map((r) => {
      const totalQty = r.posSoldQty + r.orderUsedQty + r.mermaLostQty;
      return {
        ...r,
        totalQuantity: totalQty,
        totalCostBs: totalQty * r.unitCost,
      };
    });

    rows.sort((a, b) => b.date.localeCompare(a.date) || a.ingredientName.localeCompare(b.ingredientName));

    const totalUnits = rows.reduce((acc, r) => acc + r.totalQuantity, 0);
    const totalCostBs = rows.reduce((acc, r) => acc + r.totalCostBs, 0);
    const totalMermas = rows.reduce((acc, r) => acc + r.mermaLostQty, 0);

    const ingTotalMap = new Map<string, number>();
    rows.forEach((r) => {
      ingTotalMap.set(r.ingredientName, (ingTotalMap.get(r.ingredientName) || 0) + r.totalQuantity);
    });
    let topConsumedName = "Ninguno";
    let maxConsumed = 0;
    ingTotalMap.forEach((qty, name) => {
      if (qty > maxConsumed) {
        maxConsumed = qty;
        topConsumedName = name;
      }
    });

    return {
      success: true,
      data: {
        inventoryProducts,
        rows,
        purchaseLogs,
        summary: {
          totalStockUnits,
          totalStockValuationBs,
          totalProductsCount: ingredients.length,
          totalLowStockCount,
          totalUnits,
          totalCostBs,
          totalMermas,
          totalPurchasedBs,
          topConsumedName,
        },
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener analítica de consumo";
    return {
      success: false,
      error: errorMessage,
      code: "ANALYTICS_FETCH_ERROR",
    };
  }
}

export async function createArrangementAction(
  rawInput: CreateArrangementInput
): Promise<ActionResponse> {
  try {
    const parsed = CreateArrangementSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del arreglo inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { name, category, price, featured, image, description, recipeItems } = parsed.data;

    const newArrangement = await prisma.arrangement.create({
      data: {
        name,
        category,
        price,
        featured,
        image,
        description,
        recipeItems: {
          create: recipeItems.map((item) => ({
            rawIngredientId: item.rawIngredientId,
            quantityNeeded: item.quantityNeeded,
          })),
        },
      },
      include: {
        recipeItems: {
          include: {
            rawIngredient: true,
          },
        },
      },
    });

    return {
      success: true,
      data: newArrangement,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al crear el arreglo";
    return {
      success: false,
      error: errorMessage,
      code: "ARRANGEMENT_CREATE_ERROR",
    };
  }
}

export async function processArrangementDeductionAction(
  arrangementId: string,
  quantity: number = 1
): Promise<ActionResponse> {
  try {
    if (!arrangementId || quantity <= 0) {
      return {
        success: false,
        error: "ID de arreglo o cantidad inválidos",
        code: "INVALID_INPUT",
      };
    }

    const arrangement = await prisma.arrangement.findUnique({
      where: { id: arrangementId },
      include: { recipeItems: true },
    });

    if (!arrangement) {
      return {
        success: false,
        error: "Arreglo no encontrado",
        code: "NOT_FOUND",
      };
    }

    // Atomic transaction for inventory deduction
    await prisma.$transaction(
      arrangement.recipeItems.map((item) =>
        prisma.rawIngredient.update({
          where: { id: item.rawIngredientId },
          data: {
            available: {
              decrement: item.quantityNeeded * quantity,
            },
          },
        })
      )
    );

    const updatedIngredients = await prisma.rawIngredient.findMany();

    return {
      success: true,
      data: updatedIngredients,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al descontar stock";
    return {
      success: false,
      error: errorMessage,
      code: "STOCK_DEDUCTION_ERROR",
    };
  }
}

const UpdateArrangementSchema = z.object({
  id: z.string().min(1, "ID de arreglo no provisto"),
  name: z.string().min(2, "El nombre del arreglo es requerido"),
  category: z.string().min(1, "La categoría es requerida"),
  price: z.number().positive("El precio debe ser positivo"),
  featured: z.boolean().default(false),
  image: ImageStringSchema,
  description: z.string().optional().default("").transform((v) => v.trim() || "Arreglo floral Florería Farfalina"),
  recipeItems: z
    .array(
      z.object({
        rawIngredientId: z.string(),
        quantityNeeded: z.number().int().positive(),
      })
    )
    .optional(),
});

export type UpdateArrangementInput = z.input<typeof UpdateArrangementSchema>;

export async function updateArrangementAction(
  rawInput: UpdateArrangementInput
): Promise<ActionResponse> {
  try {
    const parsed = UpdateArrangementSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de edición inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { id, name, category, price, featured, image, description, recipeItems } = parsed.data;

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (recipeItems !== undefined) {
        await tx.arrangementRecipeItem.deleteMany({
          where: { arrangementId: id },
        });
      }

      return await tx.arrangement.update({
        where: { id },
        data: {
          name,
          category,
          price,
          featured,
          image,
          description,
          ...(recipeItems !== undefined
            ? {
                recipeItems: {
                  create: recipeItems.map((item) => ({
                    rawIngredientId: item.rawIngredientId,
                    quantityNeeded: item.quantityNeeded,
                  })),
                },
              }
            : {}),
        },
        include: {
          recipeItems: {
            include: {
              rawIngredient: true,
            },
          },
        },
      });
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar el arreglo";
    return {
      success: false,
      error: errorMessage,
      code: "ARRANGEMENT_UPDATE_ERROR",
    };
  }
}

export async function deleteArrangementAction(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return {
        success: false,
        error: "ID de arreglo no provisto",
        code: "VALIDATION_ERROR",
      };
    }

    await prisma.arrangement.delete({
      where: { id },
    });

    return {
      success: true,
      data: { id },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar el arreglo";
    return {
      success: false,
      error: errorMessage,
      code: "ARRANGEMENT_DELETE_ERROR",
    };
  }
}
