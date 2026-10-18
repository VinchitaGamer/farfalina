"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquareText,
  Send,
  User,
  Sparkles,
  CheckCircle2,
  Clock,
  ShoppingBag,
  Plus,
  Settings,
  Paperclip,
  FileText,
  X,
  Loader2,
  ArrowLeft,
  Trash2,
  Edit2,
  Check,
  Image as ImageIcon,
  Shirt,
  Search,
  Globe,
  ExternalLink,
  RefreshCw,
  Copy,
  Info,
  CheckCheck,
  PackageCheck,
  Phone,
  Layers,
  MessageCircle,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Volume2,
  Film,
  AlertCircle,
  Instagram,
} from "lucide-react";
import {
  getChatThreadsAction,
  sendChatMessageAction,
  updateChatThreadStatusAction,
  updateChatClientNameAction,
  getChannelConfigsAction,
  clearChatCacheAction,
  getQuickRepliesAction,
  syncHistoricalConversationsAction,
} from "@/app/actions/omnichannel";
import { getRawIngredientsAction } from "@/app/actions/arrangements";
import { getDressesAction } from "@/app/actions/carissma";
import { formatCurrency, cn } from "@/lib/utils";

import ChatOrderDrawer from "@/components/floreria/chat-order-drawer";
import ChatRentalDrawer from "@/components/carissma/chat-rental-drawer";
import OmnichannelConfigModal from "@/components/floreria/omnichannel-config-modal";
import QuickRepliesModal, { QuickReplyItem } from "@/components/floreria/quick-replies-modal";
import InstagramPostsPanel from "./instagram-posts-panel";
import { toast } from "@/components/ui/toast";

export interface UnifiedOmnichannelProps {
  environment: "farfalina" | "carissma";
  accentColor: "terracotta" | "amberGold";
  moduleBadge: string;
  brandName: string;
  primaryDrawer: "floreria" | "carissma";
}

interface ChatMessageItem {
  id: string;
  sender: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  createdAt: string | Date;
  rawTimestamp?: string | null;
  externalId?: string | null;
}

interface ChannelThread {
  id: string;
  clientName: string;
  phone: string;
  channel: string;
  status: string;
  lastMessage: string;
  assignedAgent: string;
  profilePicUrl?: string | null;
  externalId?: string | null;
  rawTimestamp?: string | null;
  lastMessageAt?: string | Date | null;
  unreadCount?: number;
  messages: ChatMessageItem[];
}

interface ChannelConfigData {
  id: string;
  channel: string;
  status: string;
  qrCodeData: string | null;
  facebookPageToken: string | null;
  facebookPageId: string | null;
  instagramAccessToken: string | null;
  instagramAccountId: string | null;
}

function formatMessageDateHeader(dateInput: string | Date): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return "Hoy";
    if (isYesterday) return "Ayer";
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  } catch {
    return "";
  }
}

function formatThreadSnippetTime(dateInput?: string | Date | null, rawTimestamp?: string | null): string {
  if (rawTimestamp) return rawTimestamp;
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "Ayer";
    }
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function detectMediaType(
  mediaUrl?: string | null,
  mediaType?: string | null
): "image" | "video" | "audio" | "document" | null {
  if (!mediaUrl && !mediaType) return null;
  const rawType = (mediaType || "").toLowerCase().trim();
  const rawUrl = (mediaUrl || "").toLowerCase().trim();

  // 1. Explicit MIME or classification strings
  if (
    rawType.startsWith("image/") ||
    rawType === "image" ||
    rawType === "sticker" ||
    rawType === "photo"
  ) {
    return "image";
  }
  if (
    rawType.startsWith("video/") ||
    rawType === "video" ||
    rawType === "movie"
  ) {
    return "video";
  }
  if (
    rawType.startsWith("audio/") ||
    rawType === "audio" ||
    rawType === "voice" ||
    rawType === "ptt"
  ) {
    return "audio";
  }
  if (
    rawType.startsWith("application/") ||
    rawType === "document" ||
    rawType === "file"
  ) {
    return "document";
  }

  // 2. Data URLs
  if (rawUrl.startsWith("data:image/")) return "image";
  if (rawUrl.startsWith("data:video/")) return "video";
  if (rawUrl.startsWith("data:audio/")) return "audio";
  if (rawUrl.startsWith("data:application/")) return "document";

  // 3. File extension checks (stripping query string and hashes)
  const cleanUrl = rawUrl.split(/[?#]/)[0];
  if (/\.(jpe?g|png|webp|gif|svg|bmp|heic|ico)(\/|$)?/i.test(cleanUrl)) return "image";
  if (/\.(mp4|webm|ogg|mov|m4v|mkv|3gp)(\/|$)?/i.test(cleanUrl)) return "video";
  if (/\.(mp3|wav|ogg|opus|m4a|aac|flac)(\/|$)?/i.test(cleanUrl)) return "audio";
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip|rar)(\/|$)?/i.test(cleanUrl)) return "document";

  // 4. Path heuristics
  if (cleanUrl.includes("/images/") || cleanUrl.includes("/photos/") || cleanUrl.includes("photo")) return "image";
  if (cleanUrl.includes("/videos/")) return "video";
  if (cleanUrl.includes("/audio/") || cleanUrl.includes("/voice/")) return "audio";

  return mediaUrl ? "document" : null;
}

function isPlaceholderText(text?: string | null): boolean {
  if (!text) return true;
  const t = text.trim();
  return (
    t === "" ||
    t === "📷 Imagen" ||
    t === "📷 Imagen adjunta" ||
    t === "📎 Archivo multimedia" ||
    t === "📎 Documento adjunto" ||
    t === "🎤 Nota de voz" ||
    t === "🎥 Video adjunto" ||
    t === "[Imagen]" ||
    t === "[Imagen adjunta]" ||
    t === "[Archivo adjunto]" ||
    t === "[Video]" ||
    t === "[Audio]" ||
    t === "[DOCUMENT]" ||
    t === "[IMAGE]" ||
    t === "[VIDEO]" ||
    t === "[AUDIO]"
  );
}

export function UnifiedOmnichannelView({
  environment,
  accentColor,
  moduleBadge,
  brandName,
  primaryDrawer,
}: UnifiedOmnichannelProps) {
  const [threads, setThreads] = useState<ChannelThread[]>([]);
  const [channelConfigs, setChannelConfigs] = useState<ChannelConfigData[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReplyItem[]>([]);
  const [viewMode, setViewMode] = useState<"chats" | "posts">("chats");
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Pendientes" | "Por Responder" | "Archivados">("Todos");
  const [channelFilter, setChannelFilter] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mobileTab, setMobileTab] = useState<"list" | "chat" | "crm">("list");
  const [inputMessage, setInputMessage] = useState("");
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    type: string;
    base64?: string;
    previewUrl?: string;
    existingUrl?: string;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const metaWindowRef = useRef<Window | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rentalDrawerOpen, setRentalDrawerOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isQuickRepliesModalOpen, setIsQuickRepliesModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);

  // Client Name Inline Edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInputValue, setNameInputValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Detected Contact from Meta Extension (via cross-window postMessage)
  const [detectedClient, setDetectedClient] = useState<{
    name: string;
    phone: string;
    channel: string;
    profilePicUrl?: string | null;
    threadId?: string | null;
  } | null>(null);

  // Live Inventory Stock for Operations Panel
  const [liveIngredients, setLiveIngredients] = useState<Array<{
    id: string;
    name: string;
    type: string;
    available: number;
    unit: string;
    costPerUnit: number;
  }>>([]);
  const [liveDresses, setLiveDresses] = useState<Array<{
    id: string;
    name: string;
    brand: string;
    size: string;
    category?: string | null;
    status: string;
    baseRentalPrice: number;
    color: string;
  }>>([]);
  const [inventorySearch, setInventorySearch] = useState("");
  const [copiedReplyId, setCopiedReplyId] = useState<string | null>(null);

  // In-App Image Lightbox State & Controls
  const [activeLightboxImg, setActiveLightboxImg] = useState<{ url: string; caption?: string } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);

  const handleOpenLightbox = (url: string, caption?: string) => {
    setActiveLightboxImg({ url, caption });
    setZoomScale(1);
  };

  const handleCloseLightbox = () => {
    setActiveLightboxImg(null);
    setZoomScale(1);
  };

  const handleDownloadImage = (url: string, filename?: string) => {
    const a = document.createElement("a");
    a.href = url;
    const cleanName =
      filename ||
      decodeURIComponent(url.split("/").pop()?.split(/[?#]/)[0] || "farfalina-media.jpg");
    a.download = cleanName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeLightboxImg) {
        handleCloseLightbox();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeLightboxImg]);

  const defaultMetaUrl =
    environment === "farfalina"
      ? "https://business.facebook.com/latest/inbox/all?asset_id=278972961977030&business_id=3349413642033505"
      : "https://business.facebook.com/latest/inbox/all";

  const [metaUrl, setMetaUrl] = useState<string>(defaultMetaUrl);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`farfalina_meta_url_${environment}`);
      if (saved && saved.startsWith("https://business.facebook.com")) {
        setMetaUrl(saved);
      }
    }
  }, [environment]);

  // Initial load & automatic polling every 8s
  useEffect(() => {
    loadThreads();
    loadChannelConfigs();
    loadQuickReplies();
    loadLiveInventory();

    const interval = setInterval(() => {
      if (document.hidden) return;
      loadThreads(true);
      loadLiveInventory();
    }, 3000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadThreads(true);
        loadLiveInventory();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cross-window message listener (Extension Meta Relay -> Farfalina)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "FARFALINA_ACTIVE_CHAT") {
        const client = {
          name: event.data.clientName || "Cliente Meta",
          phone: event.data.phone || "",
          channel: event.data.channel || "WhatsApp",
          profilePicUrl: event.data.profilePicUrl || null,
          threadId: event.data.threadId || null,
        };
        setDetectedClient(client);

        // Auto-select corresponding thread in list if exists
        setThreads((curr) => {
          const match = curr.find(
            (t) =>
              (client.threadId && t.phone === client.threadId) ||
              (client.phone && t.phone === client.phone) ||
              (client.name && t.clientName.toLowerCase() === client.name.toLowerCase())
          );
          if (match) {
            setSelectedThreadId(match.id);
          }
          return curr;
        });
      }

      if (event.data?.type === "FARFALINA_META_URL" && typeof event.data.url === "string") {
        const incomingUrl = event.data.url;
        if (
          incomingUrl.startsWith("https://business.facebook.com/latest/inbox") &&
          !incomingUrl.includes("/instagram") &&
          !incomingUrl.includes("/whatsapp") &&
          !incomingUrl.includes("/messenger")
        ) {
          setMetaUrl(incomingUrl);
          if (typeof window !== "undefined") {
            localStorage.setItem(`farfalina_meta_url_${environment}`, incomingUrl);
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("message", handleMessage);
    };
  }, [statusFilter, environment, primaryDrawer]);

  const loadLiveInventory = async () => {
    try {
      if (primaryDrawer === "floreria") {
        const res = await getRawIngredientsAction();
        if (res.success && Array.isArray(res.data)) {
          setLiveIngredients(res.data);
        }
      } else {
        const res = await getDressesAction();
        if (res.success && Array.isArray(res.data)) {
          setLiveDresses(res.data);
        }
      }
    } catch {
      // Ignorar fallback
    }
  };

  const loadThreads = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await getChatThreadsAction(
      statusFilter === "Todos" ? undefined : statusFilter,
      environment
    );
    if (res.success && Array.isArray(res.data)) {
      setThreads(res.data as ChannelThread[]);
      if (res.data.length > 0) {
        setSelectedThreadId((prev) => (prev ? prev : (res.data as ChannelThread[])[0].id));
      }
    }
    if (!silent) setLoading(false);
  };

  const loadChannelConfigs = async () => {
    const res = await getChannelConfigsAction(environment);
    if (res.success && Array.isArray(res.data)) {
      setChannelConfigs(res.data as ChannelConfigData[]);
    }
  };

  const loadQuickReplies = async () => {
    const res = await getQuickRepliesAction();
    if (res.success && Array.isArray(res.data)) {
      setQuickReplies(res.data as QuickReplyItem[]);
    }
  };

  const handleClearInbox = async () => {
    const confirmed = window.confirm(
      `¿Limpiar la bandeja de entrada de ${brandName}?\n\nSe eliminarán los mensajes e hilos sincronizados. Las configuraciones de canal permanecerán intactas.`
    );
    if (!confirmed) return;
    setIsClearing(true);
    const res = await clearChatCacheAction(environment);
    if (res.success) {
      setThreads([]);
      setSelectedThreadId("");
      toast.success("Bandeja limpiada correctamente");
      await loadThreads();
    } else {
      toast.error(res.error ?? "No se pudo limpiar la bandeja");
    }
    setIsClearing(false);
  };

  const handleSyncHistorical = async () => {
    if (isSyncingHistory) return;
    setIsSyncingHistory(true);
    try {
      const res = await syncHistoricalConversationsAction(environment);
      if (res.success && res.data) {
        toast.success(
          `Historial sincronizado: ${res.data.syncedConversations} conversaciones, ${res.data.syncedMessages} mensajes (${res.data.skippedDuplicates} ya existían)`
        );
        await loadThreads();
      } else {
        toast.error(res.error || "Error al sincronizar historial de conversaciones");
      }
    } catch {
      toast.error("Error de red al sincronizar historial");
    } finally {
      setIsSyncingHistory(false);
    }
  };

  // Filtered threads list
  const filteredThreads = threads.filter((t) => {
    const matchesStatus =
      statusFilter === "Todos" || t.status === statusFilter;
    const matchesChannel =
      channelFilter === "Todos" || t.channel.toLowerCase() === channelFilter.toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      t.clientName.toLowerCase().includes(query) ||
      t.lastMessage.toLowerCase().includes(query) ||
      t.phone.toLowerCase().includes(query);
    return matchesStatus && matchesChannel && matchesSearch;
  });

  const activeThread =
    filteredThreads.find((t) => t.id === selectedThreadId) ||
    threads.find((t) => t.id === selectedThreadId) ||
    filteredThreads[0] ||
    threads[0];

  useEffect(() => {
    if (activeThread) {
      setNameInputValue(activeThread.clientName);
      setIsEditingName(false);
      // Scroll to bottom on thread change
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activeThread?.id]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast.error("El archivo supera el límite de 25MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const isImage = file.type.startsWith("image/");
      setAttachedFile({
        name: file.name,
        type: file.type,
        base64,
        previewUrl: isImage ? base64 : "",
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !attachedFile) || !activeThread || isSending) return;
    setIsSending(true);
    const textToSend = inputMessage;
    const currentAttachment = attachedFile;

    setInputMessage("");
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      const res = await sendChatMessageAction({
        threadId: activeThread.id,
        sender: "agent",
        text: textToSend,
        mediaBase64: currentAttachment?.base64 || null,
        mediaMimeType: currentAttachment?.type || null,
        mediaFileName: currentAttachment?.name || null,
        mediaUrl: currentAttachment?.existingUrl || null,
      });

      if (res.success) {
        await loadThreads(true);
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else {
        toast.error(res.error || "Error al enviar mensaje");
      }
    } catch {
      toast.error("Error de conexión al enviar");
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: "Pendientes" | "Por Responder" | "Archivados") => {
    if (!activeThread) return;
    const res = await updateChatThreadStatusAction(activeThread.id, newStatus);
    if (res.success) {
      loadThreads(true);
    }
  };

  const handleSaveClientName = async () => {
    if (!activeThread || !nameInputValue.trim()) return;
    setSavingName(true);
    const res = await updateChatClientNameAction(activeThread.id, nameInputValue.trim());
    if (res.success) {
      toast.success("Nombre de contacto actualizado");
      setIsEditingName(false);
      loadThreads(true);
    } else {
      toast.error(res.error || "Error al actualizar nombre");
    }
    setSavingName(false);
  };

  const applyQuickResponse = (qr: QuickReplyItem) => {
    setInputMessage(qr.text);
    if (qr.mediaUrl) {
      setAttachedFile({
        name: qr.mediaName || "Archivo adjunto",
        type: qr.mediaType === "image" ? "image/jpeg" : "application/pdf",
        existingUrl: qr.mediaUrl,
        previewUrl: qr.mediaType === "image" ? qr.mediaUrl : "",
      });
      toast.info(`Cargado: "${qr.title}" con archivo adjunto 📎`);
    } else {
      toast.info(`Cargado: "${qr.title}"`);
    }
  };

  const handleCopyQuickReply = async (reply: QuickReplyItem) => {
    try {
      await navigator.clipboard.writeText(reply.text);
      setCopiedReplyId(reply.id);
      toast.success(`Copiado: "${reply.title}". Listo para pegar.`);
      setTimeout(() => setCopiedReplyId(null), 2500);
    } catch {
      toast.error("No se pudo copiar al portapapeles.");
    }
  };

  const handleOpenMetaBusinessSuite = () => {
    const width = 1260;
    const height = 860;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    metaWindowRef.current = window.open(
      metaUrl,
      "MetaBusinessSuiteFarfalina",
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes`
    );
  };

  // Color themes
  const isTerra = accentColor === "terracotta";
  const c = {
    badgeBg: isTerra ? "bg-terracotta-100" : "bg-amberGold-100",
    badgeText: isTerra ? "text-terracotta-700" : "text-amberGold-800",
    iconColor: isTerra ? "text-terracotta-400" : "text-amberGold-400",
    selectedBg: isTerra ? "bg-terracotta-50/90" : "bg-amberGold-50/90",
    selectedBorder: isTerra ? "border-terracotta-500" : "border-amberGold-500",
    avatarBg: isTerra ? "bg-terracotta-100" : "bg-amberGold-100",
    avatarText: isTerra ? "text-terracotta-700" : "text-amberGold-800",
    avatarBorder: isTerra ? "border-terracotta-200" : "border-amberGold-200",
    btnBg: isTerra ? "bg-terracotta-500" : "bg-amberGold-600",
    btnHover: isTerra ? "hover:bg-terracotta-600" : "hover:bg-amberGold-700",
    btnIcon: isTerra ? "text-terracotta-600" : "text-amberGold-600",
    botMsgBg: "bg-amber-50",
    botMsgText: "text-amber-950",
    botMsgBorder: "border-amber-200",
    agentMsgBg: isTerra ? "bg-terracotta-500" : "bg-amberGold-600",
    qrHoverBg: isTerra ? "hover:bg-terracotta-50" : "hover:bg-amberGold-50",
    qrHoverText: isTerra ? "hover:text-terracotta-700" : "hover:text-amberGold-700",
    inputFocus: isTerra ? "focus:border-terracotta-500" : "focus:border-amberGold-500",
  };

  const waConfig = channelConfigs.find((c) => c.channel === "WhatsApp");
  const fbConfig = channelConfigs.find((c) => c.channel === "Facebook");
  const igConfig = channelConfigs.find((c) => c.channel === "Instagram");

  const effectiveClientName =
    activeThread?.clientName ||
    detectedClient?.name ||
    (primaryDrawer === "floreria" ? "Cliente Farfalina" : "Clienta Carissma");

  const effectiveClientPhone =
    activeThread?.phone || detectedClient?.phone || "";

  const effectiveChannel =
    activeThread?.channel || detectedClient?.channel || "WhatsApp";

  const effectiveThreadId =
    activeThread?.id || detectedClient?.threadId || "direct_contact";

  return (
    <div className="space-y-5">
      {/* 1. TOP HEADER & RELAY CONTROL BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 text-[10px] font-bold ${c.badgeBg} ${c.badgeText} rounded-md uppercase tracking-wider`}>
              {moduleBadge}
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Puente Meta Relay Activo</span>
              <span className="font-mono text-[10px] text-emerald-600 bg-white px-1.5 py-0.2 rounded">
                {threads.length} chats
              </span>
            </div>
          </div>
          <h2 className="text-lg font-bold text-warm-900 mt-1">Bandeja Unificada de Omnicanalidad</h2>
          <p className="text-xs text-warm-500">
            Centralización en tiempo real de WhatsApp, Facebook Messenger e Instagram Direct con emisión de pedidos.
          </p>
        </div>

        {/* Connectivity Badges & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto justify-start xl:justify-end">
          {/* Mode Switcher: Chats Directos vs Publicaciones & Comentarios */}
          <div className="flex items-center p-1 bg-warm-100 rounded-xl border border-warm-200 shadow-xs">
            <button
              onClick={() => setViewMode("chats")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "chats"
                  ? "bg-white text-warm-900 shadow-xs"
                  : "text-warm-600 hover:text-warm-900"
              )}
            >
              <MessageSquareText className="h-3.5 w-3.5 text-warm-600" />
              <span>Chats Directos</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-warm-200 text-warm-700">
                {threads.length}
              </span>
            </button>

            <button
              onClick={() => setViewMode("posts")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                viewMode === "posts"
                  ? "bg-white text-pink-700 shadow-xs ring-1 ring-pink-500/20"
                  : "text-warm-600 hover:text-warm-900"
              )}
            >
              <Instagram className="h-3.5 w-3.5 text-pink-600" />
              <span>Publicaciones & Comentarios</span>
            </button>
          </div>

          {/* Live Channels Badges */}
          <div className="hidden sm:flex items-center gap-1.5 bg-warm-50 p-1 rounded-xl border border-warm-200 text-xs">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-warm-700">
              <span className={`h-2 w-2 rounded-full ${waConfig?.status === "CONNECTED" ? "bg-emerald-500" : "bg-zinc-400"}`}></span>
              <span>WhatsApp</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-warm-700">
              <span className={`h-2 w-2 rounded-full ${fbConfig?.status === "CONNECTED" ? "bg-blue-500" : "bg-zinc-400"}`}></span>
              <span>Messenger</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-warm-700">
              <span className={`h-2 w-2 rounded-full ${igConfig?.status === "CONNECTED" ? "bg-pink-500" : "bg-zinc-400"}`}></span>
              <span>Instagram</span>
            </div>
          </div>

          {/* Auxiliary Meta Business Suite Window Launcher */}
          <button
            onClick={handleOpenMetaBusinessSuite}
            className="px-3.5 py-2 bg-warm-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 group"
            title="Abrir Meta Business Suite en ventana acoplada con las herramientas de Farfalina inyectadas"
          >
            <Globe className="h-3.5 w-3.5 text-emerald-400 transition-transform group-hover:scale-110" />
            <span>Abrir Meta Business Suite</span>
            <ExternalLink className="h-3 w-3 text-warm-400" />
          </button>

          {/* Historical Backfill Sync Button */}
          <button
            onClick={handleSyncHistorical}
            disabled={isSyncingHistory}
            className="px-3 py-2 bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            title="Sincronizar historial de conversaciones previas de Instagram Direct"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 text-pink-600", isSyncingHistory && "animate-spin")} />
            <span className="hidden sm:inline">
              {isSyncingHistory ? "Sincronizando..." : "Sincronizar Histórico"}
            </span>
          </button>

          {/* Config Channels */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 border border-warm-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="Configurar cuentas de Meta, WhatsApp e Instagram"
          >
            <Settings className="h-3.5 w-3.5 text-warm-500" />
            <span className="hidden sm:inline">Configuración</span>
          </button>

          {/* Clear Inbox */}
          <button
            onClick={handleClearInbox}
            disabled={isClearing}
            className="p-2 bg-warm-100 hover:bg-red-50 text-warm-600 hover:text-red-700 border border-warm-200 hover:border-red-200 rounded-xl transition-all disabled:opacity-50"
            title="Limpiar caché de bandeja"
          >
            {isClearing ? <Loader2 className="h-4 w-4 animate-spin text-warm-600" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {viewMode === "posts" ? (
        <InstagramPostsPanel environment={environment} accentColor={accentColor} />
      ) : (
        <>
          {/* MOBILE TAB CONTROLS (Small screens only) */}
      <div className="grid grid-cols-3 gap-1 bg-warm-100 p-1 rounded-xl border border-warm-200 lg:hidden">
        <button
          onClick={() => setMobileTab("list")}
          className={`min-h-[44px] px-1 py-2 text-xs font-bold rounded-lg transition-all touch-manipulation ${
            mobileTab === "list" ? "bg-white text-warm-900 shadow-sm" : "text-warm-600"
          }`}
        >
          Chats ({filteredThreads.length})
        </button>
        <button
          onClick={() => setMobileTab("chat")}
          className={`min-h-[44px] px-1 py-2 text-xs font-bold rounded-lg transition-all touch-manipulation ${
            mobileTab === "chat" ? "bg-white text-warm-900 shadow-sm" : "text-warm-600"
          }`}
        >
          Conversación
        </button>
        <button
          onClick={() => setMobileTab("crm")}
          className={`min-h-[44px] px-1 py-2 text-xs font-bold rounded-lg transition-all touch-manipulation ${
            mobileTab === "crm" ? "bg-white text-warm-900 shadow-sm" : "text-warm-600"
          }`}
        >
          Panel CRM
        </button>
      </div>

      {/* 2. MAIN UNIFIED WORKSPACE (3-COLUMN DENSE LAYOUT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[min(720px,calc(100dvh-12rem))] lg:min-h-[720px]">
        {/* ========================================================================= */}
        {/* COLUMN 1: THREAD LIST (xl:col-span-3, lg:col-span-4)                      */}
        {/* ========================================================================= */}
        <div
          className={`lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-warm-200 shadow-sm flex flex-col overflow-hidden ${
            mobileTab === "list" ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Search & Channel filter */}
          <div className="p-3 bg-warm-50 border-b border-warm-200 space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-warm-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar cliente, número o chat..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 placeholder:text-warm-400 focus:outline-none focus:border-warm-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-700"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Channels Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              {(["Todos", "WhatsApp", "Facebook", "Instagram"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                    channelFilter === ch
                      ? `${c.badgeBg} ${c.badgeText} shadow-xs font-extrabold`
                      : "bg-white text-warm-600 hover:text-warm-900 border border-warm-200"
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center justify-between gap-1 bg-warm-100 p-0.5 rounded-lg text-[10px]">
              {(["Todos", "Por Responder", "Pendientes", "Archivados"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`flex-1 py-1 rounded text-center font-bold transition-all ${
                    statusFilter === st ? "bg-white text-warm-900 shadow-xs" : "text-warm-500 hover:text-warm-800"
                  }`}
                >
                  {st === "Por Responder" ? "Nuevos" : st}
                </button>
              ))}
            </div>
          </div>

          {/* Threads Scroll List */}
          <div className="divide-y divide-warm-100 overflow-y-auto flex-1 max-h-[640px]">
            {loading ? (
              <div className="p-8 text-center text-xs text-warm-400 flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-warm-400" />
                <span>Sincronizando chats...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center text-xs text-warm-400 space-y-1">
                <p className="font-bold text-warm-600">No hay chats en esta sección</p>
                <p className="text-[11px] text-warm-400">
                  {searchQuery ? "Intenta con otra búsqueda" : "Los mensajes entrantes de Meta aparecerán aquí."}
                </p>
              </div>
            ) : (
              filteredThreads.map((t) => {
                const isSelected = activeThread?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedThreadId(t.id);
                      setMobileTab("chat");
                    }}
                    className={`w-full text-left p-3 transition-colors flex items-start gap-2.5 ${
                      isSelected ? `${c.selectedBg} border-l-4 ${c.selectedBorder}` : "hover:bg-warm-50/80"
                    }`}
                  >
                    {/* Contact Profile Picture / Initials with Channel Badge */}
                    <div className="relative shrink-0">
                      {t.profilePicUrl ? (
                        <img
                          src={t.profilePicUrl}
                          alt={t.clientName}
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 rounded-full object-cover border border-warm-200"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.style.display = "none";
                            const fallback = img.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className={`h-10 w-10 rounded-full items-center justify-center text-xs font-bold border ${
                          t.channel === "WhatsApp"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : t.channel === "Instagram"
                            ? "bg-pink-100 text-pink-800 border-pink-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                        style={{ display: t.profilePicUrl ? "none" : "flex" }}
                      >
                        {t.clientName.substring(0, 2).toUpperCase()}
                      </div>
                      {/* Meta-Style Small Channel Badge Icon */}
                      <span
                        className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-xs border-2 border-white ${
                          t.channel === "WhatsApp"
                            ? "bg-emerald-600"
                            : t.channel === "Instagram"
                            ? "bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600"
                            : "bg-blue-600"
                        }`}
                        title={t.channel}
                      >
                        {t.channel === "WhatsApp" ? "W" : t.channel === "Instagram" ? "IG" : "M"}
                      </span>
                    </div>

                    {/* Metadata & Message Preview */}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs truncate ${t.status === "Por Responder" ? "font-bold text-warm-950" : "font-semibold text-warm-900"}`}>
                          {t.clientName}
                        </span>
                        <span className="text-[10px] text-warm-400 font-mono shrink-0">
                          {formatThreadSnippetTime(t.lastMessageAt || t.messages[t.messages.length - 1]?.createdAt, t.rawTimestamp)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <p className={`text-xs truncate leading-snug ${t.status === "Por Responder" ? "font-medium text-warm-900" : "text-warm-500"}`}>
                          {t.messages[t.messages.length - 1]?.sender === "agent" && (
                            <span className="text-warm-400 font-normal">Tú: </span>
                          )}
                          {t.lastMessage || "Conversación"}
                        </p>
                        {t.status === "Por Responder" && (
                          <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" title="Sin responder" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-warm-400 pt-0.5">
                        <span className="font-mono truncate">{t.phone.startsWith("+") ? t.phone : `ID ${t.phone.slice(-6)}`}</span>
                        <span className={`px-1.5 py-0.2 rounded font-semibold text-[9px] ${
                          t.status === "Por Responder"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : t.status === "Pendientes"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-warm-100 text-warm-600"
                        }`}>
                          {t.status}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2: ACTIVE CONVERSATION & CHAT ROOM (xl:col-span-5, lg:col-span-8) */}
        {/* ========================================================================= */}
        <div
          className={`lg:col-span-8 xl:col-span-5 bg-white rounded-2xl border border-warm-200 shadow-sm flex flex-col overflow-hidden ${
            mobileTab === "chat" ? "flex" : "hidden lg:flex"
          }`}
        >
          {activeThread ? (
            <>
              {/* Active Chat Header */}
              <div className="p-3 sm:px-4 bg-warm-50 border-b border-warm-200 flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Mobile Back to List */}
                  <button
                    onClick={() => setMobileTab("list")}
                    className="min-h-[44px] min-w-[44px] -ml-1 text-warm-600 hover:text-warm-900 rounded-lg lg:hidden shrink-0 flex items-center justify-center touch-manipulation"
                    title="Volver a lista"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  {/* Avatar */}
                  {activeThread.profilePicUrl ? (
                    <img
                      src={activeThread.profilePicUrl}
                      alt={activeThread.clientName}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-full object-cover border border-warm-200 shrink-0"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = "none";
                        const fallback = img.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className={`h-9 w-9 rounded-full ${c.avatarBg} ${c.avatarText} font-bold items-center justify-center text-xs border ${c.avatarBorder} shrink-0`}
                    style={{ display: activeThread.profilePicUrl ? "none" : "flex" }}
                  >
                    {activeThread.clientName.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Inline Name Editor */}
                    {isEditingName ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={nameInputValue}
                          onChange={(e) => setNameInputValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSaveClientName()}
                          className="p-1 bg-white border border-warm-300 rounded text-xs font-bold text-warm-900 w-full max-w-[200px] focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={handleSaveClientName}
                          disabled={savingName}
                          className={`p-1 ${c.btnBg} text-white rounded`}
                        >
                          {savingName ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingName(false);
                            setNameInputValue(activeThread.clientName);
                          }}
                          className="p-1 bg-warm-200 text-warm-700 rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-xs sm:text-sm text-warm-900 truncate">
                          {activeThread.clientName}
                        </h3>
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="p-0.5 text-warm-400 hover:text-warm-700"
                          title="Editar nombre"
                        >
                          <Edit2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] text-warm-500">
                      <span className="font-semibold text-warm-700">{activeThread.channel}</span>
                      <span>•</span>
                      <span className="font-mono truncate">{activeThread.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Status Dropdown & Meta Link */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={activeThread.status}
                    onChange={(e) => handleStatusChange(e.target.value as "Pendientes" | "Por Responder" | "Archivados")}
                    className="p-1.5 bg-white border border-warm-200 rounded-lg text-xs font-bold text-warm-800 focus:outline-none shadow-xs"
                  >
                    <option value="Por Responder">Por Responder</option>
                    <option value="Pendientes">Pendiente</option>
                    <option value="Archivados">Archivado</option>
                  </select>

                  <button
                    onClick={handleOpenMetaBusinessSuite}
                    className="p-1.5 bg-white hover:bg-warm-100 text-warm-700 border border-warm-200 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1"
                    title="Ver este chat en Meta Business Suite oficial"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
                    <span className="hidden sm:inline">Meta</span>
                  </button>
                </div>
              </div>

              {/* Messages Stream */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-warm-50/40 max-h-[52dvh] min-h-[34dvh] lg:max-h-[460px] lg:min-h-[380px]">
                {activeThread.messages?.length === 0 ? (
                  <div className="text-center py-12 text-warm-400 text-xs">
                    No hay mensajes registrados en esta conversación.
                  </div>
                ) : (
                  activeThread.messages?.map((m, idx) => {
                    const isAgent = m.sender === "agent";
                    const isBot = m.sender === "bot";
                    const isCustomer = m.sender === "customer";

                    const prevDate = idx > 0 ? formatMessageDateHeader(activeThread.messages[idx - 1].createdAt) : null;
                    const currentDate = formatMessageDateHeader(m.createdAt);
                    const showDateSeparator = currentDate && (idx === 0 || prevDate !== currentDate);

                    // Dynamic channel bubble colors matching Meta Business Suite
                    let agentBubbleClass = `${c.agentMsgBg} text-white shadow-sm`;
                    if (activeThread.channel === "Facebook") {
                      agentBubbleClass = "bg-[#0084ff] text-white shadow-sm";
                    } else if (activeThread.channel === "WhatsApp") {
                      agentBubbleClass = "bg-[#005c4b] text-white shadow-sm";
                    } else if (activeThread.channel === "Instagram") {
                      agentBubbleClass = "bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500 text-white shadow-sm";
                    }

                    const mediaKind = detectMediaType(m.mediaUrl, m.mediaType);
                    const isMedia = Boolean(m.mediaUrl && mediaKind);
                    const isSticker = m.mediaType === "sticker" || (Boolean(m.mediaUrl?.endsWith(".webp")) && !m.text);
                    const isImg = mediaKind === "image";
                    const isVid = mediaKind === "video";
                    const isAud = mediaKind === "audio";
                    const isDoc = mediaKind === "document";
                    const hasPlaceholder = isPlaceholderText(m.text);
                    const showText = Boolean(m.text && (!isMedia || !hasPlaceholder));
                    const isCompactImageBubble = isImg && !showText;

                    return (
                      <React.Fragment key={m.id}>
                        {showDateSeparator && (
                          <div className="flex items-center justify-center my-3">
                            <span className="px-3 py-1 bg-warm-200/80 text-warm-700 text-[10px] font-bold rounded-full uppercase tracking-wider shadow-xs">
                              {currentDate}
                            </span>
                          </div>
                        )}

                        <div
                          className={`flex flex-col max-w-[82%] ${
                            isCustomer ? "mr-auto items-start" : "ml-auto items-end"
                          }`}
                        >
                          <div
                            className={`rounded-2xl text-xs leading-relaxed overflow-hidden transition-all ${
                              isSticker
                                ? "p-0 bg-transparent shadow-none border-none"
                                : isCompactImageBubble
                                ? "p-1.5 bg-white border border-warm-200 shadow-sm"
                                : isCustomer
                                ? "p-3 bg-white text-zinc-900 border border-warm-200/90 shadow-xs rounded-tl-sm"
                                : isBot
                                ? `p-3 ${c.botMsgBg} ${c.botMsgText} border ${c.botMsgBorder} shadow-sm rounded-tr-sm`
                                : `p-3 ${agentBubbleClass} rounded-tr-sm`
                            }`}
                          >
                            {isBot && (
                              <span className="text-[10px] font-bold uppercase tracking-wider block mb-1 text-amber-800 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-amber-600" /> Respuesta Automática {brandName}
                              </span>
                            )}

                            {/* Media: Image with Lightbox and Error Fallback */}
                            {m.mediaUrl && isImg && (
                              <div
                                onClick={() => !isSticker && handleOpenLightbox(m.mediaUrl!, showText ? m.text : undefined)}
                                className={`relative group/img overflow-hidden rounded-xl flex items-center justify-center my-1 transition-all ${
                                  isSticker
                                    ? "bg-transparent p-0 max-w-[150px] max-h-[150px]"
                                    : "bg-warm-100/50 cursor-pointer shadow-xs hover:shadow-md"
                                }`}
                                title={isSticker ? "Sticker" : "Clic para ampliar en visor de pantalla completa"}
                              >
                                <img
                                  src={m.mediaUrl}
                                  alt={isSticker ? "Sticker" : "Foto adjunta"}
                                  referrerPolicy="no-referrer"
                                  className={`${
                                    isSticker
                                      ? "max-w-[140px] max-h-[140px] object-contain drop-shadow-sm"
                                      : "max-w-[280px] max-h-[300px] w-auto h-auto rounded-xl object-contain transition-transform duration-200 group-hover/img:scale-[1.02]"
                                  }`}
                                  loading="lazy"
                                  onError={(e) => {
                                    const img = e.currentTarget;
                                    if (m.mediaUrl?.startsWith("/uploads/") && !img.src.includes("/api/media/")) {
                                      img.src = m.mediaUrl.replace(/^\/uploads\//, "/api/media/");
                                      return;
                                    }
                                    img.style.display = "none";
                                    const fallback = img.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.style.display = "flex";
                                  }}
                                />
                                <div
                                  style={{ display: "none" }}
                                  className="p-3 bg-warm-100 text-warm-700 rounded-xl flex flex-col items-center gap-1.5 text-center max-w-[240px]"
                                >
                                  <ImageIcon className="h-6 w-6 text-warm-400" />
                                  <span className="text-[11px] font-medium text-warm-600">No se pudo cargar vista previa</span>
                                  <a
                                    href={m.mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold text-blue-600 underline flex items-center gap-1 mt-0.5"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Abrir archivo
                                  </a>
                                </div>
                                {!isSticker && (
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 backdrop-blur-[1px]">
                                    <span className="p-1.5 bg-black/70 text-white rounded-full">
                                      <Maximize2 className="h-4 w-4" />
                                    </span>
                                    <span className="text-[11px] font-bold text-white shadow-xs">Ver imagen</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Media: Video */}
                            {m.mediaUrl && isVid && (
                              <div className="my-1.5 rounded-xl overflow-hidden max-w-[280px] bg-black/5 shadow-xs border border-warm-200">
                                <video
                                  src={m.mediaUrl}
                                  controls
                                  preload="metadata"
                                  playsInline
                                  className="max-w-full rounded-xl w-full"
                                  style={{ maxHeight: 240 }}
                                  onError={(e) => {
                                    const vid = e.currentTarget;
                                    if (m.mediaUrl?.startsWith("/uploads/") && !vid.src.includes("/api/media/")) {
                                      vid.src = m.mediaUrl.replace(/^\/uploads\//, "/api/media/");
                                      return;
                                    }
                                    vid.style.display = "none";
                                    const fb = vid.nextElementSibling as HTMLElement;
                                    if (fb) fb.style.display = "flex";
                                  }}
                                />
                                <div
                                  style={{ display: "none" }}
                                  className="p-3 bg-warm-100 text-warm-700 rounded-xl flex flex-col items-center gap-1.5 text-center"
                                >
                                  <Film className="h-6 w-6 text-warm-400" />
                                  <span className="text-[11px] font-medium text-warm-600">Video no disponible</span>
                                  <a
                                    href={m.mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold text-blue-600 underline flex items-center gap-1 mt-0.5"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Abrir archivo
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Media: Audio / Voice Note */}
                            {m.mediaUrl && isAud && (
                              <div className={`my-1.5 p-2 rounded-xl flex flex-col gap-1 ${
                                isCustomer ? "bg-warm-100/90 text-warm-900" : "bg-black/15 text-white"
                              }`}>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold opacity-80 mb-0.5">
                                  <Volume2 className="h-3.5 w-3.5" />
                                  <span>Nota de voz / Audio</span>
                                </div>
                                <audio
                                  src={m.mediaUrl}
                                  controls
                                  preload="metadata"
                                  className="h-8 w-full max-w-[240px] rounded-lg"
                                  onError={(e) => {
                                    const aud = e.currentTarget;
                                    if (m.mediaUrl?.startsWith("/uploads/") && !aud.src.includes("/api/media/")) {
                                      aud.src = m.mediaUrl.replace(/^\/uploads\//, "/api/media/");
                                      return;
                                    }
                                    aud.style.display = "none";
                                    const fb = aud.nextElementSibling as HTMLElement;
                                    if (fb) fb.style.display = "flex";
                                  }}
                                />
                                <div
                                  style={{ display: "none" }}
                                  className="p-2 bg-warm-100/90 text-warm-700 rounded-lg flex items-center justify-between text-xs"
                                >
                                  <span className="text-[10px] font-medium">Audio no reproducible</span>
                                  <a
                                    href={m.mediaUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download
                                    className="text-[10px] font-bold text-blue-600 underline flex items-center gap-1"
                                  >
                                    <Download className="h-3 w-3" />
                                    Descargar
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Media: Document */}
                            {m.mediaUrl && isDoc && (
                              <a
                                href={m.mediaUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                download={decodeURIComponent(m.mediaUrl.split("/").pop()?.split(/[?#]/)[0] || "documento")}
                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold my-1.5 transition-all hover:opacity-95 ${
                                  isAgent
                                    ? "bg-white/20 text-white border-white/30 hover:bg-white/30"
                                    : "bg-white text-warm-900 border-warm-200 shadow-xs hover:bg-warm-50"
                                }`}
                              >
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="truncate block font-bold text-xs">
                                    {decodeURIComponent(m.mediaUrl.split("/").pop()?.split(/[?#]/)[0] || "Documento adjunto")}
                                  </span>
                                  <span className="text-[10px] opacity-70 flex items-center gap-1 mt-0.5">
                                    <Download className="h-3 w-3" />
                                    <span>Descargar</span>
                                  </span>
                                </div>
                              </a>
                            )}

                            {/* Text */}
                            {showText && (
                              <p className={`whitespace-pre-wrap ${isMedia ? "mt-1.5 pt-1.5 border-t border-black/10 dark:border-white/10" : ""}`}>
                                {m.text}
                              </p>
                            )}
                          </div>

                          <div className={`flex items-center gap-1 text-[10px] text-warm-400 mt-1 font-mono px-1 ${isCustomer ? "justify-start" : "justify-end"}`}>
                            <span>{m.rawTimestamp || new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {isAgent && <CheckCheck className="h-3 w-3 text-blue-500 inline" />}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Dynamic Quick Replies Strip */}
              <div className="px-3 py-1.5 bg-warm-100/70 border-t border-warm-200 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-[10px] font-bold text-warm-500 shrink-0">Respuestas Rápidas:</span>
                {quickReplies.slice(0, 5).map((qr) => (
                  <button
                    key={qr.id}
                    onClick={() => applyQuickResponse(qr)}
                    className="px-2 py-0.5 bg-white hover:bg-warm-50 text-warm-700 text-[10px] font-medium rounded-lg whitespace-nowrap border border-warm-200 shadow-xs transition-colors shrink-0"
                    title={qr.text}
                  >
                    {qr.title}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setIsQuickRepliesModalOpen(true)}
                  className="px-2 py-0.5 bg-warm-200 hover:bg-warm-300 text-warm-800 text-[10px] font-bold rounded-lg whitespace-nowrap transition-colors shrink-0"
                >
                  + Más
                </button>
              </div>

              {/* Attachment Preview Chip */}
              {attachedFile && (
                <div className="px-3 py-1.5 bg-warm-50 border-t border-warm-200 flex items-center gap-2">
                  {attachedFile.previewUrl ? (
                    <img
                      src={attachedFile.previewUrl}
                      alt="Preview"
                      className="h-8 w-8 object-cover rounded-lg border border-warm-300 shrink-0"
                    />
                  ) : attachedFile.type.startsWith("video/") ? (
                    <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
                      <Film className="h-4 w-4" />
                    </div>
                  ) : attachedFile.type.startsWith("audio/") ? (
                    <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center border border-amber-200 shrink-0">
                      <Volume2 className="h-4 w-4" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center border border-blue-200 shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-warm-900 text-xs truncate max-w-[220px]">{attachedFile.name}</p>
                    <p className="text-[10px] text-warm-500 uppercase">{attachedFile.type || "Documento"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="p-1 hover:bg-warm-200 text-warm-500 rounded"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Composer Input Bar */}
              <div className="p-3 bg-white border-t border-warm-200 flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*,video/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSending}
                  className="min-h-[44px] min-w-[44px] p-2.5 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-xl transition-colors shrink-0 disabled:opacity-50 touch-manipulation"
                  title="Adjuntar foto o catálogo"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isSending && handleSendMessage()}
                  placeholder={attachedFile ? "Añade un mensaje opcional..." : "Escribe una respuesta al cliente..."}
                  disabled={isSending}
                  className={`min-h-[44px] flex-1 p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base lg:text-sm text-warm-900 focus:outline-none ${c.inputFocus} disabled:opacity-50`}
                />

                <button
                  onClick={handleSendMessage}
                  disabled={isSending || (!inputMessage.trim() && !attachedFile)}
                  className={`min-h-[44px] min-w-[44px] p-2.5 ${c.btnBg} ${c.btnHover} disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center justify-center shrink-0 touch-manipulation`}
                >
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-warm-400 text-xs space-y-2">
              <MessageSquareText className="h-10 w-10 text-warm-300" />
              <p className="font-bold text-warm-600">Selecciona una conversación</p>
              <p className="text-[11px] text-warm-400">Haz clic en un cliente de la lista a la izquierda para responder.</p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3: CRM OPERATIONS PANEL (xl:col-span-4, lg:col-span-12)             */}
        {/* ========================================================================= */}
        <div
          className={`lg:col-span-12 xl:col-span-4 space-y-4 flex flex-col ${
            mobileTab === "crm" ? "flex" : "hidden xl:flex"
          }`}
        >
          {/* Card 1: Immediate Business Action */}
          <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className={`h-4 w-4 ${c.btnIcon}`} />
                <h3 className="font-bold text-xs text-warm-900">Cliente en Conversación</h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                activeThread ? "bg-emerald-100 text-emerald-800" : "bg-warm-100 text-warm-600"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${activeThread ? "bg-emerald-500 animate-pulse" : "bg-warm-400"}`}></span>
                {activeThread ? "Activo" : "En Espera"}
              </span>
            </div>

            {activeThread ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-start gap-3 p-3 bg-warm-50/80 rounded-xl border border-warm-200/80">
                  {/* Avatar with Lightbox on click */}
                  {activeThread.profilePicUrl ? (
                    <img
                      src={activeThread.profilePicUrl}
                      alt={activeThread.clientName}
                      referrerPolicy="no-referrer"
                      onClick={() => handleOpenLightbox(activeThread.profilePicUrl!, activeThread.clientName)}
                      className="h-11 w-11 rounded-full object-cover border border-warm-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-warm-400 transition-all shadow-xs"
                      title="Clic para ampliar foto de perfil"
                    />
                  ) : null}
                  <div
                    className={`h-11 w-11 rounded-full ${c.avatarBg} ${c.avatarText} font-bold items-center justify-center text-xs border ${c.avatarBorder} shrink-0`}
                    style={{ display: activeThread.profilePicUrl ? "none" : "flex" }}
                  >
                    {activeThread.clientName.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <h4 className="font-bold text-xs text-warm-900 truncate">{activeThread.clientName}</h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        activeThread.channel === "WhatsApp"
                          ? "bg-emerald-100 text-emerald-800"
                          : activeThread.channel === "Instagram"
                          ? "bg-pink-100 text-pink-800"
                          : "bg-blue-100 text-blue-800"
                      }`}>
                        {activeThread.channel}
                      </span>
                      <span className="text-[10px] text-warm-500 font-mono truncate">{activeThread.phone}</span>
                    </div>

                    {/* Quick Communication & Sync Shortcuts */}
                    <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                      {activeThread.phone && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(activeThread.phone);
                              toast.success("Teléfono copiado al portapapeles");
                            }}
                            className="p-1 bg-white hover:bg-warm-100 text-warm-600 rounded-lg border border-warm-200 text-[10px] flex items-center gap-1 transition-colors shadow-xs"
                            title="Copiar teléfono"
                          >
                            <Copy className="h-3 w-3" />
                            <span>Copiar</span>
                          </button>
                          {activeThread.phone.replace(/\D/g, "").length >= 8 && (
                            <a
                              href={`https://wa.me/${activeThread.phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 text-[10px] font-bold flex items-center gap-1 transition-colors shadow-xs"
                              title="Abrir chat directo de WhatsApp Web"
                            >
                              <Phone className="h-3 w-3 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          window.postMessage({ type: "FARFALINA_TRIGGER_CHAT_SYNC", threadId: activeThread.phone }, "*");
                          if (metaWindowRef.current && !metaWindowRef.current.closed) {
                            try {
                              metaWindowRef.current.postMessage({ type: "FARFALINA_TRIGGER_CHAT_SYNC", threadId: activeThread.phone }, "*");
                            } catch (_) {}
                          }
                          toast.info("Petición de sincronización enviada a Meta Extension...");
                          setTimeout(() => loadThreads(true), 1500);
                        }}
                        className="p-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 text-[10px] font-bold flex items-center gap-1 transition-colors shadow-xs ml-auto"
                        title="Sincronizar historial reciente de este chat"
                      >
                        <RefreshCw className="h-3 w-3 text-blue-600" />
                        <span>Sync Chat</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Primary Business Action Button */}
                {primaryDrawer === "floreria" ? (
                  <button
                    onClick={() => setDrawerOpen(true)}
                    className="w-full py-2.5 px-3 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center justify-center gap-2 group"
                  >
                    <ShoppingBag className="h-4 w-4 transition-transform group-hover:scale-110" />
                    <span>💐 Generar Pedido Floral</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setRentalDrawerOpen(true)}
                    className="w-full py-2.5 px-3 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center justify-center gap-2 group"
                  >
                    <Shirt className="h-4 w-4 transition-transform group-hover:scale-110" />
                    <span>👗 Generar Reserva de Vestido</span>
                  </button>
                )}
                <p className="text-[10px] text-warm-400 text-center">
                  {primaryDrawer === "floreria"
                    ? "Descuenta receta del stock en vivo y genera ticket de despacho."
                    : "Fija garantía de alquiler y agenda calendario de entrega."}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-warm-50 rounded-xl border border-warm-200/80 text-center space-y-2">
                <p className="text-xs text-warm-600">Selecciona un chat para emitir pedido</p>
                {primaryDrawer === "floreria" ? (
                  <button
                    onClick={() => setDrawerOpen(true)}
                    className="px-3 py-1.5 bg-white hover:bg-warm-100 text-warm-800 border border-warm-200 rounded-lg text-xs font-bold shadow-xs mx-auto"
                  >
                    💐 Generar Pedido Manual
                  </button>
                ) : (
                  <button
                    onClick={() => setRentalDrawerOpen(true)}
                    className="px-3 py-1.5 bg-white hover:bg-warm-100 text-warm-800 border border-warm-200 rounded-lg text-xs font-bold shadow-xs mx-auto"
                  >
                    👗 Generar Reserva Manual
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card 2: Live Stock & Availability Widget */}
          <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-4 space-y-3 flex-1 flex flex-col min-h-[260px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <PackageCheck className={`h-4 w-4 ${c.btnIcon}`} />
                <h3 className="font-bold text-xs text-warm-900">
                  {primaryDrawer === "floreria" ? "Stock Insumos Vivos" : "Vestidos en Stock"}
                </h3>
              </div>
              <span className="text-[10px] font-bold text-warm-500 font-mono">
                {primaryDrawer === "floreria" ? `${liveIngredients.length} ítems` : `${liveDresses.length} vestidos`}
              </span>
            </div>

            {/* Search input */}
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400" />
              <input
                type="text"
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder={primaryDrawer === "floreria" ? "Buscar flor o insumo..." : "Buscar vestido o talla..."}
                className="w-full pl-8 pr-3 py-1.5 bg-warm-50 border border-warm-200 rounded-lg text-xs text-warm-900 focus:outline-none focus:border-warm-400"
              />
            </div>

            {/* Items scroll list */}
            <div className="divide-y divide-warm-100 overflow-y-auto flex-1 max-h-[220px] pr-1">
              {primaryDrawer === "floreria" ? (
                liveIngredients
                  .filter(
                    (ing) =>
                      ing.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                      ing.type.toLowerCase().includes(inventorySearch.toLowerCase())
                  )
                  .map((ing) => (
                    <div key={ing.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-warm-900 truncate">{ing.name}</p>
                        <span className="text-[10px] text-warm-400">{ing.type}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                            ing.available > 15
                              ? "bg-emerald-100 text-emerald-800"
                              : ing.available > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {ing.available} {ing.unit}
                        </span>
                        <span className="text-[10px] text-warm-500 block mt-0.5">
                          {formatCurrency(ing.costPerUnit)}
                        </span>
                      </div>
                    </div>
                  ))
              ) : (
                liveDresses
                  .filter(
                    (d) =>
                      d.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                      d.size.toLowerCase().includes(inventorySearch.toLowerCase()) ||
                      d.color.toLowerCase().includes(inventorySearch.toLowerCase())
                  )
                  .map((d) => (
                    <div key={d.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-warm-900 truncate">{d.name}</p>
                        <span className="text-[10px] text-warm-400">
                          Talla {d.size} • {d.color}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.status === "DISPONIBLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {d.status}
                        </span>
                        <span className="text-[10px] text-warm-500 block mt-0.5">
                          {formatCurrency(d.baseRentalPrice)}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>

          {/* Card 3: Quick Replies & Clipboard Helpers */}
          <div className="bg-white rounded-2xl border border-warm-200 shadow-sm p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquareText className={`h-4 w-4 ${c.btnIcon}`} />
                <h3 className="font-bold text-xs text-warm-900">Plantillas Rápidas</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickRepliesModalOpen(true)}
                className="text-[10px] font-bold text-warm-600 hover:text-warm-900 underline"
              >
                Gestionar
              </button>
            </div>
            <p className="text-[10px] text-warm-500">
              Haz clic en cualquier respuesta para copiarla al portapapeles o insertarla en el chat.
            </p>

            <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
              {quickReplies.map((qr) => (
                <button
                  key={qr.id}
                  onClick={() => handleCopyQuickReply(qr)}
                  className="w-full text-left p-2 rounded-xl bg-warm-50 hover:bg-warm-100 border border-warm-200 transition-colors flex items-center justify-between gap-2 group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[11px] text-warm-800 truncate">{qr.title}</p>
                    <p className="text-[10px] text-warm-500 truncate">{qr.text}</p>
                  </div>
                  {copiedReplyId === qr.id ? (
                    <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 shrink-0">
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>¡Copiado!</span>
                    </span>
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-warm-400 group-hover:text-warm-700 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Direct Order Side Drawer (Florería) */}
      <ChatOrderDrawer
        isOpen={drawerOpen}
        threadId={effectiveThreadId}
        clientName={effectiveClientName}
        clientPhone={effectiveClientPhone}
        channel={effectiveChannel}
        messages={activeThread?.messages || []}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => {
          toast.success("¡Pedido emitido con éxito desde el módulo omnicanal!");
          loadThreads();
          loadLiveInventory();
        }}
      />

      {/* Direct Rental Side Drawer (Carissma) */}
      <ChatRentalDrawer
        isOpen={rentalDrawerOpen}
        threadId={effectiveThreadId}
        clientName={effectiveClientName}
        clientPhone={effectiveClientPhone}
        channel={effectiveChannel}
        onClose={() => setRentalDrawerOpen(false)}
        onSuccess={() => {
          toast.success("¡Reserva de vestido emitida con éxito desde el módulo omnicanal!");
          loadThreads();
          loadLiveInventory();
        }}
      />

      {/* Omnichannel Connections Config Modal */}
      <OmnichannelConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        environment={environment}
        onUpdated={() => {
          loadChannelConfigs();
          loadThreads();
        }}
      />

      {/* Quick Replies & Preset Catalog Manager Modal */}
      <QuickRepliesModal
        isOpen={isQuickRepliesModalOpen}
        onClose={() => setIsQuickRepliesModalOpen(false)}
        onSelectReply={(reply) => applyQuickResponse(reply)}
        onUpdated={() => {
          loadQuickReplies();
        }}
      />

      {/* In-App Image Lightbox Modal with Zoom & Local Download */}
      {activeLightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={handleCloseLightbox}
        >
          {/* Top Bar Controls */}
          <div
            className="w-full max-w-4xl flex items-center justify-between text-white pb-3 px-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-xs sm:text-sm font-semibold truncate text-zinc-200">
                {activeLightboxImg.caption || "Vista previa de imagen"}
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setZoomScale((prev) => Math.max(0.5, Number((prev - 0.25).toFixed(2))))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                title="Reducir zoom"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs font-mono text-zinc-300 w-12 text-center select-none">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))))}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                title="Aumentar zoom"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDownloadImage(activeLightboxImg.url)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                title="Descargar imagen a la máquina"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCloseLightbox}
                className="p-2 bg-white/10 hover:bg-red-600/80 rounded-xl text-white transition-colors ml-1.5 sm:ml-2"
                title="Cerrar visor (Esc)"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Image Canvas Box */}
          <div
            className="relative max-w-4xl max-h-[80dvh] flex items-center justify-center overflow-auto rounded-2xl bg-zinc-950/60 p-2 shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activeLightboxImg.url}
              alt={activeLightboxImg.caption || "Imagen ampliada"}
              referrerPolicy="no-referrer"
              style={{ transform: `scale(${zoomScale})`, transition: "transform 0.15s ease-out" }}
              className="max-h-[75dvh] max-w-[85vw] object-contain rounded-lg select-none"
              onError={(e) => {
                const img = e.currentTarget;
                if (activeLightboxImg.url.startsWith("/uploads/") && !img.src.includes("/api/media/")) {
                  img.src = activeLightboxImg.url.replace(/^\/uploads\//, "/api/media/");
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
