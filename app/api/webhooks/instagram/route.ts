import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getInstagramUserProfile, fetchInstagramProfile } from "@/lib/instagram-profile";
import { downloadAndCacheMetaMedia } from "@/lib/meta-graph-api";

const DEFAULT_VERIFY_TOKEN = "farfalina_carissma_webhook_verify_token_2026";

/**
 * Zod Schemas for incoming Meta Graph API Webhook payload (Instagram Direct)
 * Conforms to clean-code and AGENTS.md standards.
 */
const MetaAttachmentPayloadSchema = z.object({
  url: z.string().optional().nullable(),
}).passthrough();

const MetaAttachmentSchema = z.object({
  type: z.string().optional().nullable(),
  payload: MetaAttachmentPayloadSchema.optional().nullable(),
}).passthrough();

const MetaWebhookMessageSchema = z.object({
  mid: z.string().optional().nullable(),
  text: z.string().optional().nullable(),
  is_echo: z.boolean().optional().nullable(),
  attachments: z.array(MetaAttachmentSchema).optional().nullable(),
}).passthrough();

const MetaMessagingItemSchema = z.object({
  sender: z.object({
    id: z.string().optional().nullable(),
  }).optional().nullable(),
  recipient: z.object({
    id: z.string().optional().nullable(),
  }).optional().nullable(),
  timestamp: z.union([z.number(), z.string()]).optional().nullable(),
  message: MetaWebhookMessageSchema.optional().nullable(),
}).passthrough();

const MetaInstagramCommentChangeValueSchema = z.object({
  id: z.string().min(1, "El ID del comentario es requerido"),
  text: z.string().optional().default(""),
  from: z.object({
    id: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
  }).optional().nullable(),
  sender: z.object({
    id: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
  }).optional().nullable(),
  user: z.object({
    id: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
  }).optional().nullable(),
  media: z.union([
    z.object({
      id: z.string().optional().nullable(),
      media_product_type: z.string().optional().nullable(),
    }).passthrough(),
    z.string(),
  ]).optional().nullable(),
  media_id: z.string().optional().nullable(),
  post_id: z.string().optional().nullable(),
  parent_id: z.string().optional().nullable(),
  created_time: z.union([z.number(), z.string()]).optional().nullable(),
  timestamp: z.union([z.number(), z.string()]).optional().nullable(),
}).passthrough();

type MetaInstagramCommentChangeValue = z.infer<typeof MetaInstagramCommentChangeValueSchema>;

const MetaChangeValueSchema = z.object({
  sender: z.object({ id: z.string().optional().nullable(), username: z.string().optional().nullable() }).optional().nullable(),
  from: z.object({ id: z.string().optional().nullable(), username: z.string().optional().nullable() }).optional().nullable(),
  recipient: z.object({ id: z.string().optional().nullable() }).optional().nullable(),
  message: z.union([
    z.string(),
    z.object({
      mid: z.string().optional().nullable(),
      text: z.string().optional().nullable(),
    }).passthrough(),
  ]).optional().nullable(),
  media: z.union([
    z.object({ id: z.string().optional().nullable(), media_product_type: z.string().optional().nullable() }).passthrough(),
    z.string(),
  ]).optional().nullable(),
  media_id: z.string().optional().nullable(),
  post_id: z.string().optional().nullable(),
  parent_id: z.string().optional().nullable(),
  created_time: z.union([z.number(), z.string()]).optional().nullable(),
  timestamp: z.union([z.number(), z.string()]).optional().nullable(),
  text: z.string().optional().nullable(),
  id: z.string().optional().nullable(),
}).passthrough();

const MetaChangeItemSchema = z.object({
  field: z.string().optional().nullable(),
  value: MetaChangeValueSchema.optional().nullable(),
}).passthrough();

const MetaEntryItemSchema = z.object({
  id: z.string().optional().nullable(),
  time: z.number().optional().nullable(),
  messaging: z.array(MetaMessagingItemSchema).optional().nullable(),
  changes: z.array(MetaChangeItemSchema).optional().nullable(),
}).passthrough();

const MetaInstagramWebhookPayloadSchema = z.object({
  object: z.string().optional().nullable(),
  entry: z.array(MetaEntryItemSchema).optional().nullable(),
  field: z.string().optional().nullable(),
  value: MetaChangeValueSchema.optional().nullable(),
}).passthrough();

type MetaInstagramWebhookPayload = z.infer<typeof MetaInstagramWebhookPayloadSchema>;

const ProcessInstagramMessageSchema = z.object({
  senderId: z.string().min(1),
  recipientId: z.string().optional(),
  text: z.string().default(""),
  mediaUrl: z.string().nullable().optional(),
  mediaType: z.string().nullable().optional(),
  isEcho: z.boolean().default(false),
  environment: z.string().default("farfalina"),
  instagramAccessToken: z.string().nullable().optional(),
  externalId: z.string().nullable().optional(),
  timestamp: z.union([z.number(), z.string(), z.date()]).nullable().optional(),
});

type ProcessInstagramMessageInput = z.infer<typeof ProcessInstagramMessageSchema>;

// GET handler for Meta Webhook Verification (Instagram Direct)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    console.log(`[Webhook IG GET] Verificación solicitada: mode=${mode}, token=${token ? "****" : "null"}`);

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
          channel: "Instagram",
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
    console.error("[Webhook IG GET Exception]:", err);
    return NextResponse.json(
      { success: false, data: null, error: "Internal Server Error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// POST handler for incoming Instagram Direct Messages & Outbound Echoes
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

    let rawJson: unknown;
    try {
      rawJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, data: null, error: "Bad Request: Malformed JSON", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const payloadResult = MetaInstagramWebhookPayloadSchema.safeParse(rawJson);
    if (!payloadResult.success) {
      return NextResponse.json(
        { success: false, data: null, error: "Bad Request: Invalid payload structure", code: "INVALID_PAYLOAD" },
        { status: 400 }
      );
    }

    const body = payloadResult.data;

    console.log("[Webhook IG POST] Payload recibido de Meta:", JSON.stringify(body, null, 2));

    const { searchParams } = new URL(req.url);
    const rawQueryEnv = searchParams.get("env") || searchParams.get("tenant");
    const queryEnv = rawQueryEnv?.toLowerCase();

    // Format 0: Direct top-level sample payload (from Meta "Probar" modal)
    if ((body.field === "comments" || body.field === "live_comments") && body.value) {
      const defaultEnv = queryEnv || process.env.INSTAGRAM_ENV || process.env.WHATSAPP_ENV || "farfalina";
      await processInstagramCommentEvent({
        changeValue: body.value,
        environment: defaultEnv,
      });
      return NextResponse.json({ success: true, data: { received: true }, code: "SUCCESS" }, { status: 200 });
    }

    if (body.field === "messages" && body.value) {
      const val = body.value;
      const senderId = val.sender?.id || "1234";
      const messageText =
        (typeof val.message === "object" ? val.message?.text : typeof val.message === "string" ? val.message : val.text) ||
        "Mensaje de prueba Instagram";
      const mid = (typeof val.message === "object" ? val.message?.mid : undefined) || val.id || null;
      const defaultEnv = queryEnv || process.env.INSTAGRAM_ENV || process.env.WHATSAPP_ENV || "farfalina";
      await processInstagramMessage({
        senderId,
        recipientId: val.recipient?.id || undefined,
        text: messageText,
        isEcho: false,
        environment: defaultEnv,
        externalId: mid,
      });
      return NextResponse.json({ success: true, data: { received: true }, code: "SUCCESS" }, { status: 200 });
    }

    const entries = Array.isArray(body.entry) ? body.entry : [];

    if (body.object === "instagram" || entries.length > 0) {
      for (const entry of entries) {
        const igAccountId = typeof entry?.id === "string" ? entry.id : undefined;

        // Multi-tenant resolution:
        // Priority 1: URL Query parameter (e.g. ?env=carissma)
        // Priority 2: Match ChannelConfig by instagramAccountId
        // Priority 3: Fallback to process.env.INSTAGRAM_ENV or process.env.WHATSAPP_ENV or "farfalina"
        let tenantConfig = null;
        if (queryEnv) {
          tenantConfig = await prisma.channelConfig.findUnique({
            where: { channel_tenant_unique: { channel: "Instagram", environment: queryEnv } },
          });
        }

        if (!tenantConfig && igAccountId) {
          tenantConfig = await prisma.channelConfig.findFirst({
            where: { channel: "Instagram", instagramAccountId: igAccountId },
          });
        }

        if (!tenantConfig) {
          tenantConfig = await prisma.channelConfig.findFirst({
            where: { channel: "Instagram", environment: process.env.INSTAGRAM_ENV || process.env.WHATSAPP_ENV || "farfalina" },
          });
        }

        const environment = (tenantConfig?.environment || queryEnv || process.env.INSTAGRAM_ENV || process.env.WHATSAPP_ENV || "farfalina").toLowerCase();
        const igToken = tenantConfig?.instagramAccessToken || null;

        // Format 1: Messaging array (Standard Direct Messages & Echoes)
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
                folder: "instagram",
                filenamePrefix: `ig_${environment}`,
                accessToken: igToken,
              });
              mediaUrl = cached ? cached.localUrl : ephemeralUrl;
            }
          }

          const messageMid = messagingObj?.message?.mid || null;
          const msgTimestamp = messagingObj?.timestamp;

          if (rawSenderId && (messageText || mediaUrl)) {
            await processInstagramMessage({
              senderId: isEcho ? (rawRecipientId || rawSenderId) : rawSenderId,
              recipientId: isEcho ? rawSenderId : (rawRecipientId || undefined),
              text: messageText,
              mediaUrl,
              mediaType,
              isEcho,
              environment,
              instagramAccessToken: igToken,
              externalId: messageMid,
              timestamp: msgTimestamp,
            });
          }
        }

        // Format 2: Changes array (Instagram feed/messages/comments)
        const changesList = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changesList) {
          const val = change?.value;
          if (!val) continue;

          // Distinct routing: Comments vs Direct Messages
          const field = change?.field;
          if (field === "comments" || field === "live_comments") {
            await processInstagramCommentEvent({
              changeValue: val,
              environment,
              accessToken: igToken,
              accountId: igAccountId,
            });
            continue;
          }

          // Direct message routing (messages or unspecified field)
          if (field === "messages" || !field) {
            const senderId = val.sender?.id || val.from?.id;
            const rawMsg = val.message;
            const messageText = (typeof rawMsg === "object" ? rawMsg?.text : typeof rawMsg === "string" ? rawMsg : undefined) || val.text || "";
            const changeMid = (typeof rawMsg === "object" ? rawMsg?.mid : undefined) || val.id || null;

            if (senderId && messageText) {
              await processInstagramMessage({
                senderId,
                text: messageText,
                isEcho: false,
                environment,
                instagramAccessToken: igToken,
                externalId: changeMid,
              });
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: { received: true }, code: "SUCCESS" }, { status: 200 });
  } catch (err) {
    console.error("[Webhook Instagram Exception]:", err);
    return NextResponse.json(
      { success: false, data: null, error: "Internal Server Error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Processes an incoming or outgoing Instagram Direct message:
 * - Deduplicates messages by externalId.
 * - Resolves profile info (username, displayName, avatar).
 * - Creates or links CRMClient in SQLite dev.db.
 * - Creates or updates ChatThread (setting lastMessageAt, unreadCount).
 * - Stores ChatMessage with guaranteed non-null externalId and normalized timestamp.
 *
 * @param input - Validated message payload
 */
async function processInstagramMessage(input: ProcessInstagramMessageInput) {
  const parsed = ProcessInstagramMessageSchema.safeParse(input);
  if (!parsed.success) return;

  const { senderId, text, mediaUrl, mediaType, isEcho, environment, instagramAccessToken, externalId, timestamp } = parsed.data;
  if (!senderId) return;

  const normalizedTimestamp = timestamp
    ? new Date(typeof timestamp === "number" ? (timestamp < 10000000000 ? timestamp * 1000 : timestamp) : timestamp)
    : new Date();

  const finalExternalId = externalId || `ig_${senderId}_${Date.now()}`;
  const displayMessage = text || (mediaType === "image" ? "[Imagen adjunta]" : "[Archivo adjunto]");
  const senderRole = isEcho ? "agent" : "customer";

  console.log(
    `[Webhook IG (${environment})] Procesando mensaje ${isEcho ? "(ECHO Saliente)" : "(Entrante)"} para cliente IGSID ${senderId}: "${displayMessage}" (externalId: ${finalExternalId})`
  );

  // Exact externalId check
  if (externalId) {
    const existingMsg = await prisma.chatMessage.findFirst({
      where: { externalId },
    });
    if (existingMsg) {
      console.log(`[Webhook IG] Mensaje ${externalId} ya registrado en BD, deduplicando.`);
      return;
    }
  }

  let clientName = `Cliente Instagram (${senderId.slice(-4)})`;
  let profilePicUrl: string | null = null;
  let instagramUsername: string | null = null;
  let instagramDisplayName: string | null = null;

  // Retrieve configs for tokens if not provided
  let token = instagramAccessToken;
  if (!token) {
    const config = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Instagram", environment } },
    });
    token = config?.instagramAccessToken || null;
  }

  const fbConfig = await prisma.channelConfig.findUnique({
    where: { channel_tenant_unique: { channel: "Facebook", environment } },
  });

  if (!isEcho && (token || fbConfig?.facebookPageToken)) {
    try {
      const profile = await getInstagramUserProfile(senderId, token || "", fbConfig?.facebookPageToken || null);
      if (profile) {
        instagramUsername = profile.username || null;
        instagramDisplayName = profile.name || null;
        clientName = profile.username ? `@${profile.username}` : (profile.name || senderId);
        profilePicUrl = profile.profilePicUrl || profile.profilePic || null;
      }
    } catch (profileErr) {
      console.warn(`[Webhook IG] Error obteniendo perfil de Instagram para ${senderId}:`, profileErr);
    }
  }

  // Create or link CRMClient in SQLite (prisma/dev.db)
  try {
    const existingClient = await prisma.cRMClient.findUnique({
      where: { phone: senderId },
    });

    const metadataParts = [
      "Origen: INSTAGRAM",
      "Canal: Instagram Direct",
      `IGSID: ${senderId}`,
    ];
    if (instagramUsername) metadataParts.push(`Username: @${instagramUsername}`);
    if (instagramDisplayName && instagramDisplayName !== `@${instagramUsername}`) {
      metadataParts.push(`Nombre: ${instagramDisplayName}`);
    }
    if (profilePicUrl) metadataParts.push(`Avatar: ${profilePicUrl}`);
    const igOriginNote = metadataParts.join(" | ");

    if (!existingClient) {
      await prisma.cRMClient.create({
        data: {
          name: clientName,
          phone: senderId,
          notes: igOriginNote,
          loyaltyTier: "Bronce",
        },
      });
      console.log(`[Webhook IG CRM] Nuevo cliente registrado en CRMClient: ${clientName} (${senderId})`);
    } else {
      const isDefaultName = existingClient.name.startsWith("Cliente Instagram");
      const hasBetterName = clientName && !clientName.startsWith("Cliente Instagram");
      const updateData: { name?: string; notes?: string } = {};

      if (hasBetterName || isDefaultName) {
        updateData.name = clientName;
      }

      if (existingClient.notes) {
        let updatedNotes = existingClient.notes;
        if (!updatedNotes.includes("INSTAGRAM")) {
          updatedNotes = `${updatedNotes} | ${igOriginNote}`;
        }
        if (instagramUsername && !updatedNotes.includes(`@${instagramUsername}`)) {
          updatedNotes = `${updatedNotes} | Username: @${instagramUsername}`;
        }
        if (profilePicUrl && !updatedNotes.includes(profilePicUrl)) {
          updatedNotes = `${updatedNotes} | Avatar: ${profilePicUrl}`;
        }
        if (updatedNotes !== existingClient.notes) {
          updateData.notes = updatedNotes;
        }
      } else {
        updateData.notes = igOriginNote;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.cRMClient.update({
          where: { id: existingClient.id },
          data: updateData,
        });
        console.log(`[Webhook IG CRM] Cliente actualizado en CRMClient: ${senderId}`);
      }
    }
  } catch (crmErr) {
    console.warn(`[Webhook IG CRM] Error sincronizando CRMClient para ${senderId}:`, crmErr);
  }

  const existingThread = await prisma.chatThread.findUnique({
    where: {
      chatthread_tenant_unique: {
        channel: "Instagram",
        phone: senderId,
        environment,
      },
    },
  });

  if (existingThread) {
    // Avoid creating duplicate if recent identical agent message was already saved via sendChatMessageAction
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
        console.log(`[Webhook IG Echo] Mensaje ya registrado recientemente por UI, deduplicando.`);
        if (finalExternalId && !recentDuplicate.externalId) {
          await prisma.chatMessage.update({
            where: { id: recentDuplicate.id },
            data: { externalId: finalExternalId },
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
        externalId: finalExternalId,
        timestamp: normalizedTimestamp,
        createdAt: normalizedTimestamp,
      },
    });

    const updateData: Record<string, unknown> = {
      lastMessage: displayMessage,
      lastMessageAt: normalizedTimestamp,
      updatedAt: new Date(),
    };

    if (!isEcho) {
      updateData.status = "Por Responder";
      updateData.unreadCount = { increment: 1 };
      const isDefaultName = existingThread.clientName.startsWith("Cliente Instagram");
      if (clientName && (!clientName.startsWith("Cliente Instagram") || isDefaultName)) {
        updateData.clientName = clientName;
      }
      if (profilePicUrl) {
        updateData.profilePicUrl = profilePicUrl;
      }
    } else {
      if (profilePicUrl && !existingThread.profilePicUrl) {
        updateData.profilePicUrl = profilePicUrl;
      }
      if (clientName && !clientName.startsWith("Cliente Instagram") && existingThread.clientName.startsWith("Cliente Instagram")) {
        updateData.clientName = clientName;
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
        channel: "Instagram",
        status: isEcho ? "Pendientes" : "Por Responder",
        lastMessage: displayMessage,
        lastMessageAt: normalizedTimestamp,
        unreadCount: isEcho ? 0 : 1,
        profilePicUrl,
        environment,
        messages: {
          create: {
            sender: senderRole,
            text: displayMessage,
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
            environment,
            externalId: finalExternalId,
            timestamp: normalizedTimestamp,
            createdAt: normalizedTimestamp,
          },
        },
      },
    });
  }
}

interface ProcessInstagramCommentInput {
  changeValue: unknown;
  environment: string;
  accessToken?: string | null;
  accountId?: string | null;
}

/**
 * Processes an incoming Instagram Comment event from Meta Webhook (field: "comments").
 *
 * 1. Validates comment change payload using Zod.
 * 2. Extracts post / media ID and comment metadata (author username, text, parent_id, timestamp).
 * 3. Enriches author profile (avatar & verified username) if from.id and accessToken are available.
 * 4. Upserts InstagramPost record (creating default or updating count/timestamp).
 * 5. Optionally queries Meta Graph API to enrich post metadata (caption, media_url, permalink).
 * 6. Upserts InstagramComment, linking to parentComment if nested reply.
 * 7. Recounts comments for the post and updates commentsCount.
 *
 * Direct message threads (ChatThread/ChatMessage) are completely isolated and untouched.
 */
async function processInstagramCommentEvent(input: ProcessInstagramCommentInput) {
  const parsed = MetaInstagramCommentChangeValueSchema.safeParse(input.changeValue);
  if (!parsed.success) {
    console.warn("[Instagram Comment Webhook] Payload inválido:", parsed.error.issues);
    return;
  }

  const val = parsed.data;
  const commentId = val.id;
  const commentText = val.text || "";

  // Resolve media/post ID
  let mediaId: string | null = null;
  let mediaProductType: string | null = null;
  if (val.media) {
    if (typeof val.media === "string") {
      mediaId = val.media;
    } else if (val.media.id) {
      mediaId = val.media.id;
      mediaProductType = val.media.media_product_type || null;
    }
  }
  if (!mediaId) {
    mediaId = val.media_id || val.post_id || null;
  }

  if (!mediaId) {
    console.warn(`[Instagram Comment Webhook] Comentario ${commentId} sin mediaId asociado`);
    return;
  }

  const fromObj = val.from || val.sender || val.user;
  const fromId = fromObj?.id || null;
  let fromUsername = fromObj?.username || null;
  let profilePicUrl: string | null = null;

  // Resolve user profile info if fromId and token are available
  if (fromId && input.accessToken) {
    try {
      const profile = await getInstagramUserProfile(fromId, input.accessToken);
      if (profile) {
        if (!fromUsername && profile.username) fromUsername = profile.username;
        if (profile.profilePicUrl) profilePicUrl = profile.profilePicUrl;
      }
    } catch (profileErr) {
      console.warn(`[Instagram Comment Webhook] Error al obtener perfil para ${fromId}:`, profileErr);
    }
  }

  // 1. Upsert InstagramPost
  const post = await prisma.instagramPost.upsert({
    where: { instagramId: mediaId },
    update: {
      updatedAt: new Date(),
    },
    create: {
      instagramId: mediaId,
      mediaType: mediaProductType || "FEED",
      environment: input.environment,
      commentsCount: 0,
    },
  });

  // Attempt to enrich post data from Meta Graph API if token is available
  if (input.accessToken && (!post.permalink || !post.caption)) {
    try {
      const postUrl = `https://graph.instagram.com/v22.0/${encodeURIComponent(mediaId)}?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&access_token=${encodeURIComponent(input.accessToken)}`;
      const postRes = await fetch(postUrl, { signal: AbortSignal.timeout(6000) });
      const postData = await postRes.json();
      if (!postData.error && postData.id) {
        await prisma.instagramPost.update({
          where: { id: post.id },
          data: {
            caption: postData.caption || post.caption,
            mediaType: postData.media_type || post.mediaType,
            mediaUrl: postData.media_url || post.mediaUrl,
            thumbnailUrl: postData.thumbnail_url || post.thumbnailUrl,
            permalink: postData.permalink || post.permalink,
            timestamp: postData.timestamp ? new Date(postData.timestamp) : post.timestamp,
          },
        });
      }
    } catch {
      // Ignore Meta API errors on mock/restricted media
    }
  }

  // 2. Resolve parent comment if nested reply
  let internalParentId: string | null = null;
  const parentInstagramId = val.parent_id || null;
  const isReply = Boolean(parentInstagramId);
  if (parentInstagramId) {
    const parentComment = await prisma.instagramComment.findUnique({
      where: { instagramId: parentInstagramId },
    });
    if (parentComment) {
      internalParentId = parentComment.id;
    }
  }

  // Parse comment timestamp
  let commentDate = new Date();
  const rawTime = val.created_time || val.timestamp;
  if (rawTime) {
    if (typeof rawTime === "number") {
      commentDate = new Date(rawTime < 10000000000 ? rawTime * 1000 : rawTime);
    } else {
      const parsedD = new Date(rawTime);
      if (!isNaN(parsedD.getTime())) commentDate = parsedD;
    }
  }

  // 3. Upsert InstagramComment
  await prisma.instagramComment.upsert({
    where: { instagramId: commentId },
    update: {
      text: commentText,
      fromId: fromId || undefined,
      fromUsername: fromUsername || undefined,
      userProfilePic: profilePicUrl || undefined,
      parentId: internalParentId || undefined,
      isReply,
      updatedAt: new Date(),
    },
    create: {
      instagramId: commentId,
      postId: post.id,
      text: commentText,
      fromId,
      fromUsername,
      userProfilePic: profilePicUrl,
      parentId: internalParentId,
      isReply,
      environment: input.environment,
      timestamp: commentDate,
    },
  });

  // 4. Update post commentsCount
  const totalComments = await prisma.instagramComment.count({
    where: { postId: post.id },
  });
  await prisma.instagramPost.update({
    where: { id: post.id },
    data: { commentsCount: totalComments },
  });

  console.log(`[Instagram Comment Webhook] Comentario ${commentId} registrado en post ${mediaId} (${totalComments} comentarios)`);
}
