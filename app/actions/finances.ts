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
  expenseDate: z.string().optional().transform((val) => (val ? new Date(`${val.split("T")[0]}T12:00:00.000Z`) : new Date())),
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

export async function deleteFinancialExpenseAction(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return { success: false, error: "ID de egreso requerido", code: "VALIDATION_ERROR" };
    }
    await prisma.financialExpense.delete({ where: { id } });
    return { success: true, data: { id } };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar egreso";
    return { success: false, error: errorMessage, code: "EXPENSE_DELETE_ERROR" };
  }
}

export async function deletePOSTicketAction(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return { success: false, error: "ID de ticket requerido", code: "VALIDATION_ERROR" };
    }

    const ticket = await prisma.pOSTicket.findUnique({ where: { id } });
    if (!ticket) {
      return { success: false, error: "El ticket no existe o ya fue eliminado", code: "NOT_FOUND" };
    }

    await prisma.$transaction(async (tx) => {
      const activeShift = await tx.cashRegisterShift.findFirst({
        where: { status: "Open" },
        orderBy: { createdAt: "desc" },
      });

      if (activeShift && ticket.createdAt >= activeShift.createdAt) {
        if (ticket.paymentMethod === "Efectivo") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesCash: Math.max(0, activeShift.totalSalesCash - ticket.totalAmount) },
          });
        } else if (ticket.paymentMethod === "QR") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesQR: Math.max(0, activeShift.totalSalesQR - ticket.totalAmount) },
          });
        } else if (ticket.paymentMethod === "Tarjeta") {
          await tx.cashRegisterShift.update({
            where: { id: activeShift.id },
            data: { totalSalesCard: Math.max(0, activeShift.totalSalesCard - ticket.totalAmount) },
          });
        }
      }

      await tx.pOSTicket.delete({ where: { id } });
    });

    return {
      success: true,
      data: { id, ticketNumber: ticket.ticketNumber },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar ticket POS";
    return {
      success: false,
      error: errorMessage,
      code: "POS_TICKET_DELETE_ERROR",
    };
  }
}

export async function getFinancialMetricsAction(): Promise<ActionResponse> {
  try {
    // 1. Fetch all POS Tickets and Logistics Orders
    const [posTickets, orderDeliveries] = await Promise.all([
      prisma.pOSTicket.findMany({
        include: { ticketItems: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.orderDelivery.findMany({
        include: { recipeItems: { include: { rawIngredient: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Build set of ticketNumbers paired to existing OrderDelivery records so unified orders are NEVER double-counted
    const pairedTicketNumbers = new Set<string>();
    for (const order of orderDeliveries) {
      if (order.linkedTicketNumber) {
        pairedTicketNumbers.add(order.linkedTicketNumber);
      }
      if (order.orderNumber.startsWith("PED-")) {
        pairedTicketNumbers.add(`TCK-${order.orderNumber.slice(4)}`);
      }
    }

    const standalonePosTickets = posTickets.filter((t) => !pairedTicketNumbers.has(t.ticketNumber));

    const totalPosSales = standalonePosTickets.reduce((acc, t) => acc + t.totalAmount, 0);
    const totalOrderSales = orderDeliveries.reduce((acc, o) => acc + o.total, 0);
    const totalIncome = totalPosSales + totalOrderSales;

    // 2. Registered Expenses (Luz, Sueldos, Admin, Insumos/Proveedores, etc.)
    const expenses = await prisma.financialExpense.findMany({
      orderBy: { expenseDate: "desc" },
    });
    const totalExpensesCategory = expenses.reduce((acc: number, e: { amount: number }) => acc + e.amount, 0);

    // 3. Merma Loss
    const mermas = await prisma.mermaLog.findMany({
      include: { rawIngredient: true },
      orderBy: { createdAt: "desc" },
    });
    const totalMermaCost = mermas.reduce(
      (acc, m) => acc + m.quantityLost * (m.rawIngredient?.costPerUnit || 0),
      0
    );

    const totalExpenses = totalExpensesCategory + totalMermaCost;
    const netProfit = totalIncome - totalExpenses;

    // 4. Cash Register Shifts History
    const shifts = await prisma.cashRegisterShift.findMany({
      orderBy: { createdAt: "desc" },
    });

    // 5. Top Selling Arrangements & Products Analysis (ZERO double-counting)
    const productSalesMap: Record<string, { name: string; quantity: number; revenue: number }> = {};

    standalonePosTickets.forEach((ticket) => {
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
      productSalesMap[name].revenue += order.salePrice > 0 ? order.salePrice : Math.max(0, order.total - order.deliveryFee);

      if (order.deliveryFee > 0) {
        const delivKey = `Servicio de Delivery (${order.zone})`;
        if (!productSalesMap[delivKey]) {
          productSalesMap[delivKey] = { name: delivKey, quantity: 0, revenue: 0 };
        }
        productSalesMap[delivKey].quantity += 1;
        productSalesMap[delivKey].revenue += order.deliveryFee;
      }
    });

    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // 6. Most Used Raw Ingredients Analysis
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
        posTickets: standalonePosTickets,
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
