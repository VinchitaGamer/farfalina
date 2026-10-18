import { z } from "zod";

export const DeliveryZoneSchema = z.object({
  id: z.string(),
  name: z.string(),
  fee: z.number().nonnegative(),
});
export type DeliveryZone = z.infer<typeof DeliveryZoneSchema>;

export const BusinessBrandConfigSchema = z.object({
  id: z.enum(["farfalina", "carissma"]),
  name: z.string(),
  brandTitle: z.string(),
  subtitle: z.string(),
  nit: z.string(),
  city: z.string(),
  address: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  websiteUrl: z.string(),
  apiUrl: z.string(),
  currency: z.string().default("Bs"),
  defaultCashierName: z.string(),
  defaultInitialCash: z.number().nonnegative(),
  defaultDeliveryFee: z.number().nonnegative().optional(),
  deliveryZones: z.array(DeliveryZoneSchema).optional(),
  // Carissma specific
  defaultRentalPrice: z.number().nonnegative().optional(),
  defaultGuaranteeAmount: z.number().nonnegative().optional(),
  pricingEngine: z
    .object({
      defaultRentalDays: z.number().int().positive(),
      decayRatePerUsage: z.number().nonnegative(),
      minPriceFloorPercent: z.number().nonnegative(),
      lateFeePerDay: z.number().nonnegative(),
    })
    .optional(),
});
export type BusinessBrandConfig = z.infer<typeof BusinessBrandConfigSchema>;

export const FARFALINA_ZONES: DeliveryZone[] = [
  { id: "calacoto", name: "Calacoto, Zona Sur", fee: 20 },
  { id: "achumani", name: "Achumani, Zona Sur", fee: 20 },
  { id: "obrajes", name: "Obrajes, Zona Sur", fee: 20 },
  { id: "san-miguel", name: "San Miguel, Zona Sur", fee: 20 },
  { id: "los-pinos", name: "Los Pinos, Zona Sur", fee: 20 },
  { id: "cota-cota", name: "Cota Cota, Zona Sur", fee: 20 },
  { id: "irpavi", name: "Irpavi, Zona Sur", fee: 20 },
  { id: "sopocachi", name: "Sopocachi", fee: 15 },
  { id: "centro", name: "Centro, La Paz", fee: 15 },
  { id: "miraflores", name: "Miraflores", fee: 15 },
  { id: "san-pedro", name: "San Pedro", fee: 15 },
  { id: "el-alto", name: "Ciudad de El Alto", fee: 25 },
  { id: "pickup", name: "Tienda Central (Retiro)", fee: 0 },
];

export const FARFALINA_CONFIG: BusinessBrandConfig = {
  id: "farfalina",
  name: "Florería Farfalina",
  brandTitle: "FLORERÍA FARFALINA",
  subtitle: "Arte Floral y Momentos Inolvidables",
  nit: "1029384021",
  city: "La Paz, Bolivia",
  address: "Av. Montenegro #1234, San Miguel",
  phone: "(+591) 76543210",
  whatsapp: "+59176543210",
  websiteUrl: "https://floreriafarfalina.bo",
  apiUrl: "https://api.farfalina.bo",
  currency: "Bs",
  defaultCashierName: "Agente Farfalina",
  defaultInitialCash: 350,
  defaultDeliveryFee: 20,
  deliveryZones: FARFALINA_ZONES,
};

export const CARISSMA_CONFIG: BusinessBrandConfig = {
  id: "carissma",
  name: "Carissma Alquileres",
  brandTitle: "CARISSMA",
  subtitle: "Boutique & Alta Costura",
  nit: "1029384021",
  city: "Cochabamba, Bolivia",
  address: "Av. San Martín #450",
  phone: "(+591) 76543210",
  whatsapp: "+59176543210",
  websiteUrl: "https://carissma.bo",
  apiUrl: "https://api.carissma.bo",
  currency: "Bs",
  defaultCashierName: "Agente Carissma",
  defaultInitialCash: 300,
  defaultRentalPrice: 450,
  defaultGuaranteeAmount: 500,
  pricingEngine: {
    defaultRentalDays: 3,
    decayRatePerUsage: 5.0,
    minPriceFloorPercent: 40.0,
    lateFeePerDay: 50.0,
  },
};
