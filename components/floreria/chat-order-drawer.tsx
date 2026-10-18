"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Clock,
  Send,
  Package,
  Plus,
  Trash2,
  Receipt,
  Search,
  MessageSquare,
  User,
  Bot,
  Copy,
  Truck,
  Store,
  Info
} from "lucide-react";
import { createOrderWithRecipeAction } from "@/app/actions/omnichannel";
import { createUnifiedTicketAction } from "@/app/actions/logistics";
import { getRawIngredientsAction } from "@/app/actions/arrangements";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface RawIngredientItem {
  id: string;
  name: string;
  type: string;
  available: number;
  unit: string;
  costPerUnit: number;
}

interface ChatMessageData {
  id?: string;
  sender: string;
  text: string;
  createdAt?: string | Date;
}

interface ChatOrderDrawerProps {
  isOpen: boolean;
  threadId?: string;
  clientName: string;
  clientPhone?: string;
  channel?: string;
  messages?: ChatMessageData[];
  onClose: () => void;
  onSuccess: () => void;
}

function parseClientNameAndPhone(rawName: string, rawPhone: string): { cleanName: string; cleanPhone: string } {
  let cleanName = (rawName || "").trim();
  let cleanPhone = (rawPhone || "").trim();

  // 1. Extraer número real si viene entre paréntesis en el nombre: e.g. "Avi 💗 (+591 76722258)"
  const parenMatch = cleanName.match(/\(([\+\d\s-]+)\)$/);
  if (parenMatch) {
    const phoneInside = parenMatch[1].trim();
    // Si el rawPhone contiene @lid, @c.us o es el prefijo falso 239..., reemplazarlo por el número real
    if (!cleanPhone || cleanPhone.includes("@lid") || cleanPhone.includes("@c.us") || cleanPhone.startsWith("239") || cleanPhone.replace(/\D/g, "").length > 13) {
      cleanPhone = phoneInside;
    }
    cleanName = cleanName.replace(/\s*\([\+\d\s-]+\)$/, "").trim();
  }

  // 2. Limpiar sufijos @lid o @c.us
  if (cleanPhone.includes("@")) {
    cleanPhone = cleanPhone.split("@")[0].trim();
  }

  // 3. Si el teléfono sigue teniendo el prefijo falso 239... buscar dígitos válidos en el nombre
  if (cleanPhone.startsWith("239") && cleanPhone.replace(/\D/g, "").length > 13) {
    const digitsInName = rawName.match(/\+?\d[\d\s-]{6,15}\d/);
    if (digitsInName) {
      cleanPhone = digitsInName[0].trim();
    }
  }

  return {
    cleanName: cleanName || "Cliente General",
    cleanPhone: cleanPhone || "",
  };
}

export default function ChatOrderDrawer({
  isOpen,
  threadId,
  clientName,
  clientPhone = "",
  channel = "WhatsApp",
  messages = [],
  onClose,
  onSuccess,
}: ChatOrderDrawerProps) {
  const initialParsed = parseClientNameAndPhone(clientName, clientPhone);

  // Buyer / Loyalty Customer State
  const [buyerName, setBuyerName] = useState(initialParsed.cleanName);
  const [buyerPhone, setBuyerPhone] = useState(initialParsed.cleanPhone);

  // Order Logistics State
  const [recipientName, setRecipientName] = useState(initialParsed.cleanName);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState("Calacoto, Zona Sur");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryTime, setDeliveryTime] = useState("");

  const [arrangementName, setArrangementName] = useState("");
  const [dedicationMessage, setDedicationMessage] = useState("");

  // Raw Ingredients Catalog & Filter
  const [availableIngredients, setAvailableIngredients] = useState<RawIngredientItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [ingredientSearch, setIngredientSearch] = useState<string>("");
  
  // Custom Recipe Selection (Insumos/Materiales) - Empty by default
  const [selectedRecipe, setSelectedRecipe] = useState<{ ingredientId: string; quantity: number }[]>([]);

  // Custom Pricing & Payment
  const [salePrice, setSalePrice] = useState<number | string>("");
  const [deliveryFee, setDeliveryFee] = useState<number | string>(0);
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [mobileTab, setMobileTab] = useState<"form" | "chat">("form");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadIngredients();
      const parsed = parseClientNameAndPhone(clientName, clientPhone);
      setBuyerName(parsed.cleanName);
      setBuyerPhone(parsed.cleanPhone);
      setRecipientName(parsed.cleanName);
      setSelectedRecipe([]);
      setSelectedCategory("Todos");
      setIngredientSearch("");
    }
  }, [isOpen, clientName, clientPhone]);

  const loadIngredients = async () => {
    const res = await getRawIngredientsAction();
    if (res.success && Array.isArray(res.data)) {
      const ings = res.data as RawIngredientItem[];
      setAvailableIngredients(ings);
      // Iniciar siempre con receta vacía (0 en todos los insumos)
      setSelectedRecipe([]);
    }
  };

  // Dynamic list of unique categories directly from inventory raw ingredients
  const dynamicCategories = useMemo(() => {
    const rawTypes = availableIngredients
      .map((i) => (i.type || "").trim())
      .filter((t) => t.length > 0);
    const uniqueTypes = Array.from(new Set(rawTypes));
    return ["Todos", ...uniqueTypes];
  }, [availableIngredients]);

  // Filtered ingredients for Bento Grid
  const filteredIngredients = useMemo(() => {
    return availableIngredients.filter((i) => {
      const matchesCategory =
        selectedCategory === "Todos" ||
        (i.type || "").trim().toLowerCase() === selectedCategory.trim().toLowerCase();

      const q = ingredientSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        i.name.toLowerCase().includes(q) ||
        (i.unit && i.unit.toLowerCase().includes(q)) ||
        (i.type && i.type.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [availableIngredients, selectedCategory, ingredientSearch]);

  // Recipe helpers
  const addIngredientToRecipe = (ingId: string) => {
    setSelectedRecipe((prev) => {
      const existing = prev.find((r) => r.ingredientId === ingId);
      if (existing) {
        return prev.map((r) => (r.ingredientId === ingId ? { ...r, quantity: r.quantity + 1 } : r));
      }
      return [...prev, { ingredientId: ingId, quantity: 1 }];
    });
  };

  const updateRecipeQty = (ingId: string, qty: number) => {
    if (qty <= 0) {
      setSelectedRecipe((prev) => prev.filter((r) => r.ingredientId !== ingId));
      return;
    }
    setSelectedRecipe((prev) =>
      prev.map((r) => (r.ingredientId === ingId ? { ...r, quantity: qty } : r))
    );
  };

  if (!isOpen) return null;

  // Cost calculations
  const numSalePrice = Number(salePrice) || 0;
  const numDeliveryFee = deliveryType === "pickup" ? 0 : (Number(deliveryFee) || 0);

  const totalMaterialCost = selectedRecipe.reduce((acc, item) => {
    const ing = availableIngredients.find((i) => i.id === item.ingredientId);
    return acc + (ing ? ing.costPerUnit * item.quantity : 0);
  }, 0);

  const grandTotal = numSalePrice + numDeliveryFee;
  const netMargin = grandTotal - totalMaterialCost;
  const marginPercentage = grandTotal > 0 ? (netMargin / grandTotal) * 100 : 0;


  const copyTextToDedication = (text: string) => {
    setDedicationMessage(text);
    toast.info("Texto copiado a la dedicatoria");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deliveryType === "delivery" && (!address.trim() || address === "Retiro en Tienda / Local")) {
      setError("Por favor completa la dirección de entrega.");
      return;
    }

    if (!dedicationMessage.trim()) {
      setError("Por favor completa el mensaje de dedicatoria.");
      return;
    }

    if (selectedRecipe.length === 0) {
      setError("Debes agregar al menos un insumo/material a la receta del arreglo.");
      return;
    }

    setLoading(true);
    setError(null);

    // Prepare recipe items payload
    const recipePayload = selectedRecipe.map((r) => {
      const ing = availableIngredients.find((i) => i.id === r.ingredientId);
      return {
        rawIngredientId: r.ingredientId,
        quantityNeeded: r.quantity,
        unitCost: ing ? ing.costPerUnit : 0,
      };
    });

    const finalAddress = deliveryType === "pickup" ? "Retiro en Tienda / Local" : address.trim();
    const finalZone = deliveryType === "pickup" ? "Tienda Central" : zone;
    const finalDeliveryFee = deliveryType === "pickup" ? 0 : Number(deliveryFee);

    // Atomic Server Action Call
    const res = await createUnifiedTicketAction({
      clientName: buyerName.trim() || clientName,
      clientPhone: buyerPhone.trim() || clientPhone,
      recipientName: recipientName.trim() || buyerName.trim() || clientName,
      deliveryType,
      address: finalAddress,
      zone: finalZone,
      deliveryDate,
      deliveryTime,
      arrangementName,
      salePrice: Number(salePrice),
      deliveryFee: finalDeliveryFee,
      total: Number(salePrice) + finalDeliveryFee,
      paymentMethod,
      dedicationMessage,
      recipeItems: recipePayload,
    });


    setLoading(false);

    if (res.success) {
      toast.success("¡Ticket de pedido emitido, registrado en Logística y stock descontado exitosamente!");
      onSuccess();
      onClose();
    } else {
      setError(res.error || "No se pudo generar el pedido desde el chat.");
      toast.error(res.error || "Error al emitir el pedido.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-4xl max-h-[92dvh] sm:max-h-[88dvh] shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col md:flex-row border border-warm-200 animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Mobile Tab Switcher */}
        <div className="flex md:hidden items-center justify-between p-2.5 bg-warm-100 border-b border-warm-200 shrink-0">
          <div className="inline-flex p-0.5 bg-white rounded-xl border border-warm-200 flex-1 mr-2">
            <button
              type="button"
              onClick={() => setMobileTab("form")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === "form" ? "bg-terracotta-500 text-white shadow-xs" : "text-warm-600"
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Formulario</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("chat")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === "chat" ? "bg-terracotta-500 text-white shadow-xs" : "text-warm-600"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Chat ({messages.length})</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-warm-500 hover:text-warm-900 rounded-lg shrink-0"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* LEFT COLUMN: Live Chat Stream View */}
        <div className={`w-full md:w-5/12 max-h-[88dvh] bg-warm-50 border-r border-warm-200 flex-col overflow-hidden ${
          mobileTab === "chat" ? "flex" : "hidden md:flex"
        }`}>
          <div className="p-4 bg-white border-b border-warm-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-terracotta-600" />
              <div>
                <h4 className="font-bold text-xs text-warm-900">Conversación de Origen</h4>
                <p className="text-[10px] text-warm-500">{clientName} ({channel})</p>
              </div>
            </div>
            <span className="px-2 py-0.5 text-[9px] font-bold bg-terracotta-100 text-terracotta-800 rounded-full">
              {messages.length} mensajes
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-warm-400">
                No hay mensajes previos en este chat.
              </div>
            ) : (
              messages.map((msg, index) => (
                <div
                  key={msg.id || index}
                  className={`flex flex-col space-y-1 ${
                    msg.sender === "customer"
                      ? "items-start"
                      : "items-end"
                  }`}
                >
                  <div className="flex items-center gap-1 text-[9px] text-warm-400 font-semibold px-1">
                    {msg.sender === "customer" ? (
                      <>
                        <User className="h-3 w-3 text-warm-500" />
                        <span>{clientName}</span>
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3 text-terracotta-500" />
                        <span>Florería Farfalina</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`group relative p-3 rounded-2xl text-xs leading-relaxed max-w-[90%] ${
                      msg.sender === "customer"
                        ? "bg-white text-warm-900 border border-warm-200 rounded-tl-none shadow-2xs"
                        : "bg-terracotta-500 text-white rounded-tr-none shadow-2xs"
                    }`}
                  >
                    <p>{msg.text}</p>
                    
                    {/* Copy to dedication helper button for customer messages */}
                    {msg.sender === "customer" && (
                      <button
                        type="button"
                        onClick={() => {
                          copyTextToDedication(msg.text);
                          setMobileTab("form");
                        }}
                        className="mt-1.5 pt-1 border-t border-warm-100 text-[10px] text-terracotta-700 font-bold hover:underline flex items-center gap-1"
                        title="Usar como mensaje de dedicatoria"
                      >
                        <Copy className="h-3 w-3" />
                        Usar como dedicatoria
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-white border-t border-warm-200 text-[10px] text-warm-500 text-center shrink-0 flex items-center justify-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-warm-400" />
            <span>Haz clic en <strong>"Usar como dedicatoria"</strong> en cualquier mensaje para copiarlo.</span>
          </div>
        </div>

        {/* RIGHT COLUMN: Ticket Creation Form */}
        <div className={`w-full md:w-7/12 max-h-[88dvh] flex-col overflow-y-auto p-4 sm:p-5 space-y-4 bg-white ${
          mobileTab === "form" ? "flex" : "hidden md:flex"
        }`}>
          {/* Header */}
          <div className="hidden md:flex items-center justify-between pb-3 border-b border-warm-200">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-terracotta-600" />
              <div>
                <h3 className="font-bold text-sm text-warm-900">Emisión de Ticket desde Chat</h3>
                <p className="text-[11px] text-warm-500">Completa los datos extraídos de la conversación.</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-warm-400 hover:text-warm-700 rounded-xl hover:bg-warm-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Section 1: Bento Grid Insumos & Materiales */}
              <div className="p-3.5 bg-warm-50/70 border border-warm-200 rounded-2xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-warm-200 pb-2">
                  <div className="flex items-center gap-1.5 text-warm-900 font-bold text-xs">
                    <Package className="h-4 w-4 text-terracotta-600" />
                    <span>Bento Grid: Insumos de la Receta del Ticket</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-terracotta-700 bg-white px-2 py-0.5 rounded-md border border-warm-200">
                    Costo Insumos: {formatCurrency(totalMaterialCost)}
                  </span>
                </div>

                {/* Filter & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
                    {dynamicCategories.map((cat) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all whitespace-nowrap ${
                          selectedCategory === cat
                            ? "bg-terracotta-500 text-white shadow-xs"
                            : "bg-white text-warm-700 hover:bg-warm-100 border border-warm-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full sm:w-44 shrink-0">
                    <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-warm-400" />
                    <input
                      type="text"
                      value={ingredientSearch}
                      onChange={(e) => setIngredientSearch(e.target.value)}
                      placeholder="Buscar por nombre..."
                      className="w-full pl-7 pr-2 py-1 bg-white border border-warm-200 rounded-lg text-[11px] text-warm-900 focus:outline-none focus:border-terracotta-500 placeholder:text-warm-400 font-medium"
                    />
                  </div>
                </div>

                {/* Bento Grid Cards Container */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                  {filteredIngredients.map((ing) => {
                    const recipeItem = selectedRecipe.find((r) => r.ingredientId === ing.id);
                    const isSelected = !!recipeItem;
                    const qty = recipeItem ? recipeItem.quantity : 0;

                    return (
                      <div
                        key={ing.id}
                        className={`p-2 rounded-xl border text-left flex flex-col justify-between space-y-1.5 ${
                          isSelected
                            ? "bg-terracotta-50/70 border-terracotta-400 shadow-sm"
                            : "bg-white border-warm-200 hover:border-warm-300"
                        }`}
                      >
                        <div>
                          <span className="px-1 py-0.2 text-[8px] font-bold bg-warm-100 text-warm-700 rounded">
                            {ing.type}
                          </span>
                          <p className="text-[11px] font-bold text-warm-900 line-clamp-1 mt-0.5">{ing.name}</p>
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-warm-500">
                          <span>{ing.available} {ing.unit}</span>
                          <span className="font-mono">{formatCurrency(ing.costPerUnit)}/u</span>
                        </div>

                        <div className="pt-1 border-t border-warm-200 flex items-center justify-between">
                          {isSelected ? (
                            <div className="flex items-center justify-between w-full bg-white rounded p-0.5 border border-terracotta-300">
                              <button
                                type="button"
                                onClick={() => updateRecipeQty(ing.id, qty - 1)}
                                className="p-0.5 text-warm-600 hover:bg-warm-100 rounded"
                              >
                                <Trash2 className="h-3 w-3 text-rose-500" />
                              </button>
                              <span className="font-bold text-[11px] text-terracotta-800 px-1">{qty}</span>
                              <button
                                type="button"
                                onClick={() => addIngredientToRecipe(ing.id)}
                                className="p-0.5 text-warm-600 hover:bg-warm-100 rounded"
                              >
                                <Plus className="h-3 w-3 text-terracotta-600" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addIngredientToRecipe(ing.id)}
                              className="w-full py-0.5 text-[10px] font-bold bg-warm-100 hover:bg-terracotta-500 hover:text-white text-warm-800 rounded transition-all flex items-center justify-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Añadir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Datos del Cliente Comprador (Fidelización & Directorio) */}
              <div className="p-3 bg-warm-50 rounded-2xl border border-warm-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-warm-900">
                    <User className="h-4 w-4 text-terracotta-600" />
                    <span>Cliente Comprador (Fidelización CRM)</span>
                  </div>
                  <span className="text-[10px] font-bold text-amberGold-800 bg-amberGold-100 px-2 py-0.5 rounded-full">
                    Suma Puntos
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-warm-700">Nombre del Cliente *</label>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="Nombre del comprador..."
                      className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                      required
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-warm-700">Teléfono / WhatsApp *</label>
                    <input
                      type="text"
                      value={buyerPhone}
                      onChange={(e) => setBuyerPhone(e.target.value)}
                      placeholder="Teléfono del comprador..."
                      className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900 font-mono focus:outline-none focus:border-terracotta-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Logística & Despacho */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-xs text-warm-900 border-b border-warm-200 pb-1">
                  Detalles de Entrega & Despacho
                </h4>


                {/* Delivery Mode Selector */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-warm-800">Modalidad de Despacho *</label>
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

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold text-warm-800">Nombre Destinatario *</label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full p-2 bg-warm-50 border border-warm-200 rounded-lg text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                      required
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold text-warm-800">Nombre del Arreglo *</label>
                    <input
                      type="text"
                      value={arrangementName}
                      onChange={(e) => setArrangementName(e.target.value)}
                      className="w-full p-2 bg-warm-50 border border-warm-200 rounded-lg text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold text-warm-800">
                      {deliveryType === "pickup" ? "Fecha de Retiro *" : "Fecha de Entrega *"}
                    </label>
                    <input
                      type="date"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                      className="w-full p-2 bg-warm-50 border border-warm-200 rounded-lg text-xs font-medium text-warm-900 font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-bold text-warm-800 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-terracotta-600" />
                        <span>{deliveryType === "pickup" ? "Hora Estimada Retiro *" : "Hora de Entrega *"}</span>
                      </span>
                    </label>
                    <input
                      type="time"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full p-2 bg-warm-50 border border-warm-200 rounded-lg text-xs font-bold text-warm-900 font-mono focus:outline-none focus:border-terracotta-500 cursor-pointer"
                      required
                    />
                  </div>
                </div>

                {/* Chips de selección rápida de horarios */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  <span className="text-[10px] text-warm-400 font-semibold shrink-0">Horarios sugeridos:</span>
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


                {deliveryType === "pickup" ? (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs flex items-center gap-2.5 text-purple-900 font-semibold">
                    <Store className="h-4 w-4 text-purple-700 shrink-0" />
                    <div>
                      <p className="font-bold text-purple-950">Modalidad: Recoger en Tienda (Pick-up)</p>
                      <p className="text-[11px] text-purple-700 font-normal mt-0.5">
                        El pedido estará listo en tienda central. Los campos de dirección de flete quedan exentos de forma automática.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold text-warm-800">Zona Delivery *</label>
                      <select
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        className="w-full p-2 bg-warm-50 border border-warm-200 rounded-lg text-xs font-medium text-warm-900"
                      >
                        <option value="Calacoto, Zona Sur">Calacoto, Zona Sur</option>
                        <option value="Achumani, Zona Sur">Achumani, Zona Sur</option>
                        <option value="Sopocachi">Sopocachi</option>
                        <option value="Centro, La Paz">Centro, La Paz</option>
                        <option value="Miraflores">Miraflores</option>
                        <option value="El Alto">El Alto</option>
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold text-warm-800">Dirección Exacta *</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Calle / Av., Nro..."
                        className="w-full p-2 bg-warm-50 border border-warm-200 rounded-lg text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                        required={deliveryType === "delivery"}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold text-warm-800">Mensaje Dedicatoria Impresa *</label>
                  <textarea
                    rows={2}
                    value={dedicationMessage}
                    onChange={(e) => setDedicationMessage(e.target.value)}
                    className="w-full p-2 bg-warm-50 border border-warm-200 rounded-lg text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                    required
                  />
                </div>
              </div>

              {/* Section 3: Financiero & Rentabilidad */}
              <div className="p-3 bg-warm-50 rounded-2xl border border-warm-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-warm-900">Total y Margen Neto</span>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-bold rounded border ${
                      marginPercentage >= 40
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : marginPercentage >= 20
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    Margen: {marginPercentage.toFixed(1)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-warm-800">Precio Arreglo (Bs) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={salePrice}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        setSalePrice(val);
                      }}
                      placeholder="0.00"
                      className="w-full p-1.5 bg-white border border-warm-200 rounded text-xs font-bold text-warm-900 focus:outline-none focus:border-terracotta-500 font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-bold text-warm-800">
                      {deliveryType === "pickup" ? "Costo Envío (Exento)" : "Costo Envío (Bs)"}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={deliveryType === "pickup" ? "0" : deliveryFee}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, "");
                        setDeliveryFee(val);
                      }}
                      disabled={deliveryType === "pickup"}
                      placeholder="0.00"
                      className={`w-full p-1.5 rounded text-xs font-bold font-mono ${
                        deliveryType === "pickup"
                          ? "bg-warm-100 text-purple-700 border border-warm-300 cursor-not-allowed"
                          : "bg-white border border-warm-200 text-warm-900 focus:outline-none focus:border-terracotta-500"
                      }`}
                      required
                    />
                  </div>
                </div>


                <div className="space-y-1 pt-1">
                  <label className="text-[10px] font-bold text-warm-800">Método de Pago *</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["Efectivo", "QR", "Tarjeta"] as const).map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setPaymentMethod(m)}
                        className={`py-1 text-[11px] font-bold rounded-lg border transition-all ${
                          paymentMethod === m
                            ? "bg-terracotta-500 text-white border-terracotta-500 shadow-sm"
                            : "bg-white text-warm-700 border-warm-200 hover:bg-warm-100"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1.5 border-t border-warm-200 flex justify-between text-xs font-bold text-warm-900">
                  <span>TOTAL A COBRAR:</span>
                  <span className="text-terracotta-700 font-mono text-sm">{formatCurrency(grandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-warm-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {loading ? "Creando Ticket..." : "Emitir Ticket & Descontar Stock"}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
