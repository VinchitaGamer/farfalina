"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Award,
  Gift,
  Target,
  Loader2,
  Sparkles
} from "lucide-react";
import { updateLoyaltyConfigAction, LoyaltyConfigInput } from "@/app/actions/crm";
import { toast } from "@/components/ui/toast";

interface LoyaltyConfigData {
  targetCount: number;
  rewardText: string;
  minSpent?: number;
}

interface LoyaltyConfigModalProps {
  isOpen: boolean;
  currentConfig: LoyaltyConfigData | null;
  onClose: () => void;
  onSuccess: (updated: LoyaltyConfigData) => void;
}

export default function LoyaltyConfigModal({
  isOpen,
  currentConfig,
  onClose,
  onSuccess,
}: LoyaltyConfigModalProps) {
  const [targetCount, setTargetCount] = useState<number | string>(5);
  const [rewardText, setRewardText] = useState("1 Ramo Gratis");
  const [minSpent, setMinSpent] = useState<number | string>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentConfig) {
      setTargetCount(currentConfig.targetCount || 5);
      setRewardText(currentConfig.rewardText || "1 Ramo Gratis");
      setMinSpent(currentConfig.minSpent || 0);
    }
  }, [currentConfig, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const countNum = Number(targetCount);
    if (!countNum || countNum < 1) {
      toast.error("La meta debe ser de al menos 1 compra");
      return;
    }
    if (!rewardText.trim()) {
      toast.error("Indica el beneficio o premio de fidelización");
      return;
    }

    setLoading(true);
    const payload: LoyaltyConfigInput = {
      targetCount: countNum,
      rewardText: rewardText.trim(),
      minSpent: Number(minSpent) || 0,
    };

    const res = await updateLoyaltyConfigAction(payload);
    setLoading(false);

    if (res.success && res.data) {
      toast.success("Meta del programa de fidelización actualizada con éxito");
      onSuccess(res.data as LoyaltyConfigData);
      onClose();
    } else {
      toast.error(res.error || "Error al actualizar configuración");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-warm-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl border border-warm-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-amberGold-50 to-warm-50 border-b border-warm-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amberGold-500 text-white rounded-xl shadow-sm">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-warm-900">Programa de Fidelización</h3>
              <p className="text-xs text-warm-500">Configura la meta de compras y beneficios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-warm-200 text-warm-500 rounded-xl transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-warm-800 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-terracotta-600" />
              <span>Meta de Compras Requerida</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={targetCount}
                onChange={(e) => setTargetCount(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="5"
                className="w-24 px-3.5 py-2.5 bg-white border border-warm-300 rounded-xl text-sm font-bold text-warm-900 focus:outline-none focus:border-terracotta-500 font-mono"
                required
              />
              <span className="text-xs text-warm-600 font-medium">
                compras registradas a nombre del cliente
              </span>
            </div>
            <p className="text-[11px] text-warm-400">
              Ejemplo: Al llegar a 5 compras registradas, se activará la recompensa para el cliente.
            </p>
          </div>


          <div className="space-y-1.5">
            <label className="text-xs font-bold text-warm-800 flex items-center gap-1.5">
              <Gift className="h-4 w-4 text-amberGold-600" />
              <span>Premio / Beneficio al Alcanzar la Meta</span>
            </label>
            <input
              type="text"
              value={rewardText}
              onChange={(e) => setRewardText(e.target.value)}
              placeholder="Ej: 1 Ramo Gratis / 15% Descuento en Próxima Compra"
              className="w-full px-3.5 py-2.5 bg-white border border-warm-300 rounded-xl text-sm text-warm-900 focus:outline-none focus:border-terracotta-500 font-semibold"
              required
            />
          </div>

          <div className="p-3.5 bg-amberGold-50/70 border border-amberGold-200 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amberGold-900">
              <Sparkles className="h-4 w-4 text-amberGold-600 shrink-0" />
              <span>¿Cómo funciona en el sistema?</span>
            </div>
            <p className="text-[11px] text-amberGold-800 leading-relaxed">
              Cada vez que se registre una venta en el POS o un pedido con el número del cliente, el contador sumará automáticamente. En el directorio verás una alerta destacada en los clientes que ya llegaron a la meta para que les entregues su premio.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-bold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-terracotta-500 hover:bg-terracotta-600 text-white rounded-xl text-xs font-bold transition-all shadow-warm flex items-center gap-2 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>Guardar Meta</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
