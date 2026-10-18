"use client";

import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { createRentalBookingAction } from "@/app/actions/carissma";
import { toast } from "@/components/ui/toast";
import { DressItem, BookingItem } from "../orders-view";

interface OrdersNewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  dresses: DressItem[];
  defaultRentalDays: number;
  onSuccess: (booking: BookingItem) => void;
}

export default function OrdersNewBookingModal({
  isOpen,
  onClose,
  dresses,
  defaultRentalDays,
  onSuccess,
}: OrdersNewBookingModalProps) {
  const [selectedDressId, setSelectedDressId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + defaultRentalDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [rentalPrice, setRentalPrice] = useState<number | string>(450);
  const [guaranteeAmount, setGuaranteeAmount] = useState<number | string>(500);
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      const available = dresses.filter((d) => d.status === "Disponible");
      if (available.length > 0) {
        const d = available[0];
        setSelectedDressId(d.id);
        setRentalPrice(d.baseRentalPrice || 450);
        setGuaranteeAmount(d.requiredGuarantee || 500);
      }
      setClientName("");
      setClientPhone("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate(new Date(Date.now() + defaultRentalDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
      setPaymentMethod("Efectivo");
      setNotes("");
    }
  }, [isOpen, dresses, defaultRentalDays]);

  if (!isOpen) return null;

  const handleDressChange = (dressId: string) => {
    setSelectedDressId(dressId);
    const d = dresses.find((x) => x.id === dressId);
    if (d) {
      setRentalPrice(d.baseRentalPrice || 450);
      setGuaranteeAmount(d.requiredGuarantee || 500);
    }
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !selectedDressId) {
      toast.error("Completa los datos de la clienta y selecciona una prenda");
      return;
    }

    const res = await createRentalBookingAction({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      dressId: selectedDressId,
      rentalStartDate: startDate,
      rentalEndDate: endDate,
      rentalPrice: Number(rentalPrice),
      guaranteeAmount: Number(guaranteeAmount),
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    if (res.success) {
      toast.success("¡Reserva y Contrato de Alquiler generado exitosamente!");
      onSuccess(res.data as BookingItem);
    } else {
      toast.error(res.error || "Error al crear la reserva");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-4 sm:p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-warm-200">
          <h3 className="font-bold text-base text-warm-900">Nueva Reserva & Contrato de Alquiler</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            className="min-h-[44px] min-w-[44px] p-2 flex items-center justify-center rounded-xl text-warm-400 hover:text-warm-800 hover:bg-warm-100 transition-colors active:scale-95 touch-manipulation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-warm-800">Seleccionar Prenda *</label>
            <select
              value={selectedDressId}
              onChange={(e) => handleDressChange(e.target.value)}
              className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900 font-medium"
              required
            >
              <option value="">-- Seleccionar vestido disponible --</option>
              {dresses.map((d) => (
                <option key={d.id} value={d.id} disabled={d.status !== "Disponible"}>
                  {d.name} ({d.brand} - Talla {d.size}) — {formatCurrency(d.baseRentalPrice || 450)} {d.status !== "Disponible" ? `[${d.status}]` : "✓ Disponible"}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-warm-800">Nombre Clienta *</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="ej: Paola Méndez"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-warm-800">Teléfono / WhatsApp</label>
              <input
                type="tel"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+591 76543210"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-warm-800">Fecha Retiro *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900 font-medium"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-warm-800">Fecha Retorno *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900 font-medium"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-warm-800">Tarifa Renta (Bs) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={rentalPrice}
                onChange={(e) => setRentalPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs font-mono font-bold text-warm-900"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="font-bold text-warm-800">Garantía (Bs) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={guaranteeAmount}
                onChange={(e) => setGuaranteeAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs font-mono font-bold text-emerald-700"
                required
              />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="font-bold text-warm-800">Método Pago *</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as "Efectivo" | "QR" | "Tarjeta")}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs text-warm-900"
              >
                <option value="Efectivo">Efectivo</option>
                <option value="QR">QR</option>
                <option value="Tarjeta">Tarjeta</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-warm-800">Notas / Modistería</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
              className="min-h-[44px] px-5 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl font-bold shadow-warm flex items-center justify-center gap-1.5 active:scale-95 touch-manipulation"
            >
              <Check className="h-4 w-4" />
              <span>Confirmar Reserva</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
