import { z } from "zod";

export const RawIngredientItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  unit: z.string(),
  stockQuantity: z.number(),
  unitCost: z.number().nonnegative(),
  warningThreshold: z.number().default(5),
  createdAt: z.union([z.date(), z.string()]).optional(),
  updatedAt: z.union([z.date(), z.string()]).optional(),
});
export type RawIngredientItem = z.infer<typeof RawIngredientItemSchema>;

export const ArrangementRecipeItemSchema = z.object({
  id: z.string().optional(),
  arrangementId: z.string().optional(),
  rawIngredientId: z.string(),
  quantity: z.number().positive(),
  rawIngredient: RawIngredientItemSchema.optional(),
});
export type ArrangementRecipeItem = z.infer<typeof ArrangementRecipeItemSchema>;

export const ArrangementItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  category: z.string().default("Ramos"),
  price: z.number().nonnegative(),
  imageUrl: z.string().nullable().optional(),
  recipe: z.array(ArrangementRecipeItemSchema).optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
});
export type ArrangementItem = z.infer<typeof ArrangementItemSchema>;
export type ArrangementItemData = ArrangementItem;

export const MermaLogSchema = z.object({
  id: z.string(),
  rawIngredientId: z.string(),
  quantity: z.number().positive(),
  reason: z.string(),
  costLoss: z.number().nonnegative(),
  createdAt: z.union([z.date(), z.string()]),
  rawIngredient: RawIngredientItemSchema.optional(),
});
export type MermaLogItem = z.infer<typeof MermaLogSchema>;
