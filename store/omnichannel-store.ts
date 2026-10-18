import { create } from 'zustand';
import { z } from 'zod';

// === Zod Schemas as source of truth ===

/**
 * Esquema para un mensaje omnicanal.
 */
export const OmnichannelMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  chatwootMessageId: z.number().optional().nullable(),
  sender: z.enum(['customer', 'bot', 'agent']),
  text: z.string(),
  mediaUrl: z.string().optional().nullable(),
  mediaType: z.string().optional().nullable(),
  attachments: z.array(z.object({
    id: z.number().optional(),
    fileType: z.string(),
    dataUrl: z.string(),
    thumbUrl: z.string().optional().nullable(),
    fileName: z.string().optional().nullable(),
  })).optional().default([]),
  createdAt: z.union([z.string(), z.date()]),
  isPrivate: z.boolean().default(false),
});

/**
 * Esquema para un hilo de conversación omnicanal.
 */
export const OmnichannelThreadSchema = z.object({
  id: z.string(),
  chatwootConversationId: z.number().optional().nullable(),
  chatwootContactId: z.number().optional().nullable(),
  clientName: z.string(),
  phone: z.string(),
  channel: z.enum(['WhatsApp', 'Facebook', 'Instagram', 'Web']),
  status: z.enum(['Por Responder', 'Pendientes', 'Archivados']),
  lastMessage: z.string(),
  assignedAgent: z.string().default('Agente General'),
  profilePicUrl: z.string().optional().nullable(),
  unreadCount: z.number().default(0),
  lastMessageAt: z.union([z.string(), z.date()]).optional().nullable(),
  messages: z.array(OmnichannelMessageSchema).default([]),
});

export type OmnichannelMessage = z.infer<typeof OmnichannelMessageSchema>;
export type OmnichannelThread = z.infer<typeof OmnichannelThreadSchema>;

// === Connection Status ===
export const ConnectionStatusSchema = z.enum([
  'connected', 'connecting', 'disconnected', 'error'
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

// === Channel Status ===
export const ChannelStatusSchema = z.object({
  whatsapp: ConnectionStatusSchema.default('disconnected'),
  facebook: ConnectionStatusSchema.default('disconnected'),
  instagram: ConnectionStatusSchema.default('disconnected'),
});
export type ChannelStatus = z.infer<typeof ChannelStatusSchema>;

// === Store Interface ===
interface OmnichannelState {
  // Data
  threads: OmnichannelThread[];
  selectedThreadId: string;
  channelStatus: ChannelStatus;
  chatwootConnected: boolean;
  
  // Filters
  statusFilter: 'Todos' | 'Por Responder' | 'Pendientes' | 'Archivados';
  channelFilter: 'Todos' | 'WhatsApp' | 'Facebook' | 'Instagram';
  searchQuery: string;
  
  // UI State
  mobileTab: 'list' | 'chat' | 'crm';
  inputMessage: string;
  attachedFile: {
    name: string;
    type: string;
    base64?: string;
    previewUrl?: string;
    existingUrl?: string;
  } | null;
  isSending: boolean;
  isLoading: boolean;
  isConfigModalOpen: boolean;
  isQuickRepliesModalOpen: boolean;
  drawerOpen: boolean;
  rentalDrawerOpen: boolean;
  
  // Name editing
  isEditingName: boolean;
  nameInputValue: string;
  
  // Lightbox
  activeLightboxImg: { url: string; caption?: string } | null;
  zoomScale: number;
  
  // Actions - Data
  setThreads: (threads: OmnichannelThread[]) => void;
  addThread: (thread: OmnichannelThread) => void;
  updateThread: (threadId: string, updates: Partial<OmnichannelThread>) => void;
  removeThread: (threadId: string) => void;
  setSelectedThreadId: (id: string) => void;
  addMessageToThread: (threadId: string, message: OmnichannelMessage) => void;
  updateMessageInThread: (threadId: string, messageId: string, updates: Partial<OmnichannelMessage>) => void;
  setChannelStatus: (status: Partial<ChannelStatus>) => void;
  setChatwootConnected: (connected: boolean) => void;
  
  // Actions - Filters
  setStatusFilter: (filter: 'Todos' | 'Por Responder' | 'Pendientes' | 'Archivados') => void;
  setChannelFilter: (filter: 'Todos' | 'WhatsApp' | 'Facebook' | 'Instagram') => void;
  setSearchQuery: (query: string) => void;
  
  // Actions - UI
  setMobileTab: (tab: 'list' | 'chat' | 'crm') => void;
  setInputMessage: (msg: string) => void;
  setAttachedFile: (file: OmnichannelState['attachedFile']) => void;
  setIsSending: (sending: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setIsConfigModalOpen: (open: boolean) => void;
  setIsQuickRepliesModalOpen: (open: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  setRentalDrawerOpen: (open: boolean) => void;
  
  // Actions - Name editing
  setIsEditingName: (editing: boolean) => void;
  setNameInputValue: (value: string) => void;
  
  // Actions - Lightbox
  openLightbox: (url: string, caption?: string) => void;
  closeLightbox: () => void;
  setZoomScale: (scale: number) => void;
  
  // Computed-like helpers
  getFilteredThreads: () => OmnichannelThread[];
  getActiveThread: () => OmnichannelThread | undefined;
  getThreadById: (id: string) => OmnichannelThread | undefined;
  
  // Bulk operations
  clearAllThreads: () => void;
  markThreadAsRead: (threadId: string) => void;
  
  // Real-time message handling from Chatwoot webhook
  handleIncomingChatwootMessage: (payload: {
    chatwootConversationId: number;
    chatwootContactId?: number;
    message: Partial<OmnichannelMessage>;
    contactName?: string;
    contactPhone?: string;
    channel?: string;
    inboxId?: number;
  }) => void;
  
  handleConversationStatusChange: (payload: {
    chatwootConversationId: number;
    newStatus: string;
  }) => void;
}

/**
 * Zustand store para gestionar el estado de los mensajes omnicanal y Chatwoot.
 */
export const useOmnichannelStore = create<OmnichannelState>((set, get) => ({
  // Data
  threads: [],
  selectedThreadId: '',
  channelStatus: {
    whatsapp: 'disconnected',
    facebook: 'disconnected',
    instagram: 'disconnected',
  },
  chatwootConnected: false,
  
  // Filters
  statusFilter: 'Todos',
  channelFilter: 'Todos',
  searchQuery: '',
  
  // UI State
  mobileTab: 'list',
  inputMessage: '',
  attachedFile: null,
  isSending: false,
  isLoading: false,
  isConfigModalOpen: false,
  isQuickRepliesModalOpen: false,
  drawerOpen: false,
  rentalDrawerOpen: false,
  
  // Name editing
  isEditingName: false,
  nameInputValue: '',
  
  // Lightbox
  activeLightboxImg: null,
  zoomScale: 1,

  // --- Actions - Data ---
  setThreads: (threads) => set({ threads }),
  
  addThread: (thread) => set((state) => ({ 
    threads: [...state.threads, thread] 
  })),
  
  updateThread: (threadId, updates) => set((state) => ({
    threads: state.threads.map(t => t.id === threadId ? { ...t, ...updates } : t)
  })),
  
  removeThread: (threadId) => set((state) => ({
    threads: state.threads.filter(t => t.id !== threadId)
  })),
  
  setSelectedThreadId: (id) => set({ selectedThreadId: id }),
  
  addMessageToThread: (threadId, message) => set((state) => {
    return {
      threads: state.threads.map(t => {
        if (t.id === threadId) {
          const isIncoming = message.sender === 'customer';
          return {
            ...t,
            messages: [...t.messages, message],
            lastMessage: message.text || (message.mediaType ? `[${message.mediaType}]` : '[Mensaje]'),
            lastMessageAt: message.createdAt,
            unreadCount: isIncoming ? t.unreadCount + 1 : t.unreadCount,
            status: isIncoming ? 'Por Responder' : t.status,
          };
        }
        return t;
      })
    };
  }),
  
  updateMessageInThread: (threadId, messageId, updates) => set((state) => ({
    threads: state.threads.map(t => {
      if (t.id === threadId) {
        return {
          ...t,
          messages: t.messages.map(m => m.id === messageId ? { ...m, ...updates } : m)
        };
      }
      return t;
    })
  })),
  
  setChannelStatus: (status) => set((state) => ({
    channelStatus: { ...state.channelStatus, ...status }
  })),
  
  setChatwootConnected: (connected) => set({ chatwootConnected: connected }),

  // --- Actions - Filters ---
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setChannelFilter: (filter) => set({ channelFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  // --- Actions - UI ---
  setMobileTab: (tab) => set({ mobileTab: tab }),
  setInputMessage: (msg) => set({ inputMessage: msg }),
  setAttachedFile: (file) => set({ attachedFile: file }),
  setIsSending: (sending) => set({ isSending: sending }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsConfigModalOpen: (open) => set({ isConfigModalOpen: open }),
  setIsQuickRepliesModalOpen: (open) => set({ isQuickRepliesModalOpen: open }),
  setDrawerOpen: (open) => set({ drawerOpen: open }),
  setRentalDrawerOpen: (open) => set({ rentalDrawerOpen: open }),

  // --- Actions - Name editing ---
  setIsEditingName: (editing) => set({ isEditingName: editing }),
  setNameInputValue: (value) => set({ nameInputValue: value }),

  // --- Actions - Lightbox ---
  openLightbox: (url, caption) => set({ activeLightboxImg: { url, caption }, zoomScale: 1 }),
  closeLightbox: () => set({ activeLightboxImg: null, zoomScale: 1 }),
  setZoomScale: (scale) => set({ zoomScale: scale }),

  // --- Computed-like helpers ---
  getFilteredThreads: () => {
    const state = get();
    return state.threads.filter(thread => {
      const matchStatus = state.statusFilter === 'Todos' || thread.status === state.statusFilter;
      const matchChannel = state.channelFilter === 'Todos' || thread.channel === state.channelFilter;
      const searchLower = state.searchQuery.toLowerCase();
      const matchSearch = !state.searchQuery || 
        thread.clientName.toLowerCase().includes(searchLower) ||
        thread.phone.toLowerCase().includes(searchLower) ||
        thread.lastMessage.toLowerCase().includes(searchLower);
      
      return matchStatus && matchChannel && matchSearch;
    }).sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA; // Orden descendente (más recientes primero)
    });
  },
  
  getActiveThread: () => {
    const state = get();
    return state.threads.find(t => t.id === state.selectedThreadId);
  },
  
  getThreadById: (id) => {
    const state = get();
    return state.threads.find(t => t.id === id);
  },

  // --- Bulk operations ---
  clearAllThreads: () => set({ threads: [] }),
  
  markThreadAsRead: (threadId) => set((state) => ({
    threads: state.threads.map(t => 
      t.id === threadId ? { ...t, unreadCount: 0 } : t
    )
  })),

  // --- Real-time message handling from Chatwoot webhook ---
  handleIncomingChatwootMessage: (payload) => {
    const {
      chatwootConversationId,
      chatwootContactId,
      message,
      contactName = 'Cliente',
      contactPhone = '',
      channel = 'WhatsApp',
    } = payload;
    
    if (!message.id) return;
    
    const state = get();
    let thread = state.threads.find(t => t.chatwootConversationId === chatwootConversationId);
    
    const isIncoming = message.sender === 'customer';
    const summaryText = message.text || (message.mediaType ? `[${message.mediaType}]` : '[Mensaje]');
    
    const fullMessage: OmnichannelMessage = {
      id: message.id,
      threadId: thread?.id || `temp-${chatwootConversationId}`,
      chatwootMessageId: message.chatwootMessageId,
      sender: message.sender || 'customer',
      text: message.text || '',
      mediaUrl: message.mediaUrl,
      mediaType: message.mediaType,
      attachments: message.attachments || [],
      createdAt: message.createdAt || new Date(),
      isPrivate: message.isPrivate || false,
    };
    
    if (thread) {
      // Hilo existente, agregamos el mensaje si no existe ya
      const messageExists = thread.messages.some(m => m.chatwootMessageId === message.chatwootMessageId);
      if (!messageExists) {
        get().addMessageToThread(thread.id, fullMessage);
      }
    } else {
      // Crear nuevo hilo
      const validChannels = ['WhatsApp', 'Facebook', 'Instagram', 'Web'] as const;
      const resolvedChannel = (validChannels as readonly string[]).includes(channel)
        ? (channel as (typeof validChannels)[number])
        : 'WhatsApp';

      const newThread: OmnichannelThread = {
        id: `thread-${chatwootConversationId}-${Date.now()}`,
        chatwootConversationId,
        chatwootContactId,
        clientName: contactName,
        phone: contactPhone,
        channel: resolvedChannel,
        status: isIncoming ? 'Por Responder' : 'Pendientes',
        lastMessage: summaryText,
        assignedAgent: 'Agente General',
        unreadCount: isIncoming ? 1 : 0,
        lastMessageAt: fullMessage.createdAt,
        messages: [{ ...fullMessage, threadId: `thread-${chatwootConversationId}-${Date.now()}` }],
      };
      get().addThread(newThread);
    }
  },
  
  handleConversationStatusChange: (payload) => {
    const { chatwootConversationId, newStatus } = payload;
    const state = get();
    const thread = state.threads.find(t => t.chatwootConversationId === chatwootConversationId);
    
    if (thread) {
      // Mapear estado de Chatwoot a estado local
      let localStatus: 'Por Responder' | 'Pendientes' | 'Archivados' = thread.status;
      if (newStatus === 'open') localStatus = 'Por Responder';
      else if (newStatus === 'pending') localStatus = 'Pendientes';
      else if (newStatus === 'resolved') localStatus = 'Archivados';
      
      get().updateThread(thread.id, { status: localStatus });
    }
  }
}));
