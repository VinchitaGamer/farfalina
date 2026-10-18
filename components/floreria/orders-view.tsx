"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import {
  Truck,
  Printer,
  MapPin,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Calendar,
  Calendar as CalendarIcon,
  Kanban,
  ChevronLeft,
  ListTodo,
  RefreshCw,
  ArrowRight,
  Store,
  Phone,
  CreditCard,
  Edit2
} from "lucide-react";
import { getOrdersAction, updateOrderStatusAction } from "@/app/actions/logistics";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import EditOrderModal from "./edit-order-modal";

interface OrderDeliveryItem {
  id: string;
  orderNumber: string;
  clientName: string;
  clientPhone?: string;
  recipientName: string;
  address: string;
  zone: string;
  deliveryDate: string | Date;
  deliveryTime: string;
  status: "En preparación" | "En camino" | "Entregado";
  arrangementName: string;
  salePrice?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod?: string;
  dedicationMessage: string;
  recipeItems?: {
    id: string;
    quantityNeeded: number;
    unitCost?: number;
    rawIngredient?: { name: string; unit: string; costPerUnit?: number };
  }[];
}

export default function OrdersView() {
  const {
    openCardPrinter,
    ordersViewMode: viewMode,
    setOrdersViewMode: setViewMode,
    ordersAgendaFilter: agendaFilter,
    setOrdersAgendaFilter: setAgendaFilter,
  } = useAppStore();

  const [orders, setOrders] = useState<OrderDeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderDeliveryItem | null>(null);
  const [editingOrder, setEditingOrder] = useState<OrderDeliveryItem | null>(null);
  const [mobileKanbanStage, setMobileKanbanStage] = useState<"En preparación" | "En camino" | "Entregado">("En preparación");

  // Month navigation for Monthly Calendar
  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1)); // August 2026
  const [selectedMobileDay, setSelectedMobileDay] = useState(1);

  useEffect(() => {
    loadOrders();
  }, [currentDate]);

  const loadOrders = async () => {
    setLoading(true);
    const res = await getOrdersAction();
    if (res.success && Array.isArray(res.data)) {
      setOrders(res.data as OrderDeliveryItem[]);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (id: string, newStatus: "En preparación" | "En camino" | "Entregado") => {
    const res = await updateOrderStatusAction(id, newStatus);
    if (res.success) {
      toast.success(`Estado de pedido actualizado a "${newStatus}"`);
      loadOrders();
    } else {
      toast.error(res.error || "Error al actualizar estado del pedido");
    }
  };

  // Helper for generating monthly grid days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedMobileDay(1);
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedMobileDay(1);
  };

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  // Timezone-safe Date Matcher for Calendar Cells
  const matchOrderDate = (orderDeliveryDate: string | Date, targetDay: number, targetMonth: number, targetYear: number) => {
    const d = new Date(orderDeliveryDate);
    if (isNaN(d.getTime())) return false;

    // Check UTC date first (since server stores at 12:00:00Z)
    const utcMatch = d.getUTCDate() === targetDay && d.getUTCMonth() === targetMonth && d.getUTCFullYear() === targetYear;
    if (utcMatch) return true;

    // Fallback to local date match
    return d.getDate() === targetDay && d.getMonth() === targetMonth && d.getFullYear() === targetYear;
  };

  const selectedMobileDayOrders = orders.filter((order) =>
    matchOrderDate(order.deliveryDate, selectedMobileDay, month, year)
  );

  // Helper filters for Agenda View
  const todayRef = new Date(2026, 7, 5); // Reference Today date in demo: Aug 5, 2026

  const filteredAgendaOrders = orders.filter((o) => {
    const d = new Date(o.deliveryDate);
    const day = d.getUTCDate();
    const m = d.getUTCMonth();
    const y = d.getUTCFullYear();

    if (agendaFilter === "today") {
      return matchOrderDate(o.deliveryDate, todayRef.getDate(), todayRef.getMonth(), todayRef.getFullYear());
    } else if (agendaFilter === "week") {
      const diffTime = d.getTime() - todayRef.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= -2 && diffDays <= 7;
    } else {
      return m === month && y === year;
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-terracotta-100 text-terracotta-700 rounded-md">
              Módulo 4
            </span>
            <h2 className="text-base sm:text-lg font-bold text-warm-900">Gestión de Pedidos & Logística</h2>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            Sincronización en tiempo real entre Calendario, Tablero Kanban y Agenda.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={loadOrders}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-xl transition-colors shrink-0 active:scale-95 touch-manipulation"
            title="Recargar pedidos"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <div className="flex items-center gap-1 bg-warm-100 p-1 rounded-xl border border-warm-200 overflow-x-auto shrink-1">
            <button
              onClick={() => setViewMode("calendar")}
              className={`min-h-[44px] px-3 sm:px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 touch-manipulation ${
                viewMode === "calendar" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              <CalendarIcon className="h-4 w-4" />
              <span>Calendario</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`min-h-[44px] px-3 sm:px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 touch-manipulation ${
                viewMode === "kanban" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              <Kanban className="h-4 w-4" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`min-h-[44px] px-3 sm:px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 touch-manipulation ${
                viewMode === "agenda" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              <ListTodo className="h-4 w-4" />
              <span>Agenda</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: MONTHLY CALENDAR WITH KANBAN STATUS SYNC */}
      {viewMode === "calendar" && (
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-warm-200 shadow-sm space-y-4 sm:space-y-5">
          {/* Calendar Header Navigation */}
          <div className="flex items-center justify-between pb-3 border-b border-warm-200 flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <h3 className="font-bold text-sm sm:text-base text-warm-900">
                {monthNames[month]} {year}
              </h3>
              <span className="text-[10px] sm:text-xs text-terracotta-700 font-bold bg-terracotta-50 px-2 sm:px-2.5 py-0.5 rounded-full border border-terracotta-200">
                {orders.length} Pedidos
              </span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Kanban status legend */}
              <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold">
                <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>En prep</span>
                </span>
                <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span>En camino</span>
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Entregado</span>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={prevMonth}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl transition-colors active:scale-95 touch-manipulation"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={nextMonth}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl transition-colors active:scale-95 touch-manipulation"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <p className="hidden">
            <ArrowRight className="h-3 w-3 text-warm-400" />
            <span>Desliza horizontalmente para ver la cuadrícula completa de días.</span>
          </p>

          {/* Compact mobile calendar with a selected-day order list. */}
          <div className="md:hidden space-y-3">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-warm-600">
              {["D", "L", "M", "M", "J", "V", "S"].map((day, index) => (
                <div key={`${day}-${index}`} className="py-1.5" aria-hidden="true">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <span key={`mobile-empty-${idx}`} aria-hidden="true" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dayOrderCount = orders.filter((order) =>
                  matchOrderDate(order.deliveryDate, dayNum, month, year)
                ).length;
                const isSelected = selectedMobileDay === dayNum;

                return (
                  <button
                    key={`mobile-day-${dayNum}`}
                    type="button"
                    onClick={() => setSelectedMobileDay(dayNum)}
                    aria-pressed={isSelected}
                    aria-label={`${dayNum} de ${monthNames[month]}${dayOrderCount ? `, ${dayOrderCount} pedidos` : ", sin pedidos"}`}
                    className={`min-h-[44px] min-w-0 rounded-lg border flex flex-col items-center justify-center gap-0.5 touch-manipulation active:scale-95 ${
                      isSelected
                        ? "bg-terracotta-600 border-terracotta-700 text-white shadow-sm"
                        : dayOrderCount > 0
                        ? "bg-terracotta-50 border-terracotta-200 text-terracotta-800"
                        : "bg-white border-warm-200 text-warm-800"
                    }`}
                  >
                    <span className="text-xs font-bold leading-none">{dayNum}</span>
                    {dayOrderCount > 0 && (
                      <span className={`text-[9px] leading-none ${isSelected ? "text-white/90" : "text-terracotta-700"}`}>
                        {dayOrderCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <section className="space-y-2" aria-live="polite">
              <h4 className="text-sm font-bold text-warm-900">
                Pedidos del {selectedMobileDay} de {monthNames[month]}
              </h4>
              {selectedMobileDayOrders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-warm-200 bg-warm-50 p-4 text-center text-xs text-warm-500">
                  No hay pedidos para este dia.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedMobileDayOrders.map((order) => (
                    <article key={`mobile-order-${order.id}`} className="flex items-stretch gap-2 rounded-xl border border-warm-200 bg-white p-3 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="min-h-[44px] min-w-0 flex-1 text-left touch-manipulation"
                      >
                        <span className="block truncate text-sm font-bold text-warm-900">{order.recipientName}</span>
                        <span className="mt-0.5 block truncate text-xs text-warm-600">{order.arrangementName}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-warm-500">
                          <span>{order.deliveryTime}</span>
                          <span className="rounded-full bg-warm-100 px-2 py-0.5 font-semibold text-warm-700">{order.status}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openCardPrinter({
                          client: order.clientName,
                          recipient: order.recipientName,
                          message: order.dedicationMessage,
                          date: order.deliveryTime,
                        })}
                        className="min-h-[44px] min-w-[44px] self-center rounded-lg border border-warm-200 bg-warm-50 text-terracotta-700 flex items-center justify-center touch-manipulation active:scale-95"
                        aria-label={`Imprimir dedicatoria de ${order.recipientName}`}
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Tablet and desktop seven-column calendar. */}
          <div className="hidden md:block overflow-x-auto pb-2">
            <div className="w-full space-y-2">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-warm-600">
                {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((day) => (
                  <div key={day} className="py-2 bg-warm-50 rounded-lg border border-warm-100">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {/* Empty slots for first week padding */}
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="h-28 sm:h-32 bg-warm-50/40 rounded-xl border border-dashed border-warm-200" />
                ))}

                {/* Days of the month */}
                {Array.from({ length: daysInMonth }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dayOrders = orders.filter((o) => matchOrderDate(o.deliveryDate, dayNum, month, year));

                  return (
                    <div
                      key={dayNum}
                      className={`h-28 sm:h-32 p-1.5 sm:p-2 rounded-xl border transition-all flex flex-col justify-between overflow-hidden ${
                        dayOrders.length > 0
                          ? "bg-terracotta-50/30 border-terracotta-200 shadow-2xs"
                          : "bg-white border-warm-200 hover:border-warm-300"
                      }`}
                    >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-warm-900">{dayNum}</span>
                    {dayOrders.length > 0 && (
                      <span className="text-[9px] font-mono font-bold bg-terracotta-500 text-white px-1.5 py-0.5 rounded-full">
                        {dayOrders.length}
                      </span>
                    )}
                  </div>

                  {/* List of orders in cell with Kanban synced status badge */}
                  <div className="space-y-1 overflow-y-auto flex-1 my-1 pr-0.5">
                    {dayOrders.map((ord) => (
                      <div
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className={`p-1.5 rounded-lg border text-[10px] space-y-1 transition-all cursor-pointer hover:shadow-sm ${
                          ord.status === "En preparación"
                            ? "bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100"
                            : ord.status === "En camino"
                            ? "bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100"
                            : "bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold truncate">{ord.recipientName}</span>
                          <span
                            className={`px-1 py-0.2 text-[8px] font-bold rounded-full shrink-0 ${
                              ord.status === "En preparación"
                                ? "bg-amber-200 text-amber-800"
                                : ord.status === "En camino"
                                ? "bg-blue-200 text-blue-800"
                                : "bg-emerald-200 text-emerald-800"
                            }`}
                          >
                            {ord.status === "En preparación" ? "Prep" : ord.status === "En camino" ? "Camino" : "Entregado"}
                          </span>
                        </div>

                        <p className="text-[9px] opacity-80 truncate">{ord.arrangementName}</p>

                        <div className="flex items-center justify-between pt-0.5 border-t border-black/5">
                          <span className="font-mono text-[8px] font-semibold">{ord.deliveryTime}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openCardPrinter({
                                client: ord.clientName,
                                recipient: ord.recipientName,
                                message: ord.dedicationMessage,
                                date: `${ord.deliveryTime}`,
                              });
                            }}
                            className="min-h-[32px] min-w-[32px] p-1 hover:bg-black/10 rounded-lg flex items-center justify-center transition-colors touch-manipulation"
                            title="Imprimir dedicatoria"
                          >
                            <Printer className="h-3.5 w-3.5 text-terracotta-700" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KANBAN BOARD WITH REAL-TIME STATUS SYNC */}
      {viewMode === "kanban" && (
        <div className="space-y-4">
          {/* Mobile Segmented Control / Tab Switcher */}
          <div className="md:hidden flex items-center gap-1.5 p-1 bg-warm-100 rounded-2xl border border-warm-200 overflow-x-auto">
            {(["En preparación", "En camino", "Entregado"] as const).map((stage) => {
              const count = orders.filter((o) => o.status === stage).length;
              const isActive = mobileKanbanStage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setMobileKanbanStage(stage)}
                  className={`flex-1 min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap active:scale-95 touch-manipulation ${
                    isActive
                      ? "bg-white text-warm-900 shadow-sm border border-warm-200"
                      : "text-warm-600 hover:text-warm-900 hover:bg-warm-200/50"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                      stage === "En preparación"
                        ? "bg-amber-500"
                        : stage === "En camino"
                        ? "bg-blue-500"
                        : "bg-emerald-500"
                    }`}
                  />
                  <span>
                    {stage === "En preparación"
                      ? "Pendientes"
                      : stage === "En camino"
                      ? "En Camino"
                      : "Entregados"}{" "}
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {(["En preparación", "En camino", "Entregado"] as const).map((columnStatus) => {
              const columnOrders = orders.filter((o) => o.status === columnStatus);
              const isMobileActive = mobileKanbanStage === columnStatus;
              return (
                <div
                  key={columnStatus}
                  className={`bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-4 ${
                    isMobileActive ? "block" : "hidden md:block"
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-warm-200">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          columnStatus === "En preparación"
                            ? "bg-amber-500"
                            : columnStatus === "En camino"
                            ? "bg-blue-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      <h3 className="font-bold text-xs text-warm-900">{columnStatus}</h3>
                    </div>
                    <span className="px-2 py-0.5 bg-warm-100 text-warm-700 rounded text-[10px] font-bold">
                      {columnOrders.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {columnOrders.length === 0 ? (
                      <div className="py-8 text-center text-xs text-warm-400 border border-dashed border-warm-200 rounded-xl">
                        Sin pedidos en este estado.
                      </div>
                    ) : (
                      columnOrders.map((order) => (
                        <div key={order.id} className="card-warm p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono font-bold text-warm-400">{order.orderNumber}</span>
                                {order.address?.includes("Retiro en Tienda") || order.deliveryFee === 0 ? (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                                    <Store className="h-3 w-3 text-purple-700" />
                                    <span>Retiro en Tienda</span>
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-blue-50 text-blue-700 border border-blue-200 inline-flex items-center gap-1">
                                    <Truck className="h-3 w-3 text-blue-600" />
                                    <span>Domicilio</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-semibold text-terracotta-600 inline-flex items-center gap-1 mt-0.5">
                                <Calendar className="h-3 w-3 text-terracotta-500" />
                                <span>{new Date(order.deliveryDate).toLocaleDateString()} a las {order.deliveryTime}</span>
                              </span>
                            </div>
                            <span className="text-xs font-bold text-terracotta-700 font-mono">{formatCurrency(order.total)}</span>
                          </div>

                          <div>
                            <h4 className="font-bold text-xs text-warm-900">{order.arrangementName}</h4>
                            <p className="text-xs text-warm-600 mt-1 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-terracotta-500 shrink-0" />
                              <span>{order.recipientName} — {order.zone}</span>
                            </p>
                            <p className="text-[10px] text-warm-400 pl-4">{order.address}</p>
                          </div>

                          {/* Recipe items if available */}
                          {order.recipeItems && order.recipeItems.length > 0 && (
                            <div className="p-2 bg-warm-50 rounded-lg text-[10px] text-warm-600 space-y-0.5">
                              <span className="font-bold text-warm-800 block">Receta de Insumos:</span>
                              {order.recipeItems.map((r) => (
                                <span key={r.id} className="inline-block mr-2">
                                  • {r.quantityNeeded} {r.rawIngredient?.unit} {r.rawIngredient?.name}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="p-2 bg-warm-50 rounded-lg border border-warm-100 space-y-1">
                            <span className="text-[9px] uppercase font-bold text-warm-400 tracking-wider">Dedicatoria:</span>
                            <p className="text-[11px] italic text-warm-700 line-clamp-2">&ldquo;{order.dedicationMessage}&rdquo;</p>
                          </div>

                          {/* Actions with >= 44x44px touch targets */}
                          <div className="pt-2 border-t border-warm-100 flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() =>
                                  openCardPrinter({
                                    client: order.clientName,
                                    recipient: order.recipientName,
                                    message: order.dedicationMessage,
                                    date: `${new Date(order.deliveryDate).toLocaleDateString()} - ${order.deliveryTime}`,
                                  })
                                }
                                className="min-h-[44px] py-2 px-3 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-terracotta-200 active:scale-95 touch-manipulation"
                              >
                                <Printer className="h-4 w-4" />
                                <span>Tarjeta</span>
                              </button>
                              <button
                                onClick={() => setEditingOrder(order)}
                                className="min-h-[44px] py-2 px-3 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-warm-300 active:scale-95 touch-manipulation"
                              >
                                <Edit2 className="h-4 w-4 text-warm-600" />
                                <span>Editar</span>
                              </button>
                            </div>

                            {columnStatus === "En preparación" && (
                              <button
                                onClick={() => handleUpdateStatus(order.id, "En camino")}
                                className="w-full min-h-[44px] py-2.5 px-3 bg-amberGold-500 hover:bg-amberGold-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation shadow-xs"
                              >
                                <span>Marcar &quot;En camino&quot;</span>
                                <ArrowRight className="h-4 w-4" />
                              </button>
                            )}
                            {columnStatus === "En camino" && (
                              <button
                                onClick={() => handleUpdateStatus(order.id, "Entregado")}
                                className="w-full min-h-[44px] py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation shadow-xs"
                              >
                                <span>Marcar &quot;Entregado&quot;</span>
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: AGENDA & DESPACHOS PENDIENTES (HOY / SEMANA / MES) */}
      {viewMode === "agenda" && (
        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-warm-200">
            <div>
              <h3 className="font-bold text-base text-warm-900">Agenda de Actividades & Despachos Pendientes</h3>
              <p className="text-xs text-warm-500">Filtrado inteligente por marco temporal de entrega.</p>
            </div>

            {/* Agenda Filters */}
            <div className="flex items-center gap-1.5 bg-warm-100 p-1.5 rounded-2xl border border-warm-200 overflow-x-auto">
              <button
                onClick={() => setAgendaFilter("today")}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                  agendaFilter === "today" ? "bg-terracotta-500 text-white shadow-sm" : "text-warm-600 hover:text-warm-900"
                }`}
              >
                Hoy ({orders.filter((o) => new Date(o.deliveryDate).getDate() === todayRef.getDate()).length})
              </button>
              <button
                onClick={() => setAgendaFilter("week")}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                  agendaFilter === "week" ? "bg-terracotta-500 text-white shadow-sm" : "text-warm-600 hover:text-warm-900"
                }`}
              >
                Esta Semana
              </button>
              <button
                onClick={() => setAgendaFilter("month")}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 touch-manipulation ${
                  agendaFilter === "month" ? "bg-terracotta-500 text-white shadow-sm" : "text-warm-600 hover:text-warm-900"
                }`}
              >
                Este Mes ({orders.length})
              </button>
            </div>
          </div>

          {/* Agenda Listing */}
          {filteredAgendaOrders.length === 0 ? (
            <div className="p-12 text-center space-y-2 bg-warm-50 rounded-2xl border border-warm-200">
              <ListTodo className="h-8 w-8 text-warm-400 mx-auto" />
              <p className="text-xs font-semibold text-warm-600">No hay despachos programados en este período.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAgendaOrders.map((ord) => (
                <div key={ord.id} className="p-4 bg-warm-50/60 rounded-2xl border border-warm-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-warm-400">{ord.orderNumber}</span>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                          ord.status === "En preparación"
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : ord.status === "En camino"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        }`}
                      >
                        {ord.status}
                      </span>
                      {ord.address?.includes("Retiro en Tienda") || ord.deliveryFee === 0 ? (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                          <Store className="h-3 w-3 text-purple-700" />
                          <span>Retiro en Tienda</span>
                        </span>
                      ) : null}
                    </div>

                    <h4 className="font-bold text-sm text-warm-900">{ord.arrangementName}</h4>
                    <p className="text-xs text-warm-600 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-terracotta-500" />
                      <strong>{ord.recipientName}</strong> — {ord.address?.includes("Retiro en Tienda") ? "Retiro en Tienda Central" : `${ord.address} (${ord.zone})`}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
                    <div className="text-left sm:text-right font-mono">
                      <span className="text-[10px] text-warm-400 block font-sans">
                        {ord.address?.includes("Retiro en Tienda") ? "Hora Retiro:" : "Hora Entrega:"}
                      </span>
                      <span className="font-bold text-xs text-warm-900">{new Date(ord.deliveryDate).toLocaleDateString()} a las {ord.deliveryTime}</span>
                      <span className="text-xs font-bold text-terracotta-700 block">{formatCurrency(ord.total)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() =>
                          openCardPrinter({
                            client: ord.clientName,
                            recipient: ord.recipientName,
                            message: ord.dedicationMessage,
                            date: `${ord.deliveryTime}`,
                          })
                        }
                        className="min-h-[44px] px-3.5 py-2 bg-white hover:bg-warm-100 text-warm-800 rounded-xl text-xs font-bold border border-warm-200 transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation"
                      >
                        <Printer className="h-4 w-4 text-terracotta-600" />
                        <span>Tarjeta</span>
                      </button>

                      {ord.status === "En preparación" && (
                        <button
                          onClick={() => handleUpdateStatus(ord.id, "En camino")}
                          className="min-h-[44px] px-3.5 py-2 bg-amberGold-500 hover:bg-amberGold-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 touch-manipulation"
                        >
                          <span>En camino</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      )}
                      {ord.status === "En camino" && (
                        <button
                          onClick={() => handleUpdateStatus(ord.id, "Entregado")}
                          className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 touch-manipulation"
                        >
                          <span>Entregado</span>
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedOrder(ord)}
                        className="min-h-[44px] px-3.5 py-2 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-xl text-xs font-bold border border-terracotta-200 transition-all flex items-center justify-center active:scale-95 touch-manipulation"
                      >
                        Ver Detalle
                      </button>
                      <button
                        onClick={() => setEditingOrder(ord)}
                        className="min-h-[44px] px-3.5 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold border border-warm-300 transition-all flex items-center gap-1.5 active:scale-95 touch-manipulation"
                      >
                        <Edit2 className="h-4 w-4 text-warm-600" />
                        <span>Editar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DETAILED TICKET & ORDER MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-terracotta-100 text-terracotta-700 rounded-2xl">
                  <Truck className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-warm-400">{selectedOrder.orderNumber}</span>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                        selectedOrder.status === "En preparación"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : selectedOrder.status === "En camino"
                          ? "bg-blue-100 text-blue-800 border-blue-300"
                          : "bg-emerald-100 text-emerald-800 border-emerald-300"
                      }`}
                    >
                      {selectedOrder.status}
                    </span>
                    {selectedOrder.address?.includes("Retiro en Tienda") || selectedOrder.deliveryFee === 0 ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200 inline-flex items-center gap-1">
                        <Store className="h-3 w-3 text-purple-700" />
                        <span>Retiro en Tienda</span>
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-bold text-base text-warm-900">Vista Detallada del Pedido / Ticket</h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 text-warm-400 hover:text-warm-700 rounded-full hover:bg-warm-100 transition-colors"
              >
                <ChevronRight className="h-6 w-6 rotate-90" />
              </button>
            </div>

            {/* Quick Status Buttons */}
            <div className="flex items-center justify-between gap-2 p-3 bg-warm-50 rounded-2xl border border-warm-200">
              <span className="text-xs font-bold text-warm-700">Cambiar Estado Rápido:</span>
              <div className="flex items-center gap-2">
                {selectedOrder.status !== "En preparación" && (
                  <button
                    onClick={async () => {
                      await handleUpdateStatus(selectedOrder.id, "En preparación");
                      setSelectedOrder({ ...selectedOrder, status: "En preparación" });
                    }}
                    className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all border border-amber-300 inline-flex items-center gap-1.5"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                    <span>En preparación</span>
                  </button>
                )}
                {selectedOrder.status !== "En camino" && (
                  <button
                    onClick={async () => {
                      await handleUpdateStatus(selectedOrder.id, "En camino");
                      setSelectedOrder({ ...selectedOrder, status: "En camino" });
                    }}
                    className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-xl text-xs font-bold transition-all border border-blue-300 inline-flex items-center gap-1.5"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    <span>En camino</span>
                  </button>
                )}
                {selectedOrder.status !== "Entregado" && (
                  <button
                    onClick={async () => {
                      await handleUpdateStatus(selectedOrder.id, "Entregado");
                      setSelectedOrder({ ...selectedOrder, status: "Entregado" });
                    }}
                    className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-300 inline-flex items-center gap-1.5"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Entregado</span>
                  </button>
                )}
              </div>
            </div>

            {/* Section 1: Customer & Delivery Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-warm-50/70 rounded-2xl border border-warm-200 text-xs">
              <div className="space-y-1">
                <span className="font-bold text-warm-400 uppercase text-[10px] tracking-wider block">Datos del Cliente:</span>
                <p className="font-bold text-warm-900">{selectedOrder.clientName}</p>
                {selectedOrder.clientPhone && (
                  <p className="text-warm-600 font-mono inline-flex items-center gap-1">
                    <Phone className="h-3 w-3 text-warm-400" />
                    <span>{selectedOrder.clientPhone}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <span className="font-bold text-warm-400 uppercase text-[10px] tracking-wider block">Destinatario & Modalidad:</span>
                <p className="font-bold text-warm-900">{selectedOrder.recipientName}</p>
                {selectedOrder.address?.includes("Retiro en Tienda") || selectedOrder.deliveryFee === 0 ? (
                  <p className="text-purple-800 font-bold flex items-center gap-1">
                    <Store className="h-3.5 w-3.5 text-purple-700" />
                    <span>Retiro en Tienda Central</span>
                  </p>
                ) : (
                  <p className="text-warm-600 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-terracotta-500 shrink-0" />
                    <span>{selectedOrder.address} ({selectedOrder.zone})</span>
                  </p>
                )}
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-warm-200 flex flex-wrap justify-between gap-2">
                <div>
                  <span className="font-bold text-warm-400 uppercase text-[10px] tracking-wider block">
                    {selectedOrder.address?.includes("Retiro en Tienda") ? "Fecha & Hora de Retiro:" : "Fecha & Hora Programada:"}
                  </span>
                  <p className="font-bold text-terracotta-700 inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-terracotta-600" />
                    <span>{new Date(selectedOrder.deliveryDate).toLocaleDateString()} a las {selectedOrder.deliveryTime}</span>
                  </p>
                </div>
                <div>
                  <span className="font-bold text-warm-400 uppercase text-[10px] tracking-wider block">Método de Pago:</span>
                  <span className="px-2.5 py-0.5 text-xs font-bold bg-terracotta-100 text-terracotta-800 rounded-full border border-terracotta-200 inline-flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-terracotta-700" />
                    <span>{selectedOrder.paymentMethod || "Efectivo"}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Financial Breakdown */}
            <div className="p-4 bg-warm-50 rounded-2xl border border-warm-200 space-y-2 text-xs">
              <h4 className="font-bold text-warm-900">Desglose Financiero del Ticket:</h4>
              <div className="flex justify-between text-warm-700">
                <span>Arreglo ({selectedOrder.arrangementName}):</span>
                <span className="font-mono font-bold">
                  {formatCurrency(selectedOrder.salePrice || selectedOrder.total - (selectedOrder.deliveryFee || 0))}
                </span>
              </div>
              <div className="flex justify-between text-warm-700">
                <span>Costo Envío:</span>
                <span className="font-mono font-bold">
                  {selectedOrder.address?.includes("Retiro en Tienda") || selectedOrder.deliveryFee === 0
                    ? "0.00 Bs (Exento - Retiro en Tienda)"
                    : formatCurrency(selectedOrder.deliveryFee || 20)}
                </span>
              </div>
              <div className="pt-2 border-t border-warm-200 flex justify-between text-sm font-bold text-terracotta-800">
                <span>TOTAL RECAUDADO:</span>
                <span className="font-mono">{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Section 3: Printed Dedication Card */}
            <div className="p-4 bg-gradient-to-br from-terracotta-50/60 to-warm-50 rounded-2xl border border-terracotta-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-terracotta-800 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-terracotta-600" /> Tarjeta Dedicatoria Impresa
                </span>
                <button
                  onClick={() =>
                    openCardPrinter({
                      client: selectedOrder.clientName,
                      recipient: selectedOrder.recipientName,
                      message: selectedOrder.dedicationMessage,
                      date: `${new Date(selectedOrder.deliveryDate).toLocaleDateString()} - ${selectedOrder.deliveryTime}`,
                    })
                  }
                  className="px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Tarjeta
                </button>
              </div>
              <div className="p-3 bg-white/80 rounded-xl border border-terracotta-100">
                <p className="text-xs italic text-warm-800 font-serif line-clamp-4">&ldquo;{selectedOrder.dedicationMessage}&rdquo;</p>
              </div>
            </div>

            {/* Section 4: Recipe Ingredients Breakdown */}
            {selectedOrder.recipeItems && selectedOrder.recipeItems.length > 0 && (
              <div className="p-4 bg-warm-50 rounded-2xl border border-warm-200 space-y-2 text-xs">
                <h4 className="font-bold text-warm-900">Receta de Insumos Descontados de Inventario:</h4>
                <div className="space-y-1">
                  {selectedOrder.recipeItems.map((r) => (
                    <div key={r.id} className="flex justify-between items-center p-2 bg-white rounded-xl border border-warm-100">
                      <span className="font-medium text-warm-800">
                        {r.rawIngredient?.name || "Insumo Florería"}
                      </span>
                      <span className="font-mono font-bold text-terracotta-700">
                        {r.quantityNeeded} {r.rawIngredient?.unit || "uds"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-2 border-t border-warm-200 flex items-center justify-between gap-2">
              <button
                onClick={() => {
                  const toEdit = selectedOrder;
                  setSelectedOrder(null);
                  setEditingOrder(toEdit);
                }}
                className="px-4 py-2 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-xl text-xs font-bold border border-terracotta-300 transition-all flex items-center gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>Editar Pedido</span>
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-5 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-all"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ORDER MODAL */}
      <EditOrderModal
        isOpen={editingOrder !== null}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
        onSaved={loadOrders}
      />
    </div>
  );
}
