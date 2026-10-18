"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Shirt,
  Calendar,
  User,
  CheckCircle2,
  FileText,
  DollarSign,
  Trash2
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface RentalContractBooking {
  id: string;
  contractNumber: string;
  clientName: string;
  clientPhone?: string | null;
  clientCI?: string | null;
  dressName: string;
  dressBrand?: string | null;
  dressSize: string;
  dressColor: string;
  dressCategory?: string | null;
  rentalStartDate: string | Date;
  rentalEndDate: string | Date;
  rentalPrice: number;
  guaranteeAmount: number;
  penaltyFee?: number;
  lateFeePerDay?: number;
  paymentMethod: string;
  notes?: string | null;
  createdAt?: string | Date;
}

interface RentalContractModalProps {
  isOpen: boolean;
  booking: RentalContractBooking | null;
  onClose: () => void;
  onDelete?: (booking: { id: string; contractNumber: string; clientName: string; dressName: string }) => void;
}

export default function RentalContractModal({ isOpen, booking, onClose, onDelete }: RentalContractModalProps) {
  const [mounted, setMounted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !booking || !mounted) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedStartDate = new Date(booking.rentalStartDate).toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const formattedEndDate = new Date(booking.rentalEndDate).toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const emissionDate = new Date(booking.createdAt || Date.now()).toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const totalPaid = booking.rentalPrice + booking.guaranteeAmount + (booking.penaltyFee || 0);

  return createPortal(
    <div id="printable-modal-portal">
      <div
        className="fixed inset-0 z-50 bg-warm-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-4xl w-full flex flex-col max-h-[94dvh] overflow-y-auto print:overflow-visible print:max-h-none print:border-none print:shadow-none print:w-full print:rounded-none">
          {/* Header Bar (Hidden in Print) */}
          <div className="p-4 sm:p-5 border-b border-warm-200 flex items-center justify-between bg-warm-50 print:hidden shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amberGold-600 text-white rounded-2xl shadow-warm">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-warm-900">
                  Contrato de Alquiler de Vestido & Acta de Entrega
                </h2>
                <p className="text-xs text-warm-500 font-mono">
                  Folio Oficial: #{booking.contractNumber}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-amberGold-600 hover:bg-amberGold-700 active:bg-amberGold-800 text-white text-xs font-bold rounded-xl shadow-warm transition-all flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                <span>Imprimir / Guardar PDF (1 Página Carta)</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-warm-400 hover:text-warm-800 rounded-xl hover:bg-warm-200 transition-colors"
                aria-label="Cerrar ventana"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Printable Contract Document (Target for Print Engine) */}
          <div
            id="printable-contract-sheet"
            ref={printRef}
            className="p-6 sm:p-8 overflow-y-auto space-y-3.5 text-warm-950 bg-white print:p-0 print:m-0 print:space-y-2.5 print:overflow-hidden text-[10.5px] leading-snug"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {/* Brand Header */}
            <div className="flex justify-between items-start border-b-2 border-amberGold-600 pb-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl sm:text-2xl font-serif font-extrabold tracking-tight text-amberGold-900 uppercase">
                    CARISSMA
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-widest bg-amberGold-100 text-amberGold-800 px-2 py-0.5 rounded">
                    Boutique & Alta Costura
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-warm-700 tracking-wide uppercase">
                  Alquiler de Vestidos Exclusivos & Asesoría de Imagen
                </p>
                <p className="text-[9px] text-warm-500">
                  Av. San Martín #450 • Teléfono / WhatsApp: (+591) 76543210 • Cochabamba, Bolivia
                </p>
              </div>
              <div className="text-right space-y-0.5">
                <span className="font-mono text-xs font-extrabold text-amberGold-900 bg-amberGold-50 px-2.5 py-0.5 rounded-lg border border-amberGold-300 inline-block">
                  CONTRATO N° {booking.contractNumber}
                </span>
                <p className="text-[9px] text-warm-500 block">
                  Fecha de Emisión: <strong>{emissionDate}</strong>
                </p>
                <span className="text-[8.5px] font-bold uppercase px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full inline-block">
                  Documento Legal Vinculante
                </span>
              </div>
            </div>

            {/* Title Banner */}
            <div className="bg-warm-100/80 py-1.5 px-3 rounded-lg border border-warm-200 text-center font-bold text-[10.5px] uppercase tracking-wider text-warm-900">
              Contrato de Arrendamiento Temporal de Vestuario & Acta de Recepción Conforme
            </div>

            {/* Section 1 & 2: Client & Garment Details Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Client Info Card */}
              <div className="p-2.5 bg-warm-50/80 rounded-xl border border-warm-200 space-y-1">
                <p className="font-bold text-[9.5px] uppercase tracking-wider text-amberGold-800 flex items-center gap-1 border-b border-warm-200 pb-0.5">
                  <User className="h-3 w-3" />
                  1. Datos del Cliente (Arrendatario)
                </p>
                <p className="text-[11px] font-extrabold text-warm-900">{booking.clientName}</p>
                <div className="grid grid-cols-2 gap-1 text-[9.5px] text-warm-700">
                  <p>Teléfono: <strong>{booking.clientPhone || "No registrado"}</strong></p>
                  <p>C.I. / DNI: <strong>{booking.clientCI || "Verificado en tienda"}</strong></p>
                </div>
                <p className="text-[8.5px] text-warm-500">
                  Calidad: <em>Cliente Titular y Responsable Solidario</em>
                </p>
              </div>

              {/* Garment Details Card */}
              <div className="p-2.5 bg-warm-50/80 rounded-xl border border-warm-200 space-y-1">
                <p className="font-bold text-[9.5px] uppercase tracking-wider text-amberGold-800 flex items-center gap-1 border-b border-warm-200 pb-0.5">
                  <Shirt className="h-3 w-3" />
                  2. Identificación del Vestuario
                </p>
                <p className="text-[11px] font-extrabold text-warm-900">{booking.dressName}</p>
                <div className="grid grid-cols-3 gap-1 text-[9.5px] text-warm-700">
                  <p>Talla: <strong>{booking.dressSize}</strong></p>
                  <p>Color: <strong>{booking.dressColor}</strong></p>
                  <p>Marca: <strong>{booking.dressBrand || "Carissma Gold"}</strong></p>
                </div>
                <p className="text-[8.5px] text-emerald-700 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Entrega: Limpio, planchado y con accesorios completos.
                </p>
              </div>
            </div>

            {/* Section 3: Rental Timeline */}
            <div className="p-2 bg-amberGold-50/40 rounded-xl border border-amberGold-200 space-y-1">
              <p className="font-bold text-[9px] uppercase tracking-wider text-amberGold-900 flex items-center gap-1">
                <Calendar className="h-3 w-3 text-amberGold-700" />
                3. Cronograma del Servicio & Fechas de Custodia
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-white p-1.5 rounded-lg border border-warm-200">
                  <span className="text-[8.5px] font-bold text-warm-500 uppercase block">Fecha y Hora de Retiro / Entrega:</span>
                  <span className="font-extrabold text-warm-900 capitalize">{formattedStartDate}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-amberGold-300">
                  <span className="text-[8.5px] font-bold text-rose-700 uppercase block">Fecha Límite de Devolución Obligatoria:</span>
                  <span className="font-extrabold text-rose-800 capitalize">{formattedEndDate}</span>
                </div>
              </div>
            </div>

            {/* Section 4: Financial Breakdown Table */}
            <div className="space-y-1">
              <p className="font-bold text-[9px] uppercase tracking-wider text-warm-800 flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-amberGold-700" />
                4. Liquidación Económica y Custodia de Garantía
              </p>
              <div className="border border-warm-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[9.5px]">
                  <thead className="bg-warm-100 text-warm-900 font-bold border-b border-warm-200 text-[8.5px] uppercase">
                    <tr>
                      <th className="p-1.5 pl-2">Concepto</th>
                      <th className="p-1.5">Detalle / Condiciones</th>
                      <th className="p-1.5 pr-2 text-right">Monto (Bs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-warm-100 text-[9.5px]">
                    <tr>
                      <td className="p-1.5 pl-2 font-semibold text-warm-900">Alquiler de Prenda Exclusiva</td>
                      <td className="p-1.5 text-warm-600">Servicio por el período acordado + tintorería estándar incluida</td>
                      <td className="p-1.5 pr-2 text-right font-bold text-warm-900">{formatCurrency(booking.rentalPrice)}</td>
                    </tr>
                    <tr className="bg-emerald-50/40">
                      <td className="p-1.5 pl-2 font-semibold text-emerald-900">Depósito de Garantía (En Custodia)</td>
                      <td className="p-1.5 text-emerald-700 text-[8.5px]">
                        Reembolsable al 100% contra devolución puntual y en óptimo estado
                      </td>
                      <td className="p-1.5 pr-2 text-right font-bold text-emerald-700">{formatCurrency(booking.guaranteeAmount)}</td>
                    </tr>
                    {(booking.penaltyFee ?? 0) > 0 && (
                      <tr className="bg-rose-50/40">
                        <td className="p-1.5 pl-2 font-semibold text-rose-900">Penalización / Daños Aplicados</td>
                        <td className="p-1.5 text-rose-700 text-[8.5px]">Retención acordada</td>
                        <td className="p-1.5 pr-2 text-right font-bold text-rose-700">{formatCurrency(booking.penaltyFee || 0)}</td>
                      </tr>
                    )}
                    <tr className="bg-warm-100 font-bold text-[10px]">
                      <td colSpan={2} className="p-1.5 pl-2 text-right uppercase text-warm-800">
                        Total Percibido en Mostrador (Método: {booking.paymentMethod}):
                      </td>
                      <td className="p-1.5 pr-2 text-right text-amberGold-900 text-[11px] font-extrabold">{formatCurrency(totalPaid)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 5: Legal Clauses and Reception Acceptance */}
            <div className="p-2.5 bg-warm-50/80 rounded-xl border border-warm-200 text-[8.5px] text-warm-800 space-y-1 leading-tight">
              <p className="font-bold text-warm-900 uppercase tracking-wider text-[9px]">
                5. Cláusulas Contractuales & Declaración de Recepción Conforme:
              </p>
              <ol className="list-decimal pl-3.5 space-y-0.5 text-justify">
                <li>
                  <strong>Recepción Conforme:</strong> El/La CLIENTE declara expresamente haber examinado la prenda en mostrador, aceptando que la recibe en perfectas condiciones de planchado, costura, cierres, pedrería y libre de desperfectos o manchas previas.
                </li>
                <li>
                  <strong>Compromiso de Retorno:</strong> El/La CLIENTE se compromete a devolver la prenda el día <strong>{formattedEndDate}</strong>. Cada día de retraso devengará el recargo por mora fijado en política de boutique.
                </li>
                <li>
                  <strong>Prohibición Absoluta de Lavado Casero:</strong> Queda terminantemente prohibido lavar la prenda en casa, aplicar agua, detergentes o planchas calientes. El proceso de higienización en seco es realizado exclusivamente por Carissma.
                </li>
                <li>
                  <strong>Custodia y Reembolso de Garantía:</strong> La garantía de <strong>{formatCurrency(booking.guaranteeAmount)}</strong> será devuelta tras la verificación física de la prenda. En caso de quemaduras, roturas graves o pérdida de accesorios, se retendrá el monto necesario para su reemplazo.
                </li>
              </ol>
            </div>

            {/* Section 6: Official Signatures Box with generous signing area */}
            <div className="grid grid-cols-2 gap-12 pt-16 pb-2 text-center text-[9.5px]">
              <div className="border-t-2 border-warm-800 pt-2 space-y-0.5">
                <p className="font-extrabold text-warm-900 uppercase text-[10px]">{booking.clientName}</p>
                <p className="text-[8.5px] text-warm-600">C.I.: {booking.clientCI || "..........................."}</p>
                <p className="text-[8px] font-bold text-warm-500 uppercase tracking-wider">
                  Firma del Cliente (Recepción Conforme & Aceptación)
                </p>
              </div>

              <div className="border-t-2 border-warm-800 pt-2 space-y-0.5">
                <p className="font-extrabold text-warm-900 uppercase text-[10px]">Carissma Boutique</p>
                <p className="text-[8.5px] text-warm-600">Firma Autorizada / Sello de Entrega</p>
                <p className="text-[8px] font-bold text-warm-500 uppercase tracking-wider">
                  Recepción & Despacho Oficial
                </p>
              </div>
            </div>

            {/* Watermark / Print Footer */}
            <div className="text-center text-[7.5px] text-warm-400 border-t border-warm-200 pt-1">
              Documento generado por el Sistema Enterprise Farfalina & Carissma SaaS • Validez Legal y de Control Interno.
            </div>
          </div>

          {/* Modal Footer (Hidden in print) */}
          <div className="p-3.5 border-t border-warm-200 bg-warm-50 flex items-center justify-between print:hidden shrink-0 flex-wrap gap-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDelete(booking);
                  }}
                  className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 transition-colors flex items-center gap-1.5"
                  title="Eliminar este contrato y liberar prenda"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Eliminar Alquiler</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-warm-200 hover:bg-warm-300 text-warm-800 font-bold rounded-xl text-xs transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
