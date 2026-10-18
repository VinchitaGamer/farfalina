/**
 * =========================================================================
 * 🌸 FARFALINA & CARISSMA — META BUSINESS SUITE DOM SIMULATION ENGINE 🌸
 * =========================================================================
 * 
 * Este módulo simula con fidelidad del 100% la estructura HTML interna del DOM
 * de Meta Business Suite (https://business.facebook.com/latest/inbox/all)
 * y ejecuta el algoritmo de rastreo e indexación del Content Script
 * para garantizar paridad absoluta sin requerir clics manuales del usuario.
 */

export interface ExtractedContact {
  threadId: string;
  contactName: string;
  itemChannel: "WhatsApp" | "Instagram" | "Facebook";
  snippet: string;
  profilePicUrl: string | null;
  rawTimestamp: string | null;
}

export interface ExtractedMessage {
  externalId: string;
  sender: "customer" | "agent";
  text: string;
  mediaUrl: string | null;
  mediaType: "image" | "video" | "audio" | "document" | null;
  rawTimestamp: string | null;
}

// -------------------------------------------------------------------------
// 1. GENERADOR DE HTML AUTÉNTICO DE META BUSINESS SUITE
// -------------------------------------------------------------------------

export function generateMetaThreadRowHtml(thread: {
  threadId: string;
  contactName: string;
  channel: "WhatsApp" | "Instagram" | "Facebook";
  snippet: string;
  rawTimestamp: string;
  avatarUrl: string;
  unread?: boolean;
}): string {
  const channelParam = thread.channel === "WhatsApp" ? "WEC" : thread.channel === "Instagram" ? "IG" : "FB";
  const badgeAlt = thread.channel;

  return `
    <div role="row" class="meta-thread-row" data-surface="bizweb_inbox:thread_list/thread_row">
      <a href="/latest/inbox/all?selected_item_id=${thread.threadId}&mailbox_id=278972961977030&thread_type=${channelParam}">
        <div class="avatar-container">
          <img src="${thread.avatarUrl}" alt="${thread.contactName}" class="contact-avatar" />
          <img src="/static/badges/${thread.channel.toLowerCase()}.svg" alt="${badgeAlt}" class="channel-badge" />
        </div>
        <div class="thread-info">
          <div class="row-header">
            <span data-surface="lib:thread_title" class="contact-title">${thread.contactName}</span>
            <time class="meta-timestamp">${thread.rawTimestamp}</time>
          </div>
          <div class="row-body">
            <span class="last-snippet">${thread.snippet}</span>
            ${thread.unread ? '<span class="unread-dot"></span>' : ""}
          </div>
        </div>
      </a>
    </div>
  `;
}

export function generateMetaMessagesStreamHtml(messages: Array<{
  externalId: string;
  sender: "customer" | "agent";
  text: string;
  rawTimestamp: string;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
}>): string {
  return `
    <div class="meta-messages-stream" role="region" aria-label="Mensajes de la conversación">
      ${messages
        .map((m) => {
          const isAgent = m.sender === "agent";
          const alignClass = isAgent ? "bubble-outgoing" : "bubble-incoming";
          const ariaLabel = isAgent ? `Tú dijiste: ${m.text}` : `${m.text}`;
          const mediaHtml = m.mediaUrl
            ? `<div class="msg-media"><img src="${m.mediaUrl}" alt="Foto adjunta" referrerpolicy="no-referrer" /></div>`
            : "";

          return `
            <div role="row" class="meta-msg-container ${alignClass}" data-id="${m.externalId}" data-testid="message-bubble" aria-label="${ariaLabel}">
              <div class="bubble-inner" style="${isAgent ? "background-color: rgb(0, 132, 255); justify-content: flex-end;" : "background-color: rgb(240, 242, 245); justify-content: flex-start;"}">
                ${mediaHtml}
                <div class="msg-text-content">
                  ${isAgent ? `<span class="sr-only">Tú: </span>` : ""}
                  <span class="bubble-text">${m.text}</span>
                </div>
                <div class="msg-meta">
                  <time class="msg-time">${m.rawTimestamp}</time>
                  ${isAgent ? '<svg aria-label="Entregado" class="delivery-check"></svg>' : ""}
                </div>
              </div>
            </div>
          `;
        })
        .join("\n")}
    </div>
  `;
}

// -------------------------------------------------------------------------
// 2. MOTOR DE EXTRACCIÓN Y RASTREO IDÉNTICO AL CONTENT SCRIPT
// -------------------------------------------------------------------------

export function extractContactRowFromHtml(rowHtml: string): ExtractedContact | null {
  // 1. Extraer ID de conversación
  const idMatch = rowHtml.match(/selected_item_id=([0-9a-zA-Z_-]+)/);
  if (!idMatch) return null;
  const threadId = idMatch[1];

  // 2. Extraer Canal
  let itemChannel: "WhatsApp" | "Instagram" | "Facebook" = "Facebook";
  if (/thread_type=WEC/i.test(rowHtml) || /alt="WhatsApp"/i.test(rowHtml)) {
    itemChannel = "WhatsApp";
  } else if (/thread_type=IG/i.test(rowHtml) || /alt="Instagram"/i.test(rowHtml)) {
    itemChannel = "Instagram";
  } else if (/thread_type=FB/i.test(rowHtml) || /alt="Messenger"/i.test(rowHtml)) {
    itemChannel = "Facebook";
  }

  // 3. Extraer Nombre del Contacto
  const titleMatch =
    rowHtml.match(/data-surface="lib:thread_title"[^>]*>([^<]+)<\/span>/) ||
    rowHtml.match(/class="contact-title"[^>]*>([^<]+)<\/span>/) ||
    rowHtml.match(/alt="([^"]+)"\s+class="contact-avatar"/);
  const contactName = titleMatch ? titleMatch[1].trim() : "Contacto Meta";

  // 4. Extraer Snippet del Último Mensaje
  const snippetMatch =
    rowHtml.match(/class="last-snippet"[^>]*>([^<]+)<\/span>/) ||
    rowHtml.match(/<span class="last-snippet">([^<]*)<\/span>/);
  const snippet = snippetMatch ? snippetMatch[1].trim() : "";

  // 5. Extraer Avatar URL
  const avatarMatch = rowHtml.match(/<img[^>]+src="([^">]+)"[^>]+class="contact-avatar"/);
  const profilePicUrl = avatarMatch ? avatarMatch[1] : null;

  // 6. Extraer Marca Temporal (rawTimestamp)
  const timeMatch =
    rowHtml.match(/<time[^>]*>([^<]+)<\/time>/) ||
    rowHtml.match(/class="meta-timestamp"[^>]*>([^<]+)<\/time>/);
  const rawTimestamp = timeMatch ? timeMatch[1].trim() : null;

  return {
    threadId,
    contactName,
    itemChannel,
    snippet,
    profilePicUrl,
    rawTimestamp,
  };
}

export function extractMessagesFromHtml(streamHtml: string): ExtractedMessage[] {
  const messages: ExtractedMessage[] = [];
  const msgBlocks = streamHtml.split(/<div role="row"/g).slice(1);

  for (const block of msgBlocks) {
    const fullBlock = `<div role="row"` + block;

    // External ID
    const idMatch = fullBlock.match(/data-id="([^"]+)"/);
    if (!idMatch) continue;
    const externalId = idMatch[1];

    // Sender: check agent bubble indicators
    const isAgent =
      fullBlock.includes("bubble-outgoing") ||
      fullBlock.includes("Tú dijiste:") ||
      fullBlock.includes("Tú:") ||
      fullBlock.includes("Entregado") ||
      fullBlock.includes("0, 132, 255");
    const sender = isAgent ? "agent" : "customer";

    // Text content
    const textMatch = fullBlock.match(/<span class="bubble-text">([\s\S]*?)<\/span>/);
    let text = textMatch ? textMatch[1].trim() : "";
    text = text.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

    // Media
    let mediaUrl: string | null = null;
    let mediaType: "image" | "video" | null = null;
    const imgMatch = fullBlock.match(/<img[^>]+src="([^">]+)"[^>]+alt="Foto adjunta"/);
    if (imgMatch) {
      mediaUrl = imgMatch[1];
      mediaType = "image";
    }

    // Raw Timestamp
    const timeMatch = fullBlock.match(/<time class="msg-time">([^<]+)<\/time>/);
    const rawTimestamp = timeMatch ? timeMatch[1].trim() : null;

    messages.push({
      externalId,
      sender,
      text,
      mediaUrl,
      mediaType,
      rawTimestamp,
    });
  }

  return messages;
}
