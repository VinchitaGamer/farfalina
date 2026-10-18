"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  RefreshCw,
  Calculator,
  Save,
  Shirt,
  Settings
} from "lucide-react";
import { getCarissmaConfigAction, updateCarissmaConfigAction, getDressesAction } from "@/app/actions/carissma";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface DressItem {
  id: string;
  name: string;
  brand: string;
  size: string;
  timesUsed: number;
  baseRentalPrice: number;
  requiredGuarantee: number;
}

export default function PricingEngineView() {
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [dresses, setDresses] = useState<DressItem[]>([]);
  const [selectedDressId, setSelectedDressId] = useState<string>("");

  // Simulator fields
  const [basePrice, setBasePrice] = useState<number | string>(450);
  const [usageCount, setUsageCount] = useState<number>(3);

  // Dynamic business rules from DB (no hardcoding)
  const [decayRate, setDecayRate] = useState<number>(5.0);
  const [minFloorPercent, setMinFloorPercent] = useState<number>(40.0);
  const [lateFeePerDay, setLateFeePerDay] = useState<number>(50.0);
  const [defaultRentalDays, setDefaultRentalDays] = useState<number>(3);
  const [defaultGuaranteePercent, setDefaultGuaranteePercent] = useState<number>(30.0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [configRes, dressesRes] = await Promise.all([
      getCarissmaConfigAction(),
      getDressesAction(),
    ]);

    if (configRes.success && configRes.data) {
      const c = configRes.data as {
        decayRatePerUsage?: number;
        minPriceFloorPercent?: number;
        lateFeePerDay?: number;
        defaultRentalDays?: number;
        defaultGuaranteePercent?: number;
      };
      setDecayRate(c.decayRatePerUsage ?? 5.0);
      setMinFloorPercent(c.minPriceFloorPercent ?? 40.0);
      setLateFeePerDay(c.lateFeePerDay ?? 50.0);
      setDefaultRentalDays(c.defaultRentalDays ?? 3);
      setDefaultGuaranteePercent(c.defaultGuaranteePercent ?? 30.0);
    }

    if (dressesRes.success && Array.isArray(dressesRes.data)) {
      setDresses(dressesRes.data as DressItem[]);
      if (dressesRes.data.length > 0) {
        const first = dressesRes.data[0];
        setSelectedDressId(first.id);
        setBasePrice(first.baseRentalPrice || 450);
        setUsageCount(first.timesUsed || 0);
      }
    }
    setLoading(false);
  };

  const handleSelectDress = (dressId: string) => {
    setSelectedDressId(dressId);
    const found = dresses.find((d) => d.id === dressId);
    if (found) {
      setBasePrice(found.baseRentalPrice || 450);
      setUsageCount(found.timesUsed || 0);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    const res = await updateCarissmaConfigAction({
      defaultRentalDays: Number(defaultRentalDays),
      defaultGuaranteePercent: Number(defaultGuaranteePercent),
      decayRatePerUsage: Number(decayRate),
      minPriceFloorPercent: Number(minFloorPercent),
      lateFeePerDay: Number(lateFeePerDay),
    });

    if (res.success) {
      toast.success("¡Parámetros y reglas de negocio actualizados en el sistema!");
    } else {
      toast.error(res.error || "Error al actualizar configuración");
    }
    setSavingConfig(false);
  };

  const numBase = Number(basePrice) || 0;
  const numUsage = Number(usageCount) || 0;

  // Dynamic Depreciation Algorithm:
  // Depreciation = min(1 - FloorPercent/100, (Usages * (DecayRate / 100)))
  // Suggested Price = max(Base * FloorPercent/100, Base * (1 - Depreciation))
  const maxPossibleDiscount = (100 - minFloorPercent) / 100;
  const calculatedDepreciation = Math.min(maxPossibleDiscount, (numUsage * decayRate) / 100);
  const suggestedRentalPrice = Math.max(numBase * (minFloorPercent / 100), numBase * (1 - calculatedDepreciation));
  const suggestedGuarantee = Math.round((numBase * defaultGuaranteePercent) / 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-warm-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-bold bg-amberGold-100 text-amberGold-800 rounded-md">
              Módulo 2
            </span>
            <h2 className="text-lg font-bold text-warm-900">Motor de Precios Dinámicos por Depreciación</h2>
          </div>
          <p className="text-xs text-warm-500 mt-0.5">
            Tarifas decrecientes según el historial de usos y reglas configurables en base de datos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-1.5 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </button>
          <span className="px-3 py-1.5 bg-amberGold-50 text-amberGold-800 border border-amberGold-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-amberGold-600 animate-spin" style={{ animationDuration: "6s" }} />
            Algoritmo Dinámico Activo
          </span>
        </div>
      </div>

      {/* Main Grid: Simulator on the left, Dynamic Settings on the right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interactive Pricing Simulator */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-warm-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-warm-200">
            <div className="flex items-center gap-2 text-warm-900">
              <Calculator className="h-5 w-5 text-amberGold-600" />
              <h3 className="font-bold text-sm">Simulador y Cotizador en Tiempo Real</h3>
            </div>
            <span className="text-xs text-warm-500">Calculado con reglas de Carissma</span>
          </div>

          {/* Quick select from real dresses */}
          {dresses.length > 0 && (
            <div className="space-y-1.5 p-3 bg-amberGold-50/50 rounded-xl border border-amberGold-200/60">
              <label className="text-xs font-bold text-amberGold-900 flex items-center gap-1.5">
                <Shirt className="h-4 w-4 text-amberGold-700" />
                Cargar Prenda desde Inventario Real:
              </label>
              <select
                value={selectedDressId}
                onChange={(e) => handleSelectDress(e.target.value)}
                className="w-full p-2 bg-white border border-amberGold-200 rounded-lg text-xs font-medium text-warm-900 focus:outline-none focus:border-amberGold-500"
              >
                <option value="">-- Personalizado / Manual --</option>
                {dresses.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.brand} - Talla {d.size}) | Usos: {d.timesUsed} | Base: {formatCurrency(d.baseRentalPrice || 450)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Precio Base de Renta Inicial (Bs)</label>
              <input
                type="text"
                inputMode="decimal"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold text-warm-900 font-mono focus:outline-none focus:border-amberGold-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Historial de Usos (Alquileres Previos)</label>
              <input
                type="text"
                inputMode="numeric"
                value={usageCount}
                onChange={(e) => setUsageCount(Number(e.target.value.replace(/[^0-9]/g, "")))}
                placeholder="0"
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold text-warm-900 font-mono focus:outline-none focus:border-amberGold-500"
              />
            </div>
          </div>

          {/* Interactive Usage Slider */}
          <div className="space-y-2 p-4 bg-warm-50 rounded-xl border border-warm-200">
            <div className="flex justify-between text-xs font-semibold text-warm-700">
              <span>Simular Desgaste por Número de Usos:</span>
              <span className="font-bold text-amberGold-800">{usageCount} Usos Previos</span>
            </div>
            <input
              type="range"
              min={0}
              max={25}
              value={usageCount}
              onChange={(e) => setUsageCount(Number(e.target.value))}
              className="w-full accent-amberGold-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-warm-400 font-mono">
              <span>0 (Nuevo / Estreno)</span>
              <span>12 (Uso Medio)</span>
              <span>25 (Alta Rotación)</span>
            </div>
          </div>

          {/* Results Summary Box */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-amberGold-600 via-amberGold-700 to-terracotta-600 text-white shadow-warm space-y-4">
            <div className="flex justify-between items-center text-amberGold-100">
              <span className="text-xs uppercase font-bold tracking-wider">Tarifa de Renta Sugerida</span>
              <span className="text-[11px] bg-white/20 px-2.5 py-0.5 rounded-full font-mono font-bold">
                Depreciación: -{(calculatedDepreciation * 100).toFixed(1)}%
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-extrabold">{formatCurrency(suggestedRentalPrice)}</span>
                <span className="text-xs text-amberGold-200 line-through">Base: {formatCurrency(numBase)}</span>
              </div>
              <div className="text-xs text-amberGold-100 font-medium">
                Garantía Sugerida ({defaultGuaranteePercent}%): <strong className="text-white font-bold">{formatCurrency(suggestedGuarantee)}</strong>
              </div>
            </div>

            <p className="text-xs text-amberGold-50 leading-relaxed border-t border-white/20 pt-3">
              Con <strong>{usageCount} alquileres</strong> registrados a una tasa de amortización de <strong>{decayRate}% por uso</strong>, el vestido se cotiza automáticamente asegurando un piso mínimo garantizado del <strong>{minFloorPercent}%</strong> ({formatCurrency(numBase * (minFloorPercent / 100))}).
            </p>
          </div>
        </div>

        {/* Dynamic Business Rules Editor (Sin variables hardcodeadas) */}
        <div className="bg-white p-6 rounded-2xl border border-warm-200 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-warm-900 pb-3 border-b border-warm-200">
            <Settings className="h-5 w-5 text-amberGold-600" />
            <div>
              <h3 className="font-bold text-sm">Reglas de Negocio Editables</h3>
              <p className="text-[11px] text-warm-500">Parámetros guardados en base de datos</p>
            </div>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Tasa de Descuento por Uso (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="30"
                  value={decayRate}
                  onChange={(e) => setDecayRate(Number(e.target.value))}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold text-warm-900 focus:outline-none focus:border-amberGold-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-warm-400 font-bold">%</span>
              </div>
              <p className="text-[10px] text-warm-500">Porcentaje que se reduce el precio base con cada alquiler.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Piso Mínimo de Renta (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="10"
                  max="90"
                  value={minFloorPercent}
                  onChange={(e) => setMinFloorPercent(Number(e.target.value))}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold text-warm-900 focus:outline-none focus:border-amberGold-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-warm-400 font-bold">%</span>
              </div>
              <p className="text-[10px] text-warm-500">Límite inferior mínimo de precio respecto a la tarifa base.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Garantía Sugerida por Defecto (%)</label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={defaultGuaranteePercent}
                  onChange={(e) => setDefaultGuaranteePercent(Number(e.target.value))}
                  className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold text-warm-900 focus:outline-none focus:border-amberGold-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-warm-400 font-bold">%</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Penalización por Día de Demora (Bs)</label>
              <input
                type="number"
                step="5"
                min="0"
                value={lateFeePerDay}
                onChange={(e) => setLateFeePerDay(Number(e.target.value))}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold text-warm-900 focus:outline-none focus:border-amberGold-500"
              />
              <p className="text-[10px] text-warm-500">Monto diario cobrado por retraso en retorno de prenda.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-warm-700">Días Estándar de Alquiler</label>
              <input
                type="number"
                min="1"
                max="30"
                value={defaultRentalDays}
                onChange={(e) => setDefaultRentalDays(Number(e.target.value))}
                className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-bold text-warm-900 focus:outline-none focus:border-amberGold-500"
              />
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="w-full py-2.5 px-4 bg-amberGold-600 hover:bg-amberGold-700 text-white font-bold text-xs rounded-xl shadow-warm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {savingConfig ? "Guardando..." : "Guardar Políticas en DB"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

