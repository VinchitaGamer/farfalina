import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases utilitarias de Tailwind combinando clsx y tailwind-merge.
 * @param inputs - Clases de Tailwind o condiciones
 * @returns Cadena de clases procesadas sin duplicados
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un número como moneda en Bolivianos (Bs).
 * @param amount - Monto numérico
 * @returns Cadena formateada como "1,250 Bs"
 */
export const formatCurrency = (amount: number): string => {
  return `${amount.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Bs`;
};
