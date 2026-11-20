/**
 * Utilidad unificada para la apertura de Meta Business Suite (Bandeja de Mensajes)
 * para Florería Farfalina y Alquileres Carissma, 100% web (laptop, desktop y tablet).
 */

export const META_BUSINESS_FARFALINA_DEFAULT =
  "https://business.facebook.com/latest/inbox/all";

export const META_BUSINESS_CARISSMA_DEFAULT =
  "https://business.facebook.com/latest/inbox/all";

const BROKEN_LEGACY_IDS = "asset_id=278972961977030";

export function getMetaBusinessUrl(environment: "farfalina" | "carissma" = "farfalina"): string {
  const defaultUrl =
    environment === "farfalina"
      ? META_BUSINESS_FARFALINA_DEFAULT
      : META_BUSINESS_CARISSMA_DEFAULT;

  if (typeof window === "undefined") return defaultUrl;

  const saved = localStorage.getItem(`farfalina_meta_url_${environment}`);
  if (
    saved &&
    saved.startsWith("https://business.facebook.com") &&
    !saved.includes(BROKEN_LEGACY_IDS)
  ) {
    return saved;
  }
  return defaultUrl;
}

export function saveMetaBusinessUrl(
  environment: "farfalina" | "carissma",
  url: string
): boolean {
  if (typeof window === "undefined") return false;
  const trimmed = url.trim();
  if (!trimmed) {
    localStorage.removeItem(`farfalina_meta_url_${environment}`);
    return true;
  }
  if (!trimmed.startsWith("https://business.facebook.com")) {
    return false;
  }
  localStorage.setItem(`farfalina_meta_url_${environment}`, trimmed);
  return true;
}

export function openMetaBusinessSuite(environment: "farfalina" | "carissma" = "farfalina"): Window | null {
  const url = getMetaBusinessUrl(environment);
  if (typeof window === "undefined") return null;

  return window.open(url, "_blank", "noopener,noreferrer");
}
