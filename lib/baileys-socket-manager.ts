import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  downloadMediaMessage,
  downloadContentFromMessage,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs";
import { prisma } from "./db";

interface BaileysInstanceState {
  socket: WASocket | null;
  currentQR: string | null;
  status: "DISCONNECTED" | "QR_READY" | "CONNECTED" | "INITIALIZING";
  isInitializing: boolean;
}

interface GlobalBaileysManager {
  instances: Record<string, BaileysInstanceState>;
}

const globalForBaileys = global as unknown as { baileysManager: GlobalBaileysManager };

if (!globalForBaileys.baileysManager) {
  globalForBaileys.baileysManager = {
    instances: {},
  };
}

export function getBaileysState(env: string = "farfalina"): BaileysInstanceState {
  const normEnv = env.toLowerCase();
  if (!globalForBaileys.baileysManager.instances[normEnv]) {
    globalForBaileys.baileysManager.instances[normEnv] = {
      socket: null,
      currentQR: null,
      status: "DISCONNECTED",
      isInitializing: false,
    };
  }
  return globalForBaileys.baileysManager.instances[normEnv];
}

function getAuthFolder(env: string = "farfalina"): string {
  const authDir = path.join(process.cwd(), "baileys_auth", env.toLowerCase());
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
  return authDir;
}

const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads", "whatsapp");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function formatPhoneDisplay(jid: string, rawNumber?: string): string {
  const digits = (rawNumber || jid || "").replace(/\D/g, "");
  if (digits.startsWith("591") && digits.length === 11) {
    return `+591 ${digits.slice(3)}`;
  }
  if (digits.length === 8 && !digits.startsWith("239")) {
    return `+591 ${digits}`;
  }
  if (digits.startsWith("51") && digits.length === 11) {
    return `+51 ${digits.slice(2)}`;
  }
  if (digits.startsWith("549") && digits.length >= 12) {
    return `+54 9 ${digits.slice(3)}`;
  }
  if (digits.length >= 9 && digits.length <= 13) {
    return `+${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return "";
}

function getMediaCategoryFromMime(mimetype: string): string {
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.includes("webp")) return "sticker";
  return "document";
}

function getExtFromMime(mimetype: string): string {
  const clean = mimetype.split("/")[1]?.split(";")[0]?.toLowerCase() || "bin";
  if (clean === "jpeg") return "jpg";
  if (clean.includes("ogg") || clean.includes("opus")) return "ogg";
  return clean;
}

/**
 * Recursively unwraps ephemeral, view-once, template, or wrapped messages to reach inner media content.
 */
function unwrapMessage(msgContent: proto.IMessage | null | undefined): proto.IMessage | null | undefined {
  if (!msgContent) return null;
  if (msgContent.ephemeralMessage?.message) return unwrapMessage(msgContent.ephemeralMessage.message);
  if (msgContent.viewOnceMessage?.message) return unwrapMessage(msgContent.viewOnceMessage.message);
  if (msgContent.viewOnceMessageV2?.message) return unwrapMessage(msgContent.viewOnceMessageV2.message);
  if (msgContent.viewOnceMessageV2Extension?.message) return unwrapMessage(msgContent.viewOnceMessageV2Extension.message);
  if (msgContent.documentWithCaptionMessage?.message) return unwrapMessage(msgContent.documentWithCaptionMessage.message);
  if (msgContent.templateMessage?.hydratedTemplate) {
    const ht = msgContent.templateMessage.hydratedTemplate;
    if (ht.imageMessage) return { imageMessage: ht.imageMessage };
    if (ht.documentMessage) return { documentMessage: ht.documentMessage };
    if (ht.videoMessage) return { videoMessage: ht.videoMessage };
    if (ht.locationMessage) return { locationMessage: ht.locationMessage };
  }
  return msgContent;
}

export async function destroyBaileysClient(env: string = "farfalina", deleteSession = true): Promise<void> {
  const normEnv = env.toLowerCase();
  const state = getBaileysState(normEnv);
  const authFolder = getAuthFolder(normEnv);

  try {
    if (state.socket) {
      console.log(`[Baileys (${normEnv})] Cerrando socket activo...`);
      state.socket.end(new Error("Manual termination"));
    }
  } catch (err) {
    console.warn(`[Baileys (${normEnv})] Error cerrando socket:`, err);
  } finally {
    state.socket = null;
    state.currentQR = null;
    state.status = "DISCONNECTED";
    state.isInitializing = false;
  }

  if (deleteSession) {
    try {
      if (fs.existsSync(authFolder)) {
        console.log(`[Baileys (${normEnv})] Eliminando sesión previa en ${authFolder}...`);
        fs.rmSync(authFolder, { recursive: true, force: true });
      }
    } catch (fsErr) {
      console.warn(`[Baileys (${normEnv})] Error al limpiar authFolder:`, fsErr);
    }
  }

  await prisma.channelConfig.upsert({
    where: { channel_tenant_unique: { channel: "WhatsApp", environment: normEnv } },
    update: { status: "DISCONNECTED", qrCodeData: null },
    create: { channel: "WhatsApp", environment: normEnv, status: "DISCONNECTED" },
  }).catch(() => {});
}

export async function initBaileysSocket(
  forceNew = false,
  env: string = "farfalina"
): Promise<{ qrCodeDataUrl: string | null; status: string }> {
  const normEnv = env.toLowerCase();
  const state = getBaileysState(normEnv);
  const authFolder = getAuthFolder(normEnv);

  try {
    if (forceNew) {
      await destroyBaileysClient(normEnv, true);
    }

    if (state.socket && state.status === "CONNECTED") {
      return { qrCodeDataUrl: null, status: "CONNECTED" };
    }

    if (state.isInitializing && state.socket) {
      return { qrCodeDataUrl: state.currentQR, status: state.status };
    }

    state.isInitializing = true;
    state.status = "INITIALIZING";

    await prisma.channelConfig.upsert({
      where: { channel_tenant_unique: { channel: "WhatsApp", environment: normEnv } },
      update: {
        status: "INITIALIZING",
        qrCodeData: null,
        updatedAt: new Date(),
      },
      create: {
        channel: "WhatsApp",
        environment: normEnv,
        status: "INITIALIZING",
      },
    }).catch((e) => console.warn(`[Baileys (${normEnv})] Error DB init:`, e));

    const { state: authState, saveCreds } = await useMultiFileAuthState(authFolder);

    const socket = makeWASocket({
      auth: authState,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["Floreria Farfalina", "Chrome", "120.0.0"],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    state.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`[Baileys (${normEnv})] Nuevo código QR generado.`);
        state.currentQR = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
        state.status = "QR_READY";

        await prisma.channelConfig.upsert({
          where: { channel_tenant_unique: { channel: "WhatsApp", environment: normEnv } },
          update: { status: "QR_READY", qrCodeData: state.currentQR },
          create: { channel: "WhatsApp", environment: normEnv, status: "QR_READY", qrCodeData: state.currentQR },
        }).catch(() => {});
      }

      if (connection === "open") {
        console.log(`[Baileys (${normEnv})] ✅ WhatsApp conectado exitosamente vía Baileys.`);
        state.status = "CONNECTED";
        state.currentQR = null;
        state.isInitializing = false;

        await prisma.channelConfig.upsert({
          where: { channel_tenant_unique: { channel: "WhatsApp", environment: normEnv } },
          update: { status: "CONNECTED", qrCodeData: null, lastSyncAt: new Date() },
          create: { channel: "WhatsApp", environment: normEnv, status: "CONNECTED" },
        }).catch(() => {});
      }

      if (connection === "close") {
        const error = lastDisconnect?.error as Error & { output?: { statusCode?: number } };
        const statusCode = error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.warn(`[Baileys (${normEnv})] Conexión cerrada. Motivo: ${statusCode} (LoggedOut: ${isLoggedOut})`);

        if (isLoggedOut) {
          await destroyBaileysClient(normEnv, true);
        } else {
          state.status = "DISCONNECTED";
          state.isInitializing = false;
          // Auto reconnect after short delay if not logged out
          setTimeout(() => {
            if (state.status === "DISCONNECTED") {
              initBaileysSocket(false, normEnv).catch(() => {});
            }
          }, 3000);
        }
      }
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const m of messages) {
        if (!m.message || !m.key.remoteJid) continue;

        const remoteJid = m.key.remoteJid;
        // Filter out status broadcast, channel broadcast, and group chats
        if (
          remoteJid === "status@broadcast" ||
          remoteJid.includes("@broadcast") ||
          remoteJid.includes("@g.us")
        ) {
          continue;
        }

        const messageKeyId = m.key.id;

        // 1. Strict deduplication check: skip if this externalId already exists in DB
        if (messageKeyId) {
          const alreadyExists = await prisma.chatMessage.findFirst({
            where: { externalId: messageKeyId },
          });
          if (alreadyExists) {
            continue;
          }
        }

        const isFromMe = Boolean(m.key.fromMe);
        const resolvedPhone = remoteJid.split("@")[0].replace(/\D/g, "");
        if (!resolvedPhone) continue;

        const unwrapped = unwrapMessage(m.message);
        if (!unwrapped) continue;

        let messageText =
          unwrapped.conversation ||
          unwrapped.extendedTextMessage?.text ||
          unwrapped.imageMessage?.caption ||
          unwrapped.videoMessage?.caption ||
          unwrapped.documentMessage?.caption ||
          unwrapped.buttonsResponseMessage?.selectedDisplayText ||
          unwrapped.listResponseMessage?.title ||
          unwrapped.templateButtonReplyMessage?.selectedDisplayText ||
          "";

        if (!messageText && unwrapped.locationMessage) {
          const loc = unwrapped.locationMessage;
          messageText = `📍 Ubicación: https://maps.google.com/?q=${loc.degreesLatitude},${loc.degreesLongitude}`;
        }

        if (!messageText && unwrapped.contactMessage) {
          messageText = `👤 Contacto: ${unwrapped.contactMessage.displayName || ""}`;
        }

        let mediaUrl: string | null = null;
        let mediaType: string | null = null;

        const isMedia = Boolean(
          unwrapped.imageMessage ||
            unwrapped.videoMessage ||
            unwrapped.ptvMessage ||
            unwrapped.audioMessage ||
            unwrapped.documentMessage ||
            unwrapped.stickerMessage
        );

        if (isMedia) {
          try {
            let buffer: Buffer | null = null;

            // Attempt 1: Standard downloadMediaMessage with unwrapped inner message
            try {
              buffer = (await downloadMediaMessage(
                { key: m.key, message: unwrapped },
                "buffer",
                {},
                {
                  logger: pino({ level: "silent" }),
                  reuploadRequest: socket.updateMediaMessage,
                }
              )) as Buffer;
            } catch (dlErr) {
              console.warn(`[Baileys (${normEnv})] Falló downloadMediaMessage estándar, probando streaming fallback:`, dlErr);
            }

            // Attempt 2: downloadContentFromMessage direct stream fallback
            if (!buffer || buffer.length === 0) {
              const mediaNode =
                unwrapped.imageMessage ||
                unwrapped.videoMessage ||
                unwrapped.ptvMessage ||
                unwrapped.audioMessage ||
                unwrapped.documentMessage ||
                unwrapped.stickerMessage;

              if (mediaNode && (mediaNode.directPath || mediaNode.url)) {
                let downloadType: "image" | "video" | "audio" | "document" | "sticker" = "document";
                if (unwrapped.imageMessage) downloadType = "image";
                else if (unwrapped.videoMessage || unwrapped.ptvMessage) downloadType = "video";
                else if (unwrapped.audioMessage) downloadType = "audio";
                else if (unwrapped.stickerMessage) downloadType = "sticker";

                const stream = await downloadContentFromMessage(mediaNode as any, downloadType as any);
                const chunks: Buffer[] = [];
                for await (const chunk of stream) {
                  chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
                }
                if (chunks.length > 0) {
                  buffer = Buffer.concat(chunks);
                }
              }
            }

            if (buffer && buffer.length > 0) {
              const rawMime =
                unwrapped.imageMessage?.mimetype ||
                unwrapped.videoMessage?.mimetype ||
                unwrapped.ptvMessage?.mimetype ||
                unwrapped.audioMessage?.mimetype ||
                unwrapped.documentMessage?.mimetype ||
                unwrapped.stickerMessage?.mimetype ||
                "application/octet-stream";

              const ext = getExtFromMime(rawMime);
              const safeKeyId = (messageKeyId || Math.random().toString(36).slice(2)).replace(/[^a-zA-Z0-9_-]/g, "");
              const filename = `wa_${Date.now()}_${safeKeyId}.${ext}`;
              const filePath = path.join(UPLOADS_DIR, filename);

              fs.writeFileSync(filePath, buffer);
              mediaUrl = `/uploads/whatsapp/${filename}`;
              mediaType = getMediaCategoryFromMime(rawMime);

              if (!messageText && mediaType) {
                messageText = `[${mediaType.toUpperCase()}]`;
              }
            }
          } catch (downloadErr) {
            console.error(`[Baileys (${normEnv})] Error al descargar media de WhatsApp:`, downloadErr);
          }
        }

        // 2. Intelligent Outbound Deduplication:
        // If message is fromMe, check if an agent message was just dispatched via web action within last 30s
        if (isFromMe) {
          const candidateThread = await prisma.chatThread.findUnique({
            where: {
              chatthread_tenant_unique: {
                channel: "WhatsApp",
                phone: resolvedPhone,
                environment: normEnv,
              },
            },
          });

          if (candidateThread) {
            const recentAgentMsg = await prisma.chatMessage.findFirst({
              where: {
                threadId: candidateThread.id,
                sender: "agent",
                externalId: null,
                createdAt: { gte: new Date(Date.now() - 30000) },
              },
              orderBy: { createdAt: "desc" },
            });

            if (recentAgentMsg) {
              if (messageKeyId) {
                await prisma.chatMessage.update({
                  where: { id: recentAgentMsg.id },
                  data: { externalId: messageKeyId },
                });
              }
              continue;
            }
          }
        }

        const pushName = m.pushName || "";
        const formatted = formatPhoneDisplay(remoteJid, resolvedPhone);
        let clientName = pushName ? `${pushName} (${formatted || resolvedPhone})` : formatted || resolvedPhone;
        if (!clientName) clientName = "Cliente WhatsApp";

        const thread = await prisma.chatThread.upsert({
          where: {
            chatthread_tenant_unique: {
              channel: "WhatsApp",
              phone: resolvedPhone,
              environment: normEnv,
            },
          },
          update: {
            lastMessage: messageText || (mediaType ? `[${mediaType.toUpperCase()}]` : "[Archivo adjunto]"),
            updatedAt: new Date(),
            ...(!isFromMe && { status: "Por Responder" }),
            ...(pushName && !clientName.startsWith("Cliente WhatsApp") && { clientName }),
          },
          create: {
            channel: "WhatsApp",
            phone: resolvedPhone,
            environment: normEnv,
            clientName,
            status: isFromMe ? "Pendientes" : "Por Responder",
            lastMessage: messageText || (mediaType ? `[${mediaType.toUpperCase()}]` : "[Archivo adjunto]"),
            assignedAgent: "Agente Lucía",
          },
        });

        await prisma.chatMessage.create({
          data: {
            threadId: thread.id,
            sender: isFromMe ? "agent" : "customer",
            text: messageText,
            mediaUrl,
            mediaType,
            environment: normEnv,
            externalId: messageKeyId || undefined,
          },
        });
      }
    });

    // Wait up to 15 seconds for initial QR or connection
    let waited = 0;
    while (state.status === "INITIALIZING" && waited < 15000) {
      await new Promise((r) => setTimeout(r, 400));
      waited += 400;
    }

    return {
      qrCodeDataUrl: state.currentQR,
      status: state.status,
    };
  } catch (err) {
    console.error(`[Baileys (${normEnv})] Error inicializando socket:`, err);
    state.status = "DISCONNECTED";
    state.isInitializing = false;
    state.socket = null;
    return { qrCodeDataUrl: null, status: "DISCONNECTED" };
  }
}

export async function sendBaileysTextMessage(
  phone: string,
  text: string,
  env: string = "farfalina"
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const normEnv = env.toLowerCase();
  const state = getBaileysState(normEnv);

  try {
    const socket = state.socket;
    if (!socket || state.status !== "CONNECTED") {
      console.warn(`[Baileys (${normEnv})] Socket no conectado para enviar mensaje.`);
      return { success: false, error: "Socket de WhatsApp desconectado" };
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return { success: false, error: "Número de teléfono inválido" };

    const jid = `${cleanPhone}@s.whatsapp.net`;
    console.log(`[Baileys (${normEnv})] Enviando texto a ${jid}: "${text}"`);
    const sent = await socket.sendMessage(jid, { text });
    console.log(`[Baileys (${normEnv})] ✅ Mensaje enviado exitosamente.`);
    return { success: true, messageId: sent?.key?.id || undefined };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Error al enviar mensaje con Baileys";
    console.error(`[Baileys (${normEnv})] Error al enviar mensaje:`, err);
    return { success: false, error: errMsg };
  }
}

export async function sendBaileysMediaMessage(
  phone: string,
  buffer: Buffer,
  mimeType: string,
  filename?: string,
  caption?: string,
  env: string = "farfalina"
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const normEnv = env.toLowerCase();
  const state = getBaileysState(normEnv);

  try {
    const socket = state.socket;
    if (!socket || state.status !== "CONNECTED") {
      console.warn(`[Baileys (${normEnv})] Socket no conectado para enviar multimedia.`);
      return { success: false, error: "Socket de WhatsApp desconectado" };
    }

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return { success: false, error: "Número de teléfono inválido" };

    const jid = `${cleanPhone}@s.whatsapp.net`;
    const cleanCaption = caption || undefined;

    console.log(`[Baileys (${normEnv})] Enviando multimedia (${mimeType}) a ${jid}...`);

    let sent: Awaited<ReturnType<WASocket["sendMessage"]>> = undefined;

    if (mimeType.startsWith("image/")) {
      sent = await socket.sendMessage(jid, {
        image: buffer,
        caption: cleanCaption,
      });
    } else if (mimeType.startsWith("video/")) {
      sent = await socket.sendMessage(jid, {
        video: buffer,
        caption: cleanCaption,
      });
    } else if (mimeType.startsWith("audio/")) {
      sent = await socket.sendMessage(jid, {
        audio: buffer,
        mimetype: mimeType,
        ptt: false,
      });
    } else {
      sent = await socket.sendMessage(jid, {
        document: buffer,
        mimetype: mimeType,
        fileName: filename || "archivo",
        caption: cleanCaption,
      });
    }

    console.log(`[Baileys (${normEnv})] ✅ Archivo multimedia enviado exitosamente.`);
    return { success: true, messageId: sent?.key?.id || undefined };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Error al enviar multimedia con Baileys";
    console.error(`[Baileys (${normEnv})] Error al enviar multimedia con Baileys:`, err);
    return { success: false, error: errMsg };
  }
}
