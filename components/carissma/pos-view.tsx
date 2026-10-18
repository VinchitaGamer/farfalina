"use client";

import React, { useState, useEffect } from "react";
import {
  Calculator,
  Store,
  Lock,
  Unlock,
  Plus,
  CheckCircle2,
  Trash2,
  Receipt,
  Printer,
  X,
  Search,
  Shirt,
  RefreshCw,
  Edit2,
  Check
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  getDressesAction,
  createDressAction,
  updateDressAction,
  deleteDressAction,
  updateDressStatusAction,
  createRentalBookingAction,
  getCarissmaCurrentShiftAction,
  openCarissmaCashShiftAction,
  closeCarissmaCashShiftAction,
  getCarissmaArchivedShiftsAction,
  createCarissmaExpenseAction
} from "@/app/actions/carissma";
import { searchCRMClientsAction } from "@/app/actions/crm";
import POSTicketModal, { CarissmaPOSTicketData } from "./pos-ticket-modal";
import ShiftReportModal, { CarissmaShiftReportData } from "./shift-report-modal";
import RentalContractModal, { RentalContractBooking } from "./rental-contract-modal";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface DressItem {
  id: string;
  name: string;
  brand: string;
  size: "XS" | "S" | "M" | "L" | "XL";
  category?: string | null;
  imageUrl?: string | null;
  baseRentalPrice: number;
  acquisitionCost: number;
  requiredGuarantee: number;
  color: string;
  condition: "Excelente" | "Bueno" | "Requiere Mantenimiento";
  status: "Disponible" | "Reservado" | "En Uso" | "En Lavandería";
  timesUsed: number;
  createdAt?: string | Date;
}

interface CRMClientSuggestion {
  id: string;
  name: string;
  phone: string;
  loyaltyTier?: string;
}

interface ArchivedShiftItem {
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

export default function PosView() {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<"terminal" | "stock" | "register">("terminal");
  const [mobileTerminalTab, setMobileTerminalTab] = useState<"dresses" | "cart">("dresses");
  const [dresses, setDresses] = useState<DressItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search (Terminal)
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [sizeFilter, setSizeFilter] = useState("Todos");
  const [searchQuery, setSearchQuery] = useState("");

  // Cart
  const [cart, setCart] = useState<{ dress: DressItem; qty: number; rentalPrice: number; guarantee: number }[]>([]);

  // Shift & Cash Register State
  const [currentShift, setCurrentShift] = useState<ArchivedShiftItem | null>(null);
  const [archivedShifts, setArchivedShifts] = useState<ArchivedShiftItem[]>([]);
  const [openShiftModalOpen, setOpenShiftModalOpen] = useState(false);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState<number | string>(300);
  const [cashierName, setCashierName] = useState("Agente Carissma");
  const [declaredCash, setDeclaredCash] = useState<number | string>("");
  const [closingNotes, setClosingNotes] = useState("");

  // Client Selection / CRM Autocomplete
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [crmSuggestions, setCrmSuggestions] = useState<CRMClientSuggestion[]>([]);
  const [showCrmSuggestions, setShowCrmSuggestions] = useState(false);

  // Rental Dates
  const [rentalStartDate, setRentalStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [rentalEndDate, setRentalEndDate] = useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  // Payment Calculation
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [cashGiven, setCashGiven] = useState<number | string>("");
  const [notes, setNotes] = useState("");

  // Modals for Ticket, Contract and Shift Report
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketData, setTicketData] = useState<CarissmaPOSTicketData | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractBooking, setContractBooking] = useState<RentalContractBooking | null>(null);
  const [shiftReportModalOpen, setShiftReportModalOpen] = useState(false);
  const [activeShiftReport, setActiveShiftReport] = useState<CarissmaShiftReportData | null>(null);

  // Expense Modal
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<
    "Tintorería/Lavandería" | "Modistería/Arreglos" | "Bolsas/Empaques" | "Accesorios" | "Servicios" | "Otros"
  >("Tintorería/Lavandería");
  const [expenseAmount, setExpenseAmount] = useState<number | string>(60);
  const [expenseDesc, setExpenseDesc] = useState("");

  // Inventory (Stock) Management Modal
  const [isDressModalOpen, setIsDressModalOpen] = useState(false);
  const [editingDress, setEditingDress] = useState<DressItem | null>(null);
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [stockCategoryFilter, setStockCategoryFilter] = useState("Todos");
  const [stockStatusFilter, setStockStatusFilter] = useState("Todos");

  // Dress Form state
  const [dressName, setDressName] = useState("");
  const [dressBrand, setDressBrand] = useState("Carolina Herrera");
  const [dressSize, setDressSize] = useState<"XS" | "S" | "M" | "L" | "XL">("M");
  const [dressCategory, setDressCategory] = useState("Gala");
  const [dressImageUrl, setDressImageUrl] = useState("");
  const [dressBasePrice, setDressBasePrice] = useState<number | string>(450);
  const [dressAcqCost, setDressAcqCost] = useState<number | string>(2500);
  const [dressGuarantee, setDressGuarantee] = useState<number | string>(500);
  const [dressColor, setDressColor] = useState("Rosa Gold");
  const [dressCondition, setDressCondition] = useState<"Excelente" | "Bueno" | "Requiere Mantenimiento">("Excelente");

  const DRESS_CATEGORIES = ["Todos", "Gala", "Novia", "Quinceañera", "Coctel", "Graduación", "Fiesta"];
  const SIZES = ["Todos", "XS", "S", "M", "L", "XL"];

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [dressesRes, shiftRes, archRes] = await Promise.all([
      getDressesAction(),
      getCarissmaCurrentShiftAction(),
      getCarissmaArchivedShiftsAction(),
    ]);

    if (dressesRes.success && Array.isArray(dressesRes.data)) {
      setDresses(dressesRes.data as DressItem[]);
    }
    if (shiftRes.success) setCurrentShift(shiftRes.data as ArchivedShiftItem);
    if (archRes.success && Array.isArray(archRes.data)) setArchivedShifts(archRes.data as ArchivedShiftItem[]);
    setLoading(false);
  };

  const handleClientNameChange = async (val: string) => {
    setClientName(val);
    if (val.trim().length >= 2) {
      const res = await searchCRMClientsAction(val);
      if (res.success && Array.isArray(res.data)) {
        setCrmSuggestions(res.data as CRMClientSuggestion[]);
        setShowCrmSuggestions(true);
      }
    } else {
      setCrmSuggestions([]);
      setShowCrmSuggestions(false);
    }
  };

  const selectCrmClient = (client: CRMClientSuggestion) => {
    setClientName(client.name);
    setClientPhone(client.phone || "");
    setShowCrmSuggestions(false);
    toast.info(`Clienta seleccionada: ${client.name} (${client.loyaltyTier || "Bronce"})`);
  };

  const addToCart = (dress: DressItem) => {
    if (dress.status !== "Disponible") {
      toast.error(`El vestido "${dress.name}" no está disponible (${dress.status})`);
      return;
    }
    const exists = cart.find((c) => c.dress.id === dress.id);
    if (exists) {
      toast.info("Esta prenda ya está en la orden actual");
      return;
    }
    setCart([
      ...cart,
      {
        dress,
        qty: 1,
        rentalPrice: dress.baseRentalPrice || 450,
        guarantee: dress.requiredGuarantee || 500,
      },
    ]);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.dress.id !== id));
  };

  const totalRentals = cart.reduce((acc, c) => acc + c.rentalPrice, 0);
  const totalGuarantees = cart.reduce((acc, c) => acc + c.guarantee, 0);
  const grandTotal = totalRentals + totalGuarantees;

  const changeDue =
    paymentMethod === "Efectivo" && Number(cashGiven) >= grandTotal ? Number(cashGiven) - grandTotal : 0;

  const handleProcessSale = async () => {
    if (cart.length === 0) {
      toast.error("El carrito está vacío");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Ingresa el nombre de la clienta");
      return;
    }
    if (paymentMethod === "Efectivo" && Number(cashGiven) < grandTotal && cashGiven !== "") {
      toast.error("El efectivo entregado es menor al total a percibir");
      return;
    }

    const createdContracts: string[] = [];
    let firstBookingData: RentalContractBooking | null = null;

    for (const item of cart) {
      const res = await createRentalBookingAction({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        dressId: item.dress.id,
        rentalStartDate,
        rentalEndDate,
        rentalPrice: item.rentalPrice,
        guaranteeAmount: item.guarantee,
        paymentMethod,
        notes: notes.trim() || undefined,
      });

      if (res.success && res.data) {
        const bookingData = res.data as { contractNumber: string };
        createdContracts.push(bookingData.contractNumber);
        if (!firstBookingData) {
          firstBookingData = res.data as unknown as RentalContractBooking;
        }
      }
    }

    if (createdContracts.length > 0) {
      toast.success("¡Cobro y Alquiler registrado exitosamente!");

      if (firstBookingData) {
        setContractBooking(firstBookingData);
      }

      setTicketData({
        contractNumber: createdContracts.join(", "),
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        items: cart.map((c) => ({
          name: c.dress.name,
          size: c.dress.size,
          color: c.dress.color,
          rentalPrice: c.rentalPrice,
          guarantee: c.guarantee,
        })),
        rentalStartDate,
        rentalEndDate,
        totalRental: totalRentals,
        totalGuarantee: totalGuarantees,
        paymentMethod,
        cashGiven: paymentMethod === "Efectivo" && Number(cashGiven) > 0 ? Number(cashGiven) : undefined,
        change: changeDue,
        date: new Date().toISOString(),
        cashierName,
      });

      setTicketModalOpen(true);
      setCart([]);
      setClientName("");
      setClientPhone("");
      setCashGiven("");
      setNotes("");
      loadAll();
    } else {
      toast.error("Error al procesar el alquiler");
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await openCarissmaCashShiftAction(Number(openingBalance), cashierName);
    if (res.success) {
      toast.success("¡Turno de caja abierto!");
      setOpenShiftModalOpen(false);
      loadAll();
    } else {
      toast.error(res.error || "Error al abrir turno");
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;

    const res = await closeCarissmaCashShiftAction({
      shiftId: currentShift.id,
      declaredCash: Number(declaredCash),
      cashierName,
      notes: closingNotes.trim() || undefined,
    });

    if (res.success && res.data) {
      toast.success("¡Turno cerrado y arqueo registrado!");
      setCloseShiftModalOpen(false);
      setActiveShiftReport(res.data as CarissmaShiftReportData);
      setShiftReportModalOpen(true);
      loadAll();
    } else {
      toast.error(res.error || "Error al cerrar caja");
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc.trim() || Number(expenseAmount) <= 0) return;
    const res = await createCarissmaExpenseAction({
      category: expenseCategory,
      amount: Number(expenseAmount),
      description: expenseDesc.trim(),
    });
    if (res.success) {
      toast.success("Gasto operativo registrado");
      setExpenseModalOpen(false);
      setExpenseDesc("");
      loadAll();
    } else {
      toast.error(res.error || "Error al registrar gasto");
    }
  };

  // Stock CRUD
  const handleOpenNewDressModal = () => {
    setEditingDress(null);
    setDressName("");
    setDressBrand("Carolina Herrera");
    setDressSize("M");
    setDressCategory("Gala");
    setDressImageUrl("");
    setDressBasePrice(450);
    setDressAcqCost(2500);
    setDressGuarantee(500);
    setDressColor("Rosa Gold");
    setDressCondition("Excelente");
    setIsDressModalOpen(true);
  };

  const handleOpenEditDressModal = (dress: DressItem) => {
    setEditingDress(dress);
    setDressName(dress.name);
    setDressBrand(dress.brand);
    setDressSize(dress.size);
    setDressCategory(dress.category || "Gala");
    setDressImageUrl(dress.imageUrl || "");
    setDressBasePrice(dress.baseRentalPrice || 450);
    setDressAcqCost(dress.acquisitionCost || 2000);
    setDressGuarantee(dress.requiredGuarantee || 500);
    setDressColor(dress.color);
    setDressCondition(dress.condition || "Excelente");
    setIsDressModalOpen(true);
  };

  const handleSaveDress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dressName.trim() || !dressBrand.trim() || !dressColor.trim()) {
      toast.error("Completa los campos obligatorios del vestido");
      return;
    }

    if (editingDress) {
      const res = await updateDressAction({
        id: editingDress.id,
        name: dressName.trim(),
        brand: dressBrand.trim(),
        size: dressSize,
        category: dressCategory,
        imageUrl: dressImageUrl.trim() || null,
        baseRentalPrice: Number(dressBasePrice),
        acquisitionCost: Number(dressAcqCost),
        requiredGuarantee: Number(dressGuarantee),
        color: dressColor.trim(),
        condition: dressCondition,
      });

      if (res.success) {
        toast.success("¡Vestido actualizado!");
        setIsDressModalOpen(false);
        loadAll();
      } else {
        toast.error(res.error || "Error al actualizar vestido");
      }
    } else {
      const res = await createDressAction({
        name: dressName.trim(),
        brand: dressBrand.trim(),
        size: dressSize,
        category: dressCategory,
        imageUrl: dressImageUrl.trim() || null,
        baseRentalPrice: Number(dressBasePrice),
        acquisitionCost: Number(dressAcqCost),
        requiredGuarantee: Number(dressGuarantee),
        color: dressColor.trim(),
      });

      if (res.success) {
        toast.success("¡Vestido registrado en el inventario!");
        setIsDressModalOpen(false);
        loadAll();
      } else {
        toast.error(res.error || "Error al registrar vestido");
      }
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: DressItem["status"]) => {
    const res = await updateDressStatusAction(id, newStatus);
    if (res.success) {
      toast.success(`Estado cambiado a "${newStatus}"`);
      loadAll();
    } else {
      toast.error(res.error || "Error al actualizar estado");
    }
  };

  const handleDeleteDress = async (id: string, name: string) => {
    const ok = await confirm(`¿Eliminar el vestido "${name}" del inventario?`);
    if (!ok) return;
    const res = await deleteDressAction(id);
    if (res.success) {
      toast.success("Vestido eliminado");
      loadAll();
    } else {
      toast.error(res.error || "Error al eliminar");
    }
  };

  const theoreticalCash = currentShift
    ? currentShift.openingBalance +
      (currentShift.totalSalesCash || 0) +
      (currentShift.totalPenalties || 0) +
      (currentShift.totalGuaranteesInCustody || 0) -
      (currentShift.totalGuaranteesReturned || 0) -
      (currentShift.totalExpenses || 0)
    : 0;

  const filteredDresses = dresses.filter((d) => {
    const matchesCat = categoryFilter === "Todos" || d.category === categoryFilter;
    const matchesSize = sizeFilter === "Todos" || d.size === sizeFilter;
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.color.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSize && matchesSearch;
  });

  const filteredStockDresses = dresses.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
      d.brand.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
      d.color.toLowerCase().includes(stockSearchQuery.toLowerCase());
    const matchesCat = stockCategoryFilter === "Todos" || d.category === stockCategoryFilter;
    const matchesStatus = stockStatusFilter === "Todos" || d.status === stockStatusFilter;
    return matchesSearch && matchesCat && matchesStatus;
  });

  const availableCount = dresses.filter((d) => d.status === "Disponible").length;
  const inUseCount = dresses.filter((d) => d.status === "En Uso" || d.status === "Reservado").length;
  const inLaundryCount = dresses.filter((d) => d.status === "En Lavandería").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amberGold-600 text-white rounded-2xl shadow-warm">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-warm-900">Punto de Venta & Inventario Carissma</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amberGold-100 text-amberGold-800 rounded-md">
                POS Mostrador
              </span>
            </div>
            <p className="text-xs text-warm-500 mt-0.5">
              Terminal de cobro de rentas, control de stock de vestidos y arqueo de turnos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentShift ? (
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Caja Abierta ({formatCurrency(theoreticalCash)})</span>
              </div>
              <button
                onClick={() => {
                  setDeclaredCash(theoreticalCash);
                  setCloseShiftModalOpen(true);
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Cerrar Turno</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOpenShiftModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
            >
              <Unlock className="h-4 w-4" />
              <span>Abrir Turno de Caja</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-warm-200 pb-2 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab("terminal")}
          className={`min-h-[44px] px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap touch-manipulation active:scale-98 ${
            activeTab === "terminal"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Terminal POS (Alquileres Mostrador)</span>
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`min-h-[44px] px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap touch-manipulation active:scale-98 ${
            activeTab === "stock"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <Shirt className="h-4 w-4" />
          <span>Control de Stock & Prendas ({dresses.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("register")}
          className={`min-h-[44px] px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap touch-manipulation active:scale-98 ${
            activeTab === "register"
              ? "bg-amberGold-600 text-white shadow-warm"
              : "bg-warm-100 text-warm-700 hover:bg-warm-200"
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Arqueo & Turnos de Caja</span>
        </button>
      </div>

      {/* TAB 1: TERMINAL POS */}
      {activeTab === "terminal" && (
        <div className="space-y-4">
          {/* Mobile Terminal Tab Toggle (< 1024px) */}
          <div className="flex lg:hidden bg-warm-100 p-1 rounded-2xl border border-warm-200 gap-1">
            <button
              type="button"
              onClick={() => setMobileTerminalTab("dresses")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px] active:scale-98 touch-manipulation ${
                mobileTerminalTab === "dresses"
                  ? "bg-white text-amberGold-900 shadow-sm border border-warm-200"
                  : "text-warm-600 hover:text-warm-900"
              }`}
            >
              <Shirt className="h-4 w-4" />
              <span>Vestidos ({filteredDresses.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTerminalTab("cart")}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px] active:scale-98 touch-manipulation ${
                mobileTerminalTab === "cart"
                  ? "bg-white text-amberGold-900 shadow-sm border border-warm-200"
                  : "text-warm-600 hover:text-warm-900"
              }`}
            >
              <Receipt className="h-4 w-4" />
              <span>Alquiler ({cart.length}){cart.length > 0 ? ` · ${formatCurrency(grandTotal)}` : ""}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Dress Selection Grid */}
            <div className={`${mobileTerminalTab === "cart" ? "hidden lg:block" : "block"} lg:col-span-7 space-y-4`}>
              {/* Filters */}
              <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {DRESS_CATEGORIES.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3.5 py-2 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 ${
                          categoryFilter === cat
                            ? "bg-amberGold-600 text-white shadow-warm"
                            : "bg-warm-100 text-warm-700 hover:bg-warm-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="h-4 w-4 text-warm-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar vestido..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                    />
                  </div>
                </div>

                {/* Sizes Filter */}
                <div className="flex items-center gap-2 pt-2 border-t border-warm-100 text-xs overflow-x-auto pb-1">
                  <span className="font-bold text-warm-600 whitespace-nowrap">Talla:</span>
                  {SIZES.map((sz) => (
                    <button
                      key={sz}
                      onClick={() => setSizeFilter(sz)}
                      className={`px-3.5 py-2 min-h-[44px] sm:min-h-[36px] min-w-[44px] rounded-xl text-xs font-bold transition-colors touch-manipulation active:scale-95 ${
                        sizeFilter === sz
                          ? "bg-amberGold-100 text-amberGold-900 font-extrabold border border-amberGold-300 shadow-sm"
                          : "bg-warm-50 text-warm-600 hover:bg-warm-100"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

            {/* Dresses Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto p-1">
              {filteredDresses.map((dress) => {
                const isSelected = cart.some((c) => c.dress.id === dress.id);
                return (
                  <button
                    key={dress.id}
                    onClick={() => addToCart(dress)}
                    disabled={dress.status !== "Disponible"}
                    className={`p-3 bg-white rounded-2xl border text-left flex flex-col justify-between transition-all group ${
                      isSelected
                        ? "border-amberGold-500 ring-2 ring-amberGold-200 shadow-sm"
                        : dress.status === "Disponible"
                        ? "border-warm-200 hover:border-amberGold-400 hover:shadow-sm"
                        : "border-warm-200 opacity-60 cursor-not-allowed bg-warm-50"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-1.5">
                        <span className="px-2 py-0.5 bg-amberGold-50 text-amberGold-800 text-[10px] font-bold rounded-md border border-amberGold-200">
                          Talla {dress.size}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                            dress.status === "Disponible"
                              ? "bg-emerald-100 text-emerald-800"
                              : dress.status === "Reservado"
                              ? "bg-amber-100 text-amber-800"
                              : dress.status === "En Uso"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {dress.status}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-warm-900 line-clamp-1">{dress.name}</p>
                      <p className="text-[10px] text-warm-500">{dress.brand} • {dress.color}</p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-warm-100 flex items-center justify-between">
                      <span className="font-bold text-xs text-amberGold-800">
                        {formatCurrency(dress.baseRentalPrice || 450)}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        Garantía: {formatCurrency(dress.requiredGuarantee || 500)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Checkout & Cart Terminal Panel */}
          <div className={`${mobileTerminalTab === "dresses" ? "hidden lg:block" : "block"} lg:col-span-5 bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4`}>
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <h3 className="font-bold text-sm text-warm-900">Orden de Alquiler Mostrador</h3>
              <span className="text-xs font-mono font-bold text-amberGold-800 bg-amberGold-50 px-2.5 py-0.5 rounded-full">
                {cart.length} prenda(s)
              </span>
            </div>

            {/* Client Info & CRM Autocomplete */}
            <div className="space-y-2 relative">
              <label className="text-xs font-bold text-warm-800">Clienta (Buscar en CRM o Nueva)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nombre de la clienta..."
                  value={clientName}
                  onChange={(e) => handleClientNameChange(e.target.value)}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                />
                {showCrmSuggestions && crmSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white rounded-xl border border-warm-200 shadow-xl max-h-40 overflow-y-auto">
                    {crmSuggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCrmClient(c)}
                        className="w-full p-2.5 text-left text-xs hover:bg-amberGold-50 flex justify-between items-center border-b border-warm-100 last:border-0 min-h-[44px]"
                      >
                        <span className="font-bold text-warm-900">{c.name}</span>
                        <span className="text-[10px] text-warm-500">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                type="tel"
                placeholder="Teléfono / WhatsApp (+591...)"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="font-bold text-warm-700">Fecha Retiro</label>
                <input
                  type="date"
                  value={rentalStartDate}
                  onChange={(e) => setRentalStartDate(e.target.value)}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium text-base sm:text-xs md:text-sm text-warm-900"
                />
              </div>
              <div>
                <label className="font-bold text-warm-700">Fecha Retorno</label>
                <input
                  type="date"
                  value={rentalEndDate}
                  onChange={(e) => setRentalEndDate(e.target.value)}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium text-base sm:text-xs md:text-sm text-warm-900"
                />
              </div>
            </div>

            {/* Selected Items */}
            <div className="space-y-2 border-t border-b border-warm-100 py-3 max-h-48 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-center text-xs text-warm-400 py-4">Selecciona prendas del catálogo para alquilar</p>
              ) : (
                cart.map((item) => (
                  <div key={item.dress.id} className="p-2 bg-warm-50 rounded-xl text-xs flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-warm-900 truncate">{item.dress.name}</p>
                      <p className="text-[10px] text-warm-500">Talla {item.dress.size} • Renta: {formatCurrency(item.rentalPrice)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-700 text-xs">+{formatCurrency(item.guarantee)} G.</span>
                      <button
                        onClick={() => removeFromCart(item.dress.id)}
                        className="min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center p-2 text-rose-500 hover:text-rose-700 active:scale-95 touch-manipulation rounded-lg hover:bg-rose-50"
                        title="Quitar"
                        aria-label="Quitar prenda"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Summary Totals */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-warm-600">
                <span>Subtotal Renta:</span>
                <span className="font-bold text-warm-900">{formatCurrency(totalRentals)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>Depósito de Garantía:</span>
                <span className="font-bold text-emerald-700">+{formatCurrency(totalGuarantees)}</span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-amberGold-900 border-t border-warm-200 pt-2">
                <span>TOTAL A PERCIBIR:</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-2 border-t border-warm-100">
              <div className="grid grid-cols-3 gap-2">
                {(["Efectivo", "QR", "Tarjeta"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`min-h-[44px] py-2 rounded-xl text-xs font-bold transition-all touch-manipulation active:scale-95 ${
                      paymentMethod === m
                        ? "bg-amberGold-600 text-white shadow-warm"
                        : "bg-warm-100 text-warm-700 hover:bg-warm-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {paymentMethod === "Efectivo" && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-warm-600">Efectivo Recibido (Bs)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={cashGiven}
                        onChange={(e) => setCashGiven(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder={grandTotal.toString()}
                        className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-bold text-warm-900 focus:outline-none focus:border-amberGold-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-warm-600">Cambio / Vuelto</label>
                      <div className="w-full p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-extrabold text-emerald-800 flex items-center">
                        {formatCurrency(changeDue)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-warm-500 block mb-1">Efectivo Rápido:</span>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCashGiven(grandTotal.toString())}
                        className="min-h-[44px] px-2 py-2 bg-amberGold-50 hover:bg-amberGold-100 text-amberGold-900 rounded-xl text-xs font-bold border border-amberGold-200 transition-all active:scale-95 touch-manipulation flex items-center justify-center"
                      >
                        Exacto
                      </button>
                      {[10, 20, 50, 100, 200].map((denom) => (
                        <button
                          key={denom}
                          type="button"
                          onClick={() => setCashGiven(denom.toString())}
                          className="min-h-[44px] px-2 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold border border-warm-200 transition-all active:scale-95 touch-manipulation flex items-center justify-center"
                        >
                          Bs {denom}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Checkout Action Button */}
            <button
              onClick={handleProcessSale}
              disabled={cart.length === 0 || !clientName.trim()}
              className="w-full min-h-[48px] py-3 bg-amberGold-600 hover:bg-amberGold-700 active:bg-amberGold-800 disabled:opacity-50 text-white rounded-2xl text-xs font-extrabold shadow-warm flex items-center justify-center gap-2 transition-all touch-manipulation active:scale-98"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Confirmar Alquiler & Emitir Ticket</span>
            </button>
          </div>
        </div>

        {/* Floating Bottom Trigger for Mobile Dresses View */}
        {mobileTerminalTab === "dresses" && cart.length > 0 && (
          <div className="fixed bottom-20 left-3 right-3 lg:hidden z-30 animate-in slide-in-from-bottom duration-200">
            <button
              type="button"
              onClick={() => setMobileTerminalTab("cart")}
              className="w-full bg-amberGold-600 hover:bg-amberGold-700 active:bg-amberGold-800 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between font-bold text-sm border border-amberGold-400 active:scale-98 transition-all min-h-[48px] touch-manipulation"
            >
              <span className="flex items-center gap-2">
                <Shirt className="h-5 w-5" />
                <span>Ver Alquiler ({cart.length} prenda{cart.length > 1 ? "s" : ""})</span>
              </span>
              <span className="font-mono bg-white/20 px-3 py-1 rounded-xl">
                {formatCurrency(grandTotal)} &rarr;
              </span>
            </button>
          </div>
        )}
      </div>
      )}

      {/* TAB 2: STOCK & INVENTARIO */}
      {activeTab === "stock" && (
        <div className="space-y-5">
          {/* Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-1">
              <span className="text-xs text-warm-500 font-semibold">Total Vestidos</span>
              <p className="text-xl font-bold text-warm-900">{dresses.length} prendas</p>
              <p className="text-[10px] text-warm-400">En catálogo Carissma</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-1 bg-emerald-50/20">
              <span className="text-xs text-emerald-700 font-semibold">Disponibles</span>
              <p className="text-xl font-bold text-emerald-800">{availableCount} prendas</p>
              <p className="text-[10px] text-emerald-600">Listas para alquiler</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-sm space-y-1 bg-purple-50/20">
              <span className="text-xs text-purple-700 font-semibold">En Uso / Reservadas</span>
              <p className="text-xl font-bold text-purple-800">{inUseCount} prendas</p>
              <p className="text-[10px] text-purple-600">Alquiladas activas</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm space-y-1 bg-blue-50/20">
              <span className="text-xs text-blue-700 font-semibold">En Tintorería / Lavado</span>
              <p className="text-xl font-bold text-blue-800">{inLaundryCount} prendas</p>
              <p className="text-[10px] text-blue-600">Higienización / Retorno</p>
            </div>
          </div>

          {/* Filter and Action Bar */}
          <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-60">
                <Search className="h-4 w-4 text-warm-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar prenda o marca..."
                  value={stockSearchQuery}
                  onChange={(e) => setStockSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none focus:border-amberGold-500"
                />
              </div>

              <select
                value={stockCategoryFilter}
                onChange={(e) => setStockCategoryFilter(e.target.value)}
                className="min-h-[44px] sm:min-h-[36px] py-1.5 px-3 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-800"
              >
                {DRESS_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="min-h-[44px] sm:min-h-[36px] py-1.5 px-3 bg-warm-50 border border-warm-200 rounded-xl text-xs font-semibold text-warm-800"
              >
                <option value="Todos">Todos los Estados</option>
                <option value="Disponible">Disponible</option>
                <option value="Reservado">Reservado</option>
                <option value="En Uso">En Uso</option>
                <option value="En Lavandería">En Lavandería</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={loadAll}
                disabled={loading}
                className="min-h-[44px] min-w-[44px] p-2 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-xl transition-colors shrink-0 flex items-center justify-center touch-manipulation active:scale-95"
                title="Recargar"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleOpenNewDressModal}
                className="min-h-[44px] px-4 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-warm whitespace-nowrap touch-manipulation active:scale-98"
              >
                <Plus className="h-4 w-4" />
                <span>Nuevo Vestido</span>
              </button>
            </div>
          </div>

          {/* Dresses Stock Dual View (Table on Desktop, Cards on Mobile) */}
          <div className="bg-white rounded-3xl border border-warm-200 shadow-sm overflow-hidden">
            {/* Desktop / Tablet Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                  <tr>
                    <th className="p-3">Prenda</th>
                    <th className="p-3">Marca & Color</th>
                    <th className="p-3">Talla / Categoría</th>
                    <th className="p-3">Tarifa Renta</th>
                    <th className="p-3">Garantía</th>
                    <th className="p-3">Usos</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-100 text-warm-900">
                  {filteredStockDresses.map((dress) => (
                    <tr key={dress.id} className="hover:bg-warm-50/60 transition-colors">
                      <td className="p-3">
                        <p className="font-bold text-warm-900">{dress.name}</p>
                        <span className="text-[10px] text-warm-400 font-mono">ID: {dress.id.slice(-6)}</span>
                      </td>
                      <td className="p-3 text-warm-600">
                        <p className="font-medium text-warm-900">{dress.brand}</p>
                        <p className="text-[10px] text-warm-500">{dress.color}</p>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-amberGold-50 text-amberGold-800 font-mono font-bold border border-amberGold-200">
                          Talla {dress.size}
                        </span>
                        <p className="text-[10px] text-warm-500 mt-0.5">{dress.category || "Gala"}</p>
                      </td>
                      <td className="p-3 font-bold text-amberGold-900">{formatCurrency(dress.baseRentalPrice)}</td>
                      <td className="p-3 text-emerald-700 font-bold">{formatCurrency(dress.requiredGuarantee)}</td>
                      <td className="p-3 font-semibold">{dress.timesUsed || 0} usos</td>
                      <td className="p-3">
                        <select
                          value={dress.status}
                          onChange={(e) => handleQuickStatusChange(dress.id, e.target.value as DressItem["status"])}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                            dress.status === "Disponible"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : dress.status === "Reservado"
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : dress.status === "En Uso"
                              ? "bg-purple-50 text-purple-800 border-purple-300"
                              : "bg-blue-50 text-blue-800 border-blue-300"
                          }`}
                        >
                          <option value="Disponible">Disponible</option>
                          <option value="Reservado">Reservado</option>
                          <option value="En Uso">En Uso</option>
                          <option value="En Lavandería">En Lavandería</option>
                        </select>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        <button
                          onClick={() => handleOpenEditDressModal(dress)}
                          className="min-h-[36px] min-w-[36px] p-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg inline-flex items-center justify-center"
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDress(dress.id, dress.name)}
                          className="min-h-[36px] min-w-[36px] p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg inline-flex items-center justify-center"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Touch Cards (< 768px) */}
            <div className="block md:hidden space-y-3 p-3">
              {filteredStockDresses.map((dress) => (
                <div key={dress.id} className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-warm-900 leading-snug">{dress.name}</p>
                      <p className="text-xs text-warm-500">{dress.brand} • {dress.color}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg bg-amberGold-50 text-amberGold-900 font-mono text-xs font-bold border border-amberGold-200 shrink-0">
                      Talla {dress.size}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-warm-50 p-2.5 rounded-xl border border-warm-100">
                    <div>
                      <span className="text-[10px] text-warm-500 block">Tarifa Renta</span>
                      <span className="font-bold text-amberGold-900 font-mono">{formatCurrency(dress.baseRentalPrice)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-warm-500 block">Garantía</span>
                      <span className="font-bold text-emerald-700 font-mono">{formatCurrency(dress.requiredGuarantee)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-warm-500 block">Categoría</span>
                      <span className="font-medium text-warm-700">{dress.category || "Gala"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-warm-500 block">Usos</span>
                      <span className="font-semibold text-warm-800">{dress.timesUsed || 0} alquileres</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-warm-600">Estado de la prenda</label>
                    <select
                      value={dress.status}
                      onChange={(e) => handleQuickStatusChange(dress.id, e.target.value as DressItem["status"])}
                      className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border ${
                        dress.status === "Disponible"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : dress.status === "Reservado"
                          ? "bg-amber-50 text-amber-800 border-amber-300"
                          : dress.status === "En Uso"
                          ? "bg-purple-50 text-purple-800 border-purple-300"
                          : "bg-blue-50 text-blue-800 border-blue-300"
                      }`}
                    >
                      <option value="Disponible">Disponible</option>
                      <option value="Reservado">Reservado</option>
                      <option value="En Uso">En Uso</option>
                      <option value="En Lavandería">En Lavandería</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-warm-100">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDressModal(dress)}
                      className="flex-1 min-h-[44px] bg-warm-100 hover:bg-warm-200 active:bg-warm-300 text-warm-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 touch-manipulation active:scale-98 transition-all"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDress(dress.id, dress.name)}
                      className="min-h-[44px] min-w-[44px] px-3 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 touch-manipulation active:scale-95 transition-all"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REGISTER & SHIFTS */}
      {activeTab === "register" && (
        <div className="space-y-6">
          {currentShift && (
            <div className="bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-warm-200">
                <div className="flex items-center gap-2">
                  <Unlock className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-sm text-warm-900">Arqueo en Vivo — Turno Carissma</h3>
                </div>
                <button
                  onClick={() => setExpenseModalOpen(true)}
                  className="px-3 py-1.5 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Registrar Gasto</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-warm-50 rounded-xl space-y-1">
                  <span className="text-warm-500">Saldo Apertura:</span>
                  <p className="font-bold text-warm-900">{formatCurrency(currentShift.openingBalance)}</p>
                </div>
                <div className="p-3 bg-warm-50 rounded-xl space-y-1">
                  <span className="text-warm-500">Alquileres Efectivo:</span>
                  <p className="font-bold text-emerald-700">+{formatCurrency(currentShift.totalSalesCash || 0)}</p>
                </div>
                <div className="p-3 bg-warm-50 rounded-xl space-y-1">
                  <span className="text-warm-500">Garantías Recibidas:</span>
                  <p className="font-bold text-emerald-700">+{formatCurrency(currentShift.totalGuaranteesInCustody || 0)}</p>
                </div>
                <div className="p-3 bg-warm-50 rounded-xl space-y-1">
                  <span className="text-warm-500">Garantías Devueltas:</span>
                  <p className="font-bold text-rose-700">-{formatCurrency(currentShift.totalGuaranteesReturned || 0)}</p>
                </div>
                <div className="p-3 bg-warm-50 rounded-xl space-y-1">
                  <span className="text-warm-500">Penalizaciones Mora:</span>
                  <p className="font-bold text-amberGold-800">+{formatCurrency(currentShift.totalPenalties || 0)}</p>
                </div>
                <div className="p-3 bg-warm-50 rounded-xl space-y-1">
                  <span className="text-warm-500">Gastos Operativos:</span>
                  <p className="font-bold text-rose-700">-{formatCurrency(currentShift.totalExpenses || 0)}</p>
                </div>
                <div className="p-3 bg-warm-50 rounded-xl space-y-1">
                  <span className="text-warm-500">Cobros QR / Banco:</span>
                  <p className="font-bold text-blue-700">{formatCurrency(currentShift.totalSalesQR || 0)}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl space-y-1 border border-emerald-200">
                  <span className="text-emerald-700 font-bold">Efectivo Teórico en Gaveta:</span>
                  <p className="font-extrabold text-emerald-950 text-sm">{formatCurrency(theoreticalCash)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Archived Shifts Dual View */}
          <div className="bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-warm-900 pb-2 border-b border-warm-200">Turnos de Caja Archivados</h3>
            {archivedShifts.length === 0 ? (
              <p className="p-6 text-center text-xs text-warm-400">Sin turnos archivados.</p>
            ) : (
              <>
                {/* Desktop / Tablet Table (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-warm-50 text-warm-600 font-semibold border-b border-warm-200">
                      <tr>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Cajero</th>
                        <th className="p-3">Apertura</th>
                        <th className="p-3">Alquileres</th>
                        <th className="p-3">Cierre Declarado</th>
                        <th className="p-3">Discrepancia</th>
                        <th className="p-3 text-right">Informe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-100 text-warm-900">
                      {archivedShifts.map((s) => (
                        <tr key={s.id} className="hover:bg-warm-50/60 transition-colors">
                          <td className="p-3 font-bold">{s.shiftDate}</td>
                          <td className="p-3">{s.cashierName}</td>
                          <td className="p-3">{formatCurrency(s.openingBalance)}</td>
                          <td className="p-3 font-bold text-emerald-700">{formatCurrency(s.totalSalesCash || 0)}</td>
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
                              className="min-h-[36px] px-3 py-1.5 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-lg text-xs font-bold inline-flex items-center gap-1 touch-manipulation active:scale-95"
                            >
                              <Printer className="h-3.5 w-3.5" />
                              <span>Ver Informe</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacked Touch Cards (< 768px) */}
                <div className="block md:hidden space-y-3">
                  {archivedShifts.map((s) => (
                    <div key={s.id} className="bg-warm-50 p-4 rounded-2xl border border-warm-200 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-warm-200">
                        <div>
                          <p className="font-bold text-sm text-warm-900">{s.shiftDate}</p>
                          <p className="text-xs text-warm-500">Cajero: {s.cashierName}</p>
                        </div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                          (s.discrepancy || 0) === 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          Discrepancia: {formatCurrency(s.discrepancy || 0)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-warm-500 block">Apertura</span>
                          <span className="font-semibold text-warm-800">{formatCurrency(s.openingBalance)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-warm-500 block">Alquileres Efectivo</span>
                          <span className="font-bold text-emerald-700">{formatCurrency(s.totalSalesCash || 0)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-warm-500 block">Cierre Declarado</span>
                          <span className="font-bold text-warm-900">{formatCurrency(s.declaredCash || 0)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-warm-500 block">Estado</span>
                          <span className="font-medium text-warm-700">{s.status || "Cerrado"}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveShiftReport(s as unknown as CarissmaShiftReportData);
                          setShiftReportModalOpen(true);
                        }}
                        className="w-full min-h-[44px] bg-white hover:bg-warm-100 active:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border border-warm-200 shadow-sm touch-manipulation active:scale-98 transition-all"
                      >
                        <Printer className="h-4 w-4" />
                        <span>Ver Informe Completo</span>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Dress Create/Edit Modal */}
      {isDressModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">
                {editingDress ? "Editar Vestido" : "Registrar Nuevo Vestido"}
              </h3>
              <button onClick={() => setIsDressModalOpen(false)} aria-label="Cerrar modal" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-warm-400 hover:text-warm-800 touch-manipulation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDress} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Nombre del Vestido *</label>
                <input
                  type="text"
                  value={dressName}
                  onChange={(e) => setDressName(e.target.value)}
                  placeholder="ej: Vestido Gala Rosa Dorado"
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Marca / Diseñador *</label>
                  <input
                    type="text"
                    value={dressBrand}
                    onChange={(e) => setDressBrand(e.target.value)}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Color *</label>
                  <input
                    type="text"
                    value={dressColor}
                    onChange={(e) => setDressColor(e.target.value)}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Talla *</label>
                  <select
                    value={dressSize}
                    onChange={(e) => setDressSize(e.target.value as "XS" | "S" | "M" | "L" | "XL")}
                    className="w-full min-h-[44px] sm:min-h-[38px] p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-semibold text-warm-900"
                  >
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Categoría *</label>
                  <select
                    value={dressCategory}
                    onChange={(e) => setDressCategory(e.target.value)}
                    className="w-full min-h-[44px] sm:min-h-[38px] p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-semibold text-warm-900"
                  >
                    <option value="Gala">Gala</option>
                    <option value="Novia">Novia</option>
                    <option value="Quinceañera">Quinceañera</option>
                    <option value="Coctel">Coctel</option>
                    <option value="Graduación">Graduación</option>
                    <option value="Fiesta">Fiesta</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Precio Renta (Bs) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={dressBasePrice}
                    onChange={(e) => setDressBasePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-bold text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Garantía (Bs) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={dressGuarantee}
                    onChange={(e) => setDressGuarantee(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-bold text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Costo Adq. (Bs) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={dressAcqCost}
                    onChange={(e) => setDressAcqCost(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-bold text-warm-900"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-warm-800">URL Imagen (Opcional)</label>
                <input
                  type="url"
                  value={dressImageUrl}
                  onChange={(e) => setDressImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setIsDressModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold touch-manipulation active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-amberGold-600 hover:bg-amberGold-700 active:bg-amberGold-800 text-white rounded-xl font-bold shadow-warm flex items-center gap-1.5 touch-manipulation active:scale-98"
                >
                  <Check className="h-4 w-4" />
                  <span>{editingDress ? "Guardar Cambios" : "Crear Prenda"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {openShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Apertura de Caja — Carissma</h3>
              <button onClick={() => setOpenShiftModalOpen(false)} aria-label="Cerrar modal" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-warm-400 hover:text-warm-800 touch-manipulation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleOpenShift} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Saldo Inicial en Gaveta (Bs) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-bold text-warm-900 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Nombre del Cajero *</label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none"
                  required
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setOpenShiftModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold touch-manipulation active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold shadow-sm touch-manipulation active:scale-98"
                >
                  Confirmar Apertura
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {closeShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Cierre & Arqueo de Caja</h3>
              <button onClick={() => setCloseShiftModalOpen(false)} aria-label="Cerrar modal" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-warm-400 hover:text-warm-800 touch-manipulation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCloseShift} className="space-y-4 text-xs">
              <div className="p-3 bg-warm-50 rounded-xl space-y-1">
                <p className="text-warm-600">Efectivo Teórico Esperado:</p>
                <p className="text-lg font-bold text-emerald-800">{formatCurrency(theoreticalCash)}</p>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Efectivo Real Contado en Gaveta (Bs) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={declaredCash}
                  onChange={(e) => setDeclaredCash(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-bold text-warm-900 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Observaciones</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setCloseShiftModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold touch-manipulation active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl font-bold shadow-sm touch-manipulation active:scale-98"
                >
                  Finalizar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Registrar Gasto de Caja</h3>
              <button onClick={() => setExpenseModalOpen(false)} aria-label="Cerrar modal">
                <X className="h-5 w-5 text-warm-400" />
              </button>
            </div>
            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Categoría *</label>
                <select
                  value={expenseCategory}
                  onChange={(e) =>
                    setExpenseCategory(
                      e.target.value as "Tintorería/Lavandería" | "Modistería/Arreglos" | "Bolsas/Empaques" | "Accesorios" | "Servicios" | "Otros"
                    )
                  }
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl"
                >
                  <option value="Tintorería/Lavandería">Tintorería / Lavandería (Lavado Seco)</option>
                  <option value="Modistería/Arreglos">Modistería / Arreglos y Costuras</option>
                  <option value="Bolsas/Empaques">Bolsas Guardapolvo y Percheros</option>
                  <option value="Accesorios">Accesorios y Bisutería</option>
                  <option value="Servicios">Luz / Servicios / Local</option>
                  <option value="Otros">Otros Gastos</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Monto (Bs) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono font-bold"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-warm-800">Descripción *</label>
                <input
                  type="text"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="ej: Tintorería Express"
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl"
                  required
                />
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 bg-warm-100 rounded-xl font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amberGold-600 text-white rounded-xl font-bold shadow-warm"
                >
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      <POSTicketModal
        isOpen={ticketModalOpen}
        ticketData={ticketData}
        onClose={() => setTicketModalOpen(false)}
        onOpenContract={() => {
          setTicketModalOpen(false);
          setContractModalOpen(true);
        }}
      />

      {/* Printable Letter Size Rental Contract Modal */}
      <RentalContractModal
        isOpen={contractModalOpen && !!contractBooking}
        booking={contractBooking}
        onClose={() => setContractModalOpen(false)}
      />

      {/* Shift Report Modal */}
      <ShiftReportModal
        isOpen={shiftReportModalOpen}
        report={activeShiftReport}
        onClose={() => setShiftReportModalOpen(false)}
      />
    </div>
  );
}
