import { z } from "zod";

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

export function getEvolutionConfig(environment: string = "farfalina"): EvolutionConfig {
  const normEnv = environment.toLowerCase();
  const defaultUrl = process.env.EVOLUTION_API_URL || "http://localhost:8080";
  const defaultKey = process.env.EVOLUTION_API_KEY || "";
  const instance = normEnv.includes("carissma")
    ? (process.env.EVOLUTION_INSTANCE_CARISSMA || "carissma")
    : (process.env.EVOLUTION_INSTANCE_FARFALINA || "farfalina");

  return {
    apiUrl: defaultUrl.replace(/\/+$/, ""),
    apiKey: defaultKey,
    instance,
  };
}

export const EvolutionSendResponseSchema = z.object({
  key: z.object({
    id: z.string().optional(),
    remoteJid: z.string().optional(),
    fromMe: z.boolean().optional(),
  }).optional(),
  status: z.string().optional(),
  message: z.unknown().optional(),
}).passthrough();

export async function sendEvolutionTextMessage(params: {
  to: string;
  text: string;
  environment?: string;
  configOverride?: Partial<EvolutionConfig>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = { ...getEvolutionConfig(params.environment), ...params.configOverride };
    if (!config.apiUrl) {
      return { success: false, error: "Evolution API URL no configurada" };
    }

    // Clean destination phone to numeric digits
    const cleanNumber = params.to.replace(/\D/g, "");
    if (!cleanNumber) {
      return { success: false, error: "Número telefónico inválido para Evolution API" };
    }

    const endpoint = `${config.apiUrl}/message/sendText/${config.instance}`;
    const payload = {
      number: cleanNumber,
      options: {
        delay: 500,
        presence: "composing",
        linkPreview: false,
      },
      textMessage: {
        text: params.text,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { apikey: config.apiKey } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, error: `Evolution API HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json().catch(() => ({}));
    const messageId = data?.key?.id || data?.id || `evo_out_${Date.now()}`;
    return { success: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error de conexión con Evolution API";
    return { success: false, error: msg };
  }
}

export async function sendEvolutionMediaMessage(params: {
  to: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "audio" | "document";
  caption?: string;
  fileName?: string;
  environment?: string;
  configOverride?: Partial<EvolutionConfig>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = { ...getEvolutionConfig(params.environment), ...params.configOverride };
    if (!config.apiUrl) {
      return { success: false, error: "Evolution API URL no configurada" };
    }

    const cleanNumber = params.to.replace(/\D/g, "");
    if (!cleanNumber) {
      return { success: false, error: "Número telefónico inválido para Evolution API" };
    }

    let targetMedia = params.mediaUrl;
    if (targetMedia && !targetMedia.startsWith("http://") && !targetMedia.startsWith("https://") && !targetMedia.startsWith("data:")) {
      const publicBase = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://omnichannel.farfalina.tech").replace(/\/+$/, "");
      const cleanPath = targetMedia.startsWith("/") ? targetMedia : `/${targetMedia}`;
      targetMedia = `${publicBase}${cleanPath}`;
    }

    const endpoint = `${config.apiUrl}/message/sendMedia/${config.instance}`;
    const payload = {
      number: cleanNumber,
      options: {
        delay: 500,
        presence: "composing",
      },
      mediaMessage: {
        mediatype: params.mediaType,
        caption: params.caption || "",
        media: targetMedia,
        fileName: params.fileName || `archivo_${Date.now()}`,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { apikey: config.apiKey } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, error: `Evolution API HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json().catch(() => ({}));
    const messageId = data?.key?.id || data?.id || `evo_media_${Date.now()}`;
    return { success: true, messageId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error enviando multimedia a Evolution API";
    return { success: false, error: msg };
  }
}

export async function fetchEvolutionQRCode(
  environment: string = "farfalina"
): Promise<{ success: boolean; qrCodeDataUrl?: string; status?: string; error?: string }> {
  try {
    const config = getEvolutionConfig(environment);
    const endpoint = `${config.apiUrl}/instance/connect/${config.instance}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        ...(config.apiKey ? { apikey: config.apiKey } : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Evolution API status ${res.status}` };
    }

    const json = await res.json();
    const base64 = json?.base64 || json?.qrcode?.base64 || null;
    const status = json?.instance?.state || (base64 ? "QR_READY" : "DISCONNECTED");

    return {
      success: true,
      qrCodeDataUrl: base64,
      status,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "No se pudo obtener QR de Evolution API",
    };
  }
}
