/**
 * Unified WhatsApp Socket Manager
 * Uses Baileys (@whiskeysockets/baileys) as the primary lightweight, headless engine
 * for scanning QR codes, receiving/sending text, and downloading/uploading multimedia cleanly.
 */

import {
  initBaileysSocket,
  destroyBaileysClient,
  sendBaileysTextMessage,
  sendBaileysMediaMessage,
  getBaileysState,
} from "./baileys-socket-manager";

export async function initWhatsAppSocket(
  forceNew = false,
  env: string = "farfalina"
): Promise<{ qrCodeDataUrl: string | null; status: string }> {
  return initBaileysSocket(forceNew, env);
}

export async function destroyWhatsAppClient(env: string = "farfalina"): Promise<void> {
  return destroyBaileysClient(env, true);
}

export async function sendWhatsAppWebMessage(
  phone: string,
  text: string,
  env: string = "farfalina"
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendBaileysTextMessage(phone, text, env);
}

export async function sendWhatsAppWebMediaMessage(
  phone: string,
  base64Data: string,
  mimeType: string,
  filename: string = "archivo",
  caption?: string,
  env: string = "farfalina"
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  const buffer = Buffer.from(cleanBase64, "base64");
  return sendBaileysMediaMessage(phone, buffer, mimeType, filename, caption, env);
}

export function getWhatsAppSocketState(env: string = "farfalina") {
  return getBaileysState(env);
}