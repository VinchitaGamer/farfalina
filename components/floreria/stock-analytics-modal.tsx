"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Boxes,
  Download,
  History,
} from "lucide-react";
import {
  getIngredientConsumptionAnalyticsAction,
  ConsumptionRow,
  InventoryProductRow,
  PurchaseHistoryRow,
} from "@/app/actions/arrangements";
import { formatCurrency, getBoliviaDateStr } from "@/lib/utils";
import { downloadExcelCsv } from "@/lib/export-csv";
import { toast } from "@/components/ui/toast";

type StockAnalyticsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function StockAnalyticsModal({ isOpen, onClose }: StockAnalyticsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "purchases" | "movements">("inventory");
  const [filterMode, setFilterMode] = useState<"today" | "week" | "month" | "custom">("month");
  const [categoryFilter, setCategoryFilter] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  const todayStr = getBoliviaDateStr();
  const firstOfMonth = `${todayStr.slice(0, 7)}-01`;

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayStr);

  const [loading, setLoading] = useState(false);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProductRow[]>([]);
  const [rows, setRows] = useState<ConsumptionRow[]>([]);
  const [purchaseLogs, setPurchaseLogs] = useState<PurchaseHistoryRow[]>([]);
  const [summary, setSummary] = useState({
    totalStockUnits: 0,
    totalStockValuationBs: 0,
    totalProductsCount: 0,
    totalLowStockCount: 0,
    totalUnits: 0,
    totalCostBs: 0,
    totalMermas: 0,
    totalPurchasedBs: 0,
    topConsumedName: "Ninguno",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      applyFilter(filterMode);
    }
  }, [isOpen, filterMode]);

  const applyFilter = (mode: "today" | "week" | "month" | "custom") => {
    setFilterMode(mode);
    const now = new Date();
    const eDate = getBoliviaDateStr(now);
    let sDate = startDate;

    if (mode === "today") {
      sDate = eDate;
    } else if (mode === "week") {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      sDate = getBoliviaDateStr(past7);
    } else if (mode === "month") {
      sDate = `${eDate.slice(0, 7)}-01`;
    }

    setStartDate(sDate);
    setEndDate(eDate);
    fetchAnalytics(sDate, eDate);
  };

  const fetchAnalytics = async (s: string, e: string) => {
    setLoading(true);
    const res = await getIngredientConsumptionAnalyticsAction({
      startDate: s,
      endDate: e,
    });

    if (res.success && res.data) {
      setInventoryProducts(res.data.inventoryProducts || []);
      setRows(res.data.rows || []);
      setPurchaseLogs(res.data.purchaseLogs || []);
      setSummary(
        res.data.summary || {
          totalStockUnits: 0,
          totalStockValuationBs: 0,
          totalProductsCount: 0,
          totalLowStockCount: 0,
          totalUnits: 0,
          totalCostBs: 0,
          totalMermas: 0,
          totalPurchasedBs: 0,
          topConsumedName: "Ninguno",
        }
      );
    } else {
      toast.error(res.error || "Error al cargar analítica de inventario");
    }
    setLoading(false);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics(startDate, endDate);
  };

  const handlePrint = () => {
    window.print();
  };

  const dynamicCategories = useMemo(() => {
    const types = Array.from(new Set(inventoryProducts.map((p) => p.type).filter(Boolean))).sort();
    return ["Todos", ...types];
  }, [inventoryProducts]);

  // Filtered inventory products
  const filteredProducts = useMemo(() => {
    return inventoryProducts.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.type.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;
      if (categoryFilter === "Todos") return true;
      if (categoryFilter === "low_stock") return p.status === "Stock Bajo" || p.status === "Agotado";
      return p.type === categoryFilter;
    });
  }, [inventoryProducts, searchQuery, categoryFilter]);

  const filteredPurchases = useMemo(() => {
    return purchaseLogs.filter((log) => {
      const matchSearch =
        log.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.ingredientType.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (categoryFilter === "Todos" || categoryFilter === "low_stock") return true;
      return log.ingredientType === categoryFilter;
    });
  }, [purchaseLogs, searchQuery, categoryFilter]);

  const filteredMovements = useMemo(() => {
    return rows.filter((r) => {
      const matchSearch =
        r.ingredientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.type.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (categoryFilter === "Todos" || categoryFilter === "low_stock") return true;
      return r.type === categoryFilter;
    });
  }, [rows, searchQuery, categoryFilter]);

  const handleExportExcel = () => {
    if (activeTab === "inventory") {
      downloadExcelCsv(
        `inventario-farfalina-${startDate}-a-${endDate}.csv`,
        [
          "Insumo",
          "Categoría",
          "Stock Disponible",
          "Unidad",
          "Estado",
          "Costo Paquete (Bs)",
          "Paquetes",
          "Uds/Paquete",
          "Costo Unitario (Bs)",
          "Precio Venta (Bs)",
          "Valor Almacén (Bs)",
          "Fecha Ingreso",
          "Vida Útil (Días)",
          "Mermas Período",
        ],
        filteredProducts.map((p) => [
          p.name,
          p.type,
          p.available,
          p.unit,
          p.status,
          p.packageCost ?? "",
          p.packageCount ?? "",
          p.unitsPerPackage ?? "",
          p.unitCost,
          p.salePrice ?? "",
          Number(p.stockValueBs.toFixed(2)),
          p.entryDate,
          p.shelfLifeDays ?? "No Perecedero",
          p.mermaLostQty,
        ])
      );
      toast.success("Archivo Excel (.csv) de Inventario descargado");
      return;
    }

    if (activeTab === "purchases") {
      downloadExcelCsv(
        `historial-precios-compras-farfalina-${startDate}-a-${endDate}.csv`,
        [
          "Fecha Compra",
          "Insumo",
          "Categoría",
          "Unidad",
          "Costo Paquete (Bs)",
          "N° Paquetes",
          "Uds/Paquete",
          "Total Unidades",
          "Costo Unitario (Bs)",
          "Costo Total Compra (Bs)",
          "Precio Venta (Bs)",
          "Notas",
        ],
        filteredPurchases.map((p) => [
          p.purchasedAt,
          p.ingredientName,
          p.ingredientType,
          p.unit,
          p.packageCost ?? "",
          p.packageCount ?? "",
          p.unitsPerPackage ?? "",
          p.totalUnits,
          p.unitCost,
          p.totalCost,
          p.salePrice ?? "",
          p.notes ?? "",
        ])
      );
      toast.success("Archivo Excel (.csv) de Historial de Compras y Precios descargado");
      return;
    }

    downloadExcelCsv(
      `movimientos-inventario-farfalina-${startDate}-a-${endDate}.csv`,
      ["Fecha", "Insumo", "Categoría", "Unidad", "Ventas POS", "Pedidos", "Mermas", "Total Uds", "Costo Unit. (Bs)", "Costo Total (Bs)"],
      filteredMovements.map((r) => [
        r.date,
        r.ingredientName,
        r.type,
        r.unit,
        r.posSoldQty,
        r.orderUsedQty,
        r.mermaLostQty,
        r.totalQuantity,
        r.unitCost,
        Number(r.totalCostBs.toFixed(2)),
      ])
    );
    toast.success("Archivo Excel (.csv) de Movimientos Diarios descargado");
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div id="printable-modal-portal">
      <style jsx global>{`
        @media print {
          @page {
            size: letter landscape;
            margin: 6mm 10mm;
          }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static"
        role="dialog"
        aria-modal="true"
      >
        <div
          id="printable-stock-analytics-sheet"
          className="bg-white rounded-2xl sm:rounded-3xl border border-warm-200 shadow-2xl w-full max-w-6xl overflow-y-auto flex flex-col max-h-[94dvh] print:overflow-visible print:max-h-none print:border-none print:shadow-none print:w-full"
        >
          {/* Modal Header (Hidden on Print) */}
          <div className="p-4 sm:p-5 bg-warm-50 border-b border-warm-200 flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl shadow-sm">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm sm:text-base text-warm-900">
                    Control de Inventario, Precios Históricos & Exportación
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-mono">
                    {inventoryProducts.length} Insumos Activos
                  </span>
                </div>
                <p className="text-xs text-warm-500">
                  Descarga tu inventario y precios históricos de compra en Excel (.csv) o PDF para cotizaciones de temporada.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportExcel}
                className="px-3.5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                title="Descargar tabla actual en formato Excel (.csv)"
              >
                <Download className="h-4 w-4" />
                <span>Descargar Excel (.csv)</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center gap-1.5"
                title="Imprimir o guardar en PDF"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir / PDF</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-warm-200 text-warm-500 hover:text-warm-900 rounded-xl transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Official Document Header (Visible ONLY on Print) */}
          <div className="hidden print:block p-3 border-b-2 border-warm-900 mb-2">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-lg font-bold tracking-tight text-warm-900 uppercase font-serif">
                  FLORERÍA FARFALINA • REPORTE DE INVENTARIO Y PRECIOS HISTÓRICOS
                </h1>
                <p className="text-[9.5px] text-warm-500 mt-0.5 font-mono">
                  Período Analizado: <strong>{startDate}</strong> al <strong>{endDate}</strong> • {inventoryProducts.length} Ítems
                </p>
              </div>
              <div className="text-right text-xs font-mono">
                <p className="font-bold text-warm-900">Emisión: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Top Tabs Switcher (Hidden in Print) */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2 bg-warm-100/70 border-b border-warm-200 print:hidden">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("inventory")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "inventory"
                    ? "bg-white text-emerald-800 shadow-sm border border-warm-300"
                    : "text-warm-600 hover:text-warm-900"
                }`}
              >
                <Boxes className="h-3.5 w-3.5" />
                <span>Inventario Actual ({inventoryProducts.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("purchases")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "purchases"
                    ? "bg-white text-terracotta-700 shadow-sm border border-warm-300"
                    : "text-warm-600 hover:text-warm-900"
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>Historial Compras & Precios ({purchaseLogs.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("movements")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "movements"
                    ? "bg-white text-blue-800 shadow-sm border border-warm-300"
                    : "text-warm-600 hover:text-warm-900"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Movimientos & Mermas ({rows.length})</span>
              </button>
            </div>

            <div className="text-[11px] text-warm-600 font-mono hidden sm:block">
              Valor Almacén: <strong>{formatCurrency(summary.totalStockValuationBs)}</strong>
            </div>
          </div>

          {/* Summary Metric Cards */}
          <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-warm-50/50 border-b border-warm-200 print:bg-white print:p-1.5">
            <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-warm-200 shadow-sm">
              <span className="text-[9.5px] text-emerald-700 font-bold uppercase tracking-wider block">
                Valor Total Almacén
              </span>
              <p className="text-sm sm:text-base font-extrabold text-emerald-800 mt-0.5 font-mono">
                {formatCurrency(summary.totalStockValuationBs)}
              </p>
              <span className="text-[9px] text-warm-500 block font-mono">
                {summary.totalStockUnits.toLocaleString()} unidades físicas
              </span>
            </div>

            <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-warm-200 shadow-sm">
              <span className="text-[9.5px] text-terracotta-700 font-bold uppercase tracking-wider block">
                Compras en Período
              </span>
              <p className="text-sm sm:text-base font-extrabold text-terracotta-800 mt-0.5 font-mono">
                {formatCurrency(summary.totalPurchasedBs)}
              </p>
              <span className="text-[9px] text-warm-500 block font-mono">
                {purchaseLogs.length} registros de compra
              </span>
            </div>

            <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-warm-200 shadow-sm">
              <span className="text-[9.5px] text-warm-600 font-bold uppercase tracking-wider block">
                Total Insumos / SKUs
              </span>
              <p className="text-sm sm:text-base font-extrabold text-warm-900 mt-0.5 font-mono">
                {summary.totalProductsCount} <span className="text-[10px] font-normal text-warm-500 font-sans">tipos</span>
              </p>
              <span className={`text-[9px] font-bold block ${summary.totalLowStockCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {summary.totalLowStockCount > 0 ? `⚠ ${summary.totalLowStockCount} en stock bajo/agotado` : "✓ Stock óptimo"}
              </span>
            </div>

            <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-warm-200 shadow-sm">
              <span className="text-[9.5px] text-rose-700 font-bold uppercase tracking-wider block">
                Pérdidas por Merma
              </span>
              <p className="text-sm sm:text-base font-extrabold text-rose-800 mt-0.5 font-mono">
                {summary.totalMermas} <span className="text-[10px] font-normal text-rose-500 font-sans">uds</span>
              </p>
              <span className="text-[9px] text-warm-500 truncate block">
                Consumo período: <strong>{summary.totalUnits} uds</strong>
              </span>
            </div>
          </div>

          {/* Filter Toolbar (Hidden on Print) */}
          <div className="p-3 bg-warm-100/60 border-b border-warm-200 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar insumo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white rounded-xl border border-warm-200 text-xs text-warm-900 focus:outline-none focus:border-emerald-500 w-44"
                />
              </div>

              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-warm-200 text-xs font-semibold overflow-x-auto max-w-md">
                {dynamicCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg transition-all text-[11px] whitespace-nowrap ${
                      categoryFilter === cat
                        ? "bg-emerald-600 text-white shadow-sm font-bold"
                        : "text-warm-600 hover:text-warm-900"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
                {activeTab === "inventory" && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("low_stock")}
                    className={`px-2.5 py-1 rounded-lg transition-all text-[11px] whitespace-nowrap ${
                      categoryFilter === "low_stock"
                        ? "bg-amber-600 text-white shadow-sm font-bold"
                        : "text-amber-700 hover:bg-amber-50"
                    }`}
                  >
                    ⚠ Stock Bajo
                  </button>
                )}
              </div>
            </div>

            {/* Date Presets */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-warm-200 text-xs font-semibold">
              {(
                [
                  { id: "today", label: "Hoy" },
                  { id: "week", label: "7 días" },
                  { id: "month", label: "Este Mes" },
                  { id: "custom", label: "Rango" },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => (p.id === "custom" ? setFilterMode("custom") : applyFilter(p.id))}
                  className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                    filterMode === p.id ? "bg-emerald-600 text-white shadow-sm font-bold" : "text-warm-600 hover:text-warm-900"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => fetchAnalytics(startDate, endDate)}
                className="p-1.5 text-warm-600 hover:text-warm-900 rounded-lg hover:bg-warm-100 transition-colors ml-1"
                title="Refrescar datos"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {filterMode === "custom" && (
            <div className="px-4 py-2 bg-warm-50 border-b border-warm-200 flex items-center gap-2 text-xs print:hidden">
              <form onSubmit={handleCustomSearch} className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-warm-200">
                  <span className="text-warm-500 text-[10px] font-bold">Desde:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs font-semibold text-warm-900 focus:outline-none bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-xl border border-warm-200">
                  <span className="text-warm-500 text-[10px] font-bold">Hasta:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs font-semibold text-warm-900 focus:outline-none bg-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-sm"
                >
                  Aplicar
                </button>
              </form>
            </div>
          )}

          {/* Main Data Tables Container */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 print:p-0 print:overflow-visible">
            {loading ? (
              <div className="p-12 text-center text-xs text-warm-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-emerald-600" />
                Cargando datos completos de inventario y precios históricos...
              </div>
            ) : activeTab === "inventory" ? (
              <div className="border border-warm-300 rounded-xl overflow-hidden shadow-sm bg-white print:shadow-none print:rounded-none">
                <div className="bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between print:hidden">
                  <span className="flex items-center gap-1.5">
                    <Boxes className="h-4 w-4" />
                    <span>Catálogo de Insumos & Valorización Física de Stock</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-90">
                    Mostrando {filteredProducts.length} de {inventoryProducts.length} Insumos
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-sans">
                    <thead className="bg-warm-100 text-warm-800 font-bold border-b border-warm-300 text-[10.5px]">
                      <tr>
                        <th className="p-2 border-r border-warm-300 text-center w-8">#</th>
                        <th className="p-2 border-r border-warm-300">Insumo / Flor</th>
                        <th className="p-2 border-r border-warm-300">Categoría</th>
                        <th className="p-2 border-r border-warm-300 text-right">Stock</th>
                        <th className="p-2 border-r border-warm-300 text-center">Estado</th>
                        <th className="p-2 border-r border-warm-300 text-right">Costo Unit.</th>
                        <th className="p-2 border-r border-warm-300 text-right">Precio Venta</th>
                        <th className="p-2 border-r border-warm-300 text-right bg-emerald-50 text-emerald-950">
                          Valor Almacén
                        </th>
                        <th className="p-2 text-right bg-rose-50 text-rose-900">Mermas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-200 text-warm-900 font-mono text-[10.5px]">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-xs text-warm-500 font-sans">
                            No se encontraron insumos con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p, idx) => (
                          <tr key={p.id} className="hover:bg-warm-50/80 transition-colors">
                            <td className="p-1.5 border-r border-warm-200 text-center text-warm-400 font-sans">
                              {idx + 1}
                            </td>
                            <td className="p-1.5 border-r border-warm-200 font-sans font-bold text-warm-900">
                              {p.name}
                            </td>
                            <td className="p-1.5 border-r border-warm-200 font-sans">
                              <span className="px-1.5 py-0.5 bg-warm-100 rounded text-[9.5px] text-warm-700 font-medium">
                                {p.type}
                              </span>
                            </td>
                            <td className="p-1.5 border-r border-warm-200 text-right font-extrabold">
                              {p.available} <span className="text-[9px] font-normal text-warm-500 font-sans">{p.unit}</span>
                            </td>
                            <td className="p-1.5 border-r border-warm-200 text-center font-sans">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-bold inline-flex items-center gap-1 ${
                                  p.status === "Disponible"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : p.status === "Stock Bajo"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {p.status}
                              </span>
                            </td>
                            <td className="p-1.5 border-r border-warm-200 text-right">{formatCurrency(p.unitCost)}</td>
                            <td className="p-1.5 border-r border-warm-200 text-right text-emerald-700 font-bold">
                              {typeof p.salePrice === "number" && p.salePrice > 0 ? formatCurrency(p.salePrice) : "-"}
                            </td>
                            <td className="p-1.5 border-r border-warm-200 text-right font-extrabold bg-emerald-50/50 text-emerald-900">
                              {formatCurrency(p.stockValueBs)}
                            </td>
                            <td className="p-1.5 text-right bg-rose-50/40 font-bold text-rose-800">
                              {p.mermaLostQty > 0 ? `${p.mermaLostQty} ${p.unit}` : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-warm-100 border-t-2 border-warm-300 font-bold text-xs text-warm-900">
                      <tr>
                        <td colSpan={3} className="p-2 border-r border-warm-300 text-right uppercase">
                          Totales ({filteredProducts.length}):
                        </td>
                        <td className="p-2 border-r border-warm-300 text-right font-mono">
                          {filteredProducts.reduce((acc, p) => acc + p.available, 0).toLocaleString()} uds
                        </td>
                        <td colSpan={3} className="p-2 border-r border-warm-300 text-center text-[10px] text-warm-600">
                          {filteredProducts.filter((p) => p.status !== "Disponible").length} en alerta
                        </td>
                        <td className="p-2 border-r border-warm-300 text-right font-mono bg-emerald-100 text-emerald-950">
                          {formatCurrency(filteredProducts.reduce((acc, p) => acc + p.stockValueBs, 0))}
                        </td>
                        <td className="p-2 text-right font-mono bg-rose-100 text-rose-950">
                          {filteredProducts.reduce((acc, p) => acc + p.mermaLostQty, 0).toLocaleString()} uds
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : activeTab === "purchases" ? (
              <div className="border border-warm-300 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-terracotta-700 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between print:hidden">
                  <span className="flex items-center gap-1.5">
                    <History className="h-4 w-4" />
                    <span>Historial de Compras y Precios Históricos (Análisis Estacional)</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-90">{filteredPurchases.length} Compras</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-warm-100 text-warm-800 font-bold border-b border-warm-300 text-[10.5px]">
                      <tr>
                        <th className="p-2 border-r border-warm-300">Fecha</th>
                        <th className="p-2 border-r border-warm-300">Insumo</th>
                        <th className="p-2 border-r border-warm-300">Categoría</th>
                        <th className="p-2 border-r border-warm-300 text-right">Paquetes</th>
                        <th className="p-2 border-r border-warm-300 text-right">Costo Paq.</th>
                        <th className="p-2 border-r border-warm-300 text-right">Total Uds</th>
                        <th className="p-2 border-r border-warm-300 text-right">Costo Unit.</th>
                        <th className="p-2 border-r border-warm-300 text-right bg-terracotta-50">Costo Total</th>
                        <th className="p-2 text-right">Precio Venta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-200 text-[10.5px] font-mono">
                      {filteredPurchases.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-xs text-warm-500 font-sans">
                            Aún no hay compras registradas en este período. Cada nuevo insumo o Re-Stock quedará guardado aquí con su fecha y precio histórico.
                          </td>
                        </tr>
                      ) : (
                        filteredPurchases.map((log) => (
                          <tr key={log.id} className="hover:bg-warm-50/80">
                            <td className="p-2 border-r border-warm-200">{log.purchasedAt}</td>
                            <td className="p-2 border-r border-warm-200 font-sans font-bold text-warm-900">
                              {log.ingredientName}
                            </td>
                            <td className="p-2 border-r border-warm-200 font-sans">{log.ingredientType}</td>
                            <td className="p-2 border-r border-warm-200 text-right">
                              {log.packageCount ? `${log.packageCount} × ${log.unitsPerPackage || ""}` : "-"}
                            </td>
                            <td className="p-2 border-r border-warm-200 text-right">
                              {log.packageCost ? formatCurrency(log.packageCost) : "-"}
                            </td>
                            <td className="p-2 border-r border-warm-200 text-right font-bold">
                              {log.totalUnits} {log.unit}
                            </td>
                            <td className="p-2 border-r border-warm-200 text-right">{formatCurrency(log.unitCost)}</td>
                            <td className="p-2 border-r border-warm-200 text-right font-extrabold bg-terracotta-50/60 text-terracotta-800">
                              {formatCurrency(log.totalCost)}
                            </td>
                            <td className="p-2 text-right text-emerald-700 font-bold">
                              {log.salePrice ? formatCurrency(log.salePrice) : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="border border-warm-300 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-blue-800 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between print:hidden">
                  <span className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Historial Diario de Movimientos & Mermas</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-90">{filteredMovements.length} Registros</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-warm-100 text-warm-800 font-bold border-b border-warm-300 text-[10.5px]">
                      <tr>
                        <th className="p-2 border-r border-warm-300">Fecha</th>
                        <th className="p-2 border-r border-warm-300">Insumo</th>
                        <th className="p-2 border-r border-warm-300">Categoría</th>
                        <th className="p-2 border-r border-warm-300 text-right">POS</th>
                        <th className="p-2 border-r border-warm-300 text-right">Pedidos</th>
                        <th className="p-2 border-r border-warm-300 text-right">Mermas</th>
                        <th className="p-2 border-r border-warm-300 text-right">Total Uds</th>
                        <th className="p-2 text-right">Costo Estimado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-200 text-[10.5px] font-mono">
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-xs text-warm-500 font-sans">
                            No hay movimientos ni mermas registradas en el rango de fechas seleccionado.
                          </td>
                        </tr>
                      ) : (
                        filteredMovements.map((r) => (
                          <tr key={`${r.date}-${r.ingredientId}`} className="hover:bg-warm-50/80">
                            <td className="p-2 border-r border-warm-200">{r.date}</td>
                            <td className="p-2 border-r border-warm-200 font-sans font-bold text-warm-900">
                              {r.ingredientName}
                            </td>
                            <td className="p-2 border-r border-warm-200 font-sans">{r.type}</td>
                            <td className="p-2 border-r border-warm-200 text-right">{r.posSoldQty}</td>
                            <td className="p-2 border-r border-warm-200 text-right">{r.orderUsedQty}</td>
                            <td className="p-2 border-r border-warm-200 text-right text-rose-700 font-bold">
                              {r.mermaLostQty}
                            </td>
                            <td className="p-2 border-r border-warm-200 text-right font-bold">
                              {r.totalQuantity} {r.unit}
                            </td>
                            <td className="p-2 text-right font-bold">{formatCurrency(r.totalCostBs)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
