"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { Truck, Receipt, Tag, Plus, AlertCircle, ShieldCheck, X } from "lucide-react";
import { toast } from "@/components/ui/toast";

import { getShiftStatusAction, getArchivedShiftsAction } from "@/app/actions/pos";
import { getRawIngredientsAction, getArrangementsAction, createRawIngredientAction } from "@/app/actions/arrangements";
import { getOrdersAction } from "@/app/actions/logistics";

import PosCartPanel from "./pos/pos-cart-panel";
import PosStockTable from "./pos/pos-stock-table";
import PosMermaModal from "./pos/pos-merma-modal";
import PosRestockModal from "./pos/pos-restock-modal";
import PosShiftDrawer from "./pos/pos-shift-drawer";

import ChatOrderDrawer from "./chat-order-drawer";
import StockAnalyticsModal from "./stock-analytics-modal";
import type { CashRegisterShift } from "@prisma/client";

export default function PosView() {
  const { posActiveTab: posTab, setPosActiveTab: setPosTab, posStockSearch, setPosStockSearch } = useAppStore();

  const [arrangementsList, setArrangementsList] = useState<any[]>([]);
  const [stockList, setStockList] = useState<any[]>([]);
  const [activeShift, setActiveShift] = useState<CashRegisterShift | null>(null);
  const [archivedShifts, setArchivedShifts] = useState<any[]>([]);

  const [mermaModalOpen, setMermaModalOpen] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState("");
  
  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockStockItem, setRestockStockItem] = useState<any | null>(null);

  const [stockAnalyticsModalOpen, setStockAnalyticsModalOpen] = useState(false);
  const [posOrdersModalOpen, setPosOrdersModalOpen] = useState(false);
  const [posOrders, setPosOrders] = useState<any[]>([]);
  const [manualTicketOpen, setManualTicketOpen] = useState(false);

  // New Ingredient Modal State
  const [newIngModalOpen, setNewIngModalOpen] = useState(false);
  const [ingName, setIngName] = useState("");
  const [ingType, setIngType] = useState<string>("Flor");
  const [ingAvailable, setIngAvailable] = useState<number | string>(100);
  const [ingUnit, setIngUnit] = useState("tallos");
  const [ingWarningThreshold, setIngWarningThreshold] = useState<number | string>(20);
  const [ingCostPerUnit, setIngCostPerUnit] = useState<number | string>(4.5);
  const [ingEntryDate, setIngEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [ingShelfLifeDays, setIngShelfLifeDays] = useState<number | string>(7);
  const [ingIsNonPerishable, setIngIsNonPerishable] = useState<boolean>(false);

  const [customIngCategories, setCustomIngCategories] = useState<string[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const DEFAULT_ING_CATEGORIES = ["Flor", "Follaje", "Base/Jarrón", "Accesorio"];
  const allIngredientCategories = Array.from(new Set([...DEFAULT_ING_CATEGORIES, ...customIngCategories, ...stockList.map((s) => s.type).filter(Boolean)]));

  const loadPosOrders = async () => {
    const res = await getOrdersAction();
    if (res.success && Array.isArray(res.data)) {
      setPosOrders(res.data);
    }
  };

  const loadData = async () => {
    const [stockRes, arrRes, shiftRes] = await Promise.all([
      getRawIngredientsAction(),
      getArrangementsAction(),
      getShiftStatusAction(),
    ]);

    if (stockRes.success && Array.isArray(stockRes.data)) setStockList(stockRes.data);
    if (arrRes.success && Array.isArray(arrRes.data)) setArrangementsList(arrRes.data);
    if (shiftRes.success && shiftRes.data) {
      setActiveShift(shiftRes.data as CashRegisterShift);
    } else {
      setActiveShift(null);
    }
    loadArchivedShifts();
  };

  const loadArchivedShifts = async () => {
    const res = await getArchivedShiftsAction();
    if (res.success && Array.isArray(res.data)) setArchivedShifts(res.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingName.trim()) {
      toast.error("Ingresa el nombre del insumo");
      return;
    }

    const res = await createRawIngredientAction({
      name: ingName,
      type: ingType,
      available: Number(ingAvailable),
      unit: ingUnit,
      warningThreshold: Number(ingWarningThreshold),
      costPerUnit: Number(ingCostPerUnit),
      entryDate: ingEntryDate,
      shelfLifeDays: ingIsNonPerishable ? null : Number(ingShelfLifeDays),
    });

    if (res.success) {
      toast.success(`Insumo "${ingName}" agregado al inventario exitosamente`);
      setNewIngModalOpen(false);
      setIngName("");
      loadData();
    } else {
      toast.error(res.error || "Error al crear el insumo");
    }
  };

  const handleAddIngredientCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (!allIngredientCategories.includes(trimmed)) {
      const updated = [...customIngCategories, trimmed];
      setCustomIngCategories(updated);
    }
    setIngType(trimmed);
    setNewCategoryName("");
    setIsAddingNewCategory(false);
    toast.success(`Categoría "${trimmed}" agregada.`);
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-terracotta-100 text-terracotta-700 rounded-md">
              Módulo 2
            </span>
            <h2 className="text-base sm:text-lg font-bold text-warm-900">Punto de Venta (POS) e Inventario</h2>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            Ventas de mostrador, descuento de recetas en bodega y Arqueo de Caja diaria.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => {
              loadPosOrders();
              setPosOrdersModalOpen(true);
            }}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-warm-100 hover:bg-warm-200 text-warm-800 text-xs font-bold rounded-xl border border-warm-300 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Truck className="h-4 w-4 text-terracotta-600" />
            <span>Historial Pedidos</span>
          </button>

          <button
            onClick={() => setManualTicketOpen(true)}
            className="flex-1 sm:flex-none px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl shadow-warm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Receipt className="h-4 w-4" />
            <span>Ticket Manual</span>
          </button>

          <div className="flex items-center gap-1 sm:gap-2 bg-warm-100 p-1 rounded-xl border border-warm-200 overflow-x-auto max-w-full">
            <button
              onClick={() => setPosTab("terminal")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                posTab === "terminal" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              Terminal POS
            </button>
            <button
              onClick={() => setPosTab("stock")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                posTab === "stock" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              Inventario
            </button>
            <button
              onClick={() => setPosTab("register")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                posTab === "register" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              Arqueo
            </button>
          </div>
        </div>
      </div>

      {posTab === "terminal" && (
        <PosCartPanel 
          arrangementsList={arrangementsList} 
          activeShift={activeShift} 
          onSaleComplete={loadData} 
        />
      )}

      {posTab === "stock" && (
        <PosStockTable
          stockList={stockList}
          searchQuery={posStockSearch}
          setSearchQuery={setPosStockSearch}
          onRestockClick={(stock) => { setRestockStockItem(stock); setRestockModalOpen(true); }}
          onMermaClick={(id) => { setSelectedStockId(id); setMermaModalOpen(true); }}
          onAddIngredientClick={() => { setIngIsNonPerishable(false); setNewIngModalOpen(true); }}
          onAnalyticsClick={() => setStockAnalyticsModalOpen(true)}
          onDataChange={loadData}
        />
      )}

      {posTab === "register" && (
        <PosShiftDrawer
          activeShift={activeShift}
          archivedShifts={archivedShifts}
          onShiftChange={loadData}
        />
      )}

      {/* Modals Orchestration */}
      <PosMermaModal
        isOpen={mermaModalOpen}
        onClose={() => setMermaModalOpen(false)}
        selectedStockId={selectedStockId}
        onSuccess={loadData}
      />

      <PosRestockModal
        isOpen={restockModalOpen}
        onClose={() => setRestockModalOpen(false)}
        stockItem={restockStockItem}
        onSuccess={loadData}
      />

      <StockAnalyticsModal
        isOpen={stockAnalyticsModalOpen}
        onClose={() => setStockAnalyticsModalOpen(false)}
      />

      <ChatOrderDrawer
        isOpen={manualTicketOpen}
        clientName="Cliente Venta Directa POS"
        clientPhone=""
        channel="Venta POS"
        messages={[]}
        onClose={() => setManualTicketOpen(false)}
        onSuccess={() => {
          toast.success("¡Ticket Manual generado con receta y descuento de stock!");
          loadData();
        }}
      />

      {/* New Ingredient Modal inline logic retained here to save files, per orchestrator cleanup. */}
      {newIngModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Agregar Nuevo Insumo al Inventario</h3>
              <button onClick={() => setNewIngModalOpen(false)}>
                <AlertCircle className="h-5 w-5 text-warm-400" />
              </button>
            </div>
            <form onSubmit={handleCreateIngredient} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800">Nombre del Insumo *</label>
                <input type="text" value={ingName} onChange={(e) => setIngName(e.target.value)} className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900" required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5 text-terracotta-600" />
                    <span>Categoría del Insumo *</span>
                  </label>
                  <button type="button" onClick={() => setIsAddingNewCategory(!isAddingNewCategory)} className="text-[11px] font-bold text-terracotta-600 flex items-center gap-0.5">
                    <Plus className="h-3 w-3" /> <span>{isAddingNewCategory ? "Cerrar" : "Nueva"}</span>
                  </button>
                </div>
                {isAddingNewCategory && (
                  <div className="p-2.5 bg-terracotta-50/70 border border-terracotta-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-1.5">
                      <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="flex-1 p-1.5 text-xs rounded-lg" placeholder="Nueva..." />
                      <button type="button" onClick={handleAddIngredientCategory} className="px-2.5 py-1.5 bg-terracotta-500 text-white rounded-lg text-xs font-bold">Guardar</button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <select value={ingType} onChange={(e) => setIngType(e.target.value)} className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold">
                    {allIngredientCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="text" value={ingUnit} onChange={(e) => setIngUnit(e.target.value)} placeholder="Unidad" className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium" required />
                </div>
              </div>
              <div className="p-2.5 bg-warm-50 rounded-xl border border-warm-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={ingIsNonPerishable} onChange={(e) => setIngIsNonPerishable(e.target.checked)} className="rounded border-warm-300 h-4 w-4" />
                  <span className="text-xs font-bold text-warm-800 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> No Perecedero</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-800">Fecha de Ingreso *</label>
                  <input type="date" value={ingEntryDate} onChange={(e) => setIngEntryDate(e.target.value)} className="w-full p-2 bg-warm-50 rounded-xl text-xs" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-800">Vida Útil (Días)</label>
                  <input type="text" inputMode="numeric" value={ingIsNonPerishable ? "" : ingShelfLifeDays} onChange={(e) => setIngShelfLifeDays(e.target.value.replace(/[^0-9]/g, ""))} disabled={ingIsNonPerishable} className="w-full p-2 bg-warm-50 rounded-xl text-xs disabled:opacity-50" required={!ingIsNonPerishable} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" inputMode="numeric" value={ingAvailable} onChange={(e) => setIngAvailable(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Inicial" className="w-full p-2 bg-warm-50 rounded-xl text-xs" required />
                <input type="text" inputMode="numeric" value={ingWarningThreshold} onChange={(e) => setIngWarningThreshold(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Alerta" className="w-full p-2 bg-warm-50 rounded-xl text-xs" required />
                <input type="text" inputMode="decimal" value={ingCostPerUnit} onChange={(e) => setIngCostPerUnit(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="Costo" className="w-full p-2 bg-warm-50 rounded-xl text-xs" required />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setNewIngModalOpen(false)} className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl text-xs font-bold">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-terracotta-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"><Plus className="h-4 w-4" /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {posOrdersModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Historial de Pedidos & Entregas en Caja</h3>
              <button onClick={() => setPosOrdersModalOpen(false)} className="p-2 hover:bg-warm-100 rounded-full"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {posOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-warm-400">No hay pedidos registrados en el sistema.</div>
              ) : (
                posOrders.map((ord) => (
                  <div key={ord.id} className="p-3 bg-warm-50/80 rounded-2xl border border-warm-200 text-xs">
                    <div className="flex justify-between">
                      <span className="font-mono font-bold text-warm-600">{ord.orderNumber} - {ord.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
