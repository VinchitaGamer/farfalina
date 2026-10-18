import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fetchFacebookProfile } from "@/lib/instagram-profile";
import { downloadAndCacheMetaMedia } from "@/lib/meta-graph-api";

const DEFAULT_VERIFY_TOKEN = "farfalina_carissma_webhook_verify_token_2026";

const ProcessFacebookMessageSchema = z.object({
  senderId: z.string().min(1),
  text: z.string().default(""),
  mediaUrl: z.string().nullable().optional(),
  mediaType: z.string().nullable().optional(),
  isEcho: z.boolean().default(false),
  environment: z.string().default("farfalina"),
  pageAccessToken: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
});

type ProcessFacebookMessageInput = z.infer<typeof ProcessFacebookMessageSchema>;

// GET handler for Facebook Messenger Webhook Verification
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    console.log(`[Webhook FB GET] Verificación solicitada: mode=${mode}, token=${token ? "****" : "null"}`);

    const verifyToken = process.env.META_VERIFY_TOKEN;

    if (mode === "subscribe" && token) {
      if ((verifyToken && token === verifyToken) || token === DEFAULT_VERIFY_TOKEN) {
        return new NextResponse(challenge || "OK", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }

      // Check database configs for matching verifyToken
      const dbConfig = await prisma.channelConfig.findFirst({
        where: {
          channel: "Facebook",
          verifyToken: token,
        },
      });

      if (dbConfig) {
        return new NextResponse(challenge || "OK", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      }
    }

    return NextResponse.json(
      { success: false, data: null, error: "Forbidden: Token mismatch", code: "FORBIDDEN" },
      { status: 403 }
    );
  } catch (err) {
    console.error("[Webhook FB GET Exception]:", err);
    return NextResponse.json(
      { success: false, data: null, error: "Internal Server Error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST handler for Facebook Messenger Inbound Messages & Outbound Echoes
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.META_APP_SECRET;

    if (appSecret && signature) {
      const hmac = crypto.createHmac("sha256", appSecret);
      const digest = "sha256=" + hmac.update(rawBody).digest("hex");
      const expectedBuffer = Buffer.from(digest);
      const actualBuffer = Buffer.from(signature);

      if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
        return NextResponse.json(
          { success: false, data: null, error: "Invalid signature", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, data: null, error: "Bad Request: Malformed JSON", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    console.log("[Webhook FB POST] Payload recibido de Meta:", JSON.stringify(body, null, 2));

    const { searchParams } = new URL(req.url);
    const rawQueryEnv = searchParams.get("env") || searchParams.get("tenant");
    const queryEnv = rawQueryEnv?.toLowerCase();

    const entries = Array.isArray(body.entry) ? body.entry : [];

    if (body.object === "page" || entries.length > 0) {
      for (const entry of entries) {
        const pageId = typeof entry?.id === "string" ? entry.id : undefined;

        // Multi-tenant resolution:
        // Priority 1: URL Query parameter (e.g. ?env=carissma)
        // Priority 2: Match ChannelConfig by facebookPageId
        // Priority 3: Fallback to process.env.FACEBOOK_ENV or process.env.WHATSAPP_ENV or "farfalina"
        let tenantConfig = null;
        if (queryEnv) {
          tenantConfig = await prisma.channelConfig.findUnique({
            where: { channel_tenant_unique: { channel: "Facebook", environment: queryEnv } },
          });
        }

        if (!tenantConfig && pageId) {
          tenantConfig = await prisma.channelConfig.findFirst({
            where: { channel: "Facebook", facebookPageId: pageId },
          });
        }

        if (!tenantConfig) {
          tenantConfig = await prisma.channelConfig.findFirst({
            where: { channel: "Facebook", environment: process.env.FACEBOOK_ENV || process.env.WHATSAPP_ENV || "farfalina" },
          });
        }

        const environment = (tenantConfig?.environment || queryEnv || process.env.FACEBOOK_ENV || process.env.WHATSAPP_ENV || "farfalina").toLowerCase();
        const pageAccessToken = tenantConfig?.facebookPageToken || null;

        const messagingList = Array.isArray(entry?.messaging) ? entry.messaging : [];
        for (const messagingObj of messagingList) {
          const isEcho = Boolean(messagingObj?.message?.is_echo);
          const rawSenderId = messagingObj?.sender?.id;
          const rawRecipientId = messagingObj?.recipient?.id;
          const messageText = messagingObj?.message?.text || "";

          let mediaUrl: string | null = null;
          let mediaType: string | null = null;

          if (messagingObj?.message?.attachments && messagingObj.message.attachments.length > 0) {
            const att = messagingObj.message.attachments[0];
            mediaType = att?.type || "image";
            const ephemeralUrl = att?.payload?.url || null;

            if (ephemeralUrl) {
              const cached = await downloadAndCacheMetaMedia({
                url: ephemeralUrl,
                folder: "facebook",
                filenamePrefix: `fb_${environment}`,
                accessToken: pageAccessToken,
              });
              mediaUrl = cached ? cached.localUrl : ephemeralUrl;
            }
          }

          const messageMid = messagingObj?.message?.mid || null;

          if (rawSenderId && (messageText || mediaUrl)) {
            await processFacebookMessage({
              senderId: isEcho ? rawRecipientId : rawSenderId,
              text: messageText,
              mediaUrl,
              mediaType,
              isEcho,
              environment,
              pageAccessToken,
              externalId: messageMid,
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: { received: true }, code: "SUCCESS" }, { status: 200 });
  } catch (err) {
    console.error("[Webhook Facebook Exception]:", err);
    return NextResponse.json(
      { success: false, data: null, error: "Internal Server Error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

async function processFacebookMessage(input: ProcessFacebookMessageInput) {
  const parsed = ProcessFacebookMessageSchema.safeParse(input);
  if (!parsed.success) return;

  const { senderId, text, mediaUrl, mediaType, isEcho, environment, pageAccessToken, externalId } = parsed.data;
  if (!senderId) return;

  const displayMessage = text || (mediaType === "image" ? "[Imagen adjunta]" : "[Archivo adjunto]");
  const senderRole = isEcho ? "agent" : "customer";

  console.log(
    `[Webhook FB (${environment})] Procesando mensaje ${isEcho ? "(ECHO Saliente)" : "(Entrante)"} para cliente PSID ${senderId}: "${displayMessage}"`
  );

  // Exact externalId check
  if (externalId) {
    const existingMsg = await prisma.chatMessage.findFirst({
      where: { externalId },
    });
    if (existingMsg) {
      console.log(`[Webhook FB] Mensaje ${externalId} ya registrado en BD, deduplicando.`);
      return;
    }
  }

  let clientName = `Usuario Facebook (${senderId.slice(-4)})`;
  let profilePicUrl: string | null = null;

  if (!isEcho && pageAccessToken) {
    const profile = await fetchFacebookProfile(senderId, pageAccessToken);
    if (profile) {
      clientName = profile.name;
      profilePicUrl = profile.profilePic;
    }
  }

  const existingThread = await prisma.chatThread.findUnique({
    where: {
      chatthread_tenant_unique: {
        channel: "Facebook",
        phone: senderId,
        environment,
      },
    },
  });

  if (existingThread) {
    if (isEcho) {
      const recentDuplicate = await prisma.chatMessage.findFirst({
        where: {
          threadId: existingThread.id,
          sender: "agent",
          text: displayMessage,
          createdAt: { gte: new Date(Date.now() - 15000) },
        },
      });
      if (recentDuplicate) {
        console.log(`[Webhook FB Echo] Mensaje ya registrado por UI, deduplicando.`);
        if (externalId && !recentDuplicate.externalId) {
          await prisma.chatMessage.update({
            where: { id: recentDuplicate.id },
            data: { externalId },
          });
        }
        return;
      }
    }

    await prisma.chatMessage.create({
      data: {
        threadId: existingThread.id,
        sender: senderRole,
        text: displayMessage,
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        environment,
        externalId: externalId || undefined,
      },
    });

    const updateData: Record<string, unknown> = {
      lastMessage: displayMessage,
      updatedAt: new Date(),
    };

    if (!isEcho) {
      updateData.status = "Por Responder";
      const isDefaultName = existingThread.clientName.startsWith("Usuario Facebook");
      if (clientName && isDefaultName) {
        updateData.clientName = clientName;
      }
      if (profilePicUrl) {
        updateData.profilePicUrl = profilePicUrl;
      }
    }

    await prisma.chatThread.update({
      where: { id: existingThread.id },
      data: updateData,
    });
  } else {
    await prisma.chatThread.create({
      data: {
        clientName,
        phone: senderId,
        channel: "Facebook",
        status: isEcho ? "Pendientes" : "Por Responder",
        lastMessage: displayMessage,
        profilePicUrl,
        environment,
        messages: {
          create: {
            sender: senderRole,
            text: displayMessage,
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
            environment,
          },
        },
      },
    });
  }
}
