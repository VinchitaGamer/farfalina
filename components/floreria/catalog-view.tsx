"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  ShoppingCart,
  Globe,
  Sparkles,
  Eye,
  RefreshCw,
  Pencil,
  X,
  User,
  Phone,
  CreditCard,
  Receipt,
  Calendar,
  Clock,
  MapPin,
  Truck,
  Store
} from "lucide-react";
import { getArrangementsAction, processArrangementDeductionAction } from "@/app/actions/arrangements";
import { processPOSSaleAction } from "@/app/actions/pos";
import { createUnifiedTicketAction } from "@/app/actions/logistics";
import NewArrangementModal from "./new-arrangement-modal";
import EditArrangementModal from "./edit-arrangement-modal";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface ArrangementRecipeItem {
  id: string;
  rawIngredientId: string;
  quantityNeeded: number;
  rawIngredient: {
    name: string;
    type: string;
    available: number;
    unit: string;
    costPerUnit?: number;
  };
}

interface ArrangementItem {
  id: string;
  name: string;
  category: string;
  price: number;
  featured: boolean;
  image: string;
  description: string;
  recipeItems?: ArrangementRecipeItem[];
}

export default function CatalogView() {
  const [activeTab, setActiveTab] = useState<"catalog" | "seo" | "preview">("catalog");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [cart, setCart] = useState<{ id: string; name: string; price: number; qty: number; recipeItems?: ArrangementRecipeItem[] }[]>([]);

  // Dynamic Arrangement Categories
  const DEFAULT_ARR_CATEGORIES = ["Rosas", "Girasoles", "Arreglos Mixtos", "Insumos & Jarrones"];
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const [items, setItems] = useState<ArrangementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  // Edit Modal State
  const [editingArrangement, setEditingArrangement] = useState<ArrangementItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Unified Checkout Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState("Calacoto, Zona Sur");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryTime, setDeliveryTime] = useState("");
  const [dedicationMessage, setDedicationMessage] = useState("");

  const [deliveryFee, setDeliveryFee] = useState<number>(20);
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, []);

  const refreshCustomCategories = () => {
    try {
      const saved = localStorage.getItem("floreria_arrangement_categories");
      if (saved) {
        setCustomCategories(JSON.parse(saved));
      }
    } catch {}
  };

  const allCategories = [
    "Todos",
    ...Array.from(
      new Set([
        ...DEFAULT_ARR_CATEGORIES,
        ...customCategories,
        ...items.map((i) => i.category).filter(Boolean),
      ])
    ),
  ];

  const loadCatalog = async () => {
    setLoading(true);
    refreshCustomCategories();
    const res = await getArrangementsAction();
    if (res.success && Array.isArray(res.data)) {
      setItems(res.data as ArrangementItem[]);
    }
    setLoading(false);
  };

  const addToCart = (item: ArrangementItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, recipeItems: item.recipeItems }];
    });
  };

  const openEditModal = (item: ArrangementItem) => {
    setEditingArrangement(item);
    setIsEditModalOpen(true);
  };

  const handleProcessOrder = () => {
    if (cart.length === 0) return;
    setRecipientName(customerName);
    setCheckoutModalOpen(true);
  };

  const handleFinalizeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    setIsProcessing(true);

    const arrangementName = cart.map((c) => `${c.qty}x ${c.name}`).join(", ");
    const recipeItemsPayload: { rawIngredientId: string; quantityNeeded: number; unitCost: number }[] = [];

    cart.forEach((cartItem) => {
      if (cartItem.recipeItems) {
        cartItem.recipeItems.forEach((ri) => {
          recipeItemsPayload.push({
            rawIngredientId: ri.rawIngredientId,
            quantityNeeded: ri.quantityNeeded * cartItem.qty,
            unitCost: ri.rawIngredient?.costPerUnit || 0,
          });
        });
      }
    });

    const finalAddress = deliveryType === "pickup" ? "Retiro en Tienda / Local" : address.trim();
    const finalZone = deliveryType === "pickup" ? "Tienda Central" : zone;
    const finalDeliveryFee = deliveryType === "pickup" ? 0 : Number(deliveryFee);

    const res = await createUnifiedTicketAction({
      clientName: customerName,
      clientPhone: customerPhone,
      recipientName: recipientName || customerName,
      deliveryType,
      address: finalAddress,
      zone: finalZone,
      deliveryDate,
      deliveryTime,
      arrangementName,
      salePrice: cartTotal,
      deliveryFee: finalDeliveryFee,
      total: cartTotal + finalDeliveryFee,
      paymentMethod,
      dedicationMessage,
      recipeItems: recipeItemsPayload,
    });

    setIsProcessing(false);

    if (res.success) {
      const data = res.data as { ticket?: { ticketNumber: string }; order?: { orderNumber: string } };
      const ticketNum = data?.ticket?.ticketNumber || data?.order?.orderNumber || "TCK";
      toast.success(`¡Venta E-Commerce procesada con Ticket N° ${ticketNum}! Registrado en Pedidos & Logística.`);
      setCart([]);
      setCheckoutModalOpen(false);
    } else {
      toast.error(res.error || "Error al procesar el pedido e-commerce.");
    }
  };

  const filteredItems = selectedCategory === "Todos"
    ? items
    : items.filter((i) => i.category === selectedCategory);

  const cartTotal = cart.reduce((acc, curr) => acc + curr.price * curr.qty, 0);

  return (
    <div className="space-y-6">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-terracotta-100 text-terracotta-700 rounded-md">
              Módulo 1
            </span>
            <h2 className="text-base sm:text-lg font-bold text-warm-900">E-Commerce y Catálogo</h2>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            Gestión individual de arreglos florales, recetas de insumos y pedidos online.
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 bg-warm-100 p-1 rounded-xl border border-warm-200 overflow-x-auto max-w-full w-full md:w-auto">
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "catalog"
                ? "bg-white text-terracotta-700 shadow-sm"
                : "text-warm-600 hover:text-warm-900"
            }`}
          >
            Gestión Catálogo
          </button>
          <button
            onClick={() => setActiveTab("seo")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === "seo"
                ? "bg-white text-terracotta-700 shadow-sm"
                : "text-warm-600 hover:text-warm-900"
            }`}
          >
            Config. SEO
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
              activeTab === "preview"
                ? "bg-white text-terracotta-700 shadow-sm"
                : "text-warm-600 hover:text-warm-900"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Vista Tienda</span>
          </button>
        </div>
      </div>

      {activeTab === "catalog" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Catalog Listing */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-warm-200">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 sm:px-3 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? "bg-terracotta-500 text-white"
                        : "bg-warm-50 text-warm-700 hover:bg-warm-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={loadCatalog}
                  className="p-1.5 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-lg transition-colors shrink-0"
                  title="Recargar catálogo"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="px-3 py-1.5 bg-terracotta-500 hover:bg-terracotta-600 text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1 shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Nuevo Arreglo</span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="p-12 text-center text-xs text-warm-500 bg-white rounded-2xl border border-warm-200">
                Cargando arreglos florales desde la base de datos...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="p-12 text-center text-xs text-warm-500 bg-white rounded-2xl border border-warm-200">
                No hay arreglos en esta categoría.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="card-warm p-4 flex flex-col justify-between space-y-3 relative group">
                    <div>
                      <div className="flex items-start justify-between">
                        {item.image.startsWith("http") ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-16 w-16 object-cover rounded-xl border border-warm-200"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-xl bg-terracotta-50 border border-terracotta-100 flex items-center justify-center text-2xl">
                            {item.image}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5">
                          {item.featured && (
                            <span className="px-2 py-0.5 bg-amberGold-100 text-amberGold-800 text-[10px] font-bold rounded-full border border-amberGold-200">
                              Destacado
                            </span>
                          )}
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 bg-warm-100 hover:bg-terracotta-100 text-warm-600 hover:text-terracotta-700 rounded-lg transition-colors"
                            title="Editar arreglo"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-warm-900 mt-2">{item.name}</h3>
                      <p className="text-xs text-warm-500 mt-1 line-clamp-2">{item.description}</p>

                      {item.recipeItems && item.recipeItems.length > 0 && (
                        <div className="mt-2 text-[10px] text-warm-500 space-y-0.5 bg-warm-50 p-2 rounded-lg border border-warm-100">
                          <span className="font-bold text-warm-700 block">Receta de Insumos:</span>
                          {item.recipeItems.map((ri) => (
                            <span key={ri.id} className="inline-block mr-2 text-warm-600">
                              • {ri.quantityNeeded} {ri.rawIngredient.unit} {ri.rawIngredient.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-warm-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-warm-400 font-mono">{item.id.slice(-6)}</p>
                        <p className="text-sm font-bold text-terracotta-700">{formatCurrency(item.price)}</p>
                      </div>

                      <button
                        onClick={() => addToCart(item)}
                        className="px-3 py-1.5 bg-warm-100 hover:bg-terracotta-50 text-warm-800 hover:text-terracotta-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 border border-warm-200"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Cotizar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart & Quotation Summary Sidebar */}
          <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4 h-fit">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <div className="flex items-center gap-2 text-warm-900">
                <ShoppingCart className="h-4 w-4 text-terracotta-600" />
                <h3 className="font-bold text-sm">Carrito de Cotización</h3>
              </div>
              <span className="text-xs text-warm-500">{cart.length} ítems</span>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <ShoppingCart className="h-8 w-8 text-warm-300 mx-auto" />
                <p className="text-xs text-warm-500">No hay arreglos seleccionados para cotizar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-xs p-2 bg-warm-50 rounded-lg border border-warm-100">
                    <div>
                      <p className="font-semibold text-warm-900">{c.name}</p>
                      <p className="text-[10px] text-warm-500">{c.qty}x @ {formatCurrency(c.price)}</p>
                    </div>
                    <span className="font-bold text-terracotta-700">{formatCurrency(c.price * c.qty)}</span>
                  </div>
                ))}

                <div className="pt-3 border-t border-warm-200 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-warm-600">Subtotal:</span>
                    <span className="font-semibold text-warm-900">{formatCurrency(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-warm-600">Envío Estimado:</span>
                    <span className="font-semibold text-warm-900">20 Bs</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-warm-100 text-terracotta-700">
                    <span>Total Cotización:</span>
                    <span>{formatCurrency(cartTotal + (cartTotal > 0 ? 20 : 0))}</span>
                  </div>
                </div>

                <button
                  onClick={handleProcessOrder}
                  className="w-full py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm transition-all"
                >
                  Generar Orden & Descontar Insumos
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "seo" && (
        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-warm-900 pb-3 border-b border-warm-200">
            <Globe className="h-5 w-5 text-terracotta-600" />
            <h3 className="font-bold text-sm">Optimización SEO y Meta Datos de la Tienda</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Título Meta de la Página (SEO Title)</label>
              <input
                type="text"
                defaultValue="Florería Farfalina | Envío de Flores y Arreglos Elegantes en La Paz"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Palabras Clave (Keywords)</label>
              <input
                type="text"
                defaultValue="flores la paz, arreglos florales, rosas rojas, floreria online, regalos aniversario"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-warm-700">Meta Descripción (Meta Description)</label>
              <textarea
                rows={3}
                defaultValue="Catálogo exclusivo de arreglos florales, rosas importadas y ramos para cumpleaños y aniversarios. Envíos a domicilio en el mismo día con tarjeta dedicatoria incluida."
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
              />
            </div>
          </div>

          <button className="px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm">
            Guardar Configuración SEO
          </button>
        </div>
      )}

      {activeTab === "preview" && (
        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-warm-200">
            <h3 className="font-bold text-sm text-warm-900">Previsualización de Tienda Pública</h3>
            <span className="text-xs text-terracotta-600 font-mono flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> https://floreriafarfalina.bo
            </span>
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-br from-warm-100 via-white to-terracotta-50 border border-warm-200 text-center space-y-4">
            <span className="px-3 py-1 bg-terracotta-100 text-terracotta-700 text-xs font-bold rounded-full inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Nueva Colección Primavera</span>
            </span>
            <h1 className="text-2xl font-bold text-warm-900">Arreglos Florales que Expresan lo Inexpresable</h1>
            <p className="text-xs text-warm-600 max-w-md mx-auto">
              Diseño floral de alta gama para momentos inolvidables. Envíos garantizados en La Paz y El Alto.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button className="px-5 py-2 bg-terracotta-500 text-white rounded-xl text-xs font-bold shadow-warm">
                Ver Catálogo Completo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive New Arrangement Modal */}
      <NewArrangementModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSuccess={loadCatalog}
      />

      {/* Interactive Edit Arrangement Modal */}
      <EditArrangementModal
        isOpen={isEditModalOpen}
        arrangement={editingArrangement}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingArrangement(null);
        }}
        onSuccess={loadCatalog}
      />

      {/* Unified E-Commerce Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90dvh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-terracotta-100 text-terracotta-700 rounded-xl">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-warm-900">Emisión de Ticket Unificado E-Commerce</h3>
                  <p className="text-xs text-warm-500">Registra el ticket, descuenta inventario y agenda en Logística.</p>
                </div>
              </div>
              <button onClick={() => setCheckoutModalOpen(false)} className="p-1 text-warm-400 hover:text-warm-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFinalizeCheckout} className="space-y-4">
              {/* Order Items Summary */}
              <div className="p-3 bg-warm-50 rounded-2xl border border-warm-200 space-y-1.5 text-xs">
                <p className="font-bold text-warm-900">Arreglos / Productos Seleccionados:</p>
                {cart.map((c) => (
                  <div key={c.id} className="flex justify-between text-warm-700 font-medium">
                    <span>{c.qty}x {c.name}</span>
                    <span className="font-mono font-bold">{formatCurrency(c.price * c.qty)}</span>
                  </div>
                ))}
              </div>

              {/* Section 1: Customer Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-terracotta-600" /> Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. Carlos Mendoza"
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-terracotta-600" /> Teléfono del Cliente *
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ej. 77218392"
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-mono font-medium text-warm-900"
                    required
                  />
                </div>
              </div>

              {/* Section 2: Delivery & Logistics Details */}
              <div className="p-3.5 bg-warm-50/70 border border-warm-200 rounded-2xl space-y-3">
                <h4 className="font-bold text-xs text-warm-900 flex items-center gap-1.5 border-b border-warm-200 pb-2">
                  <MapPin className="h-4 w-4 text-terracotta-600" />
                  <span>Detalles de Entrega & Despacho Logístico</span>
                </h4>

                {/* Delivery Mode Selector */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-800">Modalidad de Despacho *</label>
                  <div className="grid grid-cols-2 gap-1.5 bg-warm-100 p-1 rounded-xl border border-warm-200">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryType("delivery");
                        setDeliveryFee(20);
                        if (address === "Retiro en Tienda / Local") setAddress("");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === "delivery"
                          ? "bg-white text-terracotta-700 shadow-sm"
                          : "text-warm-600 hover:text-warm-900"
                      }`}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      <span>Envío a Domicilio</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryType("pickup");
                        setDeliveryFee(0);
                        setAddress("Retiro en Tienda / Local");
                        setZone("Tienda Central");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === "pickup"
                          ? "bg-white text-purple-700 shadow-sm"
                          : "text-warm-600 hover:text-warm-900"
                      }`}
                    >
                      <Store className="h-3.5 w-3.5" />
                      <span>Recoger en Tienda (Pick-up)</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-warm-800">Nombre Destinatario *</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Nombre de quien recibe..."
                      className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-terracotta-600" />
                      <span>{deliveryType === "pickup" ? "Fecha de Retiro *" : "Fecha de Entrega *"}</span>
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-bold text-warm-800 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-terracotta-600" />
                        <span>{deliveryType === "pickup" ? "Hora Estimada de Retiro *" : "Hora de Entrega *"}</span>
                      </span>
                    </label>
                    <input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-bold font-mono focus:outline-none focus:border-terracotta-500 cursor-pointer"
                      required
                    />
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-1">
                      <span className="text-[10px] text-warm-400 font-semibold shrink-0">Sugeridos:</span>
                      {["10:00", "12:00", "15:00", "16:30", "18:00", "19:30"].map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setDeliveryTime(t)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition-all shrink-0 ${
                            deliveryTime === t
                              ? "bg-terracotta-500 text-white shadow-xs"
                              : "bg-warm-100 hover:bg-warm-200 text-warm-700 border border-warm-200"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>


                {deliveryType === "pickup" ? (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs flex items-center gap-2.5 text-purple-900 font-semibold">
                    <Store className="h-4 w-4 text-purple-700 shrink-0" />
                    <div>
                      <p className="font-bold text-purple-950">Modalidad: Recoger en Tienda (Pick-up)</p>
                      <p className="text-[11px] text-purple-700 font-normal mt-0.5">
                        El pedido se preparará para retiro en tienda central. El costo de flete queda exento y no requiere dirección de entrega.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-warm-800">Zona Delivery *</label>
                      <select
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                      >
                        <option value="Calacoto, Zona Sur">Calacoto, Zona Sur</option>
                        <option value="Achumani, Zona Sur">Achumani, Zona Sur</option>
                        <option value="San Miguel, Zona Sur">San Miguel, Zona Sur</option>
                        <option value="Sopocachi, Centro">Sopocachi, Centro</option>
                        <option value="Miraflores, Centro">Miraflores, Centro</option>
                        <option value="Ciudad de El Alto">Ciudad de El Alto</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-warm-800">Dirección Exacta de Envío *</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Calle, Avenida, Nro de puerta..."
                        className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                        required={deliveryType === "delivery"}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-terracotta-600" /> Mensaje Dedicatoria Impresa *
                  </label>
                  <textarea
                    rows={2}
                    value={dedicationMessage}
                    onChange={(e) => setDedicationMessage(e.target.value)}
                    placeholder="Mensaje personalizado para imprimir en la tarjeta..."
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Section 3: Payment Method & Totals */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-terracotta-600" /> Método de Pago *
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(["Efectivo", "QR", "Tarjeta"] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all ${
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

              {/* Financial Totals Breakdown */}
              <div className="p-3 bg-terracotta-50/50 rounded-2xl border border-terracotta-200 space-y-1 text-xs">
                <div className="flex justify-between text-warm-700">
                  <span>Subtotal Arreglos:</span>
                  <span className="font-mono font-bold">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-warm-700">
                  <span>Costo Envío:</span>
                  <span className="font-mono font-bold">
                    {deliveryType === "pickup" ? "0.00 Bs (Exento - Retiro en Tienda)" : formatCurrency(deliveryFee)}
                  </span>
                </div>
                <div className="pt-2 border-t border-terracotta-200 flex justify-between text-sm font-bold text-terracotta-800">
                  <span>TOTAL A COBRAR:</span>
                  <span className="font-mono">{formatCurrency(cartTotal + (deliveryType === "pickup" ? 0 : deliveryFee))}</span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-warm-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <Receipt className="h-4 w-4" />
                  {isProcessing ? "Emitiendo Ticket..." : "Emitir Ticket & Registrar Pedido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
