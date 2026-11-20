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
  Trash2,
  Download,
  Copy,
  ExternalLink,
  ShoppingBag
} from "lucide-react";
import {
  getFinancialMetricsAction,
  createFinancialExpenseAction,
  deleteFinancialExpenseAction,
  deletePOSTicketAction,
} from "@/app/actions/finances";
import { getOrdersAction, deleteOrderAction } from "@/app/actions/logistics";
import { formatCurrency } from "@/lib/utils";
import { downloadExcelCsv } from "@/lib/export-csv";
import { buildDeliveryWhatsAppMessage } from "@/lib/delivery-whatsapp";
import { toast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import ShiftReportModal, { ShiftReportData } from "./shift-report-modal";

type FinancialSummary = {
  totalIncome: number;
  totalPosSales: number;
  totalOrderSales: number;
  totalExpensesCategory: number;
  totalMermaCost: number;
  totalExpenses: number;
  netProfit: number;
};

type ExpenseItem = {
  id: string;
  category: string;
  amount: number;
  description: string;
  expenseDate: string;
};

type POSTicketItemRecord = {
  id: string;
  itemName: string;
  quantity: number;
  price: number;
};

type POSTicketRecord = {
  id: string;
  ticketNumber: string;
  customerName: string;
  paymentMethod: string;
  totalAmount: number;
  createdAt: string | Date;
  ticketItems: POSTicketItemRecord[];
};

export interface OrderDeliveryItem {
  id: string;
  orderNumber: string;
  clientName: string;
  clientPhone?: string | null;
  recipientName: string;
  recipientPhone?: string | null;
  address: string;
  zone: string;
  mapsUrl?: string | null;
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

type FinancialMetricsPayload = {
  summary: FinancialSummary;
  expenses: ExpenseItem[];
  shifts: ShiftReportData[];
  posTickets?: POSTicketRecord[];
  topSellingProducts: { name: string; quantity: number; revenue: number }[];
  topUsedIngredients: { name: string; type: string; unit: string; totalUsed: number; totalCost: number }[];
  mermas: MermaLogItem[];
};

function isPickupOrder(order: Pick<OrderDeliveryItem, "address">): boolean {
  return Boolean(order.address && order.address.toLowerCase().includes("retiro en tienda"));
}

function isHttpUrl(url?: string | null): boolean {
  return Boolean(url && /^https?:\/\//i.test(url.trim()));
}

export default function AccountingView() {
  const { openCardPrinter } = useAppStore();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "orders" | "tickets" | "shifts" | "analytics">("summary");
  const [orders, setOrders] = useState<OrderDeliveryItem[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("Todos");
  const [orderPaymentFilter, setOrderPaymentFilter] = useState("Todos");
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderDeliveryItem | null>(null);

  // Metrics Data State
  const [summary, setSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalPosSales: 0,
    totalOrderSales: 0,
    totalExpensesCategory: 0,
    totalMermaCost: 0,
    totalExpenses: 0,
    netProfit: 0,
  });

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [posTickets, setPosTickets] = useState<POSTicketRecord[]>([]);
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
      const payload = financesRes.data as FinancialMetricsPayload;
      setSummary(payload.summary);
      setExpenses(payload.expenses || []);
      setPosTickets(payload.posTickets || []);
      setShifts(payload.shifts || []);
      setTopProducts(payload.topSellingProducts || []);
      setTopIngredients(payload.topUsedIngredients || []);
      setMermas(payload.mermas || []);
    } else {
      toast.error(financesRes.error || "Error al cargar datos contables");
    }

    if (ordersRes.success && Array.isArray(ordersRes.data)) {
      setOrders(ordersRes.data as OrderDeliveryItem[]);
    }

    setLoading(false);
  };

  const handleDeleteOrder = async (order: OrderDeliveryItem) => {
    const confirmed = await confirm({
      title: "¿Eliminar pedido / venta?",
      description: `¿Estás seguro de que deseas eliminar el registro del pedido "${order.orderNumber}" de ${order.clientName}?\n\nEsta acción revertirá los insumos de flores asociados al inventario disponible y eliminará el registro de venta (y su ticket vinculado) permanentemente.`,
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

  const handleDeletePOSTicket = async (ticket: POSTicketRecord) => {
    const confirmed = await confirm({
      title: "¿Eliminar ticket POS?",
      description: `¿Deseas eliminar el ticket "${ticket.ticketNumber}" de ${ticket.customerName} por ${formatCurrency(ticket.totalAmount)}?\n\nSi pertenece al turno de caja actual, se descontará automáticamente del arqueo abierto.`,
      confirmText: "Sí, eliminar ticket",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (!confirmed) return;

    const res = await deletePOSTicketAction(ticket.id);
    if (res.success) {
      toast.success(`Ticket ${ticket.ticketNumber} eliminado correctamente`);
      loadData();
    } else {
      toast.error(res.error || "No se pudo eliminar el ticket");
    }
  };

  const handleDeleteExpense = async (expense: ExpenseItem) => {
    const confirmed = await confirm({
      title: "¿Eliminar egreso registrado?",
      description: `¿Deseas eliminar el gasto "${expense.description}" (${expense.category}) por ${formatCurrency(expense.amount)}?`,
      confirmText: "Sí, eliminar egreso",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (!confirmed) return;

    const res = await deleteFinancialExpenseAction(expense.id);
    if (res.success) {
      toast.success("Egreso eliminado correctamente");
      loadData();
    } else {
      toast.error(res.error || "No se pudo eliminar el egreso");
    }
  };

  const handleCopyDelivery = async (order: OrderDeliveryItem) => {
    const message = buildDeliveryWhatsAppMessage({
      orderNumber: order.orderNumber,
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      address: order.address,
      zone: order.zone,
      mapsUrl: order.mapsUrl,
      deliveryDate: order.deliveryDate,
      deliveryTime: order.deliveryTime,
      arrangementName: order.arrangementName,
      deliveryFee: order.deliveryFee,
      deliveryType: isPickupOrder(order) ? "pickup" : "delivery",
    });

    try {
      await navigator.clipboard.writeText(message);
      toast.success("Datos de delivery copiados para WhatsApp");
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleExportExcel = () => {
    const todayStamp = new Date().toISOString().split("T")[0];

    if (activeTab === "summary") {
      downloadExcelCsv(
        `farfalina-contabilidad-egresos-${todayStamp}`,
        ["Fecha", "Categoría", "Descripción", "Monto (Bs)"],
        [
          ...expenses.map((e) => [
            new Date(e.expenseDate).toLocaleDateString(),
            e.category,
            e.description,
            e.amount,
          ]),
          ["", "", "TOTAL INGRESOS", summary.totalIncome],
          ["", "", "TOTAL EGRESOS OPERATIVOS", summary.totalExpensesCategory],
          ["", "", "TOTAL MERMAS", summary.totalMermaCost],
          ["", "", "GANANCIA NETA", summary.netProfit],
        ]
      );
      toast.success("Archivo Excel de Balance y Egresos descargado");
      return;
    }

    if (activeTab === "orders") {
      downloadExcelCsv(
        `farfalina-pedidos-ventas-${todayStamp}`,
        [
          "N° Pedido",
          "Fecha Entrega",
          "Hora",
          "Cliente",
          "Tel. Cliente",
          "Destinatario",
          "Tel. Destinatario",
          "Dirección",
          "Zona",
          "Maps",
          "Arreglo",
          "Pago",
          "Estado",
          "Envío (Bs)",
          "Total (Bs)",
        ],
        orders.map((ord) => [
          ord.orderNumber,
          new Date(ord.deliveryDate).toLocaleDateString(),
          ord.deliveryTime,
          ord.clientName,
          ord.clientPhone || "",
          ord.recipientName,
          ord.recipientPhone || "",
          ord.address,
          ord.zone,
          ord.mapsUrl || "",
          ord.arrangementName,
          ord.paymentMethod || "Efectivo",
          ord.status,
          ord.deliveryFee || 0,
          ord.total,
        ])
      );
      toast.success("Archivo Excel de Pedidos y Ventas descargado");
      return;
    }

    if (activeTab === "tickets") {
      downloadExcelCsv(
        `farfalina-tickets-pos-${todayStamp}`,
        ["N° Ticket", "Fecha", "Cliente", "Método de Pago", "Ítems", "Total (Bs)"],
        posTickets.map((t) => [
          t.ticketNumber,
          new Date(t.createdAt).toLocaleString(),
          t.customerName,
          t.paymentMethod,
          t.ticketItems.map((i) => `${i.quantity}x ${i.itemName}`).join(" | "),
          t.totalAmount,
        ])
      );
      toast.success("Archivo Excel de Tickets POS descargado");
      return;
    }

    if (activeTab === "shifts") {
      downloadExcelCsv(
        `farfalina-arqueos-caja-${todayStamp}`,
        ["Fecha", "Cajero", "Apertura (Bs)", "Efectivo (Bs)", "QR (Bs)", "Tarjeta (Bs)", "Declarado (Bs)", "Discrepancia (Bs)"],
        shifts.map((s) => [
          s.closedAt ? new Date(s.closedAt).toLocaleString() : s.shiftDate,
          s.cashierName,
          s.openingBalance,
          s.totalSalesCash,
          s.totalSalesQR || 0,
          s.totalSalesCard || 0,
          s.closingBalance || 0,
          s.discrepancy || 0,
        ])
      );
      toast.success("Archivo Excel de Arqueos de Caja descargado");
      return;
    }

    downloadExcelCsv(
      `farfalina-analitica-ventas-${todayStamp}`,
      ["Ranking", "Producto / Arreglo", "Unidades Vendidas", "Ingresos (Bs)"],
      topProducts.map((p, idx) => [idx + 1, p.name, p.quantity, p.revenue])
    );
    toast.success("Archivo Excel de Analítica descargado");
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

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto print:hidden">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            title="Descargar reporte en formato Excel (.csv)"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-warm-100 hover:bg-warm-200 text-warm-800 border border-warm-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            title="Imprimir o guardar vista en PDF"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir / PDF</span>
          </button>

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
              <span>Pedidos ({orders.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("tickets")}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === "tickets" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Tickets POS ({posTickets.length})</span>
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
                      <th className="p-3 text-center print:hidden">Acción</th>
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
                        <td className="p-3 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => handleDeleteExpense(e)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 transition-all inline-flex items-center justify-center"
                            title="Eliminar egreso"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex px-2 py-1 bg-rose-50 text-rose-700 rounded-md font-semibold text-[11px] border border-rose-200">
                        {e.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(e)}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 text-xs font-bold inline-flex items-center gap-1"
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
                                {ord.recipientPhone && (
                                  <p className="text-[10px] font-mono text-warm-500">{ord.recipientPhone}</p>
                                )}
                                {isPickupOrder(ord) ? (
                                  <span className="text-[10px] font-bold text-purple-700 inline-flex items-center gap-1">
                                    <Store className="h-3 w-3" />
                                    <span>Retiro en Tienda</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-warm-500 truncate max-w-[160px] block">
                                    {ord.zone || ord.address}
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
                              {ord.recipientPhone && (
                                <p className="font-mono text-[11px] text-warm-500 break-all">{ord.recipientPhone}</p>
                              )}
                              {isPickupOrder(ord) ? (
                                <span className="text-[10px] font-bold text-purple-700">Retiro en Tienda</span>
                              ) : (
                                <p className="text-[10px] text-warm-500 break-words">{ord.zone || ord.address}</p>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-warm-50 rounded-2xl border border-warm-200 text-xs">
              <div>
                <span className="font-bold text-warm-400 uppercase text-[9px] block">Cliente:</span>
                <p className="font-bold text-warm-900">{selectedOrderDetail.clientName}</p>
                <p className="text-warm-500 font-mono">{selectedOrderDetail.clientPhone || "Sin teléfono"}</p>
              </div>
              <div>
                <span className="font-bold text-warm-400 uppercase text-[9px] block">Destinatario:</span>
                <p className="font-bold text-warm-900">{selectedOrderDetail.recipientName}</p>
                {selectedOrderDetail.recipientPhone && (
                  <p className="text-warm-600 font-mono">{selectedOrderDetail.recipientPhone}</p>
                )}
                <p className="text-warm-500">
                  {isPickupOrder(selectedOrderDetail)
                    ? "Retiro en Tienda Central"
                    : `${selectedOrderDetail.address}${selectedOrderDetail.zone ? ` (${selectedOrderDetail.zone})` : ""}`}
                </p>
                {selectedOrderDetail.mapsUrl && (
                  isHttpUrl(selectedOrderDetail.mapsUrl) ? (
                    <a
                      href={selectedOrderDetail.mapsUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline mt-0.5"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Abrir Maps</span>
                    </a>
                  ) : (
                    <p className="text-[11px] text-blue-700 break-all mt-0.5">Maps: {selectedOrderDetail.mapsUrl}</p>
                  )
                )}
              </div>
              <div className="sm:col-span-2 pt-2 border-t border-warm-200 flex justify-between gap-2 flex-wrap">
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

            {selectedOrderDetail.dedicationMessage?.trim() ? (
              <div className="p-3 bg-gradient-to-r from-terracotta-50/60 to-warm-50 rounded-2xl border border-terracotta-200 space-y-1.5">
                <span className="font-bold text-[10px] text-terracotta-700 block">Dedicatoria para Tarjeta:</span>
                <p className="text-xs italic text-warm-800 font-serif">&ldquo;{selectedOrderDetail.dedicationMessage}&rdquo;</p>
              </div>
            ) : (
              <p className="text-xs text-warm-500 italic">Sin tarjeta dedicatoria registrada para este pedido.</p>
            )}

            <div className="pt-2 border-t border-warm-200 flex justify-between items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteOrder(selectedOrderDetail)}
                  className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-all flex items-center gap-1.5"
                  title="Eliminar este pedido permanentemente"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar Venta</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyDelivery(selectedOrderDetail)}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-all flex items-center gap-1.5"
                  title="Copiar datos de entrega para WhatsApp"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copiar Delivery</span>
                </button>
              </div>

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

      {activeTab === "tickets" && (
        <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-terracotta-600" />
              <div>
                <h3 className="font-bold text-sm text-warm-900">Tickets de Venta Directa POS (Mostrador)</h3>
                <p className="text-[11px] text-warm-500">
                  Ventas directas emitidas en POS sin pedido de delivery vinculado. Los pedidos agendados no se duplican aquí.
                </p>
              </div>
            </div>
            <span className="text-xs text-warm-600 font-bold shrink-0">
              {posTickets.length} Tickets · {formatCurrency(summary.totalPosSales)}
            </span>
          </div>

          {posTickets.length === 0 ? (
            <div className="p-8 text-center text-xs text-warm-400 border border-dashed border-warm-200 rounded-xl">
              No hay tickets de mostrador independientes registrados.
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                    <tr>
                      <th className="p-3">N° Ticket</th>
                      <th className="p-3">Fecha y Hora</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Detalle de Productos</th>
                      <th className="p-3">Pago</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center print:hidden">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-100 text-warm-900">
                    {posTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-warm-50/60 transition-colors">
                        <td className="p-3 font-mono font-bold text-warm-700">{ticket.ticketNumber}</td>
                        <td className="p-3 font-mono text-warm-600">
                          {new Date(ticket.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3 font-bold text-warm-900">{ticket.customerName}</td>
                        <td className="p-3 text-warm-700">
                          {ticket.ticketItems.length > 0 ? (
                            <div className="space-y-0.5">
                              {ticket.ticketItems.map((item) => (
                                <p key={item.id} className="text-[11px]">
                                  • {item.quantity}x {item.itemName} ({formatCurrency(item.price)})
                                </p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-warm-400 italic">Sin desglose</span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-warm-100 text-warm-800 border border-warm-200">
                            {ticket.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-terracotta-700">
                          {formatCurrency(ticket.totalAmount)}
                        </td>
                        <td className="p-3 text-center print:hidden">
                          <button
                            type="button"
                            onClick={() => handleDeletePOSTicket(ticket)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 text-[11px] font-bold transition-all inline-flex items-center gap-1"
                            title="Eliminar ticket POS"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Eliminar</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {posTickets.map((ticket) => (
                  <article key={ticket.id} className="rounded-xl border border-warm-200 bg-warm-50/60 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-warm-700">{ticket.ticketNumber}</p>
                        <p className="text-[11px] text-warm-500">{new Date(ticket.createdAt).toLocaleString()}</p>
                        <p className="mt-1 font-bold text-sm text-warm-900 break-words">{ticket.customerName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-warm-100 text-warm-800 border border-warm-200">
                          {ticket.paymentMethod}
                        </span>
                        <p className="mt-1 font-mono font-bold text-terracotta-700">{formatCurrency(ticket.totalAmount)}</p>
                      </div>
                    </div>

                    {ticket.ticketItems.length > 0 && (
                      <div className="border-t border-warm-200 pt-2 space-y-1 text-xs text-warm-700">
                        {ticket.ticketItems.map((item) => (
                          <p key={item.id}>
                            • {item.quantity}x {item.itemName} ({formatCurrency(item.price)})
                          </p>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeletePOSTicket(ticket)}
                      className="min-h-11 w-full bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Eliminar Ticket</span>
                    </button>
                  </article>
                ))}
              </div>
            </>
          )}
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
