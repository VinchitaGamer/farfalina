// Content Script - Meta Business Suite Relay Bridge
// Injected into https://business.facebook.com/latest/inbox/* and https://web.facebook.com/latest/inbox/*

(function () {
  console.log("%c[Farfalina & Carissma Relay] Content Script Iniciado v2.0.0", "color: #e2553d; font-weight: bold; font-size: 13px;");

  let config = {
    serverUrl: "http://localhost:3000",
    environmentOverride: "auto",
    isEnabled: true,
  };

  let activeEnvironment = "farfalina";
  const processedMessageIds = new Set();
  const processedThreadIds = new Set();
  let isPolling = false;
  let pollIntervalId = null;
  let scanIntervalId = null;
  let debounceScanTimeout = null;
  let syncedChatsCount = 0;
  let syncedMessagesCount = 0;
  let isDeepSyncing = false;
  let shouldCancelDeepSync = false;
  let crawlerStats = {
    totalContacts: 0,
    processedContacts: 0,
    syncedMessages: 0,
    syncedImages: 0,
    currentContactName: "",
    status: "IDLE",
  };

  // Track active detected chat
  let activeContact = {
    name: "",
    phone: "",
    channel: "WhatsApp",
    profilePicUrl: null,
    threadId: null,
  };

  // Cache catalog for fast drawer selections
  let catalogData = {
    arrangements: [],
    dresses: [],
    ingredients: [],
  };

  let isContextDead = false;
  let mutationObserver = null;
  let widgetElem = null;
  let isWidgetMinimized = false;

  function teardownRelay() {
    isContextDead = true;
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    if (scanIntervalId) {
      clearInterval(scanIntervalId);
      scanIntervalId = null;
    }
    if (debounceScanTimeout) {
      clearTimeout(debounceScanTimeout);
      debounceScanTimeout = null;
    }
    if (mutationObserver) {
      try {
        mutationObserver.disconnect();
      } catch (_) {}
      mutationObserver = null;
    }
  }

  function handleExtensionInvalidation() {
    teardownRelay();
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

  // 1. Cargar configuración inicial
  chrome.storage.local.get(["serverUrl", "environmentOverride", "isEnabled"], (res) => {
    if (res.serverUrl) config.serverUrl = res.serverUrl.replace(/\/$/, "");
    if (res.environmentOverride) config.environmentOverride = res.environmentOverride;
    if (typeof res.isEnabled === "boolean") config.isEnabled = res.isEnabled;

    detectEnvironment();
    injectFloatingWidget();
    loadCatalogFromBackend();
    startObservers();
    startOutboundPolling();

    // Escaneos programados iniciales para asegurar captura post-render de React
    setTimeout(() => scanAndSyncAll("Inicial 1.5s"), 1500);
    setTimeout(() => scanAndSyncAll("Inicial 4s"), 4000);
    setTimeout(() => scanAndSyncAll("Inicial 7s"), 7000);

    // Sondeo periódico continuo de la bandeja (cada 4 segundos)
    scanIntervalId = setInterval(() => {
      if (config.isEnabled) {
        scanAndSyncAll("Intervalo 4s");
      }
    }, 4000);
  });

  // Disparo anticipado e incondicional de inyección del widget flotante
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectFloatingWidget, { once: true });
  } else {
    injectFloatingWidget();
  }
  window.addEventListener("load", injectFloatingWidget, { once: true });
  setTimeout(injectFloatingWidget, 1000);
  setTimeout(injectFloatingWidget, 3000);

  // Escuchar cambios de configuración desde el popup
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.serverUrl) config.serverUrl = changes.serverUrl.newValue.replace(/\/$/, "");
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

  // Escuchar mensajes desde el popup y background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "FORCE_SYNC") {
      scanAndSyncAll("manual-popup");
      flashBadge("sync");
      sendResponse({ success: true, count: syncedChatsCount });
      return true;
    }

    if (msg.type === "START_DEEP_SYNC") {
      deepSyncAllConversations();
      sendResponse({ success: true, message: "Deep Sync iniciado" });
      return true;
    }

    if (msg.type === "STOP_DEEP_SYNC") {
      shouldCancelDeepSync = true;
      sendResponse({ success: true, message: "Cancelando Deep Sync" });
      return true;
    }

    if (msg.type === "SYNC_ACTIVE_CHAT") {
      syncActiveChatNow();
      sendResponse({ success: true, message: "Sincronizando chat activo" });
      return true;
    }

    if (msg.type === "SYNC_QUICK_CONTACTS") {
      syncQuickContactsList();
      sendResponse({ success: true, message: "Sincronizando lista rápida de contactos..." });
      return true;
    }

    if (msg.type === "GET_CRAWLER_STATUS") {
      sendResponse({ success: true, isDeepSyncing, stats: crawlerStats });
      return true;
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
      (document.querySelector('div[aria-haspopup="menu"]')?.textContent || "") + " " +
      (document.querySelector('[role="banner"]')?.textContent || "") + " " +
      (document.body.innerText.substring(0, 3000))
    ).toLowerCase();

    if (pageText.includes("carissma") || pageText.includes("vestido") || pageText.includes("renta")) {
      activeEnvironment = "carissma";
    } else {
      activeEnvironment = "farfalina";
    }

    return activeEnvironment;
  }

  // Cargar catálogo desde Next.js local
  async function loadCatalogFromBackend() {
    try {
      const res = await proxyFetch(`${config.serverUrl}/api/relay/catalog`, { method: "GET" });
      if (res && res.success && res.data && res.data.data) {
        catalogData = res.data.data;
        console.log(`[Relay Catalog] Catálogo cargado: ${catalogData.arrangements?.length || 0} arreglos, ${catalogData.dresses?.length || 0} vestidos.`);
      }
    } catch {
      // Ignorar fallback
    }
  }

  // 3. Orquestador de Extracción
  function scanAndSyncAll(triggerSource = "manual") {
    if (!isExtensionValid()) {
      handleExtensionInvalidation();
      return;
    }
    if (!config.isEnabled) return;
    detectEnvironment();

    try {
      if (!document.getElementById("farfalina-smart-relay-widget")) {
        injectFloatingWidget();
      }
      scanInboxThreadList();
      scanActiveConversation();
      updateWidgetUI();
    } catch (err) {
      if (err?.message?.includes("Extension context invalidated")) {
        handleExtensionInvalidation();
        return;
      }
      console.warn("[Relay] Error durante scanAndSyncAll:", err);
    }
  }

  // Lista estricta de patrones del sistema que NUNCA deben registrarse como contactos
  const SYSTEM_EXCLUDED_PATTERNS = [
    "vista previa",
    "todos los mensajes",
    "messenger",
    "instagram",
    "whatsapp",
    "comentarios de facebook",
    "comentarios de instagram",
    "administrar etiquetas",
    "administrar captura",
    "administrar",
    "editar",
    "borrar estado",
    "conversación activa",
    "buscar",
    "prioridad",
    "no leídos",
    "destacados",
    "asignar esta conversación",
    "asignado a ti",
    "asignado a",
    "mover a la carpeta",
    "marcar como no leído",
    "marcar como",
    "eliminar conversación",
    "enviar comentario",
    "bandeja de entrada",
    "solicitudes de mensajes",
    "spam",
    "archivados",
    "meta business suite",
    "etiquetas sugeridas",
    "información de contacto",
    "detalles del contacto",
  ];

  function isSystemExcludedName(name) {
    if (!name) return true;
    const lower = name.trim().toLowerCase();
    if (lower.length < 2) return true;
    if (/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(lower)) return true;
    return SYSTEM_EXCLUDED_PATTERNS.some((pat) => lower === pat || lower.startsWith(pat) || lower.includes(pat));
  }

  // Canal Helper: Detección precisa de WhatsApp, Instagram y Facebook en Meta Business Suite
  function detectChannel(containerElem, urlString) {
    const url = urlString || window.location.href || "";
    const search = url.includes("?") ? url.split("?")[1] : "";
    const params = new URLSearchParams(search);
    const threadType = (params.get("thread_type") || "").toUpperCase();

    // 1. Parámetro de tipo de hilo (el indicador más autoritativo de Meta)
    if (threadType.includes("WEC") || threadType.includes("WHATSAPP")) return "WhatsApp";
    if (threadType.includes("IG") || threadType.includes("INSTAGRAM")) return "Instagram";
    if (threadType.includes("FB") || threadType.includes("MESSENGER") || threadType.includes("PAGE")) return "Facebook";

    // 2. Ruta URL
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes("/inbox/whatsapp")) return "WhatsApp";
    if (lowerUrl.includes("/inbox/instagram")) return "Instagram";
    if (lowerUrl.includes("/inbox/facebook") || lowerUrl.includes("/inbox/messenger")) return "Facebook";

    // 3. Inspeccionar enlace del contenedor
    if (containerElem) {
      const link = containerElem.closest("a") || containerElem.querySelector("a");
      const href = (link && typeof link.getAttribute === "function" ? link.getAttribute("href") : "") || "";
      if (href) {
        const linkParams = new URLSearchParams(href.includes("?") ? href.split("?")[1] : "");
        const linkType = (linkParams.get("thread_type") || "").toUpperCase();
        if (linkType.includes("WEC") || linkType.includes("WHATSAPP")) return "WhatsApp";
        if (linkType.includes("IG") || linkType.includes("INSTAGRAM")) return "Instagram";
        if (linkType.includes("FB") || linkType.includes("MESSENGER")) return "Facebook";
      }

      // Check aria-labels, titles, alt text, or classes on all icons/badges in row
      const channelBadge = containerElem.querySelector(
        '[aria-label*="whatsapp" i], [title*="whatsapp" i], img[alt*="whatsapp" i], [data-testid*="whatsapp" i], svg[aria-label*="WhatsApp" i]'
      );
      if (channelBadge) return "WhatsApp";

      const igBadge = containerElem.querySelector(
        '[aria-label*="instagram" i], [title*="instagram" i], img[alt*="instagram" i], [data-testid*="instagram" i], svg[aria-label*="Instagram" i]'
      );
      if (igBadge) return "Instagram";

      const fbBadge = containerElem.querySelector(
        '[aria-label*="messenger" i], [title*="messenger" i], [aria-label*="facebook" i], img[alt*="messenger" i], svg[aria-label*="Messenger" i]'
      );
      if (fbBadge) return "Facebook";

      const html = (containerElem.innerHTML || "").toLowerCase();
      if (html.includes("whatsapp")) return "WhatsApp";
      if (html.includes("instagram")) return "Instagram";
      if (html.includes("messenger")) return "Facebook";

      // Check if text inside container is a phone number (Bolivia +591 or numeric >= 8 digits)
      const text = containerElem.innerText || "";
      if (/\+591\s*\d{8}|\b\d{8,14}\b/.test(text)) {
        return "WhatsApp";
      }
      if (text.includes("@")) {
        return "Instagram";
      }
    }

    return "Facebook";
  }

  // Extraer información enriquecida de perfil desde el panel lateral derecho de Meta Business Suite
  function extractRightDetailsPanel() {
    const details = {
      phone: null,
      email: null,
      instagramUsername: null,
      tags: [],
      clientName: null,
      profilePicUrl: null,
    };

    const detailsPanel = document.querySelector(
      'div[aria-label*="Detalles" i], div[aria-label*="Información" i], div[aria-label*="Details" i], div[data-pagelet*="ContactDetails"], div[data-pagelet*="RightRail"]'
    );

    const contextText = (detailsPanel ? detailsPanel.innerText : document.body.innerText) || "";

    // 1. Teléfono real
    const phoneMatch = contextText.match(/(?:\+591\s*[67]\d{7}|\+591\s*\d{8}|\+\d{10,15}|\b[67]\d{7}\b)/);
    if (phoneMatch) {
      details.phone = phoneMatch[0].replace(/\s+/g, "");
    }

    // 2. Email
    const emailMatch = contextText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    if (emailMatch) {
      details.email = emailMatch[0].trim();
    }

    // 3. Instagram username
    const igMatch = contextText.match(/@([a-zA-Z0-9._]{3,30})/);
    if (igMatch) {
      details.instagramUsername = igMatch[1].trim();
    }

    // 4. Etiquetas / Tags
    if (detailsPanel) {
      const tagChips = Array.from(
        detailsPanel.querySelectorAll(
          'span[data-surface*="label"], div[role="button"], span[dir="auto"], span[class*="badge"]'
        )
      )
        .map((el) => el.innerText?.trim())
        .filter((t) => t && t.length > 1 && t.length < 30 && !isSystemExcludedName(t));
      details.tags = Array.from(new Set(tagChips));

      const headerElem = detailsPanel.querySelector('h2, h3, [role="heading"]');
      if (headerElem && !isSystemExcludedName(headerElem.innerText)) {
        details.clientName = headerElem.innerText.trim();
      }

      const panelImg = Array.from(detailsPanel.querySelectorAll("img")).find(
        (img) => img.src && !img.src.includes("rsrc.php") && (img.src.includes("fbcdn.net") || img.src.includes("fbsbx.com") || img.src.includes("instagram"))
      );
      if (panelImg) {
        details.profilePicUrl = panelImg.src;
      }
    }

    return details;
  }

  // Extrae la URL de imagen o multimedia con la mayor resolución disponible
  function extractHighResMedia(node) {
    let mediaUrl = null;
    let mediaType = null;

    const imgElem =
      node.querySelector('img[src*="fbcdn"], img[src*="instagram"], img[src*="fbsbx"], img[src*="lookaside"], img[src*="blob:"]') ||
      node.closest('div')?.querySelector('img[src*="fbcdn"], img[src*="instagram"], img[src*="fbsbx"]');

    if (imgElem && !imgElem.alt?.toLowerCase().includes("avatar") && !imgElem.src?.includes("rsrc.php")) {
      mediaType = "image";

      // 1. Probar enlace ancestro directo a la foto completa
      const parentLink = imgElem.closest("a");
      const parentHref = parentLink?.href || "";
      if (parentHref.includes("fbcdn.net") || parentHref.includes("cdninstagram.com") || parentHref.includes("fbsbx.com")) {
        mediaUrl = parentHref;
      }

      // 2. Probar srcset para máxima resolución
      if (!mediaUrl && imgElem.srcset) {
        const candidates = imgElem.srcset.split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
        if (candidates.length > 0) {
          mediaUrl = candidates[candidates.length - 1];
        }
      }

      // 3. Probar data-original-src, currentSrc o src
      if (!mediaUrl) {
        mediaUrl = imgElem.getAttribute("data-original-src") || imgElem.currentSrc || imgElem.src;
      }
    }

    if (!mediaUrl) {
      const bgDiv = node.querySelector('div[style*="background-image"], div[style*="background:"]');
      if (bgDiv) {
        const bgMatch = (bgDiv.style.backgroundImage || "").match(/url\(["']?([^"']+)["']?\)/);
        if (bgMatch && !bgMatch[1].includes("rsrc.php") && (bgMatch[1].includes("fbcdn") || bgMatch[1].includes("instagram"))) {
          mediaUrl = bgMatch[1];
          mediaType = "image";
        }
      }
    }

    if (!mediaUrl) {
      const videoElem = node.querySelector('video[src], video source[src]');
      if (videoElem) {
        mediaUrl = videoElem.src || videoElem.getAttribute("src");
        mediaType = "video";
      }
    }

    if (!mediaUrl) {
      const audioElem = node.querySelector('audio[src], audio source[src]');
      if (audioElem) {
        mediaUrl = audioElem.src || audioElem.getAttribute("src");
        mediaType = "audio";
      }
    }

    return { mediaUrl, mediaType };
  }

  // A. Escanear la Lista de Conversaciones (Panel Izquierdo de Meta Business Suite)
  // Extraer y estructurar datos de una fila de conversación
  function extractContactRowData(rowElem) {
    try {
      const rowContainer = rowElem.closest('div[role="row"], div[role="listitem"], a') || rowElem;

      // Extraer nombre del contacto
      const titleElem =
        rowElem.querySelector('[data-surface*="lib:thread_title"]') ||
        rowContainer.querySelector('[data-surface*="lib:thread_title"]') ||
        rowElem.querySelector('h3, [role="heading"], strong, span[dir="auto"]') ||
        rowContainer.querySelector('h3, [role="heading"], strong, span[dir="auto"]');

      let contactName = titleElem ? titleElem.innerText?.trim() : null;

      if (!contactName) {
        const rawLines = (rowContainer.innerText || "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !["Prioridad", "No leídos"].includes(l));
        contactName = rawLines[0] || null;
      }

      if (!contactName || contactName.length < 2 || contactName.length > 65) return null;
      if (isSystemExcludedName(contactName)) return null;

      // Extraer snippet del último mensaje
      const allLines = (rowContainer.innerText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length > 0 &&
            l !== contactName &&
            !["Prioridad", "No leídos", "Destacados", "Mié", "Mar", "Jue", "Vie", "Sáb", "Dom", "Hoy"].includes(l) &&
            !/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(l) &&
            !isSystemExcludedName(l)
        );

      let snippet = allLines.length > 0 ? allLines[0] : "";
      if (snippet.toLowerCase() === "conversación activa" || snippet.toLowerCase() === "conversacion activa") {
        snippet = "";
      }

      // Obtener ID único de la conversación
      let threadId = null;
      const link = rowContainer.closest("a") || rowContainer.querySelector('a[href*="selected_item_id="]') || rowContainer;
      const href = (link && typeof link.getAttribute === "function" ? link.getAttribute("href") : "") || "";
      const idMatch = href.match(/selected_item_id=([0-9a-zA-Z_-]+)/) || href.match(/mailbox_id=([0-9a-zA-Z_-]+)/);

      if (idMatch) {
        threadId = idMatch[1];
      } else {
        threadId = contactName.replace(/[^0-9a-zA-Z]/g, "_").toLowerCase();
      }

      // Detectar canal del ítem
      const itemChannel = detectChannel(rowContainer, href);

      // Extraer avatar real del contacto
      const imgs = Array.from(rowContainer.querySelectorAll("img"));
      const avatarImg = imgs.find(
        (i) =>
          i.alt !== "WhatsApp" &&
          i.alt !== "Instagram" &&
          i.alt !== "Messenger" &&
          i.src &&
          !i.src.includes("rsrc.php") &&
          !i.src.includes("static.xx") &&
          (i.src.includes("fbcdn.net") || i.src.includes("lookaside.fbsbx.com") || i.src.includes("fbsbx.com") || i.src.includes("instagram") || i.src.includes("cdninstagram"))
      );
      const profilePicUrl = avatarImg ? avatarImg.src : null;

      // Extraer marca temporal visible de la fila de conversación
      const timeElem =
        rowContainer.querySelector('time, [aria-label*=":"]') ||
        Array.from(rowContainer.querySelectorAll("span, div")).find(
          (el) =>
            /^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(el.innerText?.trim() || "") ||
            /^(hoy|ayer|mié|mar|jue|vie|sáb|dom)$/i.test(el.innerText?.trim() || "")
        );
      const rawTimestamp = timeElem ? timeElem.innerText?.trim() : null;

      return {
        threadId,
        contactName,
        itemChannel,
        snippet,
        profilePicUrl,
        rawTimestamp,
        rowContainer,
        linkElement: link,
      };
    } catch {
      return null;
    }
  }

  // A. Escanear la Lista de Conversaciones (Panel Izquierdo de Meta Business Suite)
  function scanInboxThreadList() {
    if (!isExtensionValid()) return;

    // Selector verificado de Meta Business Suite: data-surface de fila de conversación
    const threadRowSpans = Array.from(
      document.querySelectorAll('span[data-surface*="bizweb_inbox:thread_list/thread_row"]')
    ).filter((el) => {
      const surface = el.getAttribute("data-surface") || "";
      return /bizweb_inbox:thread_list\/thread_row/i.test(surface);
    });

    let foundItems = threadRowSpans;

    if (foundItems.length === 0) {
      foundItems = Array.from(
        document.querySelectorAll('a[href*="selected_item_id="], [role="row"] a, [role="listitem"] a')
      ).filter((a) => a.href && a.href.includes("selected_item_id="));
    }

    if (foundItems.length > 0) {
      syncedChatsCount = Math.max(syncedChatsCount, foundItems.length);
    }

    foundItems.forEach((rowElem) => {
      try {
        const parsed = extractContactRowData(rowElem);
        if (!parsed) return;

        const threadKey = `${activeEnvironment}_${parsed.itemChannel}_${parsed.threadId}_${parsed.snippet}`;
        if (processedThreadIds.has(threadKey)) return;
        processedThreadIds.add(threadKey);

        console.log(`[Relay List] 📋 Contacto detectado: "${parsed.contactName}" (${parsed.itemChannel})`);

        sendInboundToLocalBackend({
          isThreadSyncOnly: true,
          channel: parsed.itemChannel,
          environment: activeEnvironment,
          clientName: parsed.contactName,
          phone: parsed.threadId,
          metaThreadId: parsed.threadId,
          externalId: parsed.threadId,
          rawTimestamp: parsed.rawTimestamp,
          text: parsed.snippet,
          profilePicUrl: parsed.profilePicUrl,
        });
      } catch {
        // Ignorar fallo puntual
      }
    });
  }
  // Localiza el contenedor con scroll de la lista de contactos en Meta Business Suite
  function findThreadListScrollContainer() {
    // 1. Probar ascendentes de una fila conocida
    const sampleRow = document.querySelector(
      'span[data-surface*="bizweb_inbox:thread_list/thread_row"], a[href*="selected_item_id="], [role="row"], [role="listitem"]'
    );
    if (sampleRow) {
      let cur = sampleRow.parentElement;
      while (cur && cur !== document.body && cur !== document.documentElement) {
        const style = window.getComputedStyle(cur);
        const overflowY = style.overflowY;
        if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") && cur.scrollHeight > cur.clientHeight + 20) {
          return cur;
        }
        cur = cur.parentElement;
      }
    }

    // 2. Probar selectores conocidos del panel lateral izquierdo
    const listPanel = document.querySelector(
      'div[aria-label*="Bandeja de entrada" i], div[data-pagelet*="Inbox"], div[role="navigation"]'
    );
    if (listPanel) {
      const scrollables = Array.from(listPanel.querySelectorAll("div, [role='grid'], [role='feed']")).filter((el) => {
        const style = window.getComputedStyle(el);
        return (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") && el.scrollHeight > el.clientHeight + 20;
      });
      if (scrollables.length > 0) return scrollables[0];
    }

    // 3. Fallback genérico a cualquier contenedor con scroll en la mitad izquierda de la pantalla
    const allDivs = Array.from(document.querySelectorAll('div, [role="grid"], [role="feed"]'));
    for (const d of allDivs) {
      const rect = d.getBoundingClientRect();
      if (rect.left < window.innerWidth * 0.45 && rect.width > 120 && rect.height > 200 && d.scrollHeight > d.clientHeight + 30) {
        const style = window.getComputedStyle(d);
        if (style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") {
          return d;
        }
      }
    }

    return null;
  }

  // Sincronización rápida de solo la lista de contactos (sin entrar a cada chat)
  async function syncQuickContactsList() {
    showFloatingToast("⚡ Sincronizando lista completa de contactos...", "info");
    flashBadge("sync");
    const container = findThreadListScrollContainer();
    const discovered = new Map();

    const collectVisible = () => {
      const searchRoot = container || document;
      const rows = Array.from(
        searchRoot.querySelectorAll(
          'span[data-surface*="bizweb_inbox:thread_list/thread_row"], a[href*="selected_item_id="], [role="row"], [role="listitem"]'
        )
      ).filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.left < window.innerWidth * 0.45 && rect.width > 50 && rect.height > 20;
      });
      for (const r of rows) {
        const parsed = extractContactRowData(r);
        if (parsed && parsed.threadId && !discovered.has(parsed.threadId)) {
          discovered.set(parsed.threadId, parsed);
          sendInboundToLocalBackend({
            isThreadSyncOnly: true,
            channel: parsed.itemChannel,
            environment: activeEnvironment,
            clientName: parsed.contactName,
            phone: parsed.threadId,
            metaThreadId: parsed.threadId,
            text: parsed.snippet,
            profilePicUrl: parsed.profilePicUrl,
          });
        }
      }
    };

    if (container) {
      container.scrollTop = 0;
      container.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sleep(350);
      collectVisible();

      const step = Math.max(250, Math.floor(container.clientHeight * 0.75));
      let idle = 0;
      while (idle < 3) {
        const prev = container.scrollTop;
        container.scrollTop = prev + step;
        container.dispatchEvent(new Event("scroll", { bubbles: true }));
        await sleep(450);
        collectVisible();
        if (container.scrollTop === prev || container.scrollTop + container.clientHeight >= container.scrollHeight - 15) {
          idle++;
          await sleep(1200);
        } else {
          idle = 0;
        }
      }
      container.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      collectVisible();
    }

    showFloatingToast(`⚡ ${discovered.size} contactos sincronizados en Farfalina.`, "success");
  }

  // Helper para extraer los mensajes visibles montados actualmente en el contenedor
  function extractMessagesFromContainer(streamContainer, activeClientName) {
    if (!streamContainer) return [];
    const streamRect = streamContainer.getBoundingClientRect();
    const streamMidpoint = streamRect.left + streamRect.width / 2;

    const candidateNodes = Array.from(
      streamContainer.querySelectorAll('div[data-testid*="message" i], div[role="row"], div[role="listitem"], div[dir="auto"], span[dir="auto"]')
    );

    const messageList = [];
    const seenNodeTexts = new Set();

    for (const node of candidateNodes) {
      if (node.closest('form, div[role="textbox"], header, div[role="banner"], [role="search"]')) continue;

      const rawText = (node.textContent || "").trim();
      const { mediaUrl: extractedMediaUrl, mediaType: extractedMediaType } = extractHighResMedia(node);

      const hasMedia = Boolean(extractedMediaUrl);
      if (!rawText && !hasMedia) continue;

      const lower = rawText.toLowerCase();
      if (
        lower === "conversación activa" ||
        lower === "conversacion activa" ||
        (activeClientName && lower === activeClientName.toLowerCase()) ||
        lower.includes("meta business suite") ||
        lower.includes("asignar esta conversación") ||
        lower.includes("responde en ") ||
        lower.includes("etiquetas sugeridas") ||
        isSystemExcludedName(rawText)
      ) {
        continue;
      }

      const nodeRect = node.getBoundingClientRect();
      if (nodeRect.width === 0 || nodeRect.height === 0) continue;

      const dedupKey = `${Math.round(nodeRect.top / 8)}_${rawText.slice(0, 40)}`;
      if (seenNodeTexts.has(dedupKey)) continue;
      seenNodeTexts.add(dedupKey);

      // Evaluar si el mensaje es SALIENTE (Agente) vs ENTRANTE (Cliente) mediante score multifactorial
      let score = 0;
      const nodeCenter = nodeRect.left + nodeRect.width / 2;

      // 1. Posición geométrica relativa al punto medio del flujo de chat
      if (nodeCenter > streamMidpoint + 20) score += 3;
      else if (nodeCenter < streamMidpoint - 20) score -= 3;
      if (nodeRect.left > streamRect.left + streamRect.width * 0.45) score += 2;
      if (nodeRect.right < streamRect.left + streamRect.width * 0.55) score -= 2;

      // 2. Estilos flexbox calculados en la jerarquía de ancestros
      let ancestor = node;
      for (let i = 0; i < 6 && ancestor && ancestor !== streamContainer; i++) {
        const cs = window.getComputedStyle(ancestor);
        if (cs.justifyContent === "flex-end" || cs.alignSelf === "flex-end" || cs.alignItems === "flex-end" || cs.marginLeft === "auto") {
          score += 3;
          break;
        }
        if (cs.justifyContent === "flex-start" || cs.alignSelf === "flex-start" || cs.alignItems === "flex-start" || cs.marginRight === "auto") {
          score -= 2;
          break;
        }
        ancestor = ancestor.parentElement;
      }

      // 3. Color de fondo computado de la burbuja
      let colorNode = node;
      for (let i = 0; i < 5 && colorNode; i++) {
        const bg = window.getComputedStyle(colorNode).backgroundColor;
        if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
          if (
            bg.includes("0, 132, 255") ||
            bg.includes("0, 100, 224") ||
            bg.includes("0, 92, 75") ||
            bg.includes("0, 168, 132") ||
            bg.includes("220, 248, 198") ||
            bg.includes("217, 253, 211") ||
            bg.includes("105, 41, 202") ||
            bg.includes("131, 58, 180")
          ) {
            score += 4;
            break;
          }
          if (
            bg.includes("255, 255, 255") ||
            bg.includes("240, 242, 245") ||
            bg.includes("242, 242, 242") ||
            bg.includes("58, 59, 60")
          ) {
            score -= 3;
            break;
          }
        }
        colorNode = colorNode.parentElement;
      }

      // 4. Atributos de accesibilidad y verificación de entrega
      const bubbleContainer = node.closest('div[role="row"], div[role="listitem"], div') || node;
      const ariaLabel = (bubbleContainer.getAttribute("aria-label") || "").toLowerCase();
      if (
        ariaLabel.includes("tú enviaste") ||
        ariaLabel.includes("you sent") ||
        ariaLabel.includes("tú dijiste") ||
        ariaLabel.includes("tu mensaje") ||
        ariaLabel.startsWith("tú:")
      ) {
        score += 5;
      }

      const hasDeliveryTick = Boolean(
        bubbleContainer.querySelector('svg[aria-label*="Entregado" i], svg[aria-label*="Enviado" i], svg[aria-label*="Visto" i], [aria-label*="Delivered" i], [aria-label*="Seen" i]')
      );
      if (hasDeliveryTick) score += 4;

      // 5. Prefijo de texto
      if (rawText.startsWith("Tú: ") || rawText.startsWith("You: ")) score += 5;

      const isOutgoing = score > 0;
      const sender = isOutgoing ? "agent" : "customer";

      // Limpiar texto de prefijos
      let cleanText = rawText;
      if (cleanText.startsWith("Tú: ")) cleanText = cleanText.substring(4).trim();
      else if (cleanText.startsWith("You: ")) cleanText = cleanText.substring(5).trim();

      // Extraer hora real del mensaje si está presente en la interfaz
      let messageTimestamp = null;
      const timeElem = bubbleContainer.querySelector('time, [aria-label*=":"]');
      const timeMatch =
        (timeElem?.textContent || "").match(/\b(\d{1,2}:\d{2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?)\b/i) ||
        ariaLabel.match(/\b(\d{1,2}:\d{2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?)\b/i) ||
        (/^\s*\d{1,2}:\d{2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?\s*$/i.test(rawText) ? rawText.match(/\b(\d{1,2}:\d{2}\s*(?:a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?)\b/i) : null);

      if (timeMatch) {
        const timeStr = timeMatch[1].replace(/\./g, "").trim().toLowerCase();
        const parts = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm|a\s*m|p\s*m)?/);
        if (parts) {
          let hours = parseInt(parts[1], 10);
          const minutes = parseInt(parts[2], 10);
          const ampm = parts[3] ? parts[3].replace(/\s+/g, "") : null;
          if (ampm === "pm" && hours < 12) hours += 12;
          if (ampm === "am" && hours === 12) hours = 0;

          const d = new Date();
          d.setHours(hours, minutes, 0, 0);
          messageTimestamp = d.toISOString();
        }
      }

      const msgIdMatch =
        node.getAttribute("data-id") ||
        bubbleContainer.getAttribute("data-id") ||
        bubbleContainer.getAttribute("data-testid") ||
        node.getAttribute("data-testid") ||
        null;
      const externalId = msgIdMatch ? msgIdMatch.replace(/[^a-zA-Z0-9_-]/g, "_") : null;
      const rawTimestamp = timeMatch ? timeMatch[1].trim() : null;

      messageList.push({
        top: nodeRect.top,
        sender,
        text: cleanText,
        mediaUrl: extractedMediaUrl,
        mediaType: extractedMediaType,
        createdAt: messageTimestamp,
        rawTimestamp,
        externalId,
      });
    }

    return messageList;
  }

  // B. Escanear la Conversación Activa Abierta (Panel Central y Derecho)
  function scanActiveConversation(precollectedMessages = null) {
    if (!isExtensionValid()) return;

    let activeClientName = null;
    let activePhone = null;

    // Estrategia 1: Panel derecho de Detalles / Información
    const rightDetails = extractRightDetailsPanel();
    if (rightDetails.phone) {
      activePhone = rightDetails.phone;
    }
    if (rightDetails.clientName) {
      activeClientName = rightDetails.clientName;
    }

    // Estrategia 2: Cabecera central sobre el chat
    if (!activeClientName) {
      const assignElem = Array.from(document.querySelectorAll("div, span, button")).find(
        (el) => el.textContent?.includes("Asignar esta conversación") || el.textContent?.includes("Assign this conversation")
      );
      if (assignElem) {
        const headerParent = assignElem.closest('div[role="region"], div[role="banner"], div');
        const possibleNames = headerParent?.querySelectorAll("h1, h2, h3, span, div");
        if (possibleNames) {
          for (const el of possibleNames) {
            const txt = el.textContent?.trim();
            if (
              txt &&
              txt.length > 1 &&
              txt.length < 40 &&
              txt !== "Asignar esta conversación" &&
              !txt.includes("Meta Business") &&
              !txt.includes("Buscar") &&
              !isSystemExcludedName(txt)
            ) {
              activeClientName = txt;
              break;
            }
          }
        }
      }
    }

    // Estrategia 3: Del ítem seleccionado en la lista
    if (!activeClientName) {
      const selectedItem = document.querySelector(
        'a[href*="selected_item_id="][aria-selected="true"], [role="row"][aria-selected="true"], [role="listitem"][aria-selected="true"]'
      );
      if (selectedItem) {
        const firstLine = selectedItem.innerText.split("\n")[0]?.trim();
        if (firstLine && firstLine.length < 50 && !isSystemExcludedName(firstLine)) {
          activeClientName = firstLine;
        }
      }
    }

    // Estrategia 4: De los parámetros URL
    const urlParams = new URLSearchParams(window.location.search);
    const selectedItemId = urlParams.get("selected_item_id") || urlParams.get("mailbox_id") || urlParams.get("thread_id");

    if (!activeClientName && selectedItemId) {
      activeClientName = `Cliente Meta (${selectedItemId.slice(-4)})`;
    }

    if (!activeClientName || isSystemExcludedName(activeClientName)) return null;

    const finalPhone = activePhone || selectedItemId || activeClientName.replace(/[^0-9a-zA-Z]/g, "_").toLowerCase();

    // Detectar Canal con máxima precisión
    let activeChannel = detectChannel(document.body, window.location.href);
    const inputPlaceholderElem = document.querySelector(
      'textarea[placeholder], div[contenteditable="true"][aria-label], div[role="textbox"][aria-label]'
    );
    const placeholderText = (
      (inputPlaceholderElem?.getAttribute("placeholder") || "") + " " +
      (inputPlaceholderElem?.getAttribute("aria-label") || "")
    ).toLowerCase();

    if (placeholderText.includes("whatsapp") || document.body.innerText.includes("Responde en WhatsApp")) {
      activeChannel = "WhatsApp";
    } else if (placeholderText.includes("instagram") || activeClientName.startsWith("@") || window.location.href.includes("/instagram")) {
      activeChannel = "Instagram";
    }

    // Buscar avatar activo en la cabecera
    const headerImgs = Array.from(document.querySelectorAll('div[role="region"] img, div[role="banner"] img, header img'));
    const activeAvatar = headerImgs.find(
      (img) => img.src && !img.src.includes("rsrc.php") && (img.src.includes("fbcdn.net") || img.src.includes("lookaside.fbsbx.com") || img.src.includes("instagram") || img.src.includes("cdninstagram"))
    );

    activeContact = {
      name: activeClientName,
      phone: finalPhone,
      channel: activeChannel,
      profilePicUrl: activeAvatar ? activeAvatar.src : null,
      threadId: selectedItemId || null,
    };

    updateWidgetActiveContactBadge();

    // Notificar a la ventana padre
    const targetWin = (window.parent && window.parent !== window)
      ? window.parent
      : (window.opener && !window.opener.closed ? window.opener : null);

    if (targetWin) {
      try {
        targetWin.postMessage(
          {
            type: "FARFALINA_ACTIVE_CHAT",
            clientName: activeClientName,
            phone: finalPhone,
            channel: activeChannel,
            profilePicUrl: activeAvatar ? activeAvatar.src : null,
            threadId: selectedItemId || null,
          },
          "*"
        );
      } catch (e) {}
    }

    // Extraer o utilizar los mensajes recolectados
    let messageList = precollectedMessages;
    if (!messageList || messageList.length === 0) {
      const streamContainer = findMessageStreamContainer();
      messageList = extractMessagesFromContainer(streamContainer, activeClientName);
    }

    if (!messageList || messageList.length === 0) return null;

    // Ordenar de arriba hacia abajo (orden cronológico visual de Meta)
    messageList.sort((a, b) => a.top - b.top);

    // Propagar y anclar timestamps de manera estrictamente monótona y contextual
    const resolvedTimes = new Array(messageList.length).fill(null);

    for (let i = 0; i < messageList.length; i++) {
      if (messageList[i].createdAt) {
        resolvedTimes[i] = new Date(messageList[i].createdAt).getTime();
      }
    }

    for (let i = 1; i < messageList.length; i++) {
      if (resolvedTimes[i] === null && resolvedTimes[i - 1] !== null) {
        resolvedTimes[i] = resolvedTimes[i - 1] + 1000;
      }
    }

    for (let i = messageList.length - 2; i >= 0; i--) {
      if (resolvedTimes[i] === null && resolvedTimes[i + 1] !== null) {
        resolvedTimes[i] = resolvedTimes[i + 1] - 1000;
      }
    }

    const now = Date.now();
    const fallbackBase = now - messageList.length * 2000;
    for (let i = 0; i < messageList.length; i++) {
      if (resolvedTimes[i] === null) {
        resolvedTimes[i] = fallbackBase + i * 2000;
      }
    }

    for (let i = 1; i < messageList.length; i++) {
      if (resolvedTimes[i] <= resolvedTimes[i - 1]) {
        resolvedTimes[i] = resolvedTimes[i - 1] + 1000;
      }
    }

    const payloadMessages = messageList.map((m, idx) => ({
      sender: m.sender,
      text: m.text,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      createdAt: new Date(resolvedTimes[idx]).toISOString(),
      rawTimestamp: m.rawTimestamp || null,
      externalId: m.externalId || null,
    }));

    const imgCount = payloadMessages.filter((m) => m.mediaUrl).length;
    syncedMessagesCount += payloadMessages.length;

    sendInboundToLocalBackend({
      channel: activeChannel,
      environment: activeEnvironment,
      clientName: rightDetails.clientName || activeClientName,
      phone: finalPhone,
      metaThreadId: selectedItemId || null,
      externalId: selectedItemId || null,
      rawTimestamp: payloadMessages[payloadMessages.length - 1]?.rawTimestamp || null,
      profilePicUrl: rightDetails.profilePicUrl || (activeAvatar ? activeAvatar.src : null),
      email: rightDetails.email || null,
      instagramUsername: rightDetails.instagramUsername || null,
      tags: rightDetails.tags && rightDetails.tags.length > 0 ? rightDetails.tags : undefined,
      messages: payloadMessages,
    });

    return {
      messageCount: payloadMessages.length,
      imageCount: imgCount,
      clientName: activeClientName,
      phone: finalPhone,
      channel: activeChannel,
    };
  }

  // Localiza el contenedor con scroll del flujo de mensajes
  function findMessageStreamContainer() {
    const composer = document.querySelector(
      'div[role="textbox"][contenteditable="true"], textarea[placeholder*="mensaje" i], div[contenteditable="true"]'
    );
    const chatPanel = composer
      ? composer.closest('div[role="main"], div[data-pagelet*="Inbox"], div[aria-label*="Conversación" i], div[aria-label*="Conversation" i], div[aria-label*="Mensajes" i]')
      : document.querySelector('div[role="main"], div[data-pagelet*="Inbox"]');

    if (!chatPanel) return document.body;

    const candidates = Array.from(chatPanel.querySelectorAll("div, div[role='grid'], div[role='feed'], div[role='log']"));
    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if ((style.overflowY === "auto" || style.overflowY === "scroll" || style.overflowY === "overlay") && el.scrollHeight > el.clientHeight + 40) {
        return el;
      }
    }
    return chatPanel;
  }

  // Rastrea y extrae la conversación activa acumulando mensajes en cada paso de scroll hacia arriba
  // Evita que la des-virtualización de React destruya los mensajes antiguos al volver al final
  async function crawlActiveChatMessages(overrideContact) {
    const streamContainer = findMessageStreamContainer();
    const accumulatedMap = new Map();

    const collectCurrent = () => {
      if (!streamContainer || streamContainer === document.body) return;
      const msgs = extractMessagesFromContainer(streamContainer, activeContact.name);
      for (const m of msgs) {
        const key = `${m.sender}_${m.text.trim()}_${m.mediaUrl || ""}`;
        if (!accumulatedMap.has(key)) {
          accumulatedMap.set(key, m);
        }
      }
    };

    if (streamContainer && streamContainer !== document.body) {
      // 1. Recolectar mensajes iniciales visibles en el viewport inferior
      collectCurrent();

      // 2. Desplazar hacia arriba progresivamente acumulando mensajes en cada ventana virtual
      let idleUp = 0;
      for (let s = 0; s < 6; s++) {
        if (shouldCancelDeepSync) break;
        const prevHeight = streamContainer.scrollHeight;
        const prevScroll = streamContainer.scrollTop;
        const step = Math.max(280, Math.floor(streamContainer.clientHeight * 0.75));
        streamContainer.scrollTop = Math.max(0, prevScroll - step);
        streamContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
        await sleep(450);

        collectCurrent();

        if (streamContainer.scrollTop === 0) {
          // Llegamos al tope, esperar paginación GraphQL de Meta
          await sleep(900);
          collectCurrent();
          if (streamContainer.scrollHeight === prevHeight) {
            idleUp++;
            if (idleUp >= 2) break;
          } else {
            idleUp = 0;
          }
        }
      }

      // 3. Regresar al final para renderizar mensajes recientes
      streamContainer.scrollTop = streamContainer.scrollHeight;
      streamContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sleep(350);
      collectCurrent();
    }

    const allAccumulated = Array.from(accumulatedMap.values());
    return scanActiveConversation(allAccumulated.length > 0 ? allAccumulated : null);
  }

  // Sincroniza 100% de la conversación abierta actualmente
  async function syncActiveChatNow() {
    showFloatingToast("Sincronizando historial completo de este chat...", "info");
    flashBadge("sync");
    const res = await crawlActiveChatMessages();
    if (res) {
      showFloatingToast(`Chat sincronizado: ${res.messageCount} mensajes, ${res.imageCount} fotos.`, "success");
    } else {
      showFloatingToast("No se pudo detectar conversación abierta.", "warning");
    }
  }

  // Sincronización Total / Deep Sync Progresivo (Des-virtualización en Vuelo 100%)
  async function deepSyncAllConversations() {
    if (isDeepSyncing) {
      console.warn("[Relay Crawler] Sincronización profunda ya en curso.");
      return;
    }

    isDeepSyncing = true;
    shouldCancelDeepSync = false;
    crawlerStats = {
      totalContacts: 0,
      processedContacts: 0,
      syncedMessages: 0,
      syncedImages: 0,
      currentContactName: "Iniciando Deep Sync...",
      status: "RUNNING",
    };
    updateCrawlerHUD();

    showFloatingToast("🚀 Iniciando Deep Sync: des-virtualizando contactos e historiales...", "info");

    const scrollContainer = findThreadListScrollContainer();
    const visitedThreadIds = new Set();

    try {
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
        await sleep(500);
      }

      let idleScrollCount = 0;
      let consecutiveEmptyViews = 0;

      while (!shouldCancelDeepSync) {
        // 1. Obtener todas las filas de contactos actualmente montadas en el DOM visible del panel izquierdo
        const searchRoot = scrollContainer || document;
        const visibleRows = Array.from(
          searchRoot.querySelectorAll(
            'span[data-surface*="bizweb_inbox:thread_list/thread_row"], a[href*="selected_item_id="], [role="row"], [role="listitem"]'
          )
        ).filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.left < window.innerWidth * 0.45 && rect.width > 50 && rect.height > 20;
        });

        let processedInThisBatch = 0;

        for (const rowElem of visibleRows) {
          if (shouldCancelDeepSync) break;

          const contact = extractContactRowData(rowElem);
          if (!contact || !contact.threadId) continue;
          if (visitedThreadIds.has(contact.threadId)) continue;

          visitedThreadIds.add(contact.threadId);
          processedInThisBatch++;
          crawlerStats.totalContacts = visitedThreadIds.size;
          crawlerStats.processedContacts = visitedThreadIds.size;
          crawlerStats.currentContactName = `${contact.contactName} (${contact.itemChannel})`;
          updateCrawlerHUD();

          console.log(`[Relay Crawler] 🔄 Procesando [${visitedThreadIds.size}]: "${contact.contactName}"...`);

          // 2. Click seguro en el elemento que está MONTADO FÍSICAMENTE en el viewport
          const clickTarget = contact.linkElement || contact.rowContainer || rowElem;
          try {
            clickTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            const mouseOpts = { bubbles: true, cancelable: true, view: window };
            clickTarget.dispatchEvent(new PointerEvent("pointerdown", mouseOpts));
            clickTarget.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
            clickTarget.dispatchEvent(new PointerEvent("pointerup", mouseOpts));
            clickTarget.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
            clickTarget.click();
          } catch (_) {
            clickTarget.click();
          }

          // Esperar activamente con sondeo a que Meta renderice la conversación del contacto
          let waited = 0;
          while (waited < 2000) {
            await sleep(150);
            waited += 150;
            const currentParams = new URLSearchParams(window.location.search);
            const currentId = currentParams.get("selected_item_id") || currentParams.get("mailbox_id");
            if (currentId && contact.threadId && currentId === contact.threadId) break;
            const rightRail = extractRightDetailsPanel();
            if (rightRail.clientName && contact.contactName && rightRail.clientName.toLowerCase() === contact.contactName.toLowerCase()) break;
          }
          await sleep(250);

          // 3. Des-virtualizar mensajes antiguos y extraer multimedia acumulativamente
          const chatResult = await crawlActiveChatMessages(contact);
          if (chatResult) {
            crawlerStats.syncedMessages += chatResult.messageCount || 0;
            crawlerStats.syncedImages += chatResult.imageCount || 0;
          }

          updateCrawlerHUD();
          await sleep(350);
        }

        if (shouldCancelDeepSync) break;

        if (processedInThisBatch === 0) {
          consecutiveEmptyViews++;
        } else {
          consecutiveEmptyViews = 0;
        }

        if (!scrollContainer) {
          break;
        }

        // 4. Desplazar el contenedor hacia abajo para forzar a React a montar la siguiente tanda
        const prevScroll = scrollContainer.scrollTop;
        const scrollStep = Math.max(220, Math.floor(scrollContainer.clientHeight * 0.65));
        scrollContainer.scrollTop = prevScroll + scrollStep;
        scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
        await sleep(600); // Tiempo para que React monte los nuevos nodos virtuales

        const isAtBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 25;

        if (isAtBottom || scrollContainer.scrollTop === prevScroll) {
          idleScrollCount++;
          console.log(`[Relay Crawler] Al final de la página. Esperando GraphQL de Meta (intento ${idleScrollCount}/3)...`);
          await sleep(1500);

          // Si el scrollHeight creció, Meta cargó más contactos!
          if (scrollContainer.scrollHeight > scrollContainer.clientHeight + prevScroll + 20) {
            idleScrollCount = 0;
            consecutiveEmptyViews = 0;
          }

          if (idleScrollCount >= 3 || consecutiveEmptyViews >= 3) {
            console.log("[Relay Crawler] ✅ Fin de la lista alcanzado.");
            break;
          }
        } else {
          idleScrollCount = 0;
        }
      }

      if (!shouldCancelDeepSync) {
        crawlerStats.status = "COMPLETED";
        showFloatingToast(
          `🎉 ¡Deep Sync 100% Completado! ${crawlerStats.processedContacts} contactos, ${crawlerStats.syncedMessages} mensajes y ${crawlerStats.syncedImages} fotos sincronizados en Farfalina.`,
          "success"
        );
      } else {
        crawlerStats.status = "CANCELLED";
        showFloatingToast("Deep Sync detenido por el usuario.", "warning");
      }
    } catch (err) {
      console.error("[Relay Crawler] Error en Deep Sync:", err);
      showFloatingToast(`Error en Deep Sync: ${err.message}`, "error");
    } finally {
      isDeepSyncing = false;
      updateCrawlerHUD();
      updateWidgetUI();
    }
  }

  function updateCrawlerHUD() {
    let hud = document.getElementById("farfalina-crawler-hud");
    if (!isDeepSyncing) {
      if (hud) hud.style.display = "none";
      return;
    }

    if (!hud) {
      hud = document.createElement("div");
      hud.id = "farfalina-crawler-hud";
      hud.style.cssText = `
        background: #09090b;
        border: 1px solid #3f3f46;
        border-radius: 14px;
        padding: 10px 14px;
        color: #fafafa;
        width: 320px;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        animation: farfalinaZoomIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      `;
      if (widgetElem) {
        widgetElem.insertBefore(hud, widgetElem.firstChild);
      } else {
        document.body.appendChild(hud);
      }
    }

    hud.style.display = "flex";

    const total = crawlerStats.totalContacts || 1;
    const current = crawlerStats.processedContacts || 0;
    const pct = Math.min(100, Math.round((current / total) * 100));

    hud.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; color: #f97316; display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #f97316; box-shadow: 0 0 8px #f97316;"></span>
          Deep Sync en progreso...
        </span>
        <button id="btn-cancel-crawler" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; cursor: pointer;">
          ⏹️ Detener
        </button>
      </div>
      <div style="width: 100%; height: 6px; background: #27272a; border-radius: 3px; overflow: hidden;">
        <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #f97316, #e2553d); transition: width 0.3s ease;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px; color: #a1a1aa;">
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${crawlerStats.currentContactName}</span>
        <span style="font-family: monospace;">${current}/${total} (${pct}%)</span>
      </div>
    `;

    document.getElementById("btn-cancel-crawler")?.addEventListener("click", () => {
      shouldCancelDeepSync = true;
      const btn = document.getElementById("btn-cancel-crawler");
      if (btn) btn.textContent = "Cancelando...";
    });
  }

  // 4. Observadores DOM Reactivos
  function startObservers() {
    if (mutationObserver) {
      try { mutationObserver.disconnect(); } catch (_) {}
    }
    mutationObserver = new MutationObserver(() => {
      if (!isExtensionValid() || !config.isEnabled) return;
      if (debounceScanTimeout) clearTimeout(debounceScanTimeout);
      debounceScanTimeout = setTimeout(() => {
        if (!isExtensionValid()) return;
        scanAndSyncAll("MutationObserver");
      }, 700);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    window.addEventListener("popstate", () => {
      if (isExtensionValid()) scanAndSyncAll("popstate");
    });
    window.addEventListener("hashchange", () => {
      if (isExtensionValid()) scanAndSyncAll("hashchange");
    });

    document.addEventListener("click", () => {
      if (isExtensionValid()) {
        setTimeout(() => {
          if (isExtensionValid()) scanAndSyncAll("click");
        }, 250);
      }
    });

    window.addEventListener("message", (event) => {
      if (!isExtensionValid()) return;
      if (event.data?.type === "FARFALINA_REQUEST_ACTIVE_CHAT") {
        const targetWin = (window.parent && window.parent !== window)
          ? window.parent
          : (window.opener && !window.opener.closed ? window.opener : null);

        if (activeContact.name && targetWin) {
          try {
            targetWin.postMessage(
              {
                type: "FARFALINA_ACTIVE_CHAT",
                clientName: activeContact.name,
                phone: activeContact.phone,
                channel: activeContact.channel,
                profilePicUrl: activeContact.profilePicUrl,
                threadId: activeContact.threadId,
              },
              "*"
            );
          } catch (e) {}
        }
      }

      if (event.data?.type === "FARFALINA_TRIGGER_CHAT_SYNC") {
        console.log("[Relay] Recibida orden de sincronización de chat activo desde Farfalina Web.");
        syncActiveChatNow();
      }

      if (event.data?.type === "FARFALINA_INBOUND_DIRECT" && event.data?.payload) {
        console.log("[Relay] Reenviando payload inbound desde script de consola vía proxy background...");
        sendInboundToLocalBackend(event.data.payload);
      }
    });
  }

  // 5. Proxy Fetch via Background Worker (Bypass Mixed Content & CSP)
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
              if (lastErr.message?.includes("context invalidated") || lastErr.message?.includes("Extension context")) {
                teardownRelay();
              }
              return reject(new Error(lastErr.message));
            }
            if (!response) {
              return reject(new Error("Sin respuesta del servicio background"));
            }
            resolve(response);
          }
        );
      } catch (err) {
        if (err?.message?.includes("context invalidated") || err?.message?.includes("Extension context")) {
          teardownRelay();
        }
        reject(err);
      }
    });
  }

  // 6. Envío de Mensaje Inbound a Next.js Local
  async function sendInboundToLocalBackend(payload) {
    if (!isExtensionValid()) return;
    try {
      const url = `${config.serverUrl}/api/relay/inbound`;
      const res = await proxyFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-relay-client": "chrome-extension",
        },
        body: payload,
      });

      if (res && res.success) {
        if (isExtensionValid()) {
          try {
            chrome.runtime.sendMessage({ type: "UPDATE_STATS", inbound: true, status: "OK" });
          } catch (_) {}
        }
        flashBadge("sync");
        updateWidgetUI(true);
      }
    } catch (e) {
      if (!isExtensionValid() || e?.message?.includes("context invalidated") || e?.message?.includes("Extension context")) {
        teardownRelay();
        return;
      }
      console.warn("[Relay] Servidor local no disponible:", e.message);
      if (isExtensionValid()) {
        try {
          chrome.runtime.sendMessage({ type: "UPDATE_STATS", status: "OFFLINE" });
        } catch (_) {}
      }
      updateWidgetUI(false);
    }
  }

  // 7. Polling de Mensajes Salientes (Outbound) desde Next.js Local
  function startOutboundPolling() {
    if (pollIntervalId) clearInterval(pollIntervalId);

    pollIntervalId = setInterval(async () => {
      if (!isExtensionValid()) {
        teardownRelay();
        return;
      }
      if (!config.isEnabled || isPolling) return;
      isPolling = true;

      try {
        const detectedEnv = detectEnvironment();
        const url = `${config.serverUrl}/api/relay/outbound?environment=${detectedEnv}&limit=5`;

        const res = await proxyFetch(url, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "x-relay-client": "chrome-extension",
          },
        });

        if (!res || !res.success) {
          updateWidgetUI(false);
          isPolling = false;
          return;
        }

        updateWidgetUI(true);
        const data = res.data;

        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
          for (const item of data.data) {
            await processOutboundMessage(item);
          }
        }
      } catch (err) {
        if (err?.message?.includes("context invalidated") || !isExtensionValid()) {
          teardownRelay();
          return;
        }
        updateWidgetUI(false);
      } finally {
        isPolling = false;
      }
    }, 2000);
  }

  // 8. Ejecución de Respuesta Saliente en Meta Business Suite
  async function processOutboundMessage(queueItem) {
    if (!isExtensionValid()) return;
    console.log(`[Relay Outbound] Despachando mensaje para ${queueItem.clientName || queueItem.phone}: "${queueItem.text}"`);

    try {
      // 1. Verificar si la conversación activa en Meta corresponde al destinatario
      const activeContactKey = (activeContact.phone || activeContact.name || "").toLowerCase();
      const targetPhone = (queueItem.phone || "").toLowerCase();
      const targetName = (queueItem.clientName || "").toLowerCase();

      const isMatchingChat =
        (targetPhone && activeContactKey.includes(targetPhone)) ||
        (targetName && activeContactKey.includes(targetName)) ||
        (window.location.href.includes(queueItem.phone || "___never___"));

      if (!isMatchingChat) {
        // Intentar seleccionar la fila de conversación correspondiente en la lista lateral
        const threadItem =
          document.querySelector(`a[href*="${queueItem.phone}"], [data-surface*="thread_row"] a[href*="${queueItem.phone}"]`) ||
          Array.from(document.querySelectorAll('[data-surface*="thread_row"], [role="row"]')).find((el) => {
            const txt = (el.innerText || "").toLowerCase();
            return (targetPhone && txt.includes(targetPhone)) || (targetName && txt.includes(targetName));
          });

        if (threadItem) {
          console.log(`[Relay Outbound] Cambiando a conversación de destino para ${queueItem.phone}...`);
          threadItem.click();
          await sleep(650);
        }
      }

      const inputSelector = [
        'div[role="textbox"][contenteditable="true"]',
        'div[contenteditable="true"]',
        'textarea[placeholder*="mensaje" i]',
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="responde" i]',
        'div[aria-label*="Escribe un mensaje" i]',
        'div[aria-label*="Write a message" i]',
      ].join(", ");

      const inputBox = document.querySelector(inputSelector);

      if (!inputBox) {
        throw new Error("No se encontró la caja de texto activa en Meta Business Suite. Asegúrate de tener la conversación abierta.");
      }

      // 2. Si el mensaje incluye archivo multimedia (foto/catálogo), adjuntarlo a Meta
      if (queueItem.mediaUrl) {
        console.log(`[Relay Outbound] Cargando archivo multimedia para envío: ${queueItem.mediaUrl}`);
        try {
          const fullMediaUrl = queueItem.mediaUrl.startsWith("http")
            ? queueItem.mediaUrl
            : `${config.serverUrl}${queueItem.mediaUrl}`;

          const mediaRes = await new Promise((resolve) => {
            chrome.runtime.sendMessage(
              { type: "FETCH_MEDIA_AS_BASE64", url: fullMediaUrl },
              (res) => resolve(res)
            );
          });

          if (mediaRes && mediaRes.success && mediaRes.base64) {
            const rawB64 = mediaRes.base64.includes(",") ? mediaRes.base64.split(",")[1] : mediaRes.base64;
            const byteCharacters = atob(rawB64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const mime = mediaRes.mimeType || "image/jpeg";
            const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
            const filename = `imagen_${Date.now()}.${ext}`;
            const blob = new Blob([byteArray], { type: mime });
            const mediaFile = new File([blob], filename, { type: mime });

            let attached = false;

            // Estrategia A: input[type="file"]
            let fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
            if (fileInputs.length === 0) {
              const attachBtn = document.querySelector(
                'div[aria-label*="Adjuntar" i], button[aria-label*="Adjuntar" i], div[aria-label*="Attach" i], button[aria-label*="Attach" i], div[aria-label*="foto" i], div[aria-label*="photo" i], [data-testid*="attach" i]'
              );
              if (attachBtn) {
                attachBtn.click();
                await sleep(250);
                fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
              }
            }

            const targetInput = fileInputs.find((inp) => {
              const acc = (inp.getAttribute("accept") || "").toLowerCase();
              return acc.includes("image") || acc.includes("*") || inp.closest('div[role="main"], div[aria-label*="mensaje" i]');
            }) || fileInputs[0];

            if (targetInput) {
              try {
                const dt = new DataTransfer();
                dt.items.add(mediaFile);
                targetInput.files = dt.files;
                targetInput.dispatchEvent(new Event("change", { bubbles: true }));
                targetInput.dispatchEvent(new Event("input", { bubbles: true }));
                attached = true;
                console.log("[Relay Outbound] Archivo inyectado via input[type=file]");
              } catch (e) {
                console.warn("[Relay Outbound] Falló inyección por input[type=file]:", e);
              }
            }

            // Estrategia B: ClipboardEvent paste
            if (!attached && inputBox) {
              try {
                const dt = new DataTransfer();
                dt.items.add(mediaFile);
                const pasteEvent = new ClipboardEvent("paste", {
                  clipboardData: dt,
                  bubbles: true,
                  cancelable: true,
                });
                inputBox.dispatchEvent(pasteEvent);
                attached = true;
                console.log("[Relay Outbound] Archivo inyectado via ClipboardEvent paste");
              } catch (e) {
                console.warn("[Relay Outbound] Falló inyección por paste:", e);
              }
            }

            // Estrategia C: Drag & Drop
            if (!attached) {
              try {
                const dt = new DataTransfer();
                dt.items.add(mediaFile);
                const dropTarget = inputBox || chatPanel || document.body;
                dropTarget.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt }));
                dropTarget.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }));
                dropTarget.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
                attached = true;
                console.log("[Relay Outbound] Archivo inyectado via Drag & Drop");
              } catch (e) {
                console.warn("[Relay Outbound] Falló inyección por drop:", e);
              }
            }

            // Esperar que Meta procese la miniatura multimedia (polling activo)
            let waitRounds = 0;
            while (waitRounds < 10) {
              await sleep(350);
              const previewThumb = document.querySelector('img[src*="blob:"], div[aria-label*="Vista previa" i], div[aria-label*="Preview" i], [data-testid*="attachment_preview"]');
              const activeSendBtn = document.querySelector('div[aria-label*="Enviar" i]:not([aria-disabled="true"]), button[aria-label*="Enviar" i]:not([disabled])');
              if (previewThumb || activeSendBtn) {
                console.log("[Relay Outbound] Miniatura o botón activo detectado.");
                break;
              }
              waitRounds++;
            }
          }
        } catch (mediaErr) {
          console.warn("[Relay Outbound] Error al procesar archivo adjunto:", mediaErr);
        }
      }

      // 3. Escribir texto si está presente y no es un marcador de solo-archivo
      const textToWrite = (queueItem.text || "").trim();
      const isPlaceholder = textToWrite === "[Archivo adjunto]" || textToWrite === "[Foto]" || textToWrite === "[Imagen]";

      if (textToWrite && !isPlaceholder) {
        inputBox.focus();

        if (inputBox.tagName === "TEXTAREA" || inputBox.tagName === "INPUT") {
          inputBox.value = textToWrite;
          inputBox.dispatchEvent(new Event("input", { bubbles: true }));
          inputBox.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          document.execCommand("selectAll", false, null);
          document.execCommand("insertText", false, textToWrite);
          inputBox.dispatchEvent(new InputEvent("input", { bubbles: true }));
          inputBox.dispatchEvent(new Event("change", { bubbles: true }));
        }

        await sleep(350);
      }

      const sendButton =
        document.querySelector('div[aria-label*="Enviar" i]') ||
        document.querySelector('button[aria-label*="Enviar" i]') ||
        document.querySelector('div[aria-label*="Send" i]') ||
        document.querySelector('button[aria-label*="Send" i]') ||
        document.querySelector('div[role="button"][aria-label*="Enviar" i]') ||
        document.querySelector('button[type="submit"]');

      if (sendButton && !sendButton.disabled && sendButton.getAttribute("aria-disabled") !== "true") {
        sendButton.click();
      } else {
        ["keydown", "keypress", "keyup"].forEach((evtType) => {
          inputBox.dispatchEvent(
            new KeyboardEvent(evtType, {
              key: "Enter",
              code: "Enter",
              keyCode: 13,
              which: 13,
              bubbles: true,
              cancelable: true,
            })
          );
        });
      }

      console.log(`[Relay Outbound] ✅ Mensaje despachado con éxito: "${queueItem.text}"`);

      await proxyFetch(`${config.serverUrl}/api/relay/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          queueId: queueItem.id,
          status: "DELIVERED",
        },
      });

      if (isExtensionValid()) {
        try {
          chrome.runtime.sendMessage({ type: "UPDATE_STATS", outbound: true, status: "OK" });
        } catch (_) {}
      }
      flashBadge("send");
    } catch (err) {
      if (!isExtensionValid() || err?.message?.includes("context invalidated") || err?.message?.includes("Extension context")) {
        teardownRelay();
        return;
      }
      console.error("[Relay Outbound] Error al despachar mensaje:", err);
      await proxyFetch(`${config.serverUrl}/api/relay/ack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          queueId: queueItem.id,
          status: "FAILED",
          error: err.message,
        },
      }).catch(() => {});
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // =========================================================================================
  // 9. SMART FLOATING ACTION WIDGET & EMBEDDED MODAL DRAWERS IN META BUSINESS SUITE
  // =========================================================================================

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

    // No inyectar en micro-marcos o tracking pixels minúsculos (solo cuando las dimensiones están calculadas > 0)
    if (
      (window.innerWidth > 0 && window.innerWidth < 350) ||
      (window.innerHeight > 0 && window.innerHeight < 250)
    ) {
      return;
    }

    if (!document.body) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectFloatingWidget, { once: true });
      }
      window.addEventListener("load", injectFloatingWidget, { once: true });
      setTimeout(injectFloatingWidget, 500);
      return;
    }

    injectCustomStyles();

    // Inyectar contenedor principal del widget
    widgetElem = document.createElement("div");
    widgetElem.id = "farfalina-smart-relay-widget";
    widgetElem.style.cssText = `
      position: fixed;
      bottom: 18px;
      right: 18px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      user-select: none;
      pointer-events: auto;
    `;

    // Barra de acciones flotante principal
    const hubBar = document.createElement("div");
    hubBar.id = "farfalina-hub-bar";
    hubBar.style.cssText = `
      background: #1c1917;
      color: #fafaf9;
      padding: 6px 10px;
      border-radius: 9999px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.12);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;

    hubBar.innerHTML = `
      <!-- Brand & Pulse Indicator -->
      <div id="relay-status-pill" style="display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 8px; border-radius: 9999px; background: rgba(255, 255, 255, 0.08);" title="Clic para alternar Farfalina / Carissma o forzar sync">
        <span id="relay-status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #22c55e; display: inline-block;"></span>
        <span id="relay-brand-text" style="font-size: 11px; font-weight: 700; color: #fff;">Farfalina</span>
      </div>

      <!-- Action Items Container (can be minimized) -->
      <div id="relay-actions-group" style="display: flex; align-items: center; gap: 8px;">
        <!-- Active Detected Contact Chip -->
        <div id="relay-contact-pill" style="display: flex; align-items: center; gap: 5px; background: rgba(255, 255, 255, 0.06); padding: 4px 10px; border-radius: 9999px; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="Contacto activo detectado en Meta">
          <span style="font-size: 11px;">👤</span>
          <span id="relay-contact-name" style="font-size: 11px; font-weight: 600; color: #e7e5e4; overflow: hidden; text-overflow: ellipsis;">Sin chat abierto</span>
        </div>

        <!-- Quick Action Buttons -->
        <button id="btn-open-floral-order" class="farfalina-action-btn" style="background: #e2553d; color: #ffffff; border: none; border-radius: 9999px; padding: 5px 12px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(226, 85, 61, 0.4); transition: transform 0.1s ease;" title="Crear pedido floral en Farfalina para este cliente">
          <span>🌸</span>
          <span>Crear Pedido Floral</span>
        </button>

        <button id="btn-open-dress-rental" class="farfalina-action-btn" style="background: #d97706; color: #ffffff; border: none; border-radius: 9999px; padding: 5px 12px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.4); transition: transform 0.1s ease;" title="Crear reserva de vestido en Carissma">
          <span>👗</span>
          <span>Crear Reserva Carissma</span>
        </button>

        <!-- Deep Sync & Single Chat Sync Buttons -->
        <button id="btn-deep-sync" class="farfalina-action-btn" style="background: #2563eb; color: #ffffff; border: none; border-radius: 9999px; padding: 5px 12px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4); transition: transform 0.1s ease;" title="Sincronización Total 100%: recorre la lista completa y extrae historiales y fotos">
          <span>🚀</span>
          <span>Deep Sync Total</span>
        </button>

        <button id="btn-sync-active-chat" class="farfalina-action-btn" style="background: rgba(255, 255, 255, 0.1); color: #e4e4e7; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 9999px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Sincronizar historial completo de este contacto abierto">
          <span>🔄</span>
          <span>Sync Chat</span>
        </button>

        <!-- Quick Sync Button -->
        <button id="btn-quick-sync" style="background: transparent; color: #a8a29e; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 9999px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 11px; cursor: pointer;" title="Forzar escaneo superficial rápido">
          ⚡
        </button>
      </div>

      <!-- Minimize / Expand Toggle -->
      <button id="btn-toggle-widget" style="background: transparent; color: #71717a; border: none; cursor: pointer; padding: 2px 6px; font-size: 10px;" title="Minimizar / Expandir barra">
        ➖
      </button>
    `;

    widgetElem.appendChild(hubBar);
    document.body.appendChild(widgetElem);

    // Event listeners
    document.getElementById("relay-status-pill")?.addEventListener("click", () => {
      activeEnvironment = activeEnvironment === "farfalina" ? "carissma" : "farfalina";
      updateWidgetUI();
      flashBadge("sync");
      scanAndSyncAll("toggle-env");
    });

    document.getElementById("btn-quick-sync")?.addEventListener("click", () => {
      flashBadge("sync");
      scanAndSyncAll("manual-button");
    });

    document.getElementById("btn-deep-sync")?.addEventListener("click", () => {
      deepSyncAllConversations();
    });

    document.getElementById("btn-sync-active-chat")?.addEventListener("click", () => {
      syncActiveChatNow();
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

    // Escuchar clics en filas de conversación para detección instantánea del contacto activo
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (!target) return;
      const row = target.closest('span[data-surface*="bizweb_inbox:thread_list/thread_row"], a[href*="selected_item_id="], [role="row"], [role="listitem"]');
      if (row) {
        setTimeout(() => {
          scanActiveConversation();
          updateWidgetUI();
        }, 150);
      }
    }, true);

    updateWidgetUI();
  }

  function updateWidgetActiveContactBadge() {
    const contactNameElem = document.getElementById("relay-contact-name");
    if (!contactNameElem) return;

    if (activeContact && activeContact.name) {
      const channelEmoji = activeContact.channel === "WhatsApp" ? "💬" : activeContact.channel === "Instagram" ? "📸" : "📘";
      contactNameElem.textContent = `${activeContact.name} (${activeContact.channel})`;
      contactNameElem.parentElement.style.background = "rgba(226, 85, 61, 0.15)";
      contactNameElem.parentElement.style.border = "1px solid rgba(226, 85, 61, 0.3)";
    } else {
      contactNameElem.textContent = "Sin chat abierto";
      contactNameElem.parentElement.style.background = "rgba(255, 255, 255, 0.06)";
      contactNameElem.parentElement.style.border = "none";
    }
  }

  function updateWidgetUI(isOnline = true) {
    if (!widgetElem) return;
    const dot = document.getElementById("relay-status-dot");
    const brandText = document.getElementById("relay-brand-text");

    if (!config.isEnabled) {
      if (dot) dot.style.background = "#71717a";
      if (brandText) brandText.textContent = "Pausado";
      return;
    }

    if (!isOnline) {
      if (dot) dot.style.background = "#ef4444";
      if (brandText) brandText.textContent = "Offline (3000)";
      return;
    }

    const isCarissma = activeEnvironment === "carissma";
    if (dot) dot.style.background = isCarissma ? "#d97706" : "#22c55e";
    if (brandText) brandText.textContent = isCarissma ? "Carissma" : "Farfalina";
    updateWidgetActiveContactBadge();
  }

  function flashBadge(action) {
    const dot = document.getElementById("relay-status-dot");
    if (!dot) return;
    const orig = dot.style.background;
    dot.style.background = action === "send" ? "#3b82f6" : "#eab308";
    dot.style.transform = "scale(1.4)";
    setTimeout(() => {
      dot.style.background = orig;
      dot.style.transform = "scale(1)";
    }, 400);
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

  // =========================================================================================
  // MODAL DRAWER 1: CREAR PEDIDO FLORAL (FARFALINA) DIRECTO DESDE META BUSINESS SUITE
  // =========================================================================================

  async function openFloralOrderDrawer() {
    const existing = document.getElementById("farfalina-order-modal-backdrop");
    if (existing) existing.remove();

    if (!catalogData.arrangements || catalogData.arrangements.length === 0) {
      await loadCatalogFromBackend();
    }

    const clientNameVal = activeContact.name || "Cliente Meta";
    const clientPhoneVal = activeContact.phone || "";
    const todayStr = new Date().toISOString().split("T")[0];

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
      max-width: 580px;
      max-height: 90vh;
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
      <div style="padding: 16px 20px; background: #fafaf9; border-bottom: 1px solid #e7e5e4; display: flex; align-items: center; justify-content: space-between; border-radius: 20px 20px 0 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">🌸</span>
          <div>
            <h3 style="margin: 0; font-size: 15px; font-weight: 700; color: #1c1917;">Florería Farfalina • Emitir Pedido desde Meta</h3>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #78716c;">El pedido impactará Logística, Arqueo de Caja y CRM automáticamente.</p>
          </div>
        </div>
        <button id="btn-close-modal" style="background: none; border: none; font-size: 20px; color: #a8a29e; cursor: pointer; padding: 4px;">&times;</button>
      </div>

      <!-- Form Body -->
      <form id="farfalina-order-form" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <!-- Client info row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f5f5f4; padding: 12px; border-radius: 12px; border: 1px solid #e7e5e4;">
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #57534e; margin-bottom: 4px;">Cliente Comprador *</label>
            <input type="text" id="order-client-name" value="${clientNameVal}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-weight: 600; color: #1c1917;" />
          </div>
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #57534e; margin-bottom: 4px;">Teléfono / WhatsApp *</label>
            <input type="text" id="order-client-phone" value="${clientPhoneVal}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: monospace; color: #1c1917;" />
          </div>
        </div>

        <!-- Mode selection -->
        <div style="display: flex; gap: 10px;">
          <label style="flex: 1; display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #fff; border: 2px solid #e2553d; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer;">
            <input type="radio" name="order-delivery-type" value="delivery" checked style="accent-color: #e2553d;" />
            <span>🚚 Envío a Domicilio</span>
          </label>
          <label style="flex: 1; display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #fff; border: 1px solid #d6d3d1; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer;">
            <input type="radio" name="order-delivery-type" value="pickup" style="accent-color: #e2553d;" />
            <span>🏪 Recoger en Tienda</span>
          </label>
        </div>

        <!-- Recipient & Address -->
        <div id="delivery-details-box" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Nombre Destinatario *</label>
            <input type="text" id="order-recipient-name" value="${clientNameVal}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;" />
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Zona Delivery *</label>
            <select id="order-zone" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;">
              <option value="Calacoto, Zona Sur">Calacoto, Zona Sur</option>
              <option value="Achumani, Zona Sur">Achumani, Zona Sur</option>
              <option value="Sopocachi">Sopocachi</option>
              <option value="Centro, La Paz">Centro, La Paz</option>
              <option value="Miraflores">Miraflores</option>
              <option value="El Alto">El Alto</option>
            </select>
          </div>
          <div style="grid-column: span 2;">
            <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Dirección Exacta de Entrega *</label>
            <input type="text" id="order-address" placeholder="Calle, Av., Edificio, Nro de puerta..." style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;" />
          </div>
        </div>

        <!-- Date & Time -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Fecha de Entrega *</label>
            <input type="date" id="order-date" value="${todayStr}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: monospace;" />
          </div>
          <div>
            <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Hora de Entrega *</label>
            <input type="time" id="order-time" value="16:00" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: monospace;" />
          </div>
        </div>

        <!-- Arrangement Selection -->
        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Arreglo Floral *</label>
          <input type="text" id="order-arrangement-name" placeholder="Ej. Bouquet Imperial 24 Rosas Rojas" value="Bouquet Imperial 24 Rosas Rojas" required style="width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;" />
          <!-- Suggested Quick Catalog Options -->
          <div style="display: flex; gap: 5px; overflow-x: auto; margin-top: 6px; padding-bottom: 2px;">
            <button type="button" class="btn-quick-arr" data-name="Bouquet Imperial 24 Rosas Rojas" data-price="280" style="padding: 3px 8px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer; white-space: nowrap;">🌹 Bouquet 24 Rosas (280 Bs)</button>
            <button type="button" class="btn-quick-arr" data-name="Caja Premium Girasoles y Lirios Sol de Verano" data-price="240" style="padding: 3px 8px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer; white-space: nowrap;">🌻 Girasoles & Lirios (240 Bs)</button>
            <button type="button" class="btn-quick-arr" data-name="Jarrón de Cristal Elegancia Real" data-price="320" style="padding: 3px 8px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer; white-space: nowrap;">🏺 Jarrón Cristal (320 Bs)</button>
            <button type="button" class="btn-quick-arr" data-name="Sombrerera Tulipanes Amarillos Solsticio" data-price="290" style="padding: 3px 8px; background: #f5f5f4; border: 1px solid #e7e5e4; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer; white-space: nowrap;">🌷 Sombrerera Tulipanes (290 Bs)</button>
          </div>
        </div>

        <!-- Pricing & Payment -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; background: #fff7ed; padding: 12px; border-radius: 12px; border: 1px solid #fed7aa;">
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; color: #9a3412; margin-bottom: 4px;">Precio Arreglo (Bs) *</label>
            <input type="number" id="order-sale-price" value="280" required min="1" style="width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 13px; font-weight: 700; border: 1px solid #fdba74; border-radius: 6px; font-family: monospace;" />
          </div>
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; color: #9a3412; margin-bottom: 4px;">Envío (Bs)</label>
            <input type="number" id="order-delivery-fee" value="20" min="0" style="width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 13px; font-weight: 700; border: 1px solid #fdba74; border-radius: 6px; font-family: monospace;" />
          </div>
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; color: #9a3412; margin-bottom: 4px;">Total a Cobrar</label>
            <div id="order-grand-total" style="font-size: 15px; font-weight: 800; color: #c2410c; padding: 6px 0; font-family: monospace;">300 Bs</div>
          </div>
        </div>

        <!-- Payment method -->
        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Método de Pago *</label>
          <select id="order-payment-method" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px;">
            <option value="Efectivo">Efectivo contra entrega / Caja</option>
            <option value="QR">Transferencia Bancaria / QR Simple</option>
            <option value="Tarjeta">Tarjeta de Débito / Crédito</option>
          </select>
        </div>

        <!-- Dedication Message -->
        <div>
          <label style="display: block; font-size: 11px; font-weight: 700; color: #44403c; margin-bottom: 4px;">Mensaje Dedicatoria Impresa *</label>
          <textarea id="order-dedication" rows="2" placeholder="Escribe la dedicatoria para la tarjeta..." style="width: 100%; box-sizing: border-box; padding: 8px 10px; font-size: 12px; border: 1px solid #d6d3d1; border-radius: 8px; font-family: inherit;">¡Feliz Cumpleaños! Con todo mi cariño y amor en tu día especial.</textarea>
        </div>

        <!-- Submit Button -->
        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button type="button" id="btn-cancel-order" style="flex: 1; padding: 10px; background: #f5f5f4; border: 1px solid #d6d3d1; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; color: #44403c;">Cancelar</button>
          <button type="submit" id="btn-submit-order" style="flex: 2; padding: 10px; background: #e2553d; border: none; border-radius: 10px; font-size: 12px; font-weight: 700; color: #ffffff; cursor: pointer; box-shadow: 0 4px 12px rgba(226, 85, 61, 0.35);">🌸 Confirmar y Emitir Pedido</button>
        </div>
      </form>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Helpers inside modal
    const priceInput = document.getElementById("order-sale-price");
    const feeInput = document.getElementById("order-delivery-fee");
    const totalDisplay = document.getElementById("order-grand-total");
    const deliveryDetailBox = document.getElementById("delivery-details-box");

    function updateTotal() {
      const p = parseFloat(priceInput.value) || 0;
      const f = parseFloat(feeInput.value) || 0;
      totalDisplay.textContent = `${(p + f).toFixed(0)} Bs`;
    }

    priceInput.addEventListener("input", updateTotal);
    feeInput.addEventListener("input", updateTotal);

    modal.querySelectorAll('input[name="order-delivery-type"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        if (e.target.value === "pickup") {
          feeInput.value = "0";
          deliveryDetailBox.style.opacity = "0.4";
        } else {
          feeInput.value = "20";
          deliveryDetailBox.style.opacity = "1";
        }
        updateTotal();
      });
    });

    modal.querySelectorAll(".btn-quick-arr").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.getElementById("order-arrangement-name").value = btn.dataset.name;
        priceInput.value = btn.dataset.price;
        updateTotal();
      });
    });

    document.getElementById("btn-close-modal").addEventListener("click", () => backdrop.remove());
    document.getElementById("btn-cancel-order").addEventListener("click", () => backdrop.remove());

    // Submit handler
    document.getElementById("farfalina-order-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById("btn-submit-order");
      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ Registrando en Farfalina...";

      const deliveryType = modal.querySelector('input[name="order-delivery-type"]:checked').value;
      const salePrice = parseFloat(priceInput.value) || 0;
      const deliveryFee = deliveryType === "pickup" ? 0 : (parseFloat(feeInput.value) || 0);
      const selectedArrName = document.getElementById("order-arrangement-name").value.trim();

      // Buscar arreglo en catálogo para forward de receta e insumos vivos
      const matchedArr = (catalogData.arrangements || []).find(
        (a) => a.name.toLowerCase() === selectedArrName.toLowerCase() || a.name.toLowerCase().includes(selectedArrName.toLowerCase())
      );
      const recipeItems = matchedArr?.recipeItems?.map((ri) => ({
        rawIngredientId: ri.rawIngredientId,
        quantityNeeded: ri.quantityNeeded,
        unitCost: ri.rawIngredient?.costPerUnit || 0,
      })) || [];

      const payload = {
        clientName: document.getElementById("order-client-name").value.trim(),
        clientPhone: document.getElementById("order-client-phone").value.trim(),
        recipientName: document.getElementById("order-recipient-name").value.trim(),
        deliveryType,
        address: document.getElementById("order-address").value.trim(),
        zone: document.getElementById("order-zone").value,
        deliveryDate: document.getElementById("order-date").value,
        deliveryTime: document.getElementById("order-time").value,
        arrangementName: selectedArrName,
        salePrice,
        deliveryFee,
        total: salePrice + deliveryFee,
        paymentMethod: document.getElementById("order-payment-method").value,
        dedicationMessage: document.getElementById("order-dedication").value.trim(),
        recipeItems,
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
          showFloatingToast(`¡Pedido #${orderNum} creado con éxito en Farfalina! Stock y caja actualizados.`);
          backdrop.remove();
        } else {
          const errMsg = res?.data?.error || res?.error || "Error al emitir pedido";
          alert(`Error: ${errMsg}`);
          submitBtn.disabled = false;
          submitBtn.textContent = "🌸 Confirmar y Emitir Pedido";
        }
      } catch (err) {
        alert(`Error de conexión con el servidor Farfalina: ${err.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = "🌸 Confirmar y Emitir Pedido";
      }
    });
  }

  // =========================================================================================
  // MODAL DRAWER 2: CREAR RESERVA DE VESTIDO (CARISSMA) DIRECTO DESDE META BUSINESS SUITE
  // =========================================================================================

  async function openDressRentalDrawer() {
    const existing = document.getElementById("carissma-rental-modal-backdrop");
    if (existing) existing.remove();

    if (!catalogData.dresses || catalogData.dresses.length === 0) {
      await loadCatalogFromBackend();
    }

    const clientNameVal = activeContact.name || "Clienta Carissma";
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

    // Generar opciones de vestidos desde catálogo o defaults
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
      <!-- Modal Header -->
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

      <!-- Form Body -->
      <form id="carissma-rental-form" style="padding: 20px; display: flex; flex-direction: column; gap: 14px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #fefce8; padding: 12px; border-radius: 12px; border: 1px solid #fef08a;">
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #713f12; margin-bottom: 4px;">Nombre Clienta *</label>
            <input type="text" id="rental-client-name" value="${clientNameVal}" required style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #ca8a04; border-radius: 8px; font-weight: 600; color: #1c1917;" />
          </div>
          <div>
            <label style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #713f12; margin-bottom: 4px;">Teléfono / WhatsApp</label>
            <input type="text" id="rental-client-phone" value="${clientPhoneVal}" style="width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; border: 1px solid #ca8a04; border-radius: 8px; font-family: monospace; color: #1c1917;" />
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
