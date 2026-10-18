import { z } from "zod";

export const CRMClientSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  favoriteFlower: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  totalSpent: z.number().default(0),
  purchaseCount: z.number().int().default(0),
  loyaltyTier: z.string().default("Bronce"),
  lastPurchaseAt: z.union([z.date(), z.string()]).nullable().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  events: z.array(z.any()).optional(),
  campaigns: z.array(z.any()).optional(),
});
export type CRMClientItem = z.infer<typeof CRMClientSchema>;

export const CRMSpecialEventSchema = z.object({
  id: z.string(),
  clientId: z.string().nullable().optional(),
  title: z.string(),
  eventType: z.string(),
  eventDate: z.union([z.date(), z.string()]),
  description: z.string().nullable().optional(),
  promo: z.string().nullable().optional(),
  createdAt: z.union([z.date(), z.string()]).optional(),
  client: CRMClientSchema.nullable().optional(),
});
export type CRMSpecialEventItem = z.infer<typeof CRMSpecialEventSchema>;

export const LoyaltyConfigSchema = z.object({
  id: z.string().default("default"),
  targetCount: z.number().int().default(5),
  rewardText: z.string().default("1 Ramo Gratis"),
  minSpent: z.number().default(0),
});
export type LoyaltyConfigData = z.infer<typeof LoyaltyConfigSchema>;

export const CRMClientSuggestionSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  purchaseCount: z.number().int(),
  loyaltyTier: z.string(),
});
export type CRMClientSuggestion = z.infer<typeof CRMClientSuggestionSchema>;
