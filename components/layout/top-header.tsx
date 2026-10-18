"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import {
  Flower2,
  Shirt,
  Bell,
  Store,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TopHeader() {
  const router = useRouter();
  const { activeSystem, setActiveSystem, registerOpen, mobileMenuOpen, setMobileMenuOpen } = useAppStore();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-warm-200 bg-white/95 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 transition-colors duration-200 print:hidden">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Mobile Menu Toggle & Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-1 text-warm-700 hover:text-warm-900 hover:bg-warm-100 rounded-xl transition-colors lg:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-terracotta-500 to-amberGold-500 flex items-center justify-center text-white shadow-warm font-bold text-base sm:text-lg shrink-0">
              S
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-sm sm:text-base text-warm-900 leading-none">SOURDEV</h1>
              <span className="text-[9px] sm:text-[10px] tracking-wider uppercase font-semibold text-terracotta-600 bg-terracotta-50 px-1.5 py-0.5 rounded border border-terracotta-100">
                SaaS Suite
              </span>
            </div>
          </div>
        </div>

        {/* Center: System Switcher Buttons */}
        <div className="inline-flex p-1 bg-warm-100/90 rounded-xl border border-warm-200 shadow-inner max-w-full overflow-x-auto shrink-1">
          <button
            onClick={() => {
              setActiveSystem("floreria");
              router.push("/floreria/catalog");
            }}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap",
              activeSystem === "floreria"
                ? "bg-white text-terracotta-700 shadow-warm border border-terracotta-200"
                : "text-warm-700 hover:text-warm-900 hover:bg-white/50"
            )}
          >
            <Flower2 className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0", activeSystem === "floreria" ? "text-terracotta-500" : "text-warm-500")} />
            <span>Florería Farfalina</span>
            {activeSystem === "floreria" && (
              <span className="h-1.5 w-1.5 rounded-full bg-terracotta-500 animate-pulse hidden sm:inline-block" />
            )}
          </button>

          <button
            onClick={() => {
              setActiveSystem("carissma");
              router.push("/carissma/catalog");
            }}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap",
              activeSystem === "carissma"
                ? "bg-white text-amberGold-700 shadow-warm border border-amberGold-200"
                : "text-warm-700 hover:text-warm-900 hover:bg-white/50"
            )}
          >
            <Shirt className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0", activeSystem === "carissma" ? "text-amberGold-600" : "text-warm-500")} />
            <span>Carissma</span>
            {activeSystem === "carissma" && (
              <span className="h-1.5 w-1.5 rounded-full bg-amberGold-500 animate-pulse hidden sm:inline-block" />
            )}
          </button>
        </div>

        {/* Right: Global Actions & User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Notification Bell Trigger */}
          <button
            onClick={() => {
              const { setNotificationDrawerOpen, notificationDrawerOpen } = useAppStore.getState();
              setNotificationDrawerOpen(!notificationDrawerOpen);
            }}
            className="p-2 text-warm-600 hover:text-warm-900 hover:bg-warm-100 rounded-xl transition-colors relative"
            aria-label="Abrir centro de notificaciones"
            title="Notificaciones y alertas del sistema"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-terracotta-500 animate-pulse" />
          </button>

          {/* POS Status Badge (desktop/tablet) */}
          {activeSystem === "floreria" && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-medium">
              <Store className="h-3.5 w-3.5 text-emerald-600" />
              <span>Caja {registerOpen ? "Abierta" : "Cerrada"}</span>
            </div>
          )}

          {/* User Profile avatar */}
          <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-warm-200">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-terracotta-100 border border-terracotta-200 flex items-center justify-center text-terracotta-700 font-bold text-xs shrink-0">
              AD
            </div>
            <div className="hidden xl:block text-left">
              <p className="text-xs font-semibold text-warm-900 leading-tight">Admin General</p>
              <p className="text-[10px] text-warm-500">Sucursal Central</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
