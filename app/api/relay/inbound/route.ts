import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-relay-client",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

const MessageItemSchema = z.object({
  sender: z.enum(["customer", "bot", "agent"]).default("customer"),
  text: z.string().default(""),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
  rawTimestamp: z.string().optional().nullable(),
});

async function cacheRemoteMediaLocally(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const fs = await import("fs");
    const path = await import("path");
    const crypto = await import("crypto");
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "meta");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Handle base64 Data URLs directly (instant local write without network hop)
    if (url.startsWith("data:")) {
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const rawB64 = match[2];
        const hash = crypto.createHash("md5").update(rawB64.slice(0, 1000) + rawB64.length).digest("hex");
        const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("mp4") ? "mp4" : "jpg";
        const filename = `meta_${hash}.${ext}`;
        const filePath = path.join(uploadsDir, filename);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, Buffer.from(rawB64, "base64"));
        }
        return `/uploads/meta/${filename}`;
      }
      return url;
    }

    if (!url.startsWith("http")) return url;
    if (!url.includes("fbcdn.net") && !url.includes("cdninstagram.com") && !url.includes("fbsbx.com") && !url.includes("lookaside")) {
      return url;
    }

    const cleanUrl = url.split("?")[0];
    const hash = crypto.createHash("md5").update(cleanUrl).digest("hex");
    const extMatch = cleanUrl.match(/\.(jpg|jpeg|png|webp|mp4|mp3|ogg|pdf)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
    const filename = `meta_${hash}.${ext}`;
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      return `/uploads/meta/${filename}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Referer": "https://business.facebook.com/",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const contentType = res.headers.get("content-type") || "";
      let realExt = ext;
      if (contentType.includes("png")) realExt = "png";
      else if (contentType.includes("webp")) realExt = "webp";
      else if (contentType.includes("jpeg") || contentType.includes("jpg")) realExt = "jpg";
      else if (contentType.includes("mp4")) realExt = "mp4";
      const finalFileName = `meta_${hash}.${realExt}`;
      const finalFilePath = path.join(uploadsDir, finalFileName);
      fs.writeFileSync(finalFilePath, Buffer.from(arrayBuffer));
      return `/uploads/meta/${finalFileName}`;
    }
  } catch {
    // Fallback to original URL
  }
  return url;
}

const RelayInboundSchema = z.object({
  channel: z
    .enum(["Facebook", "Instagram", "Messenger", "WhatsApp"])
    .transform((ch) => (ch === "Messenger" ? "Facebook" : ch)),
  environment: z.enum(["farfalina", "carissma"]).default("farfalina"),
  clientName: z.string().min(1, "El nombre del cliente es obligatorio"),
  phone: z.string().min(1, "El identificador o teléfono es obligatorio"),
  text: z.string().default(""),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  profilePicUrl: z.string().optional().nullable(),
  sender: z.enum(["customer", "bot", "agent"]).default("customer"),
  metaThreadId: z.string().optional().nullable(),
  externalId: z.string().optional().nullable(),
  rawTimestamp: z.string().optional().nullable(),
  unreadCount: z.number().int().nonnegative().optional().default(0),
  isThreadSyncOnly: z.boolean().optional().default(false),
  email: z.string().optional().nullable(),
  instagramUsername: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  messages: z.array(MessageItemSchema).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = RelayInboundSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: parsed.error.issues[0]?.message || "Payload de Relay inválido",
          code: "VALIDATION_ERROR",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const {
      channel,
      environment,
      clientName: rawClientName,
      phone: rawPhone,
      text,
      mediaUrl,
      mediaType,
      profilePicUrl,
      sender,
      metaThreadId,
      externalId,
      rawTimestamp,
      unreadCount,
      isThreadSyncOnly,
      email,
      instagramUsername,
      tags,
      messages: batchMessages,
    } = parsed.data;

    const effectiveExternalId = externalId || metaThreadId || null;

    // Sanitize client name - never accept system navigation words as name
    let clientName = rawClientName.trim();
    if (
      !clientName ||
      clientName.toLowerCase() === "mensajes" ||
      clientName.toLowerCase() === "conversación activa" ||
      clientName.toLowerCase() === "conversacion activa" ||
      clientName.toLowerCase().startsWith("administrar")
    ) {
      clientName = channel === "WhatsApp" ? `Contacto WhatsApp` : `Cliente ${channel}`;
    }

    const cleanPhone = rawPhone.trim();
    const numericPhone = cleanPhone.replace(/[^0-9]/g, "");

    // Precise Phone & Channel Resolution:
    // Respect explicit channel from caller without false overrides to WhatsApp
    const finalChannel = channel;

    // Detect genuine phone numbers vs Facebook PSID or Instagram handle
    const isBolivianMobile = (numericPhone.length === 8 && /^[67]/.test(numericPhone)) ||
      (numericPhone.length === 11 && numericPhone.startsWith("591") && /^[67]/.test(numericPhone.slice(3)));
    const isE164Phone = cleanPhone.startsWith("+") && numericPhone.length >= 7 && numericPhone.length <= 15;
    const isWhatsAppNumeric = finalChannel === "WhatsApp" && numericPhone.length >= 7 && numericPhone.length <= 15;
    const isRealPhone = isBolivianMobile || isE164Phone || isWhatsAppNumeric;

    let formattedPhone = cleanPhone;
    if (isRealPhone) {
      if (cleanPhone.startsWith("+")) {
        formattedPhone = cleanPhone;
      } else if (numericPhone.length === 8 && /^[67]/.test(numericPhone)) {
        formattedPhone = `+591${numericPhone}`;
      } else if (numericPhone.length >= 7 && numericPhone.length <= 15) {
        formattedPhone = `+${numericPhone}`;
      }
    }

    const cachedAvatar = profilePicUrl ? await cacheRemoteMediaLocally(profilePicUrl) : null;

    // 1. Resilient thread lookup:
    // A. Check exact unique tenant constraint [channel, phone, environment] first
    let thread = await prisma.chatThread.findUnique({
      where: {
        chatthread_tenant_unique: {
          channel: finalChannel,
          phone: formattedPhone,
          environment,
        },
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // B. Fallback search across variations (cleanPhone, metaThreadId, without +)
    if (!thread) {
      const candidatePhones = Array.from(
        new Set([
          formattedPhone,
          cleanPhone,
          cleanPhone.replace(/^\+/, ""),
          `+${cleanPhone.replace(/^\+/, "")}`,
          ...(metaThreadId ? [metaThreadId, metaThreadId.replace(/^\+/, ""), `+${metaThreadId.replace(/^\+/, "")}`] : []),
        ])
      ).filter(Boolean);

      const existingThreads = await prisma.chatThread.findMany({
        where: {
          environment,
          OR: [
            { channel: finalChannel, phone: { in: candidatePhones } },
            ...(effectiveExternalId ? [{ channel: finalChannel, externalId: effectiveExternalId }] : []),
            ...(isRealPhone && numericPhone.length >= 7 ? [{ channel: finalChannel, phone: { contains: numericPhone.slice(-8) } }] : []),
          ],
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      thread = existingThreads[0] || null;
    }

    if (thread) {
      thread = await prisma.chatThread.update({
        where: { id: thread.id },
        data: {
          channel: finalChannel,
          ...((cachedAvatar || profilePicUrl) && !thread.profilePicUrl ? { profilePicUrl: cachedAvatar || profilePicUrl } : {}),
          ...(clientName && !clientName.startsWith("Cliente ") && (thread.clientName.startsWith("Cliente ") || thread.clientName === "Mensajes")
            ? { clientName }
            : {}),
          phone: formattedPhone,
          status: "Por Responder",
          ...(effectiveExternalId && !thread.externalId ? { externalId: effectiveExternalId } : {}),
          ...(rawTimestamp ? { rawTimestamp } : {}),
          ...(unreadCount !== undefined ? { unreadCount } : {}),
          updatedAt: new Date(),
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } else {
      // Create new thread
      thread = await prisma.chatThread.create({
        data: {
          clientName,
          phone: formattedPhone,
          channel: finalChannel,
          environment,
          status: "Por Responder",
          lastMessage: text.trim() && !text.toLowerCase().includes("conversación activa") ? text.trim() : "Nueva conversación",
          profilePicUrl: cachedAvatar || profilePicUrl || null,
          externalId: effectiveExternalId,
          rawTimestamp: rawTimestamp || null,
          unreadCount: unreadCount || 0,
          lastMessageAt: new Date(),
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }

    // Auto-sync or update CRMClient ONLY if real verified phone number
    if (isRealPhone && numericPhone.length >= 7 && numericPhone.length <= 15) {
      try {
        const existingCrm = await prisma.cRMClient.findUnique({
          where: { phone: formattedPhone },
        });

        const extraDetails = [
          email ? `Email: ${email}` : null,
          instagramUsername ? `IG: @${instagramUsername.replace(/^@/, "")}` : null,
          tags && tags.length > 0 ? `Etiquetas: ${tags.join(", ")}` : null,
        ].filter(Boolean).join(" | ");

        const fullNotes = [
          `Registrado automáticamente desde Meta Business Suite (${finalChannel})`,
          extraDetails || null,
        ].filter(Boolean).join(" | ");

        if (!existingCrm) {
          await prisma.cRMClient.create({
            data: {
              name: clientName,
              phone: formattedPhone,
              notes: fullNotes,
              loyaltyTier: "Bronce",
            },
          });
        } else {
          const updateData: { name?: string; notes?: string } = {};
          if (existingCrm.name.startsWith("Cliente ") && !clientName.startsWith("Cliente ")) {
            updateData.name = clientName;
          }
          if (extraDetails && (!existingCrm.notes || !existingCrm.notes.includes(extraDetails))) {
            updateData.notes = existingCrm.notes ? `${existingCrm.notes} | ${extraDetails}` : fullNotes;
          }
          if (Object.keys(updateData).length > 0) {
            await prisma.cRMClient.update({
              where: { id: existingCrm.id },
              data: updateData,
            });
          }
        }
      } catch {
        // Ignorar fallo puntual de CRM
      }
    }

    let lastCreatedMessageId: string | null = null;
    let finalSummary = thread.lastMessage;

    // 2. Process Messages
    let maxMessageDate: Date | null = null;

    if (batchMessages && batchMessages.length > 0) {
      const now = Date.now();
      const baseTime = now - batchMessages.length * 1500;
      const unmatchedDbMessages = [...thread.messages];

      for (let i = 0; i < batchMessages.length; i++) {
        const msg = batchMessages[i];
        const trimmed = msg.text.trim();

        // Skip bogus placeholders
        if (!trimmed && !msg.mediaUrl) continue;
        if (trimmed.toLowerCase() === "conversación activa" || trimmed.toLowerCase() === "conversacion activa") continue;

        // Message Matching against unmatched pool: by externalId first, then by content
        const matchIdx = unmatchedDbMessages.findIndex(
          (m) =>
            (msg.externalId && m.externalId && m.externalId === msg.externalId) ||
            (m.sender === msg.sender &&
              m.text.trim() === trimmed &&
              (msg.mediaUrl ? m.mediaUrl === msg.mediaUrl : true))
        );

        if (matchIdx !== -1) {
          // Already in database, consume from available pool
          unmatchedDbMessages.splice(matchIdx, 1);
        } else {
          // Truly new message! Cache remote media if present
          const cachedMsgMedia = msg.mediaUrl ? await cacheRemoteMediaLocally(msg.mediaUrl) : null;
          const msgTimestamp = msg.createdAt ? new Date(msg.createdAt) : new Date(baseTime + i * 1500);
          if (!maxMessageDate || msgTimestamp > maxMessageDate) {
            maxMessageDate = msgTimestamp;
          }

          const createdMsg = await prisma.chatMessage.create({
            data: {
              threadId: thread.id,
              sender: msg.sender,
              text: trimmed || (cachedMsgMedia || msg.mediaUrl ? "[Archivo adjunto]" : ""),
              mediaUrl: cachedMsgMedia || msg.mediaUrl || null,
              mediaType: msg.mediaType || (cachedMsgMedia || msg.mediaUrl ? "image" : null),
              environment,
              externalId: msg.externalId || null,
              rawTimestamp: msg.rawTimestamp || null,
              timestamp: msgTimestamp,
              createdAt: msgTimestamp,
            },
          });
          lastCreatedMessageId = createdMsg.id;
          finalSummary = trimmed || (cachedMsgMedia || msg.mediaUrl ? "[Foto]" : finalSummary);
          thread.messages.push(createdMsg);
        }
      }

      // Update thread lastMessage and lastMessageAt only if new messages were added
      if (lastCreatedMessageId && finalSummary) {
        await prisma.chatThread.update({
          where: { id: thread.id },
          data: {
            lastMessage: finalSummary,
            lastMessageAt: maxMessageDate || new Date(),
            ...(rawTimestamp ? { rawTimestamp } : {}),
            updatedAt: new Date(),
          },
        });
      }
    } else if (!isThreadSyncOnly) {
      // Single message sync
      const trimmed = text.trim();
      const isValidText = trimmed && trimmed.toLowerCase() !== "conversación activa" && trimmed.toLowerCase() !== "conversacion activa";

      if (isValidText || mediaUrl) {
        const alreadyExists = thread.messages.some(
          (m) =>
            (effectiveExternalId && m.externalId && m.externalId === effectiveExternalId) ||
            (m.sender === sender && m.text.trim() === trimmed && (mediaUrl ? m.mediaUrl === mediaUrl : true))
        );

        if (!alreadyExists) {
          const cachedSingleMedia = mediaUrl ? await cacheRemoteMediaLocally(mediaUrl) : null;
          const now = new Date();
          const createdMsg = await prisma.chatMessage.create({
            data: {
              threadId: thread.id,
              sender,
              text: trimmed || (cachedSingleMedia || mediaUrl ? "[Archivo adjunto]" : ""),
              mediaUrl: cachedSingleMedia || mediaUrl || null,
              mediaType: mediaType || (cachedSingleMedia || mediaUrl ? "image" : null),
              environment,
              externalId: effectiveExternalId || null,
              rawTimestamp: rawTimestamp || null,
              timestamp: now,
              createdAt: now,
            },
          });
          lastCreatedMessageId = createdMsg.id;
          finalSummary = trimmed || (cachedSingleMedia || mediaUrl ? "[Foto]" : finalSummary);

          await prisma.chatThread.update({
            where: { id: thread.id },
            data: {
              lastMessage: finalSummary,
              lastMessageAt: now,
              ...(rawTimestamp ? { rawTimestamp } : {}),
              updatedAt: new Date(),
            },
          });
        }
      }
    }

    // 3. Keep channel status marked as CONNECTED
    try {
      await prisma.channelConfig.upsert({
        where: {
          channel_tenant_unique: {
            channel: finalChannel,
            environment,
          },
        },
        update: {
          status: "CONNECTED",
          lastSyncAt: new Date(),
        },
        create: {
          channel: finalChannel,
          environment,
          status: "CONNECTED",
          lastSyncAt: new Date(),
        },
      });
    } catch {
      // Ignore channelConfig update error
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          threadId: thread.id,
          messageId: lastCreatedMessageId,
          environment: thread.environment,
          channel: thread.channel,
          clientName: thread.clientName,
        },
        error: null,
        code: null,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error interno del servidor";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMsg,
        code: "RELAY_INBOUND_ERROR",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
