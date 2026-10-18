import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import {
  downloadMetaWhatsAppMedia,
  formatWhatsAppPhoneDisplay,
  markMetaWhatsAppMessageAsRead,
  normalizeWhatsAppPhone,
} from "@/lib/meta-whatsapp";

// Default fallback verify token if not configured in .env or database
const DEFAULT_VERIFY_TOKEN = "farfalina_carissma_webhook_verify_token_2026";

/**
 * GET Handler: Meta Webhook Verification Challenge
 * Meta calls this endpoint with hub.mode, hub.verify_token, and hub.challenge to verify ownership.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const queryEnv = searchParams.get("env") || searchParams.get("tenant");

    console.log(`[Webhook WhatsApp GET] Solicitud de verificación: mode=${mode}, token=${token ? "****" : "null"}, env=${queryEnv || "default"}`);

    if (mode !== "subscribe" || !token) {
      return NextResponse.json(
        { success: false, data: null, error: "Bad Request: Missing mode or token", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // 1. Check environment variable
    const envToken = process.env.META_VERIFY_TOKEN;
    if (envToken && token === envToken) {
      console.log("[Webhook WhatsApp GET] Verificación exitosa vía META_VERIFY_TOKEN en .env");
      return new NextResponse(challenge || "OK", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 2. Check fallback default token
    if (token === DEFAULT_VERIFY_TOKEN) {
      console.log("[Webhook WhatsApp GET] Verificación exitosa vía DEFAULT_VERIFY_TOKEN");
      return new NextResponse(challenge || "OK", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    // 3. Check ChannelConfig in DB for matching verifyToken (scoped to tenant or global)
    const whereClause: { channel: string; verifyToken: string; environment?: string } = {
      channel: "WhatsApp",
      verifyToken: token,
    };
    if (queryEnv) {
      whereClause.environment = queryEnv.toLowerCase();
    }

    let dbConfig = await prisma.channelConfig.findFirst({
      where: whereClause,
    });

    if (!dbConfig && queryEnv) {
      // Fallback: check any WhatsApp config matching this verifyToken
      dbConfig = await prisma.channelConfig.findFirst({
        where: {
          channel: "WhatsApp",
          verifyToken: token,
        },
      });
    }

    if (dbConfig) {
      console.log(`[Webhook WhatsApp GET] Verificación exitosa para inquilino: ${dbConfig.environment}`);
      return new NextResponse(challenge || "OK", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    console.warn("[Webhook WhatsApp GET] Token de verificación no coincide:", token);
    return NextResponse.json(
      { success: false, data: null, error: "Forbidden: Token mismatch", code: "FORBIDDEN" },
      { status: 403 }
    );
  } catch (err) {
    console.error("[Webhook WhatsApp GET Exception]:", err);
    return NextResponse.json(
      { success: false, data: null, error: "Internal Server Error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST Handler: Inbound Meta WhatsApp Cloud API Webhook Events
 * Receives messages, status updates, media attachments, and routes them to Farfalina or Carissma.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const appSecret = process.env.META_APP_SECRET;

    // Validate Meta SHA256 HMAC signature using timing-safe comparison if configured
    if (appSecret && signature) {
      const hmac = crypto.createHmac("sha256", appSecret);
      const digest = "sha256=" + hmac.update(rawBody).digest("hex");
      const expectedBuffer = Buffer.from(digest);
      const actualBuffer = Buffer.from(signature);

      if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
        console.warn("[Webhook WhatsApp POST] Firma inválida rechazada:", signature);
        return NextResponse.json(
          { success: false, data: null, error: "Unauthorized: Invalid HMAC signature", code: "UNAUTHORIZED" },
          { status: 401 }
        );
      }
    }

    // Safely parse JSON payload
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, data: null, error: "Bad Request: Malformed JSON", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    // Non-WhatsApp payloads return 200 OK to acknowledge receipt and avoid webhook disablement
    if (body.object !== "whatsapp_business_account" && !body.entry) {
      return NextResponse.json({ success: true, data: { received: true }, code: "SUCCESS" });
    }

    const { searchParams } = new URL(req.url);
    const rawQueryEnv = searchParams.get("env") || searchParams.get("tenant");
    const queryEnv = rawQueryEnv?.toLowerCase();

    const entries = Array.isArray(body.entry) ? body.entry : [];

    for (const entry of entries) {
      const wabaId = typeof entry?.id === "string" ? entry.id : undefined;
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];

      for (const change of changes) {
        if (change.field !== "messages") continue;

        const value = change.value;
        if (!value) continue;

        const metadata = (value.metadata || {}) as { phone_number_id?: string };
        const phoneNumberId = metadata.phone_number_id;
        const contacts = (value.contacts || []) as Array<{ profile?: { name?: string }; wa_id?: string }>;
        const messages = (value.messages || []) as Array<{
          id: string;
          from: string;
          timestamp: string;
          type: string;
          text?: { body?: string };
          image?: { id: string; caption?: string; mime_type?: string };
          video?: { id: string; caption?: string; mime_type?: string };
          audio?: { id: string; mime_type?: string };
          document?: { id: string; caption?: string; filename?: string; mime_type?: string };
          sticker?: { id: string; mime_type?: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        }>;

        // Resolve Tenant Environment:
        // Priority 1: URL Query parameter (e.g. ?env=carissma)
        // Priority 2: Match ChannelConfig by phoneNumberId
        // Priority 3: Match ChannelConfig by wabaId
        // Priority 4: Fallback to process.env.WHATSAPP_ENV or "farfalina"
        let tenantConfig = null;
        if (queryEnv) {
          tenantConfig = await prisma.channelConfig.findUnique({
            where: { channel_tenant_unique: { channel: "WhatsApp", environment: queryEnv } },
          });
        }

        if (!tenantConfig && phoneNumberId) {
          tenantConfig = await prisma.channelConfig.findFirst({
            where: {
              channel: "WhatsApp",
              whatsappPhoneNumberId: phoneNumberId,
            },
          });
        }

        if (!tenantConfig && wabaId) {
          tenantConfig = await prisma.channelConfig.findFirst({
            where: {
              channel: "WhatsApp",
              whatsappWabaId: wabaId,
            },
          });
        }

        const environment = (tenantConfig?.environment || queryEnv || process.env.WHATSAPP_ENV || "farfalina").toLowerCase();
        const accessToken = tenantConfig?.whatsappAccessToken || process.env.META_WHATSAPP_TOKEN || "";

        console.log(`[Webhook WhatsApp POST] Evento recibido para inquilino '${environment}' (Phone ID: ${phoneNumberId || "N/A"})`);

        // Process incoming customer messages
        for (const msg of messages) {
          const rawSender = msg.from;
          if (!rawSender) continue;

          const normalizedSender = normalizeWhatsAppPhone(rawSender);
          const matchedContact = contacts.find((c) => c.wa_id === rawSender || c.wa_id === normalizedSender);
          const profileName = matchedContact?.profile?.name?.trim();
          const formattedPhone = formatWhatsAppPhoneDisplay(normalizedSender);

          let clientName = profileName ? `${profileName} (${formattedPhone})` : formattedPhone;
          if (!clientName) clientName = "Cliente WhatsApp";

          let messageText = "";
          let mediaUrl: string | null = null;
          let mediaType: string | null = null;

          if (msg.type === "text" && msg.text?.body) {
            messageText = msg.text.body;
          } else if (msg.type === "image" && msg.image?.id) {
            mediaType = "image";
            messageText = msg.image.caption || "";
            if (accessToken) {
              const dlRes = await downloadMetaWhatsAppMedia({
                mediaId: msg.image.id,
                accessToken,
                filenamePrefix: `wa_${environment}`,
              });
              if (dlRes.success && dlRes.data?.localUrl) {
                mediaUrl = dlRes.data.localUrl;
              }
            }
          } else if (msg.type === "video" && msg.video?.id) {
            mediaType = "video";
            messageText = msg.video.caption || "";
            if (accessToken) {
              const dlRes = await downloadMetaWhatsAppMedia({
                mediaId: msg.video.id,
                accessToken,
                filenamePrefix: `wa_${environment}`,
              });
              if (dlRes.success && dlRes.data?.localUrl) {
                mediaUrl = dlRes.data.localUrl;
              }
            }
          } else if (msg.type === "audio" && msg.audio?.id) {
            mediaType = "audio";
            if (accessToken) {
              const dlRes = await downloadMetaWhatsAppMedia({
                mediaId: msg.audio.id,
                accessToken,
                filenamePrefix: `wa_${environment}`,
              });
              if (dlRes.success && dlRes.data?.localUrl) {
                mediaUrl = dlRes.data.localUrl;
              }
            }
          } else if (msg.type === "document" && msg.document?.id) {
            mediaType = "document";
            messageText = msg.document.caption || msg.document.filename || "";
            if (accessToken) {
              const dlRes = await downloadMetaWhatsAppMedia({
                mediaId: msg.document.id,
                accessToken,
                filenamePrefix: `wa_${environment}`,
              });
              if (dlRes.success && dlRes.data?.localUrl) {
                mediaUrl = dlRes.data.localUrl;
              }
            }
          } else if (msg.type === "sticker" && msg.sticker?.id) {
            mediaType = "sticker";
            if (accessToken) {
              const dlRes = await downloadMetaWhatsAppMedia({
                mediaId: msg.sticker.id,
                accessToken,
                filenamePrefix: `wa_${environment}`,
              });
              if (dlRes.success && dlRes.data?.localUrl) {
                mediaUrl = dlRes.data.localUrl;
              }
            }
          } else if (msg.type === "location" && msg.location) {
            const { latitude, longitude, name, address } = msg.location;
            messageText = `📍 Ubicación compartida: ${name || ""} ${address ? `(${address})` : ""}\nhttps://maps.google.com/?q=${latitude},${longitude}`;
          } else if (msg.type === "interactive" && msg.interactive) {
            messageText =
              msg.interactive.button_reply?.title ||
              msg.interactive.list_reply?.title ||
              "[Respuesta interactiva]";
          }

          const displayMessage =
            messageText || (mediaType ? `[${mediaType.toUpperCase()}]` : "[Mensaje sin texto]");

          // Find or create ChatThread scoped to this tenant
          const existingThread = await prisma.chatThread.findUnique({
            where: {
              chatthread_tenant_unique: {
                channel: "WhatsApp",
                phone: normalizedSender,
                environment,
              },
            },
          });

          if (existingThread) {
            // Deduplicate by Meta message ID (exact) or recent text match (15s window) to prevent webhook retry duplications
            const alreadyExists = await prisma.chatMessage.findFirst({
              where: {
                OR: [
                  ...(msg.id ? [{ externalId: msg.id }] : []),
                  {
                    threadId: existingThread.id,
                    sender: "customer",
                    text: displayMessage,
                    createdAt: { gte: new Date(Date.now() - 15000) },
                  },
                ],
              },
            });

            if (!alreadyExists) {
              await prisma.chatMessage.create({
                data: {
                  threadId: existingThread.id,
                  sender: "customer",
                  text: displayMessage,
                  mediaUrl,
                  mediaType,
                  environment,
                  externalId: msg.id || undefined,
                },
              });

              const updateData: Record<string, unknown> = {
                lastMessage: displayMessage,
                status: "Por Responder",
                updatedAt: new Date(),
              };

              // Only update client name if currently default/phone-based (preserve manual agent renames)
              const isDefaultName =
                existingThread.clientName.startsWith("Cliente WhatsApp") ||
                existingThread.clientName.startsWith("+") ||
                existingThread.clientName === formattedPhone;

              if (profileName && isDefaultName && !existingThread.clientName.includes(profileName)) {
                updateData.clientName = clientName;
              }

              await prisma.chatThread.update({
                where: { id: existingThread.id },
                data: updateData,
              });
            }
          } else {
            await prisma.chatThread.create({
              data: {
                clientName,
                phone: normalizedSender,
                channel: "WhatsApp",
                status: "Por Responder",
                lastMessage: displayMessage,
                assignedAgent: "Agente General",
                environment,
                messages: {
                  create: {
                    sender: "customer",
                    text: displayMessage,
                    mediaUrl,
                    mediaType,
                    environment,
                    externalId: msg.id || undefined,
                  },
                },
              },
            });
          }

          // Mark message as read on Meta Cloud API asynchronously
          if (phoneNumberId && accessToken && msg.id) {
            markMetaWhatsAppMessageAsRead({
              phoneNumberId,
              accessToken,
              messageId: msg.id,
            }).catch(() => {});
          }
        }
      }
    }

    return NextResponse.json(
      { success: true, data: { received: true }, code: "SUCCESS" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[Webhook WhatsApp POST Exception]:", err);
    return NextResponse.json(
      { success: false, data: null, error: "Internal Server Error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
