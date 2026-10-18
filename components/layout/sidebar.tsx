"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore, FloreriaView, CarissmaView } from "@/store/app-store";
import {
  ShoppingBag,
  Calculator,
  MessageSquareText,
  Truck,
  Users,
  TrendingDown,
  CalendarDays,
  HelpCircle,
  PieChart,
  X,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const pathname = usePathname();
  const {
    activeSystem,
    openCardPrinter,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useAppStore();

  const floreriaNav = [
    { href: "/floreria/catalog", label: "E-Commerce y Catálogo", icon: ShoppingBag, badge: "Público" },
    { href: "/floreria/pos", label: "POS e Inventario", icon: Calculator, badge: "Stock Vivo" },
    { href: "/floreria/omnichannel", label: "Omnicanalidad", icon: MessageSquareText, badge: "Chats" },
    { href: "/floreria/orders", label: "Pedidos y Logística", icon: Truck, badge: "En Ruta" },
    { href: "/floreria/crm", label: "CRM, Marketing & Fechas", icon: Users, badge: "Eventos" },
    { href: "/floreria/accounting", label: "Contabilidad & Cajas", icon: PieChart, badge: "Reportes" },
  ];

  const carissmaNav = [
    { href: "/carissma/catalog", label: "Catálogo de Vestidos", icon: ShoppingBag, badge: "Alta Costura" },
    { href: "/carissma/pos", label: "POS & Inventario", icon: Calculator, badge: "Caja & Rentas" },
    { href: "/carissma/omnichannel", label: "Omnicanalidad", icon: MessageSquareText, badge: "Chats" },
    { href: "/carissma/orders", label: "Calendario & Rentas", icon: CalendarDays, badge: "Ciclo Vida" },
    { href: "/carissma/crm", label: "CRM & Medidas Clientas", icon: Users, badge: "Eventos" },
    { href: "/carissma/accounting", label: "Contabilidad & Cajas", icon: PieChart, badge: "Reportes" },
    { href: "/carissma/pricing-engine", label: "Precios Dinámicos", icon: TrendingDown, badge: "Algoritmo" },
  ];

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full space-y-6">
      <div className="space-y-5">
        {/* System Title Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-warm-50 border border-warm-200/80">
          <div>
            <p className="text-[10px] font-semibold text-warm-500 uppercase tracking-wider">Módulos del Sistema</p>
            <p className="text-xs sm:text-sm font-bold text-warm-900 mt-0.5 flex items-center gap-1.5">
              {activeSystem === "floreria" ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-terracotta-500" />
                  Florería Farfalina
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amberGold-500" />
                  Alquiler Carissma
                </>
              )}
            </p>
          </div>
          {/* Mobile close button inside drawer */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 text-warm-500 hover:text-warm-900 rounded-lg lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Item List */}
        <nav className="space-y-1">
          {activeSystem === "floreria"
            ? floreriaNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3.5 py-3 lg:py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group",
                      isActive
                        ? "bg-terracotta-500 text-white shadow-warm"
                        : "text-warm-700 hover:bg-warm-100 hover:text-warm-900"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-transform group-hover:scale-110",
                          isActive ? "text-white" : "text-terracotta-600"
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded-full font-bold",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-warm-100 text-warm-700 group-hover:bg-warm-200"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })
            : carissmaNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setMobileMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3.5 py-3 lg:py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group",
                      isActive
                        ? "bg-amberGold-600 text-white shadow-warm"
                        : "text-warm-700 hover:bg-warm-100 hover:text-warm-900"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "h-4 w-4 transition-transform group-hover:scale-110",
                          isActive ? "text-white" : "text-amberGold-600"
                        )}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] rounded-full font-bold",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-warm-100 text-warm-700 group-hover:bg-warm-200"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
        </nav>

        {/* Notification Center Trigger */}
        {activeSystem === "floreria" && (
          <div className="pt-3 border-t border-warm-200">
            <div className="p-3 bg-gradient-to-br from-terracotta-50 to-amberGold-50 rounded-xl border border-terracotta-200/60 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-terracotta-700">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-terracotta-600" />
                  <span className="text-xs font-bold">Centro de Notificaciones</span>
                </div>
              </div>
              <p className="text-[11px] text-warm-600 leading-snug">
                Alertas automáticas de bajo stock, insumos por vencer y entregas.
              </p>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  const { setNotificationDrawerOpen } = useAppStore.getState();
                  setNotificationDrawerOpen(true);
                }}
                className="w-full text-center px-3 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Abrir Alertas del Sistema</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-warm-200 flex items-center justify-between text-warm-500 text-[11px]">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" />
          <span>Soporte Técnico</span>
        </div>
        <span className="font-mono text-[10px] text-warm-400">v2.5.0</span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-warm-200 p-4 flex-col justify-between shrink-0 shadow-sm min-h-[calc(100dvh-61px)] print:hidden">
        {sidebarContent}
      </aside>

      {/* 2. Mobile Slide-Over Drawer with Backdrop */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex print:hidden">
          {/* Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-warm-950/50 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Container */}
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl p-4 overflow-y-auto z-10 flex flex-col justify-between animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
