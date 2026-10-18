"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Plus, Search } from "lucide-react";
import {
  getRentalBookingsAction,
  getDressesAction,
  getCarissmaConfigAction,
  updateRentalStatusAction,
} from "@/app/actions/carissma";
import { toast } from "@/components/ui/toast";
import RentalContractModal from "./rental-contract-modal";
import OrdersKanbanBoard from "./orders/orders-kanban-board";
import OrdersCalendarView from "./orders/orders-calendar-view";
import OrdersAgendaTable from "./orders/orders-agenda-table";
import OrdersNewBookingModal from "./orders/orders-new-booking-modal";
import OrdersInspectionModal from "./orders/orders-inspection-modal";

export interface BookingItem {
  id: string;
  contractNumber: string;
  clientName: string;
  clientPhone?: string | null;
  dressId: string;
  dressName: string;
  dressSize: string;
  dressColor: string;
  rentalStartDate: string | Date;
  rentalEndDate: string | Date;
  actualReturnDate?: string | Date | null;
  rentalPrice: number;
  guaranteeAmount: number;
  penaltyFee: number;
  paymentMethod: string;
  rentalStatus: "Reservado" | "En Prueba" | "Entregado" | "Devuelto / Revisión" | "En Lavandería" | "Finalizado";
  guaranteeStatus: "En Custodia" | "Devuelta" | "Retenida Parcial" | "Retenida Total";
  notes?: string | null;
  createdAt: string | Date;
}

export interface DressItem {
  id: string;
  name: string;
  brand: string;
  size: string;
  status: string;
  color: string;
  baseRentalPrice: number;
  requiredGuarantee: number;
}

export default function OrdersView() {
  const [viewMode, setViewMode] = useState<"kanban" | "calendar" | "agenda">("kanban");
  const [agendaFilter, setAgendaFilter] = useState<"today" | "week" | "month" | "all">("all");
  const [searchFilter, setSearchFilter] = useState("");

  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [dresses, setDresses] = useState<DressItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar State
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: string; bookings: BookingItem[] } | null>(null);

  // Config
  const [lateFeePerDay, setLateFeePerDay] = useState(50.0);
  const [defaultRentalDays, setDefaultRentalDays] = useState(3);

  // Modals
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedContractBooking, setSelectedContractBooking] = useState<BookingItem | null>(null);
  const [inspectingBooking, setInspectingBooking] = useState<BookingItem | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [bookingsRes, dressesRes, configRes] = await Promise.all([
      getRentalBookingsAction(),
      getDressesAction(),
      getCarissmaConfigAction(),
    ]);

    if (bookingsRes.success && Array.isArray(bookingsRes.data)) {
      setBookings(bookingsRes.data as BookingItem[]);
    }
    if (dressesRes.success && Array.isArray(dressesRes.data)) {
      setDresses(dressesRes.data as DressItem[]);
    }
    if (configRes.success && configRes.data) {
      const c = configRes.data as { lateFeePerDay?: number; defaultRentalDays?: number };
      setLateFeePerDay(c.lateFeePerDay ?? 50.0);
      setDefaultRentalDays(c.defaultRentalDays ?? 3);
    }
    setLoading(false);
  };

  const handleAdvanceStatus = async (booking: BookingItem, nextStatus: BookingItem["rentalStatus"]) => {
    const res = await updateRentalStatusAction(booking.id, nextStatus);
    if (res.success) {
      toast.success(`Alquiler ${booking.contractNumber} avanzado a: "${nextStatus}"`);
      loadAll();
    } else {
      toast.error(res.error || "Error al actualizar estado");
    }
  };

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    const q = searchFilter.toLowerCase();
    return (
      b.clientName.toLowerCase().includes(q) ||
      b.contractNumber.toLowerCase().includes(q) ||
      b.dressName.toLowerCase().includes(q) ||
      (b.clientPhone && b.clientPhone.includes(q))
    );
  });

  // Agenda Filter
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const agendaBookings = filteredBookings.filter((b) => {
    if (agendaFilter === "all") return true;
    const returnDateStr = new Date(b.rentalEndDate).toISOString().split("T")[0];
    const returnDate = new Date(b.rentalEndDate);

    if (agendaFilter === "today") return returnDateStr === todayStr;
    if (agendaFilter === "week") return returnDate >= now && returnDate <= nextWeek;
    if (agendaFilter === "month") return returnDate >= now && returnDate <= nextMonth;
    return true;
  });

  const getBookingsForDay = (day: number) => {
    const dayDateStr = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), day).toISOString().split("T")[0];
    return bookings.filter((b) => {
      const startStr = new Date(b.rentalStartDate).toISOString().split("T")[0];
      const endStr = new Date(b.rentalEndDate).toISOString().split("T")[0];
      return startStr === dayDateStr || endStr === dayDateStr;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amberGold-100 text-amberGold-800 rounded-md">
              Logística & Rentas Carissma
            </span>
            <h2 className="text-lg font-bold text-warm-900">Pipeline, Calendario & Ciclo de Vestidos</h2>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            6 etapas operativas: Reserva &rarr; Prueba &rarr; Entregado &rarr; Revisión &rarr; Tintorería &rarr; Perchero.
          </p>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-warm-100 p-2 text-warm-700 transition-colors hover:bg-warm-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
            title="Recargar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setIsNewBookingModalOpen(true)}
            className="flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-amberGold-600 px-4 py-2 text-xs font-bold text-white shadow-warm transition-all hover:bg-amberGold-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500 sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            <span>Nueva Reserva</span>
          </button>
        </div>
      </div>

      {/* Navigation Mode Selector & Search */}
      <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-warm-200 bg-white p-3 shadow-sm sm:p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-warm-400" />
          <input
            type="text"
            placeholder="Buscar por clienta, contrato o prenda..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-warm-200 bg-warm-50 py-2 pl-9 pr-3 text-base text-warm-900 focus:outline-none focus:ring-2 focus:ring-amberGold-500"
          />
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 xl:flex xl:w-auto">
          <button
            onClick={() => setViewMode("kanban")}
            className={`min-h-11 w-full rounded-xl px-3 py-2 text-xs font-bold leading-snug transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500 xl:w-auto ${
              viewMode === "kanban"
                ? "bg-amberGold-600 text-white shadow-warm"
                : "bg-warm-100 text-warm-700 hover:bg-warm-200"
            }`}
          >
            Pipeline Kanban (6 Fases)
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`min-h-11 w-full rounded-xl px-3 py-2 text-xs font-bold leading-snug transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500 xl:w-auto ${
              viewMode === "calendar"
                ? "bg-amberGold-600 text-white shadow-warm"
                : "bg-warm-100 text-warm-700 hover:bg-warm-200"
            }`}
          >
            Calendario Mensual
          </button>
          <button
            onClick={() => setViewMode("agenda")}
            className={`min-h-11 w-full rounded-xl px-3 py-2 text-xs font-bold leading-snug transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500 xl:w-auto ${
              viewMode === "agenda"
                ? "bg-amberGold-600 text-white shadow-warm"
                : "bg-warm-100 text-warm-700 hover:bg-warm-200"
            }`}
          >
            Agenda de Devoluciones
          </button>
        </div>
      </div>

      {viewMode === "kanban" && (
        <OrdersKanbanBoard
          filteredBookings={filteredBookings}
          handleAdvanceStatus={handleAdvanceStatus}
          handleOpenInspectionModal={setInspectingBooking}
          setSelectedContractBooking={setSelectedContractBooking}
        />
      )}

      {viewMode === "calendar" && (
        <OrdersCalendarView
          currentCalendarDate={currentCalendarDate}
          setCurrentCalendarDate={setCurrentCalendarDate}
          selectedDayEvents={selectedDayEvents}
          setSelectedDayEvents={setSelectedDayEvents}
          getBookingsForDay={getBookingsForDay}
        />
      )}

      {viewMode === "agenda" && (
        <OrdersAgendaTable
          agendaFilter={agendaFilter as "today" | "week" | "month" | "all"}
          setAgendaFilter={setAgendaFilter}
          agendaBookings={agendaBookings}
          handleOpenInspectionModal={setInspectingBooking}
          setSelectedContractBooking={setSelectedContractBooking}
        />
      )}

      <OrdersNewBookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        dresses={dresses}
        defaultRentalDays={defaultRentalDays}
        onSuccess={(booking) => {
          setIsNewBookingModalOpen(false);
          setSelectedContractBooking(booking);
          loadAll();
        }}
      />

      <OrdersInspectionModal
        inspectingBooking={inspectingBooking}
        onClose={() => setInspectingBooking(null)}
        onSuccess={() => {
          setInspectingBooking(null);
          loadAll();
        }}
        lateFeePerDay={lateFeePerDay}
      />

      <RentalContractModal
        isOpen={!!selectedContractBooking}
        booking={selectedContractBooking}
        onClose={() => setSelectedContractBooking(null)}
      />
    </div>
  );
}
