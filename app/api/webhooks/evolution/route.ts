import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = searchParams.get("hub.challenge") || searchParams.get("challenge");
  if (challenge) {
    return new NextResponse(challenge, { status: 200, headers: corsHeaders });
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        status: "ONLINE",
        service: "Farfalina Evolution API Ingestion Webhook",
        timestamp: new Date().toISOString(),
      },
      error: null,
      code: null,
    },
    { status: 200, headers: corsHeaders }
  );
}

const EvolutionPayloadSchema = z.object({
  event: z.string().optional(),
  instance: z.string().optional().default("farfalina"),
  data: z.record(z.unknown()).optional(),
}).passthrough();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = EvolutionPayloadSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: "Payload de Evolution API inválido",
          code: "VALIDATION_ERROR",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const event = (parsed.data.event || rawBody.type || "").toUpperCase();
    const instanceName = (parsed.data.instance || "farfalina").toLowerCase();
    const environment = instanceName.includes("carissma") ? "carissma" : "farfalina";
    const data = parsed.data.data || rawBody.data || rawBody;

    // 1. Connection status update and QR code events
    if (
      event.includes("CONNECTION_UPDATE") ||
      event.includes("CONNECTION.UPDATE") ||
      event.includes("QRCODE_UPDATED") ||
      event.includes("QRCODE.UPDATED")
    ) {
      const state = (data.state || data.status || "").toString().toUpperCase();
      let dbStatus = "DISCONNECTED";
      if (state === "OPEN" || state === "CONNECTED") dbStatus = "CONNECTED";
      else if (state === "CONNECTING" || state === "QRCODE" || event.includes("QRCODE")) dbStatus = "QR_READY";

      const qrCodeData = (data.qrcode?.base64 || data.qr || data.base64 || null) as string | null;

      await prisma.channelConfig.upsert({
        where: { channel_tenant_unique: { channel: "WhatsApp", environment } },
        update: {
          status: dbStatus,
          ...(qrCodeData ? { qrCodeData } : {}),
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          channel: "WhatsApp",
          environment,
          status: dbStatus,
          qrCodeData,
          lastSyncAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: { status: dbStatus, environment, hasQR: Boolean(qrCodeData) },
          error: null,
          code: null,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    // 2. Incoming messages upsert event (Evolution API / Baileys format)
    if (event.includes("MESSAGES_UPSERT") || event.includes("MESSAGES.UPSERT") || event.includes("SEND_MESSAGE")) {
      const key = (data.key as Record<string, unknown>) || {};
      const remoteJid = (key.remoteJid as string) || (data.remoteJid as string) || "";
      const isFromMe = Boolean(key.fromMe ?? data.fromMe);
      const messageId = (key.id as string) || (data.id as string) || `evo_${Date.now()}`;

      // Ignore broadcast or status messages
      if (!remoteJid || remoteJid.includes("@broadcast") || remoteJid.includes("status@broadcast")) {
        return NextResponse.json(
          { success: true, data: { ignored: "broadcast" }, error: null, code: null },
          { status: 200, headers: corsHeaders }
        );
      }

      // Extract raw phone number
      const phoneDigits = remoteJid.split("@")[0].replace(/[^0-9]/g, "");
      const formattedPhone = phoneDigits.startsWith("591")
        ? `+${phoneDigits}`
        : phoneDigits.length === 8 && /^[67]/.test(phoneDigits)
        ? `+591${phoneDigits}`
        : `+${phoneDigits}`;

      const pushName = (data.pushName as string) || `Contacto ${formattedPhone.slice(-4)}`;
      const messageObj = (data.message as Record<string, unknown>) || {};

      // Extract message text content across all possible Baileys message types
      let text = "";
      let mediaType: string | null = null;
      let mediaUrl: string | null = null;

      if (typeof messageObj.conversation === "string") {
        text = messageObj.conversation;
      } else if (messageObj.extendedTextMessage && typeof (messageObj.extendedTextMessage as Record<string, unknown>).text === "string") {
        text = (messageObj.extendedTextMessage as Record<string, unknown>).text as string;
      } else if (messageObj.imageMessage) {
        mediaType = "image";
        const img = messageObj.imageMessage as Record<string, unknown>;
        text = (img.caption as string) || "";
        mediaUrl = (img.url as string) || (data.mediaUrl as string) || null;
      } else if (messageObj.videoMessage) {
        mediaType = "video";
        const vid = messageObj.videoMessage as Record<string, unknown>;
        text = (vid.caption as string) || "";
        mediaUrl = (vid.url as string) || (data.mediaUrl as string) || null;
      } else if (messageObj.audioMessage) {
        mediaType = "audio";
        mediaUrl = ((messageObj.audioMessage as Record<string, unknown>).url as string) || null;
      } else if (messageObj.documentMessage) {
        mediaType = "document";
        const doc = messageObj.documentMessage as Record<string, unknown>;
        text = (doc.title as string) || (doc.fileName as string) || "";
        mediaUrl = (doc.url as string) || null;
      }

      const sender = isFromMe ? "agent" : "customer";
      const messageDate = data.messageTimestamp
        ? new Date(Number(data.messageTimestamp) * 1000)
        : new Date();

      // Upsert Thread
      let thread = await prisma.chatThread.findUnique({
        where: {
          chatthread_tenant_unique: {
            channel: "WhatsApp",
            phone: formattedPhone,
            environment,
          },
        },
        include: { messages: true },
      });

      const summaryText = text || (mediaType === "image" ? "[Foto]" : mediaType ? "[Archivo]" : "Mensaje WhatsApp");

      if (!thread) {
        thread = await prisma.chatThread.create({
          data: {
            clientName: pushName,
            phone: formattedPhone,
            channel: "WhatsApp",
            environment,
            status: isFromMe ? "Pendientes" : "Por Responder",
            lastMessage: summaryText,
            externalId: remoteJid,
            lastMessageAt: messageDate,
            unreadCount: isFromMe ? 0 : 1,
          },
          include: { messages: true },
        });
      } else {
        thread = await prisma.chatThread.update({
          where: { id: thread.id },
          data: {
            clientName: !thread.clientName.startsWith("Contacto") ? thread.clientName : pushName,
            lastMessage: summaryText,
            lastMessageAt: (!thread.lastMessageAt || messageDate >= thread.lastMessageAt) ? messageDate : thread.lastMessageAt,
            externalId: remoteJid,
            status: isFromMe ? thread.status : "Por Responder",
            unreadCount: isFromMe ? thread.unreadCount : { increment: 1 },
            updatedAt: new Date(),
          },
          include: { messages: true },
        });
      }

      // Deduplication check by externalId or sender+text+timestamp
      const exists = thread.messages.some(
        (m) =>
          (m.externalId && m.externalId === messageId) ||
          (m.sender === sender && m.text.trim() === text.trim() && Math.abs(m.createdAt.getTime() - messageDate.getTime()) < 3000)
      );

      if (!exists) {
        await prisma.chatMessage.create({
          data: {
            threadId: thread.id,
            sender,
            text: text || (mediaUrl ? "[Archivo adjunto]" : ""),
            mediaUrl,
            mediaType,
            environment,
            externalId: messageId,
            timestamp: messageDate,
            createdAt: messageDate,
          },
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            threadId: thread.id,
            messageId,
            sender,
            channel: "WhatsApp",
            environment,
          },
          error: null,
          code: null,
        },
        { status: 200, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { success: true, data: { receivedEvent: event }, error: null, code: null },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Error procesando webhook de Evolution API";
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: errorMsg,
        code: "EVOLUTION_WEBHOOK_ERROR",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
