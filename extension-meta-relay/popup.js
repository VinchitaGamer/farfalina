// Popup Script - Farfalina & Carissma Meta Relay Bridge

document.addEventListener("DOMContentLoaded", () => {
  const statusBadge = document.getElementById("statusBadge");
  const relayEnabled = document.getElementById("relayEnabled");
  const envSelect = document.getElementById("envSelect");
  const serverUrlInput = document.getElementById("serverUrl");
  const btnSaveUrl = document.getElementById("btnSaveUrl");
  const statInbound = document.getElementById("statInbound");
  const statOutbound = document.getElementById("statOutbound");
  const lastSync = document.getElementById("lastSync");
  const btnOpenInbox = document.getElementById("btnOpenInbox");
  const btnCheckStatus = document.getElementById("btnCheckStatus");

  // Cargar configuración guardada
  chrome.storage.local.get(
    ["serverUrl", "environmentOverride", "isEnabled", "stats"],
    (res) => {
      if (res.serverUrl) serverUrlInput.value = res.serverUrl;
      if (res.environmentOverride) envSelect.value = res.environmentOverride;
      if (typeof res.isEnabled === "boolean") relayEnabled.checked = res.isEnabled;
      if (res.stats) {
        statInbound.textContent = res.stats.inboundCount || 0;
        statOutbound.textContent = res.stats.outboundCount || 0;
        if (res.stats.lastSyncTime) {
          const d = new Date(res.stats.lastSyncTime);
          lastSync.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
      }
      checkServerHealth(serverUrlInput.value.trim());
    }
  );

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

  // Comprobar conexión al backend local
  async function checkServerHealth(targetUrl) {
    statusBadge.textContent = "Verificando...";
    statusBadge.className = "badge";
    statusBadge.style.background = "#fef08a";
    statusBadge.style.color = "#854d0e";

    try {
      const res = await fetch(`${targetUrl}/api/relay/status`, {
        method: "GET",
        headers: { "x-relay-client": "chrome-extension" },
      });

      if (res.ok) {
        statusBadge.textContent = "Online :3000";
        statusBadge.className = "badge badge-online";
        statusBadge.style.background = "";
        statusBadge.style.color = "";
      } else {
        throw new Error("HTTP " + res.status);
      }
    } catch {
      statusBadge.textContent = "Offline";
      statusBadge.className = "badge badge-offline";
      statusBadge.style.background = "";
      statusBadge.style.color = "";
    }
  }

  btnCheckStatus.addEventListener("click", () => {
    checkServerHealth(serverUrlInput.value.trim());
  });

  function sendTabMessage(payload, callback) {
    chrome.tabs.query({ url: "*://business.facebook.com/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, payload, callback);
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, (curTabs) => {
          if (curTabs[0]?.id) {
            chrome.tabs.sendMessage(curTabs[0].id, payload, callback);
          } else if (callback) {
            callback(null);
          }
        });
      }
    });
  }

  const btnDeepSync = document.getElementById("btnDeepSync");
  if (btnDeepSync) {
    btnDeepSync.addEventListener("click", () => {
      btnDeepSync.textContent = "🚀 Iniciando Deep Sync...";
      sendTabMessage({ type: "START_DEEP_SYNC" }, (response) => {
        btnDeepSync.textContent = "Deep Sync en progreso en la pestaña";
        setTimeout(() => (btnDeepSync.textContent = "🚀 Sincronización Total (Deep Sync)"), 3000);
      });
    });
  }

  const btnSyncActiveChat = document.getElementById("btnSyncActiveChat");
  if (btnSyncActiveChat) {
    btnSyncActiveChat.addEventListener("click", () => {
      btnSyncActiveChat.textContent = "Sincronizando chat...";
      sendTabMessage({ type: "SYNC_ACTIVE_CHAT" }, (response) => {
        btnSyncActiveChat.textContent = "¡Chat sincronizado!";
        setTimeout(() => (btnSyncActiveChat.textContent = "🔄 Sincronizar Chat Abierto"), 1500);
      });
    });
  }

  const btnSyncNow = document.getElementById("btnSyncNow");
  if (btnSyncNow) {
    btnSyncNow.addEventListener("click", () => {
      btnSyncNow.textContent = "Sincronizando contactos...";
      sendTabMessage({ type: "SYNC_QUICK_CONTACTS" }, (response) => {
        btnSyncNow.textContent = "¡Contactos sincronizados!";
        setTimeout(() => (btnSyncNow.textContent = "⚡ Sincronizar Contactos Rápidos"), 1500);
      });
    });
  }

  btnOpenInbox.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://business.facebook.com/latest/inbox/all" });
  });
});
