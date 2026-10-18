"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  Plus,
  FileText,
  History,
  PieChart,
  Package,
  X,
  Filter,
  Truck,
  Printer,
  Search,
  Store,
  CreditCard,
  Trash2
} from "lucide-react";
import {
  getFinancialMetricsAction,
  createFinancialExpenseAction,
  CreateFinancialExpenseInput
} from "@/app/actions/finances";
import { getOrdersAction, deleteOrderAction } from "@/app/actions/logistics";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ShiftReportModal, { ShiftReportData } from "./shift-report-modal";

interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  description: string;
  expenseDate: string;
}

export interface OrderDeliveryItem {
  id: string;
  orderNumber: string;
  clientName: string;
  clientPhone?: string;
  recipientName: string;
  address: string;
  zone: string;
  deliveryDate: string | Date;
  deliveryTime: string;
  status: "En preparación" | "En camino" | "Entregado";
  arrangementName: string;
  salePrice?: number;
  deliveryFee?: number;
  total: number;
  paymentMethod?: string;
  dedicationMessage: string;
}

export interface MermaLogItem {
  id: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  reason: "Marchitamiento" | "Daño Transporte" | "Defecto";
  costLostBs: number;
  date: string;
}

export default function AccountingView() {
  const { openCardPrinter } = useAppStore();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "orders" | "shifts" | "analytics">("summary");
  const [orders, setOrders] = useState<OrderDeliveryItem[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("Todos");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState("Todos");
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDeliveryItem | null>(null);

  // Metrics Data State
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalPosSales: 0,
    totalOrderSales: 0,
    totalExpensesCategory: 0,
    totalMermaCost: 0,
    totalExpenses: 0,
    netProfit: 0,
  });

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [shifts, setShifts] = useState<ShiftReportData[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; quantity: number; revenue: number }[]>([]);
  const [topIngredients, setTopIngredients] = useState<{ name: string; type: string; unit: string; totalUsed: number; totalCost: number }[]>([]);
  const [mermas, setMermas] = useState<MermaLogItem[]>([]);

  // Shift Report Modal State
  const [shiftReportModalOpen, setShiftReportModalOpen] = useState(false);
  const [activeShiftReport, setActiveShiftReport] = useState<ShiftReportData | null>(null);

  // New Expense Modal State
  const [newExpenseModalOpen, setNewExpenseModalOpen] = useState(false);
  const [category, setCategory] = useState<
    "Luz/Servicios" | "Sueldos" | "Gastos Administrativos" | "Insumos/Proveedores" | "Mantenimiento" | "Otros"
  >("Luz/Servicios");
  const [amount, setAmount] = useState<number | string>(150);
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [financesRes, ordersRes] = await Promise.all([
      getFinancialMetricsAction(),
      getOrdersAction(),
    ]);

    if (financesRes.success && financesRes.data) {
      const { summary, expenses, shifts, topSellingProducts, topUsedIngredients, mermas } = financesRes.data as { summary: any, expenses: ExpenseItem[], shifts: ShiftReportData[], topSellingProducts: { name: string; quantity: number; revenue: number }[], topUsedIngredients: { name: string; type: string; unit: string; totalUsed: number; totalCost: number }[], mermas: MermaLogItem[] };
      setSummary(summary);
      setExpenses(expenses || []);
      setShifts(shifts || []);
      setTopProducts(topSellingProducts || []);
      setTopIngredients(topUsedIngredients || []);
      setMermas(mermas || []);
    } else {
      toast.error(financesRes.error || "Error al cargar datos contables");
    }

    if (ordersRes.success && Array.isArray(ordersRes.data)) {
      setOrders(ordersRes.data);
    }

    setLoading(false);
  };

  const handleDeleteOrder = async (order: OrderDeliveryItem) => {
    const confirmed = await confirm({
      title: "¿Eliminar pedido / venta?",
      description: `¿Estás seguro de que deseas eliminar el registro del pedido "${order.orderNumber}" de ${order.clientName}?\n\nEsta acción revertirá los insumos de flores asociados al inventario disponible y eliminará el registro de venta permanentemente.`,
      confirmText: "Sí, eliminar pedido",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (!confirmed) return;

    const res = await deleteOrderAction(order.id);
    if (res.success) {
      toast.success(`Pedido ${order.orderNumber} eliminado correctamente`);
      if (selectedOrderDetail?.id === order.id) {
        setSelectedOrderDetail(null);
      }
      loadData();
    } else {
      toast.error(res.error || "No se pudo eliminar el pedido");
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!description.trim() || !numAmount || numAmount <= 0) {
      toast.error("Por favor completa la descripción y un monto válido.");
      return;
    }

    setSubmittingExpense(true);
    const res = await createFinancialExpenseAction({
      category,
      amount: numAmount,
      description,
      expenseDate,
    });
    setSubmittingExpense(false);

    if (res.success) {
      toast.success("Egreso registrado correctamente");
      setNewExpenseModalOpen(false);
      setDescription("");
      setAmount(150);
      loadData();
    } else {
      toast.error(res.error || "Error al registrar egreso");
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-terracotta-100 text-terracotta-700 rounded-md">
              Módulo Contabilidad
            </span>
            <h2 className="text-base sm:text-lg font-bold text-warm-900">Contabilidad, Ventas & Arqueos</h2>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            Historial de pedidos emitidos, egresos operativos, cierres de caja y balance financiero.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setNewExpenseModalOpen(true)}
            className="flex-1 sm:flex-none px-3.5 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-bold rounded-xl shadow-warm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Egreso</span>
          </button>

          <div className="flex items-center gap-1 bg-warm-100 p-1 rounded-xl border border-warm-200 overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("summary")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "summary" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              Balance
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "orders" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Pedidos & Ventas ({orders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("shifts")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "shifts" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              Arqueos ({shifts.length})
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === "analytics" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              Analítica
            </button>
          </div>
        </div>
      </div>

      {/* Financial KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-warm-500 font-semibold">
            <span>Ingresos Totales</span>
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-warm-900">{formatCurrency(summary.totalIncome)}</p>
          <div className="flex items-center gap-2 text-[10px] text-warm-400">
            <span>POS: {formatCurrency(summary.totalPosSales)}</span>
            <span>•</span>
            <span>Pedidos: {formatCurrency(summary.totalOrderSales)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-warm-500 font-semibold">
            <span>Egresos & Gastos</span>
            <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-rose-600">{formatCurrency(summary.totalExpenses)}</p>
          <div className="flex items-center gap-2 text-[10px] text-warm-400">
            <span>Operativos: {formatCurrency(summary.totalExpensesCategory)}</span>
            <span>•</span>
            <span>Mermas: {formatCurrency(summary.totalMermaCost)}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-warm-500 font-semibold">
            <span>Ganancia Neta</span>
            <div className="p-1.5 bg-terracotta-100 text-terracotta-700 rounded-lg">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className={`text-xl font-bold ${summary.netProfit >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
            {formatCurrency(summary.netProfit)}
          </p>
          <p className="text-[10px] text-warm-400">Margen neto operativo acumulado</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-warm-500 font-semibold">
            <span>Cierres de Caja</span>
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
              <History className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl font-bold text-warm-900">{shifts.length} Registros</p>
          <p className="text-[10px] text-warm-400">Arqueos archivados en sistema</p>
        </div>
      </div>

      {/* Main Content View by Tab */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Expense History Table */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-terracotta-600" />
                <h3 className="font-bold text-sm text-warm-900">Historial de Egresos y Gastos Registrados</h3>
              </div>
              <span className="text-xs text-warm-500 font-bold">{expenses.length} Gastos Registrados</span>
            </div>

            {expenses.length === 0 ? (
              <div className="p-8 text-center text-xs text-warm-400 border border-dashed border-warm-200 rounded-xl">
                No hay egresos registrados aún. Utiliza el botón "Registrar Egreso / Gasto" para añadir servicios, sueldos o insumos.
              </div>
            ) : (
              <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                    <tr>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Categoría</th>
                      <th className="p-3">Descripción</th>
                      <th className="p-3 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-100 text-warm-900">
                    {expenses.map((e) => (
                      <tr key={e.id} className="hover:bg-warm-50/60 transition-colors">
                        <td className="p-3 font-mono text-warm-600">
                          {new Date(e.expenseDate).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-semibold text-[11px] border border-rose-200">
                            {e.category}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-warm-900">{e.description}</td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600">
                          -{formatCurrency(e.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {expenses.map((e) => (
                  <article key={e.id} className="rounded-xl border border-warm-200 bg-warm-50/60 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-warm-500">{new Date(e.expenseDate).toLocaleDateString()}</p>
                        <p className="mt-1 font-semibold text-sm text-warm-900 break-words">{e.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] text-warm-500">Monto</p>
                        <p className="font-mono font-bold text-rose-600">-{formatCurrency(e.amount)}</p>
                      </div>
                    </div>
                    <span className="inline-flex px-2 py-1 bg-rose-50 text-rose-700 rounded-md font-semibold text-[11px] border border-rose-200">
                      {e.category}
                    </span>
                  </article>
                ))}
              </div>
              </>
            )}
          </div>

          {/* Expenses Category Breakdown Card */}
          <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-warm-200">
              <PieChart className="h-4 w-4 text-terracotta-600" />
              <h3 className="font-bold text-sm text-warm-900">Desglose de Gastos por Categoría</h3>
            </div>

            <div className="space-y-3">
              {[
                "Luz/Servicios",
                "Sueldos",
                "Gastos Administrativos",
                "Insumos/Proveedores",
                "Mantenimiento",
                "Otros",
              ].map((cat) => {
                const totalCat = expenses
                  .filter((e) => e.category === cat)
                  .reduce((acc, curr) => acc + curr.amount, 0);
                const percent = summary.totalExpensesCategory > 0 ? (totalCat / summary.totalExpensesCategory) * 100 : 0;

                return (
                  <div key={cat} className="p-3 bg-warm-50 rounded-xl border border-warm-200 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-warm-800">{cat}</span>
                      <span className="font-mono font-bold text-rose-600">{formatCurrency(totalCat)}</span>
                    </div>
                    <div className="w-full bg-warm-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-terracotta-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-5">
          {/* Orders Filter and Search Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px] w-full">
              <Search className="h-4 w-4 text-warm-400 absolute left-3 top-3" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Buscar por cliente, destinatario, teléfono o N° pedido..."
                className="w-full pl-9 pr-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-warm-600">
                <Filter className="h-3.5 w-3.5 text-warm-400" />
                <span className="font-bold">Estado:</span>
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-900 focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden"
              >
                <option value="Todos">Todos los Estados</option>
                <option value="En preparación">⏳ En preparación</option>
                <option value="En camino">🚚 En camino</option>
                <option value="Entregado">✅ Entregado</option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-warm-600 ml-1">
                <CreditCard className="h-3.5 w-3.5 text-warm-400" />
                <span className="font-bold">Pago:</span>
              </div>
              <select
                value={orderPaymentFilter}
                onChange={(e) => setOrderPaymentFilter(e.target.value)}
                className="p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-900 focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden"
              >
                <option value="Todos">Todos los Pagos</option>
                <option value="Efectivo">💵 Efectivo</option>
                <option value="QR">📱 QR Simple</option>
                <option value="Tarjeta">💳 Tarjeta</option>
              </select>
            </div>
          </div>

          {/* KPI Metrics for Orders */}
          {(() => {
            const filtered = orders.filter((ord) => {
              const matchesSearch =
                orderSearch.trim() === "" ||
                ord.orderNumber?.toLowerCase().includes(orderSearch.toLowerCase()) ||
                ord.clientName?.toLowerCase().includes(orderSearch.toLowerCase()) ||
                ord.recipientName?.toLowerCase().includes(orderSearch.toLowerCase()) ||
                ord.arrangementName?.toLowerCase().includes(orderSearch.toLowerCase()) ||
                ord.clientPhone?.includes(orderSearch);

              const matchesStatus =
                orderStatusFilter === "Todos" || ord.status === orderStatusFilter;

              const matchesPayment =
                orderPaymentFilter === "Todos" || (ord.paymentMethod || "Efectivo") === orderPaymentFilter;

              return matchesSearch && matchesStatus && matchesPayment;
            });

            const totalRevenue = filtered.reduce((acc, o) => acc + (o.total || 0), 0);
            const totalCash = filtered.filter((o) => (o.paymentMethod || "Efectivo") === "Efectivo").reduce((acc, o) => acc + (o.total || 0), 0);
            const totalQR = filtered.filter((o) => o.paymentMethod === "QR").reduce((acc, o) => acc + (o.total || 0), 0);
            const totalCard = filtered.filter((o) => o.paymentMethod === "Tarjeta").reduce((acc, o) => acc + (o.total || 0), 0);

            return (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-white p-3.5 rounded-2xl border border-warm-200 shadow-sm space-y-1">
                    <span className="text-[11px] font-bold text-warm-500">Pedidos Listados</span>
                    <p className="text-lg font-bold text-warm-900">{filtered.length} Pedidos</p>
                    <span className="text-[10px] text-warm-400">Total en vista actual</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-warm-200 shadow-sm space-y-1">
                    <span className="text-[11px] font-bold text-warm-500">Total Facturado</span>
                    <p className="text-lg font-bold text-emerald-700 font-mono">{formatCurrency(totalRevenue)}</p>
                    <span className="text-[10px] text-emerald-600 font-medium">100% ingresos de pedidos</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-warm-200 shadow-sm space-y-1">
                    <span className="text-[11px] font-bold text-warm-500">Recaudación en Efectivo</span>
                    <p className="text-lg font-bold text-warm-900 font-mono">{formatCurrency(totalCash)}</p>
                    <span className="text-[10px] text-warm-400">Para arqueo en caja física</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-warm-200 shadow-sm space-y-1">
                    <span className="text-[11px] font-bold text-warm-500">Recaudación QR & Tarjeta</span>
                    <p className="text-lg font-bold text-blue-700 font-mono">{formatCurrency(totalQR + totalCard)}</p>
                    <span className="text-[10px] text-blue-500">QR: {formatCurrency(totalQR)} • Card: {formatCurrency(totalCard)}</span>
                  </div>
                </div>

                {/* Orders List Table */}
                <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-warm-200">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-terracotta-600" />
                      <h3 className="font-bold text-sm text-warm-900">Historial Consolidado de Pedidos y Envíos</h3>
                    </div>
                    <span className="text-xs text-warm-500 font-bold">{filtered.length} Resultados</span>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="p-8 text-center text-xs text-warm-400 border border-dashed border-warm-200 rounded-xl">
                      No se encontraron pedidos con los filtros aplicados.
                    </div>
                  ) : (
                    <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                          <tr>
                            <th className="p-3">N° Pedido</th>
                            <th className="p-3">Fecha Entrega</th>
                            <th className="p-3">Cliente / Teléfono</th>
                            <th className="p-3">Destinatario & Modalidad</th>
                            <th className="p-3">Arreglo</th>
                            <th className="p-3">Pago</th>
                            <th className="p-3">Estado</th>
                            <th className="p-3 text-right">Total</th>
                            <th className="p-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-warm-100 text-warm-900">
                          {filtered.map((ord) => (
                            <tr key={ord.id} className="hover:bg-warm-50/60 transition-colors">
                              <td className="p-3 font-mono font-bold text-warm-700">{ord.orderNumber}</td>
                              <td className="p-3 font-mono text-warm-600">
                                <div className="flex flex-col">
                                  <span>{new Date(ord.deliveryDate).toLocaleDateString()}</span>
                                  <span className="text-[10px] text-warm-400 font-semibold">{ord.deliveryTime}</span>
                                </div>
                              </td>
                              <td className="p-3">
                                <p className="font-bold text-warm-900">{ord.clientName}</p>
                                {ord.clientPhone && (
                                  <p className="text-[10px] text-warm-500 font-mono">{ord.clientPhone}</p>
                                )}
                              </td>
                              <td className="p-3">
                                <p className="font-semibold text-warm-800">{ord.recipientName}</p>
                                {ord.address?.includes("Retiro en Tienda") || ord.deliveryFee === 0 ? (
                                  <span className="text-[10px] font-bold text-purple-700 inline-flex items-center gap-1">
                                    <Store className="h-3 w-3" />
                                    <span>Retiro en Tienda</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-warm-500 truncate max-w-[160px] block">
                                    {ord.zone}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-medium text-warm-900 truncate max-w-[180px]">
                                {ord.arrangementName}
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-warm-100 text-warm-800 border border-warm-200">
                                  {ord.paymentMethod || "Efectivo"}
                                </span>
                              </td>
                              <td className="p-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                                    ord.status === "En preparación"
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : ord.status === "En camino"
                                      ? "bg-blue-100 text-blue-800 border-blue-300"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  }`}
                                >
                                  {ord.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-terracotta-700 text-sm">
                                {formatCurrency(ord.total)}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedOrderDetail(ord)}
                                    className="px-2.5 py-1 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-[11px] font-bold transition-all"
                                    title="Ver Ficha Completa"
                                  >
                                    Ver Ficha
                                  </button>
                                  <button
                                    onClick={() =>
                                      openCardPrinter({
                                        client: ord.clientName,
                                        recipient: ord.recipientName,
                                        message: ord.dedicationMessage,
                                        date: `${new Date(ord.deliveryDate).toLocaleDateString()} - ${ord.deliveryTime}`,
                                      })
                                    }
                                    className="p-1 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-lg border border-terracotta-200 transition-all"
                                    title="Imprimir Tarjeta"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOrder(ord)}
                                    className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-all"
                                    title="Eliminar Pedido"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-3 md:hidden">
                      {filtered.map((ord) => (
                        <article key={ord.id} className="rounded-xl border border-warm-200 bg-white p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-mono font-bold text-warm-700">{ord.orderNumber}</p>
                              <p className="mt-1 text-xs text-warm-600">{new Date(ord.deliveryDate).toLocaleDateString()} · {ord.deliveryTime}</p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] text-warm-500">Total</p>
                              <p className="font-mono font-bold text-terracotta-700">{formatCurrency(ord.total)}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="min-w-0">
                              <p className="text-warm-500">Cliente</p>
                              <p className="font-bold text-warm-900 break-words">{ord.clientName}</p>
                              {ord.clientPhone && <p className="font-mono text-[11px] text-warm-500 break-all">{ord.clientPhone}</p>}
                            </div>
                            <div className="min-w-0">
                              <p className="text-warm-500">Destinatario</p>
                              <p className="font-semibold text-warm-800 break-words">{ord.recipientName}</p>
                              {ord.address?.includes("Retiro en Tienda") || ord.deliveryFee === 0 ? (
                                <span className="text-[10px] font-bold text-purple-700">Retiro en Tienda</span>
                              ) : (
                                <p className="text-[10px] text-warm-500 break-words">{ord.zone}</p>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 border-t border-warm-100 pt-3 text-xs">
                            <div className="flex justify-between gap-3">
                              <span className="text-warm-500">Arreglo</span>
                              <span className="text-right font-medium text-warm-900 break-words">{ord.arrangementName}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="px-2 py-1 rounded font-bold text-[10px] bg-warm-100 text-warm-800 border border-warm-200">{ord.paymentMethod || "Efectivo"}</span>
                              <span className={`px-2 py-1 rounded-full font-bold text-[10px] border ${
                                ord.status === "En preparación"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : ord.status === "En camino"
                                  ? "bg-blue-100 text-blue-800 border-blue-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                              }`}>{ord.status}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 border-t border-warm-100 pt-3">
                            <button
                              onClick={() => setSelectedOrderDetail(ord)}
                              className="min-h-11 px-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-xs font-bold transition-all"
                              title="Ver Ficha Completa"
                            >
                              Ver Ficha
                            </button>
                            <button
                              onClick={() =>
                                openCardPrinter({
                                  client: ord.clientName,
                                  recipient: ord.recipientName,
                                  message: ord.dedicationMessage,
                                  date: `${new Date(ord.deliveryDate).toLocaleDateString()} - ${ord.deliveryTime}`,
                                })
                              }
                              className="min-h-11 px-2 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-lg border border-terracotta-200 text-xs font-bold transition-all flex items-center justify-center gap-1"
                              title="Imprimir Tarjeta"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Tarjeta</span>
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(ord)}
                              className="min-h-11 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1"
                              title="Eliminar Pedido"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    </>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Order Detail Modal for Accounting View */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-terracotta-100 text-terracotta-700 rounded-xl">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-mono text-xs font-bold text-warm-400">{selectedOrderDetail.orderNumber}</span>
                  <h3 className="font-bold text-sm text-warm-900">Detalle Contable del Pedido</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="p-2 hover:bg-warm-100 text-warm-500 rounded-full transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 bg-warm-50 rounded-2xl border border-warm-200 text-xs">
              <div>
                <span className="font-bold text-warm-400 uppercase text-[9px] block">Cliente:</span>
                <p className="font-bold text-warm-900">{selectedOrderDetail.clientName}</p>
                <p className="text-warm-500 font-mono">{selectedOrderDetail.clientPhone || "Sin teléfono"}</p>
              </div>
              <div>
                <span className="font-bold text-warm-400 uppercase text-[9px] block">Destinatario:</span>
                <p className="font-bold text-warm-900">{selectedOrderDetail.recipientName}</p>
                <p className="text-warm-500">{selectedOrderDetail.zone}</p>
              </div>
              <div className="col-span-2 pt-2 border-t border-warm-200 flex justify-between">
                <div>
                  <span className="font-bold text-warm-400 uppercase text-[9px] block">Entrega Programada:</span>
                  <span className="font-bold text-warm-900">
                    {new Date(selectedOrderDetail.deliveryDate).toLocaleDateString()} — {selectedOrderDetail.deliveryTime}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-warm-400 uppercase text-[9px] block">Método de Pago:</span>
                  <span className="font-bold text-terracotta-700">{selectedOrderDetail.paymentMethod || "Efectivo"}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-warm-50 rounded-2xl border border-warm-200 space-y-2 text-xs">
              <div className="flex justify-between text-warm-700">
                <span>Arreglo ({selectedOrderDetail.arrangementName}):</span>
                <span className="font-mono font-bold">
                  {formatCurrency(selectedOrderDetail.salePrice || selectedOrderDetail.total - (selectedOrderDetail.deliveryFee || 0))}
                </span>
              </div>
              <div className="flex justify-between text-warm-700">
                <span>Costo Envío:</span>
                <span className="font-mono font-bold">{formatCurrency(selectedOrderDetail.deliveryFee || 0)}</span>
              </div>
              <div className="pt-2 border-t border-warm-200 flex justify-between text-sm font-bold text-terracotta-800">
                <span>TOTAL RECAUDADO:</span>
                <span className="font-mono">{formatCurrency(selectedOrderDetail.total)}</span>
              </div>
            </div>

            <div className="p-3 bg-gradient-to-r from-terracotta-50/60 to-warm-50 rounded-2xl border border-terracotta-200 space-y-1.5">
              <span className="font-bold text-[10px] text-terracotta-700 block">Dedicatoria para Tarjeta:</span>
              <p className="text-xs italic text-warm-800 font-serif">&ldquo;{selectedOrderDetail.dedicationMessage}&rdquo;</p>
            </div>

            <div className="pt-2 border-t border-warm-200 flex justify-between items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleDeleteOrder(selectedOrderDetail)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-all flex items-center gap-1.5"
                title="Eliminar este pedido permanentemente"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Eliminar Venta</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    openCardPrinter({
                      client: selectedOrderDetail.clientName,
                      recipient: selectedOrderDetail.recipientName,
                      message: selectedOrderDetail.dedicationMessage,
                      date: `${new Date(selectedOrderDetail.deliveryDate).toLocaleDateString()} - ${selectedOrderDetail.deliveryTime}`,
                    })
                  }
                  className="px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir Tarjeta</span>
                </button>
                <button
                  onClick={() => setSelectedOrderDetail(null)}
                  className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "shifts" && (
        <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-terracotta-600" />
              <h3 className="font-bold text-sm text-warm-900">Registro Consolidado de Arqueos de Caja</h3>
            </div>
            <span className="text-xs text-warm-500 font-bold">{shifts.length} Cierres en Historial</span>
          </div>

          {shifts.length === 0 ? (
            <div className="p-8 text-center text-xs text-warm-400 border border-dashed border-warm-200 rounded-xl">
              No hay cierres de caja archivados aún.
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                  <tr>
                    <th className="p-3">Fecha y Hora</th>
                    <th className="p-3">Cajero de Turno</th>
                    <th className="p-3">Apertura</th>
                    <th className="p-3">Efectivo</th>
                    <th className="p-3">QR / Tarjeta</th>
                    <th className="p-3">Declarado</th>
                    <th className="p-3">Discrepancia</th>
                    <th className="p-3 text-right">Reporte PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100 text-warm-900 font-medium">
                  {shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-warm-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-warm-800">
                        {s.closedAt ? new Date(s.closedAt).toLocaleString() : s.shiftDate}
                      </td>
                      <td className="p-3 font-semibold">{s.cashierName}</td>
                      <td className="p-3 font-mono text-warm-600">{formatCurrency(s.openingBalance)}</td>
                      <td className="p-3 font-mono text-emerald-700">{formatCurrency(s.totalSalesCash)}</td>
                      <td className="p-3 font-mono text-blue-700">{formatCurrency((s.totalSalesQR || 0) + (s.totalSalesCard || 0))}</td>
                      <td className="p-3 font-mono font-bold text-warm-900">{formatCurrency(s.closingBalance || 0)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            Math.abs(s.discrepancy || 0) < 0.01
                              ? "bg-emerald-100 text-emerald-800"
                              : (s.discrepancy || 0) > 0
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {formatCurrency(s.discrepancy || 0)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setActiveShiftReport(s);
                            setShiftReportModalOpen(true);
                          }}
                          className="px-3 py-1 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-lg text-[11px] font-bold border border-terracotta-200 transition-all flex items-center gap-1 ml-auto"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          Imprimir Reporte
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {shifts.map((s) => (
                <article key={s.id} className="rounded-xl border border-warm-200 bg-warm-50/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-sm text-warm-800 break-words">
                        {s.closedAt ? new Date(s.closedAt).toLocaleString() : s.shiftDate}
                      </p>
                      <p className="mt-1 font-semibold text-warm-900">{s.cashierName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-warm-500">Discrepancia</p>
                      <span className={`inline-flex px-2 py-1 rounded font-bold text-[10px] ${
                        Math.abs(s.discrepancy || 0) < 0.01
                          ? "bg-emerald-100 text-emerald-800"
                          : (s.discrepancy || 0) > 0
                          ? "bg-blue-100 text-blue-800"
                          : "bg-rose-100 text-rose-800"
                      }`}>{formatCurrency(s.discrepancy || 0)}</span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-warm-200 pt-3 text-xs">
                    <div><dt className="text-warm-500">Apertura</dt><dd className="font-mono text-warm-700">{formatCurrency(s.openingBalance)}</dd></div>
                    <div><dt className="text-warm-500">Efectivo</dt><dd className="font-mono text-emerald-700">{formatCurrency(s.totalSalesCash)}</dd></div>
                    <div><dt className="text-warm-500">QR / Tarjeta</dt><dd className="font-mono text-blue-700">{formatCurrency((s.totalSalesQR || 0) + (s.totalSalesCard || 0))}</dd></div>
                    <div><dt className="text-warm-500">Declarado</dt><dd className="font-mono font-bold text-warm-900">{formatCurrency(s.closingBalance || 0)}</dd></div>
                  </dl>
                  <button
                    onClick={() => {
                      setActiveShiftReport(s);
                      setShiftReportModalOpen(true);
                    }}
                    className="min-h-11 w-full bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-700 rounded-lg text-xs font-bold border border-terracotta-200 transition-all flex items-center justify-center gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    Imprimir Reporte
                  </button>
                </article>
              ))}
            </div>
            </>
          )}
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Products / Arrangements */}
          <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-warm-200">
              <Package className="h-4 w-4 text-terracotta-600" />
              <h3 className="font-bold text-sm text-warm-900">Arreglos & Productos Más Vendidos</h3>
            </div>

            {topProducts.length === 0 ? (
              <p className="text-xs text-warm-400 text-center py-6">No hay datos de ventas registrados aún.</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-warm-50 rounded-xl border border-warm-100">
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-full bg-terracotta-100 text-terracotta-700 font-bold text-xs flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-warm-900">{p.name}</p>
                        <p className="text-[10px] text-warm-500">{p.quantity} unidades vendidas</p>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-xs text-emerald-700">{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Used Raw Ingredients */}
          <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-warm-200">
              <TrendingUp className="h-4 w-4 text-terracotta-600" />
              <h3 className="font-bold text-sm text-warm-900">Insumos Más Utilizados en Recetas</h3>
            </div>

            {topIngredients.length === 0 ? (
              <p className="text-xs text-warm-400 text-center py-6">No hay consumo de insumos registrado aún en pedidos.</p>
            ) : (
              <div className="space-y-2">
                {topIngredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-warm-50 rounded-xl border border-warm-100">
                    <div>
                      <p className="text-xs font-bold text-warm-900">{ing.name}</p>
                      <p className="text-[10px] text-warm-500">Categoría: {ing.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-warm-900">{ing.totalUsed} {ing.unit}</p>
                      <p className="text-[10px] text-warm-500">Costo: {formatCurrency(ing.totalCost)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: New Expense */}
      {newExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-terracotta-600" />
                Registrar Nuevo Egreso / Gasto
              </h3>
              <button
                onClick={() => setNewExpenseModalOpen(false)}
                className="p-1 text-warm-400 hover:text-warm-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800">Categoría del Gasto *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as typeof category)}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                >
                  <option value="Luz/Servicios">Luz / Servicios (Agua, Internet)</option>
                  <option value="Sueldos">Sueldos y Planilla</option>
                  <option value="Gastos Administrativos">Gastos Administrativos Generales</option>
                  <option value="Insumos/Proveedores">Insumos y Compras Proveedores</option>
                  <option value="Mantenimiento">Mantenimiento y Equipamiento</option>
                  <option value="Otros">Otros Egresos</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800">Monto del Egreso (Bs) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="0.00"
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-bold font-mono focus:outline-none focus:border-terracotta-500"
                  required
                />
              </div>


              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800">Descripción del Gasto *</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej. Pago factura luz mes de Julio..."
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-warm-800">Fecha del Gasto *</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                  required
                />
              </div>

              <div className="pt-3 border-t border-warm-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewExpenseModalOpen(false)}
                  className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm disabled:opacity-50"
                >
                  {submittingExpense ? "Guardando..." : "Registrar Egreso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Printable Report Modal */}
      {shiftReportModalOpen && activeShiftReport && (
        <ShiftReportModal
          isOpen={shiftReportModalOpen}
          shiftReport={activeShiftReport}
          onClose={() => setShiftReportModalOpen(false)}
        />
      )}
    </div>
  );
}
