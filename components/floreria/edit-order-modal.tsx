"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Truck,
  Store,
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Sparkles,
  Save,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { updateOrderAction, UpdateOrderInput } from "@/app/actions/logistics";
import { formatCurrency } from "@/lib/utils";
import { buildDeliveryWhatsAppMessage } from "@/lib/delivery-whatsapp";
import { toast } from "@/components/ui/toast";

export type EditableOrder = {
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
};

type EditOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  order: EditableOrder | null;
  onSaved: () => void;
};

export default function EditOrderModal({ isOpen, onClose, order, onSaved }: EditOrderModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [arrangementName, setArrangementName] = useState("");
  const [salePrice, setSalePrice] = useState<string>("0");
  const [deliveryFee, setDeliveryFee] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [status, setStatus] = useState<"En preparación" | "En camino" | "Entregado">("En preparación");
  const [dedicationMessage, setDedicationMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  useEffect(() => {
    if (order) {
      setClientName(order.clientName || "");
      setClientPhone(order.clientPhone || "");
      setRecipientName(order.recipientName || "");
      setRecipientPhone(order.recipientPhone || "");

      const isPickup = Boolean(order.address?.includes("Retiro en Tienda"));
      setDeliveryType(isPickup ? "pickup" : "delivery");
      setAddress(order.address || "");
      setZone(isPickup ? "" : order.zone || "");
      setMapsUrl(order.mapsUrl || "");

      const d = new Date(order.deliveryDate);
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      setDeliveryDate(`${yyyy}-${mm}-${dd}`);

      setDeliveryTime(order.deliveryTime || "");
      setArrangementName(order.arrangementName || "");

      const calculatedSalePrice = order.salePrice || Math.max(0, order.total - (order.deliveryFee || 0));
      setSalePrice(String(calculatedSalePrice));
      setDeliveryFee(isPickup ? "0" : String(order.deliveryFee ?? 0));

      setPaymentMethod((order.paymentMethod as "Efectivo" | "QR" | "Tarjeta") || "Efectivo");
      setStatus(order.status || "En preparación");
      setDedicationMessage(order.dedicationMessage || "");
      setCopiedWhatsApp(false);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const numSalePrice = Number(salePrice) || 0;
  const numDeliveryFee = deliveryType === "pickup" ? 0 : Number(deliveryFee) || 0;
  const total = numSalePrice + numDeliveryFee;

  const handleDeliveryTypeChange = (type: "delivery" | "pickup") => {
    setDeliveryType(type);
    if (type === "pickup") {
      setDeliveryFee("0");
    } else if (address.includes("Retiro en Tienda")) {
      setAddress("");
    }
  };

  const handleCopyWhatsApp = async () => {
    const text = buildDeliveryWhatsAppMessage({
      orderNumber: order.orderNumber,
      clientName: clientName || "Cliente Mostrador",
      clientPhone,
      recipientName: recipientName || clientName,
      recipientPhone,
      address: deliveryType === "pickup" ? "Retiro en Tienda / Local" : address,
      zone: deliveryType === "pickup" ? "Tienda Central" : zone,
      mapsUrl: deliveryType === "pickup" ? "" : mapsUrl,
      deliveryDate,
      deliveryTime,
      arrangementName,
      deliveryFee: numDeliveryFee,
      deliveryType,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWhatsApp(true);
      toast.success("Texto de despacho copiado para WhatsApp");
      setTimeout(() => setCopiedWhatsApp(false), 2500);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!arrangementName.trim()) {
      toast.error("El nombre del arreglo es requerido.");
      return;
    }
    if (!deliveryDate) {
      toast.error("La fecha de entrega es requerida.");
      return;
    }

    setSaving(true);
    const payload: UpdateOrderInput = {
      id: order.id,
      clientName: clientName.trim() || "Cliente Mostrador",
      clientPhone: clientPhone.trim() || null,
      recipientName: recipientName.trim() || clientName.trim() || "Cliente Mostrador",
      recipientPhone: recipientPhone.trim() || null,
      deliveryType,
      address:
        deliveryType === "pickup"
          ? "Retiro en Tienda / Local"
          : address.trim() || "Ver ubicación en Google Maps",
      zone: deliveryType === "pickup" ? "Tienda Central" : zone.trim() || "Sin zona especificada",
      mapsUrl: deliveryType === "pickup" ? null : mapsUrl.trim() || null,
      deliveryDate,
      deliveryTime: deliveryTime.trim() || "Por coordinar",
      arrangementName: arrangementName.trim(),
      salePrice: numSalePrice,
      deliveryFee: numDeliveryFee,
      total,
      paymentMethod,
      dedicationMessage: dedicationMessage.trim(),
      status,
    };

    const res = await updateOrderAction(payload);
    setSaving(false);

    if (res.success) {
      toast.success(`Pedido ${order.orderNumber} actualizado correctamente.`);
      onSaved();
      onClose();
    } else {
      toast.error(res.error || "Error al actualizar el pedido.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-2xl w-full max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-warm-200 flex items-center justify-between bg-gradient-to-r from-terracotta-50/50 to-warm-50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-terracotta-100 text-terracotta-700 rounded-xl">
              <Save className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-warm-900">Editar Pedido</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 bg-terracotta-100 text-terracotta-800 rounded-full">
                  {order.orderNumber}
                </span>
              </div>
              <p className="text-xs text-warm-500">Modifica destinatario, teléfono, Maps, delivery, estado o montos.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
            >
              {copiedWhatsApp ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copiedWhatsApp ? "Copiado" : "Copiar Delivery"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-warm-200/70 text-warm-500 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Section 1: Modalidad y Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-warm-50/80 rounded-2xl border border-warm-200">
            <div>
              <label className="font-bold text-warm-700 block mb-1.5">Modalidad de Entrega:</label>
              <div className="grid grid-cols-2 gap-1.5 bg-white p-1 rounded-xl border border-warm-200">
                <button
                  type="button"
                  onClick={() => handleDeliveryTypeChange("delivery")}
                  className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                    deliveryType === "delivery"
                      ? "bg-terracotta-500 text-white shadow-xs"
                      : "text-warm-600 hover:text-warm-900"
                  }`}
                >
                  <Truck className="h-3.5 w-3.5" />
                  <span>Domicilio</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeliveryTypeChange("pickup")}
                  className={`py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1 ${
                    deliveryType === "pickup"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-warm-600 hover:text-warm-900"
                  }`}
                >
                  <Store className="h-3.5 w-3.5" />
                  <span>Retiro Tienda</span>
                </button>
              </div>
            </div>

            <div>
              <label className="font-bold text-warm-700 block mb-1.5">Estado del Pedido:</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "En preparación" | "En camino" | "Entregado")}
                className="w-full p-2 bg-white border border-warm-200 rounded-xl font-bold text-warm-900 focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden"
              >
                <option value="En preparación">⏳ En preparación</option>
                <option value="En camino">🚚 En camino</option>
                <option value="Entregado">✅ Entregado</option>
              </select>
            </div>
          </div>

          {/* Section 2: Cliente & Destinatario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-warm-700 block mb-1">Nombre del Cliente (Opcional):</label>
              <div className="relative">
                <User className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Cliente Mostrador"
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-warm-700 block mb-1">Teléfono del Cliente (Opcional):</label>
              <div className="relative">
                <Phone className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Opcional"
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-warm-700 block mb-1">Destinatario / Quién Recibe:</label>
              <div className="relative">
                <User className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Nombre de quien recibe..."
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl font-medium"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-warm-700 block mb-1">Teléfono del Destinatario (Para Delivery):</label>
              <div className="relative">
                <Phone className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="Celular de quien recibe..."
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Dirección, Maps & Zona */}
          {deliveryType === "delivery" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-warm-700 block mb-1">Dirección Exacta:</label>
                <div className="relative">
                  <MapPin className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, Av., Nro de puerta..."
                    className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-warm-700 block mb-1">URL de Google Maps:</label>
                <input
                  type="url"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full px-3 py-2 bg-warm-50/50 border border-warm-200 rounded-xl font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-warm-700 block mb-1">Zona / Barrio (Opcional):</label>
                <input
                  type="text"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  placeholder="Ej: Calacoto, Sopocachi, Miraflores..."
                  className="w-full px-3 py-2 bg-warm-50/50 border border-warm-200 rounded-xl font-medium"
                />
              </div>
            </div>
          )}

          {/* Section 4: Fecha & Hora Programada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-warm-700 block mb-1">Fecha de Entrega / Retiro:</label>
              <div className="relative">
                <Calendar className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="date"
                  required
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl font-medium"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-warm-700 block mb-1">Hora Programada (Libre):</label>
              <div className="relative">
                <Clock className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="Ej: 18:30, En la noche 21:00..."
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Arreglo, Precios y Método de Pago */}
          <div className="p-3.5 bg-warm-50/60 rounded-2xl border border-warm-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="font-bold text-warm-700 block mb-1">Nombre / Descripción del Arreglo *:</label>
                <input
                  type="text"
                  required
                  value={arrangementName}
                  onChange={(e) => setArrangementName(e.target.value)}
                  placeholder="Ej: Bouquet Especial de Rosas & Lisianthus"
                  className="w-full px-3 py-2 bg-white border border-warm-200 rounded-xl font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-warm-700 block mb-1">Precio Arreglo (Bs):</label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full px-3 py-2 bg-white border border-warm-200 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-warm-700 block mb-1">Costo Delivery (Bs):</label>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={deliveryType === "pickup"}
                  value={deliveryType === "pickup" ? "0" : deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="w-full px-3 py-2 bg-white border border-warm-200 rounded-xl font-mono font-bold disabled:bg-warm-100 disabled:text-warm-400"
                />
              </div>

              <div>
                <label className="font-bold text-warm-700 block mb-1">Método de Pago:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "Efectivo" | "QR" | "Tarjeta")}
                  className="w-full p-2 bg-white border border-warm-200 rounded-xl font-bold text-warm-900"
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="QR">📱 QR Simple</option>
                  <option value="Tarjeta">💳 Tarjeta Débito/Crédito</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-warm-200 flex items-center justify-between text-sm">
              <span className="font-bold text-warm-800">Total Calculado del Pedido:</span>
              <span className="font-mono font-black text-base text-terracotta-700">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Section 6: Mensaje Dedicatoria (Opcional) */}
          <div>
            <label className="font-bold text-warm-700 block mb-1 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-terracotta-600" />
              <span>Dedicatoria para Tarjeta Impresa (Opcional):</span>
            </label>
            <textarea
              rows={2}
              value={dedicationMessage}
              onChange={(e) => setDedicationMessage(e.target.value)}
              placeholder="Opcional: escribe aquí el mensaje para la tarjeta..."
              className="w-full p-3 bg-warm-50/50 border border-warm-200 rounded-2xl font-serif italic text-xs"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-warm-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
