"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Calendar as CalendarIcon,
  Megaphone,
  Send,
  Gift,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Award,
  Sparkles,
  TrendingUp,
  Search,
  Settings,
  Edit2,
  Trash2
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  getCRMDataAction,
  deleteContentCampaignAction,
  deleteCRMClientAction,
  createCRMClientAction,
  updateCRMClientAction,
  createSpecialEventAction,
  deleteSpecialEventAction,
} from "@/app/actions/crm";
import { formatCurrency, getBoliviaDateStr, extractCalendarDateStr, formatDateBolivia } from "@/lib/utils";
import { formatWhatsAppPhoneBolivia } from "@/lib/crm-utils";
import { toast } from "@/components/ui/toast";
import ContentCampaignModal, { ContentCampaignItem } from "./content-campaign-modal";
import LoyaltyConfigModal from "./loyalty-config-modal";

interface CRMClientItem {
  id: string;
  name: string;
  phone: string;
  favoriteFlower?: string | null;
  notes?: string | null;
  totalSpent: number;
  purchaseCount: number;
  loyaltyTier: string;
  lastPurchaseAt?: string | Date | null;
  events?: CRMSpecialEventItem[];
  campaigns?: ContentCampaignItem[];
}

interface CRMSpecialEventItem {
  id: string;
  clientId?: string | null;
  title: string;
  eventType: string;
  eventDate: string | Date;
  description?: string | null;
  promo?: string | null;
  client?: CRMClientItem | null;
}

interface LoyaltyConfigData {
  targetCount: number;
  rewardText: string;
  minSpent?: number;
}

export default function CrmView() {
  const confirm = useConfirm();
  const [crmTab, setCrmTab] = useState<"calendar" | "directory" | "campaigns">("calendar");

  const [clients, setClients] = useState<CRMClientItem[]>([]);
  const [events, setEvents] = useState<CRMSpecialEventItem[]>([]);
  const [campaigns, setCampaigns] = useState<ContentCampaignItem[]>([]);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfigData>({
    targetCount: 5,
    rewardText: "1 Ramo Gratis",
    minSpent: 0,
  });
  const [loading, setLoading] = useState(true);

  // Month navigation for Monthly Calendar
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Selected Campaign to highlight range of days in calendar
  const [selectedCampaign, setSelectedCampaign] = useState<ContentCampaignItem | null>(null);

  // Content Campaign Modal State
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<ContentCampaignItem | null>(null);

  // Loyalty Config Modal State
  const [loyaltyModalOpen, setLoyaltyModalOpen] = useState(false);

  // Create / Edit Client Modal State
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CRMClientItem | null>(null);
  const [clientFormName, setClientFormName] = useState("");
  const [clientFormPhone, setClientFormPhone] = useState("");
  const [clientFormFlower, setClientFormFlower] = useState("");
  const [clientFormNotes, setClientFormNotes] = useState("");
  const [savingClient, setSavingClient] = useState(false);

  // Create Special Event Modal State
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState("Aniversario");
  const [eventDate, setEventDate] = useState(getBoliviaDateStr());
  const [eventClientId, setEventClientId] = useState("");
  const [eventNotes, setEventNotes] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  // Search in Client Directory
  const [clientSearch, setClientSearch] = useState("");

  // Funnel & Network Filter in Campaigns Tab
  const [selectedFunnelFilter, setSelectedFunnelFilter] = useState<string>("Todos");
  const [selectedNetworkFilter, setSelectedNetworkFilter] = useState<string>("Todas");

  useEffect(() => {
    loadCRMData();
  }, []);

  const loadCRMData = async () => {
    setLoading(true);
    const res = await getCRMDataAction("farfalina");
    if (res.success && res.data) {
      const crmData = res.data as {
        clients: CRMClientItem[];
        events: CRMSpecialEventItem[];
        campaigns: ContentCampaignItem[];
        loyaltyConfig: LoyaltyConfigData;
      };
      setClients(crmData.clients || []);
      setEvents(crmData.events || []);
      setCampaigns(crmData.campaigns || []);
      if (crmData.loyaltyConfig) {
        setLoyaltyConfig(crmData.loyaltyConfig);
      }
    }
    setLoading(false);
  };

  const handleSendWhatsAppReminder = (phone: string, clientName: string, eventTitle: string) => {
    const cleanPhone = formatWhatsAppPhoneBolivia(phone);
    if (!cleanPhone) {
      toast.error("El cliente no tiene un número válido para WhatsApp");
      return;
    }
    const message = encodeURIComponent(
      `¡Hola ${clientName}! 💐 Te saludamos de Florería Farfalina. Te recordamos con anticipación la fecha especial de "${eventTitle}". ¿Deseas que preparemos un arreglo exclusivo para esta ocasión?`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
    toast.success(`Abriendo WhatsApp para enviar recordatorio a ${clientName}`);
  };

  const openNewClientModal = () => {
    setEditingClient(null);
    setClientFormName("");
    setClientFormPhone("");
    setClientFormFlower("");
    setClientFormNotes("");
    setClientModalOpen(true);
  };

  const openEditClientModal = (c: CRMClientItem) => {
    setEditingClient(c);
    setClientFormName(c.name);
    setClientFormPhone(c.phone);
    setClientFormFlower(c.favoriteFlower || "");
    setClientFormNotes(c.notes || "");
    setClientModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingClient) return;
    if (!clientFormName.trim() || !clientFormPhone.trim()) {
      toast.error("Completa el nombre y el teléfono del cliente");
      return;
    }
    setSavingClient(true);
    const res = editingClient
      ? await updateCRMClientAction({
          id: editingClient.id,
          name: clientFormName.trim(),
          phone: clientFormPhone.trim(),
          favoriteFlower: clientFormFlower.trim() || undefined,
          notes: clientFormNotes.trim() || undefined,
        })
      : await createCRMClientAction({
          name: clientFormName.trim(),
          phone: clientFormPhone.trim(),
          environment: "farfalina",
          favoriteFlower: clientFormFlower.trim() || undefined,
          notes: clientFormNotes.trim() || undefined,
        });
    setSavingClient(false);
    if (res.success) {
      toast.success(editingClient ? "Cliente actualizado" : "Cliente registrado en el directorio");
      setClientModalOpen(false);
      setEditingClient(null);
      loadCRMData();
    } else {
      toast.error(res.error || "Error al guardar cliente");
    }
  };

  const handleCreateSpecialEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingEvent) return;
    if (!eventTitle.trim() || !eventDate) {
      toast.error("Ingresa el título y la fecha especial");
      return;
    }
    setSavingEvent(true);
    const res = await createSpecialEventAction({
      clientId: eventClientId || undefined,
      environment: "farfalina",
      title: eventTitle.trim(),
      eventType,
      eventDate,
      description: eventNotes.trim() || undefined,
    });
    setSavingEvent(false);
    if (res.success) {
      toast.success("Fecha especial agendada en el calendario");
      setEventModalOpen(false);
      setEventTitle("");
      setEventNotes("");
      setEventClientId("");
      loadCRMData();
    } else {
      toast.error(res.error || "Error al agendar fecha especial");
    }
  };

  const handleDeleteSpecialEvent = async (eventId: string) => {
    const ok = await confirm("¿Deseas eliminar este recordatorio / fecha especial?");
    if (!ok) return;
    const res = await deleteSpecialEventAction(eventId);
    if (res.success) {
      toast.success("Fecha especial eliminada");
      loadCRMData();
    } else {
      toast.error(res.error || "No se pudo eliminar la fecha especial");
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    const ok = await confirm("¿Deseas eliminar esta pieza de contenido / campaña?");
    if (!ok) return;
    const res = await deleteContentCampaignAction(campaignId);
    if (res.success) {
      toast.success("Pieza de contenido eliminada");
      if (selectedCampaign?.id === campaignId) setSelectedCampaign(null);
      loadCRMData();
    } else {
      toast.error(res.error || "Error al eliminar");
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    const ok = await confirm("¿Deseas eliminar este cliente del directorio?");
    if (!ok) return;
    const res = await deleteCRMClientAction(clientId);
    if (res.success) {
      toast.success("Cliente eliminado del directorio");
      loadCRMData();
    } else {
      toast.error(res.error || "Error al eliminar");
    }
  };

  // Calendar Helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // Helper to check if a specific day is in the selected campaign range (timezone-safe YYYY-MM-DD)
  const isDayInSelectedCampaign = (dayNum: number) => {
    if (!selectedCampaign) return false;
    const startYmd = extractCalendarDateStr(selectedCampaign.startDate);
    const endYmd = selectedCampaign.endDate ? extractCalendarDateStr(selectedCampaign.endDate) : startYmd;
    const checkYmd = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return checkYmd >= startYmd && checkYmd <= endYmd;
  };

  // Filtered Clients for Directory
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.favoriteFlower && c.favoriteFlower.toLowerCase().includes(q)) ||
        (c.notes && c.notes.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  // Filtered Campaigns for Marketing Hub
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const matchFunnel = selectedFunnelFilter === "Todos" || c.funnelStage === selectedFunnelFilter;
      const matchNetwork = selectedNetworkFilter === "Todas" || c.socialNetwork === selectedNetworkFilter;
      return matchFunnel && matchNetwork;
    });
  }, [campaigns, selectedFunnelFilter, selectedNetworkFilter]);

  // Metrics Summary
  const totalCampaignCost = campaigns.reduce((acc, c) => acc + (c.cost || 0), 0);
  const totalConversions = campaigns.reduce((acc, c) => acc + (c.conversionsCount || 0), 0);
  const totalViews = campaigns.reduce((acc, c) => acc + (c.viewsCount || 0), 0);
  const loyaltyQualifiedClientsCount = clients.filter((c) => c.purchaseCount >= loyaltyConfig.targetCount).length;

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-terracotta-100 text-terracotta-700 rounded-md">
              Módulo 5
            </span>
            <h2 className="break-words text-base sm:text-lg font-bold text-warm-900">CRM, Marketing & Calendario</h2>
          </div>
          <p className="break-words text-xs text-warm-500 mt-0.5">
            Calendario interactivo de contenidos, directorio con fidelización automática y gestión de campañas.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex min-w-0 items-center gap-1 bg-warm-100 p-1 rounded-xl border border-warm-200 overflow-x-auto max-w-full w-full md:w-auto">
          <button
            onClick={() => setCrmTab("calendar")}
            className={`min-h-11 shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              crmTab === "calendar" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>1. Calendario</span>
          </button>
          <button
            onClick={() => setCrmTab("directory")}
            className={`min-h-11 shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              crmTab === "directory" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>2. Directorio & Fidelización</span>
            {loyaltyQualifiedClientsCount > 0 && (
              <span className="h-4 w-4 rounded-full bg-amberGold-500 text-white text-[9px] font-bold flex items-center justify-center">
                {loyaltyQualifiedClientsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setCrmTab("campaigns")}
            className={`min-h-11 shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              crmTab === "campaigns" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
            }`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>3. Marketing & Contenidos</span>
            <span className="text-[10px] bg-warm-200 text-warm-700 px-1.5 py-0.2 rounded-md font-mono">
              {campaigns.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. CALENDARIO MENSUAL INTERACTIVO CON RESALTADO DE RANGO                   */}
      {/* ========================================================================= */}
      {crmTab === "calendar" && (
        <div className="space-y-4">
          {/* Top Bar with Add Campaign & Selected Indicator */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={prevMonth}
                  className="h-11 w-11 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl transition-colors inline-flex items-center justify-center"
                  title="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h3 className="font-bold text-sm sm:text-base text-warm-900 min-w-[140px] text-center">
                  {monthNames[month]} {year}
                </h3>
                <button
                  onClick={nextMonth}
                  className="h-11 w-11 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl transition-colors inline-flex items-center justify-center"
                  title="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <button
                onClick={goToToday}
                className="min-h-11 px-3 py-2 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-lg text-xs font-semibold"
              >
                Hoy
              </button>

              {/* Active Highlighting Alert if a Campaign is Clicked */}
              {selectedCampaign ? (
                <div
                  className="flex max-w-full flex-wrap items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-xs animate-in fade-in"
                  style={{
                    backgroundColor: `${selectedCampaign.color}15`,
                    borderColor: selectedCampaign.color,
                    color: selectedCampaign.color,
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="min-w-0 break-words">
                    Resaltando: "{selectedCampaign.title}" ({selectedCampaign.durationDays} {selectedCampaign.durationDays === 1 ? "día" : "días"})
                  </span>
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="h-11 w-11 shrink-0 text-warm-500 hover:text-warm-900 text-xs hover:bg-black/10 rounded inline-flex items-center justify-center"
                    title="Quitar resaltado"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <p className="text-xs text-warm-400 hidden sm:inline">
                  💡 Haz clic en cualquier campaña para resaltar en color todos los días que dura.
                </p>
              )}
            </div>

            {/* Action Buttons in Calendar Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setEventDate(getBoliviaDateStr());
                  setEventModalOpen(true);
                }}
                className="min-h-11 px-3.5 py-2 bg-pink-50 hover:bg-pink-100 text-pink-800 border border-pink-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              >
                <Gift className="h-4 w-4 text-pink-600" />
                <span>+ Fecha Especial</span>
              </button>
              <button
                onClick={() => {
                  setCampaignToEdit(null);
                  setCampaignModalOpen(true);
                }}
                className="min-h-11 max-w-full px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>+ Nueva Pieza de Contenido / Campaña</span>
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-warm-200 shadow-sm space-y-3">
            <div className="overflow-x-auto pb-2">
              <div className="min-w-[700px] space-y-2">
                {/* Days of week header */}
                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-warm-600">
                  {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map((day) => (
                    <div key={day} className="py-2 bg-warm-50 rounded-xl border border-warm-100">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Matrix */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Padding for empty slots */}
                  {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-32 bg-warm-50/30 rounded-2xl border border-dashed border-warm-200" />
                  ))}

                  {/* Month days */}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const cellYmd = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;

                    // Check if day is within selected campaign
                    const isHighlighted = isDayInSelectedCampaign(dayNum);

                    // Find events starting or happening this day
                    const dayEvents = events.filter((e) => extractCalendarDateStr(e.eventDate) === cellYmd);

                    // Find content campaigns active on this day
                    const dayCampaigns = campaigns.filter((c) => {
                      const startYmd = extractCalendarDateStr(c.startDate);
                      const endYmd = c.endDate ? extractCalendarDateStr(c.endDate) : startYmd;
                      return cellYmd >= startYmd && cellYmd <= endYmd;
                    });

                    const hasActivity = dayEvents.length > 0 || dayCampaigns.length > 0;

                    return (
                      <div
                        key={dayNum}
                        className={`h-36 p-2 rounded-2xl border transition-all flex flex-col justify-between overflow-hidden relative ${
                          isHighlighted
                            ? "ring-2 shadow-md"
                            : hasActivity
                            ? "bg-warm-50/40 border-warm-300"
                            : "bg-white border-warm-200 hover:border-warm-300"
                        }`}
                        style={{
                          ...(isHighlighted && selectedCampaign
                            ? {
                                backgroundColor: `${selectedCampaign.color}18`,
                                borderColor: selectedCampaign.color,
                                ringColor: selectedCampaign.color,
                              }
                            : {}),
                        }}
                      >
                        {/* Day Number Header */}
                        <div className="flex justify-between items-center z-10">
                          <span
                            className={`font-bold text-xs px-1.5 py-0.5 rounded-md ${
                              isHighlighted && selectedCampaign
                                ? "bg-warm-900 text-white font-mono"
                                : "text-warm-900"
                            }`}
                          >
                            {dayNum}
                          </span>

                          {hasActivity && (
                            <span className="text-[9px] font-bold text-warm-500 font-mono">
                              {dayCampaigns.length + dayEvents.length} items
                            </span>
                          )}
                        </div>

                        {/* List of items inside cell */}
                        <div className="space-y-1 overflow-y-auto flex-1 my-1 pr-0.5 z-10">
                          {/* Content Campaigns */}
                          {dayCampaigns.map((camp) => (
                            <button
                              key={camp.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCampaign(camp);
                              }}
                              style={{
                                borderLeftColor: camp.color,
                                backgroundColor: selectedCampaign?.id === camp.id ? `${camp.color}30` : "#FFFFFF",
                              }}
                              className="min-h-11 w-full text-left p-1.5 rounded-lg border border-warm-200 border-l-4 shadow-xs hover:shadow-sm text-[10px] block transition-all"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-warm-900 truncate flex-1 block">
                                  {camp.title}
                                </span>
                                <span
                                  className="text-[8px] font-bold px-1 py-0.2 rounded text-white shrink-0"
                                  style={{ backgroundColor: camp.color }}
                                >
                                  {camp.socialNetwork}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-warm-500">
                                <span>{camp.format}</span>
                                {camp.durationDays > 1 && <span>• {camp.durationDays}d</span>}
                              </div>
                            </button>
                          ))}

                          {/* Special Events / Anniversaries */}
                          {dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              className="w-full p-1.5 rounded-lg bg-pink-50/80 border border-pink-200 text-[10px] flex items-center justify-between gap-1 hover:bg-pink-100 transition-colors"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  ev.client?.phone
                                    ? handleSendWhatsAppReminder(ev.client.phone, ev.client.name, ev.title)
                                    : toast.info(`Evento: ${ev.title}`)
                                }
                                className="text-left min-w-0 flex-1"
                              >
                                <span className="text-[9px] font-bold text-pink-700 block truncate">
                                  🎂 {ev.title}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSpecialEvent(ev.id);
                                }}
                                className="text-pink-400 hover:text-rose-600 p-0.5 rounded shrink-0"
                                title="Eliminar fecha especial"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected Campaign Detailed Card */}
            {selectedCampaign && (
              <div
                className="p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-bottom duration-200"
                style={{
                  backgroundColor: `${selectedCampaign.color}10`,
                  borderColor: selectedCampaign.color,
                }}
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-xs"
                      style={{ backgroundColor: selectedCampaign.color }}
                    >
                      {selectedCampaign.socialNetwork} • {selectedCampaign.format}
                    </span>
                    <span className="text-xs font-bold text-warm-700 bg-white px-2 py-0.5 rounded-lg border border-warm-200">
                      Funnel: {selectedCampaign.funnelStage}
                    </span>
                    <span className="text-xs font-bold text-warm-700 bg-white px-2 py-0.5 rounded-lg border border-warm-200">
                      Estado: {selectedCampaign.status}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm sm:text-base text-warm-900">
                    {selectedCampaign.title}
                  </h4>

                  {selectedCampaign.summary && (
                    <p className="text-xs text-warm-600 line-clamp-2">
                      {selectedCampaign.summary}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs font-semibold text-warm-700 flex-wrap pt-1">
                    <span>
                      📅 Duración: {formatDateBolivia(selectedCampaign.startDate)} al{" "}
                      {selectedCampaign.endDate ? formatDateBolivia(selectedCampaign.endDate) : formatDateBolivia(selectedCampaign.startDate)} (
                      {selectedCampaign.durationDays} días activos)
                    </span>
                    <span>👤 Responsable: {selectedCampaign.responsible}</span>
                    {selectedCampaign.cost ? (
                      <span className="text-emerald-700">💰 Inversión Ads: {formatCurrency(selectedCampaign.cost)}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setCampaignToEdit(selectedCampaign);
                      setCampaignModalOpen(true);
                    }}
                    className="min-h-11 px-3.5 py-2 bg-white hover:bg-warm-100 text-warm-800 border border-warm-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Editar / Resultados</span>
                  </button>

                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="min-h-11 px-3 py-2 bg-warm-200 hover:bg-warm-300 text-warm-800 rounded-xl text-xs font-bold"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DIRECTORIO DE CLIENTES & MOTOR DE FIDELIZACIÓN AUTOMÁTICO               */}
      {/* ========================================================================= */}
      {crmTab === "directory" && (
        <div className="space-y-4">
          {/* Top Bar: Loyalty Banner & Search */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl border border-warm-200 shadow-sm space-y-4">
            {/* Loyalty Configuration Summary Card */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-amberGold-50 via-warm-50 to-terracotta-50 rounded-2xl border border-amberGold-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="p-2.5 bg-amberGold-500 text-white rounded-2xl shadow-sm shrink-0">
                  <Award className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-sm text-warm-900">Programa de Fidelización Farfalina</h4>
                    <span className="text-[10px] font-bold bg-amberGold-200 text-amberGold-900 px-2 py-0.5 rounded-full">
                      Automático
                    </span>
                  </div>
                  <p className="break-words text-xs text-warm-700 mt-0.5">
                    Meta actual: <strong className="text-amberGold-900">{loyaltyConfig.targetCount} compras registradas</strong> → Beneficio: <strong className="text-terracotta-700">"{loyaltyConfig.rewardText}"</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setLoyaltyModalOpen(true)}
                className="min-h-11 px-3.5 py-2 bg-white hover:bg-warm-100 text-warm-800 border border-warm-300 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
              >
                <Settings className="h-3.5 w-3.5 text-terracotta-600" />
                <span>Modificar Meta</span>
              </button>
            </div>

            {/* Search Bar */}
            <div className="flex min-w-0 items-center justify-between gap-3 flex-wrap">
              <div className="relative min-w-0 flex-1">
                <Search className="h-4 w-4 text-warm-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Buscar por nombre, teléfono o flor favorita..."
                  className="min-h-11 w-full pl-9 pr-4 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-xs text-warm-900 focus:outline-none focus:border-terracotta-500"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-warm-600 flex-wrap">
                <span>Total Clientes: {clients.length}</span>
                {loyaltyQualifiedClientsCount > 0 && (
                  <span className="text-amberGold-800 bg-amberGold-100 px-2.5 py-1 rounded-lg border border-amberGold-200">
                    🎉 {loyaltyQualifiedClientsCount} con premio listo
                  </span>
                )}
                <button
                  type="button"
                  onClick={openNewClientModal}
                  className="min-h-11 px-3.5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Nuevo Cliente</span>
                </button>
              </div>
            </div>
          </div>

          {/* Clients Grid */}
          <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-warm-200 space-y-2">
                <Users className="h-8 w-8 text-warm-300 mx-auto" />
                <p className="text-xs font-bold text-warm-700">No se encontraron clientes</p>
                <p className="text-[11px] text-warm-400">
                  Las ventas en POS y los pedidos crearán y actualizarán a los clientes automáticamente.
                </p>
              </div>
            ) : (
              filteredClients.map((c) => {
                const isGoalReached = c.purchaseCount >= loyaltyConfig.targetCount;
                const progressPct = Math.min(100, Math.round((c.purchaseCount / loyaltyConfig.targetCount) * 100));

                return (
                  <div
                    key={c.id}
                    className={`min-w-0 bg-white rounded-2xl border p-4 space-y-3 transition-all ${
                      isGoalReached
                        ? "border-amberGold-300 shadow-md ring-1 ring-amberGold-300 bg-gradient-to-b from-amberGold-50/30 to-white"
                        : "border-warm-200 shadow-sm hover:border-warm-300"
                    }`}
                  >
                    {/* Client Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 shadow-xs ${
                            isGoalReached
                              ? "bg-amberGold-500 text-white"
                              : "bg-terracotta-100 text-terracotta-700"
                          }`}
                        >
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs sm:text-sm text-warm-900 break-words">{c.name}</h4>
                          <p className="text-[11px] text-warm-500 font-mono break-all">Tel: {c.phone}</p>
                        </div>
                      </div>

                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${
                          c.loyaltyTier === "Platino"
                            ? "bg-purple-100 text-purple-800"
                            : c.loyaltyTier === "Oro"
                            ? "bg-amberGold-100 text-amberGold-800"
                            : c.loyaltyTier === "Plata"
                            ? "bg-slate-100 text-slate-800"
                            : "bg-warm-100 text-warm-700"
                        }`}
                      >
                        Nivel {c.loyaltyTier}
                      </span>
                    </div>

                    {/* Stats: Compras & Gasto Acumulado */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-warm-50 rounded-xl text-center text-xs">
                      <div>
                        <span className="text-[10px] text-warm-500 block">Compras Totales</span>
                        <strong className="text-warm-900 font-mono font-bold text-xs">
                          {c.purchaseCount} {c.purchaseCount === 1 ? "compra" : "compras"}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-warm-500 block">Total Gastado</span>
                        <strong className="text-terracotta-700 font-mono font-bold text-xs">
                          {formatCurrency(c.totalSpent)}
                        </strong>
                      </div>
                    </div>

                    {/* Loyalty Progress Bar */}
                    <div className="space-y-1.5 p-2.5 rounded-xl border border-warm-200 bg-white">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-warm-700 flex items-center gap-1">
                          <Target className="h-3 w-3 text-terracotta-600" />
                          <span>Progreso Fidelización:</span>
                        </span>
                        <span className="font-mono font-bold text-warm-900">
                          {c.purchaseCount} / {loyaltyConfig.targetCount}
                        </span>
                      </div>

                      <div className="w-full bg-warm-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isGoalReached ? "bg-amberGold-500 animate-pulse" : "bg-terracotta-500"
                          }`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>

                      {/* Goal Reached Reward Alert */}
                      {isGoalReached ? (
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] font-bold text-amberGold-900">
                          <Sparkles className="h-3.5 w-3.5 text-amberGold-600 shrink-0" />
                          <span>¡Premio Listo! Le corresponde: {loyaltyConfig.rewardText}</span>
                        </div>
                      ) : (
                        <p className="text-[10px] text-warm-400">
                          Faltan {Math.max(0, loyaltyConfig.targetCount - c.purchaseCount)} compras para su premio.
                        </p>
                      )}
                    </div>

                    {/* Special Dates / Anniversaries */}
                    {c.events && c.events.length > 0 && (
                      <div className="p-2.5 bg-warm-50 rounded-xl space-y-1.5 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-warm-500 block">
                          Fechas Especiales:
                        </span>
                        {c.events.map((sd) => (
                          <div key={sd.id} className="flex min-w-0 flex-col gap-1 text-[11px] min-[420px]:flex-row min-[420px]:justify-between">
                            <span className="min-w-0 break-words text-warm-800 flex items-start gap-1">
                              <Gift className="h-3 w-3 shrink-0 text-terracotta-500" /> {sd.title}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-terracotta-700 font-semibold">
                                {formatDateBolivia(sd.eventDate)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSpecialEvent(sd.id)}
                                className="text-warm-400 hover:text-rose-600 p-0.5 rounded"
                                title="Eliminar fecha especial"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* WhatsApp, Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() =>
                          handleSendWhatsAppReminder(
                            c.phone,
                            c.name,
                            c.events?.[0]?.title || "tu próxima fecha especial"
                          )
                        }
                        className="min-h-11 flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>WhatsApp</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditClientModal(c)}
                        aria-label={`Editar cliente ${c.name}`}
                        className="h-11 w-11 shrink-0 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-xl transition-colors inline-flex items-center justify-center"
                        title="Editar datos o notas del cliente"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteClient(c.id)}
                        aria-label={`Eliminar cliente ${c.name}`}
                        className="h-11 w-11 shrink-0 hover:bg-red-50 text-warm-400 hover:text-red-600 rounded-xl transition-colors inline-flex items-center justify-center"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MARKETING & CONTENIDOS (CONTENT HUB & METRICS)                           */}
      {/* ========================================================================= */}
      {crmTab === "campaigns" && (
        <div className="space-y-4">
          {/* Metrics Summary Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-warm-500 uppercase tracking-wider block">
                Total Piezas / Campañas
              </span>
              <strong className="text-xl font-mono font-bold text-warm-900">{campaigns.length}</strong>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-warm-500 uppercase tracking-wider block">
                Inversión Total Ads
              </span>
              <strong className="text-xl font-mono font-bold text-emerald-700">
                {formatCurrency(totalCampaignCost)}
              </strong>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-warm-500 uppercase tracking-wider block">
                Alcance / Visualizaciones
              </span>
              <strong className="text-xl font-mono font-bold text-blue-700">
                {totalViews.toLocaleString()}
              </strong>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-warm-500 uppercase tracking-wider block">
                Conversiones / Ventas
              </span>
              <strong className="text-xl font-mono font-bold text-terracotta-700">
                {totalConversions} pedidos
              </strong>
            </div>
          </div>

          {/* Control Bar & Filters */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              {/* Funnel Stage Filter */}
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-warm-600">Funnel:</span>
                <select
                  value={selectedFunnelFilter}
                  onChange={(e) => setSelectedFunnelFilter(e.target.value)}
                  className="min-h-11 px-2.5 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-xs font-semibold text-warm-900 focus:outline-none"
                >
                  <option value="Todos">Todas las etapas</option>
                  <option value="Descubrimiento/Conciencia">Descubrimiento</option>
                  <option value="Consideración/Interés">Consideración</option>
                  <option value="Conversión/Acción">Conversión</option>
                  <option value="Fidelización">Fidelización</option>
                </select>
              </div>

              {/* Social Network Filter */}
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-warm-600">Red:</span>
                <select
                  value={selectedNetworkFilter}
                  onChange={(e) => setSelectedNetworkFilter(e.target.value)}
                  className="min-h-11 px-2.5 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-xs font-semibold text-warm-900 focus:outline-none"
                >
                  <option value="Todas">Todas las redes</option>
                  <option value="Instagram">Instagram</option>
                  <option value="TikTok">TikTok</option>
                  <option value="Facebook">Facebook</option>
                  <option value="WhatsApp">WhatsApp</option>
                  <option value="Otra">Otra</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                setCampaignToEdit(null);
                setCampaignModalOpen(true);
              }}
              className="min-h-11 max-w-full px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>+ Nueva Pieza de Contenido / Campaña</span>
            </button>
          </div>

          {/* Campaigns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.length === 0 ? (
              <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-warm-200 space-y-2">
                <Megaphone className="h-8 w-8 text-warm-300 mx-auto" />
                <p className="text-xs font-bold text-warm-700">No hay piezas de contenido registradas</p>
                <p className="text-[11px] text-warm-400">
                  Usa el botón superior para planificar historias, reels, posts, pauta o colaboraciones con influencers.
                </p>
              </div>
            ) : (
              filteredCampaigns.map((camp) => (
                <div
                  key={camp.id}
                  className="min-w-0 bg-white rounded-2xl border border-warm-200 shadow-sm p-4 space-y-3 hover:shadow-md transition-all flex flex-col justify-between"
                  style={{ borderTop: `4px solid ${camp.color}` }}
                >
                  <div className="space-y-2">
                    {/* Badges Header */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: camp.color }}
                        >
                          {camp.socialNetwork}
                        </span>
                        <span className="text-[10px] font-bold bg-warm-100 text-warm-800 px-2 py-0.5 rounded-md">
                          {camp.format}
                        </span>
                      </div>

                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          camp.status === "Publicado"
                            ? "bg-emerald-100 text-emerald-800"
                            : camp.status === "En Producción"
                            ? "bg-blue-100 text-blue-800"
                            : camp.status === "Concluido"
                            ? "bg-warm-100 text-warm-700"
                            : "bg-amberGold-100 text-amberGold-800"
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>

                    {/* Title & Summary */}
                    <h4 className="break-words font-bold text-xs sm:text-sm text-warm-900">{camp.title}</h4>
                    {camp.summary && (
                      <p className="text-xs text-warm-600 line-clamp-2">{camp.summary}</p>
                    )}

                    {/* Funnel & Responsible */}
                    <div className="p-2.5 bg-warm-50 rounded-xl space-y-1 text-xs text-warm-700">
                      <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                        <span className="text-warm-500">Etapa Funnel:</span>
                        <strong className="text-warm-900">{camp.funnelStage}</strong>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                        <span className="text-warm-500">Responsable:</span>
                        <strong className="text-warm-900">{camp.responsible}</strong>
                      </div>
                      <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                        <span className="text-warm-500">Duración:</span>
                        <strong className="text-warm-900">
                          {formatDateBolivia(camp.startDate)} ({camp.durationDays} {camp.durationDays === 1 ? "día" : "días"})
                        </strong>
                      </div>
                      {camp.cost ? (
                        <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 pt-0.5 border-t border-warm-200">
                          <span className="text-warm-500">Inversión Ads:</span>
                          <strong className="text-emerald-700 font-mono">{formatCurrency(camp.cost)}</strong>
                        </div>
                      ) : null}
                    </div>

                    {/* Metrics / Results a posteriori */}
                    {(camp.results || (camp.viewsCount && camp.viewsCount > 0) || (camp.conversionsCount && camp.conversionsCount > 0)) && (
                      <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-xs">
                        <span className="text-[10px] font-bold text-emerald-900 flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Resultados Obtenidos:</span>
                        </span>
                        <div className="flex flex-wrap justify-between gap-x-2 gap-y-1 text-[11px] font-semibold text-emerald-800">
                          <span>Alcance: {camp.viewsCount?.toLocaleString() || 0}</span>
                          <span>Ventas: {camp.conversionsCount || 0} pedidos</span>
                        </div>
                        {camp.results && (
                          <p className="text-[10px] text-emerald-700 italic line-clamp-2">"{camp.results}"</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions Buttons */}
                  <div className="pt-2 flex items-center justify-between border-t border-warm-100">
                    <button
                      onClick={() => {
                        setSelectedCampaign(camp);
                        setCrmTab("calendar");
                      }}
                      className="min-h-11 max-w-full text-xs font-bold text-terracotta-600 hover:text-terracotta-800 flex items-center gap-1"
                      title="Ver y resaltar en el calendario"
                    >
                      <CalendarIcon className="h-3.5 w-3.5" />
                      <span>Ver en Calendario</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setCampaignToEdit(camp);
                          setCampaignModalOpen(true);
                        }}
                        className="h-11 w-11 hover:bg-warm-100 text-warm-600 hover:text-warm-900 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="Editar pieza de contenido o registrar métricas"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(camp.id)}
                        className="h-11 w-11 hover:bg-red-50 text-warm-400 hover:text-red-600 rounded-lg transition-colors inline-flex items-center justify-center"
                        title="Eliminar pieza"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <ContentCampaignModal
        isOpen={campaignModalOpen}
        campaignToEdit={campaignToEdit}
        onClose={() => {
          setCampaignModalOpen(false);
          setCampaignToEdit(null);
        }}
        onSuccess={loadCRMData}
      />

      <LoyaltyConfigModal
        isOpen={loyaltyModalOpen}
        currentConfig={loyaltyConfig}
        onClose={() => setLoyaltyModalOpen(false)}
        onSuccess={(updated) => setLoyaltyConfig(updated)}
      />

      {clientModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-warm-900">
              {editingClient ? `Editar Cliente: ${editingClient.name}` : "Registrar Nuevo Cliente CRM"}
            </h3>
            <form onSubmit={handleSaveClient} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-warm-800 block">Nombre Completo *</label>
                <input
                  type="text"
                  value={clientFormName}
                  onChange={(e) => setClientFormName(e.target.value)}
                  placeholder="Ej: María Fernanda Quiroga"
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800 block">Teléfono / WhatsApp *</label>
                <input
                  type="text"
                  value={clientFormPhone}
                  onChange={(e) => setClientFormPhone(e.target.value)}
                  placeholder="Ej: 76543210"
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800 block">Flor / Estilo Favorito</label>
                <input
                  type="text"
                  value={clientFormFlower}
                  onChange={(e) => setClientFormFlower(e.target.value)}
                  placeholder="Ej: Tulipanes, Rosas pastel..."
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800 block">Notas / Preferencias</label>
                <textarea
                  rows={2}
                  value={clientFormNotes}
                  onChange={(e) => setClientFormNotes(e.target.value)}
                  placeholder="Preferencias de entrega, colores, alergias..."
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl resize-none"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClientModalOpen(false)}
                  disabled={savingClient}
                  className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingClient}
                  className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl font-bold shadow-warm disabled:opacity-50"
                >
                  {savingClient ? "Guardando..." : editingClient ? "Guardar Cambios" : "Registrar Cliente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {eventModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-bold text-base text-warm-900">Agendar Fecha Especial / Aniversario</h3>
            <form onSubmit={handleCreateSpecialEvent} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-warm-800 block">Título del Evento *</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="Ej: Aniversario de Bodas, Cumpleaños Mamá..."
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800 block">Categoría</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-semibold"
                  >
                    <option value="Aniversario">Aniversario</option>
                    <option value="Cumpleaños">Cumpleaños</option>
                    <option value="Día Especial">Día Especial</option>
                    <option value="Graduación">Graduación</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800 block">Fecha *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800 block">Vincular a Cliente (Opcional)</label>
                <select
                  value={eventClientId}
                  onChange={(e) => setEventClientId(e.target.value)}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl"
                >
                  <option value="">— Evento General / Sin cliente —</option>
                  {clients.map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name} ({cl.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800 block">Notas / Recordatorio</label>
                <input
                  type="text"
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Ej: Enviar catálogo 3 días antes por WhatsApp..."
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  disabled={savingEvent}
                  className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEvent}
                  className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl font-bold shadow-warm disabled:opacity-50"
                >
                  {savingEvent ? "Guardando..." : "Guardar Fecha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
