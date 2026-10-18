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
