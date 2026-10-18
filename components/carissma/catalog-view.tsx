"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  Plus,
  ShoppingCart,
  Tag,
  Check,
  RefreshCw,
  Pencil,
  X,
  Shirt,
  Trash2
} from "lucide-react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  getDressesAction,
  createDressAction,
  updateDressAction,
  deleteDressAction,
  createRentalBookingAction,
  getCarissmaConfigAction
} from "@/app/actions/carissma";
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
  condition: string;
  status: "Disponible" | "Reservado" | "En Uso" | "En Lavandería";
  timesUsed: number;
}

export default function CatalogView() {

  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [selectedSize, setSelectedSize] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<{ dress: DressItem; qty: number }[]>([]);

  const DRESS_CATEGORIES = ["Todos", "Gala", "Novia", "Quinceañera", "Coctel", "Graduación", "Fiesta"];
  const SIZES = ["Todos", "XS", "S", "M", "L", "XL"];

  const [dresses, setDresses] = useState<DressItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDress, setEditingDress] = useState<DressItem | null>(null);

  // Checkout Modal
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [contractBooking, setContractBooking] = useState<RentalContractBooking | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"store" | "delivery">("store");
  const [address, setAddress] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [notes, setNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // New Dress Form
  const [newName, setNewName] = useState("");
  const [newBrand, setNewBrand] = useState("");
  const [newCategory, setNewCategory] = useState("Gala");
  const [newSize, setNewSize] = useState<"XS" | "S" | "M" | "L" | "XL">("M");
  const [newColor, setNewColor] = useState("");
  const [newBasePrice, setNewBasePrice] = useState<number | string>(450);
  const [newAcqCost, setNewAcqCost] = useState<number | string>(1200);
  const [newGuarantee, setNewGuarantee] = useState<number | string>(500);
  const [newImageUrl, setNewImageUrl] = useState("");

  useEffect(() => {
    loadCatalog();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    const res = await getDressesAction();
    if (res.success && Array.isArray(res.data)) {
      setDresses(res.data as DressItem[]);
    }
    setLoading(false);
  };

  const handleCreateDress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newBrand.trim() || !newColor.trim()) {
      toast.error("Por favor completa los campos obligatorios");
      return;
    }

    const res = await createDressAction({
      name: newName.trim(),
      brand: newBrand.trim(),
      category: newCategory,
      size: newSize,
      color: newColor.trim(),
      baseRentalPrice: Number(newBasePrice),
      acquisitionCost: Number(newAcqCost),
      requiredGuarantee: Number(newGuarantee),
      imageUrl: newImageUrl.trim() || undefined,
    });

    if (res.success) {
      toast.success("¡Vestido añadido al catálogo exitosamente!");
      setIsNewModalOpen(false);
      resetNewForm();
      loadCatalog();
    } else {
      toast.error(res.error || "Error al crear el vestido");
    }
  };

  const handleUpdateDress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDress) return;

    const res = await updateDressAction({
      id: editingDress.id,
      name: editingDress.name,
      brand: editingDress.brand,
      category: editingDress.category || "Gala",
      size: editingDress.size,
      color: editingDress.color,
      baseRentalPrice: Number(editingDress.baseRentalPrice),
      requiredGuarantee: Number(editingDress.requiredGuarantee),
      imageUrl: editingDress.imageUrl,
    });

    if (res.success) {
      toast.success("¡Vestido actualizado!");
      setIsEditModalOpen(false);
      setEditingDress(null);
      loadCatalog();
    } else {
      toast.error(res.error || "Error al actualizar");
    }
  };

  const handleDeleteDress = async (id: string, name: string) => {
    const ok = await confirm(`¿Estás seguro de eliminar el vestido "${name}" del catálogo?`);
    if (!ok) return;
    const res = await deleteDressAction(id);
    if (res.success) {
      toast.success("Vestido eliminado del catálogo");
      loadCatalog();
    } else {
      toast.error(res.error || "Error al eliminar");
    }
  };

  const resetNewForm = () => {
    setNewName("");
    setNewBrand("");
    setNewCategory("Gala");
    setNewSize("M");
    setNewColor("");
    setNewBasePrice(450);
    setNewAcqCost(1200);
    setNewGuarantee(500);
    setNewImageUrl("");
  };

  const addToCart = (dress: DressItem) => {
    if (dress.status !== "Disponible") {
      toast.error(`El vestido "${dress.name}" no está disponible actualmente (${dress.status})`);
      return;
    }
    const exists = cart.find((c) => c.dress.id === dress.id);
    if (exists) {
      toast.info("Esta prenda ya está en la selección de alquiler");
      return;
    }
    setCart([...cart, { dress, qty: 1 }]);
    toast.success(`"${dress.name}" añadido al pedido de alquiler`);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.dress.id !== id));
  };

  const totalRentalPrice = cart.reduce((acc, c) => acc + (c.dress.baseRentalPrice || 450), 0);
  const totalGuarantee = cart.reduce((acc, c) => acc + (c.dress.requiredGuarantee || 500), 0);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!clientName.trim()) {
      toast.error("El nombre de la clienta es requerido");
      return;
    }

    setIsProcessing(true);
    let successCount = 0;
    const createdBookings: RentalContractBooking[] = [];

    for (const item of cart) {
      const res = await createRentalBookingAction({
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim() || undefined,
        dressId: item.dress.id,
        rentalStartDate: startDate,
        rentalEndDate: endDate,
        rentalPrice: item.dress.baseRentalPrice,
        guaranteeAmount: item.dress.requiredGuarantee,
        paymentMethod,
        notes: `${deliveryType === "delivery" ? "Envío a domicilio: " + address : "Retiro en probador/tienda"}. ${notes}`.trim(),
      });

      if (res.success && res.data) {
        successCount++;
        createdBookings.push(res.data as unknown as RentalContractBooking);
      }
    }

    if (successCount > 0) {
      toast.success(`¡${successCount} contrato(s) de alquiler registrado(s) con éxito!`);
      setCart([]);
      setCheckoutModalOpen(false);
      if (createdBookings.length > 0) {
        setContractBooking(createdBookings[0]);
      }
      loadCatalog();
    } else {
      toast.error("Error al procesar los contratos de alquiler");
    }
    setIsProcessing(false);
  };

  const filteredDresses = dresses.filter((d) => {
    const matchesCat = selectedCategory === "Todos" || d.category === selectedCategory;
    const matchesSize = selectedSize === "Todos" || d.size === selectedSize;
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.color.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSize && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amberGold-100 text-amberGold-800 rounded-md">
              E-Commerce & Alta Costura
            </span>
            <h2 className="text-lg font-bold text-warm-900">Catálogo de Vestidos Carissma</h2>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            Colección de gala, fiesta, quinceañeras y novias con tarifas dinámicas y control de tallas.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={loadCatalog}
            disabled={loading}
            className="p-2 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-xl transition-colors shrink-0"
            title="Recargar catálogo"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white text-xs font-bold rounded-xl shadow-warm transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Nuevo Vestido</span>
          </button>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-warm-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {DRESS_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 min-h-[44px] sm:min-h-[36px] rounded-xl text-xs font-bold whitespace-nowrap transition-all touch-manipulation active:scale-95 ${
                  selectedCategory === cat
                    ? "bg-amberGold-600 text-white shadow-warm"
                    : "bg-warm-100 text-warm-700 hover:bg-warm-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 text-warm-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar vestido, marca, color..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
            />
          </div>
        </div>

        {/* Size Filters */}
        <div className="flex items-center gap-2 pt-2 border-t border-warm-100 text-xs overflow-x-auto pb-1">
          <span className="font-bold text-warm-600 flex items-center gap-1 whitespace-nowrap">
            <Tag className="h-3.5 w-3.5 text-amberGold-600" /> Talla:
          </span>
          {SIZES.map((sz) => (
            <button
              key={sz}
              onClick={() => setSelectedSize(sz)}
              className={`px-3.5 py-2 min-h-[44px] sm:min-h-[36px] min-w-[44px] rounded-xl text-xs font-bold transition-colors touch-manipulation active:scale-95 ${
                selectedSize === sz
                  ? "bg-amberGold-100 text-amberGold-900 border border-amberGold-300 font-extrabold shadow-sm"
                  : "bg-warm-50 text-warm-600 hover:bg-warm-100"
              }`}
            >
              {sz}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Dresses */}
      {loading ? (
        <div className="p-12 text-center text-warm-400 bg-white rounded-2xl border border-warm-200">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-amberGold-600" />
          <p className="text-xs font-bold">Cargando catálogo de Carissma...</p>
        </div>
      ) : filteredDresses.length === 0 ? (
        <div className="p-12 text-center text-warm-400 bg-white rounded-2xl border border-dashed border-warm-200 space-y-2">
          <Shirt className="h-8 w-8 mx-auto text-warm-300" />
          <p className="text-xs font-bold text-warm-700">No se encontraron vestidos con estos filtros.</p>
          <button
            onClick={() => {
              setSelectedCategory("Todos");
              setSelectedSize("Todos");
              setSearchQuery("");
            }}
            className="px-3 py-1 bg-amberGold-100 text-amberGold-800 rounded-lg text-xs font-bold"
          >
            Limpiar Filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredDresses.map((dress) => (
            <div
              key={dress.id}
              className="bg-white rounded-2xl border border-warm-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow group"
            >
              <div>
                {/* Image Frame */}
                <div className="relative h-56 bg-warm-100 overflow-hidden flex items-center justify-center">
                  {dress.imageUrl ? (
                    <img
                      src={dress.imageUrl}
                      alt={dress.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Shirt className="h-12 w-12 text-warm-300 mx-auto mb-1" />
                      <span className="text-[10px] text-warm-400 font-bold uppercase tracking-wider">
                        {dress.brand}
                      </span>
                    </div>
                  )}
                  {/* Category & Status Badges */}
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                    <span className="px-2 py-0.5 bg-amberGold-600/90 backdrop-blur-sm text-white text-[10px] font-bold rounded-md shadow-sm">
                      {dress.category || "Gala"}
                    </span>
                    <span className="px-2 py-0.5 bg-warm-900/80 backdrop-blur-sm text-white text-[10px] font-bold rounded-md shadow-sm">
                      Talla {dress.size}
                    </span>
                  </div>

                  <span
                    className={`absolute top-2.5 right-2.5 px-2 py-0.5 text-[10px] font-bold rounded-md shadow-sm ${
                      dress.status === "Disponible"
                        ? "bg-emerald-600 text-white"
                        : dress.status === "Reservado"
                        ? "bg-amber-500 text-white"
                        : dress.status === "En Uso"
                        ? "bg-purple-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {dress.status}
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-4 space-y-2">
                  <div>
                    <h3 className="font-bold text-sm text-warm-900 line-clamp-1">{dress.name}</h3>
                    <p className="text-[11px] text-warm-500">Marca: <strong>{dress.brand}</strong> • Color: <strong>{dress.color}</strong></p>
                  </div>

                  <div className="p-2 bg-warm-50 rounded-xl text-xs space-y-1 border border-warm-100">
                    <div className="flex justify-between items-center">
                      <span className="text-warm-500 text-[11px]">Tarifa Renta:</span>
                      <span className="font-bold text-amberGold-800 text-sm">
                        {formatCurrency(dress.baseRentalPrice || 450)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-warm-500">
                      <span>Garantía en Custodia:</span>
                      <span className="font-bold text-emerald-700">{formatCurrency(dress.requiredGuarantee || 500)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-warm-400">
                      <span>Historial de Usos:</span>
                      <span className="font-semibold text-warm-700">{dress.timesUsed || 0} alquileres</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="p-4 pt-0 flex items-center gap-1.5 border-t border-warm-100 mt-2">
                <button
                  onClick={() => {
                    setEditingDress(dress);
                    setIsEditModalOpen(true);
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-xl transition-colors touch-manipulation active:scale-95"
                  title="Editar prenda"
                  aria-label="Editar prenda"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteDress(dress.id, dress.name)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 bg-warm-100 hover:bg-rose-100 text-warm-500 hover:text-rose-700 rounded-xl transition-colors touch-manipulation active:scale-95"
                  title="Eliminar prenda"
                  aria-label="Eliminar prenda"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => addToCart(dress)}
                  disabled={dress.status !== "Disponible"}
                  className="flex-1 min-h-[44px] py-2 px-3 bg-amberGold-600 hover:bg-amberGold-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center justify-center gap-1.5 touch-manipulation active:scale-98"
                >
                  <ShoppingCart className="h-4 w-4" />
                  <span>Alquilar</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Cart Drawer Bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 max-w-lg sm:w-auto z-40 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border border-amberGold-300 shadow-2xl flex items-center gap-3 sm:gap-4 animate-in slide-in-from-bottom duration-200">
          <div className="p-2.5 bg-amberGold-600 text-white rounded-2xl shadow-warm shrink-0">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs text-warm-900 truncate">
              {cart.length} prenda(s) seleccionada(s)
            </p>
            <p className="text-[11px] text-warm-500 truncate">
              Renta: <strong className="text-amberGold-800">{formatCurrency(totalRentalPrice)}</strong> + Garantía:{" "}
              <strong className="text-emerald-700">{formatCurrency(totalGuarantee)}</strong>
            </p>
          </div>
          <button
            onClick={() => setCheckoutModalOpen(true)}
            className="min-h-[44px] px-4 py-2.5 bg-amberGold-600 hover:bg-amberGold-700 active:bg-amberGold-800 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5 transition-all shrink-0 touch-manipulation active:scale-98"
          >
            <span>Generar Contrato</span>
            <Check className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[85dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <div>
                <h3 className="font-bold text-base text-warm-900">Formalizar Contrato de Alquiler</h3>
                <p className="text-xs text-warm-500">{cart.length} prenda(s) en orden</p>
              </div>
              <button onClick={() => setCheckoutModalOpen(false)} aria-label="Cerrar modal" className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl text-warm-400 hover:text-warm-800 touch-manipulation">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCheckout} className="space-y-4 text-xs">
              {/* Selected items overview */}
              <div className="p-3 bg-warm-50 rounded-2xl space-y-1.5 border border-warm-100 max-h-36 overflow-y-auto">
                {cart.map((c) => (
                  <div key={c.dress.id} className="flex justify-between items-center text-warm-800">
                    <span className="font-medium truncate">{c.dress.name} (Talla {c.dress.size})</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amberGold-800">{formatCurrency(c.dress.baseRentalPrice)}</span>
                      <button
                        type="button"
                        onClick={() => removeFromCart(c.dress.id)}
                        className="text-rose-600 hover:text-rose-800 p-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
                        aria-label="Quitar de orden"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Nombre de la Clienta *</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="ej: Valeria Suárez"
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none focus:border-amberGold-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Teléfono / WhatsApp</label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+591 76543210"
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium text-base sm:text-xs md:text-sm text-warm-900 focus:outline-none focus:border-amberGold-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Fecha de Retiro *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium text-base sm:text-xs md:text-sm text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Fecha Pactada de Retorno *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium text-base sm:text-xs md:text-sm text-warm-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Modalidad de Entrega</label>
                  <select
                    value={deliveryType}
                    onChange={(e) => setDeliveryType(e.target.value as "store" | "delivery")}
                    className="w-full min-h-[44px] sm:min-h-[38px] p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900"
                  >
                    <option value="store">Retiro en Probador / Tienda</option>
                    <option value="delivery">Envío a Domicilio</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Método de Pago *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "Efectivo" | "QR" | "Tarjeta")}
                    className="w-full min-h-[44px] sm:min-h-[38px] p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="QR">QR</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>

              {deliveryType === "delivery" && (
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Dirección de Envío</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, Edificio, Zona..."
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-base sm:text-xs md:text-sm text-warm-900"
                  />
                </div>
              )}

              <div className="p-3 bg-amberGold-50 rounded-2xl space-y-1 border border-amberGold-200">
                <div className="flex justify-between font-bold text-warm-900">
                  <span>Total Renta:</span>
                  <span className="text-amberGold-800">{formatCurrency(totalRentalPrice)}</span>
                </div>
                <div className="flex justify-between text-warm-700">
                  <span>Garantía Requerida en Custodia:</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(totalGuarantee)}</span>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
                  className="min-h-[44px] px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold transition-colors touch-manipulation active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="min-h-[44px] px-5 py-2 bg-amberGold-600 hover:bg-amberGold-700 active:bg-amberGold-800 text-white rounded-xl font-bold shadow-warm flex items-center gap-1.5 transition-colors disabled:opacity-50 touch-manipulation active:scale-98"
                >
                  <Check className="h-4 w-4" />
                  {isProcessing ? "Procesando..." : "Confirmar y Generar Contrato"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Dress Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Añadir Nuevo Vestido a Carissma</h3>
              <button onClick={() => setIsNewModalOpen(false)} aria-label="Cerrar modal">
                <X className="h-5 w-5 text-warm-400" />
              </button>
            </div>

            <form onSubmit={handleCreateDress} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Nombre del Modelo *</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ej: Vestido Gala Rosa Empolvado"
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Marca / Diseñador *</label>
                  <input
                    type="text"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="ej: Pronovias, Carolina Herrera..."
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Categoría *</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-warm-900"
                  >
                    <option value="Gala">Gala</option>
                    <option value="Novia">Novia</option>
                    <option value="Quinceañera">Quinceañera</option>
                    <option value="Coctel">Coctel</option>
                    <option value="Graduación">Graduación</option>
                    <option value="Fiesta">Fiesta</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Talla *</label>
                  <select
                    value={newSize}
                    onChange={(e) => setNewSize(e.target.value as "XS" | "S" | "M" | "L" | "XL")}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-warm-900 font-bold"
                  >
                    <option value="XS">XS</option>
                    <option value="S">S</option>
                    <option value="M">M</option>
                    <option value="L">L</option>
                    <option value="XL">XL</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Color *</label>
                  <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    placeholder="ej: Esmeralda, Rojo..."
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-warm-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Tarifa Renta (Bs) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newBasePrice}
                    onChange={(e) => setNewBasePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Garantía (Bs) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newGuarantee}
                    onChange={(e) => setNewGuarantee(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono font-bold text-emerald-700"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Costo Compra (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={newAcqCost}
                    onChange={(e) => setNewAcqCost(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono text-warm-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-warm-800">URL Fotografía del Vestido</label>
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-warm-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl font-bold shadow-warm transition-colors"
                >
                  Guardar Vestido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Dress Modal */}
      {isEditModalOpen && editingDress && (
        <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200">
              <h3 className="font-bold text-base text-warm-900">Editar Prenda #{editingDress.id.slice(-6)}</h3>
              <button onClick={() => setIsEditModalOpen(false)} aria-label="Cerrar modal">
                <X className="h-5 w-5 text-warm-400" />
              </button>
            </div>

            <form onSubmit={handleUpdateDress} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Nombre</label>
                  <input
                    type="text"
                    value={editingDress.name}
                    onChange={(e) => setEditingDress({ ...editingDress, name: e.target.value })}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Marca</label>
                  <input
                    type="text"
                    value={editingDress.brand}
                    onChange={(e) => setEditingDress({ ...editingDress, brand: e.target.value })}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-warm-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Tarifa Renta (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingDress.baseRentalPrice}
                    onChange={(e) => setEditingDress({ ...editingDress, baseRentalPrice: Number(e.target.value.replace(/[^0-9.]/g, "")) })}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono font-bold text-warm-900"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-warm-800">Garantía (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editingDress.requiredGuarantee}
                    onChange={(e) => setEditingDress({ ...editingDress, requiredGuarantee: Number(e.target.value.replace(/[^0-9.]/g, "")) })}
                    className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl font-mono font-bold text-emerald-700"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-warm-800">URL Imagen</label>
                <input
                  type="url"
                  value={editingDress.imageUrl || ""}
                  onChange={(e) => setEditingDress({ ...editingDress, imageUrl: e.target.value })}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-warm-900"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-warm-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl font-bold shadow-warm transition-colors"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Printable Letter Size Rental Contract Modal */}
      <RentalContractModal
        isOpen={!!contractBooking}
        booking={contractBooking}
        onClose={() => setContractBooking(null)}
      />
    </div>
  );
}
