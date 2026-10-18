"use server";

import { prisma } from "@/lib/db";
import { z } from "zod";
import { ActionResponse } from "@/types/action-response";
import {
  replyInstagramCommentPublic,
  replyInstagramCommentPrivate,
  fetchInstagramMediaFromGraphApi,
  fetchInstagramCommentsFromGraphApi,
  fetchHistoricalInstagramConversations,
  downloadAndCacheMetaMedia,
} from "@/lib/meta-graph-api";
import { getInstagramUserProfile } from "@/lib/instagram-profile";


const SendMessageSchema = z.object({
  threadId: z.string().min(1, "El ID de la conversación es requerido"),
  sender: z.enum(["customer", "bot", "agent", "AGENT"]).default("agent"),
  text: z.string().default(""),
  mediaBase64: z.string().optional().nullable(),
  mediaMimeType: z.string().optional().nullable(),
  mediaFileName: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  mediaUrl: z.string().optional().nullable(),
});


export type SendMessageInput = z.infer<typeof SendMessageSchema>;



export async function getChatThreadsAction(
  statusFilter?: string,
  environment: string = "farfalina"
): Promise<ActionResponse> {
  try {
    const whereCondition: import("@prisma/client").Prisma.ChatThreadWhereInput = {
      environment: environment,
      NOT: [
        { phone: "status@broadcast" },
        { phone: { contains: "@broadcast" } },
        { clientName: { contains: "@broadcast" } },
        { channel: "TikTok" },
        { clientName: "Mensajes" },
        { phone: "mensajes" },
        { clientName: "Conversación activa" },
      ],
    };

    if (statusFilter && statusFilter !== "Todos") {
      whereCondition.status = statusFilter;
    }

    // Auto-purge any 'Conversación activa' junk records from chat messages if present
    await prisma.chatMessage.deleteMany({
      where: {
        OR: [
          { text: "Conversación activa" },
          { text: "Conversación activa." },
          { text: { startsWith: "Conversación activa" } },
        ],
      },
    }).catch(() => {});

    const threads = await prisma.chatThread.findMany({
      where: whereCondition,
      include: {
        messages: {
          where: {
            NOT: [
              { text: "Conversación activa" },
              { text: "Conversación activa." },
              { text: { startsWith: "Conversación activa" } },
            ],
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Consolidate duplicate threads with the same phone number (e.g. Facebook vs WhatsApp)
    const phoneMap = new Map<string, typeof threads>();
    for (const thread of threads) {
      const digits = thread.phone.replace(/[^0-9]/g, "");
      if (digits.length >= 7) {
        const key = digits.slice(-8);
        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key)!.push(thread);
      }
    }

    const duplicateThreadIds = new Set<string>();

    for (const [, group] of phoneMap.entries()) {
      if (group.length > 1) {
        // Sort: WhatsApp first, then thread with more messages, then more recently updated
        group.sort((a, b) => {
          if (a.channel === "WhatsApp" && b.channel !== "WhatsApp") return -1;
          if (b.channel === "WhatsApp" && a.channel !== "WhatsApp") return 1;
          if (b.messages.length !== a.messages.length) return b.messages.length - a.messages.length;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });

        const primary = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          duplicateThreadIds.add(dup.id);
          for (const msg of dup.messages) {
            const alreadyHas = primary.messages.some(
              (m) => m.sender === msg.sender && m.text.trim() === msg.text.trim() && (msg.mediaUrl ? m.mediaUrl === msg.mediaUrl : true)
            );
            if (!alreadyHas && msg.text.trim() && !msg.text.toLowerCase().includes("conversación activa")) {
              await prisma.chatMessage.update({
                where: { id: msg.id },
                data: { threadId: primary.id },
              }).catch(() => {});
              primary.messages.push(msg);
            } else {
              await prisma.chatMessage.delete({ where: { id: msg.id } }).catch(() => {});
            }
          }
          await prisma.chatThread.delete({ where: { id: dup.id } }).catch(() => {});
        }

        // Re-sort primary messages chronologically
        primary.messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        if (primary.messages.length > 0) {
          primary.lastMessage = primary.messages[primary.messages.length - 1].text || primary.lastMessage;
        }

        // Ensure channel is WhatsApp if phone is numeric
        if (primary.channel !== "WhatsApp") {
          await prisma.chatThread.update({
            where: { id: primary.id },
            data: { channel: "WhatsApp", lastMessage: primary.lastMessage },
          }).catch(() => {});
          primary.channel = "WhatsApp";
        } else {
          await prisma.chatThread.update({
            where: { id: primary.id },
            data: { lastMessage: primary.lastMessage },
          }).catch(() => {});
        }
      }
    }

    const consolidatedThreads = threads.filter((t) => !duplicateThreadIds.has(t.id));

    return {
      success: true,
      data: consolidatedThreads,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener conversaciones";
    return {
      success: false,
      error: errorMessage,
      code: "OMNICHANNEL_THREADS_FETCH_ERROR",
    };
  }
}

const UpdateClientNameSchema = z.object({
  threadId: z.string().min(1, "ID de conversación inválido"),
  clientName: z.string().min(1, "El nombre del cliente no puede estar vacío").max(100),
});

export async function updateChatClientNameAction(
  threadId: string,
  clientName: string
): Promise<ActionResponse> {
  try {
    const parsed = UpdateClientNameSchema.safeParse({ threadId, clientName });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Nombre inválido",
        code: "VALIDATION_ERROR",
      };
    }

    const updated = await prisma.chatThread.update({
      where: { id: parsed.data.threadId },
      data: { clientName: parsed.data.clientName.trim() },
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar nombre del cliente";
    return {
      success: false,
      error: errorMessage,
      code: "UPDATE_CLIENT_NAME_ERROR",
    };
  }
}


const UpdateThreadStatusSchema = z.object({
  threadId: z.string().min(1, "ID de conversación inválido"),
  status: z.enum(["Pendientes", "Por Responder", "Archivados"]),
});

export async function updateChatThreadStatusAction(
  threadId: string,
  status: "Pendientes" | "Por Responder" | "Archivados"
): Promise<ActionResponse> {
  try {
    const parsed = UpdateThreadStatusSchema.safeParse({ threadId, status });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de estado de chat inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const updatedThread = await prisma.chatThread.update({
      where: { id: parsed.data.threadId },
      data: { status: parsed.data.status },
      include: { messages: true },
    });

    return {
      success: true,
      data: updatedThread,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar estado del chat";
    return {
      success: false,
      error: errorMessage,
      code: "THREAD_STATUS_UPDATE_ERROR",
    };
  }
}

export async function sendChatMessageAction(rawInput: SendMessageInput): Promise<ActionResponse> {
  try {
    const parsed = SendMessageSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Mensaje inválido",
        code: "VALIDATION_ERROR",
      };
    }

    const { threadId, sender, text, mediaBase64, mediaMimeType, mediaFileName, mediaType, mediaUrl } = parsed.data;

    const thread = await prisma.chatThread.findUnique({
      where: { id: threadId },
    });

    if (!thread) {
      return {
        success: false,
        error: "Conversación no encontrada",
        code: "THREAD_NOT_FOUND",
      };
    }

    const normalizedSender = sender.toLowerCase() === "customer" ? "customer" : sender.toLowerCase() === "bot" ? "bot" : "agent";

    let savedMediaUrl: string | null = mediaUrl || null;
    let computedMediaType: string | null = mediaType || null;
    let outgoingBase64: string | null = mediaBase64 || null;
    let outgoingMimeType: string | null = mediaMimeType || null;
    let outgoingFileName: string | null = mediaFileName || null;

    // If mediaUrl is passed without mediaBase64 (e.g. from preset QuickReply), read it from public directory
    if (!outgoingBase64 && savedMediaUrl) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const cleanPath = savedMediaUrl.startsWith("/") ? savedMediaUrl.slice(1) : savedMediaUrl;
        const fullPath = path.join(process.cwd(), "public", cleanPath);
        if (fs.existsSync(fullPath)) {
          const buf = fs.readFileSync(fullPath);
          outgoingBase64 = buf.toString("base64");
          outgoingFileName = path.basename(fullPath);
          const ext = path.extname(fullPath).toLowerCase();
          if (ext === ".pdf") outgoingMimeType = "application/pdf";
          else if (ext === ".jpg" || ext === ".jpeg") outgoingMimeType = "image/jpeg";
          else if (ext === ".png") outgoingMimeType = "image/png";
          else if (ext === ".webp") outgoingMimeType = "image/webp";
          else outgoingMimeType = "application/octet-stream";

          if (!computedMediaType) {
            computedMediaType = outgoingMimeType.startsWith("image/") ? "image" : "document";
          }
        }
      } catch (readErr) {
        console.warn("[Omnichannel] Error al leer mediaUrl preexistente de disco:", readErr);
      }
    }

    // Save attachment to disk if fresh Base64 provided
    if (mediaBase64 && mediaMimeType) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const channelFolder = thread?.channel?.toLowerCase() === "facebook" ? "facebook" : thread?.channel?.toLowerCase() === "instagram" ? "instagram" : "whatsapp";
        const uploadsDir = path.join(process.cwd(), "public", "uploads", channelFolder);
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const cleanMime = mediaMimeType.split(";")[0].trim().toLowerCase();
        const ext = cleanMime.split("/")[1] || "bin";
        const cleanFileName = mediaFileName ? mediaFileName.replace(/[^a-zA-Z0-9._-]/g, "_") : `file.${ext}`;
        const fname = `out_${Date.now()}_${cleanFileName}`;
        const filePath = path.join(uploadsDir, fname);
        const cleanBase64 = mediaBase64.includes(",") ? mediaBase64.split(",")[1] : mediaBase64;
        fs.writeFileSync(filePath, Buffer.from(cleanBase64, "base64"));
        savedMediaUrl = `/uploads/${channelFolder}/${fname}`;

        if (!computedMediaType) {
          if (cleanMime.startsWith("image/")) computedMediaType = "image";
          else if (cleanMime.startsWith("video/")) computedMediaType = "video";
          else if (cleanMime.startsWith("audio/")) computedMediaType = "audio";
          else computedMediaType = "document";
        }
      } catch (saveErr) {
        console.warn("[Omnichannel] Error al guardar archivo multimedia saliente:", saveErr);
      }
    }

    // Construct absolute public HTTPS URL for external dispatch (Meta Graph API & WhatsApp)
    const publicAppUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "https://omnichannel.farfalina.tech"
    ).replace(/\/+$/, "");

    const publicMediaUrl = savedMediaUrl
      ? savedMediaUrl.startsWith("http://") || savedMediaUrl.startsWith("https://")
        ? savedMediaUrl
        : `${publicAppUrl}${savedMediaUrl.startsWith("/") ? "" : "/"}${savedMediaUrl}`
      : null;

    const threadEnv = thread?.environment || "farfalina";

    // Send via Meta WhatsApp Cloud API, WhatsApp Web client, or Meta Relay Outbound Queue
    let shouldQueueInRelay = false;
    let outboundExternalId: string | null = null;

    if (normalizedSender === "agent" && thread?.channel === "WhatsApp" && thread.phone) {
      let sentViaOfficialOrSocket = false;
      try {
        const waConfig = await prisma.channelConfig.findUnique({
          where: { channel_tenant_unique: { channel: "WhatsApp", environment: threadEnv } },
        });

        if (waConfig?.whatsappPhoneNumberId && waConfig?.whatsappAccessToken) {
          // Official Meta WhatsApp Cloud API v22.0
          const {
            sendMetaWhatsAppTextMessage,
            sendMetaWhatsAppMediaFromBase64,
            sendMetaWhatsAppMediaMessage,
          } = await import("@/lib/meta-whatsapp");

          const validMediaTypes = ["image", "video", "audio", "document", "sticker"] as const;
          type ValidMediaType = (typeof validMediaTypes)[number];
          const typedMediaType: ValidMediaType | undefined = validMediaTypes.includes(computedMediaType as ValidMediaType)
            ? (computedMediaType as ValidMediaType)
            : undefined;

          let metaRes = null;

          if (publicMediaUrl) {
            metaRes = await sendMetaWhatsAppMediaMessage({
              phoneNumberId: waConfig.whatsappPhoneNumberId,
              accessToken: waConfig.whatsappAccessToken,
              to: thread.phone,
              mediaType: typedMediaType || "image",
              mediaLink: publicMediaUrl,
              caption: text || undefined,
              filename: outgoingFileName || undefined,
            });
          } else if (outgoingBase64 && outgoingMimeType) {
            metaRes = await sendMetaWhatsAppMediaFromBase64({
              phoneNumberId: waConfig.whatsappPhoneNumberId,
              accessToken: waConfig.whatsappAccessToken,
              to: thread.phone,
              base64: outgoingBase64,
              mimeType: outgoingMimeType,
              filename: outgoingFileName || undefined,
              caption: text || undefined,
              mediaType: typedMediaType,
            });
          } else if (text) {
            metaRes = await sendMetaWhatsAppTextMessage({
              phoneNumberId: waConfig.whatsappPhoneNumberId,
              accessToken: waConfig.whatsappAccessToken,
              to: thread.phone,
              text,
              previewUrl: false,
            });
          }

          if (metaRes && metaRes.success) {
            sentViaOfficialOrSocket = true;
            outboundExternalId = metaRes.data?.messageId || null;
          } else {
            console.warn(`[WhatsApp Outbound (${threadEnv})] Meta Cloud API no envió, recurriendo a Relay/Evolution:`, metaRes?.error);
          }
        }

        // Try Evolution API if configured and not yet sent
        if (!sentViaOfficialOrSocket && process.env.EVOLUTION_API_URL) {
          try {
            const { sendEvolutionTextMessage, sendEvolutionMediaMessage } = await import("@/lib/evolution-api");
            if (publicMediaUrl && (computedMediaType === "image" || computedMediaType === "video" || computedMediaType === "audio" || computedMediaType === "document")) {
              const evoMediaRes = await sendEvolutionMediaMessage({
                to: thread.phone,
                mediaUrl: publicMediaUrl,
                mediaType: computedMediaType as "image" | "video" | "audio" | "document",
                caption: text || undefined,
                fileName: outgoingFileName || undefined,
                environment: threadEnv,
              });
              if (evoMediaRes.success) {
                sentViaOfficialOrSocket = true;
                outboundExternalId = evoMediaRes.messageId || null;
              }
            } else if (text) {
              const evoRes = await sendEvolutionTextMessage({
                to: thread.phone,
                text,
                environment: threadEnv,
              });
              if (evoRes.success) {
                sentViaOfficialOrSocket = true;
                outboundExternalId = evoRes.messageId || null;
              }
            }
          } catch (evoErr) {
            console.warn(`[WhatsApp Outbound (${threadEnv})] Evolution API error:`, evoErr);
          }
        }

        if (!sentViaOfficialOrSocket) {
          // Fallback to WhatsApp Web socket
          try {
            const { sendWhatsAppWebMessage, sendWhatsAppWebMediaMessage } = await import("@/lib/whatsapp-socket-manager");
            if (outgoingBase64 && outgoingMimeType) {
              const mediaSent = await sendWhatsAppWebMediaMessage(
                thread.phone,
                outgoingBase64,
                outgoingMimeType,
                outgoingFileName || "archivo",
                text || "",
                threadEnv
              );
              if (mediaSent && typeof mediaSent === "object") {
                sentViaOfficialOrSocket = Boolean(mediaSent.success);
                outboundExternalId = mediaSent.messageId || null;
              } else {
                sentViaOfficialOrSocket = Boolean(mediaSent);
              }
            } else if (text) {
              const textSent = await sendWhatsAppWebMessage(thread.phone, text, threadEnv);
              if (textSent && typeof textSent === "object") {
                sentViaOfficialOrSocket = Boolean(textSent.success);
                outboundExternalId = textSent.messageId || null;
              } else {
                sentViaOfficialOrSocket = Boolean(textSent);
              }
            }
          } catch (wsErr) {
            console.warn(`[WhatsApp Outbound (${threadEnv})] Socket no disponible, recurriendo a Relay:`, wsErr);
          }
        }
      } catch (wsErr) {
        console.warn(`[WhatsApp Outbound (${threadEnv})] Error al intentar envío directo:`, wsErr);
      }

      if (!sentViaOfficialOrSocket) {
        shouldQueueInRelay = true;
      }
    }

    let sentDirectlyViaMeta = false;
    if (normalizedSender === "agent" && thread?.channel === "Facebook" && thread.phone) {
      try {
        const fbConfig = await prisma.channelConfig.findUnique({
          where: { channel_tenant_unique: { channel: "Facebook", environment: threadEnv } },
        });
        const pageToken = fbConfig?.facebookPageToken || process.env.META_PAGE_ACCESS_TOKEN || "";
        if (pageToken) {
          const { sendFacebookMessengerTextMessage, sendFacebookMessengerMediaMessage } = await import("@/lib/meta-graph-api");
          let sendRes;
          if (publicMediaUrl) {
            sendRes = await sendFacebookMessengerMediaMessage({
              pageAccessToken: pageToken,
              recipientPsid: thread.phone,
              mediaUrl: publicMediaUrl,
              mimeType: outgoingMimeType || "image/jpeg",
              caption: text || undefined,
            });
          } else if (outgoingBase64 && outgoingMimeType) {
            const buffer = Buffer.from(outgoingBase64, "base64");
            sendRes = await sendFacebookMessengerMediaMessage({
              pageAccessToken: pageToken,
              recipientPsid: thread.phone,
              buffer,
              mimeType: outgoingMimeType,
              filename: outgoingFileName || undefined,
              caption: text || undefined,
            });
          } else if (text) {
            sendRes = await sendFacebookMessengerTextMessage({
              pageAccessToken: pageToken,
              recipientPsid: thread.phone,
              text,
            });
          }
          if (sendRes?.success) {
            sentDirectlyViaMeta = true;
            outboundExternalId = sendRes.messageId || null;
          }
        }
      } catch (fbErr) {
        console.warn(`[Facebook Outbound (${threadEnv})] Error al enviar vía Meta Graph API:`, fbErr);
      }
    }

    if (normalizedSender === "agent" && thread?.channel === "Instagram" && thread.phone) {
      try {
        const igConfig = await prisma.channelConfig.findUnique({
          where: { channel_tenant_unique: { channel: "Instagram", environment: threadEnv } },
        });
        const fbConfig = await prisma.channelConfig.findUnique({
          where: { channel_tenant_unique: { channel: "Facebook", environment: threadEnv } },
        });
        const igToken = igConfig?.instagramAccessToken || fbConfig?.facebookPageToken || process.env.META_INSTAGRAM_ACCESS_TOKEN || "";
        if (igToken) {
          const { sendInstagramDirectTextMessage, sendInstagramDirectMediaMessage } = await import("@/lib/meta-graph-api");
          let sendRes;
          if (publicMediaUrl) {
            sendRes = await sendInstagramDirectMediaMessage({
              accessToken: igToken,
              recipientIgsid: thread.phone,
              mediaUrl: publicMediaUrl,
              mimeType: outgoingMimeType || (computedMediaType === "video" ? "video/mp4" : computedMediaType === "audio" ? "audio/ogg" : computedMediaType === "document" ? "application/pdf" : "image/jpeg"),
              filename: outgoingFileName || undefined,
              caption: text || undefined,
            });
          } else if (text) {
            sendRes = await sendInstagramDirectTextMessage({
              accessToken: igToken,
              recipientIgsid: thread.phone,
              text,
            });
          }
          if (sendRes?.success) {
            sentDirectlyViaMeta = true;
            outboundExternalId = sendRes.messageId || null;
          } else if (sendRes?.error) {
            console.warn(`[Instagram Outbound (${threadEnv})] Error al despachar en Graph API:`, sendRes.error);
          }
        }
      } catch (igErr) {
        console.warn(`[Instagram Outbound (${threadEnv})] Error al enviar vía Meta Graph API:`, igErr);
      }
    }

    const lastMessageLabel = text || (computedMediaType === "image" ? "[Imagen adjunta]" : "[Archivo adjunto]");
    const now = new Date();

    const newMessage = await prisma.$transaction(async (tx) => {
      const msg = await tx.chatMessage.create({
        data: {
          threadId,
          sender: normalizedSender,
          text: text || (savedMediaUrl ? (computedMediaType === "image" ? "[Imagen]" : "[Archivo adjunto]") : ""),
          mediaUrl: savedMediaUrl,
          mediaType: computedMediaType,
          environment: threadEnv,
          externalId: outboundExternalId || undefined,
          timestamp: now,
          createdAt: now,
        },
      });

      await tx.chatThread.update({
        where: { id: threadId },
        data: {
          lastMessage: lastMessageLabel,
          lastMessageAt: now,
          updatedAt: now,
        },
      });

      // Si el canal es Facebook, Instagram o WhatsApp (vía Meta Relay), encolar en el Relay para despacho o registro
      if (normalizedSender === "agent" && (thread?.channel === "Facebook" || thread?.channel === "Instagram" || shouldQueueInRelay)) {
        await tx.relayOutboundQueue.create({
          data: {
            threadId,
            messageId: msg.id,
            channel: thread?.channel || "WhatsApp",
            clientName: thread?.clientName || "",
            phone: thread?.phone || "",
            text: text || (savedMediaUrl ? "[Archivo adjunto]" : ""),
            mediaUrl: savedMediaUrl,
            environment: threadEnv,
            status: sentDirectlyViaMeta ? "SENT" : "PENDING",
            sentAt: sentDirectlyViaMeta ? now : null,
          },
        });
      }

      return msg;
    });


    return {
      success: true,
      data: newMessage,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al enviar mensaje";
    return {
      success: false,
      error: errorMessage,
      code: "CHAT_SEND_ERROR",
    };
  }
}

const CreateOrderWithRecipeSchema = z.object({
  threadId: z.string().optional(),
  clientName: z.string().min(2, "El nombre del cliente es requerido"),
  recipientName: z.string().min(2, "El destinatario es requerido"),
  address: z.string().min(3, "La dirección es requerida"),
  zone: z.string().min(2, "La zona es requerida"),
  deliveryDate: z.string().min(1, "La fecha de entrega es requerida"),
  deliveryTime: z.string().min(1, "La hora de entrega es requerida"),
  arrangementName: z.string().min(2, "El arreglo es requerido"),
  salePrice: z.number().positive("El precio debe ser positivo"),
  deliveryFee: z.number().min(0).default(0),
  dedicationMessage: z.string().min(1, "La dedicatoria es requerida"),
  recipeItems: z.array(
    z.object({
      rawIngredientId: z.string(),
      quantityNeeded: z.number().int().positive(),
      unitCost: z.number().min(0).default(0),
    })
  ),
});

export type CreateOrderWithRecipeInput = z.infer<typeof CreateOrderWithRecipeSchema>;

export async function createOrderWithRecipeAction(
  rawInput: CreateOrderWithRecipeInput
): Promise<ActionResponse> {
  try {
    const parsed = CreateOrderWithRecipeSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos del pedido inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const {
      clientName,
      recipientName,
      address,
      zone,
      deliveryDate,
      deliveryTime,
      arrangementName,
      salePrice,
      deliveryFee,
      dedicationMessage,
      recipeItems,
      threadId,
    } = parsed.data;

    const total = salePrice + deliveryFee;
    const orderNumber = `PED-${Date.now().toString().slice(-6)}`;

    // Atomic Prisma transaction: stock check + stock decrement + OrderDelivery create + ChatMessage insert
    const newOrder = await prisma.$transaction(async (tx) => {
      // 1. Stock check and decrement
      for (const item of recipeItems) {
        const ing = await tx.rawIngredient.findUnique({
          where: { id: item.rawIngredientId },
        });

        if (!ing) {
          throw new Error(`Insumo no encontrado: ID ${item.rawIngredientId}`);
        }

        if (ing.available < item.quantityNeeded) {
          throw new Error(
            `Stock insuficiente para "${ing.name}". Disponible: ${ing.available}, Requerido: ${item.quantityNeeded}`
          );
        }

        await tx.rawIngredient.update({
          where: { id: item.rawIngredientId },
          data: {
            available: {
              decrement: item.quantityNeeded,
            },
          },
        });
      }

      // 2. Create OrderDelivery with Recipe Items
      const dateParts = deliveryDate.split("T")[0];
      const parsedDate = new Date(`${dateParts}T12:00:00.000Z`);

      const order = await tx.orderDelivery.create({
        data: {
          orderNumber,
          clientName,
          recipientName,
          address,
          zone,
          deliveryDate: parsedDate,
          deliveryTime,
          status: "En preparación",
          arrangementName,
          total,
          dedicationMessage,
          recipeItems: {
            create: recipeItems.map((r) => ({
              rawIngredientId: r.rawIngredientId,
              quantityNeeded: r.quantityNeeded,
              unitCost: r.unitCost,
            })),
          },
        },
        include: {
          recipeItems: {
            include: { rawIngredient: true },
          },
        },
      });

      // 3. Generate chat summary message if threadId is provided
      if (threadId) {
        const orderThread = await tx.chatThread.findUnique({
          where: { id: threadId },
          select: { environment: true },
        });
        const orderEnv = orderThread?.environment || "farfalina";

        const chatMsg =
          `*Pedido Confirmado #${orderNumber}*\n` +
          `• Arreglo: ${arrangementName}\n` +
          `• Destino: ${recipientName} (${zone})\n` +
          `• Fecha: ${deliveryDate} a las ${deliveryTime}\n` +
          `• Total: ${total} Bs`;

        const orderNow = new Date();
        await tx.chatMessage.create({
          data: {
            threadId,
            sender: "bot",
            text: chatMsg,
            environment: orderEnv,
            timestamp: orderNow,
            createdAt: orderNow,
          },
        });

        await tx.chatThread.update({
          where: { id: threadId },
          data: {
            status: "Pendientes",
            lastMessage: `Pedido #${orderNumber} emitido exitosamente.`,
            lastMessageAt: orderNow,
            updatedAt: orderNow,
          },
        });
      }

      return order;
    });

    return {
      success: true,
      data: newOrder,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al crear pedido con receta";
    return {
      success: false,
      error: errorMessage,
      code: "ORDER_RECIPE_CREATE_ERROR",
    };
  }
}

const SaveMetaWhatsAppConfigSchema = z.object({
  whatsappPhoneNumberId: z.string().min(1, "El Phone Number ID es requerido"),
  whatsappWabaId: z.string().optional().nullable(),
  whatsappAccessToken: z.string().min(5, "El Token de acceso de Meta es requerido"),
  whatsappBusinessPhone: z.string().optional().nullable(),
  verifyToken: z.string().optional().nullable(),
});

export type SaveMetaWhatsAppConfigInput = z.infer<typeof SaveMetaWhatsAppConfigSchema>;

const SaveFacebookPageTokenSchema = z.object({
  pageToken: z.string().min(5, "El token de la FanPage debe tener al menos 5 caracteres"),
  pageId: z.string().optional().nullable(),
});

export type SaveFacebookPageTokenInput = z.infer<typeof SaveFacebookPageTokenSchema>;

const SaveInstagramTokenSchema = z.object({
  instagramAccountId: z.string().min(2, "El ID de la cuenta de Instagram es requerido"),
  instagramAccessToken: z.string().min(5, "El Token de Instagram debe tener al menos 5 caracteres"),
});

export type SaveInstagramTokenInput = z.infer<typeof SaveInstagramTokenSchema>;

const SaveTikTokConfigSchema = z.object({
  tiktokAppId: z.string().min(2, "El Client App ID de TikTok es requerido"),
});

export type SaveTikTokConfigInput = z.infer<typeof SaveTikTokConfigSchema>;

export async function getChannelConfigsAction(environment: string = "farfalina"): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();

    // Auto-delete any TikTok configuration records
    await prisma.channelConfig.deleteMany({
      where: { channel: "TikTok" },
    }).catch(() => {});

    let configs = await prisma.channelConfig.findMany({
      where: { environment: normEnv, channel: { not: "TikTok" } },
      orderBy: { createdAt: "asc" },
    });

    if (configs.length === 0) {
      await prisma.channelConfig.createMany({
        data: [
          { channel: "WhatsApp", environment: normEnv, status: "DISCONNECTED" },
          { channel: "Facebook", environment: normEnv, status: "DISCONNECTED" },
          { channel: "Instagram", environment: normEnv, status: "DISCONNECTED" },
        ],
      });
      configs = await prisma.channelConfig.findMany({
        where: { environment: normEnv, channel: { not: "TikTok" } },
        orderBy: { createdAt: "asc" },
      });
    }

    const maskedConfigs = configs.map((config) => {
      const mask = (token: string | null) => 
        token && token.length > 4 ? `****${token.slice(-4)}` : token;
      
      return {
        ...config,
        whatsappAccessToken: mask(config.whatsappAccessToken),
        facebookPageToken: mask(config.facebookPageToken),
        instagramAccessToken: mask(config.instagramAccessToken),
        verifyToken: config.verifyToken,
      };
    });

    return {
      success: true,
      data: maskedConfigs,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener la configuración de canales";
    return {
      success: false,
      error: errorMessage,
      code: "CHANNEL_CONFIGS_FETCH_ERROR",
    };
  }
}

export async function generateWhatsAppQRAction(environment: string = "farfalina"): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    const { initWhatsAppSocket } = await import("@/lib/whatsapp-socket-manager");
    const { qrCodeDataUrl, status } = await initWhatsAppSocket(true, normEnv);

    const config = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "WhatsApp", environment: normEnv } },
    });

    return {
      success: true,
      data: {
        id: config?.id || `wa-config-${normEnv}`,
        channel: "WhatsApp",
        environment: normEnv,
        status: status || config?.status || "INITIALIZING",
        qrCodeData: qrCodeDataUrl || config?.qrCodeData || null,
        whatsappPhoneNumberId: config?.whatsappPhoneNumberId || null,
        whatsappWabaId: config?.whatsappWabaId || null,
        whatsappAccessToken: config?.whatsappAccessToken ? `****${config.whatsappAccessToken.slice(-4)}` : null,
        whatsappBusinessPhone: config?.whatsappBusinessPhone || null,
        facebookPageToken: config?.facebookPageToken || null,
        facebookPageId: config?.facebookPageId || null,
        instagramAccessToken: config?.instagramAccessToken || null,
        instagramAccountId: config?.instagramAccountId || null,
        tiktokAppId: config?.tiktokAppId || null,
        updatedAt: config?.updatedAt || new Date(),
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al iniciar socket real de WhatsApp";
    return {
      success: false,
      error: errorMessage,
      code: "WHATSAPP_SOCKET_INIT_ERROR",
    };
  }
}

export async function confirmWhatsAppQRScanAction(environment: string = "farfalina"): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    const config = await prisma.channelConfig.upsert({
      where: { channel_tenant_unique: { channel: "WhatsApp", environment: normEnv } },
      update: {
        status: "CONNECTED",
        qrCodeData: null,
        updatedAt: new Date(),
      },
      create: {
        channel: "WhatsApp",
        environment: normEnv,
        status: "CONNECTED",
      },
    });

    return {
      success: true,
      data: config,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al vincular WhatsApp";
    return {
      success: false,
      error: errorMessage,
      code: "WHATSAPP_CONNECT_ERROR",
    };
  }
}

export async function saveMetaWhatsAppConfigAction(
  rawInput: SaveMetaWhatsAppConfigInput,
  environment: string = "farfalina"
): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    const parsed = SaveMetaWhatsAppConfigSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de WhatsApp Cloud inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const existingConfig = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "WhatsApp", environment: normEnv } },
    });

    const isMaskedToken = parsed.data.whatsappAccessToken.startsWith("****");
    const tokenToSave = isMaskedToken && existingConfig?.whatsappAccessToken
      ? existingConfig.whatsappAccessToken
      : parsed.data.whatsappAccessToken.trim();

    const config = await prisma.channelConfig.upsert({
      where: { channel_tenant_unique: { channel: "WhatsApp", environment: normEnv } },
      update: {
        whatsappPhoneNumberId: parsed.data.whatsappPhoneNumberId.trim(),
        whatsappWabaId: parsed.data.whatsappWabaId?.trim() || null,
        whatsappAccessToken: tokenToSave,
        whatsappBusinessPhone: parsed.data.whatsappBusinessPhone?.trim() || null,
        ...(parsed.data.verifyToken && { verifyToken: parsed.data.verifyToken.trim() }),
        status: "CONNECTED",
        updatedAt: new Date(),
      },
      create: {
        channel: "WhatsApp",
        environment: normEnv,
        whatsappPhoneNumberId: parsed.data.whatsappPhoneNumberId.trim(),
        whatsappWabaId: parsed.data.whatsappWabaId?.trim() || null,
        whatsappAccessToken: tokenToSave,
        whatsappBusinessPhone: parsed.data.whatsappBusinessPhone?.trim() || null,
        verifyToken: parsed.data.verifyToken?.trim() || null,
        status: "CONNECTED",
      },
    });

    return {
      success: true,
      data: config,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al guardar configuración de WhatsApp Cloud";
    return {
      success: false,
      error: errorMessage,
      code: "WHATSAPP_CONFIG_SAVE_ERROR",
    };
  }
}

export async function saveFacebookPageTokenAction(
  rawInput: SaveFacebookPageTokenInput,
  environment: string = "farfalina"
): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    const parsed = SaveFacebookPageTokenSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Token de Facebook inválido",
        code: "VALIDATION_ERROR",
      };
    }

    const existingConfig = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Facebook", environment: normEnv } },
    });

    const isMaskedToken = parsed.data.pageToken.startsWith("****");
    const tokenToSave = isMaskedToken && existingConfig?.facebookPageToken
      ? existingConfig.facebookPageToken
      : parsed.data.pageToken.trim();

    const pageIdToSave = parsed.data.pageId !== undefined ? (parsed.data.pageId?.trim() || null) : (existingConfig?.facebookPageId || null);

    const config = await prisma.channelConfig.upsert({
      where: { channel_tenant_unique: { channel: "Facebook", environment: normEnv } },
      update: {
        facebookPageToken: tokenToSave,
        facebookPageId: pageIdToSave,
        status: "CONNECTED",
        updatedAt: new Date(),
      },
      create: {
        channel: "Facebook",
        environment: normEnv,
        facebookPageToken: tokenToSave,
        facebookPageId: pageIdToSave,
        status: "CONNECTED",
      },
    });

    return {
      success: true,
      data: config,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al guardar Token de Facebook";
    return {
      success: false,
      error: errorMessage,
      code: "FACEBOOK_TOKEN_SAVE_ERROR",
    };
  }
}

export async function saveInstagramTokenAction(
  rawInput: SaveInstagramTokenInput,
  environment: string = "farfalina"
): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    const parsed = SaveInstagramTokenSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de Instagram inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const existingConfig = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Instagram", environment: normEnv } },
    });

    const isMaskedToken = parsed.data.instagramAccessToken.startsWith("****");
    const tokenToSave = isMaskedToken && existingConfig?.instagramAccessToken
      ? existingConfig.instagramAccessToken
      : parsed.data.instagramAccessToken.trim();

    const config = await prisma.channelConfig.upsert({
      where: { channel_tenant_unique: { channel: "Instagram", environment: normEnv } },
      update: {
        instagramAccessToken: tokenToSave,
        instagramAccountId: parsed.data.instagramAccountId.trim(),
        status: "CONNECTED",
        updatedAt: new Date(),
      },
      create: {
        channel: "Instagram",
        environment: normEnv,
        instagramAccessToken: tokenToSave,
        instagramAccountId: parsed.data.instagramAccountId.trim(),
        status: "CONNECTED",
      },
    });

    return {
      success: true,
      data: config,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al guardar Token de Instagram";
    return {
      success: false,
      error: errorMessage,
      code: "INSTAGRAM_TOKEN_SAVE_ERROR",
    };
  }
}

export async function testFacebookConnectionAction(environment: string = "farfalina"): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    const config = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Facebook", environment: normEnv } },
    });
    if (!config?.facebookPageToken) {
      return { success: false, error: "No hay Page Access Token configurado para Facebook", code: "NO_TOKEN" };
    }
    const { verifyFacebookPageToken } = await import("@/lib/meta-graph-api");
    const result = await verifyFacebookPageToken(config.facebookPageToken);
    if (!result.valid) {
      return { success: false, error: result.error || "Token inválido según Meta", code: "INVALID_TOKEN" };
    }
    await prisma.channelConfig.update({
      where: { channel_tenant_unique: { channel: "Facebook", environment: normEnv } },
      data: { status: "CONNECTED", lastSyncAt: new Date() },
    });
    return { success: true, data: { pageId: result.pageId, pageName: result.pageName } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error probando conexión con Facebook", code: "TEST_ERROR" };
  }
}

export async function testInstagramConnectionAction(environment: string = "farfalina"): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    const config = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Instagram", environment: normEnv } },
    });
    if (!config?.instagramAccessToken) {
      return { success: false, error: "No hay Access Token configurado para Instagram", code: "NO_TOKEN" };
    }
    const { verifyInstagramToken } = await import("@/lib/meta-graph-api");
    const result = await verifyInstagramToken(config.instagramAccessToken, config.instagramAccountId || undefined);
    if (!result.valid) {
      return { success: false, error: result.error || "Token inválido según Meta", code: "INVALID_TOKEN" };
    }
    await prisma.channelConfig.update({
      where: { channel_tenant_unique: { channel: "Instagram", environment: normEnv } },
      data: {
        status: "CONNECTED",
        instagramAccountId: result.accountId || config.instagramAccountId,
        lastSyncAt: new Date(),
      },
    });
    return { success: true, data: { accountId: result.accountId, username: result.username } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error probando conexión con Instagram", code: "TEST_ERROR" };
  }
}

export async function saveTikTokConfigAction(
  _rawInput: SaveTikTokConfigInput,
  _environment: string = "farfalina"
): Promise<ActionResponse> {
  return {
    success: false,
    error: "La API de TikTok Direct no está disponible en Latinoamérica y ha sido removida del sistema.",
    code: "TIKTOK_UNSUPPORTED",
  };
}

export async function getRelayStatusAction(environment: string = "farfalina"): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    const fbConfig = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Facebook", environment: normEnv } },
    });
    const igConfig = await prisma.channelConfig.findUnique({
      where: { channel_tenant_unique: { channel: "Instagram", environment: normEnv } },
    });

    const pendingCount = await prisma.relayOutboundQueue.count({
      where: { environment: normEnv, status: "PENDING" },
    });

    const deliveredCount = await prisma.relayOutboundQueue.count({
      where: { environment: normEnv, status: "DELIVERED" },
    });

    const lastSync = [fbConfig?.lastSyncAt, igConfig?.lastSyncAt]
      .filter(Boolean)
      .sort((a, b) => (b!.getTime() - a!.getTime()))[0] || null;

    const isConnected = lastSync ? (Date.now() - new Date(lastSync).getTime() < 120000) : false;

    return {
      success: true,
      data: {
        environment: normEnv,
        isConnected,
        lastSyncAt: lastSync,
        pendingCount,
        deliveredCount,
        facebookStatus: isConnected ? "CONNECTED" : (fbConfig?.status || "DISCONNECTED"),
        instagramStatus: isConnected ? "CONNECTED" : (igConfig?.status || "DISCONNECTED"),
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener estado del Relay";
    return {
      success: false,
      error: errorMessage,
      code: "RELAY_STATUS_ERROR",
    };
  }
}

export async function disconnectChannelAction(
  channel: string,
  environment: string = "farfalina"
): Promise<ActionResponse> {
  try {
    const normEnv = (environment || "farfalina").toLowerCase();
    if (channel === "WhatsApp") {
      try {
        const { destroyWhatsAppClient } = await import("@/lib/whatsapp-socket-manager");
        await destroyWhatsAppClient(normEnv);
      } catch (waErr) {
        console.warn(`[WhatsApp Web (${normEnv})] Error al desconectar socket:`, waErr);
      }
    }

    const config = await prisma.channelConfig.upsert({
      where: { channel_tenant_unique: { channel, environment: normEnv } },
      update: {
        status: "DISCONNECTED",
        qrCodeData: null,
        whatsappPhoneNumberId: null,
        whatsappWabaId: null,
        whatsappAccessToken: null,
        whatsappBusinessPhone: null,
        facebookPageToken: null,
        facebookPageId: null,
        instagramAccountId: null,
        instagramAccessToken: null,
        tiktokAppId: null,
        updatedAt: new Date(),
      },
      create: {
        channel,
        environment: normEnv,
        status: "DISCONNECTED",
      },
    });

    return {
      success: true,
      data: config,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al desconectar canal";
    return {
      success: false,
      error: errorMessage,
      code: "CHANNEL_DISCONNECT_ERROR",
    };
  }
}

export async function clearChatCacheAction(environment?: string): Promise<ActionResponse> {
  try {
    // 1. Delete chat messages and chat threads for this environment (or all if not specified)
    const threadWhere = environment ? { environment } : {};
    const messageWhere = environment ? { thread: { environment } } : {};

    const deletedMessages = await prisma.chatMessage.deleteMany({ where: messageWhere });
    const deletedThreads = await prisma.chatThread.deleteMany({ where: threadWhere });

    // 2. Clean up media attachments from public/uploads/whatsapp if any exist
    try {
      const fs = await import("fs");
      const path = await import("path");
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "whatsapp");
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          try {
            fs.unlinkSync(path.join(uploadsDir, file));
          } catch (e) {
            // ignore file lock
          }
        }
      }
    } catch (fsErr) {
      console.warn("[ClearCache] Error al limpiar archivos multimedia:", fsErr);
    }

    return {
      success: true,
      data: {
        deletedMessagesCount: deletedMessages.count,
        deletedThreadsCount: deletedThreads.count,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al limpiar la bandeja de chats";
    return {
      success: false,
      error: errorMessage,
      code: "CLEAR_CHAT_CACHE_ERROR",
    };
  }
}

// ----------------------------------------------------
// QUICK REPLIES / PRESET MESSAGES (CRUD & ATTACHMENTS)
// ----------------------------------------------------

const CreateQuickReplySchema = z.object({
  title: z.string().min(2, "El título debe tener al menos 2 caracteres"),
  category: z.string().default("General"),
  text: z.string().min(1, "El texto del mensaje es requerido"),
  mediaBase64: z.string().optional().nullable(),
  mediaFileName: z.string().optional().nullable(),
  mediaMimeType: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  shortcut: z.string().optional().nullable(),
});

export type CreateQuickReplyInput = z.infer<typeof CreateQuickReplySchema>;

const UpdateQuickReplySchema = z.object({
  id: z.string().min(1, "ID de respuesta rápida requerido"),
  title: z.string().min(2, "El título debe tener al menos 2 caracteres"),
  category: z.string().default("General"),
  text: z.string().min(1, "El texto del mensaje es requerido"),
  mediaBase64: z.string().optional().nullable(),
  mediaFileName: z.string().optional().nullable(),
  mediaMimeType: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  mediaUrl: z.string().optional().nullable(),
  mediaName: z.string().optional().nullable(),
  shortcut: z.string().optional().nullable(),
});

export type UpdateQuickReplyInput = z.infer<typeof UpdateQuickReplySchema>;

export async function getQuickRepliesAction(): Promise<ActionResponse> {
  try {
    let replies = await prisma.quickReply.findMany({
      orderBy: [{ category: "asc" }, { title: "asc" }],
    });

    // Seed useful default quick replies if table is empty
    if (replies.length === 0) {
      await prisma.quickReply.createMany({
        data: [
          {
            title: "Saludo de Bienvenida",
            category: "General",
            text: "¡Hola! Bienvenido a Florería Farfalina y Alquileres Carissma. ¿En qué ramo, arreglo floral o vestido de alquiler podemos asesorarte hoy?",
            shortcut: "/hola",
          },
          {
            title: "Tarifas y Zonas de Envío",
            category: "Envíos",
            text: "Realizamos envíos en La Paz y El Alto. Tarifa estándar: 20 Bs. Entregas express en menos de 2 horas disponibles.",
            shortcut: "/envios",
          },
          {
            title: "Catálogo de Arreglos Florales",
            category: "Catálogo",
            text: "Te compartimos nuestro catálogo de arreglos destacados, ramos de rosas importadas y opciones personalizadas.",
            shortcut: "/catalogo",
          },
          {
            title: "Datos de Pago y QR Simple",
            category: "Pagos",
            text: "Aceptamos transferencias bancarias y pago por QR Simple (Banco Unión, BCP, BNB, Banco FIE). Por favor envíanos el comprobante tras realizar el pago.",
            shortcut: "/pagos",
          },
        ],
      });

      replies = await prisma.quickReply.findMany({
        orderBy: [{ category: "asc" }, { title: "asc" }],
      });
    }

    return {
      success: true,
      data: replies,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al obtener respuestas rápidas";
    return {
      success: false,
      error: errorMessage,
      code: "QUICK_REPLIES_FETCH_ERROR",
    };
  }
}

export async function createQuickReplyAction(rawInput: CreateQuickReplyInput): Promise<ActionResponse> {
  try {
    const parsed = CreateQuickReplySchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de respuesta predeterminada inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { title, category, text, mediaBase64, mediaFileName, mediaMimeType, mediaType, shortcut } = parsed.data;

    let savedMediaUrl: string | null = null;
    let computedMediaType: string | null = mediaType || null;
    let savedMediaName: string | null = mediaFileName || null;

    if (mediaBase64 && mediaMimeType) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "quick-replies");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const ext = mediaMimeType.split("/")[1]?.split(";")[0] || "bin";
        const fname = `qr_${Date.now()}_${mediaFileName ? mediaFileName.replace(/[^a-zA-Z0-9._-]/g, "_") : `file.${ext}`}`;
        const filePath = path.join(uploadsDir, fname);
        const cleanBase64 = mediaBase64.includes(",") ? mediaBase64.split(",")[1] : mediaBase64;
        fs.writeFileSync(filePath, Buffer.from(cleanBase64, "base64"));
        savedMediaUrl = `/uploads/quick-replies/${fname}`;
        savedMediaName = mediaFileName || fname;

        if (!computedMediaType) {
          if (mediaMimeType.startsWith("image/")) computedMediaType = "image";
          else if (mediaMimeType.startsWith("video/")) computedMediaType = "video";
          else if (mediaMimeType.startsWith("audio/")) computedMediaType = "audio";
          else computedMediaType = "document";
        }
      } catch (saveErr) {
        console.warn("[QuickReplies] Error al guardar archivo adjunto:", saveErr);
      }
    }

    const newReply = await prisma.quickReply.create({
      data: {
        title: title.trim(),
        category: category.trim(),
        text: text.trim(),
        mediaUrl: savedMediaUrl,
        mediaName: savedMediaName,
        mediaType: computedMediaType,
        shortcut: shortcut?.trim() || null,
      },
    });

    return {
      success: true,
      data: newReply,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al crear respuesta predeterminada";
    return {
      success: false,
      error: errorMessage,
      code: "QUICK_REPLY_CREATE_ERROR",
    };
  }
}

export async function updateQuickReplyAction(rawInput: UpdateQuickReplyInput): Promise<ActionResponse> {
  try {
    const parsed = UpdateQuickReplySchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de edición inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { id, title, category, text, mediaBase64, mediaFileName, mediaMimeType, mediaType, mediaUrl, mediaName, shortcut } = parsed.data;

    let finalMediaUrl: string | null = mediaUrl || null;
    let finalMediaType: string | null = mediaType || null;
    let finalMediaName: string | null = mediaName || null;

    if (mediaBase64 && mediaMimeType) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "quick-replies");
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        const ext = mediaMimeType.split("/")[1]?.split(";")[0] || "bin";
        const fname = `qr_${Date.now()}_${mediaFileName ? mediaFileName.replace(/[^a-zA-Z0-9._-]/g, "_") : `file.${ext}`}`;
        const filePath = path.join(uploadsDir, fname);
        const cleanBase64 = mediaBase64.includes(",") ? mediaBase64.split(",")[1] : mediaBase64;
        fs.writeFileSync(filePath, Buffer.from(cleanBase64, "base64"));
        finalMediaUrl = `/uploads/quick-replies/${fname}`;
        finalMediaName = mediaFileName || fname;

        if (!finalMediaType) {
          if (mediaMimeType.startsWith("image/")) finalMediaType = "image";
          else if (mediaMimeType.startsWith("video/")) finalMediaType = "video";
          else if (mediaMimeType.startsWith("audio/")) finalMediaType = "audio";
          else finalMediaType = "document";
        }
      } catch (saveErr) {
        console.warn("[QuickReplies] Error al guardar nuevo archivo adjunto:", saveErr);
      }
    }

    const updated = await prisma.quickReply.update({
      where: { id },
      data: {
        title: title.trim(),
        category: category.trim(),
        text: text.trim(),
        mediaUrl: finalMediaUrl,
        mediaName: finalMediaName,
        mediaType: finalMediaType,
        shortcut: shortcut?.trim() || null,
      },
    });

    return {
      success: true,
      data: updated,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al actualizar respuesta predeterminada";
    return {
      success: false,
      error: errorMessage,
      code: "QUICK_REPLY_UPDATE_ERROR",
    };
  }
}

export async function deleteQuickReplyAction(id: string): Promise<ActionResponse> {
  try {
    if (!id) {
      return {
        success: false,
        error: "ID requerido para eliminar",
        code: "VALIDATION_ERROR",
      };
    }

    const deleted = await prisma.quickReply.delete({
      where: { id },
    });

    return {
      success: true,
      data: deleted,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error al eliminar respuesta predeterminada";
    return {
      success: false,
      error: errorMessage,
      code: "QUICK_REPLY_DELETE_ERROR",
    };
  }
}

/**
 * -----------------------------------------------------------------------------
 * INSTAGRAM POSTS & COMMENTS MANAGEMENT (Milestone M3)
 * -----------------------------------------------------------------------------
 */

const GetInstagramPostsSchema = z.object({
  environment: z.string().default("farfalina"),
});

const GetInstagramCommentsSchema = z.object({
  postId: z.string().min(1, "ID de la publicación es requerido"),
  environment: z.string().default("farfalina"),
});

const ReplyInstagramCommentSchema = z.object({
  commentId: z.string().min(1, "El ID del comentario es requerido"),
  text: z.string().min(1, "El texto de la respuesta no puede estar vacío"),
  replyType: z.enum(["public", "private"]).default("public"),
  environment: z.string().default("farfalina"),
});

export type ReplyInstagramCommentInput = z.infer<typeof ReplyInstagramCommentSchema>;

/**
 * Retrieves all Instagram posts stored in SQLite for the given tenant/environment.
 * Includes comment count and preview comments.
 */
export async function getInstagramPostsAction(
  params?: string | { environment?: string }
): Promise<ActionResponse> {
  try {
    const rawEnv = typeof params === "string" ? params : params?.environment || "farfalina";
    const env = rawEnv.toLowerCase().trim();

    const posts = await prisma.instagramPost.findMany({
      where: { environment: env },
      include: {
        _count: {
          select: { comments: true },
        },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: [
        { timestamp: "desc" },
        { createdAt: "desc" },
      ],
    });

    return {
      success: true,
      data: posts,
      code: "SUCCESS",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al obtener publicaciones de Instagram";
    return {
      success: false,
      error: errorMsg,
      code: "GET_POSTS_ERROR",
    };
  }
}

/**
 * Retrieves all comments for a specific Instagram post, including nested replies.
 */
export async function getInstagramCommentsAction(
  params: string | { postId: string; environment?: string },
  secondaryEnv?: string
): Promise<ActionResponse> {
  try {
    let postId: string;
    let env = "farfalina";

    if (typeof params === "string") {
      postId = params;
      if (secondaryEnv) env = secondaryEnv.toLowerCase().trim();
    } else {
      postId = params.postId;
      if (params.environment) env = params.environment.toLowerCase().trim();
    }

    if (!postId || !postId.trim()) {
      return {
        success: false,
        error: "ID de la publicación es requerido",
        code: "VALIDATION_ERROR",
      };
    }

    // Resolve post either by internal ID or instagramId
    const post = await prisma.instagramPost.findFirst({
      where: {
        OR: [{ id: postId.trim() }, { instagramId: postId.trim() }],
      },
    });

    if (!post) {
      return {
        success: false,
        error: "Publicación de Instagram no encontrada",
        code: "POST_NOT_FOUND",
      };
    }

    // Fetch comments for this post with nested replies
    const comments = await prisma.instagramComment.findMany({
      where: { postId: post.id },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: comments,
      code: "SUCCESS",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al obtener comentarios de Instagram";
    return {
      success: false,
      error: errorMsg,
      code: "GET_COMMENTS_ERROR",
    };
  }
}

/**
 * Responds to an Instagram comment either publicly (POST /{comment_id}/replies)
 * or privately via Direct Message (Private Reply recipient: { comment_id }).
 */
export async function replyInstagramCommentAction(
  params:
    | { commentId: string; text: string; replyType?: "public" | "private"; environment?: string }
    | string,
  secondArg?: string,
  thirdArg?: "public" | "private",
  fourthArg?: string
): Promise<ActionResponse> {
  try {
    let commentId: string;
    let text: string;
    let replyType: "public" | "private" = "public";
    let environment = "farfalina";

    if (typeof params === "string") {
      commentId = params;
      text = secondArg || "";
      if (thirdArg) replyType = thirdArg;
      if (fourthArg) environment = fourthArg;
    } else {
      commentId = params.commentId;
      text = params.text;
      if (params.replyType) replyType = params.replyType;
      if (params.environment) environment = params.environment;
    }

    const parsed = ReplyInstagramCommentSchema.safeParse({
      commentId,
      text,
      replyType,
      environment,
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Datos de respuesta inválidos",
        code: "VALIDATION_ERROR",
      };
    }

    const { commentId: targetCommentId, text: replyText, replyType: targetType, environment: env } = parsed.data;

    // 1. Find comment in SQLite
    const comment = await prisma.instagramComment.findFirst({
      where: {
        OR: [{ id: targetCommentId }, { instagramId: targetCommentId }],
      },
      include: { post: true },
    });

    if (!comment) {
      return {
        success: false,
        error: "Comentario no encontrado en la base de datos",
        code: "COMMENT_NOT_FOUND",
      };
    }

    // 2. Enforce Meta policy restrictions
    if (targetType === "private") {
      if (comment.isPrivateReplySent) {
        return {
          success: false,
          error: "Ya se ha enviado una respuesta privada a este comentario (Meta restringe a máx. 1 respuesta privada)",
          code: "PRIVATE_REPLY_ALREADY_SENT",
        };
      }

      if (comment.timestamp) {
        const commentAgeMs = Date.now() - new Date(comment.timestamp).getTime();
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (commentAgeMs > maxAgeMs) {
          return {
            success: false,
            error: "Meta Graph API prohíbe respuestas privadas a comentarios de más de 7 días",
            code: "PRIVATE_REPLY_EXPIRED",
          };
        }
      }
    }

    // 3. Retrieve ChannelConfig for Instagram
    const config = await prisma.channelConfig.findFirst({
      where: {
        channel: "Instagram",
        environment: env,
        status: "CONNECTED",
      },
    });

    if (!config?.instagramAccessToken) {
      return {
        success: false,
        error: `No hay credenciales activas de Instagram conectadas en ChannelConfig para ${env}`,
        code: "CHANNEL_NOT_CONNECTED",
      };
    }

    // 4. Dispatch reply via Meta Graph API
    if (targetType === "public") {
      const dispatchResult = await replyInstagramCommentPublic({
        accessToken: config.instagramAccessToken,
        commentId: comment.instagramId,
        message: replyText.trim(),
      });

      if (!dispatchResult.success) {
        return {
          success: false,
          error: dispatchResult.error || "Error al publicar respuesta en Instagram",
          code: "GRAPH_API_DISPATCH_ERROR",
        };
      }

      // Persist the operator's public reply in SQLite
      const createdReply = await prisma.instagramComment.create({
        data: {
          instagramId: dispatchResult.replyId || `pub_reply_${Date.now()}`,
          postId: comment.postId,
          parentId: comment.id,
          text: replyText.trim(),
          fromUsername: env === "carissma" ? "carissma_vestidos" : "sour_jhxn",
          isReply: true,
          environment: env,
          timestamp: new Date(),
        },
      });

      // Increment comments count on post
      await prisma.instagramPost.update({
        where: { id: comment.postId },
        data: { commentsCount: { increment: 1 } },
      });

      return {
        success: true,
        data: createdReply,
        code: "SUCCESS",
      };
    } else {
      // Private Reply via Direct Message
      const dispatchResult = await replyInstagramCommentPrivate({
        accessToken: config.instagramAccessToken,
        commentId: comment.instagramId,
        message: replyText.trim(),
      });

      if (!dispatchResult.success) {
        return {
          success: false,
          error: dispatchResult.error || "Error al enviar mensaje privado al comentarista",
          code: "GRAPH_API_DISPATCH_ERROR",
        };
      }

      // Mark comment as private reply sent
      await prisma.instagramComment.update({
        where: { id: comment.id },
        data: {
          isPrivateReplySent: true,
          privateReplyText: replyText.trim(),
        },
      });

      // Synchronize / create ChatThread and ChatMessage in direct inbox
      let threadId: string | null = null;
      if (comment.fromId) {
        const thread = await prisma.chatThread.upsert({
          where: {
            chatthread_tenant_unique: {
              channel: "Instagram",
              phone: comment.fromId,
              environment: env,
            },
          },
          update: {
            lastMessage: replyText.trim(),
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          },
          create: {
            channel: "Instagram",
            phone: comment.fromId,
            clientName: comment.fromUsername ? `@${comment.fromUsername}` : `Instagram (${comment.fromId.slice(-4)})`,
            profilePicUrl: comment.userProfilePic || null,
            lastMessage: replyText.trim(),
            lastMessageAt: new Date(),
            unreadCount: 0,
            status: "PENDING",
            environment: env,
          },
        });

        threadId = thread.id;

        await prisma.chatMessage.create({
          data: {
            threadId: thread.id,
            sender: "agent",
            text: replyText.trim(),
            externalId: dispatchResult.messageId || `priv_rep_${Date.now()}`,
            environment: env,
            timestamp: new Date(),
          },
        });
      }

      return {
        success: true,
        data: {
          commentId: comment.id,
          messageId: dispatchResult.messageId,
          threadId,
          isPrivateReplySent: true,
          privateReplyText: replyText.trim(),
        },
        code: "SUCCESS",
      };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error inesperado al responder comentario";
    return {
      success: false,
      error: errorMsg,
      code: "REPLY_COMMENT_ERROR",
    };
  }
}

/**
 * On-demand synchronization of Instagram posts and comments from Meta Graph API.
 */
export async function syncInstagramPostsAction(
  params?: string | { environment?: string }
): Promise<ActionResponse> {
  try {
    const rawEnv = typeof params === "string" ? params : params?.environment || "farfalina";
    const env = rawEnv.toLowerCase().trim();

    const config = await prisma.channelConfig.findFirst({
      where: {
        channel: "Instagram",
        environment: env,
        status: "CONNECTED",
      },
    });

    if (!config?.instagramAccessToken) {
      return {
        success: false,
        error: `No hay credenciales activas de Instagram configuradas para ${env}`,
        code: "CHANNEL_NOT_CONNECTED",
      };
    }

    const mediaRes = await fetchInstagramMediaFromGraphApi({
      accessToken: config.instagramAccessToken,
      accountId: config.instagramAccountId || undefined,
      limit: 25,
    });

    if (!mediaRes.success || !mediaRes.data) {
      return {
        success: false,
        error: mediaRes.error || "No se pudieron obtener publicaciones de Meta Graph API",
        code: "GRAPH_API_ERROR",
      };
    }

    let syncedPosts = 0;
    let syncedComments = 0;

    for (const item of mediaRes.data) {
      const post = await prisma.instagramPost.upsert({
        where: { instagramId: item.id },
        update: {
          caption: item.caption || undefined,
          mediaType: item.media_type || undefined,
          mediaUrl: item.media_url || undefined,
          thumbnailUrl: item.thumbnail_url || undefined,
          permalink: item.permalink || undefined,
          likeCount: item.like_count ?? 0,
          timestamp: item.timestamp ? new Date(item.timestamp) : undefined,
          updatedAt: new Date(),
        },
        create: {
          instagramId: item.id,
          caption: item.caption || null,
          mediaType: item.media_type || "IMAGE",
          mediaUrl: item.media_url || null,
          thumbnailUrl: item.thumbnail_url || null,
          permalink: item.permalink || null,
          likeCount: item.like_count ?? 0,
          commentsCount: item.comments_count ?? 0,
          timestamp: item.timestamp ? new Date(item.timestamp) : new Date(),
          environment: env,
        },
      });
      syncedPosts++;

      // Sync comments for this post
      const commentsRes = await fetchInstagramCommentsFromGraphApi({
        accessToken: config.instagramAccessToken,
        mediaId: item.id,
      });

      if (commentsRes.success && Array.isArray(commentsRes.data)) {
        for (const comm of commentsRes.data) {
          const fromId = comm.from?.id || null;
          const fromUsername = comm.username || comm.from?.username || null;
          const commentTime = comm.timestamp ? new Date(comm.timestamp) : new Date();

          await prisma.instagramComment.upsert({
            where: { instagramId: comm.id },
            update: {
              text: comm.text,
              fromId: fromId || undefined,
              fromUsername: fromUsername || undefined,
              updatedAt: new Date(),
            },
            create: {
              instagramId: comm.id,
              postId: post.id,
              text: comm.text,
              fromId,
              fromUsername,
              isReply: Boolean(comm.parent_id),
              environment: env,
              timestamp: commentTime,
            },
          });
          syncedComments++;
        }

        // Update real comments count
        const total = await prisma.instagramComment.count({ where: { postId: post.id } });
        await prisma.instagramPost.update({
          where: { id: post.id },
          data: { commentsCount: total },
        });
      }
    }

    return {
      success: true,
      data: { syncedPosts, syncedComments },
      code: "SUCCESS",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error al sincronizar publicaciones de Instagram";
    return {
      success: false,
      error: errorMsg,
      code: "SYNC_POSTS_ERROR",
    };
  }
}

export interface SyncHistoricalConversationsParams {
  environment?: string;
  limitConversations?: number;
  maxMessagesPerThread?: number;
  downloadMedia?: boolean;
}

export interface SyncHistoricalResult {
  syncedConversations: number;
  syncedMessages: number;
  skippedDuplicates: number;
}

/**
 * On-demand retroactive synchronization (backfill) of historical Instagram Direct conversations and messages.
 * Queries Meta Graph API GET /me/conversations, walks pagination, enriches customer profiles,
 * upserts ChatThread, and deduplicates ChatMessage records strictly by externalId (Meta mid).
 */
export async function syncHistoricalConversationsAction(
  params?: string | SyncHistoricalConversationsParams
): Promise<ActionResponse<SyncHistoricalResult>> {
  try {
    const rawEnv = typeof params === "string" ? params : params?.environment || "farfalina";
    const env = rawEnv.toLowerCase().trim();
    const limitConversations = typeof params === "object" && params.limitConversations ? params.limitConversations : 50;
    const maxMessagesPerThread = typeof params === "object" && params.maxMessagesPerThread ? params.maxMessagesPerThread : 100;
    const downloadMedia = typeof params === "object" && params.downloadMedia !== undefined ? params.downloadMedia : true;

    // 1. Retrieve active Instagram ChannelConfig
    const config = await prisma.channelConfig.findFirst({
      where: {
        channel: "Instagram",
        environment: env,
        status: "CONNECTED",
      },
    });

    if (!config?.instagramAccessToken) {
      return {
        success: false,
        error: `No hay credenciales activas de Instagram conectadas en ChannelConfig para ${env}`,
        code: "CHANNEL_NOT_CONNECTED",
      };
    }

    // 2. Fetch historical conversations from Meta Graph API
    const fetchResult = await fetchHistoricalInstagramConversations({
      accessToken: config.instagramAccessToken,
      accountId: config.instagramAccountId || undefined,
      limitConversations,
      maxMessagesPerThread,
    });

    if (!fetchResult.success || !fetchResult.data) {
      return {
        success: false,
        error: fetchResult.error || "Error al obtener conversaciones históricas de Instagram",
        code: "GRAPH_API_ERROR",
      };
    }

    const businessAccountId = (config.instagramAccountId || "29643476368611224").trim();
    const knownBusinessIds = new Set([businessAccountId, "17841406898817900"]);
    const knownBusinessUsernames = new Set(["sour_jhxn", "carissma_vestidos"]);

    let syncedConversations = 0;
    let syncedMessages = 0;
    let skippedDuplicates = 0;

    // 3. Process each conversation
    for (const conv of fetchResult.data) {
      // Identify participant external ID (excluding business account)
      const customerParticipants = conv.participants.filter((p) => {
        const isBizId = knownBusinessIds.has(p.id);
        const isBizUsername = p.username && knownBusinessUsernames.has(p.username.toLowerCase());
        return !isBizId && !isBizUsername;
      });

      const customer =
        customerParticipants[0] ||
        conv.participants.find((p) => !knownBusinessIds.has(p.id)) ||
        conv.participants[0];

      if (!customer) continue;

      const participantId = customer.id;

      // Resolve or enrich user profile with getInstagramUserProfile
      let clientName = customer.username
        ? `@${customer.username.replace(/^@/, "")}`
        : `Instagram (${participantId.slice(-4)})`;
      let profilePicUrl: string | null = null;

      try {
        const profile = await getInstagramUserProfile(participantId, config.instagramAccessToken);
        if (profile) {
          if (profile.username) {
            clientName = `@${profile.username.replace(/^@/, "")}`;
          } else if (profile.name) {
            clientName = profile.name;
          }
          if (profile.profilePicUrl) {
            profilePicUrl = profile.profilePicUrl;
          }
        }
      } catch (profErr) {
        console.warn(`[Sync Historical] Error al enriquecer perfil para ${participantId}:`, profErr);
      }

      // Upsert CRMClient
      await prisma.cRMClient.upsert({
        where: { phone: participantId },
        update: {
          name: clientName,
          notes: `Origen: INSTAGRAM | Canal: Instagram Direct | IGSID: ${participantId}`,
        },
        create: {
          name: clientName,
          phone: participantId,
          notes: `Origen: INSTAGRAM | Canal: Instagram Direct | IGSID: ${participantId}`,
        },
      }).catch(() => {});

      // Upsert ChatThread
      const convDate = conv.updated_time ? new Date(conv.updated_time) : new Date();
      const thread = await prisma.chatThread.upsert({
        where: {
          chatthread_tenant_unique: {
            channel: "Instagram",
            phone: participantId,
            environment: env,
          },
        },
        update: {
          externalId: conv.id,
          ...(clientName ? { clientName } : {}),
          ...(profilePicUrl ? { profilePicUrl } : {}),
        },
        create: {
          channel: "Instagram",
          phone: participantId,
          environment: env,
          clientName,
          profilePicUrl,
          status: "Por Responder",
          lastMessage: "",
          lastMessageAt: convDate,
          externalId: conv.id,
          unreadCount: 0,
          createdAt: convDate,
        },
      });

      // Sort messages chronologically
      const sortedMsgs = [...conv.messages].sort(
        (a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
      );

      // Ingest and deduplicate messages
      for (const msg of sortedMsgs) {
        // If a message with the same externalId already exists, skip it (ensuring 100% idempotency)
        const existingMsg = await prisma.chatMessage.findFirst({
          where: {
            OR: [
              { threadId: thread.id, externalId: msg.id },
              { externalId: msg.id },
            ],
          },
        });

        if (existingMsg) {
          skippedDuplicates++;
          continue;
        }

        // Handle attachment structures
        let mediaUrl: string | null = null;
        let mediaType: string | null = null;

        if (msg.attachments && msg.attachments.length > 0) {
          const att = msg.attachments[0];
          mediaType = att.type === "unknown" ? "image" : att.type;

          if (att.url) {
            if (downloadMedia) {
              const cached = await downloadAndCacheMetaMedia({
                url: att.url,
                folder: "instagram",
                filenamePrefix: "hist_ig",
                accessToken: config.instagramAccessToken,
              });
              mediaUrl = cached?.localUrl || att.url;
            } else {
              mediaUrl = att.url;
            }
          }
        }

        const isFromCustomer = msg.from?.id === participantId;
        const sender = isFromCustomer ? "customer" : "agent";

        const fallbackText =
          mediaType === "image"
            ? "[Imagen]"
            : mediaType === "video"
            ? "[Video]"
            : mediaType === "audio"
            ? "[Nota de voz]"
            : mediaType
            ? "[Archivo adjunto]"
            : "";

        const messageText = msg.message?.trim() || fallbackText;
        const msgDate = msg.created_time ? new Date(msg.created_time) : new Date();

        await prisma.chatMessage.create({
          data: {
            threadId: thread.id,
            sender,
            text: messageText,
            mediaUrl,
            mediaType,
            environment: env,
            externalId: msg.id,
            timestamp: msgDate,
            createdAt: msgDate,
          },
        });

        syncedMessages++;
      }

      // Update ChatThread.lastMessage, lastMessageAt and updatedAt
      const latestMessage = await prisma.chatMessage.findFirst({
        where: { threadId: thread.id },
        orderBy: { createdAt: "desc" },
      });

      if (latestMessage) {
        await prisma.chatThread.update({
          where: { id: thread.id },
          data: {
            lastMessage: latestMessage.text || (latestMessage.mediaType === "image" ? "[Imagen adjunta]" : "[Archivo adjunto]"),
            lastMessageAt: latestMessage.createdAt,
            updatedAt: latestMessage.createdAt,
          },
        });
      }

      syncedConversations++;
    }

    return {
      success: true,
      data: {
        syncedConversations,
        syncedMessages,
        skippedDuplicates,
      },
      code: "SUCCESS",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error inesperado al sincronizar historial";
    console.error("[Omnichannel Sync History] Error:", err);
    return {
      success: false,
      error: errorMsg,
      code: "SYNC_HISTORICAL_ERROR",
    };
  }
}


