"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  X,
  CheckCircle2,
  Package,
  Truck,
  DollarSign,
  Users,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  Clock
} from "lucide-react";
import { useAppStore } from "@/store/app-store";
import { getSystemNotificationsAction, SystemNotification } from "@/app/actions/notifications";
import { cn } from "@/lib/utils";

export default function NotificationCenter() {
  const router = useRouter();
  const {
    notificationDrawerOpen,
    setNotificationDrawerOpen,
    dismissedNotificationIds,
    dismissNotification,
    clearDismissedNotifications,
    navigateToInventoryStock,
    navigateToTodayAgenda,
    navigateToCashRegister,
    navigateToCRM,
    navigateToOmnichannel,
  } = useAppStore();

  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "inventory" | "logistics" | "register" | "crm" | "omnichannel">("all");

  useEffect(() => {
    loadNotifications();
    // Auto refresh every 45 seconds
    const timer = setInterval(() => {
      loadNotifications();
    }, 45000);
    return () => clearInterval(timer);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    const res = await getSystemNotificationsAction();
    if (res.success && Array.isArray(res.data)) {
      setNotifications(res.data);
    }
    setLoading(false);
  };

  const activeNotifications = notifications.filter(
    (n) => !dismissedNotificationIds.includes(n.id)
  );

  const filteredNotifications = activeNotifications.filter((n) => {
    if (activeFilter === "all") return true;
    return n.category === activeFilter;
  });

  const handleActionClick = (n: SystemNotification) => {
    if (n.category === "inventory") {
      navigateToInventoryStock(n.targetSearch || "");
      router.push(`/floreria/pos?tab=stock${n.targetSearch ? `&search=${n.targetSearch}` : ""}`);
    } else if (n.category === "logistics") {
      navigateToTodayAgenda();
      router.push("/floreria/orders");
    } else if (n.category === "register") {
      navigateToCashRegister();
      router.push("/floreria/accounting");
    } else if (n.category === "crm") {
      navigateToCRM();
      router.push("/floreria/crm");
    } else if (n.category === "omnichannel") {
      navigateToOmnichannel();
      router.push("/floreria/omnichannel");
    }
    setNotificationDrawerOpen(false);
  };

  if (!notificationDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        onClick={() => setNotificationDrawerOpen(false)}
        className="fixed inset-0 bg-warm-950/50 backdrop-blur-xs transition-opacity animate-in fade-in"
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-md bg-white h-[100dvh] pb-safe shadow-2xl z-10 flex flex-col justify-between animate-in slide-in-from-right duration-200 border-l border-warm-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-warm-200 bg-warm-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-terracotta-100 text-terracotta-700 rounded-xl relative">
              <Bell className="h-5 w-5" />
              {activeNotifications.length > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-terracotta-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                  {activeNotifications.length}
                </span>
              )}
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base text-warm-900 leading-tight">
                Centro de Notificaciones
              </h2>
              <p className="text-xs text-warm-500">
                {activeNotifications.length === 0
                  ? "Todo al día en el sistema"
                  : `${activeNotifications.length} alerta(s) y avisos pendientes`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={loadNotifications}
              disabled={loading}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-warm-500 hover:text-warm-900 rounded-lg hover:bg-warm-100 transition-colors active:scale-95 touch-manipulation"
              title="Actualizar alertas"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin text-terracotta-600")} />
            </button>
            <button
              onClick={() => setNotificationDrawerOpen(false)}
              className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-warm-400 hover:text-warm-700 rounded-lg hover:bg-warm-100 transition-colors active:scale-95 touch-manipulation"
              aria-label="Cerrar notificaciones"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="px-3 py-2 border-b border-warm-200 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "min-h-[44px] px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 active:scale-95 touch-manipulation flex items-center justify-center",
              activeFilter === "all"
                ? "bg-terracotta-500 text-white shadow-sm"
                : "bg-warm-100 text-warm-700 hover:bg-warm-200"
            )}
          >
            Todas ({activeNotifications.length})
          </button>
          <button
            onClick={() => setActiveFilter("inventory")}
            className={cn(
              "min-h-[44px] px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 active:scale-95 touch-manipulation flex items-center gap-1.5",
              activeFilter === "inventory"
                ? "bg-terracotta-500 text-white shadow-sm"
                : "bg-warm-100 text-warm-700 hover:bg-warm-200"
            )}
          >
            <Package className="h-3.5 w-3.5 shrink-0" />
            <span>Stock & Insumos</span>
          </button>
          <button
            onClick={() => setActiveFilter("logistics")}
            className={cn(
              "min-h-[44px] px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 active:scale-95 touch-manipulation flex items-center gap-1.5",
              activeFilter === "logistics"
                ? "bg-terracotta-500 text-white shadow-sm"
                : "bg-warm-100 text-warm-700 hover:bg-warm-200"
            )}
          >
            <Truck className="h-3.5 w-3.5 shrink-0" />
            <span>Agenda de Hoy</span>
          </button>
          <button
            onClick={() => setActiveFilter("register")}
            className={cn(
              "min-h-[44px] px-3 py-2 rounded-lg transition-all whitespace-nowrap shrink-0 active:scale-95 touch-manipulation flex items-center gap-1.5",
              activeFilter === "register"
                ? "bg-terracotta-500 text-white shadow-sm"
                : "bg-warm-100 text-warm-700 hover:bg-warm-200"
            )}
          >
            <DollarSign className="h-3.5 w-3.5 shrink-0" />
            <span>Caja</span>
          </button>
          <div className="w-1 shrink-0" aria-hidden="true" />
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center space-y-3 text-warm-400">
              <div className="h-12 w-12 rounded-full bg-warm-100 flex items-center justify-center mx-auto text-warm-400">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-warm-800">No hay alertas activas</p>
                <p className="text-[11px] text-warm-500 mt-0.5">
                  El inventario, las entregas y la caja se encuentran al día.
                </p>
              </div>
            </div>
          ) : (
            filteredNotifications.map((n) => {
              const isCritical = n.severity === "critical";
              const isWarning = n.severity === "warning";

              return (
                <div
                  key={n.id}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all text-left space-y-2.5 group relative",
                    isCritical
                      ? "bg-rose-50/70 border-rose-200"
                      : isWarning
                      ? "bg-amber-50/70 border-amber-200"
                      : "bg-warm-50/70 border-warm-200 hover:border-warm-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "p-1.5 rounded-lg shrink-0 mt-0.5",
                          isCritical
                            ? "bg-rose-100 text-rose-700"
                            : isWarning
                            ? "bg-amber-100 text-amber-700"
                            : "bg-warm-200 text-warm-700"
                        )}
                      >
                        {n.category === "inventory" ? (
                          <Package className="h-3.5 w-3.5" />
                        ) : n.category === "logistics" ? (
                          <Truck className="h-3.5 w-3.5" />
                        ) : n.category === "register" ? (
                          <DollarSign className="h-3.5 w-3.5" />
                        ) : n.category === "crm" ? (
                          <Users className="h-3.5 w-3.5" />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div>
                        <span
                          className={cn(
                            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            isCritical
                              ? "bg-rose-200/70 text-rose-800"
                              : isWarning
                              ? "bg-amber-200/70 text-amber-800"
                              : "bg-warm-200 text-warm-700"
                          )}
                        >
                          {n.category === "inventory"
                            ? "Inventario"
                            : n.category === "logistics"
                            ? "Entregas"
                            : n.category === "register"
                            ? "Caja POS"
                            : n.category === "crm"
                            ? "CRM"
                            : "Chat"}
                        </span>
                        <h4 className="text-xs font-bold text-warm-900 mt-1 leading-snug">
                          {n.title}
                        </h4>
                      </div>
                    </div>

                    <button
                      onClick={() => dismissNotification(n.id)}
                      className="p-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-warm-400 hover:text-warm-700 rounded-lg transition-colors active:scale-95 touch-manipulation -mr-1.5 -mt-1.5"
                      title="Descartar notificación"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-[11px] text-warm-600 leading-relaxed pl-8">
                    {n.message}
                  </p>

                  <div className="pt-2 border-t border-warm-200/60 flex items-center justify-between pl-8">
                    <span className="text-[10px] text-warm-400 flex items-center gap-1 font-mono">
                      <Clock className="h-2.5 w-2.5" />
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    <button
                      onClick={() => handleActionClick(n)}
                      className={cn(
                        "px-3 py-2 min-h-[44px] text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 active:scale-95 touch-manipulation",
                        isCritical
                          ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                          : isWarning
                          ? "bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
                          : "bg-terracotta-500 hover:bg-terracotta-600 text-white shadow-sm"
                      )}
                    >
                      <span>
                        {n.category === "inventory"
                          ? "Ir a Insumo"
                          : n.category === "logistics"
                          ? "Ver Agenda de Hoy"
                          : n.category === "register"
                          ? "Ir a Turno de Caja"
                          : "Ver Detalle"}
                      </span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {dismissedNotificationIds.length > 0 && (
          <div className="p-3 bg-warm-50 border-t border-warm-200 flex items-center justify-between text-xs">
            <span className="text-warm-500 text-[11px]">
              {dismissedNotificationIds.length} leída(s)
            </span>
            <button
              onClick={clearDismissedNotifications}
              className="text-[11px] font-bold text-terracotta-600 hover:text-terracotta-800 flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-lg active:scale-95 touch-manipulation"
            >
              <RefreshCw className="h-3 w-3 shrink-0" />
              <span>Restablecer todas</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
