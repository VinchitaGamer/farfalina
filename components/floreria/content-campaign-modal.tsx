"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Megaphone,
  Calendar,
  Sparkles,
  DollarSign,
  TrendingUp,
  User,
  Share2,
  CheckCircle2,
  Clock,
  Layers,
  Palette,
  Loader2
} from "lucide-react";
import { createContentCampaignAction, updateContentCampaignAction, ContentCampaignInput } from "@/app/actions/crm";
import { toast } from "@/components/ui/toast";

export interface ContentCampaignItem {
  id: string;
  title: string;
  funnelStage: "Descubrimiento/Conciencia" | "Consideración/Interés" | "Conversión/Acción" | "Fidelización";
  socialNetwork: "Instagram" | "Facebook" | "TikTok" | "WhatsApp" | "Otra";
  format: "Post" | "Reel" | "Story" | "Live" | "Ads" | "Colaboración";
  summary?: string | null;
  cost?: number | null;
  results?: string | null;
  viewsCount?: number | null;
  conversionsCount?: number | null;
  startDate: string | Date;
  endDate?: string | Date;
  durationDays: number;
  responsible: string;
  color: string;
  status: "Planificado" | "En Producción" | "Publicado" | "Concluido";
  clientId?: string | null;
}

interface ContentCampaignModalProps {
  isOpen: boolean;
  campaignToEdit: ContentCampaignItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const COLOR_PALETTE = [
  { name: "Terracota", hex: "#E07A5F" },
  { name: "Azul Océano", hex: "#3B82F6" },
  { name: "Verde Esmeralda", hex: "#10B981" },
  { name: "Púrpura", hex: "#8B5CF6" },
  { name: "Rosa Farfalina", hex: "#EC4899" },
  { name: "Dorado Ámbar", hex: "#F59E0B" },
  { name: "Gris Pizarra", hex: "#64748B" },
];

export default function ContentCampaignModal({
  isOpen,
  campaignToEdit,
  onClose,
  onSuccess,
}: ContentCampaignModalProps) {
  const [title, setTitle] = useState("");
  const [funnelStage, setFunnelStage] = useState<ContentCampaignItem["funnelStage"]>("Descubrimiento/Conciencia");
  const [socialNetwork, setSocialNetwork] = useState<ContentCampaignItem["socialNetwork"]>("Instagram");
  const [format, setFormat] = useState<ContentCampaignItem["format"]>("Reel");
  const [summary, setSummary] = useState("");
  const [cost, setCost] = useState<number | string>("");
  const [results, setResults] = useState("");
  const [viewsCount, setViewsCount] = useState<number | string>("");
  const [conversionsCount, setConversionsCount] = useState<number | string>("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [durationDays, setDurationDays] = useState<number | string>(1);
  const [responsible, setResponsible] = useState("Farfalina Marketing");
  const [color, setColor] = useState("#E07A5F");
  const [status, setStatus] = useState<ContentCampaignItem["status"]>("Planificado");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (campaignToEdit) {
      setTitle(campaignToEdit.title);
      setFunnelStage(campaignToEdit.funnelStage);
      setSocialNetwork(campaignToEdit.socialNetwork);
      setFormat(campaignToEdit.format);
      setSummary(campaignToEdit.summary || "");
      setCost(campaignToEdit.cost ? campaignToEdit.cost : "");
      setResults(campaignToEdit.results || "");
      setViewsCount(campaignToEdit.viewsCount ? campaignToEdit.viewsCount : "");
      setConversionsCount(campaignToEdit.conversionsCount ? campaignToEdit.conversionsCount : "");
      const rawDate = typeof campaignToEdit.startDate === "string" 
        ? campaignToEdit.startDate.split("T")[0] 
        : new Date(campaignToEdit.startDate).toISOString().split("T")[0];
      setStartDate(rawDate);
      setDurationDays(campaignToEdit.durationDays || 1);
      setResponsible(campaignToEdit.responsible);
      setColor(campaignToEdit.color || "#E07A5F");
      setStatus(campaignToEdit.status);
    } else {
      setTitle("");
      setFunnelStage("Descubrimiento/Conciencia");
      setSocialNetwork("Instagram");
      setFormat("Reel");
      setSummary("");
      setCost("");
      setResults("");
      setViewsCount("");
      setConversionsCount("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setDurationDays(1);
      setResponsible("Farfalina Marketing");
      setColor("#E07A5F");
      setStatus("Planificado");
    }
  }, [campaignToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Ingresa el título o resumen de la pieza");
      return;
    }
    if (!responsible.trim()) {
      toast.error("Indica la persona o influencer responsable");
      return;
    }

    setLoading(true);

    const payload: ContentCampaignInput = {
      ...(campaignToEdit?.id ? { id: campaignToEdit.id } : {}),
      title: title.trim(),
      funnelStage,
      socialNetwork,
      format,
      summary: summary.trim() || undefined,
      cost: cost === "" ? 0 : Number(cost) || 0,
      results: results.trim() || undefined,
      viewsCount: viewsCount === "" ? 0 : Number(viewsCount) || 0,
      conversionsCount: conversionsCount === "" ? 0 : Number(conversionsCount) || 0,
      startDate,
      durationDays: Math.max(1, Number(durationDays) || 1),
      responsible: responsible.trim(),
      color,
      status,
    };


    const res = campaignToEdit?.id
      ? await updateContentCampaignAction(payload)
      : await createContentCampaignAction(payload);

    setLoading(false);

    if (res.success) {
      toast.success(campaignToEdit?.id ? "Pieza de contenido actualizada" : "Pieza de contenido programada con éxito");
      onSuccess();
      onClose();
    } else {
      toast.error(res.error || "Error al guardar pieza de contenido");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-warm-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-warm-50 border-b border-warm-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl text-white shadow-sm flex items-center justify-center"
              style={{ backgroundColor: color }}
            >
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-warm-900">
                {campaignToEdit ? "Editar Pieza de Contenido / Campaña" : "Nueva Pieza de Contenido / Campaña"}
              </h3>
              <p className="text-xs text-warm-500">
                Planificación de contenidos, pauta y colaboraciones con influencers.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-warm-200 text-warm-500 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Título / Idea Central */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-warm-800 flex items-center gap-1.5">
              <span>Título o Idea Central</span>
              <span className="text-terracotta-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Reel Unboxing Ramo Shimmer Queen con @LauraG"
              className="w-full px-3.5 py-2.5 bg-white border border-warm-300 rounded-xl text-xs sm:text-sm text-warm-900 focus:outline-none focus:border-terracotta-500"
              required
            />
          </div>

          {/* Variables: Tipo de Contenido / Funnel, Red Social, Formato */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1: Tipo de Contenido (Etapa del Funnel) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-terracotta-600" />
                <span>Etapa Funnel</span>
              </label>
              <select
                value={funnelStage}
                onChange={(e) => setFunnelStage(e.target.value as ContentCampaignItem["funnelStage"])}
                className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
              >
                <option value="Descubrimiento/Conciencia">1. Descubrimiento / Conciencia</option>
                <option value="Consideración/Interés">2. Consideración / Interés</option>
                <option value="Conversión/Acción">3. Conversión / Acción</option>
                <option value="Fidelización">4. Fidelización</option>
              </select>
            </div>

            {/* 2: Red Social */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <Share2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Red Social</span>
              </label>
              <select
                value={socialNetwork}
                onChange={(e) => setSocialNetwork(e.target.value as ContentCampaignItem["socialNetwork"])}
                className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
              >
                <option value="Instagram">Instagram</option>
                <option value="TikTok">TikTok</option>
                <option value="Facebook">Facebook</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Otra">Otra / General</option>
              </select>
            </div>

            {/* 3: Formato */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amberGold-600" />
                <span>Formato</span>
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as ContentCampaignItem["format"])}
                className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
              >
                <option value="Reel">Reel / TikTok</option>
                <option value="Story">Story / Historia</option>
                <option value="Post">Post / Carrusel</option>
                <option value="Ads">Ads / Pauta Pagada</option>
                <option value="Colaboración">Colaboración Influencer</option>
                <option value="Live">Live / Transmisión</option>
              </select>
            </div>
          </div>

          {/* 4: Resumen del Contenido / Guión / Copia */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-warm-800 flex items-center justify-between">
              <span>Resumen, Guión, Concepto o Copia</span>
              <span className="text-[10px] text-warm-400 font-normal">Opcional</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              placeholder="Detalle de la pieza: mensaje clave, gancho, llamada a la acción o código de descuento vinculado..."
              className="w-full px-3.5 py-2 bg-white border border-warm-300 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500 resize-none"
            />
          </div>

          {/* Fechas y Duración (7) & Responsable (8) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Fecha de Inicio */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-terracotta-600" />
                <span>Fecha de Inicio</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500"
                required
              />
            </div>

            {/* 7: Duración en Días */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-warm-600" />
                <span>Duración (Días)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="1"
                className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs font-bold text-warm-900 focus:outline-none focus:border-terracotta-500 font-mono"
              />
            </div>

            {/* 8: Responsable / Creador */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-warm-600" />
                <span>Responsable / Creador</span>
              </label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Ej: Lucía / @influencer"
                className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500"
                required
              />
            </div>
          </div>

          {/* 5: Costo Inversión & Estado & Color de Calendario */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 5: Costo / Inversión Ads */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                <span>Inversión / Ads (Bs)</span>
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs font-bold text-warm-900 focus:outline-none focus:border-terracotta-500 font-mono"
              />
            </div>

            {/* Estado */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-warm-600" />
                <span>Estado</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ContentCampaignItem["status"])}
                className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs font-semibold text-warm-900 focus:outline-none focus:border-terracotta-500"
              >
                <option value="Planificado">Planificado</option>
                <option value="En Producción">En Producción</option>
                <option value="Publicado">Publicado</option>
                <option value="Concluido">Concluido</option>
              </select>
            </div>

            {/* Color Distintivo en Calendario */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                <Palette className="h-3.5 w-3.5 text-terracotta-600" />
                <span>Color en Calendario</span>
              </label>
              <div className="flex items-center gap-1.5 pt-1">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      color === c.hex ? "ring-2 ring-warm-900 ring-offset-2 scale-110" : "opacity-80 hover:opacity-100"
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 6: Resultados / Métricas (Para llenar a posteriori) */}
          <div className="p-3.5 bg-warm-50 rounded-2xl border border-warm-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-warm-900 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <span>6. Resultados & Métricas (Llenar tras publicación)</span>
              </label>
              <span className="text-[10px] text-warm-500 font-medium">Editable en cualquier momento</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-warm-600 font-semibold">Visualizaciones / Alcance:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={viewsCount}
                  onChange={(e) => setViewsCount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Ej: 14500"
                  className="w-full px-3 py-1.5 bg-white border border-warm-300 rounded-lg text-xs font-bold text-warm-900 font-mono"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-warm-600 font-semibold">Conversiones / Ventas logradas:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={conversionsCount}
                  onChange={(e) => setConversionsCount(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Ej: 28 arreglos"
                  className="w-full px-3 py-1.5 bg-white border border-warm-300 rounded-lg text-xs font-bold text-warm-900 font-mono"
                />
              </div>
            </div>


            <textarea
              value={results}
              onChange={(e) => setResults(e.target.value)}
              rows={2}
              placeholder="Notas de rendimiento: comentarios destacados, retorno sobre la inversión (ROI), feedback de clientes..."
              className="w-full px-3 py-2 bg-white border border-warm-300 rounded-xl text-xs text-warm-900 focus:outline-none focus:border-terracotta-500 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{campaignToEdit ? "Guardar Cambios" : "Programar Pieza de Contenido"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
