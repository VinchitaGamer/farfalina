"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Printer,
  Store
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface POSTicketItemData {
  itemName: string;
  price: number;
  quantity: number;
}

export interface POSTicketData {
  ticketNumber: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount: number;
  discountAmount?: number;
  paymentMethod: string;
  createdAt: string | Date;
  items: POSTicketItemData[];
}

interface POSTicketModalProps {
  isOpen: boolean;
  ticket: POSTicketData | null;
  onClose: () => void;
}

export default function POSTicketModal({ isOpen, ticket, onClose }: POSTicketModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !ticket || !mounted) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(ticket.createdAt).toLocaleString("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return createPortal(
    <div id="printable-modal-portal">
      <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static" role="dialog" aria-modal="true">
        <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200 print:border-none print:shadow-none print:p-0 print:max-w-none">
          {/* Printable Ticket Area */}
          <div id="printable-ticket" className="space-y-4 text-center max-w-xs mx-auto">
            <div className="flex flex-col items-center justify-center space-y-1">
              <div className="h-10 w-10 rounded-full bg-terracotta-100 text-terracotta-700 flex items-center justify-center font-bold print:hidden">
                <Store className="h-5 w-5 text-terracotta-700" />
              </div>
              <h2 className="font-bold text-base text-warm-900 tracking-tight">FLORERÍA FARFALINA</h2>
              <p className="text-[11px] text-warm-500">Diseño Floral & Regalos Exclusivos</p>
              <p className="text-[10px] text-warm-400 font-mono">La Paz - Bolivia • NIT: 1029384021</p>
            </div>

            <div className="border-t border-b border-dashed border-warm-300 py-2 space-y-1 text-left text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-warm-500">Ticket #:</span>
                <span className="font-bold text-warm-900">{ticket.ticketNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-500">Fecha:</span>
                <span className="text-warm-800">{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-500">Cliente:</span>
                <span className="font-semibold text-warm-900">{ticket.customerName || "Cliente General"}</span>
              </div>
              {ticket.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-warm-500">Teléfono:</span>
                  <span className="text-warm-800">{ticket.customerPhone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-warm-500">Pago:</span>
                <span className="font-bold text-terracotta-700">{ticket.paymentMethod}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="space-y-2 text-left">
              <div className="grid grid-cols-6 text-[10px] font-bold uppercase text-warm-500 border-b border-warm-200 pb-1">
                <span className="col-span-3">Concepto</span>
                <span className="text-center">Cant</span>
                <span className="col-span-2 text-right">Subtotal</span>
              </div>

              {ticket.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-6 text-xs text-warm-900">
                  <span className="col-span-3 font-medium line-clamp-1">{item.itemName}</span>
                  <span className="text-center font-mono">{item.quantity}</span>
                  <span className="col-span-2 text-right font-bold text-warm-900 font-mono">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-warm-300 pt-2 space-y-1 text-xs">
              {ticket.discountAmount ? (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Descuento Puntos:</span>
                  <span>-{formatCurrency(ticket.discountAmount)}</span>
                </div>
              ) : null}

              <div className="flex justify-between text-sm font-bold text-warm-900 pt-1">
                <span>TOTAL COBRADO:</span>
                <span className="text-terracotta-700 text-base">{formatCurrency(ticket.totalAmount)}</span>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-warm-500 italic space-y-1">
              <p>¡Gracias por elegir Florería Farfalina!</p>
              <p className="font-mono">www.floreriafarfalina.bo</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-warm-200 flex items-center gap-2 print:hidden">
            <button
              onClick={onClose}
              className="flex-1 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-all"
            >
              Cerrar Ticket
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center justify-center gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
