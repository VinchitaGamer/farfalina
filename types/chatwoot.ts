import { z } from "zod";

/**
 * @description Esquema de archivo adjunto en Chatwoot
 */
export const ChatwootAttachmentSchema = z.object({
  id: z.number(),
  file_type: z.string(),
  data_url: z.string(),
  thumb_url: z.string().optional(),
  file_name: z.string().optional(),
  file_size: z.number().optional(),
}).passthrough();

/**
 * @description Esquema del remitente (sender) en Chatwoot
 */
export const ChatwootSenderSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  type: z.enum(['contact', 'user', 'agent', 'bot']).optional(),
}).passthrough();

/**
 * @description Esquema de un mensaje en Chatwoot
 */
export const ChatwootMessageSchema = z.object({
  id: z.number(),
  content: z.string().optional().nullable(),
  message_type: z.union([z.number(), z.string()]).optional(),
  content_type: z.string().optional().nullable(),
  private: z.boolean().optional(),
  created_at: z.string().optional(),
  attachments: z.array(ChatwootAttachmentSchema).optional().default([]),
  sender: ChatwootSenderSchema.optional().nullable(),
  conversation_id: z.number().optional(),
  account_id: z.number().optional(),
  inbox_id: z.number().optional(),
  source_id: z.string().optional().nullable(),
}).passthrough();

/**
 * @description Esquema de contacto en Chatwoot
 */
export const ChatwootContactSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  identifier: z.string().optional().nullable(),
  thumbnail: z.string().optional().nullable(),
  custom_attributes: z.record(z.unknown()).optional().default({}),
  additional_attributes: z.record(z.unknown()).optional().default({}),
}).passthrough();

/**
 * @description Esquema de conversación en Chatwoot
 */
export const ChatwootConversationSchema = z.object({
  id: z.number(),
  display_id: z.number().optional(),
  inbox_id: z.number().optional(),
  status: z.enum(['open', 'resolved', 'pending', 'snoozed']).optional(),
  account_id: z.number().optional(),
  additional_attributes: z.record(z.unknown()).optional().default({}),
  custom_attributes: z.record(z.unknown()).optional().default({}),
  assignee: z.object({
    id: z.number(),
    name: z.string(),
  }).optional().nullable(),
  contact: ChatwootContactSchema.optional().nullable(),
  messages: z.array(ChatwootMessageSchema).optional().default([]),
  labels: z.array(z.string()).optional().default([]),
  unread_count: z.number().optional().default(0),
  channel: z.string().optional(),
}).passthrough();

/**
 * @description Eventos posibles en webhooks de Chatwoot
 */
export const ChatwootWebhookEventSchema = z.enum([
  'message_created', 'message_updated', 
  'conversation_created', 'conversation_updated', 'conversation_status_changed',
  'contact_created', 'contact_updated',
  'conversation_typing_on', 'conversation_typing_off',
  'webwidget_triggered'
]);

/**
 * @description Esquema de Payload de Webhook de Chatwoot
 */
export const ChatwootWebhookPayloadSchema = z.object({
  event: ChatwootWebhookEventSchema,
  id: z.number().optional(),
  content: z.string().optional().nullable(),
  message_type: z.union([z.number(), z.string()]).optional(),
  content_type: z.string().optional().nullable(),
  private: z.boolean().optional(),
  created_at: z.string().optional(),
  attachments: z.array(ChatwootAttachmentSchema).optional().default([]),
  sender: ChatwootSenderSchema.optional().nullable(),
  contact: ChatwootContactSchema.partial().optional().nullable(),
  conversation: ChatwootConversationSchema.partial().optional().nullable(),
  account: z.object({ id: z.number(), name: z.string().optional() }).optional().nullable(),
  inbox: z.object({ id: z.number(), name: z.string().optional() }).optional().nullable(),
  status: z.string().optional(),
  changed_attributes: z.record(z.unknown()).optional(),
}).passthrough();

/**
 * @description Esquema de Bandeja (Inbox) en Chatwoot
 */
export const ChatwootInboxSchema = z.object({
  id: z.number(),
  name: z.string(),
  channel_type: z.string(),
  greeting_enabled: z.boolean().optional(),
  greeting_message: z.string().optional().nullable(),
}).passthrough();

/**
 * @description Esquema de entrada para acciones de envío de mensajes
 */
export const SendChatwootMessageInputSchema = z.object({
  conversationId: z.number(),
  content: z.string().default(''),
  messageType: z.enum(['outgoing', 'incoming', 'activity']).default('outgoing'),
  private: z.boolean().default(false),
});

/**
 * @description Esquema de configuración de API Chatwoot
 */
export const ChatwootConfigSchema = z.object({
  baseUrl: z.string().url(),
  apiToken: z.string().min(1),
  accountId: z.string().min(1),
});

export type ChatwootAttachment = z.infer<typeof ChatwootAttachmentSchema>;
export type ChatwootSender = z.infer<typeof ChatwootSenderSchema>;
export type ChatwootMessage = z.infer<typeof ChatwootMessageSchema>;
export type ChatwootContact = z.infer<typeof ChatwootContactSchema>;
export type ChatwootConversation = z.infer<typeof ChatwootConversationSchema>;
export type ChatwootWebhookEvent = z.infer<typeof ChatwootWebhookEventSchema>;
export type ChatwootWebhookPayload = z.infer<typeof ChatwootWebhookPayloadSchema>;
export type ChatwootInbox = z.infer<typeof ChatwootInboxSchema>;
export type SendChatwootMessageInput = z.infer<typeof SendChatwootMessageInputSchema>;
export type ChatwootConfig = z.infer<typeof ChatwootConfigSchema>;
