// Content Script - Meta Business Suite Relay Bridge v1.3.0
// Injected into https://business.facebook.com/latest/inbox/* and https://web.facebook.com/latest/inbox/*

(function () {
  console.log("%c[Farfalina & Carissma Relay] Content Script v1.3.0 Iniciado", "color: #e2553d; font-weight: bold; font-size: 13px;");

  let config = {
    serverUrl: "https://farfalina.tech",
    environmentOverride: "auto",
    isEnabled: true,
  };

  let activeEnvironment = "farfalina";
  let scanIntervalId = null;
  let debounceScanTimeout = null;
  let isContextDead = false;
  let mutationObserver = null;
  let widgetElem = null;
  let isWidgetMinimized = false;

  // Active detected contact in open conversation
  let activeContact = {
    name: "",
    phone: "",
    channel: "WhatsApp",
    profilePicUrl: null,
    threadId: null,
    instagramHandle: null,
  };

  // Cached catalog data from backend
  let catalogData = {
    arrangements: [],
    dresses: [],
    ingredients: [],
  };

  function teardownRelay() {
    isContextDead = true;
    if (scanIntervalId) {
      clearInterval(scanIntervalId);
      scanIntervalId = null;
    }
    if (debounceScanTimeout) {
      clearTimeout(debounceScanTimeout);
      debounceScanTimeout = null;
    }
    if (mutationObserver) {
      try { mutationObserver.disconnect(); } catch (_) {}
      mutationObserver = null;
    }
  }

  function isExtensionValid() {
    if (isContextDead) return false;
    try {
      if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.id) {
        teardownRelay();
        return false;
      }
      return true;
    } catch {
      teardownRelay();
      return false;
    }
  }

  if (!isExtensionValid()) return;

  // 1. Cargar configuración inicial desde almacenamiento local
  chrome.storage.local.get(["serverUrl", "environmentOverride", "isEnabled"], (res) => {
    if (res.serverUrl) config.serverUrl = res.serverUrl.replace(/\/$/, "");
    if (res.environmentOverride) config.environmentOverride = res.environmentOverride;
    if (typeof res.isEnabled === "boolean") config.isEnabled = res.isEnabled;

    detectEnvironment();
    injectFloatingWidget();
    loadCatalogFromBackend();
    startObservers();

    // Escaneos iniciales tras montar DOM
    setTimeout(scanActiveConversation, 600);
    setTimeout(scanActiveConversation, 1500);
    setTimeout(scanActiveConversation, 3500);

    // Sondeo periódico ligero para detectar cambio de chat en SPA de Meta
    scanIntervalId = setInterval(() => {
      if (config.isEnabled && isExtensionValid()) {
        scanActiveConversation();
      }
    }, 2000);
  });

  // Asegurar inyección temprana del widget flotante
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectFloatingWidget, { once: true });
  } else {
    injectFloatingWidget();
  }
  window.addEventListener("load", injectFloatingWidget, { once: true });

  // Escuchar cambios de configuración desde el popup
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.serverUrl) {
      config.serverUrl = changes.serverUrl.newValue.replace(/\/$/, "");
      loadCatalogFromBackend();
    }
    if (changes.environmentOverride) {
      config.environmentOverride = changes.environmentOverride.newValue;
      detectEnvironment();
      updateWidgetUI();
    }
    if (changes.isEnabled) {
      config.isEnabled = changes.isEnabled.newValue;
      updateWidgetUI();
    }
  });

  // 2. Detección Inteligente de Entorno (Farfalina vs Carissma)
  function detectEnvironment() {
    if (config.environmentOverride && config.environmentOverride !== "auto") {
      activeEnvironment = config.environmentOverride;
      return activeEnvironment;
    }

    const pageText = (
      document.title + " " +
      (document.querySelector('[role="banner"]')?.textContent || "") + " " +
      (document.body.innerText.substring(0, 2000))
    ).toLowerCase();

    if (pageText.includes("carissma") || pageText.includes("vestido") || pageText.includes("renta")) {
      activeEnvironment = "carissma";
    } else {
      activeEnvironment = "farfalina";
    }

    return activeEnvironment;
  }

  // 3. Cargar catálogo desde Next.js
  async function loadCatalogFromBackend() {
    try {
      const res = await proxyFetch(`${config.serverUrl}/api/relay/catalog`, { method: "GET" });
      if (res && res.success && res.data && res.data.data) {
        catalogData = res.data.data;
        console.log(`[Relay Catalog] Catálogo cargado: ${catalogData.arrangements?.length || 0} arreglos, ${catalogData.dresses?.length || 0} vestidos.`);
      }
    } catch (e) {
      console.warn("[Relay Catalog] Fallback catálogo:", e?.message);
    }
  }

  // Lista estricta de palabras del sistema de Meta a excluir como nombres de cliente
  const SYSTEM_EXCLUDED = [
    "mensajes",
    "todos los mensajes",
    "messenger",
    "instagram",
    "whatsapp",
    "comentarios de facebook",
    "comentarios de instagram",
    "buscar",
    "prioridad",
    "no leídos",
    "respuestas de anuncios",
    "seguimiento",
    "asignar esta conversación",
    "assign this conversation",
    "información",
    "etiquetas",
    "administrar etiquetas",
    "perfil de instagram",
    "ver perfil",
    "enlace de clic a chat de whatsapp",
    "meta business suite",
    "crear anuncio de mensajes",
    "disponible",
    "editar",
    "agregar etiqueta",
    "conversación activa",
    "responde en whatsapp",
    "responde en instagram",
    "responde en messenger",
  ];

  function isSystemName(str) {
    if (!str) return true;
    const clean = str.trim().toLowerCase();
    if (clean.length < 2 || clean.length > 60) return true;
    if (/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(clean)) return true;
    return SYSTEM_EXCLUDED.some((pat) => clean === pat || clean.startsWith(pat));
  }

  // Canal Helper: WhatsApp vs Instagram vs Messenger
  function detectActiveChannel() {
    const url = window.location.href.toLowerCase();
    if (url.includes("/inbox/wec") || url.includes("thread_type=wec") || url.includes("/inbox/whatsapp")) {
      return "WhatsApp";
    }
    if (url.includes("/inbox/instagram") || url.includes("thread_type=ig") || url.includes("instagram_direct")) {
      return "Instagram";
    }
    if (url.includes("/inbox/messenger") || url.includes("thread_type=fb") || url.includes("/inbox/facebook")) {
      return "Facebook";
    }

    const inputElem = document.querySelector('textarea, div[role="textbox"], [contenteditable="true"]');
    const inputAria = ((inputElem?.getAttribute("aria-label") || "") + " " + (inputElem?.getAttribute("placeholder") || "")).toLowerCase();
    if (inputAria.includes("whatsapp")) return "WhatsApp";
    if (inputAria.includes("instagram")) return "Instagram";
    if (inputAria.includes("messenger")) return "Facebook";

    const bodyText = document.body.innerText.substring(0, 3000);
    if (bodyText.includes("Responde en WhatsApp")) return "WhatsApp";
    if (bodyText.includes("Responde en Instagram")) return "Instagram";
    if (bodyText.includes("Responde en Messenger")) return "Facebook";

    return "WhatsApp";
  }

  // 4. Extracción de Alta Precisión del Contacto Activo
  function scanActiveConversation() {
    if (!isExtensionValid() || !config.isEnabled) return;

    let detectedName = null;
    let detectedPhone = null;
    let detectedHandle = null;
    let detectedAvatar = null;

    const channel = detectActiveChannel();

    // =========================================================================
    // FUENTE 1: PANEL DERECHO DE DETALLES ("contextual_object" / "Información")
    // En las capturas de pantalla de Meta, este panel contiene con exactitud el nombre,
    // teléfono y perfil de Instagram.
    // =========================================================================
    const rightCards = Array.from(
      document.querySelectorAll(
        '[data-surface*="bizweb_inbox:contextual_object"], [data-surface*="context_card"], [data-pagelet*="RightRail"], [data-pagelet*="ContactDetails"]'
      )
    );

    // Fallback: contenedor lateral derecho por posición geométrica en pantalla
    let rightRail = rightCards[0] || null;
    if (!rightRail) {
      const allDivs = Array.from(document.querySelectorAll("div"));
      rightRail = allDivs.find((d) => {
        const rect = d.getBoundingClientRect();
        return (
          rect.left > window.innerWidth * 0.65 &&
          rect.width > 180 &&
          rect.height > 250 &&
          (d.innerText.includes("Información") || d.innerText.includes("Perfil de Instagram") || d.innerText.includes("Etiquetas"))
        );
      });
    }

    if (rightRail) {
      // 1.1 Nombre en panel derecho (heading h2, h3 o [role="heading"])
      const headingElems = Array.from(rightRail.querySelectorAll('[role="heading"], h2, h3, [aria-level="3"]'));
      for (const h of headingElems) {
        const text = h.textContent?.trim();
        if (text && !isSystemName(text)) {
          detectedName = text;
          break;
        }
      }

      // 1.2 Teléfono en panel derecho (WhatsApp)
      // Buscar texto telefónico boliviano (+591 ...) o formato internacional
      const rightText = rightRail.innerText || "";
      const phoneMatches = rightText.match(/(?:\+591\s*[67]\d{7}|\+591\s*\d{8}|\+\d{10,15}|\b[67]\d{7}\b)/g);
      if (phoneMatches && phoneMatches.length > 0) {
        // Excluir el enlace público del negocio Farfalina (59176266696)
        const validPhone = phoneMatches.find((p) => !p.includes("76266696"));
        if (validPhone) {
          detectedPhone = validPhone.replace(/\s+/g, "");
        }
      }

      // 1.3 Handle de Instagram (@username o enlace "Ver perfil")
      const igHandleMatch = rightText.match(/@([a-zA-Z0-9._]{2,30})/);
      if (igHandleMatch) {
        detectedHandle = `@${igHandleMatch[1]}`;
      } else {
        const profileLink = rightRail.querySelector('a[href*="instagram.com"]');
        if (profileLink && profileLink.href) {
          const matchUrl = profileLink.href.match(/instagram\.com\/(?:u\/)?([a-zA-Z0-9._]+)/);
          if (matchUrl && !["p", "explore", "direct"].includes(matchUrl[1])) {
            detectedHandle = `@${matchUrl[1]}`;
          }
        }
      }

      // 1.4 Avatar del contacto en panel derecho
      const rightImgs = Array.from(rightRail.querySelectorAll("img"));
      const contactImg = rightImgs.find(
        (img) => img.src && !img.src.includes("rsrc.php") && (img.src.includes("fbcdn.net") || img.src.includes("cdninstagram") || img.src.includes("fbsbx"))
      );
      if (contactImg) detectedAvatar = contactImg.src;
    }

    // =========================================================================
    // FUENTE 2: CABECERA CENTRAL SOBRE EL ÁREA DE MENSAJES
    // En las capturas: Avatar + Nombre ("jhon" / "Danito") + "Asignar esta conversación"
    // =========================================================================
    if (!detectedName) {
      const assignElems = Array.from(document.querySelectorAll("div, span, button")).filter(
        (el) => el.textContent?.includes("Asignar esta conversación") || el.textContent?.includes("Assign this conversation")
      );
      for (const assignEl of assignElems) {
        const headerContainer = assignEl.closest('div[role="region"], div[role="banner"], div');
        if (headerContainer) {
          const candidates = Array.from(headerContainer.querySelectorAll('[role="heading"], h1, h2, h3, span[dir="auto"], strong, div'));
          for (const cand of candidates) {
            const txt = cand.textContent?.trim();
            if (txt && !isSystemName(txt) && txt.length > 1 && txt.length < 50) {
              detectedName = txt;
              break;
            }
          }
        }
        if (detectedName) break;
      }
    }

    // =========================================================================
    // FUENTE 3: FILA SELECCIONADA EN LA LISTA LATERAL IZQUIERDA
    // =========================================================================
    if (!detectedName) {
      const selectedRow = document.querySelector(
        'span[data-surface*="bizweb_inbox:thread_list/thread_row"][aria-selected="true"], [role="row"][aria-selected="true"], [role="listitem"][aria-selected="true"], a[href*="selected_item_id="][aria-selected="true"]'
      );
      if (selectedRow) {
        const titleEl = selectedRow.querySelector('[data-surface*="lib:thread_title"], [role="heading"], strong, span[dir="auto"]');
        const txt = titleEl?.textContent?.trim() || selectedRow.innerText.split("\n")[0]?.trim();
        if (txt && !isSystemName(txt)) {
          detectedName = txt;
        }
      }
    }

    // =========================================================================
    // FUENTE 4: ID DEL PARÁMETRO DE URL
    // =========================================================================
    const urlParams = new URLSearchParams(window.location.search);
    const selectedItemId = urlParams.get("selected_item_id") || urlParams.get("mailbox_id");

    if (!detectedName && selectedItemId) {
      detectedName = `Cliente Meta (${selectedItemId.slice(-4)})`;
    }

    // Resolver identificador para teléfono / contacto según canal
    let resolvedPhone = detectedPhone;
    if (!resolvedPhone) {
      if (channel === "Instagram") {
        resolvedPhone = detectedHandle || detectedName;
      } else if (channel === "WhatsApp") {
        if (detectedName && /^\+?\d{7,15}$/.test(detectedName.replace(/\s+/g, ""))) {
          resolvedPhone = detectedName.replace(/\s+/g, "");
        } else if (selectedItemId && /^\d{8,15}$/.test(selectedItemId)) {
          resolvedPhone = `+${selectedItemId}`;
        } else {
          resolvedPhone = "";
        }
      } else {
        resolvedPhone = selectedItemId || "";
      }
    }

    activeContact = {
      name: detectedName || "",
      phone: resolvedPhone || "",
      channel: channel,
      profilePicUrl: detectedAvatar,
      threadId: selectedItemId || null,
      instagramHandle: detectedHandle,
    };

    updateWidgetActiveContactBadge();
  }

  // 5. Inyección de Estilos y Barra Flotante
  function injectCustomStyles() {
    if (document.getElementById("farfalina-relay-styles")) return;
    const style = document.createElement("style");
    style.id = "farfalina-relay-styles";
    style.textContent = `
      @keyframes farfalinaZoomIn {
        from { opacity: 0; transform: scale(0.96) translateY(8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes farfalinaSlideIn {
        from { opacity: 0; transform: translateX(25px); }
        to { opacity: 1; transform: translateX(0); }
      }
      #farfalina-hub-bar {
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease;
      }
      #farfalina-hub-bar:hover {
        box-shadow: 0 14px 28px -4px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      }
      .farfalina-action-btn:hover {
        filter: brightness(1.08);
        transform: translateY(-1px);
      }
      .farfalina-action-btn:active {
        transform: translateY(0);
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function injectFloatingWidget() {
    if (document.getElementById("farfalina-smart-relay-widget")) return;
    if (window.innerWidth > 0 && window.innerWidth < 350) return;

    if (!document.body) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectFloatingWidget, { once: true });
      }
      window.addEventListener("load", injectFloatingWidget, { once: true });
      setTimeout(injectFloatingWidget, 500);
      return;
    }

    injectCustomStyles();

    widgetElem = document.createElement("div");
    widgetElem.id = "farfalina-smart-relay-widget";
    widgetElem.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      user-select: none;
      pointer-events: auto;
    `;

    const hubBar = document.createElement("div");
    hubBar.id = "farfalina-hub-bar";
    hubBar.style.cssText = `
      background: #18181b;
      color: #fafafa;
      padding: 6px 12px;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      animation: farfalinaZoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    hubBar.innerHTML = `
      <!-- Brand & Pulse Indicator -->
      <div id="relay-status-pill" style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 8px; border-radius: 9999px; background: rgba(255, 255, 255, 0.08);" title="Clic para alternar Farfalina / Carissma">
        <span id="relay-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
        <span id="relay-brand-text" style="font-size: 11px; font-weight: 700; color: #fff;">Farfalina</span>
      </div>

      <!-- Action Items Container (minimizable) -->
      <div id="relay-actions-group" style="display: flex; align-items: center; gap: 8px;">
        <!-- Active Detected Contact Chip -->
        <div id="relay-contact-pill" style="display: flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, 0.08); padding: 5px 12px; border-radius: 9999px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;" title="Contacto activo detectado en Meta">
          <span id="relay-channel-icon" style="font-size: 11px;">💬</span>
          <span id="relay-contact-name" style="font-size: 11px; font-weight: 600; color: #f4f4f5; overflow: hidden; text-overflow: ellipsis;">Sin chat abierto</span>
        </div>

        <!-- Quick Action Buttons -->
        <button id="btn-open-floral-order" class="farfalina-action-btn" style="background: #e2553d; color: #ffffff; border: none; border-radius: 9999px; padding: 6px 14px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(226, 85, 61, 0.4); transition: transform 0.1s ease;" title="Emitir pedido floral para este cliente">
          <span>🌸</span>
          <span>Crear Pedido Floral</span>
        </button>

        <button id="btn-open-dress-rental" class="farfalina-action-btn" style="background: #d97706; color: #ffffff; border: none; border-radius: 9999px; padding: 6px 14px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.4); transition: transform 0.1s ease;" title="Emitir reserva de vestido para este cliente">
          <span>👗</span>
          <span>Crear Reserva Carissma</span>
        </button>
      </div>

      <!-- Minimize / Expand Toggle -->
      <button id="btn-toggle-widget" style="background: transparent; color: #a1a1aa; border: none; cursor: pointer; padding: 2px 6px; font-size: 11px;" title="Minimizar / Expandir barra">
        ➖
      </button>
    `;

    widgetElem.appendChild(hubBar);
    document.body.appendChild(widgetElem);

    // Event listeners
    document.getElementById("relay-status-pill")?.addEventListener("click", () => {
      activeEnvironment = activeEnvironment === "farfalina" ? "carissma" : "farfalina";
      updateWidgetUI();
    });

    document.getElementById("relay-contact-pill")?.addEventListener("click", () => {
      scanActiveConversation();
    });

    document.getElementById("btn-open-floral-order")?.addEventListener("click", () => {
      openFloralOrderDrawer();
    });

    document.getElementById("btn-open-dress-rental")?.addEventListener("click", () => {
      openDressRentalDrawer();
    });

    document.getElementById("btn-toggle-widget")?.addEventListener("click", () => {
      isWidgetMinimized = !isWidgetMinimized;
      const group = document.getElementById("relay-actions-group");
      const toggleBtn = document.getElementById("btn-toggle-widget");
      if (group) group.style.display = isWidgetMinimized ? "none" : "flex";
      if (toggleBtn) toggleBtn.textContent = isWidgetMinimized ? "➕" : "➖";
    });

    updateWidgetUI();
  }

  function updateWidgetActiveContactBadge() {
    const contactNameElem = document.getElementById("relay-contact-name");
    const channelIconElem = document.getElementById("relay-channel-icon");
    const contactPill = document.getElementById("relay-contact-pill");
    if (!contactNameElem || !contactPill) return;

    if (activeContact && activeContact.name) {
      const channelIcon = activeContact.channel === "WhatsApp" ? "💬" : activeContact.channel === "Instagram" ? "📸" : "📘";
      if (channelIconElem) channelIconElem.textContent = channelIcon;

      const subDetail = activeContact.phone || activeContact.channel;
      contactNameElem.textContent = `${activeContact.name} (${subDetail})`;
      contactPill.style.background = "rgba(226, 85, 61, 0.2)";
      contactPill.style.border = "1px solid rgba(226, 85, 61, 0.4)";
    } else {
      if (channelIconElem) channelIconElem.textContent = "👤";
      contactNameElem.textContent = "Sin chat abierto";
      contactPill.style.background = "rgba(255, 255, 255, 0.08)";
      contactPill.style.border = "none";
    }
  }

  function updateWidgetUI() {
    if (!widgetElem) return;
    const dot = document.getElementById("relay-status-dot");
    const brandText = document.getElementById("relay-brand-text");

    if (!config.isEnabled) {
      if (dot) dot.style.background = "#71717a";
      if (brandText) brandText.textContent = "Pausado";
      return;
    }

    const isCarissma = activeEnvironment === "carissma";
    if (dot) dot.style.background = isCarissma ? "#d97706" : "#22c55e";
    if (brandText) brandText.textContent = isCarissma ? "Carissma" : "Farfalina";
    updateWidgetActiveContactBadge();
  }

  function showFloatingToast(message, type = "success") {
    const existing = document.getElementById("farfalina-relay-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "farfalina-relay-toast";
    toast.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 100000000;
      background: ${type === "success" ? "#065f46" : "#991b1b"};
      color: #ffffff;
      padding: 12px 18px;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 10px;
      animation: farfalinaSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    toast.innerHTML = `<span>${type === "success" ? "✅" : "⚠️"}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast) toast.remove();
    }, 4500);
  }

  // 6. Observadores y Clics para Detección Reactiva
  function startObservers() {
    if (mutationObserver) {
      try { mutationObserver.disconnect(); } catch (_) {}
    }

    mutationObserver = new MutationObserver(() => {
      if (!isExtensionValid() || !config.isEnabled) return;
      if (debounceScanTimeout) clearTimeout(debounceScanTimeout);
      debounceScanTimeout = setTimeout(() => {
        if (!isExtensionValid()) return;
        scanActiveConversation();
      }, 350);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("popstate", scanActiveConversation);
    window.addEventListener("hashchange", scanActiveConversation);

    // Clics en la lista de chats o pestañas disparan re-escaneo inmediato
    document.addEventListener("click", () => {
      setTimeout(scanActiveConversation, 120);
      setTimeout(scanActiveConversation, 500);
    }, true);
  }

  // 7. Proxy Fetch via Background Worker
  function proxyFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      if (!isExtensionValid()) {
        teardownRelay();
        return reject(new Error("Extension context invalidated"));
      }
      try {
        chrome.runtime.sendMessage(
          {
            type: "PROXY_FETCH",
            url,
            method: options.method || "GET",
            headers: options.headers || { "Content-Type": "application/json" },
            body: options.body,
          },
          (response) => {
            const lastErr = chrome.runtime?.lastError;
            if (lastErr) {
              return reject(new Error(lastErr.message));
            }
            if (!response) {
              return reject(new Error("Sin respuesta del servicio background"));
            }
            resolve(response);
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  // =========================================================================
  // MODAL DRAWER 1: CREAR PEDIDO FLORAL CON BENTO GRID DE INSUMOS (FARFALINA)
  // =========================================================================
  async function openFloralOrderDrawer() {
    const existing = document.getElementById("farfalina-order-modal-backdrop");
    if (existing) existing.remove();

    if (!catalogData.ingredients || catalogData.ingredients.length === 0) {
      await loadCatalogFromBackend();
    }

    scanActiveConversation();

    const clientNameVal = activeContact.name || "";
    const clientPhoneVal = activeContact.phone || "";
    const todayStr = new Date().toISOString().split("T")[0];

    // Receta local seleccionada: array de { ingredientId, quantity }
    let selectedRecipe = [];
    let selectedCategory = "Todos";
    let ingredientSearch = "";
    let currentDeliveryType = "delivery";
    let currentPaymentMethod = "Efectivo";

    // Insumos disponibles (del backend o defaults de fallback)
    const availableIngredients = (catalogData.ingredients && catalogData.ingredients.length > 0)
      ? catalogData.ingredients
      : [
          { id: "ing-1", name: "Rosas Rojas Importadas", type: "Flor", available: 120, unit: "tallos", costPerUnit: 10 },
          { id: "ing-2", name: "Girasoles Selección", type: "Flor", available: 45, unit: "tallos", costPerUnit: 8 },
          { id: "ing-3", name: "Lirios Orientales Blancos", type: "Flor", available: 30, unit: "tallos", costPerUnit: 12 },
          { id: "ing-4", name: "Tulipanes Holandeses", type: "Flor", available: 25, unit: "tallos", costPerUnit: 15 },
          { id: "ing-5", name: "Follaje Eucalipto Dólar", type: "Follaje", available: 50, unit: "ramos", costPerUnit: 5 },
          { id: "ing-6", name: "Caja Redonda Premium Farfalina", type: "Caja", available: 18, unit: "uds", costPerUnit: 25 },
          { id: "ing-7", name: "Jarrón de Cristal Tallado", type: "Base", available: 12, unit: "uds", costPerUnit: 35 },
          { id: "ing-8", name: "Cinta de Satén Terracota", type: "Cinta", available: 80, unit: "metros", costPerUnit: 3 },
          { id: "ing-9", name: "Globo Metalizado Feliz Día", type: "Accesorio", available: 20, unit: "uds", costPerUnit: 15 },
        ];

    // Categorías únicas
    const rawCategories = availableIngredients.map((i) => i.type || "Insumo").filter(Boolean);
    const uniqueCategories = ["Todos", ...Array.from(new Set(rawCategories))];

    const backdrop = document.createElement("div");
    backdrop.id = "farfalina-order-modal-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999999;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #ffffff;
      color: #1c1917;
      width: 100%;
      max-width: 680px;
      max-height: 92vh;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      border: 1px solid #e7e5e4;
      animation: farfalinaZoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    modal.innerHTML = `
      <!-- Modal Header -->
      <div style="padding: 14px 20px; background: #fafaf9; border-bottom: 1px solid #e7e5e4; display: flex; align-items: center; justify-content: space-between; border-radius: 20px 20px 0 0; position: sticky; top: 0; z-index: 10;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🌸</span>
          <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #1c1917;">Emisión de Ticket & Pedido Floral</h3>
            <p style="margin: 1px 0 0 0; font-size: 11px; color: #78716c;">Descuenta inventario en vivo y registra el pedido en POS, Logística y CRM.</p>
          </div>
        </div>
        <button id="btn-close-modal" style="background: none; border: none; font-size: 22px; color: #a8a29e; cursor: pointer; padding: 2px 6px;">&times;</button>
      </div>

      <!-- Form Body -->
      <form id="farfalina-order-form" style="padding: 18px 20px; display: flex; flex-direction: column; gap: 14px;">
        
        <!-- SECTION 1: BENTO GRID DE INSUMOS DE LA RECETA -->
        <div style="padding: 12px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 16px; display: flex; flex-direction: column; gap: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 12px; color: #1c1917;">
              <span>📦</span>
              <span>Bento Grid: Insumos de la Receta del Ticket</span>
            </div>
            <span id="bento-total-cost" style="font-size: 11px; font-family: monospace; font-weight: 700; color: #c2410c; background: #fff; padding: 2px 8px; border-radius: 6px; border: 1px solid #fed7aa;">
              Costo Insumos: 0 Bs
            </span>
          </div>

          <!-- Filtro de Categorías y Buscador -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: space-between; align-items: center;">
            <div id="bento-categories-bar" style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px;">
              ${uniqueCategories.map((cat) => `
                <button type="button" class="bento-cat-btn ${cat === 'Todos' ? 'active' : ''}" data-cat="${cat}" style="padding: 3px 8px; font-size: 10px; font-weight: 700; border-radius: 6px; border: 1px solid ${cat === 'Todos' ? '#e2553d' : '#e4e4e7'}; background: ${cat === 'Todos' ? '#e2553d' : '#fff'}; color: ${cat === 'Todos' ? '#fff' : '#52525b'}; cursor: pointer;">
                  ${cat}
                </button>
              `).join("")}
            </div>
            <input type="text" id="bento-search-input" placeholder="Buscar por nombre..." style="width: 150px; padding: 4px 8px; font-size: 11px; border: 1px solid #d4d4d8; border-radius: 6px; outline: none;" />
          </div>

          <!-- Grid de Tarjetas de Insumos -->
          <div id="bento-cards-container" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; max-height: 180px; overflow-y: auto; padding-right: 2px;">
            <!-- Renderizado dinámico vía renderBentoCards() -->
          </div>
        </div>

        <!-- SECTION 2: DATOS DEL CLIENTE COMPRADOR (CRM) -->
        <div style="padding: 12px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #1c1917;">
              <span>👤</span>
              <span>Cliente Comprador (Fidelización CRM)</span>
            </div>
            <span style="font-size: 10px; font-weight: 700; color: #b45309; background: #fef3c7; padding: 2px 8px; border-radius: 9999px;">
              Suma Puntos
            </span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #57534e; margin-bottom: 3px;">Nombre del Cliente *</label>
              <input type="text" id="order-client-name" value="${clientNameVal}" required placeholder="Nombre del comprador..." style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-weight: 600; color: #1c1917;" />
            </div>
            <div>
              <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #57534e; margin-bottom: 3px;">Teléfono / WhatsApp *</label>
              <input type="text" id="order-client-phone" value="${clientPhoneVal}" required placeholder="Teléfono del comprador..." style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: monospace; color: #1c1917;" />
            </div>
          </div>
        </div>

        <!-- SECTION 3: DETALLES DE ENTREGA & DESPACHO -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <h4 style="margin: 0; font-size: 11px; font-weight: 700; color: #44403c; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px;">
            Detalles de Entrega & Despacho
          </h4>

          <!-- Modalidad de Despacho -->
          <div style="display: flex; gap: 8px;">
            <label id="lbl-mode-delivery" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; background: #fff; border: 2px solid #e2553d; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; color: #c2410c;">
              <input type="radio" name="order-delivery-type" value="delivery" checked style="accent-color: #e2553d;" />
              <span>🚚 Envío a Domicilio</span>
            </label>
            <label id="lbl-mode-pickup" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; background: #fff; border: 1px solid #d6d3d1; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; color: #57534e;">
              <input type="radio" name="order-delivery-type" value="pickup" style="accent-color: #e2553d;" />
              <span>🏪 Recoger en Tienda (Pick-up)</span>
            </label>
          </div>

          <!-- Destinatario & Nombre del Arreglo -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Nombre Destinatario *</label>
              <input type="text" id="order-recipient-name" value="${clientNameVal}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;" />
            </div>
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Nombre del Arreglo *</label>
              <input type="text" id="order-arrangement-name" placeholder="Ej. Bouquet Imperial 24 Rosas" value="Bouquet Imperial 24 Rosas Rojas" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;" />
            </div>
          </div>

          <!-- Sugerencias Rápidas de Arreglos -->
          <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px;">
            <button type="button" class="btn-quick-arr" data-name="Bouquet Imperial 24 Rosas Rojas" data-price="280" style="padding: 2px 7px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 9px; font-weight: 600; cursor: pointer; white-space: nowrap;">🌹 Bouquet 24 Rosas (280 Bs)</button>
            <button type="button" class="btn-quick-arr" data-name="Caja Premium Girasoles y Lirios Sol de Verano" data-price="240" style="padding: 2px 7px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 9px; font-weight: 600; cursor: pointer; white-space: nowrap;">🌻 Girasoles & Lirios (240 Bs)</button>
            <button type="button" class="btn-quick-arr" data-name="Jarrón de Cristal Elegancia Real" data-price="320" style="padding: 2px 7px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 9px; font-weight: 600; cursor: pointer; white-space: nowrap;">🏺 Jarrón Cristal (320 Bs)</button>
            <button type="button" class="btn-quick-arr" data-name="Sombrerera Tulipanes Amarillos Solsticio" data-price="290" style="padding: 2px 7px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 9px; font-weight: 600; cursor: pointer; white-space: nowrap;">🌷 Sombrerera Tulipanes (290 Bs)</button>
          </div>

          <!-- Fechas & Horas -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label id="lbl-delivery-date" style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Fecha de Entrega *</label>
              <input type="date" id="order-date" value="${todayStr}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: monospace;" />
            </div>
            <div>
              <label id="lbl-delivery-time" style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Hora Estimada *</label>
              <input type="time" id="order-time" value="16:00" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: monospace;" />
            </div>
          </div>

          <!-- Chips de Horarios Sugeridos -->
          <div style="display: flex; items-center; gap: 4px; overflow-x: auto; padding-bottom: 2px;">
            <span style="font-size: 9px; color: #78716c; font-weight: 600; align-self: center;">Horarios sugeridos:</span>
            ${["10:00", "12:00", "15:00", "16:30", "18:00", "19:30"].map((t) => `
              <button type="button" class="btn-chip-time" data-time="${t}" style="padding: 2px 6px; border-radius: 6px; font-size: 9px; font-weight: 700; font-family: monospace; border: 1px solid #e7e5e4; background: #f5f5f4; color: #44403c; cursor: pointer;">
                ${t}
              </button>
            `).join("")}
          </div>

          <!-- Caja de Destino / Recojo -->
          <div id="box-pickup-info" style="display: none; padding: 10px 12px; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; font-size: 11px; color: #581c87;">
            <p style="margin: 0; font-weight: 700;">🏪 Modalidad: Recoger en Tienda (Pick-up)</p>
            <p style="margin: 2px 0 0 0; color: #6b21a8; font-size: 10px;">El pedido estará listo en tienda central. El costo de delivery queda exento en 0 Bs.</p>
          </div>

          <div id="box-delivery-address" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Zona Delivery *</label>
              <select id="order-zone" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;">
                <option value="Calacoto, Zona Sur">Calacoto, Zona Sur</option>
                <option value="Achumani, Zona Sur">Achumani, Zona Sur</option>
                <option value="Sopocachi">Sopocachi</option>
                <option value="Centro, La Paz">Centro, La Paz</option>
                <option value="Miraflores">Miraflores</option>
                <option value="El Alto">El Alto</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Dirección Exacta *</label>
              <input type="text" id="order-address" placeholder="Calle, Av., Edificio, Nro..." style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;" />
            </div>
          </div>

          <!-- Dedicatoria -->
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Mensaje Dedicatoria Impresa *</label>
            <textarea id="order-dedication" rows="2" placeholder="Escribe la dedicatoria para la tarjeta..." style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: inherit;">¡Feliz Cumpleaños! Con todo mi cariño y amor en tu día especial.</textarea>
          </div>
        </div>

        <!-- SECTION 4: FINANCIERO & RENTABILIDAD -->
        <div style="padding: 12px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 14px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 11px; font-weight: 700; color: #1c1917;">Total y Margen Neto</span>
            <span id="bento-margin-badge" style="font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 6px; background: #dcfce7; color: #15803d; border: 1px solid #86efac;">
              Margen: 100%
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 10px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Precio Arreglo (Bs) *</label>
              <input type="number" id="order-sale-price" value="280" required min="1" style="width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 13px; font-weight: 700; border: 1px solid #d6d3d1; border-radius: 6px; font-family: monospace;" />
            </div>
            <div>
              <label id="lbl-fee-title" style="display: block; font-size: 10px; font-weight: 700; color: #44403c; margin-bottom: 3px;">Costo Envío (Bs)</label>
              <input type="number" id="order-delivery-fee" value="20" min="0" style="width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 13px; font-weight: 700; border: 1px solid #d6d3d1; border-radius: 6px; font-family: monospace;" />
            </div>
          </div>

          <!-- Método de Pago Buttons -->
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <label style="font-size: 10px; font-weight: 700; color: #44403c;">Método de Pago *</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px;">
              ${["Efectivo", "QR", "Tarjeta"].map((m) => `
                <button type="button" class="btn-payment-method ${m === 'Efectivo' ? 'active' : ''}" data-method="${m}" style="padding: 5px; font-size: 11px; font-weight: 700; border-radius: 6px; border: 1px solid ${m === 'Efectivo' ? '#e2553d' : '#e4e4e7'}; background: ${m === 'Efectivo' ? '#e2553d' : '#fff'}; color: ${m === 'Efectivo' ? '#fff' : '#44403c'}; cursor: pointer;">
                  ${m}
                </button>
              `).join("")}
            </div>
          </div>

          <!-- Total a Cobrar -->
          <div style="border-top: 1px solid #e7e5e4; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700; color: #1c1917;">TOTAL A COBRAR:</span>
            <span id="order-grand-total" style="font-size: 16px; font-weight: 800; color: #c2410c; font-family: monospace;">300 Bs</span>
          </div>
        </div>

        <!-- ACTIONS -->
        <div style="display: flex; gap: 10px; margin-top: 4px;">
          <button type="button" id="btn-cancel-order" style="flex: 1; padding: 10px; background: #f5f5f4; border: 1px solid #d6d3d1; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; color: #44403c;">Cancelar</button>
          <button type="submit" id="btn-submit-order" style="flex: 2; padding: 10px; background: #e2553d; border: none; border-radius: 10px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer; box-shadow: 0 4px 12px rgba(226, 85, 61, 0.35);">🌸 Emitir Pedido & Descontar Stock</button>
        </div>
      </form>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // =========================================================================
    // LÓGICA INTERACTIVA DEL BENTO GRID & FORMULARIO
    // =========================================================================
    const cardsContainer = document.getElementById("bento-cards-container");
    const totalCostBadge = document.getElementById("bento-total-cost");
    const marginBadge = document.getElementById("bento-margin-badge");
    const totalDisplay = document.getElementById("order-grand-total");
    const priceInput = document.getElementById("order-sale-price");
    const feeInput = document.getElementById("order-delivery-fee");
    const searchInput = document.getElementById("bento-search-input");
    const boxPickup = document.getElementById("box-pickup-info");
    const boxDelivery = document.getElementById("box-delivery-address");
    const lblDeliveryDate = document.getElementById("lbl-delivery-date");
    const lblDeliveryTime = document.getElementById("lbl-delivery-time");
    const lblFeeTitle = document.getElementById("lbl-fee-title");

    function calculateTotals() {
      const sale = parseFloat(priceInput.value) || 0;
      const fee = currentDeliveryType === "pickup" ? 0 : (parseFloat(feeInput.value) || 0);
      const grandTotal = sale + fee;

      const totalMaterialCost = selectedRecipe.reduce((acc, r) => {
        const ing = availableIngredients.find((i) => i.id === r.ingredientId);
        return acc + (ing ? (ing.costPerUnit || 0) * r.quantity : 0);
      }, 0);

      const netMargin = grandTotal - totalMaterialCost;
      const marginPct = grandTotal > 0 ? (netMargin / grandTotal) * 100 : 0;

      totalCostBadge.textContent = `Costo Insumos: ${totalMaterialCost.toFixed(0)} Bs`;
      totalDisplay.textContent = `${grandTotal.toFixed(0)} Bs`;

      marginBadge.textContent = `Margen: ${marginPct.toFixed(1)}%`;
      if (marginPct >= 40) {
        marginBadge.style.background = "#dcfce7";
        marginBadge.style.color = "#15803d";
        marginBadge.style.borderColor = "#86efac";
      } else if (marginPct >= 20) {
        marginBadge.style.background = "#fef3c7";
        marginBadge.style.color = "#b45309";
        marginBadge.style.borderColor = "#fcd34d";
      } else {
        marginBadge.style.background = "#fee2e2";
        marginBadge.style.color = "#b91c1c";
        marginBadge.style.borderColor = "#fca5a5";
      }
    }

    function renderBentoCards() {
      const q = (searchInput?.value || "").trim().toLowerCase();
      const filtered = availableIngredients.filter((ing) => {
        const matchesCat = selectedCategory === "Todos" || (ing.type || "").toLowerCase() === selectedCategory.toLowerCase();
        const matchesQ = !q || ing.name.toLowerCase().includes(q) || (ing.type && ing.type.toLowerCase().includes(q));
        return matchesCat && matchesQ;
      });

      if (filtered.length === 0) {
        cardsContainer.innerHTML = `<div style="grid-column: span 3; text-align: center; font-size: 11px; color: #a1a1aa; padding: 20px;">No se encontraron insumos con ese filtro.</div>`;
        return;
      }

      cardsContainer.innerHTML = filtered.map((ing) => {
        const sel = selectedRecipe.find((r) => r.ingredientId === ing.id);
        const qty = sel ? sel.quantity : 0;
        const isSelected = qty > 0;

        return `
          <div style="background: ${isSelected ? '#fff7ed' : '#ffffff'}; border: 1px solid ${isSelected ? '#ea580c' : '#e4e4e7'}; border-radius: 10px; padding: 8px; display: flex; flex-direction: column; justify-content: space-between; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 8px; font-weight: 700; background: #f4f4f5; color: #52525b; padding: 1px 4px; border-radius: 4px;">${ing.type || 'Insumo'}</span>
                <span style="font-size: 9px; color: #71717a;">${ing.available} ${ing.unit}</span>
              </div>
              <p style="margin: 3px 0 0 0; font-size: 11px; font-weight: 700; color: #18181b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${ing.name}">${ing.name}</p>
              <span style="font-size: 9px; font-family: monospace; color: #71717a;">${ing.costPerUnit} Bs/u</span>
            </div>

            <div style="border-top: 1px solid #f4f4f5; padding-top: 4px;">
              ${isSelected ? `
                <div style="display: flex; align-items: center; justify-content: space-between; background: #fff; border: 1px solid #fdba74; border-radius: 6px; padding: 2px 4px;">
                  <button type="button" class="btn-step-minus" data-id="${ing.id}" style="border: none; background: transparent; cursor: pointer; color: #ef4444; font-size: 10px; padding: 0 2px;">🗑️</button>
                  <span style="font-size: 11px; font-weight: 700; color: #9a3412;">${qty}</span>
                  <button type="button" class="btn-step-plus" data-id="${ing.id}" style="border: none; background: transparent; cursor: pointer; color: #ea580c; font-size: 12px; font-weight: 700; padding: 0 2px;">+</button>
                </div>
              ` : `
                <button type="button" class="btn-add-ing" data-id="${ing.id}" style="width: 100%; border: none; background: #f4f4f5; color: #27272a; padding: 3px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; transition: background 0.15s;">
                  + Añadir
                </button>
              `}
            </div>
          </div>
        `;
      }).join("");

      // Vincular eventos a los botones del grid
      cardsContainer.querySelectorAll(".btn-add-ing").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          selectedRecipe.push({ ingredientId: id, quantity: 1 });
          renderBentoCards();
          calculateTotals();
        });
      });

      cardsContainer.querySelectorAll(".btn-step-plus").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const item = selectedRecipe.find((r) => r.ingredientId === id);
          if (item) item.quantity += 1;
          renderBentoCards();
          calculateTotals();
        });
      });

      cardsContainer.querySelectorAll(".btn-step-minus").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          const idx = selectedRecipe.findIndex((r) => r.ingredientId === id);
          if (idx !== -1) {
            if (selectedRecipe[idx].quantity > 1) {
              selectedRecipe[idx].quantity -= 1;
            } else {
              selectedRecipe.splice(idx, 1);
            }
          }
          renderBentoCards();
          calculateTotals();
        });
      });
    }

    renderBentoCards();
    calculateTotals();

    // Eventos de Categorías Bento
    document.querySelectorAll(".bento-cat-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".bento-cat-btn").forEach((b) => {
          b.style.background = "#fff";
          b.style.color = "#52525b";
          b.style.borderColor = "#e4e4e7";
        });
        btn.style.background = "#e2553d";
        btn.style.color = "#fff";
        btn.style.borderColor = "#e2553d";
        selectedCategory = btn.dataset.cat;
        renderBentoCards();
      });
    });

    searchInput?.addEventListener("input", renderBentoCards);
    priceInput?.addEventListener("input", calculateTotals);
    feeInput?.addEventListener("input", calculateTotals);

    // Modalidad Pick-up vs Delivery
    modal.querySelectorAll('input[name="order-delivery-type"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        currentDeliveryType = e.target.value;
        const lblDel = document.getElementById("lbl-mode-delivery");
        const lblPick = document.getElementById("lbl-mode-pickup");

        if (currentDeliveryType === "pickup") {
          feeInput.value = "0";
          feeInput.disabled = true;
          boxPickup.style.display = "block";
          boxDelivery.style.display = "none";
          lblDeliveryDate.textContent = "Fecha de Retiro *";
          lblDeliveryTime.textContent = "Hora Estimada Retiro *";
          lblFeeTitle.textContent = "Costo Envío (Exento)";

          lblPick.style.borderColor = "#9333ea";
          lblPick.style.color = "#6b21a8";
          lblDel.style.borderColor = "#d6d3d1";
          lblDel.style.color = "#57534e";
        } else {
          feeInput.value = "20";
          feeInput.disabled = false;
          boxPickup.style.display = "none";
          boxDelivery.style.display = "grid";
          lblDeliveryDate.textContent = "Fecha de Entrega *";
          lblDeliveryTime.textContent = "Hora Estimada *";
          lblFeeTitle.textContent = "Costo Envío (Bs)";

          lblDel.style.borderColor = "#e2553d";
          lblDel.style.color = "#c2410c";
          lblPick.style.borderColor = "#d6d3d1";
          lblPick.style.color = "#57534e";
        }
        calculateTotals();
      });
    });

    // Sugerencias de Arreglos
    modal.querySelectorAll(".btn-quick-arr").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("order-arrangement-name").value = btn.dataset.name;
        priceInput.value = btn.dataset.price;
        calculateTotals();
      });
    });

    // Chips de Horas
    modal.querySelectorAll(".btn-chip-time").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("order-time").value = btn.dataset.time;
      });
    });

    // Método de Pago
    modal.querySelectorAll(".btn-payment-method").forEach((btn) => {
      btn.addEventListener("click", () => {
        modal.querySelectorAll(".btn-payment-method").forEach((b) => {
          b.style.background = "#fff";
          b.style.color = "#44403c";
          b.style.borderColor = "#e4e4e7";
        });
        btn.style.background = "#e2553d";
        btn.style.color = "#fff";
        btn.style.borderColor = "#e2553d";
        currentPaymentMethod = btn.dataset.method;
      });
    });

    document.getElementById("btn-close-modal").addEventListener("click", () => backdrop.remove());
    document.getElementById("btn-cancel-order").addEventListener("click", () => backdrop.remove());

    // Submit Handler
    document.getElementById("farfalina-order-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-submit-order");
      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ Registrando en Farfalina...";

      const salePriceVal = parseFloat(priceInput.value) || 0;
      const deliveryFeeVal = currentDeliveryType === "pickup" ? 0 : (parseFloat(feeInput.value) || 0);
      const selectedArrName = document.getElementById("order-arrangement-name").value.trim();

      // Mapear insumos con costo unitario para descontar stock en BD
      const recipeItemsPayload = selectedRecipe.map((r) => {
        const ing = availableIngredients.find((i) => i.id === r.ingredientId);
        return {
          rawIngredientId: r.ingredientId,
          quantityNeeded: r.quantity,
          unitCost: ing ? (ing.costPerUnit || 0) : 0,
        };
      });

      const payload = {
        clientName: document.getElementById("order-client-name").value.trim(),
        clientPhone: document.getElementById("order-client-phone").value.trim(),
        recipientName: document.getElementById("order-recipient-name").value.trim(),
        deliveryType: currentDeliveryType,
        address: currentDeliveryType === "pickup" ? "Retiro en Tienda / Local" : document.getElementById("order-address").value.trim(),
        zone: currentDeliveryType === "pickup" ? "Tienda Central" : document.getElementById("order-zone").value,
        deliveryDate: document.getElementById("order-date").value,
        deliveryTime: document.getElementById("order-time").value,
        arrangementName: selectedArrName,
        salePrice: salePriceVal,
        deliveryFee: deliveryFeeVal,
        total: salePriceVal + deliveryFeeVal,
        paymentMethod: currentPaymentMethod,
        dedicationMessage: document.getElementById("order-dedication").value.trim(),
        recipeItems: recipeItemsPayload,
        threadId: activeContact.threadId,
        channel: activeContact.channel,
        environment: "farfalina",
      };

      try {
        const res = await proxyFetch(`${config.serverUrl}/api/relay/order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });

        if (res && res.success && res.data && res.data.success) {
          const orderNum = res.data.data?.orderNumber || "PED-EXITOSO";
          showFloatingToast(`¡Pedido #${orderNum} creado exitosamente! Insumos descontados y caja actualizada.`);
          backdrop.remove();
        } else {
          const errMsg = res?.data?.error || res?.error || "Error al emitir pedido";
          alert(`Error: ${errMsg}`);
          submitBtn.disabled = false;
          submitBtn.textContent = "🌸 Emitir Pedido & Descontar Stock";
        }
      } catch (err) {
        alert(`Error de conexión con el servidor Farfalina: ${err.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = "🌸 Emitir Pedido & Descontar Stock";
      }
    });
  }

  // =========================================================================
  // MODAL DRAWER 2: CREAR RESERVA DE VESTIDO (CARISSMA)
  // =========================================================================
  async function openDressRentalDrawer() {
    const existing = document.getElementById("carissma-rental-modal-backdrop");
    if (existing) existing.remove();

    if (!catalogData.dresses || catalogData.dresses.length === 0) {
      await loadCatalogFromBackend();
    }

    scanActiveConversation();

    const clientNameVal = activeContact.name || "";
    const clientPhoneVal = activeContact.phone || "";
    const todayStr = new Date().toISOString().split("T")[0];
    const returnDateStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const backdrop = document.createElement("div");
    backdrop.id = "carissma-rental-modal-backdrop";
    backdrop.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999999;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const modal = document.createElement("div");
    modal.style.cssText = `
      background: #ffffff;
      color: #1c1917;
      width: 100%;
      max-width: 560px;
      max-height: 90vh;
      border-radius: 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      border: 1px solid #e7e5e4;
      animation: farfalinaZoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    const dressesList = (catalogData.dresses && catalogData.dresses.length > 0)
      ? catalogData.dresses
      : [
          { id: "dress-1", name: "Vestido Gala Noche Rosa Gold Sequin", size: "M", color: "Rosa Gold", baseRentalPrice: 450, requiredGuarantee: 200 },
          { id: "dress-2", name: "Vestido Corte Sirena Borgoña Terciopelo", size: "S", color: "Borgoña", baseRentalPrice: 550, requiredGuarantee: 250 },
          { id: "dress-3", name: "Vestido Cóctel Satén Emerald Green", size: "L", color: "Verde Esmeralda", baseRentalPrice: 380, requiredGuarantee: 150 },
          { id: "dress-4", name: "Vestido Largo Champagne Tul & Cristales", size: "S", color: "Champagne", baseRentalPrice: 650, requiredGuarantee: 300 },
        ];

    const dressOptionsHtml = dressesList
      .map(
        (d) =>
          `<option value="${d.id}" data-name="${d.name}" data-price="${d.baseRentalPrice || 450}" data-guarantee="${d.requiredGuarantee || 200}">
            ${d.name} (${d.color || "Color"}, Talla ${d.size || "M"}) • Renta: ${d.baseRentalPrice} Bs
          </option>`
      )
      .join("");

    modal.innerHTML = `
      <div style="padding: 16px 20px; background: #fffbeb; border-bottom: 1px solid #fef3c7; display: flex; align-items: center; justify-content: space-between; border-radius: 20px 20px 0 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">👗</span>
          <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #78350f;">Carissma Alquileres • Crear Reserva desde Meta</h3>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #92400e;">Registra fechas de alquiler, garantía y contrato con cliente de Meta.</p>
          </div>
        </div>
        <button id="btn-close-rental-modal" style="background: none; border: none; font-size: 20px; color: #a8a29e; cursor: pointer; padding: 4px;">&times;</button>
      </div>

      <form id="carissma-rental-form" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #fefce8; padding: 12px; border-radius: 12px; border: 1px solid #fef08a;">
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #713f12; margin-bottom: 4px;">Nombre Clienta *</label>
            <input type="text" id="rental-client-name" value="${clientNameVal}" required placeholder="Nombre clienta" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #ca8a04; border-radius: 8px; font-weight: 600; color: #1c1917;" />
          </div>
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #713f12; margin-bottom: 4px;">Teléfono / WhatsApp / Perfil</label>
            <input type="text" id="rental-client-phone" value="${clientPhoneVal}" placeholder="+591 ... o @perfil" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #ca8a04; border-radius: 8px; font-family: monospace; color: #1c1917;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Prenda / Vestido de Gala *</label>
          <select id="rental-dress-select" style="width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-weight: 600;">
            ${dressOptionsHtml}
          </select>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Fecha Retiro / Inicio *</label>
            <input type="date" id="rental-start-date" value="${todayStr}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: monospace;" />
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Fecha Devolución *</label>
            <input type="date" id="rental-end-date" value="${returnDateStr}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: monospace;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #fffbeb; padding: 12px; border-radius: 12px; border: 1px solid #fef3c7;">
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; color: #b45309; margin-bottom: 4px;">Precio de Renta (Bs) *</label>
            <input type="number" id="rental-price" value="450" required min="1" style="width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 13px; font-weight: 700; border: 1px solid #fcd34d; border-radius: 6px; font-family: monospace;" />
          </div>
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; color: #b45309; margin-bottom: 4px;">Garantía Retenida (Bs) *</label>
            <input type="number" id="rental-guarantee" value="200" required min="0" style="width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 13px; font-weight: 700; border: 1px solid #fcd34d; border-radius: 6px; font-family: monospace;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Método de Pago *</label>
          <select id="rental-payment-method" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;">
            <option value="Efectivo">Efectivo en Tienda</option>
            <option value="QR">Transferencia Bancaria / QR Simple</option>
            <option value="Tarjeta">Tarjeta de Débito / Crédito</option>
          </select>
        </div>

        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Notas / Medidas / Observaciones</label>
          <textarea id="rental-notes" rows="2" placeholder="Detalles de ajuste, evento, o requerimientos especiales..." style="width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: inherit;"></textarea>
        </div>

        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button type="button" id="btn-cancel-rental" style="flex: 1; padding: 10px; background: #f5f5f4; border: 1px solid #d6d3d1; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; color: #44403c;">Cancelar</button>
          <button type="submit" id="btn-submit-rental" style="flex: 2; padding: 10px; background: #d97706; border: none; border-radius: 10px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.35);">👗 Confirmar Reserva Carissma</button>
        </div>
      </form>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const dressSelect = document.getElementById("rental-dress-select");
    const rentalPriceInput = document.getElementById("rental-price");
    const rentalGuaranteeInput = document.getElementById("rental-guarantee");

    dressSelect.addEventListener("change", () => {
      const selected = dressSelect.options[dressSelect.selectedIndex];
      if (selected.dataset.price) rentalPriceInput.value = selected.dataset.price;
      if (selected.dataset.guarantee) rentalGuaranteeInput.value = selected.dataset.guarantee;
    });

    document.getElementById("btn-close-rental-modal").addEventListener("click", () => backdrop.remove());
    document.getElementById("btn-cancel-rental").addEventListener("click", () => backdrop.remove());

    document.getElementById("carissma-rental-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-submit-rental");
      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ Registrando en Carissma...";

      const selectedOption = dressSelect.options[dressSelect.selectedIndex];
      const selectedDressName = selectedOption?.dataset?.name || "";

      const payload = {
        clientName: document.getElementById("rental-client-name").value.trim(),
        clientPhone: document.getElementById("rental-client-phone").value.trim(),
        dressId: dressSelect.value,
        dressName: selectedDressName,
        rentalStartDate: document.getElementById("rental-start-date").value,
        rentalEndDate: document.getElementById("rental-end-date").value,
        rentalPrice: parseFloat(rentalPriceInput.value) || 0,
        guaranteeAmount: parseFloat(rentalGuaranteeInput.value) || 0,
        paymentMethod: document.getElementById("rental-payment-method").value,
        notes: document.getElementById("rental-notes").value.trim(),
        threadId: activeContact.threadId,
        environment: "carissma",
      };

      try {
        const res = await proxyFetch(`${config.serverUrl}/api/relay/rental`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });

        if (res && res.success && res.data && res.data.success) {
          const booking = res.data.data;
          showFloatingToast(`¡Reserva #${booking.contractNumber || "ALQ"} confirmada con éxito en Carissma!`);
          backdrop.remove();
        } else {
          const errMsg = res?.data?.error || res?.error || "Error al emitir reserva";
          alert(`Error: ${errMsg}`);
          submitBtn.disabled = false;
          submitBtn.textContent = "👗 Confirmar Reserva Carissma";
        }
      } catch (err) {
        alert(`Error de conexión con el servidor Carissma: ${err.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = "👗 Confirmar Reserva Carissma";
      }
    });
  }

})();
