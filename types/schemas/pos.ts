import { z } from "zod";

export const POSTicketItemSchema = z.object({
  id: z.string().optional(),
  itemName: z.string(),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  subtotal: z.number().nonnegative().optional(),
});
export type POSTicketItemData = z.infer<typeof POSTicketItemSchema>;

export const POSTicketSchema = z.object({
  id: z.string().optional(),
  ticketNumber: z.string(),
  customerName: z.string().nullable().optional(),
  customerPhone: z.string().nullable().optional(),
  customerNit: z.string().nullable().optional(),
  totalAmount: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  paymentMethod: z.string().default("Efectivo"),
  cashGiven: z.number().nullable().optional(),
  change: z.number().nullable().optional(),
  cashierName: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  items: z.array(POSTicketItemSchema),
});
export type POSTicketData = z.infer<typeof POSTicketSchema>;

export const ShiftReportDataSchema = z.object({
  shiftId: z.string().optional(),
  cashierName: z.string(),
  openedAt: z.union([z.date(), z.string()]),
  closedAt: z.union([z.date(), z.string()]).nullable().optional(),
  openingBalance: z.number().nonnegative(),
  totalSalesCash: z.number().nonnegative(),
  totalSalesQR: z.number().nonnegative().default(0),
  totalSalesCard: z.number().nonnegative().default(0),
  totalExpenses: z.number().nonnegative().default(0),
  theoreticalCash: z.number().nonnegative(),
  declaredCash: z.number().nonnegative(),
  discrepancy: z.number().default(0),
  tickets: z
    .array(
      z.object({
        ticketNumber: z.string(),
        customerName: z.string().nullable().optional(),
        totalAmount: z.number(),
        paymentMethod: z.string(),
        createdAt: z.union([z.date(), z.string()]),
      })
    )
    .optional(),
});
export type ShiftReportData = z.infer<typeof ShiftReportDataSchema>;

export const CarissmaShiftReportDataSchema = z.object({
  shiftId: z.string().optional(),
  cashierName: z.string(),
  openedAt: z.union([z.date(), z.string()]),
  closedAt: z.union([z.date(), z.string()]).nullable().optional(),
  openingBalance: z.number().nonnegative(),
  totalSalesCash: z.number().nonnegative(),
  totalSalesQR: z.number().nonnegative().default(0),
  totalSalesCard: z.number().nonnegative().default(0),
  totalPenalties: z.number().nonnegative().default(0),
  totalGuaranteesInCustody: z.number().nonnegative().default(0),
  totalGuaranteesReturned: z.number().nonnegative().default(0),
  totalExpenses: z.number().nonnegative().default(0),
  theoreticalCash: z.number().nonnegative(),
  declaredCash: z.number().nonnegative(),
  discrepancy: z.number().default(0),
});
export type CarissmaShiftReportData = z.infer<typeof CarissmaShiftReportDataSchema>;
