"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquareText,
  ExternalLink,
  Globe,
  Truck,
  Calculator,
  ShoppingBag,
  CheckCircle2,
  Save,
  RotateCcw,
  Tablet,
  SlidersHorizontal
} from "lucide-react";
import {
  openMetaBusinessSuite,
  getMetaBusinessUrl,
  saveMetaBusinessUrl,
  META_BUSINESS_FARFALINA_DEFAULT,
} from "@/lib/meta-business";
import { toast } from "@/components/ui/toast";

interface OmnichannelRedirectViewProps {
  environment: "farfalina" | "carissma";
  brandName: string;
  accentColor: "terracotta" | "amberGold";
}

export default function OmnichannelRedirectView({
  environment,
  brandName,
  accentColor,
}: OmnichannelRedirectViewProps) {
  const isTerra = accentColor === "terracotta";
  const [customUrl, setCustomUrl] = useState(META_BUSINESS_FARFALINA_DEFAULT);

  useEffect(() => {
    setCustomUrl(getMetaBusinessUrl(environment));
  }, [environment]);

  const handleSaveCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = saveMetaBusinessUrl(environment, customUrl);
    if (!ok) {
      toast.error("El enlace debe comenzar con https://business.facebook.com");
      return;
    }
    const updated = getMetaBusinessUrl(environment);
    setCustomUrl(updated);
    toast.success(`Enlace directo de Meta Business guardado para ${brandName}`);
  };

  const handleResetUrl = () => {
    saveMetaBusinessUrl(environment, "");
    const resetVal = getMetaBusinessUrl(environment);
    setCustomUrl(resetVal);
    toast.success("Enlace restaurado a la bandeja general de Meta Business Suite");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Main Hub Card */}
      <div className="bg-white rounded-3xl border border-warm-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-warm-100">
          <div className="flex items-center gap-4">
            <div
              className={`p-3.5 rounded-2xl ${
                isTerra ? "bg-terracotta-100 text-terracotta-700" : "bg-amberGold-100 text-amberGold-700"
              }`}
            >
              <MessageSquareText className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  100% Web · Laptop & Tablet
                </span>
                <span className="text-xs font-semibold text-warm-400">{brandName}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-warm-900 mt-1">
                Bandeja de Mensajes & Redes Sociales
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openMetaBusinessSuite(environment)}
            className={`min-h-12 px-6 py-3 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation ${
              isTerra
                ? "bg-terracotta-600 hover:bg-terracotta-700 shadow-terracotta-500/20"
                : "bg-amberGold-600 hover:bg-amberGold-700 shadow-amberGold-500/20"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Abrir Meta Business Suite</span>
            <ExternalLink className="h-4 w-4 opacity-85" />
          </button>
        </div>

        {/* Web-first guidance cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-warm-50/80 rounded-2xl p-5 border border-warm-200/80 space-y-2.5">
            <h3 className="font-bold text-sm text-warm-900 flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-emerald-600" />
              WhatsApp, Instagram & Messenger Oficial
            </h3>
            <p className="text-xs text-warm-600 leading-relaxed">
              Atiende tus conversaciones directamente desde tu cuenta oficial en{" "}
              <strong className="text-warm-900">Meta Business Suite</strong> (se abre en una pestaña limpia usando tu propia sesión iniciada, sin errores de permisos ni cuentas ajenas).
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Sin instalaciones ni extensiones obligatorias</span>
            </div>
          </div>

          <div className="bg-warm-50/80 rounded-2xl p-5 border border-warm-200/80 space-y-2.5">
            <h3 className="font-bold text-sm text-warm-900 flex items-center gap-2">
              <Tablet className="h-4 w-4 text-terracotta-600" />
              Compatible con Tablet y Laptop
            </h3>
            <p className="text-xs text-warm-600 leading-relaxed">
              Trabaja con el sistema web de <strong>{brandName}</strong> y tu bandeja de Meta en pestañas paralelas o pantalla dividida. Crea pedidos, copia el resumen de delivery para WhatsApp y revisa stock al instante desde cualquier dispositivo.
            </p>
            <div className="pt-1 flex items-center gap-2 text-[11px] font-semibold text-warm-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Acceso 100% desde el navegador</span>
            </div>
          </div>
        </div>

        {/* Editable direct Meta Business link for this brand */}
        <form onSubmit={handleSaveCustomUrl} className="p-4 sm:p-5 bg-warm-50 rounded-2xl border border-warm-200 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-bold text-xs text-warm-900">
                Enlace Directo de Meta Business Suite para {brandName} (Opcional)
              </h3>
              <p className="text-[11px] text-warm-500">
                Por defecto abre tu bandeja general (<span className="font-mono">business.facebook.com/latest/inbox/all</span>). Si deseas ir directo a una página específica, pega aquí tu enlace de Meta Business Suite.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://business.facebook.com/latest/inbox/all"
              className="flex-1 px-3 py-2.5 bg-white border border-warm-200 rounded-xl text-xs font-mono text-warm-900 focus:outline-none focus:ring-2 focus:ring-terracotta-500"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="min-h-10 px-4 py-2 bg-warm-900 hover:bg-black text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Guardar</span>
              </button>
              <button
                type="button"
                onClick={handleResetUrl}
                className="min-h-10 px-3 py-2 bg-white hover:bg-warm-100 text-warm-700 border border-warm-200 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-colors"
                title="Restaurar enlace predeterminado"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restaurar</span>
              </button>
            </div>
          </div>
        </form>

        {/* Quick navigation shortcuts */}
        <div className="pt-4 border-t border-warm-100 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-warm-500">Accesos rápidos del sistema:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={environment === "farfalina" ? "/floreria/catalog" : "/carissma/catalog"}
              className="px-3.5 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Catálogo</span>
            </Link>
            <Link
              href={environment === "farfalina" ? "/floreria/orders" : "/carissma/orders"}
              className="px-3.5 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <Truck className="h-3.5 w-3.5" />
              <span>{environment === "farfalina" ? "Ver Pedidos" : "Ver Rentas"}</span>
            </Link>
            <Link
              href={environment === "farfalina" ? "/floreria/pos" : "/carissma/pos"}
              className="px-3.5 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Abrir POS</span>
            </Link>
          </div>
        </div>

        {/* Discreet Advanced Option */}
        <details className="pt-2 border-t border-warm-100 text-xs text-warm-500">
          <summary className="cursor-pointer font-semibold text-warm-500 hover:text-warm-800 inline-flex items-center gap-1.5 select-none">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Opciones técnicas avanzadas (túnel local opcional)</span>
          </summary>
          <div className="mt-3 p-3.5 bg-warm-50 rounded-xl border border-warm-200 space-y-2">
            <p className="text-[11px] text-warm-600">
              Si en algún momento activas el servidor puente local de mensajería (Cloudflare Tunnel), puedes abrirlo desde el enlace técnico:
            </p>
            <a
              href="https://omnichannel.farfalina.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-warm-800 hover:underline"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>https://omnichannel.farfalina.tech</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </details>
      </div>
    </div>
  );
}
