import { z } from "zod";

export const DressItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  category: z.string().default("Gala"),
  brand: z.string().nullable().optional(),
  color: z.string().default("Negro"),
  size: z.string().default("M"),
  imageUrl: z.string().nullable().optional(),
  baseRentalPrice: z.number().nonnegative().default(450),
  requiredGuarantee: z.number().nonnegative().default(500),
  timesRented: z.number().int().default(0),
  status: z.string().default("Disponible"),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isArchived: z.boolean().default(false),
  createdAt: z.union([z.date(), z.string()]).optional(),
  updatedAt: z.union([z.date(), z.string()]).optional(),
});
export type DressItem = z.infer<typeof DressItemSchema>;

export const RentalBookingSchema = z.object({
  id: z.string(),
  contractNumber: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  customerCi: z.string().nullable().optional(),
  dressId: z.string(),
  rentalStartDate: z.union([z.date(), z.string()]),
  rentalEndDate: z.union([z.date(), z.string()]),
  returnDate: z.union([z.date(), z.string()]).nullable().optional(),
  rentalPrice: z.number().nonnegative(),
  guaranteeAmount: z.number().nonnegative(),
  penaltyAmount: z.number().nonnegative().default(0),
  guaranteeStatus: z.string().default("En Custodia"),
  status: z.string().default("Reservado"),
  notes: z.string().nullable().optional(),
  paymentMethod: z.string().default("Efectivo"),
  cashGiven: z.number().nullable().optional(),
  change: z.number().nullable().optional(),
  dress: DressItemSchema.optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
});
export type BookingItem = z.infer<typeof RentalBookingSchema>;
export type RentalContractBooking = BookingItem;
