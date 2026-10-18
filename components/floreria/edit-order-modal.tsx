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
  Loader2
} from "lucide-react";
import { updateOrderAction, UpdateOrderInput } from "@/app/actions/logistics";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

export interface EditableOrder {
  id: string;
  orderNumber: string;
  clientName: string;
  clientPhone?: string | null;
  recipientName: string;
  address: string;
  zone: string;
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

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: EditableOrder | null;
  onSaved: () => void;
}

const ZONES = [
  "Calacoto, Zona Sur",
  "Achumani, Zona Sur",
  "Obrajes, Zona Sur",
  "San Miguel, Zona Sur",
  "Los Pinos, Zona Sur",
  "Cota Cota, Zona Sur",
  "Irpavi, Zona Sur",
  "Sopocachi",
  "Centro, La Paz",
  "Miraflores",
  "San Pedro",
  "El Alto",
  "Tienda Central (Retiro)"
];

export default function EditOrderModal({
  isOpen,
  onClose,
  order,
  onSaved,
}: EditOrderModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState("Calacoto, Zona Sur");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [arrangementName, setArrangementName] = useState("");
  const [salePrice, setSalePrice] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(15);
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");
  const [status, setStatus] = useState<"En preparación" | "En camino" | "Entregado">("En preparación");
  const [dedicationMessage, setDedicationMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setClientName(order.clientName || "");
      setClientPhone(order.clientPhone || "");
      setRecipientName(order.recipientName || "");
      
      const isPickup = order.address?.includes("Retiro en Tienda") || order.deliveryFee === 0;
      setDeliveryType(isPickup ? "pickup" : "delivery");
      setAddress(order.address || "");
      setZone(order.zone || "Calacoto, Zona Sur");

      // Format deliveryDate to YYYY-MM-DD
      const d = new Date(order.deliveryDate);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setDeliveryDate(`${yyyy}-${mm}-${dd}`);

      setDeliveryTime(order.deliveryTime || "16:30 PM");
      setArrangementName(order.arrangementName || "");
      
      const calculatedSalePrice = order.salePrice || Math.max(0, order.total - (order.deliveryFee || 0));
      setSalePrice(calculatedSalePrice);
      setDeliveryFee(isPickup ? 0 : (order.deliveryFee ?? 15));
      
      setPaymentMethod((order.paymentMethod as "Efectivo" | "QR" | "Tarjeta") || "Efectivo");
      setStatus(order.status || "En preparación");
      setDedicationMessage(order.dedicationMessage || "");
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const total = Number(salePrice || 0) + (deliveryType === "pickup" ? 0 : Number(deliveryFee || 0));

  const handleDeliveryTypeChange = (type: "delivery" | "pickup") => {
    setDeliveryType(type);
    if (type === "pickup") {
      setDeliveryFee(0);
      setZone("Tienda Central (Retiro)");
      if (!address || address.includes("Calacoto") || address.includes("calle")) {
        setAddress("Retiro en Tienda Central / Farfalina");
      }
    } else {
      if (deliveryFee === 0) setDeliveryFee(15);
      if (zone.includes("Retiro")) setZone("Calacoto, Zona Sur");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      toast.error("El nombre del cliente es requerido.");
      return;
    }
    if (!recipientName.trim()) {
      toast.error("El destinatario es requerido.");
      return;
    }
    if (!arrangementName.trim()) {
      toast.error("El nombre del arreglo es requerido.");
      return;
    }
    if (!deliveryDate) {
      toast.error("La fecha de entrega es requerida.");
      return;
    }
    if (!dedicationMessage.trim()) {
      toast.error("El mensaje de dedicatoria es requerido.");
      return;
    }

    setSaving(true);
    const payload: UpdateOrderInput = {
      id: order.id,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim() || null,
      recipientName: recipientName.trim(),
      deliveryType,
      address: deliveryType === "pickup" ? "Retiro en Tienda / Local" : address.trim(),
      zone: deliveryType === "pickup" ? "Tienda Central" : zone,
      deliveryDate,
      deliveryTime: deliveryTime.trim() || "16:30 PM",
      arrangementName: arrangementName.trim(),
      salePrice: Number(salePrice) || 0,
      deliveryFee: deliveryType === "pickup" ? 0 : Number(deliveryFee) || 0,
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
              <p className="text-xs text-warm-500">Modifica los detalles, destinatario o fecha del pedido emitido.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-warm-200/70 text-warm-500 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
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
                  <span>Envío a Domicilio</span>
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
                  <span>Retiro en Tienda</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-bold text-warm-700 block mb-1">Nombre del Cliente:</label>
              <div className="relative">
                <User className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej: Carlos Mendoza"
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-warm-700 block mb-1">Teléfono / WhatsApp:</label>
              <div className="relative">
                <Phone className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="Ej: 77218392"
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-warm-700 block mb-1">Destinatario:</label>
              <div className="relative">
                <User className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Ej: Andrea Quiroga"
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Dirección & Zona */}
          {deliveryType === "delivery" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-warm-700 block mb-1">Zona / Barrio:</label>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full p-2 bg-warm-50/50 border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-medium"
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>{z}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-warm-700 block mb-1">Dirección Exacta:</label>
                <div className="relative">
                  <MapPin className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ej: Calle 15 de Calacoto Nº 450"
                    className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden"
                  />
                </div>
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
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-medium"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-warm-700 block mb-1">Hora Programada:</label>
              <div className="relative">
                <Clock className="h-3.5 w-3.5 text-warm-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  required
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="Ej: 16:30 PM o 11:00 AM"
                  className="w-full pl-8 pr-2.5 py-2 bg-warm-50/50 border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Arreglo, Precios y Método de Pago */}
          <div className="p-3.5 bg-warm-50/60 rounded-2xl border border-warm-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3">
                <label className="font-bold text-warm-700 block mb-1">Nombre / Descripción del Arreglo:</label>
                <input
                  type="text"
                  required
                  value={arrangementName}
                  onChange={(e) => setArrangementName(e.target.value)}
                  placeholder="Ej: Bouquet Especial de Rosas & Lisianthus"
                  className="w-full px-3 py-2 bg-white border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-warm-700 block mb-1">Precio Arreglo (Bs):</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  required
                  value={salePrice}
                  onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-warm-700 block mb-1">Costo Envío (Bs):</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  disabled={deliveryType === "pickup"}
                  value={deliveryType === "pickup" ? 0 : deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-warm-200 rounded-xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-mono font-bold disabled:bg-warm-100 disabled:text-warm-400"
                />
              </div>

              <div>
                <label className="font-bold text-warm-700 block mb-1">Método de Pago:</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as "Efectivo" | "QR" | "Tarjeta")}
                  className="w-full p-2 bg-white border border-warm-200 rounded-xl font-bold text-warm-900 focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden"
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="QR">📱 QR Simple</option>
                  <option value="Tarjeta">💳 Tarjeta Débito/Crédito</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-warm-200 flex items-center justify-between text-sm">
              <span className="font-bold text-warm-800">Total Calculado del Pedido:</span>
              <span className="font-mono font-black text-base text-terracotta-700">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Section 6: Mensaje Dedicatoria */}
          <div>
            <label className="font-bold text-warm-700 block mb-1 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-terracotta-600" />
              <span>Dedicatoria para Tarjeta Impresa:</span>
            </label>
            <textarea
              required
              rows={3}
              value={dedicationMessage}
              onChange={(e) => setDedicationMessage(e.target.value)}
              placeholder="Escribe aquí el mensaje para la tarjeta dedicatoria..."
              className="w-full p-3 bg-warm-50/50 border border-warm-200 rounded-2xl focus:ring-2 focus:ring-terracotta-500 focus:outline-hidden font-serif italic text-xs"
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