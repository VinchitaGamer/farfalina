"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { MessageSquareText, ExternalLink, Globe, Truck, Calculator, Sparkles, CheckCircle2 } from "lucide-react";
import { openMetaBusinessSuite, getMetaBusinessUrl } from "@/lib/meta-business";

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
  const metaUrl = getMetaBusinessUrl(environment);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Banner Card */}
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
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Meta Business Inbox
                </span>
                <span className="text-xs font-semibold text-warm-400">{brandName}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-warm-900 mt-1">
                Bandeja de Mensajes y Clientes
              </h1>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href="https://omnichannel.farfalina.tech"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 px-4 py-2.5 bg-warm-900 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation"
            >
              <Globe className="h-4 w-4 text-emerald-400" />
              <span>Abrir Omnicanal (Túnel Cloudflare)</span>
              <ExternalLink className="h-4 w-4 opacity-80" />
            </a>
            <button
              type="button"
              onClick={() => openMetaBusinessSuite(environment)}
              className={`min-h-11 px-5 py-2.5 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 touch-manipulation ${
                isTerra
                  ? "bg-terracotta-600 hover:bg-terracotta-700 shadow-terracotta-500/20"
                  : "bg-amberGold-600 hover:bg-amberGold-700 shadow-amberGold-500/20"
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>Abrir Meta Business Suite</span>
              <ExternalLink className="h-4 w-4 opacity-80" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-warm-50/80 rounded-2xl p-5 border border-warm-200/80 space-y-3">
            <h3 className="font-bold text-sm text-warm-900 flex items-center gap-2">
              <Globe className="h-4 w-4 text-emerald-600" />
              Túnel Cloudflare Omnicanal
            </h3>
            <p className="text-xs text-warm-600 leading-relaxed">
              El servidor local de WhatsApp (Baileys) y webhooks está expuesto de forma segura bajo el dominio{" "}
              <strong className="text-warm-900">https://omnichannel.farfalina.tech</strong> a través de Cloudflare Zero Trust Tunnel.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <a
                href="https://omnichannel.farfalina.tech"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1 font-bold"
              >
                <span>Acceder a omnichannel.farfalina.tech</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="bg-warm-50/80 rounded-2xl p-5 border border-warm-200/80 space-y-3">
            <h3 className="font-bold text-sm text-warm-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Gestión desde la Extensión Oficial
            </h3>
            <p className="text-xs text-warm-600 leading-relaxed">
              Los chats de <strong>WhatsApp, Instagram Direct y Facebook Messenger</strong> se atienden en vivo en Meta Business Suite con la barra acoplada de {brandName}, permitiendo crear pedidos y consultar stock al instante.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[11px] font-semibold text-warm-500">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Extensión sincronizada con el catálogo en la nube</span>
            </div>
          </div>
        </div>

        {/* Quick navigation shortcuts */}
        <div className="pt-4 border-t border-warm-100 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-warm-500">Accesos directos del sistema:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={environment === "farfalina" ? "/floreria/orders" : "/carissma/orders"}
              className="px-3.5 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5"
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Ver Pedidos</span>
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
      </div>
    </div>
  );
}
