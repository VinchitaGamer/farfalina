"use client";

import React, { useState } from "react";
import { 
  Store, 
  Search, 
  Receipt, 
  Plus, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  RotateCcw, 
  Trash2 
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { deleteRawIngredientAction } from "@/app/actions/arrangements";
import { toast } from "@/components/ui/toast";

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

interface PosStockTableProps {
  stockList: InventoryStock[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onRestockClick: (stock: InventoryStock) => void;
  onMermaClick: (stockId: string) => void;
  onAddIngredientClick: () => void;
  onAnalyticsClick: () => void;
  onDataChange: () => void;
}

export default function PosStockTable({
  stockList,
  searchQuery,
  setSearchQuery,
  onRestockClick,
  onMermaClick,
  onAddIngredientClick,
  onAnalyticsClick,
  onDataChange
}: PosStockTableProps) {
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);

  const handleDeleteIngredient = async (id: string, name: string) => {
    const ok = await confirm(`¿Estás seguro de eliminar el insumo "${name}" del inventario? Esta acción también limpiará su historial de merma asociado.`);
    if (!ok) return;

    setLoading(true);
    const res = await deleteRawIngredientAction(id);
    if (res.success) {
      toast.success(`Insumo "${name}" eliminado del inventario`);
      onDataChange();
    } else {
      toast.error(res.error || "Error al eliminar insumo");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl border border-warm-200 shadow-sm space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-warm-200 gap-3">
        <div>
          <h3 className="font-bold text-sm sm:text-base text-warm-900">Inventario Vivo de Insumos & Control de Stock</h3>
          <p className="text-xs text-warm-500">Gestión de re-stock, mermas y auditoría de consumos diarios.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <Search className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar insumo..."
              className="w-full pl-8 pr-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
            />
          </div>
          <button
            onClick={onAnalyticsClick}
            className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 touch-manipulation active:scale-98"
          >
            <Receipt className="h-4 w-4" />
            <span>Análisis (Excel/PDF)</span>
          </button>
          <button
            onClick={onAddIngredientClick}
            className="flex-1 sm:flex-none min-h-[44px] sm:min-h-[36px] px-3.5 py-2 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white rounded-xl text-xs font-bold shadow-warm transition-all flex items-center justify-center gap-1.5 touch-manipulation active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>Agregar Nuevo Insumo</span>
          </button>
        </div>
      </div>

      {stockList.length === 0 ? (
        <div className="p-12 text-center bg-warm-50 rounded-2xl border border-dashed border-warm-200 space-y-2">
          <Store className="h-8 w-8 text-warm-300 mx-auto" />
          <p className="text-xs font-bold text-warm-700">No hay insumos registrados en el inventario.</p>
          <p className="text-[11px] text-warm-500 max-w-sm mx-auto">
            Haz clic en <strong>"Agregar Nuevo Insumo"</strong> para registrar tus flores, follajes, bases o accesorios.
          </p>
          <button
            onClick={onAddIngredientClick}
            className="mt-2 min-h-[44px] px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm inline-flex items-center gap-1.5 touch-manipulation active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Primer Insumo</span>
          </button>
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                <tr>
                  <th className="p-3">Código</th>
                  <th className="p-3">Insumo / Ítem</th>
                  <th className="p-3">Categoría</th>
                  <th className="p-3">Disponible</th>
                  <th className="p-3">Costo Unit.</th>
                  <th className="p-3">Fecha Ingreso</th>
                  <th className="p-3">Vida Útil / Frescura</th>
                  <th className="p-3">Estado Stock</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100 text-warm-900">
                {stockList
                  .filter((stk) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
                    return stk.name.toLowerCase().includes(q) || stk.type.toLowerCase().includes(q);
                  })
                  .map((stk) => {
                    const entryDateObj = stk.entryDate ? new Date(stk.entryDate) : new Date();
                    const now = new Date();
                    const diffDays = Math.floor((now.getTime() - entryDateObj.getTime()) / (1000 * 3600 * 24));
                    const isNonPerishable = stk.shelfLifeDays === null || stk.shelfLifeDays === 0 || stk.shelfLifeDays === undefined;
                    const daysLeft = isNonPerishable ? 999 : (stk.shelfLifeDays || 7) - diffDays;

                    return (
                      <tr key={stk.id} className="hover:bg-warm-50/60 transition-colors">
                        <td className="p-3 font-mono text-warm-500">{stk.id.slice(-6)}</td>
                        <td className="p-3 font-bold">{stk.name}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-warm-100 text-warm-800 rounded font-medium text-[11px]">
                            {stk.type}
                          </span>
                        </td>
                        <td className="p-3 font-semibold">{stk.available} {stk.unit}</td>
                        <td className="p-3 font-mono text-warm-700">{formatCurrency(stk.costPerUnit)}</td>
                        <td className="p-3 font-mono text-warm-600">
                          {entryDateObj.toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          {isNonPerishable ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold rounded border border-slate-200 text-[10px] inline-flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-slate-500" />
                              <span>No Perecedero</span>
                            </span>
                          ) : daysLeft > 3 ? (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200 text-[10px] inline-flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Fresco ({daysLeft}d rest.)</span>
                            </span>
                          ) : daysLeft > 0 ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold rounded border border-amber-200 text-[10px] inline-flex items-center gap-1">
                              <AlertCircle className="h-3 w-3 text-amber-600" />
                              <span>Próx. Vencer ({daysLeft}d)</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded border border-rose-200 text-[10px] inline-flex items-center gap-1">
                              <XCircle className="h-3 w-3 text-rose-600" />
                              <span>Vencido ({Math.abs(daysLeft)}d)</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {stk.available <= 0 ? (
                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-bold">
                              <XCircle className="h-3 w-3" /> Agotado (0)
                            </span>
                          ) : stk.available <= stk.warningThreshold ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                              <AlertCircle className="h-3 w-3" /> Stock Bajo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                              <CheckCircle2 className="h-3 w-3" /> Disponible
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={loading}
                              onClick={() => onRestockClick(stk)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold transition-all border border-emerald-200 flex items-center gap-1"
                              title="Reabastecer / Ingresar más unidades"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Re-Stock</span>
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => onMermaClick(stk.id)}
                              className="px-2 py-1 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-[11px] font-semibold transition-all border border-warm-200"
                              title="Registrar merma o descarte"
                            >
                              Merma
                            </button>
                            <button
                              disabled={loading}
                              onClick={() => handleDeleteIngredient(stk.id, stk.name)}
                              className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all border border-transparent hover:border-rose-200"
                              title="Eliminar insumo del inventario"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Touch Cards (< 768px) */}
          <div className="block md:hidden space-y-3">
            {stockList
              .filter((stk) => {
                if (!searchQuery.trim()) return true;
                const q = searchQuery.toLowerCase();
                return stk.name.toLowerCase().includes(q) || stk.type.toLowerCase().includes(q);
              })
              .map((stk) => {
                const entryDateObj = stk.entryDate ? new Date(stk.entryDate) : new Date();
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - entryDateObj.getTime()) / (1000 * 3600 * 24));
                const isNonPerishable = stk.shelfLifeDays === null || stk.shelfLifeDays === 0 || stk.shelfLifeDays === undefined;
                const daysLeft = isNonPerishable ? 999 : (stk.shelfLifeDays || 7) - diffDays;

                return (
                  <div key={stk.id} className="bg-warm-50/70 p-4 rounded-2xl border border-warm-200 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm text-warm-900 leading-snug">{stk.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-2 py-0.5 bg-warm-100 text-warm-800 rounded font-medium text-[11px]">
                            {stk.type}
                          </span>
                          <span className="text-[10px] text-warm-400 font-mono">ID: {stk.id.slice(-6)}</span>
                        </div>
                      </div>
                      <div>
                        {stk.available <= 0 ? (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 font-bold text-xs">
                            <XCircle className="h-3.5 w-3.5" /> Agotado
                          </span>
                        ) : stk.available <= stk.warningThreshold ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 font-semibold text-xs">
                            <AlertCircle className="h-3.5 w-3.5" /> Stock Bajo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 font-semibold text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Disponible
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-warm-100">
                      <div>
                        <span className="text-[10px] text-warm-500 block">Stock Disponible</span>
                        <span className="font-bold text-warm-900 text-sm">
                          {stk.available} <span className="text-xs font-normal text-warm-600">{stk.unit}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-warm-500 block">Costo Unitario</span>
                        <span className="font-bold text-warm-900 font-mono text-sm">{formatCurrency(stk.costPerUnit)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-warm-500 block">Fecha Ingreso</span>
                        <span className="font-medium text-warm-700 font-mono">{entryDateObj.toLocaleDateString()}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-warm-500 block">Frescura / Vida Útil</span>
                        {isNonPerishable ? (
                          <span className="text-slate-700 font-bold text-[11px] inline-flex items-center gap-1">
                            <ShieldCheck className="h-3.5 w-3.5 text-slate-500" /> No Perecedero
                          </span>
                        ) : daysLeft > 3 ? (
                          <span className="text-emerald-700 font-bold text-[11px] inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Fresco ({daysLeft}d)
                          </span>
                        ) : daysLeft > 0 ? (
                          <span className="text-amber-700 font-bold text-[11px] inline-flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-600" /> Próx. Vencer ({daysLeft}d)
                          </span>
                        ) : (
                          <span className="text-rose-700 font-bold text-[11px] inline-flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5 text-rose-600" /> Vencido ({Math.abs(daysLeft)}d)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        disabled={loading}
                        onClick={() => onRestockClick(stk)}
                        className="flex-1 min-h-[44px] bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-bold transition-all border border-emerald-200 flex items-center justify-center gap-1.5 touch-manipulation active:scale-98"
                        title="Reabastecer / Ingresar más unidades"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Re-Stock</span>
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => onMermaClick(stk.id)}
                        className="flex-1 min-h-[44px] bg-warm-100 hover:bg-warm-200 active:bg-warm-300 text-warm-800 rounded-xl text-xs font-bold transition-all border border-warm-200 flex items-center justify-center gap-1.5 touch-manipulation active:scale-98"
                        title="Registrar merma o descarte"
                      >
                        Merma
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => handleDeleteIngredient(stk.id, stk.name)}
                        className="min-h-[44px] min-w-[44px] p-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 rounded-xl transition-all border border-rose-200 flex items-center justify-center touch-manipulation active:scale-95"
                        title="Eliminar insumo del inventario"
                        aria-label="Eliminar insumo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
