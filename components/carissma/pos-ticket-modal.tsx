"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Printer,
  Shirt,
  FileText
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface CarissmaPOSTicketData {
  contractNumber: string;
  clientName: string;
  clientPhone?: string;
  items: {
    name: string;
    size: string;
    color: string;
    rentalPrice: number;
    guarantee: number;
  }[];
  rentalStartDate: string;
  rentalEndDate: string;
  totalRental: number;
  totalGuarantee: number;
  paymentMethod: string;
  cashGiven?: number;
  change?: number;
  date: string;
  cashierName?: string;
}

interface POSTicketModalProps {
  isOpen: boolean;
  ticketData: CarissmaPOSTicketData | null;
  onClose: () => void;
  onOpenContract?: () => void;
}

export default function POSTicketModal({ isOpen, ticketData, onClose, onOpenContract }: POSTicketModalProps) {
  const [mounted, setMounted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !ticketData || !mounted) return null;

  const handlePrint = () => {
    window.print();
  };

  return createPortal(
    <div id="printable-modal-portal">
      <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static" role="dialog" aria-modal="true">
        <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-sm w-full flex flex-col max-h-[92dvh] overflow-y-auto print:overflow-visible animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:p-0 print:max-w-none">
        {/* Header (No print) */}
        <div className="p-4 border-b border-warm-200 flex items-center justify-between bg-warm-50 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amberGold-600 text-white rounded-xl">
              <Shirt className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-warm-900">Ticket de Alquiler Mostrador</h2>
              <p className="text-[10px] text-warm-500 font-mono">#{ticketData.contractNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenContract && (
              <button
                onClick={onOpenContract}
                className="px-2.5 py-1.5 bg-amberGold-50 hover:bg-amberGold-100 text-amberGold-800 border border-amberGold-200 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-colors"
                title="Ver e imprimir Contrato Carta"
              >
                <FileText className="h-3.5 w-3.5 text-amberGold-600" />
                <span>Contrato</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="p-2 bg-amberGold-600 hover:bg-amberGold-700 text-white rounded-xl shadow-warm transition-all"
              title="Imprimir ticket"
            >
              <Printer className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-warm-400 hover:text-warm-800 rounded-xl hover:bg-warm-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Ticket Receipt */}
        <div ref={printRef} className="p-6 overflow-y-auto space-y-4 text-xs font-mono text-warm-900 bg-white print:p-0">
          <div className="text-center space-y-0.5 border-b border-dashed border-warm-300 pb-3">
            <h1 className="text-base font-extrabold uppercase tracking-wider text-amberGold-900 font-sans">CARISSMA</h1>
            <p className="text-[10px] text-warm-600 font-sans">ALQUILER DE VESTIDOS DE GALA</p>
            <p className="text-[9px] text-warm-400">Comprobante Oficial Mostrador</p>
          </div>

          <div className="space-y-1 text-[11px] border-b border-dashed border-warm-300 pb-2">
            <p><strong>Contrato:</strong> {ticketData.contractNumber}</p>
            <p><strong>Fecha:</strong> {new Date(ticketData.date).toLocaleString()}</p>
            <p><strong>Clienta:</strong> {ticketData.clientName}</p>
            {ticketData.clientPhone && <p><strong>Tel:</strong> {ticketData.clientPhone}</p>}
            <p><strong>Cajero:</strong> {ticketData.cashierName || "Agente Carissma"}</p>
            <p><strong>Retiro:</strong> {ticketData.rentalStartDate}</p>
            <p><strong>Devolución:</strong> {ticketData.rentalEndDate}</p>
          </div>

          {/* Items */}
          <div className="space-y-1.5 border-b border-dashed border-warm-300 pb-2">
            {ticketData.items.map((item, idx) => (
              <div key={idx} className="space-y-0.5">
                <div className="flex justify-between font-bold">
                  <span>{item.name} ({item.size})</span>
                  <span>{formatCurrency(item.rentalPrice)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-emerald-800">
                  <span>Garantía ({item.color})</span>
                  <span>{formatCurrency(item.guarantee)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1 pt-1 text-xs">
            <div className="flex justify-between">
              <span>Total Alquiler:</span>
              <span className="font-bold">{formatCurrency(ticketData.totalRental)}</span>
            </div>
            <div className="flex justify-between text-emerald-800">
              <span>Garantía en Custodia:</span>
              <span className="font-bold">{formatCurrency(ticketData.totalGuarantee)}</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold border-t border-warm-900 pt-1 text-amberGold-900">
              <span>TOTAL PERCIBIDO:</span>
              <span>{formatCurrency(ticketData.totalRental + ticketData.totalGuarantee)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-warm-600 pt-1">
              <span>Método de Pago:</span>
              <span className="font-bold uppercase">{ticketData.paymentMethod}</span>
            </div>
            {ticketData.cashGiven && (
              <>
                <div className="flex justify-between text-[10px] text-warm-600">
                  <span>Efectivo Recibido:</span>
                  <span>{formatCurrency(ticketData.cashGiven)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-warm-600 font-bold">
                  <span>Cambio:</span>
                  <span>{formatCurrency(ticketData.change || 0)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center text-[9px] text-warm-500 pt-3 border-t border-dashed border-warm-300 space-y-1 font-sans">
            <p className="font-bold text-warm-700">POLÍTICA DE GARANTÍA:</p>
            <p>La garantía se devuelve íntegramente contra retorno puntual de la prenda sin rasgaduras o manchas permanentes.</p>
            <p className="font-bold pt-1">¡Gracias por confiar en Carissma!</p>
          </div>
        </div>

        {/* Footer (No print) */}
        <div className="p-3 border-t border-warm-200 bg-warm-50 flex items-center justify-between print:hidden">
          {onOpenContract ? (
            <button
              onClick={onOpenContract}
              className="px-3 py-1.5 bg-amberGold-600 hover:bg-amberGold-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-warm transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Ver Contrato Carta (PDF)</span>
            </button>
          ) : <div />}
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-warm-200 hover:bg-warm-300 text-warm-800 font-bold rounded-xl text-xs transition-colors"
          >
            Cerrar Ticket
          </button>
        </div>
      </div>
    </div>
  </div>,
  document.body
);
}
