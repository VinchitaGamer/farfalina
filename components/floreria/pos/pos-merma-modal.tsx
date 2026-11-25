"use client";

import React, { useState, useEffect } from "react";
import { toast } from "@/components/ui/toast";
import { recordMermaAction } from "@/app/actions/pos";
import type { InventoryStock } from "./pos-stock-table";

interface PosMermaModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedStockId: string;
  stockItem?: InventoryStock | null;
  onSuccess: () => void;
}

export default function PosMermaModal({
  isOpen,
  onClose,
  selectedStockId,
  stockItem,
  onSuccess
}: PosMermaModalProps) {
  const [mermaQty, setMermaQty] = useState<string>("1");
  const [mermaReason, setMermaReason] = useState<"Marchitamiento" | "Daño Transporte" | "Defecto">("Marchitamiento");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMermaQty("1");
      setMermaReason("Marchitamiento");
    }
  }, [isOpen, selectedStockId]);

  if (!isOpen) return null;

  const maxAvailable = stockItem?.available ?? Infinity;
  const qtyNum = Number(mermaQty) || 0;

  const handleRecordMerma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockId || loading) return;
    if (qtyNum <= 0) {
      toast.error("Ingresa una cantidad válida mayor a 0.");
      return;
    }
    if (stockItem && qtyNum > stockItem.available) {
      toast.error(`Solo hay ${stockItem.available} ${stockItem.unit} disponibles para dar de baja.`);
      return;
    }

    setLoading(true);
    const res = await recordMermaAction({
      rawIngredientId: selectedStockId,
      quantityLost: qtyNum,
      reason: mermaReason,
    });
    setLoading(false);

    if (res.success) {
      toast.success("Merma registrada y stock actualizado");
      onSuccess();
      onClose();
    } else {
      toast.error(res.error || "Error al registrar la merma.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div>
          <h3 className="font-bold text-base text-warm-900">Registrar Merma de Insumo</h3>
          {stockItem && (
            <p className="text-xs text-warm-600 mt-0.5">
              <strong>{stockItem.name}</strong> · Disponible:{" "}
              <span className="font-mono font-bold text-terracotta-700">
                {stockItem.available} {stockItem.unit}
              </span>
            </p>
          )}
        </div>
        <form onSubmit={handleRecordMerma} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-warm-800">
              Cantidad Descartada {stockItem ? `(${stockItem.unit})` : ""} *
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={mermaQty}
              onChange={(e) => setMermaQty(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="1"
              className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold font-mono focus:outline-none focus:border-terracotta-500"
              required
            />
            {stockItem && qtyNum > maxAvailable && (
              <p className="text-[11px] font-semibold text-rose-600">
                Excede el stock actual ({stockItem.available} {stockItem.unit}).
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-warm-800">Motivo de Descarte</label>
            <select
              value={mermaReason}
              onChange={(e) => setMermaReason(e.target.value as "Marchitamiento" | "Daño Transporte" | "Defecto")}
              className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold"
            >
              <option value="Marchitamiento">Marchitamiento</option>
              <option value="Daño Transporte">Daño Transporte</option>
              <option value="Defecto">Defecto</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-1.5 bg-warm-100 text-warm-800 rounded-xl text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 bg-terracotta-500 text-white rounded-xl text-xs font-bold shadow-warm disabled:opacity-50"
            >
              Confirmar Merma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
