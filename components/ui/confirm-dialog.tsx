"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, AlertCircle, HelpCircle } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default" | "warning";
}

type ConfirmFunction = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFunction | null>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({ description: "" });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const settle = useCallback((result: boolean) => {
    setIsOpen(false);
    const current = resolverRef.current;
    resolverRef.current = null;
    if (current) current(result);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        settle(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, settle]);

  const confirm = useCallback<ConfirmFunction>((opts) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    return new Promise<boolean>((resolve) => {
      if (typeof opts === "string") {
        setOptions({
          title: "Confirmar acción",
          description: opts,
          confirmText: "Confirmar",
          cancelText: "Cancelar",
          variant: opts.toLowerCase().includes("eliminar") ? "destructive" : "default",
        });
      } else {
        setOptions({
          title: opts.title || "Confirmar acción",
          description: opts.description,
          confirmText: opts.confirmText || "Confirmar",
          cancelText: opts.cancelText || "Cancelar",
          variant: opts.variant || (opts.description.toLowerCase().includes("eliminar") ? "destructive" : "default"),
        });
      }
      resolverRef.current = resolve;
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = () => settle(true);
  const handleCancel = () => settle(false);

  const isDestructive = options.variant === "destructive";
  const isWarning = options.variant === "warning";

  const dialogNode = isOpen ? (
    <div
      className="fixed inset-0 z-[105] print:hidden flex items-center justify-center bg-warm-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-warm-200 dark:border-warm-700 animate-in zoom-in-95 duration-200"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl flex-shrink-0 ${
              isDestructive
                ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50"
                : isWarning
                ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50"
                : "bg-terracotta-100 text-terracotta-600 dark:bg-terracotta-950/50"
            }`}
          >
            {isDestructive ? (
              <AlertTriangle className="w-6 h-6" />
            ) : isWarning ? (
              <AlertCircle className="w-6 h-6" />
            ) : (
              <HelpCircle className="w-6 h-6" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-warm-900 dark:text-warm-100">{options.title}</h3>
            <p className="mt-2 text-sm text-warm-600 dark:text-warm-300 whitespace-pre-line leading-relaxed">
              {options.description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-warm-700 hover:bg-warm-100 rounded-xl transition-colors dark:text-warm-300 dark:hover:bg-warm-800"
          >
            {options.cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-all focus:ring-2 focus:ring-offset-2 ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 shadow-rose-600/20"
                : isWarning
                ? "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500 shadow-amber-600/20"
                : "bg-terracotta-600 hover:bg-terracotta-700 focus:ring-terracotta-500 shadow-terracotta-600/20"
            }`}
          >
            {options.confirmText}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {mounted && dialogNode ? createPortal(dialogNode, document.body) : dialogNode}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    // Fallback if provider is not mounted
    return async (opts: ConfirmOptions | string) => {
      const msg = typeof opts === "string" ? opts : `${opts.title ? opts.title + "\n\n" : ""}${opts.description}`;
      return window.confirm(msg);
    };
  }
  return context;
}
