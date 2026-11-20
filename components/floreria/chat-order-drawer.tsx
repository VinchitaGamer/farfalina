"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  Send,
  Receipt,
  User,
  Truck,
  Store,
  MapPin,
  Copy,
  Check,
  Phone,
} from "lucide-react";
import { createUnifiedTicketAction } from "@/app/actions/logistics";
import { formatCurrency } from "@/lib/utils";
import { buildDeliveryWhatsAppMessage } from "@/lib/delivery-whatsapp";
import { toast } from "@/components/ui/toast";

type ChatMessageData = {
  id?: string;
  sender: string;
  text: string;
  createdAt?: string | Date;
};

type ChatOrderDrawerProps = {
  isOpen: boolean;
  threadId?: string;
  clientName: string;
  clientPhone?: string;
  channel?: string;
  messages?: ChatMessageData[];
  onClose: () => void;
  onSuccess: () => void;
};

function parseClientNameAndPhone(rawName: string, rawPhone: string): { cleanName: string; cleanPhone: string } {
  let cleanName = (rawName || "").trim();
  let cleanPhone = (rawPhone || "").trim();

  const parenMatch = cleanName.match(/\(([\+\d\s-]+)\)$/);
  if (parenMatch) {
    const phoneInside = parenMatch[1].trim();
    if (!cleanPhone || cleanPhone.includes("@lid") || cleanPhone.includes("@c.us") || cleanPhone.startsWith("239") || cleanPhone.replace(/\D/g, "").length > 13) {
      cleanPhone = phoneInside;
    }
    cleanName = cleanName.replace(/\s*\([\+\d\s-]+\)$/, "").trim();
  }

  if (cleanPhone.includes("@")) {
    cleanPhone = cleanPhone.split("@")[0].trim();
  }

  return {
    cleanName,
    cleanPhone,
  };
}

export default function ChatOrderDrawer({
  isOpen,
  clientName,
  clientPhone = "",
  onClose,
  onSuccess,
}: ChatOrderDrawerProps) {
  const initialParsed = parseClientNameAndPhone(clientName, clientPhone);

  const [buyerName, setBuyerName] = useState(initialParsed.cleanName);
  const [buyerPhone, setBuyerPhone] = useState(initialParsed.cleanPhone);

  const [recipientName, setRecipientName] = useState(initialParsed.cleanName);
  const [recipientPhone, setRecipientPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("pickup");
  const [address, setAddress] = useState("");
  const [zone, setZone] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [deliveryTime, setDeliveryTime] = useState("");

  const [arrangementName, setArrangementName] = useState("");
  const [dedicationMessage, setDedicationMessage] = useState("");

  const [salePrice, setSalePrice] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<"Efectivo" | "QR" | "Tarjeta">("Efectivo");

  const [loading, setLoading] = useState(false);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const parsed = parseClientNameAndPhone(clientName, clientPhone);
      setBuyerName(parsed.cleanName);
      setBuyerPhone(parsed.cleanPhone);
      setRecipientName(parsed.cleanName);
      setError(null);
      setCopiedWhatsapp(false);
    }
  }, [isOpen, clientName, clientPhone]);

  if (!isOpen) return null;

  const numSalePrice = Number(salePrice) || 0;
  const numDeliveryFee = deliveryType === "pickup" ? 0 : Number(deliveryFee) || 0;
  const grandTotal = numSalePrice + numDeliveryFee;

  const whatsappPreviewText = buildDeliveryWhatsAppMessage({
    clientName: buyerName || "Cliente Mostrador",
    clientPhone: buyerPhone,
    recipientName: recipientName || buyerName || "Cliente Mostrador",
    recipientPhone,
    address: deliveryType === "pickup" ? "Retiro en Tienda / Local" : address,
    zone: deliveryType === "pickup" ? "Tienda Central" : zone,
    mapsUrl: deliveryType === "pickup" ? "" : mapsUrl,
    deliveryDate,
    deliveryTime: deliveryTime || "Por coordinar",
    arrangementName,
    deliveryFee: numDeliveryFee,
    deliveryType,
  });

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappPreviewText);
      setCopiedWhatsapp(true);
      toast.success("Texto de despacho copiado para pegar en WhatsApp");
      setTimeout(() => setCopiedWhatsapp(false), 2500);
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arrangementName.trim()) {
      setError("Por favor ingresa el nombre o descripción del arreglo.");
      return;
    }
    if (numSalePrice <= 0) {
      setError("Ingresa un precio de arreglo mayor a 0 Bs.");
      return;
    }
    if (deliveryType === "delivery" && !address.trim() && !mapsUrl.trim()) {
      setError("Para envío a domicilio, ingresa la dirección exacta o el link de Google Maps.");
      return;
    }

    setLoading(true);
    setError(null);

    const finalAddress =
      deliveryType === "pickup" ? "Retiro en Tienda / Local" : address.trim() || "Ver ubicación en Google Maps";
    const finalZone = deliveryType === "pickup" ? "Tienda Central" : zone.trim() || "Sin zona especificada";

    const res = await createUnifiedTicketAction({
      clientName: buyerName.trim() || "Cliente Mostrador",
      clientPhone: buyerPhone.trim(),
      recipientName: recipientName.trim() || buyerName.trim() || "Cliente Mostrador",
      recipientPhone: recipientPhone.trim() || null,
      deliveryType,
      address: finalAddress,
      zone: finalZone,
      mapsUrl: deliveryType === "pickup" ? null : mapsUrl.trim() || null,
      deliveryDate,
      deliveryTime: deliveryTime.trim() || "Por coordinar",
      arrangementName: arrangementName.trim(),
      salePrice: numSalePrice,
      deliveryFee: numDeliveryFee,
      total: grandTotal,
      paymentMethod,
      dedicationMessage: dedicationMessage.trim(),
      recipeItems: [],
    });

    setLoading(false);

    if (res.success) {
      toast.success("¡Pedido / Ticket Manual registrado exitosamente!");
      setArrangementName("");
      setSalePrice("");
      setDeliveryFee("0");
      setAddress("");
      setMapsUrl("");
      setRecipientPhone("");
      setDedicationMessage("");
      onSuccess();
      onClose();
    } else {
      setError(res.error || "No se pudo generar el pedido.");
      toast.error(res.error || "Error al emitir el pedido.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white w-full max-w-2xl max-h-[92dvh] shadow-2xl rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col border border-warm-200 animate-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-warm-200 bg-warm-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-terracotta-100 text-terracotta-600 rounded-xl">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-warm-900">Emisión de Pedido / Ticket Manual</h3>
              <p className="text-[11px] text-warm-500">
                Registra un arreglo personalizado en Logística, POS y Contabilidad al instante.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-warm-400 hover:text-warm-700 rounded-xl hover:bg-warm-100 transition-colors"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="w-full flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-white">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Section 1: Arreglo y Precio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-warm-50 rounded-2xl border border-warm-200">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[11px] font-bold text-warm-800 block">Nombre / Descripción del Arreglo *</label>
                <input
                  type="text"
                  value={arrangementName}
                  onChange={(e) => setArrangementName(e.target.value)}
                  placeholder="Ej: Ramo personalizado 12 Rosas y Gypsophila"
                  className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-warm-800 block">Precio Arreglo (Bs) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={salePrice}
                  onChange={(e) => setSalePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="Ej: 180"
                  className="w-full p-2 bg-white border border-warm-200 rounded-xl text-xs font-bold font-mono text-warm-900 focus:outline-none focus:border-terracotta-500"
                  required
                />
              </div>
            </div>

            {/* Section 2: Datos del Cliente Comprador (Opcionales) */}
            <div className="p-3.5 bg-warm-50/70 rounded-2xl border border-warm-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-warm-900">
                  <User className="h-4 w-4 text-terracotta-600" />
                  <span>Cliente Comprador (Opcional para ventas rápidas)</span>
                </div>
                <span className="text-[10px] font-bold text-amberGold-800 bg-amberGold-100 px-2 py-0.5 rounded-full">
                  CRM Fidelización
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-warm-700 block">Nombre del Cliente</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Opcional (ej: Cliente Mostrador)"
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900 focus:outline-none focus:border-terracotta-500"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[10px] font-bold text-warm-700 block">Teléfono / WhatsApp del Cliente</label>
                  <input
                    type="text"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="Opcional"
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900 font-mono focus:outline-none focus:border-terracotta-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Logística & Despacho */}
            <div className="p-3.5 bg-warm-50/70 rounded-2xl border border-warm-200 space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-warm-800 block">Modalidad de Despacho</label>
                <div className="grid grid-cols-2 gap-1.5 bg-warm-100 p-1 rounded-xl border border-warm-200">
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryType("pickup");
                      setDeliveryFee("0");
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      deliveryType === "pickup" ? "bg-white text-purple-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
                    }`}
                  >
                    <Store className="h-3.5 w-3.5" />
                    <span>Recoger en Tienda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType("delivery")}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      deliveryType === "delivery" ? "bg-white text-terracotta-700 shadow-sm" : "text-warm-600 hover:text-warm-900"
                    }`}
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Envío a Domicilio</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold text-warm-800 block">Nombre Destinatario / Quién Recoge</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Nombre de quien recibe..."
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold text-warm-800 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-terracotta-600" />
                    <span>Teléfono del Destinatario (Para Taxi/Delivery)</span>
                  </label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="Ej: 77512345"
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-mono font-medium text-warm-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold text-warm-800 block">
                    {deliveryType === "pickup" ? "Fecha de Retiro *" : "Fecha de Entrega *"}
                  </label>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900 font-mono"
                    required
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[11px] font-bold text-warm-800 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-terracotta-600" />
                    <span>Hora de Entrega / Retiro (Libre)</span>
                  </label>
                  <input
                    type="text"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    placeholder="Ej: 18:30, En la noche 21:00..."
                    className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-bold text-warm-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <span className="text-[10px] text-warm-400 font-semibold shrink-0">Rápido:</span>
                {["10:00", "12:00", "15:00", "18:00", "20:00", "21:30"].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDeliveryTime(t)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition-all shrink-0 ${
                      deliveryTime === t
                        ? "bg-terracotta-500 text-white"
                        : "bg-white hover:bg-warm-100 text-warm-700 border border-warm-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {deliveryType === "delivery" && (
                <div className="space-y-2.5 pt-1 border-t border-warm-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold text-warm-800 block">Dirección Exacta de Envío *</label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Calle, Av., Nro de puerta, referencia..."
                        className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold text-warm-800 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-terracotta-600" />
                        <span>URL de Google Maps</span>
                      </label>
                      <input
                        type="url"
                        value={mapsUrl}
                        onChange={(e) => setMapsUrl(e.target.value)}
                        placeholder="https://maps.app.goo.gl/..."
                        className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-mono text-warm-900"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold text-warm-800 block">Zona Delivery (Opcional)</label>
                      <input
                        type="text"
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        placeholder="Ej: Calacoto, Sopocachi, Miraflores..."
                        className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[11px] font-bold text-warm-800 block">Costo Delivery / Yango (Bs)</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder="0"
                        className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-mono font-bold text-warm-900"
                      />
                    </div>
                  </div>

                  {/* 1-click Copy WhatsApp Dispatch Box */}
                  <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-emerald-900">
                        Resumen listo para Central de Móviles / WhatsApp
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyWhatsApp}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1"
                      >
                        {copiedWhatsapp ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedWhatsapp ? "Copiado" : "Copiar para Delivery"}</span>
                      </button>
                    </div>
                    <pre className="text-[10px] text-emerald-950 whitespace-pre-wrap font-sans bg-white/80 p-2 rounded-lg border border-emerald-100 max-h-24 overflow-y-auto">
                      {whatsappPreviewText}
                    </pre>
                  </div>
                </div>
              )}

              <div className="space-y-0.5">
                <label className="text-[11px] font-bold text-warm-700 block">
                  Mensaje Dedicatoria para Tarjeta (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={dedicationMessage}
                  onChange={(e) => setDedicationMessage(e.target.value)}
                  placeholder="Opcional: escribe la dedicatoria si lleva tarjeta..."
                  className="w-full p-2 bg-white border border-warm-200 rounded-lg text-xs font-medium text-warm-900"
                />
              </div>
            </div>

            {/* Section 4: Payment & Total */}
            <div className="p-3.5 bg-warm-50 rounded-2xl border border-warm-200 space-y-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-warm-800 block">Método de Pago</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["Efectivo", "QR", "Tarjeta"] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setPaymentMethod(m)}
                      className={`py-1.5 text-xs font-bold rounded-xl border transition-all ${
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

              <div className="pt-2 border-t border-warm-200 flex justify-between items-center text-sm font-bold text-warm-900">
                <span>TOTAL A COBRAR:</span>
                <span className="text-terracotta-700 font-mono text-base">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-warm-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold shadow-warm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                {loading ? "Guardando..." : "Emitir Pedido / Ticket"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
