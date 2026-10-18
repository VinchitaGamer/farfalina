/**
 * Utilidad unificada para la redirección y apertura de Meta Business Suite (Bandeja de Mensajes)
 * para Florería Farfalina y Alquileres Carissma.
 */

export const META_BUSINESS_FARFALINA_DEFAULT =
  "https://business.facebook.com/latest/inbox/all?asset_id=278972961977030&business_id=3349413642033505";

export const META_BUSINESS_CARISSMA_DEFAULT =
  "https://business.facebook.com/latest/inbox/all";

export function getMetaBusinessUrl(environment: "farfalina" | "carissma" = "farfalina"): string {
  const defaultUrl =
    environment === "farfalina"
      ? META_BUSINESS_FARFALINA_DEFAULT
      : META_BUSINESS_CARISSMA_DEFAULT;

  if (typeof window === "undefined") return defaultUrl;

  const saved = localStorage.getItem(`farfalina_meta_url_${environment}`);
  if (saved && saved.startsWith("https://business.facebook.com")) {
    return saved;
  }
  return defaultUrl;
}

export function openMetaBusinessSuite(environment: "farfalina" | "carissma" = "farfalina"): Window | null {
  const url = getMetaBusinessUrl(environment);

  if (typeof window === "undefined") return null;

  const width = 1260;
  const height = 860;
  const left = Math.max(0, (window.screen.width - width) / 2);
  const top = Math.max(0, (window.screen.height - height) / 2);

  let win: Window | null = null;
  try {
    win = window.open(
      url,
      `MetaBusinessSuite_${environment}`,
      `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,status=no,resizable=yes,scrollbars=yes`
    );
  } catch {
    // Error al abrir ventana popup
  }

  if (!win || win.closed || typeof win.closed === "undefined") {
    // Si el bloqueador de ventanas emergentes bloqueó el popup, abrir en pestaña normal
    win = window.open(url, "_blank", "noopener,noreferrer");
  }

  return win;
}
