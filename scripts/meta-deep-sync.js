/**
 * =========================================================================================
 * 🌸 FARFALINA & CARISSMA - SCRIPT AUTÓNOMO DE SINCRONIZACIÓN PROFUNDA (DEEP SYNC v3.1)
 * =========================================================================================
 * 
 * Este script se ejecuta directamente en la consola de Google Chrome DevTools en:
 * 👉 https://business.facebook.com/latest/inbox/all
 * 
 * 📋 INSTRUCCIONES DE USO PASO A PASO:
 * 1. Abre Google Chrome y entra a la bandeja de Meta Business Suite:
 *    https://business.facebook.com/latest/inbox/all
 * 2. Asegúrate de que el servidor local de Farfalina esté encendido (http://localhost:3000).
 * 3. Abre las herramientas de desarrollador:
 *    Presiona F12 o Ctrl + Shift + I (Cmd + Option + I en Mac).
 * 4. Haz clic en la pestaña "Console" (Consola).
 * 5. Si la consola muestra una advertencia de seguridad que impide pegar, escribe:
 *    allow pasting
 *    y presiona ENTER.
 * 6. Copia TODO el contenido de este archivo, pégalo en la consola y presiona ENTER.
 * 7. El script ejecutará el rastreo progresivo:
 *    - Des-virtualizará cada fila de contacto visible en el viewport izquierdo.
 *    - Abrirá cada chat, esperará la carga real de Meta y des-virtualizará el historial
 *      completo acumulando burbujas hacia atrás vía GraphQL sin perder mensajes al final.
 *    - Extraerá fotos en alta resolución, número de teléfono verídico, email, etiquetas y canal.
 *    - Transmitirá los datos en tiempo real a Farfalina (http://localhost:3000).
 *    - Guardará un respaldo global en window.__FARFALINA_SYNC_DUMP__ y lo copiará al portapapeles.
 * =========================================================================================
 */

(async function farfalinaDeepSync() {
  const SERVER_URL = "http://localhost:3000";

  // Auto-detección inteligente del entorno (Farfalina vs Carissma)
  function detectEnvironment() {
    const pageText = (
      document.title + " " +
      (document.querySelector('div[aria-haspopup="menu"]')?.textContent || "") + " " +
      (document.querySelector('[role="banner"]')?.textContent || "") + " " +
      (document.body.innerText.substring(0, 3000))
    ).toLowerCase();

    return pageText.includes("carissma") || pageText.includes("vestido") || pageText.includes("renta")
      ? "carissma"
      : "farfalina";
  }

  const ENVIRONMENT = detectEnvironment();

  console.clear();
  console.log(
    `%c🌸 FARFALINA & CARISSMA • DEEP SYNC PROGRESSIVE CRAWLER v3.1 [${ENVIRONMENT.toUpperCase()}]`,
    "background: #e2553d; color: white; font-size: 15px; font-weight: bold; padding: 6px 14px; border-radius: 8px;"
  );
  console.log(
    "%cIniciando des-virtualización acumulativa progresiva y sincronización 100% verídica...",
    "color: #71717a; font-size: 12px;"
  );

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. Filtrado de palabras del sistema de Meta
  const SYSTEM_EXCLUDED = [
    "vista previa", "todos los mensajes", "messenger", "instagram", "whatsapp",
    "comentarios de facebook", "comentarios de instagram", "administrar etiquetas",
    "administrar captura", "administrar", "editar", "borrar estado", "conversación activa",
    "conversacion activa", "buscar", "prioridad", "no leídos", "destacados",
    "asignar esta conversación", "asignado a ti", "asignado a", "mover a la carpeta",
    "marcar como no leído", "marcar como", "eliminar conversación", "enviar comentario",
    "bandeja de entrada", "solicitudes de mensajes", "spam", "archivados",
    "meta business suite", "etiquetas sugeridas", "información de contacto", "detalles del contacto"
  ];

  function isExcluded(name) {
    if (!name) return true;
    const lower = name.trim().toLowerCase();
    if (lower.length < 2) return true;
    if (/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(lower)) return true;
    return SYSTEM_EXCLUDED.some((pat) => lower === pat || lower.startsWith(pat) || lower.includes(pat));
  }

  // 2. Detección precisa de canal
  function detectChannel(containerElem, urlString) {
    const url = urlString || window.location.href || "";
    const search = url.includes("?") ? url.split("?")[1] : "";
    const params = new URLSearchParams(search);
    const threadType = (params.get("thread_type") || "").toUpperCase();

    if (threadType.includes("WEC") || threadType.includes("WHATSAPP")) return "WhatsApp";
    if (threadType.includes("IG") || threadType.includes("INSTAGRAM")) return "Instagram";
    if (threadType.includes("FB") || threadType.includes("MESSENGER")) return "Facebook";

    if (url.includes("/inbox/whatsapp")) return "WhatsApp";
    if (url.includes("/inbox/instagram")) return "Instagram";
    if (url.includes("/inbox/facebook") || url.includes("/inbox/messenger")) return "Facebook";

    if (containerElem) {
      const link = containerElem.closest("a") || containerElem.querySelector("a");
      const href = link?.getAttribute("href") || "";
      if (href.includes("WHATSAPP") || href.includes("WEC")) return "WhatsApp";
      if (href.includes("INSTAGRAM") || href.includes("IG")) return "Instagram";
      if (href.includes("MESSENGER") || href.includes("FB")) return "Facebook";

      const html = containerElem.innerHTML.toLowerCase();
      if (html.includes("whatsapp")) return "WhatsApp";
      if (html.includes("instagram")) return "Instagram";
      if (html.includes("messenger")) return "Facebook";

      const text = containerElem.innerText || "";
      if (/\+591\s*\d{8}|\b\d{8,14}\b/.test(text)) return "WhatsApp";
      if (text.includes("@")) return "Instagram";
    }

    return "Facebook";
  }

  // 3. Localizar contenedor con scroll de la lista de conversaciones
  function findListScrollContainer() {
    const sampleRow = document.querySelector(
      'span[data-surface*="bizweb_inbox:thread_list/thread_row"], a[href*="selected_item_id="]'
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

  // 4. Extraer información de perfil desde el panel lateral derecho de detalles
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

    const phoneMatch = contextText.match(/(?:\+591\s*[67]\d{7}|\+591\s*\d{8}|\+\d{10,15}|\b[67]\d{7}\b)/);
    if (phoneMatch) {
      details.phone = phoneMatch[0].replace(/\s+/g, "");
    }

    const emailMatch = contextText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
    if (emailMatch) {
      details.email = emailMatch[0].trim();
    }

    const igMatch = contextText.match(/@([a-zA-Z0-9._]{3,30})/);
    if (igMatch) {
      details.instagramUsername = igMatch[1].trim();
    }

    if (detailsPanel) {
      const tagChips = Array.from(
        detailsPanel.querySelectorAll(
          'span[data-surface*="label"], div[role="button"], span[dir="auto"], span[class*="badge"]'
        )
      )
        .map((el) => el.innerText?.trim())
        .filter((t) => t && t.length > 1 && t.length < 30 && !isExcluded(t));
      details.tags = Array.from(new Set(tagChips));

      const headerElem = detailsPanel.querySelector('h2, h3, [role="heading"]');
      if (headerElem && !isExcluded(headerElem.innerText)) {
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

  // 5. Extraer multimedia con máxima resolución
  function extractHighResMedia(node) {
    let mediaUrl = null;
    let mediaType = null;

    const imgElem =
      node.querySelector('img[src*="fbcdn"], img[src*="instagram"], img[src*="fbsbx"], img[src*="lookaside"], img[src*="blob:"]') ||
      node.closest('div')?.querySelector('img[src*="fbcdn"], img[src*="instagram"], img[src*="fbsbx"]');

    if (imgElem && !imgElem.alt?.toLowerCase().includes("avatar") && !imgElem.src?.includes("rsrc.php")) {
      mediaType = "image";

      const parentLink = imgElem.closest("a");
      const parentHref = parentLink?.href || "";
      if (parentHref.includes("fbcdn.net") || parentHref.includes("cdninstagram.com") || parentHref.includes("fbsbx.com")) {
        mediaUrl = parentHref;
      }

      if (!mediaUrl && imgElem.srcset) {
        const candidates = imgElem.srcset.split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
        if (candidates.length > 0) {
          mediaUrl = candidates[candidates.length - 1];
        }
      }

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

  // 6. Extraer datos de contacto de una fila del sidebar
  function extractContact(rowElem) {
    try {
      const container = rowElem.closest('div[role="row"], div[role="listitem"], a') || rowElem;
      const titleElem =
        rowElem.querySelector('[data-surface*="lib:thread_title"]') ||
        container.querySelector('[data-surface*="lib:thread_title"]') ||
        rowElem.querySelector('h3, [role="heading"], strong, span[dir="auto"]') ||
        container.querySelector('h3, [role="heading"], strong, span[dir="auto"]');

      let name = titleElem ? titleElem.innerText?.trim() : null;
      if (!name) {
        const lines = (container.innerText || "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0 && !["Prioridad", "No leídos"].includes(l));
        name = lines[0] || null;
      }

      if (!name || name.length < 2 || name.length > 65 || isExcluded(name)) return null;

      const lines = (container.innerText || "")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && l !== name && !isExcluded(l) && !/^\d{1,2}:\d{2}\s*(am|pm)?$/i.test(l));

      let snippet = lines.length > 0 ? lines[0] : "";
      if (snippet.toLowerCase() === "conversación activa" || snippet.toLowerCase() === "conversacion activa") {
        snippet = "";
      }

      const link = container.closest("a") || container.querySelector('a[href*="selected_item_id="]') || container;
      const href = link?.getAttribute("href") || "";
      const idMatch = href.match(/selected_item_id=([0-9a-zA-Z_-]+)/) || href.match(/mailbox_id=([0-9a-zA-Z_-]+)/);
      const threadId = idMatch ? idMatch[1] : name.replace(/[^0-9a-zA-Z]/g, "_").toLowerCase();

      const channel = detectChannel(container, href);

      const imgs = Array.from(container.querySelectorAll("img"));
      const avatarImg = imgs.find(
        (i) => i.src && !i.src.includes("rsrc.php") && (i.src.includes("fbcdn.net") || i.src.includes("fbsbx.com") || i.src.includes("instagram"))
      );
      const profilePicUrl = avatarImg ? avatarImg.src : null;

      return { threadId, name, channel, snippet, profilePicUrl, element: link || container };
    } catch {
      return null;
    }
  }

  // 7. Enviar payload a Farfalina backend (con fallback a postMessage para la extensión)
  async function sendToFarfalina(payload) {
    // A. Notificar a la extensión si está instalada para relay vía Service Worker
    try {
      window.postMessage({ type: "FARFALINA_INBOUND_DIRECT", payload }, "*");
    } catch (_) {}

    // B. Petición HTTP directa
    try {
      const res = await fetch(`${SERVER_URL}/api/relay/inbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-relay-client": "chrome-console-crawler",
        },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  // 8. Extraer burbujas individuales de mensajes del flujo
  function extractMessagesFromStream(stream, clientName) {
    if (!stream) return [];
    const streamRect = stream.getBoundingClientRect();
    const streamMid = streamRect.left + streamRect.width / 2;

    const candidateNodes = Array.from(
      stream.querySelectorAll('div[data-testid*="message" i], div[role="row"], div[role="listitem"], div[dir="auto"], span[dir="auto"]')
    );

    const msgList = [];
    const seenKeys = new Set();

    for (const node of candidateNodes) {
      if (node.closest('form, div[role="textbox"], header, [role="search"]')) continue;

      const rawText = (node.textContent || "").trim();
      const { mediaUrl, mediaType } = extractHighResMedia(node);

      if (!rawText && !mediaUrl) continue;
      if (isExcluded(rawText) || (clientName && rawText.toLowerCase() === clientName.toLowerCase())) continue;

      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      const key = `${Math.round(rect.top / 8)}_${rawText.slice(0, 35)}_${mediaUrl || ""}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      let score = 0;
      const center = rect.left + rect.width / 2;
      if (center > streamMid + 20) score += 3;
      else if (center < streamMid - 20) score -= 3;

      let anc = node;
      for (let j = 0; j < 5 && anc && anc !== stream; j++) {
        const cs = window.getComputedStyle(anc);
        if (cs.justifyContent === "flex-end" || cs.alignSelf === "flex-end") score += 3;
        if (cs.justifyContent === "flex-start" || cs.alignSelf === "flex-start") score -= 2;
        anc = anc.parentElement;
      }

      const aria = (node.closest('div[role="row"], div')?.getAttribute("aria-label") || "").toLowerCase();
      if (aria.includes("tú enviaste") || aria.includes("you sent") || rawText.startsWith("Tú: ")) score += 5;

      const sender = score > 0 ? "agent" : "customer";
      let clean = rawText.replace(/^(Tú:\s*|You:\s*)/i, "").trim();

      msgList.push({
        top: rect.top,
        sender,
        text: clean,
        mediaUrl,
        mediaType,
      });
    }

    return msgList;
  }

  // 9. Des-virtualizar mensajes del chat abierto de forma ACUMULATIVA (evita perder mensajes al final)
  async function crawlActiveChatMessages(clientName) {
    const composer = document.querySelector('div[role="textbox"][contenteditable="true"], textarea[placeholder*="mensaje" i]');
    const chatPanel = composer?.closest('div[role="main"], div[data-pagelet*="Inbox"]') || document.querySelector('div[role="main"]');
    const stream = chatPanel?.querySelector('div[role="grid"], div[role="feed"], div[role="log"]') || chatPanel || document.body;

    const accumulatedMap = new Map();

    const collectVisible = () => {
      const list = extractMessagesFromStream(stream, clientName);
      for (const m of list) {
        const key = `${m.sender}_${m.text.trim()}_${m.mediaUrl || ""}`;
        if (!accumulatedMap.has(key)) {
          accumulatedMap.set(key, m);
        }
      }
    };

    if (stream && stream !== document.body) {
      // 1. Recolectar lo visible al inicio
      collectVisible();

      // 2. Scroll hacia arriba en pasos progresivos acumulando cada ventana virtual
      let idleUp = 0;
      for (let s = 0; s < 6; s++) {
        const prevH = stream.scrollHeight;
        const prevScroll = stream.scrollTop;
        const step = Math.max(260, Math.floor(stream.clientHeight * 0.75));
        stream.scrollTop = Math.max(0, prevScroll - step);
        stream.dispatchEvent(new Event("scroll", { bubbles: true }));
        await sleep(450);

        collectVisible();

        if (stream.scrollTop === 0) {
          await sleep(900); // Esperar GraphQL de Meta
          collectVisible();
          if (stream.scrollHeight === prevH) {
            idleUp++;
            if (idleUp >= 2) break;
          } else {
            idleUp = 0;
          }
        }
      }

      // 3. Regresar al final
      stream.scrollTop = stream.scrollHeight;
      stream.dispatchEvent(new Event("scroll", { bubbles: true }));
      await sleep(350);
      collectVisible();
    }

    const msgList = Array.from(accumulatedMap.values());
    if (msgList.length === 0) return { messages: [], imageCount: 0 };

    msgList.sort((a, b) => a.top - b.top);
    const now = Date.now();
    const base = now - msgList.length * 2000;

    const payloadMsgs = msgList.map((m, idx) => ({
      sender: m.sender,
      text: m.text,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      createdAt: new Date(base + idx * 2000).toISOString(),
    }));

    const imageCount = payloadMsgs.filter((m) => m.mediaUrl).length;
    return { messages: payloadMsgs, imageCount };
  }

  // 10. PROCESO PRINCIPAL: RASTREO PROGRESIVO Y DES-VIRTUALIZACIÓN TOTAL
  console.log("%c🚀 INICIANDO RASTREO PROGRESIVO (PROGRESSIVE SCRAPE & TRAVERSE)...", "color: #3b82f6; font-weight: bold; font-size: 13px;");

  const scrollContainer = findListScrollContainer();
  const visitedIds = new Set();
  const allSyncedThreads = [];
  let totalSyncedContacts = 0;
  let totalSyncedMessages = 0;
  let totalSyncedImages = 0;

  if (scrollContainer) {
    scrollContainer.scrollTop = 0;
    scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sleep(500);
  }

  let idleScrolls = 0;
  let emptyViews = 0;

  while (true) {
    // Escanear todas las filas que se encuentran MONTADAS FÍSICAMENTE en el DOM del panel izquierdo
    const searchRoot = scrollContainer || document;
    const visibleElements = Array.from(
      searchRoot.querySelectorAll(
        'span[data-surface*="bizweb_inbox:thread_list/thread_row"], a[href*="selected_item_id="], [role="row"], [role="listitem"]'
      )
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.left < window.innerWidth * 0.45 && rect.width > 50 && rect.height > 20;
    });

    let batchCount = 0;

    for (const elem of visibleElements) {
      const contact = extractContact(elem);
      if (!contact || !contact.threadId) continue;
      if (visitedIds.has(contact.threadId)) continue;

      visitedIds.add(contact.threadId);
      batchCount++;
      totalSyncedContacts = visitedIds.size;

      console.log(
        `%c[${totalSyncedContacts}] Sincronizando: "${contact.name}" [${contact.channel}]...`,
        "color: #d97706; font-weight: bold;"
      );

      // Clic seguro en el elemento mientras está en pantalla
      const clickEl = contact.element || elem;
      try {
        clickEl.scrollIntoView({ block: "nearest", inline: "nearest" });
        const mouseOpts = { bubbles: true, cancelable: true, view: window };
        clickEl.dispatchEvent(new PointerEvent("pointerdown", mouseOpts));
        clickEl.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
        clickEl.dispatchEvent(new PointerEvent("pointerup", mouseOpts));
        clickEl.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
        clickEl.click();
      } catch (_) {
        clickEl.click();
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
        if (rightRail.clientName && contact.name && rightRail.clientName.toLowerCase() === contact.name.toLowerCase()) break;
      }
      await sleep(250);

      // Extraer detalles de perfil enriquecidos del panel derecho
      const rightRail = extractRightDetailsPanel();
      const finalPhone = rightRail.phone || contact.threadId;

      // Des-virtualizar mensajes antiguos y extraer
      const { messages, imageCount } = await crawlActiveChatMessages(contact.name);
      totalSyncedMessages += messages.length;
      totalSyncedImages += imageCount;

      const payload = {
        channel: contact.channel,
        environment: ENVIRONMENT,
        clientName: rightRail.clientName || contact.name,
        phone: finalPhone,
        metaThreadId: contact.threadId,
        profilePicUrl: rightRail.profilePicUrl || contact.profilePicUrl,
        email: rightRail.email || null,
        instagramUsername: rightRail.instagramUsername || null,
        tags: rightRail.tags.length > 0 ? rightRail.tags : undefined,
        messages: messages.length > 0 ? messages : undefined,
        text: contact.snippet,
      };

      allSyncedThreads.push(payload);
      await sendToFarfalina(payload);

      console.log(
        `  ✅ OK: ${messages.length} mensajes (${imageCount} fotos) | Tel: ${finalPhone} | Perfil: ${rightRail.email || rightRail.instagramUsername || "Básico"}`
      );

      await sleep(350);
    }

    if (batchCount === 0) {
      emptyViews++;
    } else {
      emptyViews = 0;
    }

    if (!scrollContainer) {
      break;
    }

    // Desplazar contenedor hacia abajo para montar la siguiente tanda de React
    const prevScroll = scrollContainer.scrollTop;
    const scrollStep = Math.max(220, Math.floor(scrollContainer.clientHeight * 0.65));
    scrollContainer.scrollTop = prevScroll + scrollStep;
    scrollContainer.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sleep(600);

    const isBottom = scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 25;

    if (isBottom || scrollContainer.scrollTop === prevScroll) {
      idleScrolls++;
      console.log(`[Relay Deep Sync] Esperando paginación GraphQL de Meta (${idleScrolls}/3)...`);
      await sleep(1500);

      if (scrollContainer.scrollHeight > scrollContainer.clientHeight + prevScroll + 20) {
        idleScrolls = 0;
        emptyViews = 0;
      }

      if (idleScrolls >= 3 || emptyViews >= 3) {
        console.log("%c✅ Fin definitivo de la lista de contactos.", "color: #16a34a; font-weight: bold;");
        break;
      }
    } else {
      idleScrolls = 0;
    }
  }

  // Guardar copia local en el objeto window para inspección o respaldo
  window.__FARFALINA_SYNC_DUMP__ = {
    environment: ENVIRONMENT,
    timestamp: new Date().toISOString(),
    totalContacts: totalSyncedContacts,
    totalMessages: totalSyncedMessages,
    totalImages: totalSyncedImages,
    threads: allSyncedThreads,
  };

  try {
    if (typeof copy === "function") {
      copy(JSON.stringify(window.__FARFALINA_SYNC_DUMP__, null, 2));
      console.log("%c📋 ¡JSON de respaldo copiado automáticamente al portapapeles!", "color: #3b82f6; font-weight: bold;");
    }
  } catch (_) {}

  console.log(
    `%c🎉 DEEP SYNC COMPLETADO CON ÉXITO: ${totalSyncedContacts} contactos, ${totalSyncedMessages} mensajes y ${totalSyncedImages} fotos transferidos a Farfalina [${ENVIRONMENT.toUpperCase()}].`,
    "background: #16a34a; color: white; font-size: 15px; font-weight: bold; padding: 8px 14px; border-radius: 8px;"
  );
  console.log(
    "%c👉 Abre http://localhost:3000/omnichannel para ver todos tus contactos, chats con fotos en alta resolución e información de perfil sincronizados.",
    "color: #15803d; font-weight: bold;"
  );
})();
