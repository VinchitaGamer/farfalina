import { z } from "zod";

export const ChatMessageSchema = z.object({
  id: z.string(),
  threadId: z.string().optional(),
  sender: z.string(),
  text: z.string(),
  mediaUrl: z.string().nullable().optional(),
  mediaType: z.string().nullable().optional(),
  mediaCaption: z.string().nullable().optional(),
  isFromClient: z.boolean().default(false),
  timestamp: z.union([z.date(), z.string()]),
});
export type ChatMessageItem = z.infer<typeof ChatMessageSchema>;

export const ChannelThreadSchema = z.object({
  id: z.string(),
  channel: z.string(),
  phone: z.string(),
  clientName: z.string().nullable().optional(),
  status: z.string().default("Pendientes"),
  unreadCount: z.number().int().default(0),
  lastMessageText: z.string().nullable().optional(),
  lastMessageAt: z.union([z.date(), z.string()]).nullable().optional(),
  assignedAgent: z.string().nullable().optional(),
  profilePictureUrl: z.string().nullable().optional(),
  environment: z.string().default("farfalina"),
  messages: z.array(ChatMessageSchema).optional(),
});
export type ChannelThread = z.infer<typeof ChannelThreadSchema>;

export const ChannelConfigSchema = z.object({
  id: z.string(),
  channel: z.string(),
  environment: z.string().default("farfalina"),
  status: z.string().default("disconnected"),
  botEnabled: z.boolean().default(false),
  autoReplyText: z.string().nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  pageName: z.string().nullable().optional(),
  igUsername: z.string().nullable().optional(),
});
export type ChannelConfigData = z.infer<typeof ChannelConfigSchema>;

export const QuickReplySchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  shortcut: z.string(),
  category: z.string().default("General"),
  attachmentUrl: z.string().nullable().optional(),
  attachmentType: z.string().nullable().optional(),
  attachmentName: z.string().nullable().optional(),
  environment: z.string().default("farfalina"),
});
export type QuickReplyItem = z.infer<typeof QuickReplySchema>;
