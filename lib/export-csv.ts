import { z } from "zod";

const CsvCellSchema = z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]);
export type CsvCell = z.infer<typeof CsvCellSchema>;

const CsvRowSchema = z.array(CsvCellSchema);
export type CsvRow = z.infer<typeof CsvRowSchema>;

/**
 * Escapa un valor para formato CSV compatible con Microsoft Excel (UTF-8 con BOM).
 * @param value - Valor de celda
 * @returns Cadena escapada para CSV
 */
function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (raw.includes('"') || raw.includes(",") || raw.includes("\n") || raw.includes("\r") || raw.includes(";")) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

/**
 * Genera y descarga un archivo .csv con BOM UTF-8 que abre directamente en Excel sin corromper tildes ni ñ.
 * @param filename - Nombre de archivo sugerido (se añade .csv si falta)
 * @param headers - Encabezados de columna
 * @param rows - Filas de datos
 */
export function downloadExcelCsv(filename: string, headers: string[], rows: CsvRow[]): void {
  if (typeof window === "undefined") return;

  const lines: string[] = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];

  const csvContent = `\uFEFF${lines.join("\r\n")}`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const safeName = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", safeName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
