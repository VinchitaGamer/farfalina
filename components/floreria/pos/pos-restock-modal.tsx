"use client";

import React, { useState, useEffect } from "react";
import { X, RotateCcw, Info } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { restockRawIngredientAction } from "@/app/actions/arrangements";

interface InventoryStock {
  id: string;
  name: string;
  type: string;
  available: number;
  unit: string;
  warningThreshold: number;
  costPerUnit: number;
  entryDate?: string;
  shelfLifeDays?: number;
}

interface PosRestockModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItem: InventoryStock | null;
  onSuccess: () => void;
}

export default function PosRestockModal({
  isOpen,
  onClose,
  stockItem,
  onSuccess
}: PosRestockModalProps) {
  const [restockQty, setRestockQty] = useState<number | string>(24);
  const [restockCost, setRestockCost] = useState<number | string>("");
  const [restockShelfLife, setRestockShelfLife] = useState<number | string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stockItem && isOpen) {
      setRestockQty(24);
      setRestockCost(stockItem.costPerUnit);
      setRestockShelfLife(stockItem.shelfLifeDays || 7);
    }
  }, [stockItem, isOpen]);

  if (!isOpen || !stockItem) return null;

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = Number(restockQty);
    const numCost = Number(restockCost);
    const numShelf = Number(restockShelfLife);

    if (!numQty || numQty <= 0) {
      toast.error("La cantidad a reabastecer debe ser mayor a 0");
      return;
    }

    setLoading(true);
    const res = await restockRawIngredientAction({
      id: stockItem.id,
      quantityToAdd: numQty,
      newCostPerUnit: numCost > 0 ? numCost : undefined,
      newShelfLifeDays: numShelf > 0 ? numShelf : undefined,
    });

    setLoading(false);

    if (res.success) {
      toast.success(`¡Re-Stock de ${stockItem.name} exitoso (+${restockQty} ${stockItem.unit})!`);
      onSuccess();
      onClose();
    } else {
      toast.error(res.error || "Error al reabastecer insumo");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-warm-200">
          <div>
            <h3 className="font-bold text-base text-warm-900">Reabastecer Stock (Re-Stock)</h3>
            <p className="text-xs text-warm-500">{stockItem.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-warm-100 rounded-xl text-warm-400 hover:text-warm-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleRestock} className="space-y-3.5">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs flex justify-between items-center">
            <span className="text-emerald-800 font-semibold">Stock Actual Disponible:</span>
            <span className="font-mono font-bold text-emerald-900 text-sm">
              {stockItem.available} {stockItem.unit}
            </span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-warm-800">
              Cantidad a Ingresar / Reabastecer ({stockItem.unit}) *
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="24"
              className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-sm font-bold text-warm-900 font-mono focus:outline-none focus:border-terracotta-500"
              required
            />
            <p className="text-[10px] text-warm-500">
              Nuevo stock total tras ingreso: <strong>{stockItem.available + (Number(restockQty) || 0)} {stockItem.unit}</strong>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-warm-800">Costo Unitario (Bs)</label>
              <input
                type="text"
                inputMode="decimal"
                value={restockCost}
                onChange={(e) => setRestockCost(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-900 font-mono focus:outline-none focus:border-terracotta-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-warm-800">Vida Útil (Días)</label>
              <input
                type="text"
                inputMode="numeric"
                value={restockShelfLife}
                onChange={(e) => setRestockShelfLife(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="7"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-900 font-mono focus:outline-none focus:border-terracotta-500"
              />
            </div>
          </div>


          <div className="p-2.5 bg-warm-50 rounded-xl border border-warm-200 text-[11px] text-warm-600 flex items-center gap-2">
            <Info className="h-4 w-4 text-warm-500 shrink-0" />
            <span>Al guardar el re-stock, la fecha de ingreso se reiniciará a hoy para mantener el control exacto de frescura.</span>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              {loading ? "Guardando..." : "Confirmar Re-Stock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
