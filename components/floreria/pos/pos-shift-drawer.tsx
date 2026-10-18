"use client";

import React, { useState } from "react";
import { Calculator, Lock, Unlock, TrendingUp, History, FileText, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { openCashShiftAction, closeCashShiftAction } from "@/app/actions/pos";
import ShiftReportModal, { ShiftReportData } from "../shift-report-modal";
import type { CashRegisterShift } from "@prisma/client";

interface PosShiftDrawerProps {
  activeShift: CashRegisterShift | null;
  archivedShifts: ShiftReportData[];
  onShiftChange: () => void;
}

export default function PosShiftDrawer({ activeShift, archivedShifts, onShiftChange }: PosShiftDrawerProps) {
  const [openingAmount, setOpeningAmount] = useState<number | string>(350);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  
  const [declaredCash, setDeclaredCash] = useState<number | string>(350);
  const [cashierName, setCashierName] = useState("Agente Lucía");
  const [shiftNotes, setShiftNotes] = useState("Cierre de turno con arqueo diario");
  const [loading, setLoading] = useState(false);
  
  const [shiftReportModalOpen, setShiftReportModalOpen] = useState(false);
  const [activeShiftReport, setActiveShiftReport] = useState<ShiftReportData | null>(null);

  const handleOpenShift = async () => {
    const res = await openCashShiftAction(Number(openingAmount));
    if (res.success) {
      toast.success("Caja abierta correctamente");
      onShiftChange();
    } else {
      toast.error(res.error || "Error al abrir la caja.");
    }
  };

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    setLoading(true);
    const res = await closeCashShiftAction({
      shiftId: activeShift.id,
      declaredCash: Number(declaredCash),
      cashierName: cashierName || "Agente Lucía",
      notes: shiftNotes,
    });

    setLoading(false);

    if (res.success && res.data) {
      toast.success("¡Cierre de caja completado e informe de arqueo generado!");
      setCloseShiftModalOpen(false);

      const reportData = res.data as {
        shift: ShiftReportData;
        theoreticalCash: number;
        discrepancy: number;
        tickets: any[];
      };

      const fullReport: ShiftReportData = {
        ...reportData.shift,
        declaredCash: reportData.shift.declaredCash ?? Number(declaredCash),
        discrepancy: reportData.discrepancy,
        tickets: reportData.tickets.map((t) => ({
          ticketNumber: t.ticketNumber,
          customerName: t.customerName || "Cliente General",
          totalAmount: t.totalAmount,
          paymentMethod: t.paymentMethod,
          createdAt: t.createdAt,
        })),
      };

      setActiveShiftReport(fullReport);
      setShiftReportModalOpen(true);
      onShiftChange();
    } else {
      toast.error(res.error || "Error al cerrar la caja.");
    }
  };

  return (
    <>
      <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-warm-200">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-terracotta-600" />
            <h3 className="font-bold text-sm text-warm-900">Control de Arqueo de Caja Diaria & Informe de Cierre</h3>
          </div>

          {activeShift ? (
            <button
              onClick={() => setCloseShiftModalOpen(true)}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
            >
              <Lock className="h-4 w-4" />
              Cerrar Turno de Caja
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-32 p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold text-warm-900 font-mono focus:outline-none focus:border-terracotta-500"
              />
              <button
                onClick={handleOpenShift}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
              >
                <Unlock className="h-4 w-4" />
                Abrir Nueva Caja
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-warm-50 border border-warm-200">
            <p className="text-xs text-warm-500 font-semibold">Monto de Apertura</p>
            <p className="text-lg font-bold text-warm-900 mt-1">
              {formatCurrency(activeShift?.openingBalance || 0)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Ventas Efectivo
            </p>
            <p className="text-lg font-bold text-emerald-800 mt-1">
              {formatCurrency(activeShift?.totalSalesCash || 0)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700 font-semibold flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Ventas QR / Tarjeta
            </p>
            <p className="text-lg font-bold text-blue-800 mt-1">
              {formatCurrency(activeShift?.totalSalesQR || 0)}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-warm-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-terracotta-600" />
              <h4 className="font-bold text-xs text-warm-900 uppercase tracking-wider">Historial de Cierres de Caja Archivados</h4>
            </div>
            <span className="text-xs text-warm-500 font-bold">{archivedShifts.length} Cierres Registrados</span>
          </div>

          {archivedShifts.length === 0 ? (
            <div className="p-6 text-center text-xs text-warm-400 border border-dashed border-warm-200 rounded-xl">
              No hay cierres de caja archivados aún.
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                  <tr>
                    <th className="p-3">Fecha Cierre</th>
                    <th className="p-3">Cajero</th>
                    <th className="p-3">Apertura</th>
                    <th className="p-3">Ventas Efectivo</th>
                    <th className="p-3">Ventas QR</th>
                    <th className="p-3">Saldo Declarado</th>
                    <th className="p-3">Discrepancia</th>
                    <th className="p-3 text-right">Reporte PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100 text-warm-900 font-medium">
                  {archivedShifts.map((s) => (
                    <tr key={s.id} className="hover:bg-warm-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-warm-800">
                        {s.closedAt ? new Date(s.closedAt).toLocaleString() : s.shiftDate}
                      </td>
                      <td className="p-3 font-semibold">{s.cashierName}</td>
                      <td className="p-3 font-mono text-warm-600">{formatCurrency(s.openingBalance)}</td>
                      <td className="p-3 font-mono text-emerald-700">{formatCurrency(s.totalSalesCash)}</td>
                      <td className="p-3 font-mono text-blue-700">{formatCurrency(s.totalSalesQR)}</td>
                      <td className="p-3 font-mono font-bold text-warm-900">{formatCurrency(s.closingBalance || 0)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            Math.abs(s.discrepancy || 0) < 0.01
                              ? "bg-emerald-100 text-emerald-800"
                              : (s.discrepancy || 0) > 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {formatCurrency(s.discrepancy || 0)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setActiveShiftReport(s);
                            setShiftReportModalOpen(true);
                          }}
                          className="px-3 py-1 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-lg text-[11px] font-bold border border-terracotta-200 transition-all flex items-center gap-1 ml-auto"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Ver / Imprimir PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {archivedShifts.map((s) => (
                <article key={s.id} className="rounded-xl border border-warm-200 bg-warm-50/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm text-warm-800 break-words">
                        {s.closedAt ? new Date(s.closedAt).toLocaleString() : s.shiftDate}
                      </p>
                      <p className="mt-1 font-semibold text-warm-900">{s.cashierName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-warm-500">Discrepancia</p>
                      <span className={`inline-flex px-2 py-1 rounded font-bold text-[10px] ${
                        Math.abs(s.discrepancy || 0) < 0.01
                          ? "bg-emerald-100 text-emerald-800"
                          : (s.discrepancy || 0) > 0
                          ? "bg-blue-100 text-blue-800"
                          : "bg-rose-100 text-rose-800"
                      }`}>{formatCurrency(s.discrepancy || 0)}</span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-warm-200 pt-3 text-xs">
                    <div><dt className="text-warm-500">Apertura</dt><dd className="font-mono text-warm-700">{formatCurrency(s.openingBalance)}</dd></div>
                    <div><dt className="text-warm-500">Ventas efectivo</dt><dd className="font-mono text-emerald-700">{formatCurrency(s.totalSalesCash)}</dd></div>
                    <div><dt className="text-warm-500">Ventas QR</dt><dd className="font-mono text-blue-700">{formatCurrency(s.totalSalesQR)}</dd></div>
                    <div><dt className="text-warm-500">Saldo declarado</dt><dd className="font-mono font-bold text-warm-900">{formatCurrency(s.closingBalance || 0)}</dd></div>
                  </dl>
                  <button
                    onClick={() => {
                      setActiveShiftReport(s);
                      setShiftReportModalOpen(true);
                    }}
                    className="min-h-11 w-full bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-lg text-xs font-bold border border-terracotta-200 transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Ver / Imprimir PDF
                  </button>
                </article>
              ))}
            </div>
            </>
          )}
        </div>
      </div>

      {closeShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Cierre & Arqueo de Caja Registradora</h3>
              <button onClick={() => setCloseShiftModalOpen(false)}>
                <AlertCircle className="h-5 w-5 text-warm-400" />
              </button>
            </div>

            <form onSubmit={handleCloseShiftSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800">Nombre del Cajero / Operador *</label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800">Efectivo Real en Caja al Cerrar (Bs) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={declaredCash}
                  onChange={(e) => setDeclaredCash(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm font-bold text-warm-900 font-mono focus:outline-none focus:border-terracotta-500"
                  required
                />
                <p className="text-[10px] text-warm-500">Ingresa la cantidad física contada en el cajón.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800">Notas / Observaciones del Turno</label>
                <textarea
                  value={shiftNotes}
                  onChange={(e) => setShiftNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900 resize-none focus:outline-none focus:border-terracotta-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCloseShiftModalOpen(false)}
                  disabled={loading}
                  className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5"
                >
                  <Lock className="h-4 w-4" />
                  {loading ? "Procesando..." : "Confirmar Cierre & Generar PDF"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ShiftReportModal
        isOpen={shiftReportModalOpen}
        shiftReport={activeShiftReport}
        onClose={() => setShiftReportModalOpen(false)}
      />
    </>
  );
}
