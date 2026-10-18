// Popup Script - Farfalina & Carissma Meta Relay Bridge v1.3.0

document.addEventListener("DOMContentLoaded", () => {
  const statusBadge = document.getElementById("statusBadge");
  const relayEnabled = document.getElementById("relayEnabled");
  const envSelect = document.getElementById("envSelect");
  const serverUrlInput = document.getElementById("serverUrl");
  const btnSaveUrl = document.getElementById("btnSaveUrl");
  const btnOpenInbox = document.getElementById("btnOpenInbox");
  const btnCheckStatus = document.getElementById("btnCheckStatus");

  // Cargar configuración guardada
  chrome.storage.local.get(
    ["serverUrl", "environmentOverride", "isEnabled"],
    (res) => {
      if (res.serverUrl) {
        serverUrlInput.value = res.serverUrl;
      } else {
        serverUrlInput.value = "https://farfalina.tech";
        chrome.storage.local.set({ serverUrl: "https://farfalina.tech" });
      }
      if (res.environmentOverride) envSelect.value = res.environmentOverride;
      if (typeof res.isEnabled === "boolean") relayEnabled.checked = res.isEnabled;

      checkServerHealth(serverUrlInput.value.trim());
    }
  );

  // Botones de presets rápidos
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const url = btn.dataset.url;
      if (url) {
        serverUrlInput.value = url;
        chrome.storage.local.set({ serverUrl: url }, () => {
          checkServerHealth(url);
        });
      }
    });
  });

  // Guardar cambio de entorno
  envSelect.addEventListener("change", () => {
    chrome.storage.local.set({ environmentOverride: envSelect.value });
  });

  // Guardar estado del relay (activado/desactivado)
  relayEnabled.addEventListener("change", () => {
    chrome.storage.local.set({ isEnabled: relayEnabled.checked });
  });

  // Guardar URL del servidor
  btnSaveUrl.addEventListener("click", () => {
    const val = serverUrlInput.value.trim().replace(/\/$/, "");
    chrome.storage.local.set({ serverUrl: val }, () => {
      btnSaveUrl.textContent = "¡Guardado!";
      setTimeout(() => (btnSaveUrl.textContent = "Guardar"), 1200);
      checkServerHealth(val);
    });
  });

  // Comprobar conexión al backend (farfalina.tech, Netlify o localhost)
  async function checkServerHealth(targetUrl) {
    if (!targetUrl) return;
    statusBadge.textContent = "Verificando...";
    statusBadge.className = "badge";
    statusBadge.style.background = "#fef08a";
    statusBadge.style.color = "#854d0e";

    try {
      const cleanUrl = targetUrl.replace(/\/$/, "");
      const res = await fetch(`${cleanUrl}/api/relay/status`, {
        method: "GET",
        headers: { "x-relay-client": "chrome-extension" },
      });

      if (res.ok) {
        statusBadge.textContent = "Conectado";
        statusBadge.className = "badge badge-online";
        statusBadge.style.background = "";
        statusBadge.style.color = "";
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch {
      statusBadge.textContent = "Desconectado";
      statusBadge.className = "badge badge-offline";
      statusBadge.style.background = "";
      statusBadge.style.color = "";
    }
  }

  btnCheckStatus.addEventListener("click", () => {
    checkServerHealth(serverUrlInput.value.trim());
  });

  btnOpenInbox.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://business.facebook.com/latest/inbox/all" });
  });
});
