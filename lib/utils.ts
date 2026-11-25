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
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${safeAmount.toLocaleString("es-BO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Bs`;
};

export const BOLIVIA_TIMEZONE = "America/La_Paz";

/**
 * Obtiene la fecha calendario actual (o de un Date dado) en zona horaria de Bolivia (UTC-4) como YYYY-MM-DD.
 * Evita el desfase a "mañana" que ocurre después de las 20:00 con toISOString().
 */
export function getBoliviaDateStr(date: Date = new Date()): string {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOLIVIA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(safeDate);
}

/**
 * Convierte una cadena YYYY-MM-DD (o Date) a mediodía UTC (12:00:00.000Z = 08:00 AM Bolivia),
 * garantizando que el día calendario jamás retroceda ni avance un día entre UTC y America/La_Paz.
 */
export function parseBoliviaNoonUtc(input: string | Date): Date {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? new Date() : input;
  }
  const trimmed = input.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
  if (dateOnlyMatch) {
    return new Date(`${dateOnlyMatch[1]}T12:00:00.000Z`);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Extrae YYYY-MM-DD de forma segura respetando fechas guardadas a medianoche UTC heredadas
 * y convirtiendo marcas de tiempo reales a zona horaria de Bolivia.
 */
export function extractCalendarDateStr(raw: string | Date | null | undefined): string {
  if (!raw) return getBoliviaDateStr();
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const directMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
    if (directMatch) return directMatch[1];
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? getBoliviaDateStr() : getBoliviaDateStr(parsed);
  }
  if (
    raw.getUTCHours() === 0 &&
    raw.getUTCMinutes() === 0 &&
    raw.getUTCSeconds() === 0 &&
    raw.getUTCMilliseconds() === 0
  ) {
    return raw.toISOString().slice(0, 10);
  }
  return getBoliviaDateStr(raw);
}

/**
 * Formatea una fecha calendario en español de Bolivia sin sufrir el desfase de -1 día por medianoche UTC.
 */
export function formatDateBolivia(
  raw: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }
): string {
  if (!raw) return "—";
  const ymd = extractCalendarDateStr(raw);
  const safeNoon = new Date(`${ymd}T12:00:00.000Z`);
  return safeNoon.toLocaleDateString("es-BO", { ...options, timeZone: BOLIVIA_TIMEZONE });
}

/**
 * Calcula la diferencia exacta en días calendario (later - earlier) en zona horaria de Bolivia.
 */
export function diffBoliviaCalendarDays(
  later: string | Date,
  earlier: string | Date
): number {
  const laterYmd = extractCalendarDateStr(later);
  const earlierYmd = extractCalendarDateStr(earlier);
  const laterMs = new Date(`${laterYmd}T12:00:00.000Z`).getTime();
  const earlierMs = new Date(`${earlierYmd}T12:00:00.000Z`).getTime();
  return Math.round((laterMs - earlierMs) / 86_400_000);
}
