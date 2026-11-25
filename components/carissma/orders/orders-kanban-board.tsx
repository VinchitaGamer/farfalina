"use client";

import React from "react";
import { ArrowRight, ArrowLeft, Printer, Shield, AlertTriangle, Check, Trash2 } from "lucide-react";
import { formatCurrency, formatDateBolivia, extractCalendarDateStr, getBoliviaDateStr } from "@/lib/utils";
import { BookingItem } from "../orders-view";

interface OrdersKanbanBoardProps {
  filteredBookings: BookingItem[];
  handleAdvanceStatus: (booking: BookingItem, nextStatus: BookingItem["rentalStatus"]) => void;
  handleOpenInspectionModal: (booking: BookingItem) => void;
  setSelectedContractBooking: (booking: BookingItem) => void;
  onDeleteBooking: (booking: BookingItem) => void;
}

export default function OrdersKanbanBoard({
  filteredBookings,
  handleAdvanceStatus,
  handleOpenInspectionModal,
  setSelectedContractBooking,
  onDeleteBooking,
}: OrdersKanbanBoardProps) {
  const [activeStage, setActiveStage] = React.useState<BookingItem["rentalStatus"]>("Reservado");
  const [showAllFinalizado, setShowAllFinalizado] = React.useState(false);
  const todayBolivia = getBoliviaDateStr();
  const stageReservado = filteredBookings.filter((b) => b.rentalStatus === "Reservado");
  const stagePrueba = filteredBookings.filter((b) => b.rentalStatus === "En Prueba");
  const stageEntregado = filteredBookings.filter((b) => b.rentalStatus === "Entregado");
  const stageDevuelto = filteredBookings.filter((b) => b.rentalStatus === "Devuelto / Revisión");
  const stageLavanderia = filteredBookings.filter((b) => b.rentalStatus === "En Lavandería");
  const stageFinalizado = filteredBookings.filter((b) => b.rentalStatus === "Finalizado");

  const stages = [
    { status: "Reservado", label: "1. Reservado", mobileLabel: "Reserva", bookings: stageReservado },
    { status: "En Prueba", label: "2. En Prueba", mobileLabel: "Prueba", bookings: stagePrueba },
    { status: "Entregado", label: "3. Con Clienta", mobileLabel: "Con clienta", bookings: stageEntregado },
    { status: "Devuelto / Revisión", label: "4. Revisión", mobileLabel: "Revisión", bookings: stageDevuelto },
    { status: "En Lavandería", label: "5. Tintorería", mobileLabel: "Tintorería", bookings: stageLavanderia },
    { status: "Finalizado", label: "6. Finalizado", mobileLabel: "Perchero", bookings: stageFinalizado },
  ] as const;

  const renderCardActions = (b: BookingItem) => (
    <div className="flex items-center gap-0.5 shrink-0">
      <button
        type="button"
        onClick={() => setSelectedContractBooking(b)}
        title="Ver / imprimir contrato"
        aria-label={`Ver contrato ${b.contractNumber}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-warm-500 hover:bg-warm-100 hover:text-warm-800 transition-colors"
      >
        <Printer className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onDeleteBooking(b)}
        title="Anular / eliminar reserva"
        aria-label={`Eliminar reserva ${b.contractNumber}`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Etapas de alquiler" className="grid grid-cols-2 gap-2 md:hidden">
        {stages.map((stage) => (
          <button
            key={stage.status}
            type="button"
            aria-pressed={activeStage === stage.status}
            aria-label={`${stage.label}: ${stage.bookings.length} alquileres`}
            title={stage.label}
            onClick={() => setActiveStage(stage.status)}
            className={`flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500 ${
              activeStage === stage.status
                ? "border-amberGold-600 bg-amberGold-600 text-white shadow-warm"
                : "border-warm-200 bg-white text-warm-700 hover:bg-warm-50"
            }`}
          >
            <span className="truncate">{stage.mobileLabel}</span>
            <span
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${
                activeStage === stage.status ? "bg-white/20 text-white" : "bg-amberGold-100 text-amberGold-800"
              }`}
            >
              {stage.bookings.length}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto overscroll-x-contain md:pb-2 xl:overflow-visible">
        <div className="grid grid-cols-1 items-start gap-3 md:min-w-[68rem] md:grid-cols-6 xl:min-w-0">
          {/* 1. Reservado */}
          <div className={`${activeStage === "Reservado" ? "" : "hidden"} min-w-0 space-y-2.5 rounded-2xl border border-warm-200 bg-warm-50/80 p-3 md:block`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-warm-200">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase text-amber-900">1. Reservado</span>
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                {stageReservado.length}
              </span>
            </div>
            {stageReservado.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-warm-400">Sin reservas</p>
            ) : (
              stageReservado.map((b) => (
                <div key={b.id} className="bg-white rounded-xl border border-warm-200 p-2.5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-[10px] font-mono font-bold text-amberGold-800 bg-amberGold-50 px-1.5 py-0.5 rounded truncate">
                      {b.contractNumber}
                    </span>
                    {renderCardActions(b)}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-warm-900 truncate">{b.clientName}</p>
                    <p className="text-[10px] text-warm-500 truncate">{b.dressName}</p>
                  </div>
                  <div className="flex flex-col gap-1 border-t border-warm-100 pt-1.5 text-[10px] text-warm-500">
                    <span>Retiro: {formatDateBolivia(b.rentalStartDate)}</span>
                    <span className="font-bold text-amberGold-800">{formatCurrency(b.rentalPrice)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(b, "En Prueba")}
                    className="flex min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-amber-600 px-2 py-2 text-[10px] font-bold text-white hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                  >
                    <span>Ajuste / Prueba</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 2. En Prueba */}
          <div className={`${activeStage === "En Prueba" ? "" : "hidden"} min-w-0 space-y-2.5 rounded-2xl border border-warm-200 bg-warm-50/80 p-3 md:block`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-warm-200">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase text-orange-900">2. En Prueba</span>
              <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded text-[10px] font-bold">
                {stagePrueba.length}
              </span>
            </div>
            {stagePrueba.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-warm-400">Sin pruebas</p>
            ) : (
              stagePrueba.map((b) => (
                <div key={b.id} className="bg-white rounded-xl border border-warm-200 p-2.5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-[10px] font-mono font-bold text-orange-800 bg-orange-50 px-1.5 py-0.5 rounded truncate">
                      {b.contractNumber}
                    </span>
                    {renderCardActions(b)}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-warm-900 truncate">{b.clientName}</p>
                    <p className="text-[10px] text-warm-500 truncate">{b.dressName}</p>
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(b, "Entregado")}
                      className="flex min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-purple-600 px-2 py-2 text-[10px] font-bold text-white shadow-sm hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                    >
                      <span>Entregar Vestido</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(b, "Reservado")}
                      className="flex min-h-8 w-full items-center justify-center gap-1 rounded-lg bg-warm-100 px-2 py-1 text-[10px] font-bold text-warm-700 hover:bg-warm-200 transition-colors"
                      title="Regresar a 1. Reservado"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Volver a Reserva</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 3. Entregado (Con Clienta) */}
          <div className={`${activeStage === "Entregado" ? "" : "hidden"} min-w-0 space-y-2.5 rounded-2xl border border-warm-200 bg-warm-50/80 p-3 md:block`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-warm-200">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase text-purple-900">3. Con Clienta</span>
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded text-[10px] font-bold">
                {stageEntregado.length}
              </span>
            </div>
            {stageEntregado.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-warm-400">Sin prendas en uso</p>
            ) : (
              stageEntregado.map((b) => {
                const isOverdue = extractCalendarDateStr(b.rentalEndDate) < todayBolivia;
                return (
                  <div key={b.id} className={`bg-white rounded-xl border ${isOverdue ? "border-rose-400 ring-2 ring-rose-100" : "border-warm-200"} p-2.5 space-y-2 shadow-xs`}>
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[10px] font-mono font-bold text-purple-800 bg-purple-50 px-1.5 py-0.5 rounded truncate">
                        {b.contractNumber}
                      </span>
                      {renderCardActions(b)}
                    </div>
                    {isOverdue && (
                      <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                        <AlertTriangle className="h-2.5 w-2.5 text-rose-600" /> Mora vencida
                      </span>
                    )}
                    <div>
                      <p className="font-bold text-xs text-warm-900 truncate">{b.clientName}</p>
                      <p className="text-[10px] text-warm-500 truncate">{b.dressName}</p>
                    </div>
                    <div className="text-[10px] text-warm-500 border-t border-warm-100 pt-1.5">
                      <p>
                        Retorno: <strong className={isOverdue ? "text-rose-700" : "text-warm-800"}>{formatDateBolivia(b.rentalEndDate)}</strong>
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenInspectionModal(b)}
                        className="flex min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-amberGold-600 px-2 py-2 text-[10px] font-bold text-white shadow-warm hover:bg-amberGold-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                      >
                        <Shield className="h-3 w-3" />
                        <span>Recibir Prenda</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(b, "En Prueba")}
                        className="flex min-h-8 w-full items-center justify-center gap-1 rounded-lg bg-warm-100 px-2 py-1 text-[10px] font-bold text-warm-700 hover:bg-warm-200 transition-colors"
                        title="Regresar a 2. En Prueba"
                      >
                        <ArrowLeft className="h-3 w-3" />
                        <span>Volver a Prueba</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 4. Devuelto / Revisión */}
          <div className={`${activeStage === "Devuelto / Revisión" ? "" : "hidden"} min-w-0 space-y-2.5 rounded-2xl border border-warm-200 bg-warm-50/80 p-3 md:block`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-warm-200">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase text-indigo-900">4. Revisión</span>
              <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded text-[10px] font-bold">
                {stageDevuelto.length}
              </span>
            </div>
            {stageDevuelto.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-warm-400">Sin revisiones</p>
            ) : (
              stageDevuelto.map((b) => (
                <div key={b.id} className="bg-white rounded-xl border border-warm-200 p-2.5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded truncate">
                      {b.contractNumber}
                    </span>
                    {renderCardActions(b)}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-warm-900 truncate">{b.dressName}</p>
                    <p className="text-[10px] text-warm-500 truncate">Clienta: {b.clientName}</p>
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(b, "En Lavandería")}
                      className="flex min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-blue-600 px-2 py-2 text-[10px] font-bold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                    >
                      <span>A Tintorería</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(b, "Entregado")}
                      className="flex min-h-8 w-full items-center justify-center gap-1 rounded-lg bg-warm-100 px-2 py-1 text-[10px] font-bold text-warm-700 hover:bg-warm-200 transition-colors"
                      title="Regresar a 3. Con Clienta"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Volver a Clienta</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 5. En Lavandería / Tintorería */}
          <div className={`${activeStage === "En Lavandería" ? "" : "hidden"} min-w-0 space-y-2.5 rounded-2xl border border-warm-200 bg-warm-50/80 p-3 md:block`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-warm-200">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase text-blue-900">5. Tintorería</span>
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                {stageLavanderia.length}
              </span>
            </div>
            {stageLavanderia.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-warm-400">Sin prendas en lavado</p>
            ) : (
              stageLavanderia.map((b) => (
                <div key={b.id} className="bg-white rounded-xl border border-warm-200 p-2.5 space-y-2 shadow-xs">
                  <div className="flex justify-between items-center gap-1">
                    <span className="text-[10px] font-mono font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded truncate">
                      {b.contractNumber}
                    </span>
                    {renderCardActions(b)}
                  </div>
                  <div>
                    <p className="font-bold text-xs text-warm-900 truncate">{b.dressName}</p>
                    <p className="text-[10px] text-warm-500 truncate">Lavado Seco</p>
                  </div>
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(b, "Finalizado")}
                      className="flex min-h-10 w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2 py-2 text-[10px] font-bold text-white shadow-xs hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amberGold-500"
                    >
                      <Check className="h-3 w-3" />
                      <span>Listo en Perchero</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(b, "Devuelto / Revisión")}
                      className="flex min-h-8 w-full items-center justify-center gap-1 rounded-lg bg-warm-100 px-2 py-1 text-[10px] font-bold text-warm-700 hover:bg-warm-200 transition-colors"
                      title="Regresar a 4. Revisión"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Volver a Revisión</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 6. Finalizado */}
          <div className={`${activeStage === "Finalizado" ? "" : "hidden"} min-w-0 space-y-2.5 rounded-2xl border border-warm-200 bg-warm-50/80 p-3 md:block`}>
            <div className="flex items-center justify-between pb-1.5 border-b border-warm-200">
              <span className="min-w-0 truncate text-[11px] font-bold uppercase text-emerald-900">6. Finalizado</span>
              <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                {stageFinalizado.length}
              </span>
            </div>
            {stageFinalizado.length === 0 ? (
              <p className="p-4 text-center text-[11px] text-warm-400">Sin historial</p>
            ) : (
              <>
                {(showAllFinalizado ? stageFinalizado : stageFinalizado.slice(0, 10)).map((b) => (
                  <div key={b.id} className="bg-white rounded-xl border border-warm-200 p-2.5 space-y-1.5 shadow-xs">
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[9px] font-mono text-warm-500 truncate">{b.contractNumber}</span>
                      {renderCardActions(b)}
                    </div>
                    <p className="font-bold text-[11px] text-warm-900 truncate">{b.clientName}</p>
                    <p className="text-[10px] text-warm-500 truncate">{b.dressName}</p>
                    <button
                      type="button"
                      onClick={() => handleAdvanceStatus(b, "En Lavandería")}
                      className="flex min-h-8 w-full items-center justify-center gap-1 rounded-lg bg-warm-100 px-2 py-1 text-[10px] font-bold text-warm-700 hover:bg-warm-200 transition-colors"
                      title="Reabrir en 5. Tintorería"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Volver a Tintorería</span>
                    </button>
                  </div>
                ))}
                {stageFinalizado.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllFinalizado((prev) => !prev)}
                    className="w-full py-1.5 px-2 rounded-xl border border-warm-200 bg-white hover:bg-warm-100 text-[10px] font-bold text-warm-700 transition-colors"
                  >
                    {showAllFinalizado
                      ? "Mostrar últimos 10"
                      : `Ver todos (${stageFinalizado.length})`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
