"use client";

import React, { useState, useEffect } from "react";
import { X, Check, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { returnRentalDressAction } from "@/app/actions/carissma";
import { toast } from "@/components/ui/toast";
import { BookingItem } from "../orders-view";

interface OrdersInspectionModalProps {
  inspectingBooking: BookingItem | null;
  onClose: () => void;
  onSuccess: () => void;
  lateFeePerDay: number;
}

export default function OrdersInspectionModal({
  inspectingBooking,
  onClose,
  onSuccess,
  lateFeePerDay,
}: OrdersInspectionModalProps) {
  const [returnNotes, setReturnNotes] = useState("");
  const [calculatedLateDays, setCalculatedLateDays] = useState(0);
  const [penaltyFeeInput, setPenaltyFeeInput] = useState<number | string>(0);
  const [guaranteeStatusChoice, setGuaranteeStatusChoice] = useState<"Devuelta" | "Retenida Parcial" | "Retenida Total">("Devuelta");
  const [nextDressStatusChoice, setNextDressStatusChoice] = useState<"En Lavandería" | "Disponible" | "Requiere Mantenimiento">("En Lavandería");
  const [processingReturn, setProcessingReturn] = useState(false);

  useEffect(() => {
    if (inspectingBooking) {
      setReturnNotes("");
      setGuaranteeStatusChoice("Devuelta");
      setNextDressStatusChoice("En Lavandería");

      const end = new Date(inspectingBooking.rentalEndDate);
      const now = new Date();
      const diffMs = now.getTime() - end.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      setCalculatedLateDays(diffDays);
      setPenaltyFeeInput(diffDays * lateFeePerDay);
    }
  }, [inspectingBooking, lateFeePerDay]);

  if (!inspectingBooking) return null;

  const handleConfirmReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingReturn(true);
    const res = await returnRentalDressAction({
      bookingId: inspectingBooking.id,
      penaltyFee: Number(penaltyFeeInput),
      guaranteeStatus: guaranteeStatusChoice,
      nextDressStatus: nextDressStatusChoice,
      notes: returnNotes.trim() || undefined,
    });

    if (res.success) {
      toast.success(`¡Prenda recibida! Enviada a "${nextDressStatusChoice}".`);
      onSuccess();
    } else {
      toast.error(res.error || "Error al procesar devolución");
    }
    setProcessingReturn(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-warm-200">
          <div>
            <h3 className="font-bold text-base text-warm-900">Recepción e Inspección de Prenda</h3>
            <p className="text-xs text-warm-500">Contrato: {inspectingBooking.contractNumber}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-xl text-warm-400 hover:text-warm-800 hover:bg-warm-100 transition-colors active:scale-95 touch-manipulation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmReturn} className="space-y-4 text-xs">
          <div className="p-3 bg-warm-50 rounded-xl space-y-1">
            <p><strong>Clienta:</strong> {inspectingBooking.clientName}</p>
            <p><strong>Prenda:</strong> {inspectingBooking.dressName} ({inspectingBooking.dressSize})</p>
            <p><strong>Garantía Custodiada:</strong> <span className="font-bold text-emerald-700">{formatCurrency(inspectingBooking.guaranteeAmount)}</span></p>
            <p><strong>Fecha Pactada:</strong> {new Date(inspectingBooking.rentalEndDate).toLocaleDateString()}</p>
          </div>

          {calculatedLateDays > 0 ? (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-900">
              <div className="flex items-center gap-1.5 font-bold text-rose-800">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>Retraso Detectado: {calculatedLateDays} día(s) de demora</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Tarifa mora: {formatCurrency(lateFeePerDay)}/día. Penalización sugerida: {formatCurrency(calculatedLateDays * lateFeePerDay)}.
              </p>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Devolución a tiempo dentro del plazo.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-warm-800">Penalización / Daños (Bs)</label>
              <input
                type="text"
                inputMode="decimal"
                value={penaltyFeeInput}
                onChange={(e) => setPenaltyFeeInput(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs font-bold text-rose-700 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-warm-800">Resolución de Garantía *</label>
              <select
                value={guaranteeStatusChoice}
                onChange={(e) =>
                  setGuaranteeStatusChoice(
                    e.target.value as "Devuelta" | "Retenida Parcial" | "Retenida Total"
                  )
                }
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900"
              >
                <option value="Devuelta">Devolver Completa a Clienta</option>
                <option value="Retenida Parcial">Retener Parcialmente</option>
                <option value="Retenida Total">Retener Totalmente</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-warm-800">Destino de la Prenda *</label>
            <select
              value={nextDressStatusChoice}
              onChange={(e) =>
                setNextDressStatusChoice(
                  e.target.value as "En Lavandería" | "Disponible" | "Requiere Mantenimiento"
                )
            }
              className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900"
            >
              <option value="En Lavandería">Enviar a Tintorería / Lavado Seco</option>
              <option value="Disponible">Disponible Directo (Limpia)</option>
              <option value="Requiere Mantenimiento">Requiere Modistería / Arreglo</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-warm-800">Observaciones</label>
            <textarea
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              rows={2}
              className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900"
            />
          </div>

          <div className="pt-3 flex flex-col-reverse sm:flex-row justify-end gap-2 border-t border-warm-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold flex items-center justify-center active:scale-95 touch-manipulation"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processingReturn}
              className="min-h-[44px] px-5 py-2 bg-amberGold-600 hover:bg-amberGold-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-warm flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
            >
              <Check className="h-4 w-4" />
              <span>{processingReturn ? "Procesando..." : "Confirmar Recepción"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
