// Background Service Worker (Manifest V3)
// Farfalina & Carissma Meta Relay Bridge

const DEFAULT_CONFIG = {
  serverUrl: "http://localhost:3000",
  environmentOverride: "auto", // 'auto' | 'farfalina' | 'carissma'
  isEnabled: true,
  stats: {
    inboundCount: 0,
    outboundCount: 0,
    lastSyncTime: null,
    lastStatus: "OK",
  },
};

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Relay Background] Extensión instalada. Inicializando almacenamiento...");
  chrome.storage.local.get(Object.keys(DEFAULT_CONFIG), (res) => {
    const initial = { ...DEFAULT_CONFIG, ...res };
    chrome.storage.local.set(initial, () => {
      console.log("[Relay Background] Configuración lista:", initial);
    });
  });
});

// Mensajería entre popup y content-script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_STATUS") {
    chrome.storage.local.get(null, (data) => {
      sendResponse({ success: true, data });
    });
    return true;
  }

  if (request.type === "UPDATE_STATS") {
    chrome.storage.local.get(["stats"], (res) => {
      const stats = res.stats || DEFAULT_CONFIG.stats;
      if (request.inbound) stats.inboundCount = (stats.inboundCount || 0) + 1;
      if (request.outbound) stats.outboundCount = (stats.outboundCount || 0) + 1;
      stats.lastSyncTime = new Date().toISOString();
      stats.lastStatus = request.status || "OK";
      chrome.storage.local.set({ stats });
      sendResponse({ success: true, stats });
    });
    return true;
  }

  if (request.type === "PROXY_FETCH") {
    // Permite que el content script delegue peticiones HTTP al background worker
    // evitando bloqueos de Mixed Content y CSP en el contexto de la página HTTPS
    const bodyPayload = request.body
      ? (typeof request.body === "string" ? request.body : JSON.stringify(request.body))
      : undefined;

    fetch(request.url, {
      method: request.method || "GET",
      headers: request.headers || { "Content-Type": "application/json" },
      body: bodyPayload,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        sendResponse({ success: res.ok, status: res.status, data });
      })
      .catch((err) => {
        console.warn("[Relay Background] Error en proxy fetch:", err.message);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.type === "FETCH_MEDIA_AS_BASE64") {
    // Permite que el content script obtenga archivos multimedia locales o remotos
    // codificados en Base64 para inyectarlos en la interfaz de Meta Business Suite
    fetch(request.url)
      .then(async (res) => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        const arrayBuffer = await res.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const chunkSize = 8192;
        let binary = "";
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
          binary += String.fromCharCode.apply(null, chunk);
        }
        const base64 = btoa(binary);
        const mimeType = res.headers.get("content-type") || "image/jpeg";
        sendResponse({ success: true, base64: `data:${mimeType};base64,${base64}`, mimeType });
      })
      .catch((err) => {
        console.warn("[Relay Background] Error en FETCH_MEDIA_AS_BASE64:", err.message);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

