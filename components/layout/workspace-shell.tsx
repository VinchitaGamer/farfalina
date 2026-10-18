"use client";

import React from "react";
import { useAppStore } from "@/store/app-store";

// Top Layout Components
import TopHeader from "@/components/layout/top-header";
import Sidebar from "@/components/layout/sidebar";
import MobileBottomNav from "@/components/layout/mobile-bottom-nav";

// Florería Farfalina Modules
import CatalogView from "@/components/floreria/catalog-view";
import PosView from "@/components/floreria/pos-view";
import OmnichannelView from "@/components/floreria/omnichannel-view";
import OrdersView from "@/components/floreria/orders-view";
import CrmView from "@/components/floreria/crm-view";
import AccountingView from "@/components/floreria/accounting-view";

// Alquiler Vestidos Carissma Modules
import CarissmaCatalogView from "@/components/carissma/catalog-view";
import CarissmaPosView from "@/components/carissma/pos-view";
import CarissmaOmnichannelView from "@/components/carissma/omnichannel-view";
import CarissmaOrdersView from "@/components/carissma/orders-view";
import CarissmaCrmView from "@/components/carissma/crm-view";
import CarissmaAccountingView from "@/components/carissma/accounting-view";
import CarissmaPricingEngineView from "@/components/carissma/pricing-engine-view";

// Shared Modals & Toast
import CardPrinterModal from "@/components/shared/card-printer-modal";
import NotificationCenter from "@/components/shared/notification-center";
import { ToastContainer } from "@/components/ui/toast";

import { ConfirmDialogProvider } from "@/components/ui/confirm-dialog";

export default function WorkspaceShell() {
  const { activeSystem, floreriaView, carissmaView } = useAppStore();

  return (
    <ConfirmDialogProvider>
      <div className="min-h-screen flex flex-col bg-warm-50 text-warm-900 font-sans">
      {/* SaaS Enterprise Header */}
      <TopHeader />

      {/* Main SaaS Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-w-0">
        {/* Navigation Sidebar (Desktop persistent / Mobile Drawer) */}
        <Sidebar />

        {/* Dynamic Content View Area with safe-area bottom padding for mobile navigation */}
        <main className="flex-1 p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8 overflow-y-auto max-w-7xl w-full min-w-0">
          {activeSystem === "floreria" && (
            <>
              {floreriaView === "catalog" && <CatalogView />}
              {floreriaView === "pos" && <PosView />}
              {floreriaView === "omnichannel" && <OmnichannelView />}
              {floreriaView === "orders" && <OrdersView />}
              {floreriaView === "crm" && <CrmView />}
              {floreriaView === "accounting" && <AccountingView />}
            </>
          )}

          {activeSystem === "carissma" && (
            <>
              {carissmaView === "catalog" && <CarissmaCatalogView />}
              {carissmaView === "pos" && <CarissmaPosView />}
              {carissmaView === "omnichannel" && <CarissmaOmnichannelView />}
              {carissmaView === "orders" && <CarissmaOrdersView />}
              {carissmaView === "crm" && <CarissmaCrmView />}
              {carissmaView === "accounting" && <CarissmaAccountingView />}
              {carissmaView === "pricing-engine" && <CarissmaPricingEngineView />}
            </>
          )}
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
