"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";

import { ActionResponse } from "@/types/action-response";

const CreateFinancialExpenseSchema = z.object({
  category: z.enum([
    "Luz/Servicios",
    "Sueldos",
    "Gastos Administrativos",
    "Insumos/Proveedores",
    "Mantenimiento",
    "Otros",
  ]),
  amount: z.number().positive("El monto debe ser un valor positivo"),
  description: z.string().min(3, "La descripción debe tener al menos 3 caracteres"),
  expenseDate: z.string().optional().transform((val) => (val ? new Date(val) : new Date())),
});

export type CreateFinancialExpenseInput = z.input<typeof CreateFinancialExpenseSchema>;

export async function createFinancialExpenseAction(
  rawInput: CreateFinancialExpenseInput
): Promise<ActionResponse> {
  try {
    const parsed = CreateFinancialExpenseSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de egreso inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const expense = await prisma.financialExpense.create({
      data: parsed.data,
    });

    return {
      success: true,
      data: expense,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al registrar egreso";
    return {
      success: false,
      error: errorMessage,
      code: "EXPENSE_CREATE_ERROR",
    };
  }
}



export async function getFinancialMetricsAction(): Promise<ActionResponse> {
  try {
    // 1. Total POS Sales
    const posTickets = await prisma.pOSTicket.findMany({
      include: { ticketItems: true },
    });
    const totalPosSales = posTickets.reduce((acc, t) => acc + t.totalAmount, 0);

    // 2. Total Logistics Orders Sales
    const orderDeliveries = await prisma.orderDelivery.findMany({
      include: { recipeItems: { include: { rawIngredient: true } } },
    });
    const totalOrderSales = orderDeliveries.reduce((acc, o) => acc + o.total, 0);

    const totalIncome = totalPosSales + totalOrderSales;

    // 3. Registered Expenses (Luz, Sueldos, Admin, etc.)
    const expenses = await prisma.financialExpense.findMany({
      orderBy: { expenseDate: "desc" },
    });
    const totalExpensesCategory = expenses.reduce((acc: number, e: { amount: number }) => acc + e.amount, 0);

    // 4. Merma Loss
    const mermas = await prisma.mermaLog.findMany({
      include: { rawIngredient: true },
    });
    const totalMermaCost = mermas.reduce(
      (acc, m) => acc + m.quantityLost * (m.rawIngredient?.costPerUnit || 0),
      0
    );

    const totalExpenses = totalExpensesCategory + totalMermaCost;
    const netProfit = totalIncome - totalExpenses;

    // 5. Cash Register Shifts History
    const shifts = await prisma.cashRegisterShift.findMany({
      orderBy: { createdAt: "desc" },
    });

    // 6. Top Selling Arrangements & Products Analysis
    const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    posTickets.forEach((ticket) => {
      ticket.ticketItems.forEach((item) => {
        if (!productSalesMap[item.itemName]) {
          productSalesMap[item.itemName] = { name: item.itemName, quantity: 0, revenue: 0 };
        }
        productSalesMap[item.itemName].quantity += item.quantity;
        productSalesMap[item.itemName].revenue += item.price * item.quantity;
      });
    });

    orderDeliveries.forEach((order) => {
      const name = order.arrangementName || "Arreglo Personalizado";
      if (!productSalesMap[name]) {
        productSalesMap[name] = { name, quantity: 0, revenue: 0 };
      }
      productSalesMap[name].quantity += 1;
      productSalesMap[name].revenue += order.total;
    });

    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 7. Most Used Raw Ingredients Analysis
    const ingredientUsageMap: Record<
      string,
      { id: string; name: string; type: string; unit: string; totalUsed: number; totalCost: number }
    > = {};

    orderDeliveries.forEach((order) => {
      order.recipeItems.forEach((item) => {
        const ingName = item.rawIngredient?.name || "Insumo";
        if (!ingredientUsageMap[item.rawIngredientId]) {
          ingredientUsageMap[item.rawIngredientId] = {
            id: item.rawIngredientId,
            name: ingName,
            type: item.rawIngredient?.type || "General",
            unit: item.rawIngredient?.unit || "unid",
            totalUsed: 0,
            totalCost: 0,
          };
        }
        ingredientUsageMap[item.rawIngredientId].totalUsed += item.quantityNeeded;
        ingredientUsageMap[item.rawIngredientId].totalCost +=
          item.quantityNeeded * (item.rawIngredient?.costPerUnit || item.unitCost || 0);
      });
    });

    const topUsedIngredients = Object.values(ingredientUsageMap)
      .sort((a, b) => b.totalUsed - a.totalUsed)
      .slice(0, 10);

    return {
      success: true,
      data: {
        summary: {
          totalIncome,
          totalPosSales,
          totalOrderSales,
          totalExpensesCategory,
          totalMermaCost,
          totalExpenses,
          netProfit,
        },
        expenses,
        shifts,
        topSellingProducts,
        topUsedIngredients,
        mermas,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al calcular métricas financieras";
    return {
      success: false,
      error: errorMessage,
      code: "METRICS_FETCH_ERROR",
    };
  }
}
