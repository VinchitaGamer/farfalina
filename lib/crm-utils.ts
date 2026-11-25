/**
 * Utilidades puras para sincronización de clientes y cálculo de lealtad en CRM
 * Garantiza reglas uniformes en POS Florería, Envíos y Rentas Carissma.
 */

export type LoyaltyTier = "Bronce" | "Plata" | "Oro" | "Platino";

/**
 * Calcula el nivel de fidelidad de un cliente basado en la cantidad de compras/rentas realizadas.
 */
export function calculateLoyaltyTier(purchaseCount: number): LoyaltyTier {
  if (purchaseCount >= 10) return "Platino";
  if (purchaseCount >= 5) return "Oro";
  if (purchaseCount >= 3) return "Plata";
  return "Bronce";
}

/**
 * Desinfecta y normaliza el teléfono y nombre del cliente.
 */
export function sanitizeClientPhoneAndName(
  rawPhone?: string | null,
  rawName?: string | null,
  defaultName = "Cliente General"
): { cleanPhone: string; cleanName: string; phone: string; name: string } {
  let cleanPhone = (rawPhone || "").replace(/@lid|@c\.us/g, "").replace(/\D/g, "").trim();
  let cleanName = (rawName || "").trim() || defaultName;

  // Extraer número de paréntesis en nombres como "Juan Perez (+59176543210)"
  const parenMatch = cleanName.match(/\(([\+\d\s-]+)\)$/);
  if (parenMatch) {
    const extractedNum = parenMatch[1].replace(/\D/g, "").trim();
    if (extractedNum && (cleanPhone.length > 13 || cleanPhone.length < 6 || !cleanPhone)) {
      cleanPhone = extractedNum;
    }
    cleanName = cleanName.replace(/\s*\([\+\d\s-]+\)$/, "").trim() || defaultName;
  }

  return { cleanPhone, cleanName, phone: cleanPhone, name: cleanName };
}

/**
 * Normaliza un número telefónico para enlaces https://wa.me/, anteponiendo el código de país 591
 * cuando se trata de un celular boliviano de 8 dígitos (inicia en 6 o 7).
 */
export function formatWhatsAppPhoneBolivia(rawPhone?: string | null): string {
  let digits = (rawPhone || "").replace(/@lid|@c\.us/g, "").replace(/\D/g, "").trim();
  if (!digits) return "";
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (/^[67]\d{7}$/.test(digits)) {
    return `591${digits}`;
  }
  return digits;
}

/**
 * Genera variantes equivalentes de búsqueda telefónica (con y sin prefijo 591) para evitar
 * duplicar clientes en CRM cuando unas ventas registran 8 dígitos y otras +591.
 */
export function buildPhoneLookupCandidates(rawPhone?: string | null): string[] {
  const digits = (rawPhone || "").replace(/@lid|@c\.us/g, "").replace(/\D/g, "").trim();
  if (!digits) return [];
  const candidates = new Set<string>([digits]);
  if (/^[67]\d{7}$/.test(digits)) {
    candidates.add(`591${digits}`);
  } else if (/^591[67]\d{7}$/.test(digits)) {
    candidates.add(digits.slice(3));
  }
  return Array.from(candidates);
}
