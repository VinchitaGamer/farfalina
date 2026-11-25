"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Minus,
  Trash2,
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
  Store,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { getArrangementsAction } from "@/app/actions/arrangements";
import { createUnifiedTicketAction } from "@/app/actions/logistics";
import NewArrangementModal from "./new-arrangement-modal";
import EditArrangementModal from "./edit-arrangement-modal";
import { formatCurrency, getBoliviaDateStr } from "@/lib/utils";
import { buildDeliveryWhatsAppMessage } from "@/lib/delivery-whatsapp";
import { toast } from "@/components/ui/toast";

type ArrangementRecipeItem = {
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
};

type ArrangementItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  featured: boolean;
  image: string;
  description: string;
  recipeItems?: ArrangementRecipeItem[];
};

type CartEntry = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

export default function CatalogView() {
  const [activeTab, setActiveTab] = useState<"catalog" | "seo" | "preview">("catalog");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [cart, setCart] = useState<CartEntry[]>([]);

  const DEFAULT_ARR_CATEGORIES = ["Rosas", "Girasoles", "Arreglos Mixtos", "Insumos & Jarrones"];
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const [items, setItems] = useState<ArrangementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const [editingArrangement, setEditingArrangement] = useState<ArrangementItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Unified Checkout Modal State (preserved across modal close/reopen so user never loses typed info)
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("pickup");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(getBoliviaDateStr());
  const [deliveryTime, setDeliveryTime] = useState("");
  const [dedicationMessage, setDedicationMessage] = useState("");

  const [deliveryFee, setDeliveryFee] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

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
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    toast.info("Carrito vaciado");
  };

  const openEditModal = (item: ArrangementItem) => {
    setEditingArrangement(item);
    setIsEditModalOpen(true);
  };

  const handleProcessOrder = () => {
    if (cart.length === 0) return;
    if (!recipientName && customerName) {
      setRecipientName(customerName);
    }
    setCopiedWhatsApp(false);
    setCheckoutModalOpen(true);
  };

  const cartTotal = cart.reduce((acc, curr) => acc + curr.price * curr.qty, 0);
  const numDeliveryFee = deliveryType === "pickup" ? 0 : Math.max(0, Number(deliveryFee) || 0);
  const grandTotal = cartTotal + numDeliveryFee;

  const whatsappPreviewText = buildDeliveryWhatsAppMessage({
    clientName: customerName.trim() || "Cliente Mostrador",
    clientPhone: customerPhone.trim(),
    recipientName: recipientName.trim() || customerName.trim() || "Cliente Mostrador",
    recipientPhone: recipientPhone.trim(),
    address: deliveryType === "pickup" ? "Retiro en Tienda / Local" : address.trim(),
    zone: deliveryType === "pickup" ? "Tienda Central" : zone.trim(),
    mapsUrl: deliveryType === "pickup" ? "" : mapsUrl.trim(),
    deliveryDate,
    deliveryTime: deliveryTime.trim() || "Por coordinar",
    arrangementName: cart.map((c) => `${c.qty}x ${c.name}`).join(", "),
    deliveryFee: numDeliveryFee,
    deliveryType,
  });

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappPreviewText);
      setCopiedWhatsApp(true);
      toast.success("Texto de despacho copiado para pegar en WhatsApp");
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleFinalizeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;
    if (cart.length === 0) {
      toast.error("Agrega al menos un arreglo al carrito");
      return;
    }

    if (deliveryType === "delivery" && !address.trim() && !mapsUrl.trim()) {
      toast.error("Para envío a domicilio, ingresa la dirección exacta o el link de Google Maps.");
      return;
    }

    setIsProcessing(true);

    const arrangementName = cart.map((c) => `${c.qty}x ${c.name}`).join(", ");
    const finalAddress =
      deliveryType === "pickup" ? "Retiro en Tienda / Local" : address.trim() || "Ver ubicación en Google Maps";
    const finalZone = deliveryType === "pickup" ? "Tienda Central" : zone.trim() || "Sin zona especificada";

    // Aggregate recipe ingredients across cart items when arrangements have recipes
    const aggregatedRecipes = new Map<string, { rawIngredientId: string; quantityNeeded: number; unitCost: number }>();
    for (const cartItem of cart) {
      const catalogItem = items.find((i) => i.id === cartItem.id);
      if (catalogItem?.recipeItems && catalogItem.recipeItems.length > 0) {
        for (const r of catalogItem.recipeItems) {
          const prev = aggregatedRecipes.get(r.rawIngredientId);
          const needed = r.quantityNeeded * cartItem.qty;
          const unitCost = r.rawIngredient?.costPerUnit || 0;
          if (prev) {
            prev.quantityNeeded += needed;
          } else {
            aggregatedRecipes.set(r.rawIngredientId, {
              rawIngredientId: r.rawIngredientId,
              quantityNeeded: needed,
              unitCost,
            });
          }
        }
      }
    }

    const res = await createUnifiedTicketAction({
      clientName: customerName.trim() || "Cliente Mostrador",
      clientPhone: customerPhone.trim(),
      recipientName: recipientName.trim() || customerName.trim() || "Cliente Mostrador",
      recipientPhone: recipientPhone.trim() || null,
      deliveryType,
      address: finalAddress,
      zone: finalZone,
      mapsUrl: deliveryType === "pickup" ? null : mapsUrl.trim() || null,
      deliveryDate,
      deliveryTime: deliveryTime.trim() || "Por coordinar",
      arrangementName,
      salePrice: cartTotal,
      deliveryFee: numDeliveryFee,
      total: grandTotal,
      paymentMethod,
      dedicationMessage: dedicationMessage.trim(),
      recipeItems: Array.from(aggregatedRecipes.values()),
    });

    setIsProcessing(false);

    if (res.success) {
      const data = res.data as { ticket?: { ticketNumber: string }; order?: { orderNumber: string } };
      const ticketNum = data?.order?.orderNumber || data?.ticket?.ticketNumber || "PED";
      toast.success(`¡Pedido ${ticketNum} registrado en Pedidos, Logística y Contabilidad!`);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setRecipientName("");
      setRecipientPhone("");
      setDeliveryType("pickup");
      setAddress("");
      setZone("");
      setMapsUrl("");
      setDeliveryDate(getBoliviaDateStr());
      setDeliveryTime("");
      setDeliveryFee("0");
      setPaymentMethod("Efectivo");
      setDedicationMessage("");
      setCheckoutModalOpen(false);
      loadCatalog();
    } else {
      toast.error(res.error || "Error al procesar el pedido.");
    }
  };

  const filteredItems =
    selectedCategory === "Todos" ? items : items.filter((i) => i.category === selectedCategory);

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
            Gestión de arreglos florales, precios de temporada, cotización flexible y emisión de pedidos.
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
          <div className="bg-white p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4 h-fit sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <div className="flex items-center gap-2 text-warm-900">
                <ShoppingCart className="h-4 w-4 text-terracotta-600" />
                <h3 className="font-bold text-sm">Carrito de Cotización</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-warm-500 font-semibold">
                  {cart.reduce((acc, c) => acc + c.qty, 0)} ítems
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 px-2 py-0.5 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                    title="Vaciar todo el carrito"
                  >
                    Vaciar
                  </button>
                )}
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <ShoppingCart className="h-8 w-8 text-warm-300 mx-auto" />
                <p className="text-xs text-warm-500">No hay arreglos seleccionados para cotizar.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {cart.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 text-xs p-2.5 bg-warm-50 rounded-xl border border-warm-200/80"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-warm-900 truncate">{c.name}</p>
                        <p className="text-[10px] text-warm-500">{formatCurrency(c.price)} c/u</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(c.id, -1)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-warm-200 text-warm-700 hover:bg-warm-100"
                          aria-label="Restar cantidad"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-warm-900">{c.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(c.id, 1)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-white border border-warm-200 text-warm-700 hover:bg-warm-100"
                          aria-label="Sumar cantidad"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="font-mono font-bold text-terracotta-700 min-w-[54px] text-right">
                          {formatCurrency(c.price * c.qty)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(c.id)}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                          title="Quitar del carrito"
                          aria-label="Quitar arreglo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-warm-200 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-warm-600">Subtotal Arreglos:</span>
                    <span className="font-semibold text-warm-900">{formatCurrency(cartTotal)}</span>
                  </div>
                  <p className="text-[10px] text-warm-400">
                    * Sin costo de envío por defecto. Si requiere delivery (Yango / taxi), se define al generar el pedido.
                  </p>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-warm-100 text-terracotta-700">
                    <span>Total Cotización:</span>
                    <span className="font-mono">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>

                <button
                  onClick={handleProcessOrder}
                  className="w-full py-2.5 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm transition-all"
                >
                  Generar Pedido / Ticket
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
                defaultValue="Catálogo exclusivo de arreglos florales, rosas importadas y ramos para cumpleaños y aniversarios. Envíos a domicilio en el mismo día con tarjeta dedicatoria."
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => toast.success("Configuración SEO guardada")}
            className="px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm"
          >
            Guardar Configuración SEO
          </button>
        </div>
      )}

      {activeTab === "preview" && (
        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-warm-200">
            <h3 className="font-bold text-sm text-warm-900">Previsualización de Tienda Pública</h3>
            <span className="text-xs text-terracotta-600 font-mono flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> https://farfalina.tech
            </span>
          </div>

          <div className="p-8 rounded-2xl bg-gradient-to-br from-warm-100 via-white to-terracotta-50 border border-warm-200 text-center space-y-4">
            <span className="px-3 py-1 bg-terracotta-100 text-terracotta-700 text-xs font-bold rounded-full inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Nueva Colección Farfalina</span>
            </span>
            <h1 className="text-2xl font-bold text-warm-900">Arreglos Florales que Expresan lo Inexpresable</h1>
            <p className="text-xs text-warm-600 max-w-md mx-auto">
              Diseño floral de alta gama para momentos inolvidables. Envíos coordinados en La Paz y El Alto.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab("catalog")}
                className="px-5 py-2 bg-terracotta-500 text-white rounded-xl text-xs font-bold shadow-warm"
              >
                Ver Catálogo Completo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive New Arrangement Modal */}
      <NewArrangementModal isOpen={isNewModalOpen} onClose={() => setIsNewModalOpen(false)} onSuccess={loadCatalog} />

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

      {/* Unified Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-terracotta-100 text-terracotta-700 rounded-xl">
                  <Receipt className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-warm-900">Emisión de Pedido / Ticket Unificado</h3>
                  <p className="text-xs text-warm-500">
                    Registra la venta en Pedidos, Logística y Contabilidad sin perder tus datos si editas el carrito.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutModalOpen(false)}
                className="p-1 text-warm-400 hover:text-warm-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFinalizeCheckout} className="space-y-4">
              {/* Editable Order Items Summary directly inside Modal */}
              <div className="p-3 bg-warm-50 rounded-2xl border border-warm-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-warm-900">Arreglos Seleccionados (editables aquí):</p>
                  <button
                    type="button"
                    onClick={() => setCheckoutModalOpen(false)}
                    className="text-[11px] font-bold text-terracotta-600 hover:underline"
                  >
                    + Agregar otro (sin perder datos)
                  </button>
                </div>
                {cart.length === 0 ? (
                  <p className="text-[11px] text-rose-600 font-semibold">
                    No quedan arreglos en el carrito. Cierra para elegir uno.
                  </p>
                ) : (
                  cart.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-warm-200/70"
                    >
                      <span className="font-semibold text-warm-800 truncate flex-1">{c.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateCartQty(c.id, -1)}
                          className="h-6 w-6 flex items-center justify-center rounded bg-warm-100 hover:bg-warm-200 text-warm-700"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-mono font-bold">{c.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(c.id, 1)}
                          className="h-6 w-6 flex items-center justify-center rounded bg-warm-100 hover:bg-warm-200 text-warm-700"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="font-mono font-bold text-terracotta-700 min-w-[54px] text-right">
                          {formatCurrency(c.price * c.qty)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFromCart(c.id)}
                          className="h-6 w-6 flex items-center justify-center rounded text-rose-500 hover:bg-rose-50"
                          title="Quitar ítem"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Section 1: Customer Info (Optional for fast walk-in sales) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-terracotta-600" /> Nombre del Cliente (Opcional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Opcional (ej: Cliente Mostrador)"
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 text-terracotta-600" /> Teléfono del Cliente (Opcional)
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Opcional (para CRM / Fidelización)"
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-mono font-medium text-warm-900"
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
                  <label className="text-xs font-bold text-warm-800">Modalidad de Despacho</label>
                  <div className="grid grid-cols-2 gap-1.5 bg-warm-100 p-1 rounded-xl border border-warm-200">
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryType("pickup");
                        setDeliveryFee("0");
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        deliveryType === "pickup"
                          ? "bg-white text-purple-700 shadow-sm"
                          : "text-warm-600 hover:text-warm-900"
                      }`}
                    >
                      <Store className="h-3.5 w-3.5" />
                      <span>Recoger en Tienda</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeliveryType("delivery");
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
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-warm-800">Quién Recibe / Destinatario</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Nombre de quien recibe..."
                      className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-terracotta-600" />
                      <span>Teléfono Destinatario (Para Taxi/Yango)</span>
                    </label>
                    <input
                      type="text"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      placeholder="Celular de quien recibe..."
                      className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-mono font-medium"
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

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-terracotta-600" />
                      <span>Hora (Editable libre)</span>
                    </label>
                    <input
                      type="text"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      placeholder="Ej: 18:30, En la noche 21:00..."
                      className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-bold"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <span className="text-[10px] text-warm-400 font-semibold shrink-0">Sugeridos:</span>
                  {["10:00", "12:00", "15:00", "18:00", "20:00", "21:30"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDeliveryTime(t)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition-all shrink-0 ${
                        deliveryTime === t
                          ? "bg-terracotta-500 text-white shadow-xs"
                          : "bg-white hover:bg-warm-100 text-warm-700 border border-warm-200"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                {deliveryType === "pickup" ? (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs flex items-center gap-2.5 text-purple-900 font-semibold">
                    <Store className="h-4 w-4 text-purple-700 shrink-0" />
                    <div>
                      <p className="font-bold text-purple-950">Modalidad: Recoger en Tienda (Pick-up)</p>
                      <p className="text-[11px] text-purple-700 font-normal mt-0.5">
                        Costo de envío en 0 Bs. El pedido quedará agendado para entrega en mostrador.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-1 border-t border-warm-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-warm-800">Dirección Exacta de Envío *</label>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Calle, Avenida, Nro de puerta, ref..."
                          className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-warm-800 flex items-center justify-between">
                          <span>URL de Google Maps</span>
                          {mapsUrl.startsWith("http") && (
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-terracotta-600 hover:underline inline-flex items-center gap-0.5"
                            >
                              Abrir <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </label>
                        <input
                          type="url"
                          value={mapsUrl}
                          onChange={(e) => setMapsUrl(e.target.value)}
                          placeholder="https://maps.app.goo.gl/..."
                          className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs font-mono text-warm-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-warm-800">Zona Delivery (Opcional)</label>
                        <input
                          type="text"
                          value={zone}
                          onChange={(e) => setZone(e.target.value)}
                          placeholder="Ej: Calacoto, Sopocachi, Miraflores..."
                          className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-warm-800">Costo Delivery / Yango (Bs)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ""))}
                          placeholder="0"
                          className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs font-mono font-bold text-warm-900"
                        />
                      </div>
                    </div>

                    {/* 1-click Copy WhatsApp Dispatch Text */}
                    <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-emerald-900">
                          Texto automático para Central de Móviles / WhatsApp
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyWhatsApp}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                        >
                          {copiedWhatsApp ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedWhatsApp ? "¡Copiado!" : "Copiar para Delivery"}</span>
                        </button>
                      </div>
                      <pre className="text-[10px] text-emerald-950 whitespace-pre-wrap font-sans bg-white/85 p-2.5 rounded-lg border border-emerald-100 max-h-28 overflow-y-auto">
                        {whatsappPreviewText}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-warm-700 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-terracotta-500" /> Mensaje Dedicatoria para Tarjeta (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={dedicationMessage}
                    onChange={(e) => setDedicationMessage(e.target.value)}
                    placeholder="Opcional: escribe el mensaje solo si el pedido incluye tarjeta impresa..."
                    className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs text-warm-900 font-medium"
                  />
                </div>
              </div>

              {/* Section 3: Payment Method & Totals */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-warm-800 flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5 text-terracotta-600" /> Método de Pago
                </label>
                <div className="grid grid-cols-3 gap-1.5">
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
              <div className="p-3.5 bg-terracotta-50/50 rounded-2xl border border-terracotta-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-warm-700">
                  <span>Subtotal Arreglos:</span>
                  <span className="font-mono font-bold">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-warm-700">
                  <span>Costo Envío (Delivery):</span>
                  <span className="font-mono font-bold">
                    {deliveryType === "pickup" ? "0 Bs (Retiro en Tienda)" : formatCurrency(numDeliveryFee)}
                  </span>
                </div>
                <div className="pt-2 border-t border-terracotta-200 flex justify-between text-sm font-bold text-terracotta-800">
                  <span>TOTAL A COBRAR:</span>
                  <span className="font-mono">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-warm-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  className="px-4 py-2 bg-warm-100 text-warm-800 rounded-xl text-xs font-bold transition-all"
                >
                  Seguir Editando
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || cart.length === 0}
                  className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5 disabled:opacity-50 transition-all"
                >
                  <Receipt className="h-4 w-4" />
                  {isProcessing ? "Guardando..." : "Emitir Ticket & Registrar Pedido"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
