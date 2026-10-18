"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app-store";
import {
  ShoppingBag,
  Calculator,
  MessageSquareText,
  Truck,
  Menu,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const {
    activeSystem,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useAppStore();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-warm-200 lg:hidden px-2 py-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden">
      <div className="flex items-center justify-around">
        {activeSystem === "floreria" ? (
          <>
            {/* 1. Catálogo */}
            <Link
              href="/floreria/catalog"
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                pathname.startsWith("/floreria/catalog")
                  ? "text-terracotta-600 font-bold"
                  : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  pathname.startsWith("/floreria/catalog") ? "bg-terracotta-100/80 text-terracotta-700" : ""
                )}
              >
                <ShoppingBag className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Catálogo</span>
            </Link>

            {/* 2. POS */}
            <Link
              href="/floreria/pos"
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                pathname.startsWith("/floreria/pos")
                  ? "text-terracotta-600 font-bold"
                  : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  pathname.startsWith("/floreria/pos") ? "bg-terracotta-100/80 text-terracotta-700" : ""
                )}
              >
                <Calculator className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">POS</span>
            </Link>

            {/* 3. Omnicanal */}
            <Link
              href="/floreria/omnichannel"
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation relative",
                pathname.startsWith("/floreria/omnichannel")
                  ? "text-terracotta-600 font-bold"
                  : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all relative",
                  pathname.startsWith("/floreria/omnichannel") ? "bg-terracotta-100/80 text-terracotta-700" : ""
                )}
              >
                <MessageSquareText className="h-5 w-5" />
                <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-terracotta-500 animate-pulse" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Chats</span>
            </Link>

            {/* 4. Pedidos */}
            <Link
              href="/floreria/orders"
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                pathname.startsWith("/floreria/orders")
                  ? "text-terracotta-600 font-bold"
                  : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  pathname.startsWith("/floreria/orders") ? "bg-terracotta-100/80 text-terracotta-700" : ""
                )}
              >
                <Truck className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Pedidos</span>
            </Link>

            {/* 5. Menú Completo */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                mobileMenuOpen ? "text-terracotta-600 font-bold" : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  mobileMenuOpen ? "bg-terracotta-100/80 text-terracotta-700" : ""
                )}
              >
                <Menu className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Más</span>
            </button>
          </>
        ) : (
          <>
            {/* Carissma: Catálogo */}
            <Link
              href="/carissma/catalog"
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                pathname.startsWith("/carissma/catalog")
                  ? "text-amberGold-700 font-bold"
                  : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  pathname.startsWith("/carissma/catalog") ? "bg-amberGold-100/80 text-amberGold-700" : ""
                )}
              >
                <ShoppingBag className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Catálogo</span>
            </Link>

            {/* Carissma: POS */}
            <Link
              href="/carissma/pos"
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                pathname.startsWith("/carissma/pos")
                  ? "text-amberGold-700 font-bold"
                  : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  pathname.startsWith("/carissma/pos") ? "bg-amberGold-100/80 text-amberGold-700" : ""
                )}
              >
                <Calculator className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">POS</span>
            </Link>

            {/* Carissma: Omnicanalidad */}
            <Link
              href="/carissma/omnichannel"
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                pathname.startsWith("/carissma/omnichannel")
                  ? "text-amberGold-700 font-bold"
                  : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  pathname.startsWith("/carissma/omnichannel") ? "bg-amberGold-100/80 text-amberGold-700" : ""
                )}
              >
                <MessageSquareText className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Chats</span>
            </Link>

            {/* Carissma: Calendario & Rentas */}
            <Link
              href="/carissma/orders"
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                pathname.startsWith("/carissma/orders")
                  ? "text-amberGold-700 font-bold"
                  : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  pathname.startsWith("/carissma/orders") ? "bg-amberGold-100/80 text-amberGold-700" : ""
                )}
              >
                <CalendarDays className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Rentas</span>
            </Link>

            {/* Más */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center min-h-[48px] min-w-[48px] py-1 px-2 rounded-xl transition-all active:scale-95 touch-manipulation",
                mobileMenuOpen ? "text-amberGold-700 font-bold" : "text-warm-500 hover:text-warm-900"
              )}
            >
              <div
                className={cn(
                  "p-1 rounded-lg transition-all",
                  mobileMenuOpen ? "bg-amberGold-100/80 text-amberGold-700" : ""
                )}
              >
                <Menu className="h-5 w-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">Más</span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
