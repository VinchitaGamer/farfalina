"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { ActionResponse } from "@/types/action-response";

// -------------------------------------------------------------
// Schemas
// -------------------------------------------------------------

const CreateClientSchema = z.object({
  name: z.string().min(2, "El nombre es requerido"),
  phone: z.string().min(6, "El teléfono es requerido"),
  favoriteFlower: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

const UpdateClientSchema = z.object({
  id: z.string().min(1, "ID requerido"),
  name: z.string().min(2, "El nombre es requerido"),
  phone: z.string().min(6, "El teléfono es requerido"),
  favoriteFlower: z.string().optional(),
  notes: z.string().optional(),
});

export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;

const CreateSpecialEventSchema = z.object({
  clientId: z.string().optional(),
  title: z.string().min(2, "El título del evento es requerido"),
  eventType: z.string().min(1, "El tipo de evento es requerido"),
  eventDate: z.string().min(1, "La fecha del evento es requerida"),
  description: z.string().optional(),
  promo: z.string().optional(),
});

export type CreateSpecialEventInput = z.infer<typeof CreateSpecialEventSchema>;

const ContentCampaignSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2, "El título de la pieza de contenido es requerido"),
  funnelStage: z.enum([
    "Descubrimiento/Conciencia",
    "Consideración/Interés",
    "Conversión/Acción",
    "Fidelización",
  ]),
  socialNetwork: z.enum(["Instagram", "Facebook", "TikTok", "WhatsApp", "Otra"]),
  format: z.enum(["Post", "Reel", "Story", "Live", "Ads", "Colaboración"]),
  summary: z.string().optional(),
  cost: z.number().nonnegative().optional().default(0),
  results: z.string().optional(),
  viewsCount: z.number().int().nonnegative().optional().default(0),
  conversionsCount: z.number().int().nonnegative().optional().default(0),
  startDate: z.string().min(1, "La fecha de inicio es requerida"),
  durationDays: z.number().int().min(1, "La duración mínima es de 1 día").default(1),
  responsible: z.string().min(2, "El responsable o creador es requerido"),
  color: z.string().default("#E07A5F"),
  status: z.enum(["Planificado", "En Producción", "Publicado", "Concluido"]).default("Planificado"),
  clientId: z.string().optional().nullable(),
});

export type ContentCampaignInput = z.infer<typeof ContentCampaignSchema>;

const LoyaltyConfigSchema = z.object({
  targetCount: z.number().int().min(1, "La meta debe ser de al menos 1 compra"),
  rewardText: z.string().min(2, "El texto del beneficio es requerido"),
  minSpent: z.number().nonnegative().optional().default(0),
});

export type LoyaltyConfigInput = z.infer<typeof LoyaltyConfigSchema>;

// -------------------------------------------------------------
// Server Actions
// -------------------------------------------------------------

export async function getCRMDataAction(): Promise<ActionResponse> {
  try {
    const clients = await prisma.cRMClient.findMany({
      include: {
        events: true,
        campaigns: true,
      },
      orderBy: { purchaseCount: "desc" },
    });

    const events = await prisma.cRMSpecialEvent.findMany({
      include: { client: true },
      orderBy: { eventDate: "asc" },
    });

    const campaigns = await prisma.contentCampaign.findMany({
      include: { client: true },
      orderBy: { startDate: "asc" },
    });

    let loyaltyConfig = await prisma.loyaltyConfig.findUnique({
      where: { id: "default" },
    });

    if (!loyaltyConfig) {
      loyaltyConfig = await prisma.loyaltyConfig.create({
        data: {
          id: "default",
          targetCount: 5,
          rewardText: "1 Ramo Gratis",
          minSpent: 0,
        },
      });
    }

    return {
      success: true,
      data: {
        clients,
        events,
        campaigns,
        loyaltyConfig,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener datos de CRM y Marketing";
    return {
      success: false,
      error: errorMessage,
      code: "CRM_FETCH_ERROR",
    };
  }
}



export async function searchCRMClientsAction(query: string = ""): Promise<ActionResponse> {
  try {
    const q = (query || "").trim();
    if (!q) {
      const clients = await prisma.cRMClient.findMany({
        take: 8,
        orderBy: { purchaseCount: "desc" },
      });
      return { success: true, data: clients };
    }

    const clients = await prisma.cRMClient.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { phone: { contains: q } },
        ],
      },
      take: 8,
      orderBy: { purchaseCount: "desc" },
    });

    return {
      success: true,
      data: clients,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al buscar clientes",
      code: "CRM_SEARCH_ERROR",
    };
  }
}


export async function updateLoyaltyConfigAction(rawInput: LoyaltyConfigInput): Promise<ActionResponse> {
  try {
    const parsed = LoyaltyConfigSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Configuración inválida",
        code: "VALIDATION_ERROR",
      };
    }

    const updated = await prisma.loyaltyConfig.upsert({
      where: { id: "default" },
      update: {
        targetCount: parsed.data.targetCount,
        rewardText: parsed.data.rewardText,
        minSpent: parsed.data.minSpent || 0,
      },
      create: {
        id: "default",
        targetCount: parsed.data.targetCount,
        rewardText: parsed.data.rewardText,
        minSpent: parsed.data.minSpent || 0,
      },
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al guardar configuración de fidelización",
      code: "LOYALTY_CONFIG_UPDATE_ERROR",
    };
  }
}

export async function createCRMClientAction(rawInput: CreateClientInput): Promise<ActionResponse> {
  try {
    const parsed = CreateClientSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de cliente inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { name, phone, favoriteFlower, notes } = parsed.data;
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 6) {
      return {
        success: false,
        error: "El número de teléfono debe contener al menos 6 dígitos.",
        code: "INVALID_PHONE",
      };
    }

    const existing = await prisma.cRMClient.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      const updated = await prisma.cRMClient.update({
        where: { id: existing.id },
        data: {
          name: name.trim(),
          favoriteFlower: favoriteFlower?.trim() || existing.favoriteFlower,
          notes: notes ? (existing.notes ? `${existing.notes} | ${notes.trim()}` : notes.trim()) : existing.notes,
        },
      });
      return {
        success: true,
        data: updated,
      };
    }

    const newClient = await prisma.cRMClient.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        favoriteFlower: favoriteFlower?.trim() || null,
        notes: notes?.trim() || null,
        totalSpent: 0,
        purchaseCount: 0,
        loyaltyTier: "Bronce",
      },
    });

    return {
      success: true,
      data: newClient,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al registrar cliente",
      code: "CLIENT_CREATE_ERROR",
    };
  }
}

export async function updateCRMClientAction(rawInput: UpdateClientInput): Promise<ActionResponse> {
  try {
    const parsed = UpdateClientSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de cliente inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { id, name, phone, favoriteFlower, notes } = parsed.data;
    const cleanPhone = phone.replace(/\D/g, "");

    const updated = await prisma.cRMClient.update({
      where: { id },
      data: {
        name: name.trim(),
        phone: cleanPhone || phone,
        favoriteFlower: favoriteFlower?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar cliente",
      code: "CLIENT_UPDATE_ERROR",
    };
  }
}

export async function deleteCRMClientAction(clientId: string): Promise<ActionResponse> {
  try {
    await prisma.cRMClient.delete({
      where: { id: clientId },
    });

    return {
      success: true,
      data: { id: clientId },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar cliente",
      code: "CLIENT_DELETE_ERROR",
    };
  }
}

export async function createContentCampaignAction(rawInput: ContentCampaignInput): Promise<ActionResponse> {
  try {
    const parsed = ContentCampaignSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de contenido/campaña inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const {
      title,
      funnelStage,
      socialNetwork,
      format,
      summary,
      cost,
      results,
      viewsCount,
      conversionsCount,
      startDate,
      durationDays,
      responsible,
      color,
      status,
      clientId,
    } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + (durationDays - 1));

    const campaign = await prisma.contentCampaign.create({
      data: {
        title,
        funnelStage,
        socialNetwork,
        format,
        summary: summary || null,
        cost: cost || 0,
        results: results || null,
        viewsCount: viewsCount || 0,
        conversionsCount: conversionsCount || 0,
        startDate: start,
        endDate: end,
        durationDays,
        responsible,
        color: color || "#E07A5F",
        status: status || "Planificado",
        clientId: clientId || null,
      },
      include: { client: true },
    });

    return {
      success: true,
      data: campaign,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al crear pieza de contenido / campaña",
      code: "CONTENT_CAMPAIGN_CREATE_ERROR",
    };
  }
}

export async function updateContentCampaignAction(rawInput: ContentCampaignInput): Promise<ActionResponse> {
  try {
    const parsed = ContentCampaignSchema.safeParse(rawInput);
    if (!parsed.success || !parsed.data.id) {
      return {
        success: false,
        error: parsed.success ? "ID de campaña requerido" : parsed.error.issues[0]?.message,
        code: "VALIDATION_ERROR",
      };
    }

    const {
      id,
      title,
      funnelStage,
      socialNetwork,
      format,
      summary,
      cost,
      results,
      viewsCount,
      conversionsCount,
      startDate,
      durationDays,
      responsible,
      color,
      status,
      clientId,
    } = parsed.data;

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + (durationDays - 1));

    const updated = await prisma.contentCampaign.update({
      where: { id },
      data: {
        title,
        funnelStage,
        socialNetwork,
        format,
        summary: summary || null,
        cost: cost || 0,
        results: results || null,
        viewsCount: viewsCount || 0,
        conversionsCount: conversionsCount || 0,
        startDate: start,
        endDate: end,
        durationDays,
        responsible,
        color: color || "#E07A5F",
        status: status || "Planificado",
        clientId: clientId || null,
      },
      include: { client: true },
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar pieza de contenido / campaña",
      code: "CONTENT_CAMPAIGN_UPDATE_ERROR",
    };
  }
}

export async function deleteContentCampaignAction(campaignId: string): Promise<ActionResponse> {
  try {
    await prisma.contentCampaign.delete({
      where: { id: campaignId },
    });

    return {
      success: true,
      data: { id: campaignId },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar pieza de contenido",
      code: "CONTENT_CAMPAIGN_DELETE_ERROR",
    };
  }
}

export async function createSpecialEventAction(rawInput: CreateSpecialEventInput): Promise<ActionResponse> {
  try {
    const parsed = CreateSpecialEventSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del evento inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { clientId, title, eventType, eventDate, description, promo } = parsed.data;

    const newEvent = await prisma.cRMSpecialEvent.create({
      data: {
        clientId: clientId || null,
        title,
        eventType,
        eventDate: new Date(eventDate),
        description,
        promo,
      },
      include: { client: true },
    });

    return {
      success: true,
      data: newEvent,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al registrar evento especial",
      code: "EVENT_CREATE_ERROR",
    };
  }
}

// Aliases for convenience
export async function createCRMSpecialEventAction(input: Parameters<typeof createSpecialEventAction>[0]) {
  return createSpecialEventAction(input);
}

export async function deleteSpecialEventAction(eventId: string): Promise<ActionResponse> {
  try {
    await prisma.cRMSpecialEvent.delete({
      where: { id: eventId },
    });

    return {
      success: true,
      data: { id: eventId },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al eliminar evento especial",
      code: "EVENT_DELETE_ERROR",
    };
  }
}

export async function deleteCRMSpecialEventAction(eventId: string) {
  return deleteSpecialEventAction(eventId);
}
