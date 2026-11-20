import { z } from "zod";

export const DeliveryDispatchDataSchema = z.object({
  orderNumber: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  clientPhone: z.string().optional().nullable(),
  recipientName: z.string().optional().nullable(),
  recipientPhone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  mapsUrl: z.string().optional().nullable(),
  deliveryDate: z.union([z.string(), z.date()]).optional().nullable(),
  deliveryTime: z.string().optional().nullable(),
  arrangementName: z.string().optional().nullable(),
  deliveryFee: z.number().optional().nullable(),
  deliveryType: z.enum(["delivery", "pickup"]).optional(),
});

export type DeliveryDispatchData = z.infer<typeof DeliveryDispatchDataSchema>;

/**
 * Formatea una fecha a DD/MM/YYYY de forma segura sin desfase de zona horaria.
 * @param rawDate - Fecha en ISO string o Date
 * @returns Fecha legible
 */
function formatDispatchDate(rawDate?: string | Date | null): string {
  if (!rawDate) return "Hoy";
  if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    const [y, m, d] = rawDate.slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  const dt = new Date(rawDate);
  if (Number.isNaN(dt.getTime())) return String(rawDate);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = dt.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Genera el mensaje estructurado listo para copiar y enviar por WhatsApp a la central de móviles / Yango / delivery.
 * @param data - Datos del pedido y destinatario
 * @returns Texto formateado para WhatsApp
 */
export function buildDeliveryWhatsAppMessage(data: DeliveryDispatchData): string {
  const isPickup =
    data.deliveryType === "pickup" ||
    Boolean(data.address && data.address.toLowerCase().includes("retiro en tienda"));

  const lines: string[] = [];
  lines.push(isPickup ? "💐 *PEDIDO RETIRO EN TIENDA — FLORERÍA FARFALINA*" : "💐 *DESPACHO DELIVERY — FLORERÍA FARFALINA*");
  if (data.orderNumber) {
    lines.push(`🧾 *Pedido:* ${data.orderNumber}`);
  }
  if (data.clientName && data.clientName.trim().length > 0) {
    const buyerPhonePart = data.clientPhone?.trim() ? ` (${data.clientPhone.trim()})` : "";
    lines.push(`👤 *Cliente (Comprador):* ${data.clientName.trim()}${buyerPhonePart}`);
  }
  if (data.recipientName && data.recipientName.trim().length > 0) {
    lines.push(`🎁 *Quién recibe / Destinatario:* ${data.recipientName.trim()}`);
  }
  if (data.recipientPhone && data.recipientPhone.trim().length > 0) {
    lines.push(`📞 *Tel. Destinatario:* ${data.recipientPhone.trim()}`);
  }
  if (!isPickup) {
    if (data.address && data.address.trim().length > 0) {
      lines.push(`📍 *Dirección exacta:* ${data.address.trim()}`);
    }
    if (data.zone && data.zone.trim().length > 0 && data.zone !== "Tienda Central") {
      lines.push(`🗺️ *Zona:* ${data.zone.trim()}`);
    }
    if (data.mapsUrl && data.mapsUrl.trim().length > 0) {
      lines.push(`📌 *Google Maps:* ${data.mapsUrl.trim()}`);
    }
  } else {
    lines.push(`🏪 *Modalidad:* Retiro en Tienda Central`);
  }

  const dateText = formatDispatchDate(data.deliveryDate);
  const timeText = data.deliveryTime?.trim() ? ` — ${data.deliveryTime.trim()}` : "";
  lines.push(`📅 *Fecha y hora:* ${dateText}${timeText}`);

  if (data.arrangementName && data.arrangementName.trim().length > 0) {
    lines.push(`🌸 *Arreglo:* ${data.arrangementName.trim()}`);
  }
  if (!isPickup && typeof data.deliveryFee === "number" && data.deliveryFee > 0) {
    lines.push(`🚕 *Costo Delivery:* ${data.deliveryFee} Bs`);
  }

  return lines.join("\n");
}
