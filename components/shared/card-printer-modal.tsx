"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "@/store/app-store";
import {
  Printer,
  X,
  CheckCircle2,
  Heart
} from "lucide-react";

export default function CardPrinterModal() {
  const [mounted, setMounted] = useState(false);
  const { cardPrinterModalOpen, activeCardText, closeCardPrinter } = useAppStore();
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!cardPrinterModalOpen || !activeCardText || !mounted) return null;

  const handlePrint = () => {
    window.print();
    setPrinted(true);
    setTimeout(() => {
      setPrinted(false);
      closeCardPrinter();
    }, 2000);
  };

  return createPortal(
    <div id="printable-modal-portal">
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200 print:p-0 print:bg-white print:static" role="dialog" aria-modal="true">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-warm-200 shadow-2xl overflow-hidden print:border-none print:shadow-none">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-warm-50 border-b border-warm-200 print:hidden">
            <div className="flex items-center gap-2 text-terracotta-700">
              <Printer className="h-5 w-5 text-terracotta-600" />
              <h3 className="font-bold text-sm text-warm-900">Módulo de Impresión de Tarjetas Dedicatorias</h3>
            </div>
            <button
              onClick={closeCardPrinter}
              className="p-1 text-warm-400 hover:text-warm-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Card Content & Interactive Visual Preview */}
          <div className="p-6 space-y-5 print:p-0">
            <p className="text-xs text-warm-600 print:hidden">
              Vista previa del formato físico de la tarjeta dedicatoria que se imprimirá junto con el arreglo floral.
            </p>

            {/* Physical Card Simulation Frame */}
            <div id="printable-card-sheet" className="relative p-6 rounded-xl bg-gradient-to-br from-terracotta-50 via-warm-50 to-amberGold-50 border-2 border-dashed border-terracotta-300 shadow-inner flex flex-col justify-between min-h-[220px]">
            {/* Floral Decorative Corners */}
            <div className="absolute top-2 left-2 text-terracotta-400 opacity-60">
              <Heart className="h-4 w-4 fill-current" />
            </div>
            <div className="absolute bottom-2 right-2 text-terracotta-400 opacity-60">
              <Heart className="h-4 w-4 fill-current" />
            </div>

            <div className="text-center space-y-1 pt-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-terracotta-600">
                Florería Farfalina • Con Cariño
              </span>
              <h4 className="text-sm font-semibold text-warm-800">
                Para: <span className="font-bold text-terracotta-700">{activeCardText.recipient}</span>
              </h4>
            </div>

            <div className="py-4 text-center px-4">
              <p className="italic text-xs text-warm-800 leading-relaxed font-serif text-slate-700">
                &ldquo;{activeCardText.message}&rdquo;
              </p>
            </div>

            <div className="flex justify-between items-center text-[10px] text-warm-500 pt-2 border-t border-terracotta-200/60">
              <span>De: <strong>{activeCardText.client}</strong></span>
              <span>{activeCardText.date}</span>
            </div>
          </div>

          {/* Status Alert */}
          {printed && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>¡Tarjeta enviada exitosamente a la impresora de etiquetado!</span>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-warm-50 border-t border-warm-200">
          <span className="text-xs text-warm-500 font-mono">Impresora: Thermal POS Card #02</span>
          <div className="flex items-center gap-2">
            <button
              onClick={closeCardPrinter}
              className="px-4 py-2 bg-white border border-warm-300 text-warm-700 hover:bg-warm-100 rounded-xl text-xs font-semibold transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handlePrint}
              disabled={printed}
              className="px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-semibold shadow-warm transition-all flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              {printed ? "Imprimiendo..." : "Imprimir Ahora"}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>,
  document.body
);
}
