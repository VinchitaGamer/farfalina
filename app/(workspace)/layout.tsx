"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/store/app-store";

// Top Layout Components
import TopHeader from "@/components/layout/top-header";
import Sidebar from "@/components/layout/sidebar";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

// Shared Modals & Toast
import CardPrinterModal from "@/components/shared/card-printer-modal";
import NotificationCenter from "@/components/shared/notification-center";
import { ToastContainer } from "@/components/ui/toast";
import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { activeSystem, setActiveSystem, setMobileMenuOpen } = useAppStore();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/carissma") && activeSystem !== "carissma") {
      setActiveSystem("carissma");
    } else if (pathname.startsWith("/floreria") && activeSystem !== "floreria") {
      setActiveSystem("floreria");
    }
    setMobileMenuOpen(false);
  }, [pathname, activeSystem, setActiveSystem, setMobileMenuOpen]);

  return (
    <ConfirmDialogProvider>
      <div className="min-h-[100dvh] flex flex-col bg-warm-50 text-warm-900 font-sans print:block print:min-h-0 print:bg-white">
        {/* SaaS Enterprise Header */}
        <TopHeader />

        {/* Main SaaS Workspace */}
        <div className="flex-1 flex flex-col lg:flex-row min-w-0 print:block">
          {/* Navigation Sidebar (Desktop persistent / Mobile Drawer) */}
          <Sidebar />

          {/* Dynamic Content View Area with safe-area bottom padding for mobile navigation */}
          <main className="flex-1 p-3 sm:p-5 lg:p-8 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8 overflow-y-auto max-w-7xl w-full min-w-0 print:block print:overflow-visible print:p-0 print:pb-0 print:max-w-none">
            {children}
          </main>
        </div>

        {/* Fixed Bottom Navigation for Mobile Devices */}
        <MobileBottomNav />

        {/* Global Card Dedication Printer Modal */}
        <CardPrinterModal />

        {/* Global Notification Center Slide-over Drawer */}
        <NotificationCenter />

        {/* Toast Notifications Provider Container */}
        <ToastContainer />
      </div>
    </ConfirmDialogProvider>
  );
}
