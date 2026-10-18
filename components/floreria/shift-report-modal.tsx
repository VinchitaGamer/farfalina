"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  FileText,
  CheckCircle2
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface ShiftReportData {
  id: string;
  shiftDate: string;
  cashierName: string;
  openingBalance: number;
  closingBalance?: number;
  totalSalesCash: number;
  totalSalesQR: number;
  totalSalesCard?: number;
  totalExpenses: number;
  declaredCash?: number;
  discrepancy?: number;
  notes?: string;
  closedAt?: string | Date;
  createdAt: string | Date;
  tickets?: {
    ticketNumber: string;
    customerName: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string | Date;
  }[];
}

interface ShiftReportModalProps {
  isOpen: boolean;
  shiftReport: ShiftReportData | null;
  onClose: () => void;
}

export default function ShiftReportModal({
  isOpen,
  shiftReport,
  onClose,
}: ShiftReportModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !shiftReport || !mounted) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalSalesAll = shiftReport.totalSalesCash + shiftReport.totalSalesQR + (shiftReport.totalSalesCard || 0);
  const theoreticalCash = shiftReport.openingBalance + shiftReport.totalSalesCash - shiftReport.totalExpenses;
  const declaredCash = shiftReport.declaredCash ?? shiftReport.closingBalance ?? theoreticalCash;
  const discrepancy = shiftReport.discrepancy ?? (declaredCash - theoreticalCash);

  return createPortal(
    <div id="printable-modal-portal">
      <div className="fixed inset-0 z-50 bg-warm-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:p-0 print:bg-white print:static" role="dialog" aria-modal="true">
        <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-6 space-y-5 animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none">
          
          {/* Modal Actions Header (Hidden when printing) */}
          <div className="flex items-center justify-between pb-3 border-b border-warm-200 print:hidden">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-terracotta-600" />
              <h3 className="font-bold text-base text-warm-900">Hoja Oficial de Arqueo de Caja & Cierre de Turno</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5 transition-all"
              >
                <Printer className="h-4 w-4" />
                Imprimir / Exportar PDF (1 Página)
              </button>
              <button onClick={onClose} className="p-1 text-warm-400 hover:text-warm-700 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Printable Official Document Sheet */}
          <div id="printable-shift-sheet-floreria" className="space-y-4 text-warm-950 bg-white print:p-0 print:m-0 print:text-black print:overflow-hidden text-[10.5px] leading-snug">
            {/* Header & Logo */}
            <div className="flex items-start justify-between border-b-2 border-terracotta-600 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-serif font-extrabold tracking-tight text-terracotta-900 uppercase">
                    FLORERÍA FARFALINA
                  </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-terracotta-100 text-terracotta-800 px-2 py-0.5 rounded">
                  POS & Ventas
                </span>
              </div>
              <p className="text-xs font-bold text-warm-700 uppercase tracking-wide">
                Acta Oficial de Arqueo de Caja & Conciliación de Turno
              </p>
              <p className="text-[10px] text-warm-500 font-mono">
                ID Registro: {shiftReport.id} • Fecha Turno: <strong>{shiftReport.shiftDate}</strong>
              </p>
            </div>
            <div className="text-right space-y-1">
              <span className="px-3 py-1 bg-warm-100 text-warm-900 text-xs font-bold rounded-lg border border-warm-300 inline-block font-mono">
                TURNO CONCLUIDO
              </span>
              <p className="text-[11px] font-bold text-warm-800">Cajero: <strong>{shiftReport.cashierName}</strong></p>
              <p className="text-[10px] text-warm-500 font-mono">
                Cierre: {shiftReport.closedAt ? new Date(shiftReport.closedAt).toLocaleString() : new Date().toLocaleString()}
              </p>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-warm-50/80 rounded-2xl border border-warm-200 print:border-warm-400">
              <span className="text-[10px] text-warm-500 uppercase font-bold block">Fondo Apertura:</span>
              <span className="text-sm font-extrabold text-warm-900 font-mono">{formatCurrency(shiftReport.openingBalance)}</span>
            </div>
            <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-200 print:border-warm-400">
              <span className="text-[10px] text-emerald-800 uppercase font-bold block">Ventas Efectivo:</span>
              <span className="text-sm font-extrabold text-emerald-700 font-mono">{formatCurrency(shiftReport.totalSalesCash)}</span>
            </div>
            <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200 print:border-warm-400">
              <span className="text-[10px] text-blue-800 uppercase font-bold block">Ventas QR / Digital:</span>
              <span className="text-sm font-extrabold text-blue-700 font-mono">{formatCurrency(shiftReport.totalSalesQR)}</span>
            </div>
            <div className="p-3 bg-rose-50/80 rounded-2xl border border-rose-200 print:border-warm-400">
              <span className="text-[10px] text-rose-800 uppercase font-bold block">Egresos / Gastos:</span>
              <span className="text-sm font-extrabold text-rose-700 font-mono">-{formatCurrency(shiftReport.totalExpenses)}</span>
            </div>
          </div>

          {/* Balance Reconciliation Table */}
          <div className="p-4 bg-warm-50/80 rounded-2xl border border-warm-200 space-y-3 print:border-warm-400">
            <h4 className="font-bold text-xs uppercase tracking-wider text-warm-900 border-b border-warm-200 pb-1 flex items-center justify-between">
              <span>Liquidación & Balance Financiero de Gaveta</span>
              <span className="text-[10px] text-warm-500 font-normal">Todas las cifras expresadas en Bolivianos (Bs)</span>
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-warm-700">
                <span>(+) Saldo Inicial en Gaveta (Fondo de Cambio):</span>
                <span className="font-mono font-semibold">{formatCurrency(shiftReport.openingBalance)}</span>
              </div>
              <div className="flex justify-between text-warm-700">
                <span>(+) Total Cobros Percibidos en Efectivo:</span>
                <span className="font-mono font-semibold text-emerald-700">+{formatCurrency(shiftReport.totalSalesCash)}</span>
              </div>
              <div className="flex justify-between text-warm-700">
                <span>(+) Total Cobros por QR / Transferencia Bancaria:</span>
                <span className="font-mono font-semibold text-blue-700">+{formatCurrency(shiftReport.totalSalesQR)}</span>
              </div>
              {(shiftReport.totalSalesCard ?? 0) > 0 && (
                <div className="flex justify-between text-warm-700">
                  <span>(+) Total Cobros con Tarjeta POS:</span>
                  <span className="font-mono font-semibold text-indigo-700">+{formatCurrency(shiftReport.totalSalesCard || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-rose-700">
                <span>(-) Retiros / Salidas de Caja Chica:</span>
                <span className="font-mono font-semibold">-{formatCurrency(shiftReport.totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-warm-900 font-extrabold pt-1.5 border-t border-warm-300">
                <span>(=) EFECTIVO TEÓRICO ESPERADO EN GAVETA:</span>
                <span className="font-mono text-terracotta-800 text-sm">{formatCurrency(theoreticalCash)}</span>
              </div>
              <div className="flex justify-between text-warm-900 font-extrabold pt-1">
                <span>(=) EFECTIVO REAL DECLARADO POR EL CAJERO:</span>
                <span className="font-mono text-warm-900 text-sm">{formatCurrency(declaredCash)}</span>
              </div>
            </div>

            {/* Discrepancy Alert Badge */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                Math.abs(discrepancy) < 0.01
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                  : discrepancy > 0
                  ? "bg-blue-100 text-blue-900 border-blue-300"
                  : "bg-rose-100 text-rose-900 border-rose-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {Math.abs(discrepancy) < 0.01
                    ? "Cuadre Exacto de Caja (Sin faltantes ni sobrantes)"
                    : discrepancy > 0
                    ? `Sobrante de Caja Detectado (+${discrepancy.toFixed(2)} Bs)`
                    : `Faltante de Caja Detectado (${discrepancy.toFixed(2)} Bs)`}
                </span>
              </div>
              <span className="font-mono text-sm">{formatCurrency(discrepancy)}</span>
            </div>
          </div>

          {/* Tickets Breakdown Table if present */}
          {shiftReport.tickets && shiftReport.tickets.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-warm-900">
                Detalle de Ventas Registradas en el Turno ({shiftReport.tickets.length} transacciones)
              </h4>
              <div className="border border-warm-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-warm-100 text-warm-800 font-bold border-b border-warm-200 text-[10px] uppercase">
                    <tr>
                      <th className="p-2.5">N° Ticket</th>
                      <th className="p-2.5">Cliente</th>
                      <th className="p-2.5">Método de Pago</th>
                      <th className="p-2.5 text-right">Monto Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-100 text-xs">
                    {shiftReport.tickets.map((t, idx) => (
                      <tr key={idx} className="hover:bg-warm-50">
                        <td className="p-2.5 font-mono font-bold text-warm-900">{t.ticketNumber}</td>
                        <td className="p-2.5">{t.customerName}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 bg-warm-100 rounded text-[10px] font-semibold">
                            {t.paymentMethod}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-terracotta-800">
                          {formatCurrency(t.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          {shiftReport.notes && (
            <div className="p-3 bg-warm-50 rounded-xl border border-warm-200 text-xs">
              <span className="font-bold text-warm-700 block">Observaciones / Justificación de Caja:</span>
              <p className="text-warm-800 italic mt-0.5">&ldquo;{shiftReport.notes}&rdquo;</p>
            </div>
          )}

          {/* Signatures Area for PDF/Print */}
          <div className="pt-10 grid grid-cols-2 gap-8 text-center text-xs font-bold">
            <div className="border-t-2 border-warm-800 pt-3 space-y-1">
              <p className="uppercase">{shiftReport.cashierName}</p>
              <p className="text-[10px] text-warm-600 font-normal">Firma del Cajero Responsable</p>
            </div>
            <div className="border-t-2 border-warm-800 pt-3 space-y-1">
              <p className="uppercase">Supervisión & Administración</p>
              <p className="text-[10px] text-warm-600 font-normal">Florería Farfalina & Carissma</p>
            </div>
          </div>

          <div className="text-center text-[8.5px] text-warm-400 border-t border-warm-200 pt-2 print:block">
            Documento emitido por el Sistema Farfalina & Carissma SaaS • Acta de Control de Auditoría Interna.
          </div>
        </div>
      </div>
    </div>
  </div>,
  document.body
);
}
