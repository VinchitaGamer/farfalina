"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  Search,
  Boxes
} from "lucide-react";
import {
  getIngredientConsumptionAnalyticsAction,
  ConsumptionRow,
  InventoryProductRow
} from "@/app/actions/arrangements";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface StockAnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function StockAnalyticsModal({ isOpen, onClose }: StockAnalyticsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"inventory" | "movements">("inventory");
  const [filterMode, setFilterMode] = useState<"today" | "week" | "month" | "custom">("month");
  const [categoryFilter, setCategoryFilter] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(todayStr);

  const [loading, setLoading] = useState(false);
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProductRow[]>([]);
  const [rows, setRows] = useState<ConsumptionRow[]>([]);
  const [summary, setSummary] = useState({
    totalStockUnits: 0,
    totalStockValuationBs: 0,
    totalProductsCount: 0,
    totalLowStockCount: 0,
    totalUnits: 0,
    totalCostBs: 0,
    totalMermas: 0,
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
    let sDate = startDate;
    let eDate = now.toISOString().split("T")[0];

    if (mode === "today") {
      sDate = eDate;
    } else if (mode === "week") {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      sDate = past7.toISOString().split("T")[0];
    } else if (mode === "month") {
      sDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
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
      setSummary(res.data.summary || {
        totalStockUnits: 0,
        totalStockValuationBs: 0,
        totalProductsCount: 0,
        totalLowStockCount: 0,
        totalUnits: 0,
        totalCostBs: 0,
        totalMermas: 0,
        topConsumedName: "Ninguno",
      });
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

      <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white print:static" role="dialog" aria-modal="true">
        <div
          id="printable-stock-analytics-sheet"
          className="bg-white rounded-2xl sm:rounded-3xl border border-warm-200 shadow-2xl w-full max-w-6xl overflow-y-auto flex flex-col max-h-[94dvh] print:overflow-visible print:max-h-none print:border-none print:shadow-none print:w-full"
        >
          {/* Modal Header (Hidden on Print) */}
          <div className="p-4 sm:p-5 bg-warm-50 border-b border-warm-200 flex items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl shadow-sm">
                <Boxes className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-warm-900">
                    Control de Inventario, Valorización de Almacén & Análisis de Consumo
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-mono">
                    {inventoryProducts.length} Insumos Activos
                  </span>
                </div>
                <p className="text-xs text-warm-500">
                  Gestión integral de stock físico disponible, valuación monetaria en gaveta y consumos en pedidos y POS.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center gap-1.5"
                title="Descargar o imprimir reporte en PDF tamaño Carta"
              >
                <Printer className="h-4 w-4" />
                <span>Exportar / Imprimir PDF (Carta Apaisada)</span>
              </button>
              <button
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
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight text-warm-900 uppercase font-serif">
                    FLORERÍA FARFALINA • REPORTE OFICIAL DE INVENTARIO
                  </h1>
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono">
                    Auditoría de Almacén
                  </span>
                </div>
                <p className="text-xs font-bold text-warm-700 uppercase tracking-wide">
                  Inventario Físico Disponible, Valorización Monetaria y Consumos de Turno
                </p>
                <p className="text-[9.5px] text-warm-500 mt-0.5 font-mono">
                  Período Analizado: <strong>{startDate}</strong> al <strong>{endDate}</strong> • {inventoryProducts.length} Ítems Registrados
                </p>
              </div>
              <div className="text-right text-xs space-y-0.5 font-mono">
                <p className="font-bold text-warm-900">Emisión: {new Date().toLocaleDateString()}</p>
                <p className="text-[9.5px] text-warm-500">Hora: {new Date().toLocaleTimeString()}</p>
                <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-warm-100 text-warm-800 rounded border border-warm-300 inline-block font-sans">
                  Documento Certificado
                </span>
              </div>
            </div>
          </div>

          {/* Top Tabs Switcher (Hidden in Print) */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2 bg-warm-100/70 border-b border-warm-200 print:hidden">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("inventory")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "inventory"
                    ? "bg-white text-emerald-800 shadow-sm border border-warm-300"
                    : "text-warm-600 hover:text-warm-900"
                }`}
              >
                <Boxes className="h-3.5 w-3.5" />
                <span>Inventario Físico & Valorización ({inventoryProducts.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("movements")}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === "movements"
                    ? "bg-white text-emerald-800 shadow-sm border border-warm-300"
                    : "text-warm-600 hover:text-warm-900"
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Historial Diario de Movimientos ({rows.length})</span>
              </button>
            </div>

            <div className="text-[11px] text-warm-600 font-mono hidden sm:block">
              Valor de Almacén: <strong>{formatCurrency(summary.totalStockValuationBs)}</strong>
            </div>
          </div>

          {/* Summary Metric Cards */}
          <div className="p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-warm-50/50 border-b border-warm-200 print:bg-white print:p-1.5">
            <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-warm-200 shadow-sm print:border-warm-400">
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

            <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-warm-200 shadow-sm print:border-warm-400">
              <span className="text-[9.5px] text-warm-600 font-bold uppercase tracking-wider block">
                Total Insumos / SKUs
              </span>
              <p className="text-sm sm:text-base font-extrabold text-warm-900 mt-0.5 font-mono">
                {summary.totalProductsCount} <span className="text-[10px] font-normal text-warm-500 font-sans">tipos</span>
              </p>
              <span className={`text-[9px] font-bold block ${summary.totalLowStockCount > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {summary.totalLowStockCount > 0 ? `⚠ ${summary.totalLowStockCount} en stock bajo/agotado` : "✓ Stock en niveles óptimos"}
              </span>
            </div>

            <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-warm-200 shadow-sm print:border-warm-400">
              <span className="text-[9.5px] text-blue-700 font-bold uppercase tracking-wider block">
                Consumo en Período
              </span>
              <p className="text-sm sm:text-base font-extrabold text-blue-900 mt-0.5 font-mono">
                {summary.totalUnits.toLocaleString()} <span className="text-[10px] font-normal text-blue-600 font-sans">uds</span>
              </p>
              <span className="text-[9px] text-blue-600 block font-mono">
                Costo: {formatCurrency(summary.totalCostBs)}
              </span>
            </div>

            <div className="p-2.5 sm:p-3 bg-white rounded-xl border border-warm-200 shadow-sm print:border-warm-400">
              <span className="text-[9.5px] text-rose-700 font-bold uppercase tracking-wider block">
                Pérdidas por Merma
              </span>
              <p className="text-sm sm:text-base font-extrabold text-rose-800 mt-0.5 font-mono">
                {summary.totalMermas} <span className="text-[10px] font-normal text-rose-500 font-sans">uds</span>
              </p>
              <span className="text-[9px] text-warm-500 truncate block" title={summary.topConsumedName}>
                + Usado: <strong>{summary.topConsumedName}</strong>
              </span>
            </div>
          </div>

          {/* Filter Toolbar (Hidden on Print) */}
          <div className="p-3 bg-warm-100/60 border-b border-warm-200 flex flex-wrap items-center justify-between gap-2.5 print:hidden">
            {/* Search & Category Filter */}
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

              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-warm-200 text-xs font-semibold overflow-x-auto">
                {["Todos", "Flor", "Follaje", "Base/Jarrón", "Accesorio"].map((cat) => (
                  <button
                    key={cat}
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
                <button
                  onClick={() => setCategoryFilter("low_stock")}
                  className={`px-2.5 py-1 rounded-lg transition-all text-[11px] whitespace-nowrap ${
                    categoryFilter === "low_stock"
                      ? "bg-amber-600 text-white shadow-sm font-bold"
                      : "text-amber-700 hover:bg-amber-50"
                  }`}
                >
                  ⚠ Stock Bajo
                </button>
              </div>
            </div>

            {/* Date Presets */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-warm-200 text-xs font-semibold">
              <button
                onClick={() => applyFilter("today")}
                className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                  filterMode === "today" ? "bg-emerald-600 text-white shadow-sm font-bold" : "text-warm-600 hover:text-warm-900"
                }`}
              >
                Hoy
              </button>
              <button
                onClick={() => applyFilter("week")}
                className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                  filterMode === "week" ? "bg-emerald-600 text-white shadow-sm font-bold" : "text-warm-600 hover:text-warm-900"
                }`}
              >
                7 días
              </button>
              <button
                onClick={() => applyFilter("month")}
                className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                  filterMode === "month" ? "bg-emerald-600 text-white shadow-sm font-bold" : "text-warm-600 hover:text-warm-900"
                }`}
              >
                Este Mes
              </button>
              <button
                onClick={() => setFilterMode("custom")}
                className={`px-2.5 py-1 rounded-lg transition-all text-[11px] ${
                  filterMode === "custom" ? "bg-emerald-600 text-white shadow-sm font-bold" : "text-warm-600 hover:text-warm-900"
                }`}
              >
                Rango
              </button>

              <button
                onClick={() => fetchAnalytics(startDate, endDate)}
                className="p-1.5 text-warm-600 hover:text-warm-900 rounded-lg hover:bg-warm-100 transition-colors ml-1"
                title="Refrescar datos"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Custom Date Form (Hidden on Print) */}
          {filterMode === "custom" && (
            <div className="px-4 py-2 bg-warm-50 border-b border-warm-200 flex items-center gap-2 text-xs print:hidden">
              <form onSubmit={handleCustomSearch} className="flex items-center gap-2">
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
                Cargando datos completos de inventario y consumos...
              </div>
            ) : activeTab === "inventory" ? (
              /* INVENTORY PRODUCTS TABLE (Always printed) */
              <div className="border border-warm-300 rounded-xl overflow-hidden shadow-sm bg-white print:shadow-none print:rounded-none print:border-warm-400">
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
                    <thead className="bg-warm-100 text-warm-800 font-bold border-b border-warm-300 select-none print:bg-warm-200 print:text-black text-[10.5px]">
                      <tr>
                        <th className="p-2 border-r border-warm-300 text-center w-8 text-warm-500 print:text-black">#</th>
                        <th className="p-2 border-r border-warm-300">Insumo / Flor</th>
                        <th className="p-2 border-r border-warm-300">Categoría</th>
                        <th className="p-2 border-r border-warm-300 text-right">Stock Disponible</th>
                        <th className="p-2 border-r border-warm-300 text-center">Estado</th>
                        <th className="p-2 border-r border-warm-300 text-right">Costo Unit.</th>
                        <th className="p-2 border-r border-warm-300 text-right font-extrabold bg-emerald-50 text-emerald-950 print:bg-white print:text-black">
                          Valor en Almacén
                        </th>
                        <th className="p-2 border-r border-warm-300 text-right bg-blue-50 text-blue-900 print:bg-white print:text-black">
                          Ventas/Consumo ({filterMode === "today" ? "Hoy" : "Período"})
                        </th>
                        <th className="p-2 text-right bg-rose-50 text-rose-900 print:bg-white print:text-black">
                          Mermas
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-200 text-warm-900 font-mono text-[10.5px] print:text-black">
                      {filteredProducts.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-xs text-warm-500 font-sans">
                            No se encontraron insumos con los filtros seleccionados.
                          </td>
                        </tr>
                      ) : (
                        filteredProducts.map((p, idx) => (
                          <tr key={p.id} className="hover:bg-warm-50/80 transition-colors">
                            <td className="p-1.5 border-r border-warm-200 text-center text-warm-400 font-sans font-semibold print:text-black">
                              {idx + 1}
                            </td>
                            <td className="p-1.5 border-r border-warm-200 font-sans font-bold text-warm-900 print:text-black">
                              {p.name}
                            </td>
                            <td className="p-1.5 border-r border-warm-200 font-sans">
                              <span className="px-1.5 py-0.5 bg-warm-100 rounded text-[9.5px] text-warm-700 font-medium print:bg-transparent print:border print:border-warm-300 print:text-black">
                                {p.type}
                              </span>
                            </td>
                            <td className="p-1.5 border-r border-warm-200 text-right font-extrabold text-warm-900">
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
                                } print:bg-transparent print:border print:text-black`}
                              >
                                {p.status === "Disponible" && "✓ "}
                                {p.status === "Stock Bajo" && "⚠ "}
                                {p.status === "Agotado" && "✕ "}
                                {p.status}
                              </span>
                            </td>
                            <td className="p-1.5 border-r border-warm-200 text-right">{formatCurrency(p.unitCost)}</td>
                            <td className="p-1.5 border-r border-warm-200 text-right font-extrabold bg-emerald-50/50 text-emerald-900 print:bg-transparent print:text-black">
                              {formatCurrency(p.stockValueBs)}
                            </td>
                            <td className="p-1.5 border-r border-warm-200 text-right bg-blue-50/40 font-bold text-blue-900 print:bg-transparent print:text-black">
                              {p.posSoldQty + p.orderUsedQty > 0 ? `${p.posSoldQty + p.orderUsedQty} ${p.unit}` : "-"}
                            </td>
                            <td className="p-1.5 text-right bg-rose-50/40 font-bold text-rose-800 print:bg-transparent print:text-black">
                              {p.mermaLostQty > 0 ? `${p.mermaLostQty} ${p.unit}` : "-"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-warm-100 border-t-2 border-warm-300 font-bold text-xs text-warm-900 select-none print:bg-warm-200 print:text-black">
                      <tr>
                        <td colSpan={3} className="p-2 border-r border-warm-300 text-right uppercase tracking-wider font-extrabold">
                          Totales de Inventario:
                        </td>
                        <td className="p-2 border-r border-warm-300 text-right font-mono font-extrabold text-warm-950">
                          {summary.totalStockUnits.toLocaleString()} uds
                        </td>
                        <td className="p-2 border-r border-warm-300 text-center font-sans text-[10px] text-warm-600">
                          {summary.totalLowStockCount} en alerta
                        </td>
                        <td className="p-2 border-r border-warm-300 text-right font-mono font-normal text-warm-500">-</td>
                        <td className="p-2 border-r border-warm-300 text-right font-mono font-extrabold bg-emerald-100 text-emerald-950 print:bg-transparent print:text-black">
                          {formatCurrency(summary.totalStockValuationBs)}
                        </td>
                        <td className="p-2 border-r border-warm-300 text-right font-mono font-extrabold bg-blue-100 text-blue-950 print:bg-transparent print:text-black">
                          {summary.totalUnits.toLocaleString()} uds
                        </td>
                        <td className="p-2 text-right font-mono font-extrabold bg-rose-100 text-rose-950 print:bg-transparent print:text-black">
                          {summary.totalMermas.toLocaleString()} uds
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : null}
          </div>

          {/* Official Signatures Block (Visible ONLY on Print) */}
          <div className="hidden print:flex justify-between items-center px-12 pt-6 pb-2 text-xs text-warm-800">
            <div className="text-center border-t-2 border-warm-800 pt-1.5 w-56">
              <p className="font-bold uppercase text-xs">Responsable de Inventario</p>
              <p className="text-[10px] text-warm-600">Almacén & Control de Mermas</p>
            </div>
            <div className="text-center border-t-2 border-warm-800 pt-1.5 w-56">
              <p className="font-bold uppercase text-xs">Gerencia General</p>
              <p className="text-[10px] text-warm-600">Florería Farfalina & Carissma</p>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
