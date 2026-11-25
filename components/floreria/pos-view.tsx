"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { Truck, Receipt, Tag, Plus, ShieldCheck, X, Package, Calculator, Save } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { formatCurrency, getBoliviaDateStr, extractCalendarDateStr, formatDateBolivia } from "@/lib/utils";

import { getShiftStatusAction, getArchivedShiftsAction } from "@/app/actions/pos";
import {
  getRawIngredientsAction,
  getArrangementsAction,
  createRawIngredientAction,
  updateRawIngredientAction,
} from "@/app/actions/arrangements";
import { getOrdersAction } from "@/app/actions/logistics";

import PosCartPanel from "./pos/pos-cart-panel";
import PosStockTable, { InventoryStock } from "./pos/pos-stock-table";
import PosMermaModal from "./pos/pos-merma-modal";
import PosRestockModal from "./pos/pos-restock-modal";
import PosShiftDrawer from "./pos/pos-shift-drawer";

import ChatOrderDrawer from "./chat-order-drawer";
import StockAnalyticsModal from "./stock-analytics-modal";
import type { CashRegisterShift } from "@prisma/client";

export default function PosView() {
  const {
    posActiveTab: posTab,
    setPosActiveTab: setPosTab,
    posStockSearch,
    setPosStockSearch,
    toggleRegister,
  } = useAppStore();

  const [loadingData, setLoadingData] = useState(true);
  const [arrangementsList, setArrangementsList] = useState<any[]>([]);
  const [stockList, setStockList] = useState<InventoryStock[]>([]);
  const [activeShift, setActiveShift] = useState<CashRegisterShift | null>(null);
  const [archivedShifts, setArchivedShifts] = useState<any[]>([]);

  const [mermaModalOpen, setMermaModalOpen] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState("");

  const [restockModalOpen, setRestockModalOpen] = useState(false);
  const [restockStockItem, setRestockStockItem] = useState<InventoryStock | null>(null);

  const [stockAnalyticsModalOpen, setStockAnalyticsModalOpen] = useState(false);
  const [posOrdersModalOpen, setPosOrdersModalOpen] = useState(false);
  const [posOrders, setPosOrders] = useState<any[]>([]);
  const [manualTicketOpen, setManualTicketOpen] = useState(false);

  // Create / Edit Ingredient Modal State
  const [ingModalOpen, setIngModalOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<InventoryStock | null>(null);
  const [pricingMode, setPricingMode] = useState<"packages" | "units">("packages");

  const [ingName, setIngName] = useState("");
  const [ingType, setIngType] = useState<string>("Flor");
  const [ingUnit, setIngUnit] = useState("tallos");
  const [ingWarningThreshold, setIngWarningThreshold] = useState<string>("20");
  const [ingEntryDate, setIngEntryDate] = useState(getBoliviaDateStr());
  const [ingShelfLifeDays, setIngShelfLifeDays] = useState<string>("7");
  const [ingIsNonPerishable, setIngIsNonPerishable] = useState<boolean>(false);

  // 6-Field Package Purchasing Model (per Andrea's Word spec)
  const [pkgCost, setPkgCost] = useState<string>("50");
  const [pkgCount, setPkgCount] = useState<string>("2");
  const [unitsPerPkg, setUnitsPerPkg] = useState<string>("24");
  const [ingSalePrice, setIngSalePrice] = useState<string>("");

  // Direct Units Mode (useful for meters / editing exact count)
  const [directUnits, setDirectUnits] = useState<string>("100");
  const [directUnitCost, setDirectUnitCost] = useState<string>("4.5");
  const [recordExpense, setRecordExpense] = useState<boolean>(true);
  const [savingIng, setSavingIng] = useState(false);

  const [customIngCategories, setCustomIngCategories] = useState<string[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const DEFAULT_ING_CATEGORIES = ["Flor", "Follaje", "Base/Jarrón", "Caja", "Envoltorio", "Cinta", "Accesorio"];
  const allIngredientCategories = Array.from(
    new Set([...DEFAULT_ING_CATEGORIES, ...customIngCategories, ...stockList.map((s) => s.type).filter(Boolean)])
  );

  const loadPosOrders = async () => {
    const res = await getOrdersAction();
    if (res.success && Array.isArray(res.data)) {
      setPosOrders(res.data);
    }
  };

  const loadData = async () => {
    setLoadingData(true);
    const [stockRes, arrRes, shiftRes] = await Promise.all([
      getRawIngredientsAction(),
      getArrangementsAction(),
      getShiftStatusAction(),
    ]);

    if (stockRes.success && Array.isArray(stockRes.data)) setStockList(stockRes.data as InventoryStock[]);
    if (arrRes.success && Array.isArray(arrRes.data)) setArrangementsList(arrRes.data);
    if (shiftRes.success && shiftRes.data) {
      const shiftObj = shiftRes.data as CashRegisterShift;
      setActiveShift(shiftObj);
      toggleRegister(true, shiftObj.openingBalance);
    } else {
      setActiveShift(null);
      toggleRegister(false, 0);
    }
    await loadArchivedShifts();
    setLoadingData(false);
  };

  const loadArchivedShifts = async () => {
    const res = await getArchivedShiftsAction();
    if (res.success && Array.isArray(res.data)) setArchivedShifts(res.data);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedCats = window.localStorage.getItem("farfalina_custom_ing_categories");
        if (savedCats) {
          const parsedCats = JSON.parse(savedCats);
          if (Array.isArray(parsedCats)) {
            setCustomIngCategories(parsedCats.filter((x): x is string => typeof x === "string" && x.trim().length > 0));
          }
        }
      } catch {
        // Ignorar errores de localStorage
      }

      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const searchParam = params.get("search");
      if (tabParam === "stock" || tabParam === "register" || tabParam === "terminal") {
        setPosTab(tabParam);
      }
      if (searchParam !== null) {
        setPosStockSearch(searchParam);
      }
    }
    loadData();
  }, []);

  const openCreateIngredientModal = () => {
    setEditingIngredient(null);
    setPricingMode("packages");
    setIngName("");
    setIngType("Flor");
    setIngUnit("tallos");
    setIngWarningThreshold("20");
    setIngEntryDate(getBoliviaDateStr());
    setIngShelfLifeDays("7");
    setIngIsNonPerishable(false);
    setPkgCost("");
    setPkgCount("1");
    setUnitsPerPkg("24");
    setIngSalePrice("");
    setDirectUnits("100");
    setDirectUnitCost("");
    setRecordExpense(true);
    setIsAddingNewCategory(false);
    setIngModalOpen(true);
  };

  const openEditIngredientModal = (stock: InventoryStock) => {
    setEditingIngredient(stock);
    setPricingMode("units");
    setIngName(stock.name);
    setIngType(stock.type || "Flor");
    setIngUnit(stock.unit || "uds");
    setIngWarningThreshold(String(stock.warningThreshold ?? 15));
    setIngEntryDate(extractCalendarDateStr(stock.entryDate));
    const nonPerish = stock.shelfLifeDays === null || stock.shelfLifeDays === 0 || stock.shelfLifeDays === undefined;
    setIngIsNonPerishable(nonPerish);
    setIngShelfLifeDays(nonPerish ? "" : String(stock.shelfLifeDays));
    setPkgCost(stock.packageCost ? String(stock.packageCost) : "");
    setPkgCount(stock.packageCount ? String(stock.packageCount) : "");
    setUnitsPerPkg(stock.unitsPerPackage ? String(stock.unitsPerPackage) : "");
    setIngSalePrice(stock.salePrice ? String(stock.salePrice) : "");
    setDirectUnits(String(stock.available ?? 0));
    setDirectUnitCost(String(stock.costPerUnit ?? 0));
    setRecordExpense(false);
    setIsAddingNewCategory(false);
    setIngModalOpen(true);
  };

  // Auto-calculated package purchasing numbers
  const numPkgCost = Number(pkgCost) || 0;
  const numPkgCount = Math.max(0, parseInt(pkgCount, 10) || 0);
  const numUnitsPerPkg = Math.max(0, parseInt(unitsPerPkg, 10) || 0);

  const computedTotalCost =
    pricingMode === "packages"
      ? Number((numPkgCost * numPkgCount).toFixed(2))
      : Number(((Number(directUnits) || 0) * (Number(directUnitCost) || 0)).toFixed(2));

  const computedTotalUnits =
    pricingMode === "packages" ? numPkgCount * numUnitsPerPkg : Math.max(0, parseInt(directUnits, 10) || 0);

  const computedUnitCost =
    pricingMode === "packages"
      ? numUnitsPerPkg > 0
        ? Number((numPkgCost / numUnitsPerPkg).toFixed(2))
        : 0
      : Number(directUnitCost) || 0;

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingName.trim()) {
      toast.error("Ingresa el nombre del insumo");
      return;
    }

    setSavingIng(true);

    if (editingIngredient) {
      const res = await updateRawIngredientAction({
        id: editingIngredient.id,
        name: ingName.trim(),
        type: ingType,
        available: computedTotalUnits,
        unit: ingUnit.trim() || "uds",
        warningThreshold: Math.max(0, parseInt(ingWarningThreshold, 10) || 0),
        costPerUnit: computedUnitCost,
        packageCost: pricingMode === "packages" && numPkgCost > 0 ? numPkgCost : null,
        packageCount: pricingMode === "packages" && numPkgCount > 0 ? numPkgCount : null,
        unitsPerPackage: pricingMode === "packages" && numUnitsPerPkg > 0 ? numUnitsPerPkg : null,
        salePrice: Number(ingSalePrice) > 0 ? Number(ingSalePrice) : null,
        entryDate: ingEntryDate,
        shelfLifeDays: ingIsNonPerishable ? null : Number(ingShelfLifeDays) || 7,
      });

      setSavingIng(false);
      if (res.success) {
        toast.success(`Insumo "${ingName.trim()}" actualizado correctamente`);
        setIngModalOpen(false);
        setEditingIngredient(null);
        loadData();
      } else {
        toast.error(res.error || "Error al actualizar el insumo");
      }
      return;
    }

    const res = await createRawIngredientAction({
      name: ingName.trim(),
      type: ingType,
      available: computedTotalUnits,
      unit: ingUnit.trim() || "uds",
      warningThreshold: Math.max(0, parseInt(ingWarningThreshold, 10) || 0),
      costPerUnit: computedUnitCost,
      packageCost: pricingMode === "packages" && numPkgCost > 0 ? numPkgCost : null,
      packageCount: pricingMode === "packages" && numPkgCount > 0 ? numPkgCount : null,
      unitsPerPackage: pricingMode === "packages" && numUnitsPerPkg > 0 ? numUnitsPerPkg : null,
      salePrice: Number(ingSalePrice) > 0 ? Number(ingSalePrice) : null,
      entryDate: ingEntryDate,
      shelfLifeDays: ingIsNonPerishable ? null : Number(ingShelfLifeDays) || 7,
      recordExpense,
    });

    setSavingIng(false);
    if (res.success) {
      toast.success(
        `Insumo "${ingName.trim()}" guardado${
          recordExpense && computedTotalCost > 0 ? " y compra registrada en Contabilidad" : ""
        }`
      );
      setIngModalOpen(false);
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
      try {
        window.localStorage.setItem("farfalina_custom_ing_categories", JSON.stringify(updated));
      } catch {
        // Ignorar errores de localStorage
      }
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
            Ventas rápidas de mostrador, inventario de insumos/compras vinculado a Contabilidad y Arqueo de Caja.
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
          isLoading={loadingData}
          onSaleComplete={loadData}
        />
      )}

      {posTab === "stock" && (
        <PosStockTable
          stockList={stockList}
          searchQuery={posStockSearch}
          setSearchQuery={setPosStockSearch}
          onEditClick={openEditIngredientModal}
          onRestockClick={(stock) => {
            setRestockStockItem(stock);
            setRestockModalOpen(true);
          }}
          onMermaClick={(id) => {
            setSelectedStockId(id);
            setMermaModalOpen(true);
          }}
          onAddIngredientClick={openCreateIngredientModal}
          onAnalyticsClick={() => setStockAnalyticsModalOpen(true)}
          onDataChange={loadData}
        />
      )}

      {posTab === "register" && (
        <PosShiftDrawer activeShift={activeShift} archivedShifts={archivedShifts} onShiftChange={loadData} />
      )}

      {/* Modals Orchestration */}
      <PosMermaModal
        isOpen={mermaModalOpen}
        onClose={() => setMermaModalOpen(false)}
        selectedStockId={selectedStockId}
        stockItem={stockList.find((s) => s.id === selectedStockId) || null}
        onSuccess={loadData}
      />

      <PosRestockModal
        isOpen={restockModalOpen}
        onClose={() => setRestockModalOpen(false)}
        stockItem={restockStockItem}
        onSuccess={loadData}
      />

      <StockAnalyticsModal isOpen={stockAnalyticsModalOpen} onClose={() => setStockAnalyticsModalOpen(false)} />

      <ChatOrderDrawer
        isOpen={manualTicketOpen}
        clientName=""
        clientPhone=""
        channel="Venta POS"
        messages={[]}
        onClose={() => setManualTicketOpen(false)}
        onSuccess={() => {
          toast.success("¡Pedido / Ticket Manual registrado exitosamente!");
          loadData();
        }}
      />

      {/* Create / Edit Ingredient Modal with clear labels & Package Purchasing Formula */}
      {ingModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <div>
                <h3 className="font-bold text-base text-warm-900">
                  {editingIngredient ? `Editar Insumo: ${editingIngredient.name}` : "Agregar Nuevo Insumo al Inventario"}
                </h3>
                <p className="text-[11px] text-warm-500">
                  {editingIngredient
                    ? "Corrige nombre, stock disponible, costos, frescura o categoría sin eliminar el registro."
                    : "Registra compras por paquetes o unidades con cálculo automático de costo unitario y total."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIngModalOpen(false)}
                className="p-1.5 hover:bg-warm-100 rounded-xl text-warm-400 hover:text-warm-700"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIngredient} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800 block">Nombre del Insumo *</label>
                <input
                  type="text"
                  value={ingName}
                  onChange={(e) => setIngName(e.target.value)}
                  placeholder="Ej: Rosas Rojas Importadas, Cinta Satín Dorada..."
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5 text-terracotta-600" />
                    <span>Categoría y Unidad de Medida *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    className="text-[11px] font-bold text-terracotta-600 flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> <span>{isAddingNewCategory ? "Cerrar" : "Nueva Categoría"}</span>
                  </button>
                </div>

                {isAddingNewCategory && (
                  <div className="p-2.5 bg-terracotta-50/70 border border-terracotta-200 rounded-xl flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="flex-1 p-1.5 text-xs bg-white border border-terracotta-200 rounded-lg"
                      placeholder="Nombre de nueva categoría..."
                    />
                    <button
                      type="button"
                      onClick={handleAddIngredientCategory}
                      className="px-2.5 py-1.5 bg-terracotta-500 text-white rounded-lg text-xs font-bold"
                    >
                      Guardar
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-warm-600 block">Categoría</label>
                    <select
                      value={ingType}
                      onChange={(e) => setIngType(e.target.value)}
                      className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-900"
                    >
                      {allIngredientCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-warm-600 block">Unidad (tallos, mts, uds)</label>
                    <input
                      type="text"
                      value={ingUnit}
                      onChange={(e) => setIngUnit(e.target.value)}
                      placeholder="tallos, metros, piezas..."
                      className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Calculation Mode Switcher */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-warm-800 block">Modo de Ingreso y Costo</label>
                <div className="grid grid-cols-2 gap-1.5 bg-warm-100 p-1 rounded-xl border border-warm-200">
                  <button
                    type="button"
                    onClick={() => setPricingMode("packages")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      pricingMode === "packages" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600"
                    }`}
                  >
                    <Package className="h-3.5 w-3.5" />
                    <span>Por Paquetes (Auto)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingMode("units")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      pricingMode === "units" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600"
                    }`}
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    <span>Por Unidades Directas</span>
                  </button>
                </div>
              </div>

              {pricingMode === "packages" ? (
                <div className="p-3.5 bg-warm-50 rounded-2xl border border-warm-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-800 block">1. Costo del paquete (Bs) *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={pkgCost}
                        onChange={(e) => setPkgCost(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="Ej: 50"
                        className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-800 block">2. N° de paquetes comprados *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={pkgCount}
                        onChange={(e) => setPkgCount(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Ej: 2"
                        className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-terracotta-700 block">
                        3. Costo total (Automático)
                      </label>
                      <div className="w-full p-2 bg-terracotta-50 border border-terracotta-200 rounded-xl font-mono font-extrabold text-terracotta-800">
                        {formatCurrency(computedTotalCost)}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-800 block">
                        4. N° de {ingUnit || "tallos"} por paquete *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={unitsPerPkg}
                        onChange={(e) => setUnitsPerPkg(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Ej: 24"
                        className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-blue-700 block">
                        5. Costo unitario (Automático)
                      </label>
                      <div className="w-full p-2 bg-blue-50 border border-blue-200 rounded-xl font-mono font-extrabold text-blue-800">
                        {formatCurrency(computedUnitCost)} / {ingUnit || "u"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-800 block">
                        6. Precio de venta (Bs)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ingSalePrice}
                        onChange={(e) => setIngSalePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="Manual (ej: 8)"
                        className="w-full p-2 bg-white border border-emerald-200 rounded-xl font-mono font-bold text-emerald-900"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-warm-600 pt-1 border-t border-warm-200 flex justify-between">
                    <span>Stock total a registrar:</span>
                    <strong className="font-mono text-warm-900">
                      {computedTotalUnits} {ingUnit || "uds"}
                    </strong>
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-warm-50 rounded-2xl border border-warm-200 space-y-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-800 block">
                        Stock ({ingUnit || "uds"}) *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={directUnits}
                        onChange={(e) => setDirectUnits(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="Ej: 56"
                        className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-warm-800 block">Costo Unit. (Bs) *</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={directUnitCost}
                        onChange={(e) => setDirectUnitCost(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="Ej: 4.5"
                        className="w-full p-2 bg-white border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-emerald-800 block">Precio Venta (Bs)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={ingSalePrice}
                        onChange={(e) => setIngSalePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="Opcional"
                        className="w-full p-2 bg-white border border-emerald-200 rounded-xl font-mono font-bold text-emerald-900"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-warm-600 pt-1 border-t border-warm-200 flex justify-between">
                    <span>Valor total en stock:</span>
                    <strong className="font-mono text-terracotta-700">{formatCurrency(computedTotalCost)}</strong>
                  </p>
                </div>
              )}

              {/* Frescura, Fecha y Alerta */}
              <div className="p-2.5 bg-warm-50 rounded-xl border border-warm-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ingIsNonPerishable}
                    onChange={(e) => setIngIsNonPerishable(e.target.checked)}
                    className="rounded border-warm-300 h-4 w-4"
                  />
                  <span className="text-xs font-bold text-warm-800 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-600" /> Insumo No Perecedero (cintas, cajas, papeles, bases)
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">Fecha Ingreso *</label>
                  <input
                    type="date"
                    value={ingEntryDate}
                    onChange={(e) => setIngEntryDate(e.target.value)}
                    className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">Vida Útil (Días)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={ingIsNonPerishable ? "" : ingShelfLifeDays}
                    onChange={(e) => setIngShelfLifeDays(e.target.value.replace(/[^0-9]/g, ""))}
                    disabled={ingIsNonPerishable}
                    placeholder={ingIsNonPerishable ? "N/A" : "7"}
                    className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs font-mono disabled:opacity-50"
                    required={!ingIsNonPerishable}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800 block">Alerta Stock Mín.</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={ingWarningThreshold}
                    onChange={(e) => setIngWarningThreshold(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="20"
                    className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs font-mono font-bold"
                    required
                  />
                </div>
              </div>

              {!editingIngredient && (
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
              )}

              <div className="pt-2 border-t border-warm-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIngModalOpen(false)}
                  disabled={savingIng}
                  className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingIng}
                  className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {editingIngredient ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  <span>
                    {savingIng
                      ? "Guardando..."
                      : editingIngredient
                      ? "Guardar Cambios"
                      : "Guardar Insumo"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {posOrdersModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Historial de Pedidos & Entregas en Caja</h3>
              <button onClick={() => setPosOrdersModalOpen(false)} className="p-2 hover:bg-warm-100 rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {posOrders.length === 0 ? (
                <div className="p-8 text-center text-xs text-warm-400">No hay pedidos registrados en el sistema.</div>
              ) : (
                posOrders.map((ord) => (
                  <div key={ord.id} className="p-3 bg-warm-50/80 rounded-2xl border border-warm-200 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-mono font-bold text-warm-700">
                        {ord.orderNumber} · {ord.clientName}
                      </span>
                      <span className="font-mono font-bold text-terracotta-700">{formatCurrency(ord.total || 0)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-warm-600">
                      <span>{ord.arrangementName}</span>
                      <span className="font-semibold">{ord.status}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-warm-500 pt-0.5 border-t border-warm-200/60">
                      <span>
                        Entrega: <strong>{formatDateBolivia(ord.deliveryDate)}</strong> · {ord.deliveryTime || "Por coordinar"}
                      </span>
                      <span>{ord.zone || "Tienda Central"} · {ord.paymentMethod}</span>
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
