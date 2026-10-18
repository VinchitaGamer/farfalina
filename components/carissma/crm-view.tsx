"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Calendar as CalendarIcon,
  Megaphone,
  Send,
  Plus,
  Sparkles,
  Search,
  Trash2,
  Phone,
  X
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  getCRMDataAction,
  createCRMClientAction,
  updateCRMClientAction,
  deleteCRMClientAction,
  createCRMSpecialEventAction,
  deleteCRMSpecialEventAction,
} from "@/app/actions/crm";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface CRMClientItem {
  id: string;
  name: string;
  phone: string;
  favoriteFlower?: string | null; // Reused for preferred dress color / style
  notes?: string | null;
  totalSpent: number;
  purchaseCount: number;
  loyaltyTier: string;
  lastPurchaseAt?: string | Date | null;
  events?: CRMSpecialEventItem[];
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

export default function CrmView() {
  const confirm = useConfirm();
  const [crmTab, setCrmTab] = useState<"calendar" | "directory" | "campaigns">("calendar");
  const [clients, setClients] = useState<CRMClientItem[]>([]);
  const [events, setEvents] = useState<CRMSpecialEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("Todos");

  // Modals
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [selectedClientForEvent, setSelectedClientForEvent] = useState<CRMClientItem | null>(null);

  // New Client Form
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newColorPref, setNewColorPref] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // New Event Form
  const [eventClientId, setEventClientId] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState("Quinceañera");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [eventDesc, setEventDesc] = useState("");

  useEffect(() => {
    loadCRMData();
  }, []);

  const loadCRMData = async () => {
    setLoading(true);
    const res = await getCRMDataAction();
    if (res.success && res.data) {
      const d = res.data as { clients?: CRMClientItem[]; events?: CRMSpecialEventItem[] };
      setClients(d.clients ?? []);
      setEvents(d.events ?? []);
    }
    setLoading(false);
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Nombre y teléfono requeridos");
      return;
    }

    const res = await createCRMClientAction({
      name: newName.trim(),
      phone: newPhone.trim(),
      favoriteFlower: newColorPref.trim() || undefined,
      notes: newNotes.trim() || undefined,
    });

    if (res.success) {
      toast.success("¡Clienta registrada con éxito!");
      setIsNewClientModalOpen(false);
      setNewName("");
      setNewPhone("");
      setNewColorPref("");
      setNewNotes("");
      loadCRMData();
    } else {
      toast.error(res.error || "Error al registrar clienta");
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventClientId) {
      toast.error("Completa el título y selecciona a la clienta");
      return;
    }

    const res = await createCRMSpecialEventAction({
      clientId: eventClientId,
      title: eventTitle.trim(),
      eventType,
      eventDate,
      description: eventDesc.trim() || undefined,
    });

    if (res.success) {
      toast.success("¡Evento especial agendado!");
      setIsNewEventModalOpen(false);
      setEventTitle("");
      setEventDesc("");
      loadCRMData();
    } else {
      toast.error(res.error || "Error al crear evento");
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    const ok = await confirm(`¿Eliminar clienta ${name}?`);
    if (!ok) return;
    const res = await deleteCRMClientAction(id);
    if (res.success) {
      toast.success("Clienta eliminada");
      loadCRMData();
    }
  };

  const handleDeleteEvent = async (id: string) => {
    const res = await deleteCRMSpecialEventAction(id);
    if (res.success) {
      toast.success("Evento eliminado");
      loadCRMData();
    }
  };

  const filteredClients = clients.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery);
    const matchesTier = tierFilter === "Todos" || c.loyaltyTier === tierFilter;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      {/* Header */}
      <div className="flex min-w-0 flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amberGold-100 text-amberGold-800 rounded-md">
              Módulo de Fidelización & CRM
            </span>
            <h2 className="break-words text-base sm:text-lg font-bold text-warm-900">CRM de Clientas & Fechas de Eventos</h2>
          </div>
          <p className="break-words text-xs text-warm-500 mt-0.5">
            Directorio de clientas, tallas, medidas, eventos especiales (bodas, galas) y recordatorios para prueba de vestido.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsNewEventModalOpen(true)}
            className="min-h-11 flex-1 sm:flex-none justify-center px-3 py-2 bg-warm-100 hover:bg-warm-200 text-xs font-bold text-warm-800 rounded-xl transition-colors flex items-center gap-1.5"
          >
            <CalendarIcon className="h-4 w-4 text-amberGold-600" />
            <span>Agendar Evento</span>
          </button>
          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="min-h-11 flex-1 sm:flex-none px-4 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white text-xs font-bold rounded-xl shadow-warm transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Clienta</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex max-w-full items-center gap-2 overflow-x-auto border-b border-warm-200 pb-2 text-xs font-bold">
        <button
          onClick={() => setCrmTab("directory")}
          className={`min-h-11 shrink-0 whitespace-nowrap px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            crmTab === "directory"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Directorio & Medidas ({clients.length})</span>
        </button>
        <button
          onClick={() => setCrmTab("calendar")}
          className={`min-h-11 shrink-0 whitespace-nowrap px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            crmTab === "calendar"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <CalendarIcon className="h-4 w-4" />
          <span>Eventos de Clientas ({events.length})</span>
        </button>
        <button
          onClick={() => setCrmTab("campaigns")}
          className={`min-h-11 shrink-0 whitespace-nowrap px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            crmTab === "campaigns"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <Megaphone className="h-4 w-4" />
          <span>Campañas & Promociones</span>
        </button>
      </div>

      {/* TAB 1: DIRECTORY */}
      {crmTab === "directory" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm flex min-w-0 flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-warm-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por nombre o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-h-11 w-full pl-9 pr-4 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-xs font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-bold text-warm-600">Nivel:</span>
              {["Todos", "Bronce", "Plata", "Oro", "Platino"].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setTierFilter(tier)}
                  className={`min-h-11 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    tierFilter === tier
                      ? "bg-amberGold-600 text-white"
                      : "bg-warm-100 text-warm-700 hover:bg-warm-200"
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <div key={client.id} className="min-w-0 bg-white rounded-2xl border border-warm-200 shadow-sm p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-amberGold-100 text-amberGold-800 text-[10px] font-bold rounded-md">
                      {client.loyaltyTier || "Bronce"}
                    </span>
                    <span className="text-[10px] text-warm-400">
                      {client.purchaseCount} alquiler(es)
                    </span>
                  </div>

                  <h3 className="break-words font-bold text-sm text-warm-900 mt-2">{client.name}</h3>
                  <p className="break-all text-[11px] text-warm-500 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3 shrink-0" /> {client.phone}
                  </p>

                  <div className="min-w-0 p-2.5 bg-warm-50 rounded-xl text-xs space-y-1 mt-3 border border-warm-100">
                    <div className="flex min-w-0 flex-col gap-0.5 min-[420px]:flex-row min-[420px]:justify-between">
                      <span className="text-warm-500">🎀 Estilo Preferido:</span>
                      <strong className="min-w-0 break-words text-warm-800">{client.favoriteFlower || "Sin especificar"}</strong>
                    </div>
                    <div className="flex min-w-0 flex-col gap-0.5 min-[420px]:flex-row min-[420px]:justify-between">
                      <span className="text-warm-500">Inversión Acumulada:</span>
                      <strong className="break-words text-emerald-700">{formatCurrency(client.totalSpent)}</strong>
                    </div>
                    {client.notes && (
                      <p className="break-words text-[10px] text-warm-600 pt-1 border-t border-warm-200">
                        {client.notes}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-warm-100 flex items-center justify-between">
                  <a
                    href={`https://wa.me/${client.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-11 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Send className="h-3 w-3" />
                    <span>WhatsApp</span>
                  </a>
                  <button
                    onClick={() => handleDeleteClient(client.id, client.name)}
                    aria-label={`Eliminar clienta ${client.name}`}
                    className="h-11 w-11 text-warm-400 hover:text-rose-600 rounded-lg inline-flex items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: EVENTS CALENDAR */}
      {crmTab === "calendar" && (
        <div className="space-y-4">
          <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {events.map((event) => (
              <div key={event.id} className="min-w-0 bg-white rounded-2xl border border-warm-200 shadow-sm p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded-md">
                    {event.eventType}
                  </span>
                  <span className="text-[11px] font-bold text-warm-600">
                    {new Date(event.eventDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="min-w-0 space-y-1">
                  <h4 className="break-words font-bold text-sm text-warm-900">{event.title}</h4>
                  <p className="break-words text-xs text-warm-600 font-medium">Clienta: {event.client?.name || "No asignada"}</p>
                </div>

                {event.description && (
                  <p className="break-words text-[11px] text-warm-500 bg-warm-50 p-2 rounded-lg">
                    {event.description}
                  </p>
                )}

                <div className="pt-2 border-t border-warm-100 flex items-center justify-between">
                  {event.client?.phone && (
                    <a
                      href={`https://wa.me/${event.client.phone.replace(/\D/g, "")}?text=${encodeURIComponent("¡Hola " + event.client.name + "! En Carissma tenemos los vestidos perfectos listos para tu evento: " + event.title + ". ¿Te gustaría agendar una prueba de vestuario?")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-11 px-3 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-warm"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Ofrecer Vestido</span>
                    </a>
                  )}
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    aria-label={`Eliminar evento ${event.title}`}
                    className="h-11 w-11 shrink-0 text-warm-400 hover:text-rose-600 rounded-lg inline-flex items-center justify-center"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CAMPAIGNS */}
      {crmTab === "campaigns" && (
        <div className="bg-white p-6 rounded-3xl border border-warm-200 shadow-sm space-y-4 text-xs">
          <h3 className="font-bold text-sm text-warm-900">Plantillas de Difusión & Campañas Carissma</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-warm-50 rounded-2xl border border-warm-200 space-y-2">
              <p className="font-bold text-warm-900">👗 Nueva Colección de Gala & Fiesta</p>
              <p className="text-warm-600 text-[11px]">
                "¡Hola! Te invitamos a conocer la nueva colección de vestidos de alta costura recién llegados a Carissma. Agenda tu cita en nuestro probador exclusivo."
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("¡Hola! Te invitamos a conocer la nueva colección de vestidos de alta costura recién llegados a Carissma. Agenda tu cita en nuestro probador exclusivo.");
                  toast.success("Plantilla copiada al portapapeles");
                }}
                className="min-h-11 px-3 py-2 bg-white border border-warm-300 rounded-xl font-bold text-warm-800 hover:bg-warm-100 transition-colors"
              >
                Copiar Mensaje
              </button>
            </div>

            <div className="p-4 bg-warm-50 rounded-2xl border border-warm-200 space-y-2">
              <p className="font-bold text-warm-900">✨ Descuento VIP Clienta Frecuente</p>
              <p className="text-warm-600 text-[11px]">
                "¡Hola querida clienta! Por ser parte de nuestro club VIP Carissma, tienes un 15% de descuento en el alquiler de tu próximo vestido de gala."
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("¡Hola querida clienta! Por ser parte de nuestro club VIP Carissma, tienes un 15% de descuento en el alquiler de tu próximo vestido de gala.");
                  toast.success("Plantilla copiada al portapapeles");
                }}
                className="min-h-11 px-3 py-2 bg-white border border-warm-300 rounded-xl font-bold text-warm-800 hover:bg-warm-100 transition-colors"
              >
                Copiar Mensaje
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto bg-white rounded-3xl border border-warm-200 shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Registrar Nueva Clienta</h3>
              <button onClick={() => setIsNewClientModalOpen(false)} aria-label="Cerrar modal" className="h-11 w-11 inline-flex shrink-0 items-center justify-center">
                <X className="h-5 w-5 text-warm-400" />
              </button>
            </div>
            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-warm-800">Nombre Completo *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-warm-800">Teléfono / WhatsApp *</label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-warm-800">Talla / Estilo Preferido</label>
                <input
                  type="text"
                  value={newColorPref}
                  onChange={(e) => setNewColorPref(e.target.value)}
                  placeholder="Ej: Talla M, Gala largo, Colores pasteles"
                  className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                />
              </div>
              <div>
                <label className="font-bold text-warm-800">Medidas & Notas (Busto, Cintura, Cadera)</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="ej: Talla M, Busto: 90, Cintura: 70, Cadera: 98..."
                  rows={2}
                  className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="min-h-11 px-4 py-2 bg-warm-100 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-11 px-5 py-2 bg-amberGold-600 text-white rounded-xl font-bold shadow-warm"
                >
                  Guardar Clienta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Event Modal */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" role="dialog" aria-modal="true">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto bg-white rounded-3xl border border-warm-200 shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Agendar Evento Especial</h3>
              <button onClick={() => setIsNewEventModalOpen(false)} aria-label="Cerrar modal" className="h-11 w-11 inline-flex shrink-0 items-center justify-center">
                <X className="h-5 w-5 text-warm-400" />
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-warm-800">Clienta *</label>
                <select
                  value={eventClientId}
                  onChange={(e) => setEventClientId(e.target.value)}
                  className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                  required
                >
                  <option value="">-- Seleccionar clienta --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-warm-800">Nombre del Evento *</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="ej: Graduación de Valeria"
                  className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-warm-800">Tipo de Evento</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                  >
                    <option value="Quinceañera">Quinceañera</option>
                    <option value="Boda">Boda</option>
                    <option value="Graduación">Graduación</option>
                    <option value="Aniversario">Aniversario</option>
                    <option value="Cumpleaños">Cumpleaños</option>
                    <option value="Evento Estacional">Evento Estacional</option>
                    <option value="Campaña Marketing">Campaña Marketing</option>
                    <option value="Gala / Coctel">Gala / Coctel</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-warm-800">Fecha del Evento *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="font-bold text-warm-800">Descripción / Notas</label>
                <textarea
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  rows={2}
                  className="min-h-11 w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base md:text-sm text-warm-900"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setIsNewEventModalOpen(false)}
                  className="min-h-11 px-4 py-2 bg-warm-100 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-11 px-5 py-2 bg-amberGold-600 text-white rounded-xl font-bold shadow-warm"
                >
                  Agendar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
