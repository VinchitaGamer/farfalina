"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Lock
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface CarissmaShiftReportData {
  id: string;
  shiftDate: string;
  openedAt: string | Date;
  closedAt?: string | Date | null;
  cashierName: string;
  openingBalance: number;
  totalSalesCash: number;
  totalSalesQR: number;
  totalSalesCard: number;
  totalPenalties: number;
  totalGuaranteesInCustody: number;
  totalGuaranteesReturned: number;
  totalExpenses: number;
  declaredCash?: number | null;
  discrepancy?: number | null;
  notes?: string | null;
}

interface ShiftReportModalProps {
  isOpen: boolean;
  report: CarissmaShiftReportData | null;
  onClose: () => void;
}

export default function ShiftReportModal({ isOpen, report, onClose }: ShiftReportModalProps) {
  const [mounted, setMounted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !report || !mounted) return null;

  const theoreticalCash =
    report.openingBalance +
    (report.totalSalesCash || 0) +
    (report.totalPenalties || 0) +
    (report.totalGuaranteesInCustody || 0) -
    (report.totalGuaranteesReturned || 0) -
    (report.totalExpenses || 0);

  const declaredCash = report.declaredCash ?? theoreticalCash;
  const discrepancy = report.discrepancy ?? (declaredCash - theoreticalCash);

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div id="printable-modal-portal">
      <div
        className="fixed inset-0 z-50 bg-warm-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-2xl w-full max-h-[92dvh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-150 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none">
          {/* Header Bar (Hidden in Print) */}
          <div className="p-4 sm:p-5 border-b border-warm-200 flex items-center justify-between bg-warm-50 print:hidden shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amberGold-600 text-white rounded-2xl shadow-warm">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-warm-900">
                  Acta Oficial de Arqueo & Cierre de Caja
                </h2>
                <p className="text-xs text-warm-500 font-mono">
                  Boutique Carissma • Turno: {report.shiftDate}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-amberGold-600 hover:bg-amberGold-700 active:bg-amberGold-800 text-white text-xs font-bold rounded-xl shadow-warm transition-all flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir / Guardar PDF (1 Página)</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-warm-400 hover:text-warm-800 rounded-xl hover:bg-warm-200 transition-colors"
                aria-label="Cerrar ventana"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Printable Official Document Sheet */}
          <div
            id="printable-shift-sheet-carissma"
            ref={printRef}
            className="p-6 sm:p-8 overflow-y-auto space-y-4 text-warm-950 bg-white print:p-0 print:m-0 print:overflow-hidden text-[10.5px] leading-snug"
          >
            {/* Header & Logo */}
            <div className="flex items-start justify-between border-b-2 border-amberGold-600 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-serif font-extrabold tracking-tight text-amberGold-900 uppercase">
                    CARISSMA
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-amberGold-100 text-amberGold-800 px-2 py-0.5 rounded">
                    Alta Costura
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-warm-700 uppercase tracking-wide">
                  Acta Oficial de Arqueo de Caja & Conciliación de Turno
                </p>
                <p className="text-[9px] text-warm-500 font-mono">
                  ID Registro: {report.id} • Fecha Turno: <strong>{report.shiftDate}</strong>
                </p>
              </div>
              <div className="text-right space-y-0.5">
                <span className="px-2.5 py-0.5 bg-warm-100 text-warm-900 text-xs font-bold rounded-lg border border-warm-300 inline-block font-mono">
                  TURNO CONCLUIDO
                </span>
                <p className="text-[10px] font-bold text-warm-800">Cajera: <strong>{report.cashierName}</strong></p>
                <p className="text-[9px] text-warm-500 font-mono">
                  Cierre: {report.closedAt ? new Date(report.closedAt).toLocaleString() : new Date().toLocaleString()}
                </p>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 bg-warm-50/80 rounded-xl border border-warm-200">
                <span className="text-[9px] text-warm-500 uppercase font-bold block">Fondo Inicial:</span>
                <span className="text-xs font-extrabold text-warm-900 font-mono">{formatCurrency(report.openingBalance)}</span>
              </div>
              <div className="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200">
                <span className="text-[9px] text-emerald-800 uppercase font-bold block">Alquileres Efectivo:</span>
                <span className="text-xs font-extrabold text-emerald-700 font-mono">{formatCurrency(report.totalSalesCash)}</span>
              </div>
              <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200">
                <span className="text-[9px] text-blue-800 uppercase font-bold block">Alquileres QR:</span>
                <span className="text-xs font-extrabold text-blue-700 font-mono">{formatCurrency(report.totalSalesQR)}</span>
              </div>
              <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200">
                <span className="text-[9px] text-amber-800 uppercase font-bold block">Alquileres Tarjeta:</span>
                <span className="text-xs font-extrabold text-amber-700 font-mono">{formatCurrency(report.totalSalesCard)}</span>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="p-3.5 bg-warm-50/80 rounded-xl border border-warm-200 space-y-2.5">
              <h4 className="font-bold text-xs uppercase tracking-wider text-warm-900 border-b border-warm-200 pb-1 flex items-center justify-between">
                <span>Conciliación Financiera y Flujo de Efectivo</span>
                <span className="text-[9.5px] text-warm-500 font-normal">Moneda: Bolivianos (Bs)</span>
              </h4>

              <div className="space-y-1 text-xs font-mono">
                <div className="flex justify-between text-warm-700">
                  <span className="font-sans">(+) Saldo Inicial de Apertura en Gaveta:</span>
                  <span className="font-bold">{formatCurrency(report.openingBalance)}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span className="font-sans">(+) Recaudación Alquileres en Efectivo:</span>
                  <span className="font-bold">+{formatCurrency(report.totalSalesCash || 0)}</span>
                </div>
                <div className="flex justify-between text-amberGold-900">
                  <span className="font-sans">(+) Depósitos de Garantías Recibidas (En Custodia):</span>
                  <span className="font-bold">+{formatCurrency(report.totalGuaranteesInCustody || 0)}</span>
                </div>
                <div className="flex justify-between text-rose-800">
                  <span className="font-sans">(-) Depósitos de Garantías Devueltas a Clientas:</span>
                  <span className="font-bold">-{formatCurrency(report.totalGuaranteesReturned || 0)}</span>
                </div>
                <div className="flex justify-between text-purple-800">
                  <span className="font-sans">(+) Cobro de Penalizaciones / Daños / Mora:</span>
                  <span className="font-bold">+{formatCurrency(report.totalPenalties || 0)}</span>
                </div>
                <div className="flex justify-between text-rose-800">
                  <span className="font-sans">(-) Egresos / Gastos Operativos (Tintorería, etc.):</span>
                  <span className="font-bold">-{formatCurrency(report.totalExpenses || 0)}</span>
                </div>
                <div className="flex justify-between text-blue-700 border-t border-dashed border-warm-300 pt-1">
                  <span className="font-sans">Cobros QR / Digitales (Abonados a Cuenta):</span>
                  <span>{formatCurrency(report.totalSalesQR || 0)}</span>
                </div>
                <div className="flex justify-between text-indigo-700">
                  <span className="font-sans">Cobros con Tarjeta (POS Bancario):</span>
                  <span>{formatCurrency(report.totalSalesCard || 0)}</span>
                </div>

                <div className="flex justify-between text-xs font-extrabold border-t-2 border-warm-800 pt-1.5 text-warm-900 font-sans">
                  <span>(=) EFECTIVO TEÓRICO EN GAVETA:</span>
                  <span className="font-mono text-amberGold-900 text-sm">{formatCurrency(theoreticalCash)}</span>
                </div>

                {declaredCash !== undefined && (
                  <>
                    <div className="flex justify-between font-bold pt-1 text-warm-900 font-sans">
                      <span>(=) EFECTIVO REAL DECLARADO POR CAJERO:</span>
                      <span className="font-mono">{formatCurrency(declaredCash)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-xs pt-1.5 border-t border-warm-300 font-sans">
                      <span>DISCREPANCIA / ESTADO DEL CIERRE:</span>
                      <span
                        className={`font-mono ${
                          discrepancy === 0
                            ? "text-emerald-700"
                            : discrepancy > 0
                            ? "text-blue-700"
                            : "text-rose-700"
                        }`}
                      >
                        {discrepancy === 0
                          ? "✓ Cuadrado (0.00 Bs)"
                          : discrepancy > 0
                          ? `Sobrante: +${formatCurrency(discrepancy)}`
                          : `Faltante: ${formatCurrency(discrepancy)}`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {report.notes && (
              <div className="p-2.5 bg-warm-50 rounded-xl border border-warm-200 text-[9.5px] text-warm-800">
                <strong>Observaciones del Turno:</strong> {report.notes}
              </div>
            )}

            {/* Official Signatures */}
            <div className="pt-4 grid grid-cols-2 gap-8 text-center text-[9.5px] font-bold">
              <div className="border-t-2 border-warm-800 pt-2 space-y-0.5">
                <p className="uppercase text-[10px]">{report.cashierName}</p>
                <p className="text-[8.5px] text-warm-600 font-normal">Firma de la Cajera Responsable</p>
              </div>
              <div className="border-t-2 border-warm-800 pt-2 space-y-0.5">
                <p className="uppercase text-[10px]">Administración Carissma</p>
                <p className="text-[8.5px] text-warm-600 font-normal">Revisión y Conformidad</p>
              </div>
            </div>

            <div className="text-center text-[7.5px] text-warm-400 border-t border-warm-200 pt-1">
              Documento emitido por el Sistema Farfalina & Carissma SaaS • Acta de Control de Auditoría Interna.
            </div>
          </div>

          {/* Modal Footer (Hidden in print) */}
          <div className="p-3.5 border-t border-warm-200 bg-warm-50 flex items-center justify-between print:hidden shrink-0">
            <span className="text-xs text-warm-500 font-medium">
              💡 Puedes imprimir directamente o seleccionar <strong>&quot;Guardar como PDF&quot;</strong>.
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-warm-200 hover:bg-warm-300 text-warm-800 font-bold rounded-xl text-xs transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
