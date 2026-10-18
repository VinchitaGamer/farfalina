import { create } from "zustand";

import { z } from "zod";

export const SystemTypeSchema = z.enum(["floreria", "carissma"]);
export type SystemType = z.infer<typeof SystemTypeSchema>;

export const FloreriaViewSchema = z.enum(["catalog", "pos", "omnichannel", "orders", "crm", "accounting"]);
export type FloreriaView = z.infer<typeof FloreriaViewSchema>;

export const CarissmaViewSchema = z.enum(["catalog", "pos", "omnichannel", "orders", "crm", "accounting", "pricing-engine"]);
export type CarissmaView = z.infer<typeof CarissmaViewSchema>;

export interface SystemState {
  activeSystem: SystemType;
  floreriaView: FloreriaView;
  carissmaView: CarissmaView;

  // Sub-tabs & filter targets for cross-module navigation
  posActiveTab: "terminal" | "stock" | "register";
  posStockSearch: string;
  ordersViewMode: "calendar" | "kanban" | "agenda";
  ordersAgendaFilter: "today" | "week" | "month";

  // Notification Drawer
  notificationDrawerOpen: boolean;
  dismissedNotificationIds: string[];

  // Modals & Card printer
  cardPrinterModalOpen: boolean;
  activeCardText: { client: string; recipient: string; message: string; date: string } | null;
  registerOpen: boolean;
  registerBalance: number;
  mobileMenuOpen: boolean;

  // Actions
  setActiveSystem: (system: SystemType) => void;
  setFloreriaView: (view: FloreriaView) => void;
  setCarissmaView: (view: CarissmaView) => void;
  setPosActiveTab: (tab: "terminal" | "stock" | "register") => void;
  setPosStockSearch: (search: string) => void;
  setOrdersViewMode: (mode: "calendar" | "kanban" | "agenda") => void;
  setOrdersAgendaFilter: (filter: "today" | "week" | "month") => void;
  setNotificationDrawerOpen: (open: boolean) => void;
  dismissNotification: (id: string) => void;
  clearDismissedNotifications: () => void;

  // Navigation helpers — Farfalina
  navigateToInventoryStock: (searchQuery?: string) => void;
  navigateToTodayAgenda: () => void;
  navigateToCashRegister: () => void;
  navigateToCRM: () => void;
  navigateToOmnichannel: () => void;

  openCardPrinter: (card: { client: string; recipient: string; message: string; date: string }) => void;
  closeCardPrinter: () => void;
  toggleRegister: (open: boolean, amount?: number) => void;
  setMobileMenuOpen: (open: boolean) => void;
}

export const useAppStore = create<SystemState>((set) => ({
  activeSystem: "floreria",
  floreriaView: "catalog",
  carissmaView: "catalog",

  posActiveTab: "terminal",
  posStockSearch: "",
  ordersViewMode: "calendar",
  ordersAgendaFilter: "today",

  notificationDrawerOpen: false,
  dismissedNotificationIds: [],

  cardPrinterModalOpen: false,
  activeCardText: null,
  registerOpen: false,
  registerBalance: 0,
  mobileMenuOpen: false,

  setActiveSystem: (system) => set({ activeSystem: system }),
  setFloreriaView: (view) => set({ floreriaView: view, mobileMenuOpen: false }),
  setCarissmaView: (view) => set({ carissmaView: view, mobileMenuOpen: false }),
  setPosActiveTab: (tab) => set({ posActiveTab: tab }),
  setPosStockSearch: (search) => set({ posStockSearch: search }),
  setOrdersViewMode: (mode) => set({ ordersViewMode: mode }),
  setOrdersAgendaFilter: (filter) => set({ ordersAgendaFilter: filter }),
  setNotificationDrawerOpen: (open) => set({ notificationDrawerOpen: open }),
  dismissNotification: (id) =>
    set((state) => ({ dismissedNotificationIds: [...state.dismissedNotificationIds, id] })),
  clearDismissedNotifications: () => set({ dismissedNotificationIds: [] }),

  navigateToInventoryStock: (searchQuery = "") =>
    set({
      activeSystem: "floreria",
      floreriaView: "pos",
      posActiveTab: "stock",
      posStockSearch: searchQuery,
      notificationDrawerOpen: false,
      mobileMenuOpen: false,
    }),

  navigateToTodayAgenda: () =>
    set({
      activeSystem: "floreria",
      floreriaView: "orders",
      ordersViewMode: "agenda",
      ordersAgendaFilter: "today",
      notificationDrawerOpen: false,
      mobileMenuOpen: false,
    }),

  navigateToCashRegister: () =>
    set({
      activeSystem: "floreria",
      floreriaView: "pos",
      posActiveTab: "register",
      notificationDrawerOpen: false,
      mobileMenuOpen: false,
    }),

  navigateToCRM: () =>
    set({
      activeSystem: "floreria",
      floreriaView: "crm",
      notificationDrawerOpen: false,
      mobileMenuOpen: false,
    }),

  navigateToOmnichannel: () =>
    set({
      activeSystem: "floreria",
      floreriaView: "omnichannel",
      notificationDrawerOpen: false,
      mobileMenuOpen: false,
    }),

  openCardPrinter: (card) => set({ cardPrinterModalOpen: true, activeCardText: card }),
  closeCardPrinter: () => set({ cardPrinterModalOpen: false, activeCardText: null }),
  toggleRegister: (open, amount = 0) => set({ registerOpen: open, registerBalance: amount }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
}));
