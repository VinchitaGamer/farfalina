"use client";

import React, { useState, useEffect } from "react";
import { X, RotateCcw, Info, Package, Calculator } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { restockRawIngredientAction } from "@/app/actions/arrangements";
import { formatCurrency } from "@/lib/utils";
import type { InventoryStock } from "./pos-stock-table";

type PosRestockModalProps = {
  isOpen: boolean;
  onClose: () => void;
  stockItem: InventoryStock | null;
  onSuccess: () => void;
};

export default function PosRestockModal({
  isOpen,
  onClose,
  stockItem,
  onSuccess,
}: PosRestockModalProps) {
  const [mode, setMode] = useState<"packages" | "units">("packages");

  // Package purchasing fields
  const [packageCost, setPackageCost] = useState<string>("");
  const [packageCount, setPackageCount] = useState<string>("1");
  const [unitsPerPackage, setUnitsPerPackage] = useState<string>("24");

  // Direct unit fallback fields
  const [restockQty, setRestockQty] = useState<string>("24");
  const [restockCost, setRestockCost] = useState<string>("");

  // Shared fields
  const [salePrice, setSalePrice] = useState<string>("");
  const [restockShelfLife, setRestockShelfLife] = useState<string>("");
  const [isNonPerishable, setIsNonPerishable] = useState<boolean>(false);
  const [recordExpense, setRecordExpense] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stockItem && isOpen) {
      const hasPrevPkg = Boolean(stockItem.packageCost && stockItem.unitsPerPackage);
      setMode(hasPrevPkg ? "packages" : "units");
      setPackageCost(stockItem.packageCost ? String(stockItem.packageCost) : "");
      setPackageCount("1");
      setUnitsPerPackage(stockItem.unitsPerPackage ? String(stockItem.unitsPerPackage) : "24");
      setRestockQty("24");
      setRestockCost(String(stockItem.costPerUnit || 0));
      setSalePrice(stockItem.salePrice ? String(stockItem.salePrice) : "");
      const nonPerish =
        stockItem.shelfLifeDays === null || stockItem.shelfLifeDays === 0 || stockItem.shelfLifeDays === undefined;
      setIsNonPerishable(nonPerish);
      setRestockShelfLife(nonPerish ? "" : String(stockItem.shelfLifeDays));
      setRecordExpense(true);
    }
  }, [stockItem, isOpen]);

  if (!isOpen || !stockItem) return null;

  const numPkgCost = Number(packageCost) || 0;
  const numPkgCount = Math.max(0, parseInt(packageCount, 10) || 0);
  const numUnitsPerPkg = Math.max(0, parseInt(unitsPerPackage, 10) || 0);

  const computedUnits =
    mode === "packages" ? numPkgCount * numUnitsPerPkg : Math.max(0, parseInt(restockQty, 10) || 0);
  const computedTotalCost =
    mode === "packages"
      ? Number((numPkgCost * numPkgCount).toFixed(2))
      : Number((computedUnits * (Number(restockCost) || 0)).toFixed(2));
  const computedUnitCost =
    mode === "packages"
      ? numUnitsPerPkg > 0
        ? Number((numPkgCost / numUnitsPerPkg).toFixed(2))
        : 0
      : Number(restockCost) || 0;

  const handleRestock = async (e: React.FormEvent) => {
    e.preventDefault();

    if (computedUnits <= 0) {
      toast.error("La cantidad total a ingresar debe ser mayor a 0");
      return;
    }

    setLoading(true);
    const res = await restockRawIngredientAction({
      id: stockItem.id,
      quantityToAdd: computedUnits,
      newCostPerUnit: computedUnitCost > 0 ? computedUnitCost : undefined,
      packageCost: mode === "packages" && numPkgCost > 0 ? numPkgCost : undefined,
      packageCount: mode === "packages" && numPkgCount > 0 ? numPkgCount : undefined,
      unitsPerPackage: mode === "packages" && numUnitsPerPkg > 0 ? numUnitsPerPkg : undefined,
      newSalePrice: Number(salePrice) > 0 ? Number(salePrice) : undefined,
      newShelfLifeDays: isNonPerishable ? null : Number(restockShelfLife) > 0 ? Number(restockShelfLife) : undefined,
      recordExpense,
    });

    setLoading(false);

    if (res.success) {
      toast.success(
        `¡Re-Stock de ${stockItem.name} exitoso (+${computedUnits} ${stockItem.unit})${
          recordExpense && computedTotalCost > 0 ? " y registrado en Contabilidad" : ""
        }!`
      );
      onSuccess();
      onClose();
    } else {
      toast.error(res.error || "Error al reabastecer insumo");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-warm-200">
          <div>
            <h3 className="font-bold text-base text-warm-900">Reabastecer Stock (Compra / Re-Stock)</h3>
            <p className="text-xs text-warm-500">{stockItem.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-warm-100 rounded-xl text-warm-400 hover:text-warm-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleRestock} className="space-y-3.5 text-xs">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
            <span className="text-emerald-800 font-semibold">Stock Actual Disponible:</span>
            <span className="font-mono font-bold text-emerald-900 text-sm">
              {stockItem.available} {stockItem.unit}
            </span>
          </div>

          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-1.5 bg-warm-100 p-1 rounded-xl border border-warm-200">
            <button
              type="button"
              onClick={() => setMode("packages")}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === "packages" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>Por Paquetes</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("units")}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === "units" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Por Unidades Directas</span>
            </button>
          </div>

          {mode === "packages" ? (
            <div className="p-3.5 bg-warm-50/90 rounded-2xl border border-warm-200 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">Costo del paquete (Bs) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={packageCost}
                    onChange={(e) => setPackageCost(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Ej: 50"
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">N° de paquetes comprados *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={packageCount}
                    onChange={(e) => setPackageCount(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Ej: 2"
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">
                    Tallos / {stockItem.unit} por paquete *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={unitsPerPackage}
                    onChange={(e) => setUnitsPerPackage(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="Ej: 24"
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">Precio de venta unit. (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Manual (opcional)"
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-emerald-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-warm-200">
                <div className="p-2 bg-white rounded-xl border border-warm-200 text-center">
                  <span className="text-[10px] text-warm-500 block">Total a ingresar</span>
                  <strong className="font-mono text-warm-900">
                    +{computedUnits} {stockItem.unit}
                  </strong>
                </div>
                <div className="p-2 bg-terracotta-50 rounded-xl border border-terracotta-200 text-center">
                  <span className="text-[10px] text-terracotta-700 block font-semibold">Costo Total (Auto)</span>
                  <strong className="font-mono text-terracotta-800">{formatCurrency(computedTotalCost)}</strong>
                </div>
                <div className="p-2 bg-blue-50 rounded-xl border border-blue-200 text-center">
                  <span className="text-[10px] text-blue-700 block font-semibold">Costo Unit. (Auto)</span>
                  <strong className="font-mono text-blue-800">{formatCurrency(computedUnitCost)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-warm-50/90 rounded-2xl border border-warm-200 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">
                    Cantidad ({stockItem.unit}) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={restockQty}
                    onChange={(e) => setRestockQty(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">Costo Unit. (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={restockCost}
                    onChange={(e) => setRestockCost(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">Precio Venta (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="Opcional"
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-emerald-800"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-warm-200">
                <span className="text-warm-600">
                  Nuevo stock total: <strong>{stockItem.available + computedUnits} {stockItem.unit}</strong>
                </span>
                <span className="font-mono font-bold text-terracotta-700">
                  Costo Total: {formatCurrency(computedTotalCost)}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 items-end">
            <label className="flex items-center gap-2 p-2.5 bg-warm-50 rounded-xl border border-warm-200 cursor-pointer">
              <input
                type="checkbox"
                checked={isNonPerishable}
                onChange={(e) => setIsNonPerishable(e.target.checked)}
                className="rounded border-warm-300 h-4 w-4"
              />
              <span className="text-xs font-bold text-warm-800">No Perecedero</span>
            </label>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-warm-800 block">Vida Útil (Días)</label>
              <input
                type="text"
                inputMode="numeric"
                value={isNonPerishable ? "" : restockShelfLife}
                onChange={(e) => setRestockShelfLife(e.target.value.replace(/[^0-9]/g, ""))}
                disabled={isNonPerishable}
                placeholder={isNonPerishable ? "N/A" : "7"}
                className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl font-semibold text-warm-900 font-mono disabled:opacity-50"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 cursor-pointer">
            <input
              type="checkbox"
              checked={recordExpense}
              onChange={(e) => setRecordExpense(e.target.checked)}
              className="rounded border-emerald-400 h-4 w-4 mt-0.5"
            />
            <span className="text-[11px] text-emerald-900 leading-snug">
              <strong>Registrar compra como egreso en Contabilidad</strong> (Insumos/Proveedores:{" "}
              <span className="font-mono font-bold">{formatCurrency(computedTotalCost)}</span>)
            </span>
          </label>

          <div className="p-2.5 bg-warm-50 rounded-xl border border-warm-200 text-[11px] text-warm-600 flex items-center gap-2">
            <Info className="h-4 w-4 text-warm-500 shrink-0" />
            <span>
              Al confirmar el re-stock se guarda el precio histórico para análisis estacional y se actualiza la fecha de frescura.
            </span>
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
