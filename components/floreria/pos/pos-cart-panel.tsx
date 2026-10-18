"use client";

import React, { useState, useEffect } from "react";
import { 
  ShoppingBag, 
  Search, 
  Package, 
  Plus, 
  Minus, 
  Trash2, 
  Store, 
  UserCheck, 
  Receipt,
  X
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { processPOSSaleAction } from "@/app/actions/pos";
import { searchCRMClientsAction } from "@/app/actions/crm";
import POSTicketModal, { POSTicketData } from "../pos-ticket-modal";
import type { CashRegisterShift } from "@prisma/client";

interface ArrangementItemData {
  id: string;
  name: string;
  category: "Rosas" | "Girasoles" | "Arreglos Mixtos" | "Insumos & Jarrones" | string;
  price: number;
  featured: boolean;
  image?: string;
  description?: string;
  recipeItems?: {
    id: string;
    rawIngredientId: string;
    quantityNeeded: number;
    rawIngredient?: {
      name: string;
      unit: string;
      available: number;
    };
  }[];
}

interface PosCartPanelProps {
  arrangementsList: ArrangementItemData[];
  activeShift: CashRegisterShift | null;
  onSaleComplete: () => void;
}

export default function PosCartPanel({ arrangementsList, activeShift, onSaleComplete }: PosCartPanelProps) {
  const [mobileTab, setMobileTab] = useState<"catalog" | "ticket">("catalog");
  const [arrangementCategory, setArrangementCategory] = useState<string>("Todos");
  const [arrangementSearch, setArrangementSearch] = useState<string>("");

  const [saleItems, setSaleItems] = useState<{
    id: string;
    name: string;
    price: number;
    qty: number;
    rawIngredientId?: string;
    recipeItems?: { rawIngredientId: string; quantityNeeded: number }[];
  }[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [cashReceived, setCashReceived] = useState<string>("");

  const [clientSuggestions, setClientSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [manualDiscount, setManualDiscount] = useState<number | string>("");

  const [activeTicket, setActiveTicket] = useState<POSTicketData | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalSale = saleItems.reduce((acc, item) => acc + item.price * item.qty, 0);
  const numDiscount = Math.max(0, Number(manualDiscount) || 0);
  const finalTotal = Math.max(0, totalSale - numDiscount);
  const numCashReceived = Number(cashReceived) || 0;
  const changeDue = Math.max(0, numCashReceived - finalTotal);

  const DEFAULT_ARR_CATEGORIES = ["Rosas", "Girasoles", "Arreglos Mixtos", "Insumos & Jarrones"];
  const allArrangementCategories = [
    "Todos",
    ...Array.from(
      new Set([
        ...DEFAULT_ARR_CATEGORIES,
        ...arrangementsList.map((a) => a.category).filter(Boolean),
      ])
    ),
  ];

  const handleCustomerNameChange = async (val: string) => {
    setCustomerName(val);
    if (val.trim().length >= 2) {
      setIsSearchingClient(true);
      const res = await searchCRMClientsAction(val.trim());
      if (res.success && Array.isArray(res.data)) {
        setClientSuggestions(res.data);
        setShowSuggestions(Array.isArray(res.data) && res.data.length > 0);
      }
      setIsSearchingClient(false);
    } else {
      setClientSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectClientSuggestion = (client: any) => {
    setCustomerName(client.name);
    setCustomerPhone(client.phone);
    setShowSuggestions(false);
    toast.success(`Cliente seleccionado: ${client.name} (${client.phone})`);
  };

  const updateQty = (id: string, delta: number) => {
    setSaleItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item))
    );
  };

  const removeItem = (id: string) => {
    setSaleItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleCheckout = async () => {
    if (saleItems.length === 0) return;
    setLoading(true);

    const res = await processPOSSaleAction({
      customerName: customerName.trim() || "Cliente Mostrador",
      customerPhone: customerPhone.trim() || undefined,
      totalAmount: finalTotal,
      discountAmount: numDiscount,
      paymentMethod,
      items: saleItems.map((i) => ({
        itemName: i.name,
        price: i.price,
        quantity: i.qty,
        rawIngredientId: i.rawIngredientId,
        recipeItems: i.recipeItems,
      })),
    });

    setLoading(false);

    if (res.success && res.data) {
      const ticketResData = res.data as any;
      const ticketObj: POSTicketData = {
        ticketNumber: ticketResData.ticketNumber,
        customerName: ticketResData.customerName,
        customerPhone: ticketResData.customerPhone,
        totalAmount: ticketResData.totalAmount,
        discountAmount: ticketResData.discountAmount,
        paymentMethod: ticketResData.paymentMethod,
        createdAt: ticketResData.createdAt,
        items: ticketResData.ticketItems || saleItems.map((i) => ({ itemName: i.name, price: i.price, quantity: i.qty })),
      };

      setActiveTicket(ticketObj);
      setTicketModalOpen(true);
      setSaleItems([]);
      setCashReceived("");
      toast.success("Venta de mostrador procesada exitosamente");
      onSaleComplete();
    } else {
      toast.error(res.error || "Error al procesar la venta POS.");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        handleCheckout();
      } else if (e.key === "F4") {
        e.preventDefault();
        setSaleItems([]);
        setCashReceived("");
        toast.info("Carrito limpiado (Atajo F4)");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saleItems, finalTotal, customerName, customerPhone, paymentMethod, manualDiscount]);

  return (
    <>
      {/* Mobile Tab Toggle (< 1024px) */}
      <div className="flex lg:hidden bg-warm-100 p-1 rounded-2xl mb-4 border border-warm-200 gap-1">
        <button
          type="button"
          onClick={() => setMobileTab("catalog")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px] active:scale-98 touch-manipulation ${
            mobileTab === "catalog"
              ? "bg-white text-terracotta-700 shadow-sm border border-warm-200"
              : "text-warm-600 hover:text-warm-900"
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>Catálogo ({arrangementsList.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("ticket")}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px] active:scale-98 touch-manipulation ${
            mobileTab === "ticket"
              ? "bg-white text-terracotta-700 shadow-sm border border-warm-200"
              : "text-warm-600 hover:text-warm-900"
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Ticket ({saleItems.length}){saleItems.length > 0 ? ` · ${formatCurrency(finalTotal)}` : ""}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${mobileTab === "ticket" ? "hidden lg:block" : "block"} lg:col-span-2 space-y-4`}>
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-warm-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-warm-900 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-terracotta-600" />
                  <span>Catálogo de Arreglos de Mostrador ({arrangementsList.length})</span>
                </h3>
                <p className="text-[11px] text-warm-500">Toca un arreglo floral para agregarlo al ticket y descontar su receta</p>
              </div>
              <div className="relative w-full sm:w-48">
                <Search className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={arrangementSearch}
                  onChange={(e) => setArrangementSearch(e.target.value)}
                  placeholder="Buscar arreglo..."
                  className="w-full pl-8 pr-3 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {allArrangementCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setArrangementCategory(cat)}
                  className={`px-3.5 py-2 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-bold transition-all whitespace-nowrap touch-manipulation active:scale-95 ${
                    arrangementCategory === cat
                      ? "bg-terracotta-500 text-white shadow-sm"
                      : "bg-warm-100 text-warm-700 hover:bg-warm-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {arrangementsList.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-warm-200 space-y-2">
              <Package className="h-8 w-8 text-warm-300 mx-auto" />
              <p className="text-xs font-bold text-warm-700">No hay arreglos registrados en el catálogo.</p>
              <p className="text-[11px] text-warm-500 max-w-sm mx-auto">
                Crea tus arreglos con sus recetas de insumos en el módulo de <strong>"Catálogo & Web"</strong> o utiliza el botón <strong>"Ticket Manual"</strong> para un arreglo hecho al momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {arrangementsList
                .filter((arr) => {
                  const matchesCat = arrangementCategory === "Todos" || arr.category === arrangementCategory;
                  const matchesSearch =
                    !arrangementSearch.trim() ||
                    arr.name.toLowerCase().includes(arrangementSearch.toLowerCase());
                  return matchesCat && matchesSearch;
                })
                .map((arr) => {
                  const totalRecipeItems = arr.recipeItems?.length || 0;
                  return (
                    <button
                      key={arr.id}
                      onClick={() =>
                        setSaleItems((prev) => {
                          const existing = prev.find((item) => item.id === arr.id);
                          if (existing) {
                            return prev.map((item) =>
                              item.id === arr.id ? { ...item, qty: item.qty + 1 } : item
                            );
                          }
                          const recipePayload = (arr.recipeItems || []).map((r) => ({
                            rawIngredientId: r.rawIngredientId,
                            quantityNeeded: r.quantityNeeded,
                          }));
                          return [
                            ...prev,
                            {
                              id: arr.id,
                              name: arr.name,
                              price: arr.price,
                              qty: 1,
                              recipeItems: recipePayload,
                            },
                          ];
                        })
                      }
                      className="card-warm p-3 text-left hover:border-terracotta-400 transition-all flex flex-col justify-between space-y-2.5 group active:scale-98"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-terracotta-700 bg-terracotta-50 px-2 py-0.5 rounded-md border border-terracotta-100">
                          {arr.category}
                        </span>
                        {totalRecipeItems > 0 && (
                          <span className="text-[9px] font-semibold text-warm-500 bg-warm-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Package className="h-2.5 w-2.5" />
                            <span>{totalRecipeItems} insumos</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-warm-900 group-hover:text-terracotta-700 leading-snug line-clamp-2">
                        {arr.name}
                      </p>
                      <div className="flex justify-between items-center pt-1 border-t border-warm-100 text-xs">
                        <span className="font-bold text-terracotta-800 font-mono text-sm">
                          {formatCurrency(arr.price)}
                        </span>
                        <span className="text-[10px] text-terracotta-600 font-bold flex items-center gap-0.5 bg-terracotta-50 px-1.5 py-0.5 rounded">
                          <Plus className="h-3 w-3" /> Añadir
                        </span>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        <div id="pos-checkout-section" className={`${mobileTab === "catalog" ? "hidden lg:block" : "block"} bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4 h-fit scroll-mt-20`}>
          <div className="flex items-center justify-between pb-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-terracotta-600" />
              <h3 className="font-bold text-sm text-warm-900">Ticket de Venta Directa</h3>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
              activeShift ? "text-emerald-600 bg-emerald-50 border-emerald-200" : "text-rose-600 bg-rose-50 border-rose-200"
            }`}>
              {activeShift ? "Caja Abierta" : "Caja Cerrada"}
            </span>
          </div>

          <div className="p-3 bg-warm-50 rounded-xl border border-warm-200 space-y-2 relative">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-warm-800 flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5 text-terracotta-600" /> Cliente / Fidelización:
              </span>
              <span className="text-[10px] font-bold text-amberGold-800 bg-amberGold-100 px-2 py-0.5 rounded-full">
                Auto-Directorio CRM
              </span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={customerName}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
                onFocus={() => {
                  if (clientSuggestions.length > 0) setShowSuggestions(true);
                }}
                placeholder="Escribe el nombre del cliente (sugerencias)..."
                className="w-full p-2.5 text-base sm:text-xs md:text-sm bg-white border border-warm-200 rounded-lg text-warm-900 focus:outline-none focus:border-terracotta-500 font-medium"
              />

              {showSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-warm-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-warm-100 animate-in fade-in zoom-in-95">
                  <div className="p-1.5 bg-warm-50 text-[10px] font-bold text-warm-500 flex justify-between items-center">
                    <span>Clientes registrados ({clientSuggestions.length})</span>
                    <button
                      type="button"
                      onClick={() => setShowSuggestions(false)}
                      className="text-warm-400 hover:text-warm-700 p-0.5 min-h-[32px] min-w-[32px] flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {clientSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectClientSuggestion(c)}
                      className="w-full text-left p-2.5 hover:bg-terracotta-50 transition-colors flex items-center justify-between group min-h-[44px]"
                    >
                      <div>
                        <p className="font-bold text-xs text-warm-900 group-hover:text-terracotta-800">{c.name}</p>
                        <p className="text-[10px] text-warm-500 font-mono">{c.phone}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amberGold-100 text-amberGold-800 border border-amberGold-200">
                          {c.loyaltyTier || "Nuevo"} · {c.purchaseCount || 0} compras
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Teléfono / WhatsApp (ej: 76266696)..."
              className="w-full p-2.5 text-base sm:text-xs md:text-sm bg-white border border-warm-200 rounded-lg text-warm-900 focus:outline-none focus:border-terracotta-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-warm-800">Método de Pago</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["Efectivo", "QR", "Tarjeta"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPaymentMethod(m)}
                  className={`min-h-[44px] py-2 text-xs font-bold rounded-xl border transition-all touch-manipulation active:scale-95 ${
                    paymentMethod === m
                      ? "bg-terracotta-500 text-white border-terracotta-500 shadow-sm"
                      : "bg-warm-50 text-warm-700 border-warm-200 hover:bg-warm-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "Efectivo" && (
            <div className="space-y-2 pt-1 border-t border-warm-100">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-warm-600">Efectivo Recibido (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder={finalTotal.toString()}
                    className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-bold text-warm-900 focus:outline-none focus:border-terracotta-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-warm-600">Cambio / Vuelto</label>
                  <div className="w-full p-2 bg-emerald-50 border border-emerald-200 rounded-xl font-mono text-base sm:text-xs md:text-sm font-extrabold text-emerald-800 flex items-center">
                    {formatCurrency(changeDue)}
                  </div>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-warm-500 block mb-1">Efectivo Rápido:</span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCashReceived(finalTotal.toString())}
                    className="min-h-[44px] px-2 py-2 bg-terracotta-50 hover:bg-terracotta-100 text-terracotta-800 rounded-xl text-xs font-bold border border-terracotta-200 transition-all active:scale-95 touch-manipulation flex items-center justify-center"
                  >
                    Exacto
                  </button>
                  {[10, 20, 50, 100, 200].map((denom) => (
                    <button
                      key={denom}
                      type="button"
                      onClick={() => setCashReceived(denom.toString())}
                      className="min-h-[44px] px-2 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold border border-warm-200 transition-all active:scale-95 touch-manipulation flex items-center justify-center"
                    >
                      Bs {denom}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {saleItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs p-2 bg-warm-50 rounded-xl border border-warm-100">
                <div className="flex-1 pr-2">
                  <p className="font-semibold text-warm-900">{item.name}</p>
                  <p className="text-[10px] text-warm-500">{formatCurrency(item.price)}/u</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-warm-200">
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, -1)}
                      className="min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center text-warm-600 hover:text-warm-900 active:scale-95 touch-manipulation rounded-lg hover:bg-warm-100"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="font-bold text-warm-900 px-2 min-w-[24px] text-center text-sm">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.id, 1)}
                      className="min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center text-warm-600 hover:text-warm-900 active:scale-95 touch-manipulation rounded-lg hover:bg-warm-100"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="font-bold text-terracotta-700 min-w-[55px] text-right text-xs sm:text-sm">
                    {formatCurrency(item.price * item.qty)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="min-h-[44px] min-w-[44px] h-11 w-11 flex items-center justify-center text-rose-500 hover:text-rose-700 active:scale-95 touch-manipulation rounded-lg hover:bg-rose-50"
                    aria-label="Eliminar ítem"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-warm-200 space-y-2">
            <div className="flex justify-between text-xs text-warm-600">
              <span>Subtotal Venta:</span>
              <span className="font-semibold">{formatCurrency(totalSale)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-warm-700 pt-0.5">
              <span className="text-[11px] font-medium text-warm-600">Descuento Manual (Bs):</span>
              <input
                type="text"
                inputMode="decimal"
                value={manualDiscount}
                onChange={(e) => setManualDiscount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-24 p-2 text-right text-base sm:text-xs md:text-sm bg-warm-50 border border-warm-200 rounded-lg text-warm-900 font-mono font-bold focus:outline-none focus:border-terracotta-500"
              />
            </div>

            {numDiscount > 0 && (
              <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                <span>Descuento Aplicado:</span>
                <span>-{formatCurrency(numDiscount)}</span>
              </div>
            )}

            <div className="flex justify-between text-base font-bold pt-2 border-t border-warm-200 text-warm-900">
              <span>Total a Cobrar:</span>
              <span className="text-terracotta-700">{formatCurrency(finalTotal)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setSaleItems([]);
                setCashReceived("");
                toast.info("Carrito limpiado");
              }}
              className="min-h-[44px] px-3.5 py-2.5 bg-warm-100 hover:bg-warm-200 active:bg-warm-300 text-warm-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 touch-manipulation active:scale-95"
              title="Atajo de teclado F4"
            >
              <kbd className="px-1 py-0.5 bg-white rounded border border-warm-300 text-[9px] font-mono">F4</kbd>
              Limpiar
            </button>

            <button
              onClick={handleCheckout}
              disabled={loading || saleItems.length === 0}
              className="flex-1 min-h-[44px] py-3 bg-terracotta-500 hover:bg-terracotta-600 active:bg-terracotta-700 text-white rounded-xl text-xs font-bold shadow-warm transition-all flex items-center justify-center gap-2 disabled:opacity-50 touch-manipulation active:scale-98"
            >
              <kbd className="hidden sm:inline-block px-1 py-0.5 bg-terracotta-700 text-white rounded text-[9px] font-mono">F2</kbd>
              <Receipt className="h-4 w-4" />
              {loading ? "Procesando..." : "Procesar Cobro & Ticket"}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bottom Trigger for Mobile Catalog view */}
      {mobileTab === "catalog" && saleItems.length > 0 && (
        <div className="fixed bottom-20 left-3 right-3 lg:hidden z-30 animate-in slide-in-from-bottom duration-200">
          <button
            type="button"
            onClick={() => setMobileTab("ticket")}
            className="w-full bg-terracotta-600 hover:bg-terracotta-700 active:bg-terracotta-800 text-white p-3.5 rounded-2xl shadow-2xl flex items-center justify-between font-bold text-sm border border-terracotta-400 active:scale-98 transition-all min-h-[48px] touch-manipulation"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              <span>Ver Ticket ({saleItems.reduce((acc, i) => acc + i.qty, 0)} ítems)</span>
            </span>
            <span className="font-mono bg-white/20 px-3 py-1 rounded-xl">
              {formatCurrency(finalTotal)} &rarr;
            </span>
          </button>
        </div>
      )}
      <POSTicketModal
        isOpen={ticketModalOpen}
        ticket={activeTicket}
        onClose={() => setTicketModalOpen(false)}
      />
    </>
  );
}
