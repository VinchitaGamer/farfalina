"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  QrCode,
  Facebook,
  Instagram,
  CheckCircle2,
  RefreshCw,
  Key,
  ShieldCheck,
  Unplug,
  Settings,
  Info,
  Copy,
  Check,
  Cloud,
  Phone,
  ExternalLink,
} from "lucide-react";
import {
  getChannelConfigsAction,
  generateWhatsAppQRAction,
  saveMetaWhatsAppConfigAction,
  saveFacebookPageTokenAction,
  saveInstagramTokenAction,
  disconnectChannelAction,
  getRelayStatusAction,
  testFacebookConnectionAction,
  testInstagramConnectionAction,
} from "@/app/actions/omnichannel";
import { toast } from "@/components/ui/toast";

import { z } from "zod";

export const ChannelConfigDataSchema = z.object({
  id: z.string(),
  channel: z.string(),
  status: z.string(),
  qrCodeData: z.string().nullable(),
  whatsappPhoneNumberId: z.string().nullable().optional(),
  whatsappWabaId: z.string().nullable().optional(),
  whatsappAccessToken: z.string().nullable().optional(),
  whatsappBusinessPhone: z.string().nullable().optional(),
  facebookPageToken: z.string().nullable().optional(),
  facebookPageId: z.string().nullable().optional(),
  instagramAccessToken: z.string().nullable().optional(),
  instagramAccountId: z.string().nullable().optional(),
  verifyToken: z.string().nullable().optional(),
});

export type ChannelConfigData = z.infer<typeof ChannelConfigDataSchema>;

export const OmnichannelConfigModalPropsSchema = z.object({
  isOpen: z.boolean(),
  onClose: z.custom<() => void>(),
  onUpdated: z.custom<() => void>().optional(),
  environment: z.enum(["farfalina", "carissma"]).optional(),
});

export type OmnichannelConfigModalProps = z.infer<typeof OmnichannelConfigModalPropsSchema>;

export const RelayStatusDataSchema = z.object({
  environment: z.string(),
  isConnected: z.boolean(),
  lastSyncAt: z.union([z.date(), z.string()]).nullable(),
  pendingCount: z.number(),
  deliveredCount: z.number(),
  facebookStatus: z.string(),
  instagramStatus: z.string(),
});

export type RelayStatusData = z.infer<typeof RelayStatusDataSchema>;

const DEFAULT_VERIFY_TOKEN = "farfalina_carissma_webhook_verify_token_2026";

export default function OmnichannelConfigModal({
  isOpen,
  onClose,
  onUpdated,
  environment = "farfalina",
}: OmnichannelConfigModalProps) {
  const [activeTab, setActiveTab] = useState<"whatsapp" | "facebook" | "instagram">("whatsapp");
  const [waMode, setWaMode] = useState<"web" | "cloud">("web");
  const [configs, setConfigs] = useState<ChannelConfigData[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [testingFb, setTestingFb] = useState(false);
  const [testingIg, setTestingIg] = useState(false);

  // Copy states
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedExtensionPath, setCopiedExtensionPath] = useState(false);
  const [copiedLocalUrl, setCopiedLocalUrl] = useState(false);

  // Relay Extension State
  const [relayStatus, setRelayStatus] = useState<{
    environment: string;
    isConnected: boolean;
    lastSyncAt: Date | string | null;
    pendingCount: number;
    deliveredCount: number;
    facebookStatus: string;
    instagramStatus: string;
  } | null>(null);
  const [checkingRelay, setCheckingRelay] = useState(false);

  // Form states
  const [waPhoneNumberId, setWaPhoneNumberId] = useState("");
  const [waWabaId, setWaWabaId] = useState("");
  const [waToken, setWaToken] = useState("");
  const [waPhone, setWaPhone] = useState("");

  const [fbToken, setFbToken] = useState("");
  const [fbPageId, setFbPageId] = useState("");
  const [igAccountId, setIgAccountId] = useState("");
  const [igToken, setIgToken] = useState("");

  const loadRelayStatus = async (silent = false) => {
    if (!silent) setCheckingRelay(true);
    try {
      const res = await getRelayStatusAction(environment);
      if (res.success && res.data) {
        setRelayStatus(res.data as RelayStatusData);
      }
    } catch {
      // Ignorar error de red
    } finally {
      if (!silent) setCheckingRelay(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
      loadRelayStatus();
    }
  }, [isOpen, environment]);

  // Real-time polling while modal is open on WhatsApp web mode or Relay modes
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === "whatsapp" && waMode === "web") {
      const isWaiting = actionLoading || configs.find((c) => c.channel === "WhatsApp")?.status === "INITIALIZING";
      const interval = setInterval(() => {
        loadConfigs(true);
      }, isWaiting ? 2500 : 4000);
      return () => clearInterval(interval);
    }

    if (activeTab === "facebook" || activeTab === "instagram") {
      loadRelayStatus(true);
      const interval = setInterval(() => {
        loadRelayStatus(true);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeTab, waMode, environment, actionLoading, configs]);

  const loadConfigs = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await getChannelConfigsAction(environment);
    if (res.success && Array.isArray(res.data)) {
      const data = res.data as ChannelConfigData[];
      setConfigs(data);

      const waConfig = data.find((c) => c.channel === "WhatsApp");
      if (waConfig?.whatsappPhoneNumberId) setWaPhoneNumberId(waConfig.whatsappPhoneNumberId);
      if (waConfig?.whatsappWabaId) setWaWabaId(waConfig.whatsappWabaId);
      if (waConfig?.whatsappAccessToken) setWaToken(waConfig.whatsappAccessToken);
      if (waConfig?.whatsappBusinessPhone) setWaPhone(waConfig.whatsappBusinessPhone);

      const fbConfig = data.find((c) => c.channel === "Facebook");
      if (fbConfig?.facebookPageToken) setFbToken(fbConfig.facebookPageToken);
      if (fbConfig?.facebookPageId) setFbPageId(fbConfig.facebookPageId);

      const igConfig = data.find((c) => c.channel === "Instagram");
      if (igConfig?.instagramAccountId) setIgAccountId(igConfig.instagramAccountId);
      if (igConfig?.instagramAccessToken) setIgToken(igConfig.instagramAccessToken);
    } else if (!silent) {
      toast.error(res.error || "No se pudo cargar la configuración de canales");
    }
    if (!silent) setLoading(false);
  };

  if (!isOpen) return null;

  const getChannel = (name: string) => configs.find((c) => c.channel === name);
  const waConfig = getChannel("WhatsApp");
  const fbConfig = getChannel("Facebook");
  const igConfig = getChannel("Instagram");

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://api.farfalina.bo";
  const whatsappWebhookUrl = `${baseUrl}/api/webhooks/whatsapp?env=${environment}`;
  const facebookWebhookUrl = `${baseUrl}/api/webhooks/facebook?env=${environment}`;
  const instagramWebhookUrl = `${baseUrl}/api/webhooks/instagram?env=${environment}`;
  const verifyTokenToDisplay = waConfig?.verifyToken || fbConfig?.verifyToken || igConfig?.verifyToken || DEFAULT_VERIFY_TOKEN;

  const copyToClipboard = (text: string, type: "url" | "token") => {
    navigator.clipboard.writeText(text);
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
    toast.success("Copiado al portapapeles");
  };

  // WhatsApp Cloud Actions
  const handleSaveWaCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waPhoneNumberId.trim()) {
      toast.error("El Phone Number ID es obligatorio.");
      return;
    }
    if (!waToken.trim()) {
      toast.error("El Token Permanente de Meta es obligatorio.");
      return;
    }

    setActionLoading(true);
    const res = await saveMetaWhatsAppConfigAction(
      {
        whatsappPhoneNumberId: waPhoneNumberId.trim(),
        whatsappWabaId: waWabaId.trim() || null,
        whatsappAccessToken: waToken.trim(),
        whatsappBusinessPhone: waPhone.trim() || null,
        verifyToken: verifyTokenToDisplay,
      },
      environment
    );

    if (res.success) {
      toast.success(`Meta WhatsApp Cloud configurado para ${environment === "carissma" ? "Carissma" : "Farfalina"}.`);
      await loadConfigs();
      onUpdated?.();
    } else {
      toast.error(res.error || "Error al guardar credenciales de WhatsApp Cloud");
    }
    setActionLoading(false);
  };

  // WhatsApp Web Actions (QR Legacy)
  const handleGenerateQR = async () => {
    setActionLoading(true);
    setConfigs((prev) => [
      ...prev.filter((c) => c.channel !== "WhatsApp"),
      {
        id: "wa-optimistic",
        channel: "WhatsApp",
        status: "INITIALIZING",
        qrCodeData: null,
        facebookPageToken: null,
        facebookPageId: null,
        instagramAccessToken: null,
        instagramAccountId: null,
      },
    ]);

    const res = await generateWhatsAppQRAction(environment);
    if (res.success) {
      if (res.data) {
        setConfigs((prev) => [
          ...prev.filter((c) => c.channel !== "WhatsApp"),
          res.data as ChannelConfigData,
        ]);
      }
      toast.success("Iniciando socket Baileys para generar QR...");
      await loadConfigs(true);
      onUpdated?.();
    } else {
      toast.error(res.error || "Error al generar código QR");
      await loadConfigs(true);
    }
    setActionLoading(false);
  };

  const handleDisconnect = async (channelName: string) => {
    setActionLoading(true);
    const res = await disconnectChannelAction(channelName, environment);
    if (res.success) {
      toast.success(`Canal ${channelName} desconectado en ${environment === "carissma" ? "Carissma" : "Farfalina"}.`);
      if (channelName === "WhatsApp") {
        setWaPhoneNumberId("");
        setWaWabaId("");
        setWaToken("");
        setWaPhone("");
      }
      if (channelName === "Facebook") {
        setFbToken("");
        setFbPageId("");
      }
      if (channelName === "Instagram") {
        setIgAccountId("");
        setIgToken("");
      }
      await loadConfigs();
      onUpdated?.();
    } else {
      toast.error(res.error || `Error al desconectar ${channelName}`);
    }
    setActionLoading(false);
  };

  // Facebook Actions
  const handleSaveFbToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbToken.trim()) {
      toast.error("Ingresa un Token de FanPage válido.");
      return;
    }
    setActionLoading(true);
    const res = await saveFacebookPageTokenAction({ pageToken: fbToken, pageId: fbPageId }, environment);
    if (res.success) {
      toast.success("Credenciales de Facebook Messenger guardadas con éxito.");
      await loadConfigs();
      onUpdated?.();
    } else {
      toast.error(res.error || "Error al guardar Token de Facebook");
    }
    setActionLoading(false);
  };

  const handleTestFacebook = async () => {
    setTestingFb(true);
    const res = await testFacebookConnectionAction(environment);
    if (res.success && res.data) {
      const data = res.data as { pageName?: string; pageId?: string };
      toast.success(`✅ Conexión con Meta verificada: "${data.pageName || data.pageId}"`);
      await loadConfigs();
      onUpdated?.();
    } else {
      toast.error(res.error || "Error al verificar conexión con Facebook Messenger");
    }
    setTestingFb(false);
  };

  // Instagram Actions
  const handleSaveIgToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!igAccountId.trim() || !igToken.trim()) {
      toast.error("Completa el Account ID y el Token de Instagram Direct.");
      return;
    }
    setActionLoading(true);
    const res = await saveInstagramTokenAction(
      {
        instagramAccountId: igAccountId,
        instagramAccessToken: igToken,
      },
      environment
    );
    if (res.success) {
      toast.success("Credenciales de Instagram Direct guardadas y conectadas.");
      await loadConfigs();
      onUpdated?.();
    } else {
      toast.error(res.error || "Error al guardar credenciales de Instagram");
    }
    setActionLoading(false);
  };

  const handleTestInstagram = async () => {
    setTestingIg(true);
    const res = await testInstagramConnectionAction(environment);
    if (res.success && res.data) {
      const data = res.data as { username?: string; accountId?: string };
      toast.success(`✅ Conexión con Meta verificada: Instagram "@${data.username || data.accountId}"`);
      await loadConfigs();
      onUpdated?.();
    } else {
      toast.error(res.error || "Error al verificar conexión con Instagram Direct");
    }
    setTestingIg(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-warm-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh]">
        {/* Header */}
        <div className="p-3.5 sm:p-5 bg-warm-50 border-b border-warm-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-terracotta-100 text-terracotta-700 rounded-xl shrink-0">
              <QrCode className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xs sm:text-base text-warm-900 truncate flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-terracotta-600 inline" />
                <span>Configuración Omnicanal ({environment === "carissma" ? "Alquileres Carissma" : "Florería Farfalina"})</span>
              </h3>
              <p className="text-[10px] sm:text-xs text-warm-500 truncate">
                Meta WhatsApp Cloud API, Facebook Messenger e Instagram Direct
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-warm-100 text-warm-500 hover:text-warm-900 rounded-xl transition-colors shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center border-b border-warm-200 bg-white px-3 sm:px-5 pt-2.5 sm:pt-3 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "whatsapp"
                ? "border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl"
                : "border-transparent text-warm-600 hover:text-warm-900"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>WhatsApp Business</span>
          </button>

          <button
            onClick={() => setActiveTab("facebook")}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "facebook"
                ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl"
                : "border-transparent text-warm-600 hover:text-warm-900"
            }`}
          >
            <Facebook className="h-3.5 w-3.5 text-blue-600" />
            <span>Facebook Messenger</span>
          </button>

          <button
            onClick={() => setActiveTab("instagram")}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
              activeTab === "instagram"
                ? "border-pink-600 text-pink-700 bg-pink-50/50 rounded-t-xl"
                : "border-transparent text-warm-600 hover:text-warm-900"
            }`}
          >
            <Instagram className="h-3.5 w-3.5 text-pink-600" />
            <span>Instagram Direct</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 bg-warm-50/30">
          {loading ? (
            <div className="py-12 text-center text-xs text-warm-400 flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" /> Cargando estados de conexión real...
            </div>
          ) : (
            <>
              {/* TAB 1: WhatsApp */}
              {activeTab === "whatsapp" && (
                <div className="space-y-4">
                  {/* Sub-navigation: Cloud API vs Web QR */}
                  <div className="flex bg-warm-100/80 p-1 rounded-xl gap-1 text-xs">
                    <button
                      onClick={() => setWaMode("cloud")}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                        waMode === "cloud"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-warm-600 hover:text-warm-900"
                      }`}
                    >
                      <Cloud className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Meta Cloud API (Oficial Meta v22.0)</span>
                    </button>
                    <button
                      onClick={() => setWaMode("web")}
                      className={`flex-1 py-1.5 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all ${
                        waMode === "web"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-warm-600 hover:text-warm-900"
                      }`}
                    >
                      <QrCode className="h-3.5 w-3.5 text-warm-500" />
                      <span>WhatsApp Web (QR Legacy)</span>
                    </button>
                  </div>

                  {/* SUBTAB A: Meta Cloud API */}
                  {waMode === "cloud" && (
                    <div className="space-y-4">
                      {/* Status Card */}
                      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-warm-200 shadow-sm">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">Estado Meta Cloud</span>
                          <h4 className="font-bold text-sm text-warm-900 flex items-center gap-2 mt-0.5">
                            WhatsApp Business Platform API
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                                waConfig?.status === "CONNECTED" && waConfig.whatsappPhoneNumberId
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {waConfig?.status === "CONNECTED" && waConfig.whatsappPhoneNumberId
                                ? "CONECTADO A META"
                                : "SIN CONECTAR"}
                            </span>
                          </h4>
                          {waConfig?.whatsappBusinessPhone && (
                            <p className="text-xs text-emerald-700 font-medium mt-0.5">
                              Línea activa: {waConfig.whatsappBusinessPhone}
                            </p>
                          )}
                        </div>

                        {waConfig?.status === "CONNECTED" && waConfig.whatsappPhoneNumberId && (
                          <button
                            onClick={() => handleDisconnect("WhatsApp")}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <Unplug className="h-3.5 w-3.5" />
                            Desconectar
                          </button>
                        )}
                      </div>

                      {/* Credentials Form */}
                      <form onSubmit={handleSaveWaCloud} className="bg-white p-5 rounded-2xl border border-warm-200 space-y-3.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-bold text-warm-900 flex items-center gap-1.5">
                            <Key className="h-4 w-4 text-emerald-600" />
                            <span>Credenciales de WhatsApp Cloud API</span>
                          </h5>
                          <a
                            href="https://developers.facebook.com/apps"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-terracotta-600 hover:text-terracotta-700 font-bold flex items-center gap-1"
                          >
                            <span>Meta Developers</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-warm-700 flex items-center gap-1">
                              <span>Phone Number ID</span>
                              <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={waPhoneNumberId}
                              onChange={(e) => setWaPhoneNumberId(e.target.value)}
                              placeholder="Ej: 109283746501928"
                              className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-warm-700">
                              <span>WABA ID (WhatsApp Business Account)</span>
                            </label>
                            <input
                              type="text"
                              value={waWabaId}
                              onChange={(e) => setWaWabaId(e.target.value)}
                              placeholder="Ej: 102938475610293"
                              className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-mono focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-warm-700 flex items-center gap-1">
                            <span>System User Permanent Access Token</span>
                            <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="password"
                            value={waToken}
                            onChange={(e) => setWaToken(e.target.value)}
                            placeholder="EAAG..."
                            className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-mono focus:outline-none focus:border-emerald-500"
                          />
                          {waToken.startsWith("****") && (
                            <p className="text-[10px] text-warm-500">
                              🔒 Token configurado. Puedes dejarlo intacto para conservarlo o escribir un nuevo token para reemplazarlo.
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-warm-700 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-emerald-600" />
                            <span>Número Visible de WhatsApp</span>
                          </label>
                          <input
                            type="text"
                            value={waPhone}
                            onChange={(e) => setWaPhone(e.target.value)}
                            placeholder="Ej: +591 70000000"
                            className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-warm-400 flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Meta Graph API v22.0
                          </span>
                          <button
                            type="submit"
                            disabled={actionLoading}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Guardar Credenciales Cloud</span>
                          </button>
                        </div>
                      </form>

                      {/* Webhook Settings Box */}
                      <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-950 space-y-3">
                        <div className="flex items-center gap-1.5">
                          <Info className="h-4 w-4 text-emerald-700 shrink-0" />
                          <span className="font-bold text-xs text-emerald-900">
                            Configuración del Webhook en Meta for Developers:
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-emerald-800">URL de devolución de llamada (Callback URL):</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={whatsappWebhookUrl}
                              className="w-full p-2 bg-white border border-emerald-200 rounded-xl text-xs text-emerald-900 font-mono font-bold select-all"
                            />
                            <button
                              type="button"
                              onClick={() => copyToClipboard(whatsappWebhookUrl, "url")}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1"
                            >
                              {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              <span>Copiar</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-emerald-800">Token de verificación (Verify Token):</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              readOnly
                              value={verifyTokenToDisplay}
                              className="w-full p-2 bg-white border border-emerald-200 rounded-xl text-xs text-emerald-900 font-mono font-bold select-all"
                            />
                            <button
                              type="button"
                              onClick={() => copyToClipboard(verifyTokenToDisplay, "token")}
                              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1"
                            >
                              {copiedToken ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              <span>Copiar</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-[10px] text-emerald-700 leading-relaxed">
                          💡 En tu Panel de Meta &gt; WhatsApp &gt; Configuración &gt; Webhook, pega esta URL y Token. Luego suscríbete al campo <strong>messages</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB B: WhatsApp Web (QR Legacy) */}
                  {waMode === "web" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-warm-200 shadow-sm">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">Estado WhatsApp Web</span>
                          <h4 className="font-bold text-sm text-warm-900 flex items-center gap-2 mt-0.5">
                            WhatsApp Multi-dispositivo (Socket Local)
                            <span
                              className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                                waConfig?.status === "CONNECTED" && !waConfig.whatsappPhoneNumberId
                                  ? "bg-emerald-100 text-emerald-800"
                                  : waConfig?.status === "QR_READY"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-zinc-100 text-zinc-600"
                              }`}
                            >
                              {waConfig?.status || "DISCONNECTED"}
                            </span>
                          </h4>
                        </div>

                        {waConfig?.status === "CONNECTED" && (
                          <button
                            onClick={() => handleDisconnect("WhatsApp")}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                          >
                            <Unplug className="h-3.5 w-3.5" />
                            Desconectar
                          </button>
                        )}
                      </div>

                      {waConfig?.status === "CONNECTED" && !waConfig.whatsappPhoneNumberId ? (
                        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl text-center space-y-2">
                          <div className="h-12 w-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                          <h4 className="font-bold text-sm text-emerald-900">¡Dispositivo Vinculado Activamente!</h4>
                          <p className="text-xs text-emerald-700 max-w-md mx-auto">
                            La sesión de WhatsApp Web está lista para recibir y enviar mensajes en {environment === "carissma" ? "Carissma" : "Farfalina"}.
                          </p>
                        </div>
                      ) : waConfig?.status === "QR_READY" && waConfig.qrCodeData ? (
                        <div className="bg-white p-6 rounded-2xl border border-warm-200 text-center space-y-4 shadow-sm">
                          <div className="space-y-1">
                            <h4 className="font-bold text-xs text-warm-900">Escanea el código QR con tu celular</h4>
                            <p className="text-[11px] text-warm-500 max-w-xs mx-auto">
                              Abre WhatsApp en tu smartphone &gt; Dispositivos vinculados &gt; Vincular un dispositivo.
                            </p>
                          </div>

                          <div className="inline-block p-3 bg-white border-2 border-emerald-500 rounded-2xl shadow-md">
                            <img
                              src={waConfig.qrCodeData}
                              alt="Código QR WhatsApp"
                              className="w-56 h-56 mx-auto rounded-xl object-contain"
                            />
                          </div>

                          <div className="pt-2 flex items-center justify-center gap-2">
                            <button
                              onClick={handleGenerateQR}
                              disabled={actionLoading}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Regenerar QR
                            </button>
                            <button
                              onClick={() => handleDisconnect("WhatsApp")}
                              disabled={actionLoading}
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all border border-rose-200"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : waConfig?.status === "INITIALIZING" || (waConfig?.status === "QR_READY" && !waConfig.qrCodeData) || actionLoading ? (
                        <div className="bg-white p-8 rounded-2xl border border-warm-200 text-center space-y-4 shadow-sm">
                          <div className="h-14 w-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-200">
                            <RefreshCw className="h-7 w-7 animate-spin" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-sm text-warm-900">Generando código QR dinámico...</h4>
                            <p className="text-xs text-warm-500 max-w-xs mx-auto">
                              Iniciando navegador seguro en el servidor. El código QR aparecerá automáticamente en pantalla en pocos segundos.
                            </p>
                          </div>
                          <button
                            onClick={() => handleDisconnect("WhatsApp")}
                            className="px-3 py-1.5 bg-warm-100 hover:bg-warm-200 text-warm-700 text-xs font-medium rounded-xl transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="bg-white p-6 rounded-2xl border border-warm-200 text-center space-y-4 shadow-sm">
                          <div className="h-12 w-12 bg-warm-100 text-warm-500 rounded-full flex items-center justify-center mx-auto">
                            <QrCode className="h-6 w-6" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-sm text-warm-900">Vincular con WhatsApp Web</h4>
                            <p className="text-xs text-warm-500 max-w-sm mx-auto">
                              Genera un código QR dinámico para sincronizar la app de WhatsApp de tu smartphone.
                            </p>
                          </div>
                          <button
                            onClick={handleGenerateQR}
                            disabled={actionLoading}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all inline-flex items-center gap-2"
                          >
                            <QrCode className="h-4 w-4" />
                            Generar Código QR de Vinculación
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Facebook Messenger via Meta Developer App */}
              {activeTab === "facebook" && (
                <div className="space-y-4">
                  {/* Status Card */}
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-warm-200 shadow-sm">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">Estado de Conexión</span>
                      <h4 className="font-bold text-sm text-warm-900 flex items-center gap-2 mt-0.5">
                        <Facebook className="h-4 w-4 text-blue-600" />
                        Facebook Messenger (Meta Graph API v22.0)
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            fbConfig?.status === "CONNECTED" && fbConfig.facebookPageToken
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {fbConfig?.status === "CONNECTED" && fbConfig.facebookPageToken ? "🟢 CONECTADO" : "⚪ NO CONFIGURADO"}
                        </span>
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestFacebook}
                        disabled={testingFb || !fbConfig?.facebookPageToken}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                        title="Probar Token con Meta Graph API"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${testingFb ? "animate-spin" : ""}`} />
                        <span>Probar Conexión</span>
                      </button>

                      {fbConfig?.status === "CONNECTED" && fbConfig.facebookPageToken && (
                        <button
                          onClick={() => handleDisconnect("Facebook")}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Unplug className="h-3.5 w-3.5" />
                          Desconectar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form: Credentials */}
                  <form onSubmit={handleSaveFbToken} className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-xs text-warm-900 flex items-center gap-1.5">
                        <Key className="h-4 w-4 text-blue-600" />
                        <span>Credenciales de Facebook FanPage</span>
                      </h5>
                      <a
                        href="https://developers.facebook.com/apps/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <span>developers.facebook.com</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-700">
                        <span>Page ID (Identificador de FanPage)</span>
                      </label>
                      <input
                        type="text"
                        value={fbPageId}
                        onChange={(e) => setFbPageId(e.target.value)}
                        placeholder="Ej: 104829104928174"
                        className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-700 flex items-center gap-1">
                        <span>Page Access Token (Token de Acceso de Página)</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={fbToken}
                        onChange={(e) => setFbToken(e.target.value)}
                        placeholder="EAAG..."
                        className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-mono focus:outline-none focus:border-blue-500"
                      />
                      {fbToken.startsWith("****") && (
                        <p className="text-[10px] text-warm-500">
                          🔒 Token guardado. Déjalo como está o ingresa un nuevo token para reemplazarlo.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-warm-400 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Meta Send API v22.0
                      </span>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Guardar Credenciales Facebook</span>
                      </button>
                    </div>
                  </form>

                  {/* Webhook Settings Box */}
                  <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-2xl text-xs text-blue-950 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-blue-700 shrink-0" />
                      <span className="font-bold text-xs text-blue-900">
                        Configuración del Webhook en Meta Developers (Messenger):
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-blue-800">URL de devolución de llamada (Callback URL):</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={facebookWebhookUrl}
                          className="w-full p-2 bg-white border border-blue-200 rounded-xl text-xs text-blue-900 font-mono font-bold select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(facebookWebhookUrl, "url")}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1"
                        >
                          {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>Copiar</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-blue-800">Token de verificación (Verify Token):</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={verifyTokenToDisplay}
                          className="w-full p-2 bg-white border border-blue-200 rounded-xl text-xs text-blue-900 font-mono font-bold select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(verifyTokenToDisplay, "token")}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1"
                        >
                          {copiedToken ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>Copiar</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-blue-800 leading-relaxed space-y-1 bg-white/70 p-2.5 rounded-xl border border-blue-100">
                      <p className="font-bold">📋 Instrucciones para developers.facebook.com:</p>
                      <p>1. Entra a tu App en Meta Developers y añade el producto <strong>Messenger</strong>.</p>
                      <p>2. En Messenger &gt; Configuración de Webhook, pega la <strong>Callback URL</strong> y el <strong>Verify Token</strong> de arriba.</p>
                      <p>3. Suscribe los campos: <strong>messages</strong>, <strong>messaging_postbacks</strong>, <strong>message_deliveries</strong>, <strong>message_reads</strong>.</p>
                      <p>4. Vincula tu FanPage de Facebook y copia el Token permanente generado.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Instagram Direct via Meta Developer App */}
              {activeTab === "instagram" && (
                <div className="space-y-4">
                  {/* Status Card */}
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-warm-200 shadow-sm">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-warm-400">Estado de Conexión</span>
                      <h4 className="font-bold text-sm text-warm-900 flex items-center gap-2 mt-0.5">
                        <Instagram className="h-4 w-4 text-pink-600" />
                        Instagram Direct (Meta Graph API v22.0)
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            igConfig?.status === "CONNECTED" && igConfig.instagramAccessToken
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-100 text-zinc-600"
                          }`}
                        >
                          {igConfig?.status === "CONNECTED" && igConfig.instagramAccessToken ? "🟢 CONECTADO" : "⚪ NO CONFIGURADO"}
                        </span>
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleTestInstagram}
                        disabled={testingIg || !igConfig?.instagramAccessToken}
                        className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                        title="Probar Token con Instagram Graph API"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${testingIg ? "animate-spin" : ""}`} />
                        <span>Probar Conexión</span>
                      </button>

                      {igConfig?.status === "CONNECTED" && igConfig.instagramAccessToken && (
                        <button
                          onClick={() => handleDisconnect("Instagram")}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                          <Unplug className="h-3.5 w-3.5" />
                          Desconectar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Form: Credentials */}
                  <form onSubmit={handleSaveIgToken} className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-xs text-warm-900 flex items-center gap-1.5">
                        <Key className="h-4 w-4 text-pink-600" />
                        <span>Credenciales de Instagram Direct</span>
                      </h5>
                      <a
                        href="https://developers.facebook.com/apps/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-pink-600 hover:underline flex items-center gap-1"
                      >
                        <span>developers.facebook.com</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-700 flex items-center gap-1">
                        <span>Instagram Business Account ID</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={igAccountId}
                        onChange={(e) => setIgAccountId(e.target.value)}
                        placeholder="Ej: 17841400000000000"
                        className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-mono focus:outline-none focus:border-pink-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-700 flex items-center gap-1">
                        <span>Instagram Access Token / User Token</span>
                        <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={igToken}
                        onChange={(e) => setIgToken(e.target.value)}
                        placeholder="IGAA... o EAAG..."
                        className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-mono focus:outline-none focus:border-pink-500"
                      />
                      {igToken.startsWith("****") && (
                        <p className="text-[10px] text-warm-500">
                          🔒 Token guardado. Déjalo como está o ingresa un nuevo token para reemplazarlo.
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-warm-400 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5 text-pink-600" /> Instagram Graph API v22.0
                      </span>
                      <button
                        type="submit"
                        disabled={actionLoading}
                        className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Guardar Credenciales Instagram</span>
                      </button>
                    </div>
                  </form>

                  {/* Webhook Settings Box */}
                  <div className="bg-pink-50/70 border border-pink-200 p-4 rounded-2xl text-xs text-pink-950 space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Info className="h-4 w-4 text-pink-700 shrink-0" />
                      <span className="font-bold text-xs text-pink-900">
                        Configuración del Webhook en Meta Developers (Instagram):
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-pink-800">URL de devolución de llamada (Callback URL):</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={instagramWebhookUrl}
                          className="w-full p-2 bg-white border border-pink-200 rounded-xl text-xs text-pink-900 font-mono font-bold select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(instagramWebhookUrl, "url")}
                          className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1"
                        >
                          {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>Copiar</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-pink-800">Token de verificación (Verify Token):</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={verifyTokenToDisplay}
                          className="w-full p-2 bg-white border border-pink-200 rounded-xl text-xs text-pink-900 font-mono font-bold select-all"
                        />
                        <button
                          type="button"
                          onClick={() => copyToClipboard(verifyTokenToDisplay, "token")}
                          className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1"
                        >
                          {copiedToken ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>Copiar</span>
                        </button>
                      </div>
                    </div>

                    <div className="text-[10px] text-pink-800 leading-relaxed space-y-1 bg-white/70 p-2.5 rounded-xl border border-pink-100">
                      <p className="font-bold">📋 Instrucciones para Instagram en developers.facebook.com:</p>
                      <p>1. Añade el producto <strong>Instagram Graph API</strong> a tu app en Meta Developers.</p>
                      <p>2. En Webhooks de Instagram, ingresa la <strong>Callback URL</strong> y el <strong>Verify Token</strong>.</p>
                      <p>3. Suscríbete a los campos: <strong>messages</strong>, <strong>messaging_postbacks</strong>, <strong>message_seen</strong>.</p>
                      <p>4. Conecta tu cuenta comercial de Instagram a tu FanPage de Facebook y copia el ID de cuenta de Instagram y el Token.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
