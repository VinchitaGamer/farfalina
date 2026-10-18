"use client";

import React from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BookingItem } from "../orders-view";

interface OrdersCalendarViewProps {
  currentCalendarDate: Date;
  setCurrentCalendarDate: (date: Date) => void;
  selectedDayEvents: { date: string; bookings: BookingItem[] } | null;
  setSelectedDayEvents: (events: { date: string; bookings: BookingItem[] } | null) => void;
  getBookingsForDay: (day: number) => BookingItem[];
}

export default function OrdersCalendarView({
  currentCalendarDate,
  setCurrentCalendarDate,
  selectedDayEvents,
  setSelectedDayEvents,
  getBookingsForDay,
}: OrdersCalendarViewProps) {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  const now = new Date();

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
    setSelectedDayEvents(null);
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
    setSelectedDayEvents(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-warm-200">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-amberGold-600" />
            <h3 className="font-bold text-base text-warm-900">
              {monthNames[month]} {year}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-lg"
              title="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentCalendarDate(new Date())}
              className="px-2.5 py-1 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-xs font-bold"
            >
              Hoy
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-lg"
              title="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"].map((d) => (
            <div key={d} className="p-2 font-bold text-warm-500 uppercase text-[10px]">
              {d}
            </div>
          ))}

          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="p-2 min-h-16 bg-warm-50/40 rounded-xl" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayBookings = getBookingsForDay(day);
            const isToday =
              day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

            return (
              <div
                key={`day-${day}`}
                onClick={() => {
                  const dayStr = `${day} de ${monthNames[month]}`;
                  setSelectedDayEvents({ date: dayStr, bookings: dayBookings });
                }}
                className={`p-2 min-h-16 rounded-xl border text-left flex flex-col justify-between cursor-pointer transition-all hover:border-amberGold-400 ${
                  isToday
                    ? "bg-amberGold-50/40 border-amberGold-300 ring-2 ring-amberGold-200"
                    : dayBookings.length > 0
                    ? "bg-white border-warm-200"
                    : "bg-white/60 border-warm-100"
                }`}
              >
                <span className={`text-xs font-bold ${isToday ? "text-amberGold-900" : "text-warm-700"}`}>
                  {day}
                </span>

                {dayBookings.length > 0 && (
                  <div className="space-y-0.5">
                    <span className="block px-1.5 py-0.5 bg-amberGold-100 text-amberGold-900 font-bold rounded text-[9px] truncate">
                      {dayBookings.length} evento(s)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Day Drawer/Panel */}
      {selectedDayEvents && (
        <div className="bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center pb-2 border-b border-warm-200">
            <h4 className="font-bold text-sm text-warm-900">
              Alquileres del {selectedDayEvents.date} ({selectedDayEvents.bookings.length})
            </h4>
            <button onClick={() => setSelectedDayEvents(null)}>
              <X className="h-4 w-4 text-warm-400" />
            </button>
          </div>

          {selectedDayEvents.bookings.length === 0 ? (
            <p className="text-xs text-warm-400 py-2">Sin movimientos para este día.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedDayEvents.bookings.map((b) => (
                <div key={b.id} className="p-3 bg-warm-50 rounded-2xl border border-warm-200 text-xs space-y-1.5">
                  <div className="flex justify-between font-bold">
                    <span className="text-amberGold-800 font-mono">{b.contractNumber}</span>
                    <span className="text-[10px] text-warm-600">{b.rentalStatus}</span>
                  </div>
                  <p className="font-bold text-warm-900">{b.clientName}</p>
                  <p className="text-[10px] text-warm-500">{b.dressName} (Talla {b.dressSize})</p>
                  <div className="flex justify-between text-[10px] text-warm-600 border-t border-warm-100 pt-1">
                    <span>Retorno: {new Date(b.rentalEndDate).toLocaleDateString()}</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(b.rentalPrice)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
