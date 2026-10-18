"use client";

import React from "react";
import { Filter, Shield, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { BookingItem } from "../orders-view";

type AgendaFilterMode = "today" | "week" | "month" | "all";

interface OrdersAgendaTableProps {
  agendaFilter: AgendaFilterMode;
  setAgendaFilter: (filter: AgendaFilterMode) => void;
  agendaBookings: BookingItem[];
  handleOpenInspectionModal: (booking: BookingItem) => void;
  setSelectedContractBooking: (booking: BookingItem) => void;
}

export default function OrdersAgendaTable({
  agendaFilter,
  setAgendaFilter,
  agendaBookings,
  handleOpenInspectionModal,
  setSelectedContractBooking,
}: OrdersAgendaTableProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-warm-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:p-4">
        <div className="w-full space-y-2 sm:w-auto sm:space-y-0">
          <span className="flex items-center gap-1 text-xs font-bold text-warm-600">
            <Filter className="h-3.5 w-3.5 text-amberGold-600" /> Filtrar Plazo:
          </span>
          <div className="mt-2 grid w-full grid-cols-2 gap-2 sm:mt-0 sm:flex sm:w-auto">
            {(["all", "today", "week", "month"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                aria-pressed={agendaFilter === filter}
                onClick={() => setAgendaFilter(filter)}
                className={`min-h-11 rounded-xl px-3 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500 sm:flex-1 ${
                  agendaFilter === filter
                    ? "bg-amberGold-600 text-white shadow-warm"
                    : "bg-warm-100 text-warm-700 hover:bg-warm-200"
                }`}
              >
                {filter === "all"
                  ? "Todos"
                  : filter === "today"
                  ? "Hoy"
                  : filter === "week"
                  ? "Esta Semana"
                  : "Este Mes"}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs font-bold text-warm-500">{agendaBookings.length} alquiler(es)</span>
      </div>

      <div className="space-y-3 md:hidden">
        {agendaBookings.length === 0 ? (
          <div className="rounded-2xl border border-warm-200 bg-white p-6 text-center text-sm text-warm-500">
            No hay alquileres para este plazo.
          </div>
        ) : (
          agendaBookings.map((b) => {
            const isOverdue = b.rentalStatus === "Entregado" && new Date(b.rentalEndDate) < new Date();
            return (
              <article key={b.id} className="space-y-3 rounded-2xl border border-warm-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-mono text-sm font-bold text-amberGold-800">{b.contractNumber}</p>
                    {isOverdue && <p className="mt-1 text-xs font-bold text-rose-700">Demora en devolución</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-warm-100 px-2.5 py-1 text-[10px] font-bold text-warm-800">
                    {b.rentalStatus}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="break-words text-sm font-bold text-warm-900">{b.clientName}</p>
                  {b.clientPhone && <p className="mt-0.5 break-all text-xs text-warm-500">{b.clientPhone}</p>}
                  <p className="mt-2 break-words text-sm font-medium text-warm-800">{b.dressName}</p>
                  <p className="text-xs text-warm-500">Talla {b.dressSize} · {b.dressColor}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 border-y border-warm-100 py-3 text-xs">
                  <div className="min-w-0">
                    <p className="text-warm-500">Fechas de renta</p>
                    <p className="mt-1 break-words font-medium text-warm-800">
                      {new Date(b.rentalStartDate).toLocaleDateString()} –{" "}
                      <strong className={isOverdue ? "text-rose-700" : ""}>{new Date(b.rentalEndDate).toLocaleDateString()}</strong>
                    </p>
                  </div>
                  <div>
                    <p className="text-warm-500">Tarifa</p>
                    <p className="mt-1 font-bold text-warm-900">{formatCurrency(b.rentalPrice)}</p>
                  </div>
                  <div>
                    <p className="text-warm-500">Garantía</p>
                    <p className="mt-1 font-bold text-emerald-700">{formatCurrency(b.guaranteeAmount)}</p>
                    <p className="text-[10px] text-warm-500">{b.guaranteeStatus}</p>
                  </div>
                </div>

                <div className={`grid gap-2 ${b.rentalStatus === "Entregado" ? "grid-cols-2" : "grid-cols-1"}`}>
                  {b.rentalStatus === "Entregado" && (
                    <button
                      type="button"
                      onClick={() => handleOpenInspectionModal(b)}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-amberGold-50 px-3 py-2 text-xs font-bold text-amberGold-900 hover:bg-amberGold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      <span>Recibir</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedContractBooking(b)}
                    className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-warm-100 px-3 py-2 text-xs font-bold text-warm-800 hover:bg-warm-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                  >
                    <Printer className="h-4 w-4 shrink-0" />
                    <span>Contrato</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden md:block overflow-hidden rounded-3xl border border-warm-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
              <tr>
                <th className="p-3">Contrato</th>
                <th className="p-3">Clienta</th>
                <th className="p-3">Prenda</th>
                <th className="p-3">Fechas Renta</th>
                <th className="p-3">Tarifa Renta</th>
                <th className="p-3">Garantía</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-warm-100 text-warm-900">
              {agendaBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-sm text-warm-500">
                    No hay alquileres para este plazo.
                  </td>
                </tr>
              ) : agendaBookings.map((b) => {
                const isOverdue = b.rentalStatus === "Entregado" && new Date(b.rentalEndDate) < new Date();
                return (
                  <tr key={b.id} className="hover:bg-warm-50/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-amberGold-800">
                      {b.contractNumber}
                      {isOverdue && (
                        <span className="block text-[9px] text-rose-700 font-bold mt-0.5">⚠️ Demora</span>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-bold">{b.clientName}</p>
                      {b.clientPhone && <p className="text-[10px] text-warm-500">{b.clientPhone}</p>}
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{b.dressName}</p>
                      <p className="text-[10px] text-warm-500">Talla {b.dressSize} • {b.dressColor}</p>
                    </td>
                    <td className="p-3 text-[11px]">
                      {new Date(b.rentalStartDate).toLocaleDateString()} &rarr;{" "}
                      <strong className={isOverdue ? "text-rose-700" : ""}>
                        {new Date(b.rentalEndDate).toLocaleDateString()}
                      </strong>
                    </td>
                    <td className="p-3 font-bold">{formatCurrency(b.rentalPrice)}</td>
                    <td className="p-3">
                      <span className="font-bold text-emerald-700">{formatCurrency(b.guaranteeAmount)}</span>
                      <p className="text-[10px] text-warm-500">{b.guaranteeStatus}</p>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-warm-100 text-warm-800">
                        {b.rentalStatus}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      {b.rentalStatus === "Entregado" && (
                        <button
                          onClick={() => handleOpenInspectionModal(b)}
                          className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-amberGold-50 px-2.5 py-2 text-xs font-bold text-amberGold-900 hover:bg-amberGold-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                        >
                          <Shield className="h-3 w-3" />
                          <span>Recibir</span>
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedContractBooking(b)}
                        className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-warm-100 px-2.5 py-2 text-xs font-bold text-warm-800 hover:bg-warm-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                      >
                        <Printer className="h-3 w-3" />
                        <span>Contrato</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
