"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Plus,
  History,
  PieChart,
  RefreshCw,
  Printer,
  Shield,
  ShieldCheck,
  Search,
  CheckCircle2,
  X
} from "lucide-react";
import {
  getCarissmaFinancialSummaryAction,
  getCarissmaExpensesAction,
  createCarissmaExpenseAction,
  getCarissmaArchivedShiftsAction,
  getDressesAction,
  getRentalBookingsAction,
  returnRentalDressAction
} from "@/app/actions/carissma";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import ShiftReportModal, { CarissmaShiftReportData } from "./shift-report-modal";
import RentalContractModal from "./rental-contract-modal";

interface ExpenseItem {
  id: string;
  category: string;
  amount: number;
  description: string;
  expenseDate: string | Date;
}

interface FinancialSummaryData {
  totalRentalsRevenue: number;
  totalPenaltiesRevenue: number;
  totalGuaranteesInCustody: number;
  totalExpenses: number;
  netProfit: number;
}

interface BookingItem {
  id: string;
  contractNumber: string;
  clientName: string;
  clientPhone?: string | null;
  dressId: string;
  dressName: string;
  dressSize: string;
  dressColor: string;
  rentalStartDate: string | Date;
  rentalEndDate: string | Date;
  actualReturnDate?: string | Date | null;
  rentalPrice: number;
  guaranteeAmount: number;
  penaltyFee: number;
  paymentMethod: string;
  rentalStatus: "Reservado" | "En Prueba" | "Entregado" | "Devuelto / Revisión" | "En Lavandería" | "Finalizado";
  guaranteeStatus: "En Custodia" | "Devuelta" | "Retenida Parcial" | "Retenida Total";
  notes?: string | null;
  createdAt: string | Date;
}

interface ShiftItem {
  id: string;
  shiftDate: string;
  cashierName: string;
  openingBalance: number;
  closingBalance?: number | null;
  status: string;
  totalSalesCash: number;
  totalSalesQR: number;
  totalSalesCard: number;
  totalGuaranteesInCustody: number;
  totalGuaranteesReturned: number;
  totalPenalties: number;
  totalExpenses: number;
  declaredCash?: number | null;
  discrepancy?: number | null;
  notes?: string | null;
  closedAt?: string | Date | null;
}

interface DressItem {
  id: string;
  name: string;
  brand: string;
  size: string;
  baseRentalPrice: number;
  acquisitionCost: number;
  timesUsed: number;
  status: string;
}

export default function AccountingView() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"summary" | "guarantees" | "shifts" | "analytics">("summary");

  const [summary, setSummary] = useState<FinancialSummaryData>({
    totalRentalsRevenue: 0,
    totalPenaltiesRevenue: 0,
    totalGuaranteesInCustody: 0,
    totalExpenses: 0,
    netProfit: 0,
  });

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [dresses, setDresses] = useState<DressItem[]>([]);

  // Shift Report Modal
  const [shiftReportModalOpen, setShiftReportModalOpen] = useState(false);
  const [activeShiftReport, setActiveShiftReport] = useState<CarissmaShiftReportData | null>(null);

  // Contract Modal
  const [selectedContractBooking, setSelectedContractBooking] = useState<BookingItem | null>(null);

  // Guarantees Filter
  const [guaranteeSearch, setGuaranteeSearch] = useState("");
  const [guaranteeStatusFilter, setGuaranteeStatusFilter] = useState("Todos");

  // New Expense Modal
  const [newExpenseModalOpen, setNewExpenseModalOpen] = useState(false);
  const [category, setCategory] = useState<
    "Tintorería/Lavandería" | "Modistería/Arreglos" | "Bolsas/Empaques" | "Accesorios" | "Servicios" | "Otros"
  >("Tintorería/Lavandería");
  const [amount, setAmount] = useState<number | string>("");
  const [description, setDescription] = useState("");
  const [submittingExpense, setSubmittingExpense] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [sumRes, expRes, shiftRes, dressRes, bookRes] = await Promise.all([
      getCarissmaFinancialSummaryAction(),
      getCarissmaExpensesAction(),
      getCarissmaArchivedShiftsAction(),
      getDressesAction(),
      getRentalBookingsAction(),
    ]);

    if (sumRes.success && sumRes.data) setSummary(sumRes.data as FinancialSummaryData);
    if (expRes.success && Array.isArray(expRes.data)) setExpenses(expRes.data as ExpenseItem[]);
    if (shiftRes.success && Array.isArray(shiftRes.data)) setShifts(shiftRes.data as ShiftItem[]);
    if (dressRes.success && Array.isArray(dressRes.data)) setDresses(dressRes.data as DressItem[]);
    if (bookRes.success && Array.isArray(bookRes.data)) setBookings(bookRes.data as BookingItem[]);
    setLoading(false);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || Number(amount) <= 0) {
      toast.error("Completa la descripción y el monto del gasto");
      return;
    }

    setSubmittingExpense(true);
    const res = await createCarissmaExpenseAction({
      category,
      amount: Number(amount),
      description: description.trim(),
    });

    if (res.success) {
      toast.success("¡Gasto operativo de Carissma registrado!");
      setNewExpenseModalOpen(false);
      setDescription("");
      setAmount("");
      loadData();
    } else {
      toast.error(res.error || "Error al guardar gasto");
    }
    setSubmittingExpense(false);
  };

  const handleToggleGuarantee = async (booking: BookingItem, newStatus: "Devuelta" | "Retenida Parcial" | "Retenida Total") => {
    const res = await returnRentalDressAction({
      bookingId: booking.id,
      penaltyFee: booking.penaltyFee || 0,
      guaranteeStatus: newStatus,
      nextDressStatus: "Disponible",
    });

    if (res.success) {
      toast.success(`Garantía del contrato ${booking.contractNumber} actualizada a "${newStatus}"`);
      loadData();
    } else {
      toast.error(res.error || "Error al actualizar garantía");
    }
  };

  const totalIncome = (summary?.totalRentalsRevenue || 0) + (summary?.totalPenaltiesRevenue || 0);
  const netProfit = totalIncome - (summary?.totalExpenses || 0);

  // Top rented dresses
  const topDresses = [...dresses].sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0)).slice(0, 6);

  // Filtered Guarantees
  const filteredGuarantees = bookings.filter((b) => {
    const matchesSearch =
      b.clientName.toLowerCase().includes(guaranteeSearch.toLowerCase()) ||
      b.contractNumber.toLowerCase().includes(guaranteeSearch.toLowerCase()) ||
      b.dressName.toLowerCase().includes(guaranteeSearch.toLowerCase());
    const matchesStatus = guaranteeStatusFilter === "Todos" || b.guaranteeStatus === guaranteeStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amberGold-100 text-amberGold-800 rounded-md">
              Contabilidad & Finanzas Carissma
            </span>
            <h2 className="text-lg font-bold text-warm-900">Estado de Resultados, Garantías & Cajas</h2>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            P&L operativo, depósitos de garantía custodiados, gastos de tintorería/modistería y arqueos de turno.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-xl transition-colors shrink-0"
            title="Recargar"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setNewExpenseModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white text-xs font-bold rounded-xl shadow-warm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Gasto</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-3xl border border-warm-200 shadow-sm space-y-1">
          <p className="text-xs font-semibold text-warm-500">Ingresos Totales Renta</p>
          <p className="text-xl font-bold text-warm-900">{formatCurrency(totalIncome)}</p>
          <p className="text-[10px] text-warm-400">Rentas + Penalizaciones</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-emerald-200 shadow-sm space-y-1 bg-emerald-50/20">
          <p className="text-xs font-semibold text-emerald-700">Garantías en Custodia</p>
          <p className="text-xl font-bold text-emerald-800">
            {formatCurrency(summary?.totalGuaranteesInCustody || 0)}
          </p>
          <p className="text-[10px] text-emerald-600">Depósitos activos en tienda</p>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-rose-200 shadow-sm space-y-1 bg-rose-50/20">
          <p className="text-xs font-semibold text-rose-700">Gastos Operativos</p>
          <p className="text-xl font-bold text-rose-800">{formatCurrency(summary?.totalExpenses || 0)}</p>
          <p className="text-[10px] text-rose-600">Tintorería, modistería, fundas</p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-gradient-to-br from-amberGold-600 to-amberGold-800 text-white p-4 rounded-3xl shadow-warm space-y-1">
          <p className="text-xs font-semibold text-amberGold-100">Ganancia Neta Operativa</p>
          <p className="text-2xl font-extrabold">{formatCurrency(netProfit)}</p>
          <p className="text-[10px] text-amberGold-100">Margen después de egresos</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-warm-200 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab("summary")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === "summary"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <PieChart className="h-4 w-4" />
          <span>Egresos & Gastos ({expenses.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("guarantees")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === "guarantees"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Control de Garantías ({bookings.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("shifts")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === "shifts"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <History className="h-4 w-4" />
          <span>Arqueos de Caja ({shifts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === "analytics"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          <span>Rentabilidad por Prenda</span>
        </button>
      </div>

      {/* TAB 1: EXPENSES */}
      {activeTab === "summary" && (
        <div className="bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-warm-200">
            <h3 className="font-bold text-sm text-warm-900">Registro de Gastos Operativos</h3>
            <span className="text-xs font-bold text-rose-700">Total: {formatCurrency(summary?.totalExpenses || 0)}</span>
          </div>

          {expenses.length === 0 ? (
            <p className="p-8 text-center text-xs text-warm-400">Sin gastos operativos registrados.</p>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Categoría</th>
                    <th className="p-3">Descripción</th>
                    <th className="p-3 text-right">Monto (Bs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100 text-warm-900">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-warm-50/60 transition-colors">
                      <td className="p-3 text-warm-500">{new Date(exp.expenseDate).toLocaleDateString()}</td>
                      <td className="p-3 font-semibold text-amberGold-900">{exp.category}</td>
                      <td className="p-3">{exp.description}</td>
                      <td className="p-3 font-bold text-rose-700 text-right">{formatCurrency(exp.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {expenses.map((exp) => (
                <article key={exp.id} className="rounded-xl border border-warm-200 bg-warm-50/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-warm-500">{new Date(exp.expenseDate).toLocaleDateString()}</p>
                      <p className="mt-1 font-semibold text-sm text-warm-900 break-words">{exp.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-warm-500">Monto</p>
                      <p className="font-bold text-rose-700">{formatCurrency(exp.amount)}</p>
                    </div>
                  </div>
                  <span className="inline-flex px-2 py-1 bg-amberGold-50 text-amberGold-900 rounded-md font-semibold text-[11px] border border-amberGold-200">
                    {exp.category}
                  </span>
                </article>
              ))}
            </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: GUARANTEES */}
      {activeTab === "guarantees" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-warm-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por clienta, contrato o prenda..."
                value={guaranteeSearch}
                onChange={(e) => setGuaranteeSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={guaranteeStatusFilter}
                onChange={(e) => setGuaranteeStatusFilter(e.target.value)}
                className="py-1.5 px-3 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-800"
              >
                <option value="Todos">Todos los Estados</option>
                <option value="En Custodia">En Custodia</option>
                <option value="Devuelta">Devuelta</option>
                <option value="Retenida Parcial">Retenida Parcial</option>
                <option value="Retenida Total">Retenida Total</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-warm-200 shadow-sm overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                  <tr>
                    <th className="p-3">Contrato</th>
                    <th className="p-3">Clienta</th>
                    <th className="p-3">Prenda</th>
                    <th className="p-3">Depósito Garantía</th>
                    <th className="p-3">Estado Garantía</th>
                    <th className="p-3">Estado Renta</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100 text-warm-900">
                  {filteredGuarantees.map((b) => (
                    <tr key={b.id} className="hover:bg-warm-50/60 transition-colors">
                      <td className="p-3 font-mono font-bold text-amberGold-800">{b.contractNumber}</td>
                      <td className="p-3">
                        <p className="font-bold">{b.clientName}</p>
                        {b.clientPhone && <p className="text-[10px] text-warm-500">{b.clientPhone}</p>}
                      </td>
                      <td className="p-3">
                        <p className="font-medium">{b.dressName}</p>
                        <p className="text-[10px] text-warm-500">Talla {b.dressSize} • {b.dressColor}</p>
                      </td>
                      <td className="p-3 font-bold text-emerald-800">{formatCurrency(b.guaranteeAmount)}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.guaranteeStatus === "En Custodia"
                              ? "bg-emerald-100 text-emerald-800"
                              : b.guaranteeStatus === "Devuelta"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {b.guaranteeStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-semibold text-warm-600">{b.rentalStatus}</span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {b.guaranteeStatus === "En Custodia" && (
                          <button
                            onClick={() => handleToggleGuarantee(b, "Devuelta")}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                            title="Liberar garantía completa"
                          >
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            <span>Devolver</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedContractBooking(b)}
                          className="px-2.5 py-1 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Printer className="h-3 w-3" />
                          <span>Contrato</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 md:hidden">
              {filteredGuarantees.map((b) => (
                <article key={b.id} className="rounded-xl border border-warm-200 bg-warm-50/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-bold text-amberGold-800">{b.contractNumber}</p>
                      <p className="mt-1 font-bold text-warm-900 break-words">{b.clientName}</p>
                      {b.clientPhone && <p className="text-[11px] text-warm-500 break-all">{b.clientPhone}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-warm-500">Deposito garantia</p>
                      <p className="font-bold text-emerald-800">{formatCurrency(b.guaranteeAmount)}</p>
                    </div>
                  </div>
                  <div className="space-y-1 border-t border-warm-200 pt-3 text-xs">
                    <p className="font-medium text-warm-900">{b.dressName}</p>
                    <p className="text-warm-500">Talla {b.dressSize} · {b.dressColor}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        b.guaranteeStatus === "En Custodia"
                          ? "bg-emerald-100 text-emerald-800"
                          : b.guaranteeStatus === "Devuelta"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-rose-100 text-rose-800"
                      }`}>{b.guaranteeStatus}</span>
                      <span className="text-[10px] font-semibold text-warm-600">Renta: {b.rentalStatus}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 border-t border-warm-200 pt-3 sm:grid-cols-2">
                    {b.guaranteeStatus === "En Custodia" && (
                      <button
                        onClick={() => handleToggleGuarantee(b, "Devuelta")}
                        className="min-h-11 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2"
                        title="Liberar garantia completa"
                      >
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <span>Devolver garantia</span>
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedContractBooking(b)}
                      className="min-h-11 px-3 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Contrato</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SHIFTS */}
      {activeTab === "shifts" && (
        <div className="bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-warm-200">
            <h3 className="font-bold text-sm text-warm-900">Historial de Arqueos & Cierres de Turno</h3>
            <span className="text-xs font-bold text-warm-500">{shifts.length} turnos registrados</span>
          </div>

          {shifts.length === 0 ? (
            <p className="p-8 text-center text-xs text-warm-400">Sin turnos de caja archivados.</p>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Cajero</th>
                    <th className="p-3">Apertura</th>
                    <th className="p-3">Alquileres Ef.</th>
                    <th className="p-3">Garantías Recibidas</th>
                    <th className="p-3">Garantías Devueltas</th>
                    <th className="p-3">Cierre Declarado</th>
                    <th className="p-3">Discrepancia</th>
                    <th className="p-3 text-right">Informe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100 text-warm-900">
                  {shifts.map((s) => (
                    <tr key={s.id} className="hover:bg-warm-50/60 transition-colors">
                      <td className="p-3 font-bold">{s.shiftDate}</td>
                      <td className="p-3">{s.cashierName}</td>
                      <td className="p-3">{formatCurrency(s.openingBalance)}</td>
                      <td className="p-3 font-bold text-emerald-700">{formatCurrency(s.totalSalesCash || 0)}</td>
                      <td className="p-3 font-semibold text-emerald-700">+{formatCurrency(s.totalGuaranteesInCustody || 0)}</td>
                      <td className="p-3 font-semibold text-rose-700">-{formatCurrency(s.totalGuaranteesReturned || 0)}</td>
                      <td className="p-3 font-bold">{formatCurrency(s.declaredCash || 0)}</td>
                      <td className="p-3 font-bold">
                        <span className={(s.discrepancy || 0) === 0 ? "text-emerald-700" : "text-rose-700"}>
                          {formatCurrency(s.discrepancy || 0)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setActiveShiftReport(s as unknown as CarissmaShiftReportData);
                            setShiftReportModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Printer className="h-3 w-3" />
                          <span>Informe</span>
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
                      <p className="font-bold text-sm text-warm-900">{s.shiftDate}</p>
                      <p className="mt-1 text-xs text-warm-600">{s.cashierName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] text-warm-500">Discrepancia</p>
                      <p className={`font-bold ${
                        (s.discrepancy || 0) === 0 ? "text-emerald-700" : "text-rose-700"
                      }`}>{formatCurrency(s.discrepancy || 0)}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-warm-200 pt-3 text-xs">
                    <div><dt className="text-warm-500">Apertura</dt><dd className="text-warm-800">{formatCurrency(s.openingBalance)}</dd></div>
                    <div><dt className="text-warm-500">Alquileres en efectivo</dt><dd className="font-bold text-emerald-700">{formatCurrency(s.totalSalesCash || 0)}</dd></div>
                    <div><dt className="text-warm-500">Garantias recibidas</dt><dd className="font-semibold text-emerald-700">+{formatCurrency(s.totalGuaranteesInCustody || 0)}</dd></div>
                    <div><dt className="text-warm-500">Garantias devueltas</dt><dd className="font-semibold text-rose-700">-{formatCurrency(s.totalGuaranteesReturned || 0)}</dd></div>
                    <div><dt className="text-warm-500">Cierre declarado</dt><dd className="font-bold text-warm-900">{formatCurrency(s.declaredCash || 0)}</dd></div>
                  </dl>
                  <button
                    onClick={() => {
                      setActiveShiftReport(s as unknown as CarissmaShiftReportData);
                      setShiftReportModalOpen(true);
                    }}
                    className="min-h-11 w-full px-3 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Informe</span>
                  </button>
                </article>
              ))}
            </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: ANALYTICS & TOP PRENDAS */}
      {activeTab === "analytics" && (
        <div className="bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-warm-200">
            <div>
              <h3 className="font-bold text-sm text-warm-900">Prendas con Mayor Rotación y Retorno (ROI)</h3>
              <p className="text-xs text-warm-500">Métricas de amortización de activos y número de usos.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topDresses.map((d) => {
              const totalRevenue = (d.timesUsed || 0) * d.baseRentalPrice;
              const roiPercent = d.acquisitionCost > 0 ? Math.round((totalRevenue / d.acquisitionCost) * 100) : 0;
              return (
                <div key={d.id} className="p-4 bg-warm-50 rounded-2xl border border-warm-200 space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 bg-amberGold-100 text-amberGold-900 text-[10px] font-bold rounded">
                      Talla {d.size}
                    </span>
                    <span className="text-xs font-bold text-emerald-800">{d.timesUsed || 0} alquileres</span>
                  </div>
                  <h4 className="font-bold text-sm text-warm-900 truncate">{d.name}</h4>
                  <p className="text-xs text-warm-500">{d.brand}</p>
                  <div className="pt-2 border-t border-warm-200 flex justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-warm-500">Ingresos Gen.:</span>
                      <p className="font-bold text-amberGold-900">{formatCurrency(totalRevenue)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-warm-500">Recuperación Costo:</span>
                      <p className="font-bold text-emerald-700">{roiPercent}% ROI</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Expense Modal */}
      {newExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Registrar Gasto Operativo Carissma</h3>
              <button onClick={() => setNewExpenseModalOpen(false)} aria-label="Cerrar modal">
                <X className="h-5 w-5 text-warm-400 hover:text-warm-800" />
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Categoría *</label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      e.target.value as "Tintorería/Lavandería" | "Modistería/Arreglos" | "Bolsas/Empaques" | "Accesorios" | "Servicios" | "Otros"
                    )
                  }
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium"
                >
                  <option value="Tintorería/Lavandería">Tintorería / Lavado Seco</option>
                  <option value="Modistería/Arreglos">Modistería & Arreglos de Costura</option>
                  <option value="Bolsas/Empaques">Bolsas Guardapolvo, Percheros & Empaques</option>
                  <option value="Accesorios">Accesorios, Bisutería & Complementos</option>
                  <option value="Servicios">Luz, Agua, Local & Mantenimiento</option>
                  <option value="Otros">Otros Gastos Operativos</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-warm-800">Monto del Gasto (Bs) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="ej: 120"
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-warm-800">Descripción Detallada *</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ej: Lavado en seco de 4 vestidos de gala"
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-warm-900"
                  required
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setNewExpenseModalOpen(false)}
                  className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  className="px-5 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl font-bold shadow-warm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{submittingExpense ? "Guardando..." : "Guardar Gasto"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Report Modal */}
      <ShiftReportModal
        isOpen={shiftReportModalOpen}
        report={activeShiftReport}
        onClose={() => setShiftReportModalOpen(false)}
      />

      {/* Rental Contract Modal */}
      <RentalContractModal
        isOpen={!!selectedContractBooking}
        booking={selectedContractBooking}
        onClose={() => setSelectedContractBooking(null)}
      />
    </div>
  );
}
