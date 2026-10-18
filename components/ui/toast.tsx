"use client";

import React from "react";
import { useToastStore, toast } from "@/store/toast-store";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";

export { toast };

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-5 right-3 sm:right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200 ${
            t.type === "success"
              ? "bg-emerald-900 text-emerald-100 border-emerald-700"
              : t.type === "error"
              ? "bg-rose-900 text-rose-100 border-rose-700"
              : "bg-warm-900 text-warm-100 border-warm-700"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {t.type === "success" && <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />}
            {t.type === "error" && <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />}
            {t.type === "info" && <Info className="h-5 w-5 text-warm-400 shrink-0" />}
            <span className="text-xs font-semibold leading-snug">{t.message}</span>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white active:scale-95 touch-manipulation"
            aria-label="Cerrar notificación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
