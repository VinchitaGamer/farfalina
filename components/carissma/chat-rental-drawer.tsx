"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Shirt,
  User,
  Check
} from "lucide-react";
import { getDressesAction, getCarissmaConfigAction, createRentalBookingAction } from "@/app/actions/carissma";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface DressItem {
  id: string;
  name: string;
  brand: string;
  size: string;
  category?: string | null;
  imageUrl?: string | null;
  baseRentalPrice: number;
  requiredGuarantee: number;
  timesUsed: number;
  status: string;
  color: string;
}

interface ChatRentalDrawerProps {
  isOpen: boolean;
  threadId?: string;
  clientName: string;
  clientPhone?: string;
  channel?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ChatRentalDrawer({
  isOpen,
  threadId,
  clientName: rawClientName,
  clientPhone: rawClientPhone = "",
  channel = "WhatsApp",
  onClose,
  onSuccess,
}: ChatRentalDrawerProps) {
  const [dresses, setDresses] = useState<DressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [sizeFilter, setSizeFilter] = useState("Todos");

  // Booking fields
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [selectedDress, setSelectedDress] = useState<DressItem | null>(null);

  // Config
  const [decayRate, setDecayRate] = useState(5.0);
  const [minFloorPercent, setMinFloorPercent] = useState(40.0);
  const [defaultGuaranteePercent, setDefaultGuaranteePercent] = useState(30.0);
  const [defaultRentalDays, setDefaultRentalDays] = useState(3);

  // Form values
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [customPrice, setCustomPrice] = useState<number | string>("");
  const [customGuarantee, setCustomGuarantee] = useState<number | string>("");
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      // Clean phone and name
      let cleanName = (rawClientName || "").replace(/\s*\([\+\d\s-]+\)$/, "").trim();
      let cleanPhone = (rawClientPhone || "").replace(/@.+/, "").trim();
      setClientName(cleanName || "Clienta Mostrador");
      setClientPhone(cleanPhone || "");

      loadData();
    }
  }, [isOpen, rawClientName, rawClientPhone]);

  const loadData = async () => {
    setLoading(true);
    const [dressesRes, configRes] = await Promise.all([
      getDressesAction(),
      getCarissmaConfigAction(),
    ]);

    if (dressesRes.success && Array.isArray(dressesRes.data)) {
      setDresses(dressesRes.data as DressItem[]);
    }
    if (configRes.success && configRes.data) {
      const c = configRes.data as {
        decayRatePerUsage?: number;
        minPriceFloorPercent?: number;
        defaultGuaranteePercent?: number;
        defaultRentalDays?: number;
      };
      setDecayRate(c.decayRatePerUsage ?? 5.0);
      setMinFloorPercent(c.minPriceFloorPercent ?? 40.0);
      setDefaultGuaranteePercent(c.defaultGuaranteePercent ?? 30.0);
      setDefaultRentalDays(c.defaultRentalDays ?? 3);

      const calculatedEnd = new Date(Date.now() + (c.defaultRentalDays ?? 3) * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      setEndDate(calculatedEnd);
    }
    setLoading(false);
  };

  const handleSelectDress = (dress: DressItem) => {
    setSelectedDress(dress);

    // Calculate dynamic pricing
    const base = dress.baseRentalPrice || 450;
    const maxDiscount = (100 - minFloorPercent) / 100;
    const depreciation = Math.min(maxDiscount, ((dress.timesUsed || 0) * decayRate) / 100);
    const suggestedPrice = Math.round(Math.max(base * (minFloorPercent / 100), base * (1 - depreciation)));
    const suggestedGuarantee = Math.round(dress.requiredGuarantee || (base * defaultGuaranteePercent) / 100);

    setCustomPrice(suggestedPrice);
    setCustomGuarantee(suggestedGuarantee);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDress) {
      toast.error("Por favor selecciona un vestido disponible");
      return;
    }
    if (!clientName.trim()) {
      toast.error("El nombre de la clienta es requerido");
      return;
    }

    setSubmitting(true);
    const res = await createRentalBookingAction({
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || undefined,
      dressId: selectedDress.id,
      rentalStartDate: startDate,
      rentalEndDate: endDate,
      rentalPrice: Number(customPrice),
      guaranteeAmount: Number(customGuarantee),
      paymentMethod,
      notes: notes.trim() || undefined,
    });

    if (res.success && res.data) {
      const booking = res.data as { contractNumber: string };
      toast.success("¡Reserva y Contrato de Alquiler registrado exitosamente!");

      // Copy WhatsApp confirmation template to clipboard
      const confirmText = `👗 *Confirmación de Reserva — Carissma Alquileres*\n\n¡Hola ${clientName}! Tu reserva ha sido confirmada con éxito:\n\n📜 *Contrato:* ${booking.contractNumber}\n✨ *Prenda:* ${selectedDress.name} (${selectedDress.brand})\n📏 *Talla / Color:* ${selectedDress.size} • ${selectedDress.color}\n📅 *Fecha Retiro:* ${new Date(startDate).toLocaleDateString()}\n📅 *Fecha Devolución:* ${new Date(endDate).toLocaleDateString()}\n\n💰 *Tarifa de Renta:* ${formatCurrency(Number(customPrice))}\n🛡️ *Garantía en Custodia:* ${formatCurrency(Number(customGuarantee))}\n💳 *Método de Pago:* ${paymentMethod}\n\n*Nota:* La garantía se devuelve íntegramente al retornar la prenda en buen estado. ¡Gracias por tu preferencia!`;

      if (navigator.clipboard) {
        navigator.clipboard.writeText(confirmText).catch(() => {});
        toast.info("📋 Mensaje de confirmación copiado al portapapeles listo para enviar.");
      }

      onSuccess();
      onClose();
    } else {
      toast.error(res.error || "Error al generar la reserva");
    }
    setSubmitting(false);
  };

  if (!isOpen) return null;

  const availableDresses = dresses.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.color.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "Todos" || d.category === categoryFilter;
    const matchesSize = sizeFilter === "Todos" || d.size === sizeFilter;
    return matchesSearch && matchesCategory && matchesSize && d.status === "Disponible";
  });

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-warm-900/40 backdrop-blur-sm flex justify-end">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between border-l border-warm-200 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-warm-200 flex items-center justify-between bg-gradient-to-r from-amberGold-50 to-warm-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amberGold-600 text-white rounded-xl shadow-warm">
              <Shirt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-warm-900">Reservar Vestido (Carissma)</h2>
              <p className="text-xs text-warm-500">
                Alquiler directo desde conversación de {channel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-warm-400 hover:text-warm-800 rounded-xl hover:bg-warm-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Client Details */}
          <div className="p-3.5 bg-warm-50 rounded-2xl border border-warm-200 space-y-2.5">
            <p className="font-bold text-warm-800 flex items-center gap-1.5">
              <User className="h-4 w-4 text-amberGold-600" />
              Datos de la Clienta
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-warm-600">Nombre</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full p-2 bg-white border border-warm-200 rounded-lg font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-warm-600">Teléfono</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full p-2 bg-white border border-warm-200 rounded-lg font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
                />
              </div>
            </div>
          </div>

          {/* Dress Selection Catalog */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-warm-800 flex items-center gap-1.5">
                <Shirt className="h-4 w-4 text-amberGold-600" />
                Seleccionar Prenda Disponible
              </label>
              <span className="text-[10px] font-bold text-amberGold-700 bg-amberGold-50 px-2 py-0.5 rounded-full border border-amberGold-200">
                {availableDresses.length} Disponibles
              </span>
            </div>

            {/* Quick Filters */}
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Buscar modelo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="p-1.5 bg-warm-50 border border-warm-200 rounded-lg text-[11px] focus:outline-none focus:border-amberGold-500 col-span-1"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="p-1.5 bg-warm-50 border border-warm-200 rounded-lg text-[11px] font-medium text-warm-800"
              >
                <option value="Todos">Categoría</option>
                <option value="Gala">Gala</option>
                <option value="Novia">Novia</option>
                <option value="Quinceañera">Quinceañera</option>
                <option value="Coctel">Coctel</option>
              </select>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
                className="p-1.5 bg-warm-50 border border-warm-200 rounded-lg text-[11px] font-medium text-warm-800"
              >
                <option value="Todos">Talla</option>
                <option value="XS">XS</option>
                <option value="S">S</option>
                <option value="M">M</option>
                <option value="L">L</option>
                <option value="XL">XL</option>
              </select>
            </div>

            {/* Dress Cards Mini Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-warm-50/50 rounded-xl border border-warm-200">
              {loading ? (
                <div className="col-span-2 p-6 text-center text-warm-400">Cargando vestidos...</div>
              ) : availableDresses.length === 0 ? (
                <div className="col-span-2 p-6 text-center text-warm-400">No hay prendas disponibles con este filtro.</div>
              ) : (
                availableDresses.map((d) => {
                  const isSelected = selectedDress?.id === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectDress(d)}
                      className={`p-2.5 rounded-xl text-left border transition-all ${
                        isSelected
                          ? "bg-amberGold-50 border-amberGold-500 ring-2 ring-amberGold-200 shadow-sm"
                          : "bg-white border-warm-200 hover:border-amberGold-300"
                      }`}
                    >
                      <p className="font-bold text-warm-900 line-clamp-1">{d.name}</p>
                      <p className="text-[10px] text-warm-500">Talla {d.size} • {d.color}</p>
                      <div className="flex justify-between items-center mt-1 pt-1 border-t border-warm-100">
                        <span className="font-bold text-amberGold-800">{formatCurrency(d.baseRentalPrice || 450)}</span>
                        <span className="text-[9px] text-warm-400">{d.timesUsed} usos</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Dates & Pricing Section */}
          {selectedDress && (
            <div className="p-3.5 bg-amberGold-50/40 rounded-2xl border border-amberGold-200/60 space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-amberGold-200/50">
                <span className="font-bold text-amberGold-900">Prenda: {selectedDress.name}</span>
                <span className="text-[10px] font-bold bg-amberGold-100 text-amberGold-800 px-2 py-0.5 rounded">
                  Talla {selectedDress.size}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-warm-700">Fecha de Retiro</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-warm-700">Fecha Devolución</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-warm-700">Tarifa Renta (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customPrice}
                    onChange={(e) => setCustomPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-bold text-warm-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-warm-700">Garantía (Bs)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={customGuarantee}
                    onChange={(e) => setCustomGuarantee(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-bold text-emerald-700 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-warm-700">Método Pago</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as "Efectivo" | "QR" | "Tarjeta")}
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="QR">QR</option>
                    <option value="Tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-warm-700">Notas / Modistería</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles sobre pruebas, bastas, etc."
                  className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-warm-200 bg-white flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-warm-100 hover:bg-warm-200 text-warm-800 font-bold rounded-xl text-xs transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCreateBooking}
            disabled={submitting || !selectedDress}
            className="flex-1 py-2.5 px-4 bg-amberGold-600 hover:bg-amberGold-700 text-white font-bold rounded-xl text-xs shadow-warm flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {submitting ? "Generando Contrato..." : "Confirmar Reserva & Copiar WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
