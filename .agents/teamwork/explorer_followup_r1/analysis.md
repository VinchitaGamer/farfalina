# Informe Técnico de Investigación: Requisito R1 — Envío de Archivos Multimedia Salientes (Instagram Direct y WhatsApp)

**Fecha de Investigación**: 2026-10-06  
**Investigador**: Codebase Explorer R1 (`explorer_followup_r1`)  
**Directorio de Trabajo**: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r1`  
**Entorno Operativo**: Windows, Next.js 14 App Router, SQLite (`prisma/dev.db`), Cloudflare Tunnel (`https://omnichannel.farfalina.tech`), Meta Graph API v22.0.

---

## 1. Resumen Ejecutivo de Hallazgos

1. **Estado de la Interfaz (UI Chat)**: La interfaz unificada `components/shared/omnichannel/unified-omnichannel-view.tsx` ya cuenta con selector de archivos (`<input type="file">`, líneas 1408-1414), soporte para arrastrar o adjuntar imágenes, audios, videos y documentos (PDF/Office) de hasta 25MB, visor previo de adjuntos con chip desmontable y renderizado en burbujas con lightbox, reproductor de audio, video y tarjetas de descarga. No dispone aún de grabador de micrófono en vivo (Web MediaRecorder API).
2. **Causa Raíz del Fallo Histórico en Instagram Saliente**:
   - Al adjuntar archivos en la UI, el backend recibía `mediaBase64` y lo guardaba en disco (`public/uploads/instagram/out_...`), pero priorizaba enviar el `buffer` en memoria en lugar de una URL pública.
   - En `lib/meta-graph-api.ts` (`sendInstagramDirectMediaMessage`), el envío con `buffer` intentaba un POST multipart `form-data` con campo `filedata` hacia `https://graph.facebook.com/v22.0/me/messages`.
   - **Fallo Dual**: 
     a) Los tokens de usuario de Instagram (`IGAA...`) son rechazados por `graph.facebook.com` con `OAuthException 190` ("Cannot parse access token"). Requieren el host dedicado `https://graph.instagram.com/v22.0`.
     b) La API de Instagram Send **NO soporta** subida multipart `filedata`; exige obligatoriamente un objeto `attachment` con URL pública accesible (`payload: { url: "https://..." }`).
   - Además, la URL local generada (`/uploads/...`) era relativa y no era precedida por el dominio público HTTPS del túnel (`https://omnichannel.farfalina.tech`).
3. **Verificación en Vivo (Prueba Real Exitosa)**:
   - Se ejecutó una prueba directa contra `https://graph.instagram.com/v22.0/me/messages` enviando la URL pública del túnel (`https://omnichannel.farfalina.tech/uploads/...`) al usuario real de Instagram (`1304358138230682`).
   - **Resultado**: Los cuatro tipos de adjuntos fueron **aceptados y entregados exitosamente** por Meta, retornando IDs de mensaje legítimos:
     - `image`: ID `...066304`
     - `audio`: ID `...35744`
     - `video`: ID `...30464`
     - `file` (documento/PDF): ID `...33824`
4. **Despacho Saliente de WhatsApp**:
   - Dispone de 3 motores: Meta WhatsApp Cloud API v22.0 (`lib/meta-whatsapp.ts`), Evolution API (`lib/evolution-api.ts`) y Baileys WebSocket (`lib/baileys-socket-manager.ts`).
   - En `prisma/dev.db`, `whatsappPhoneNumberId` y `whatsappAccessToken` son nulos, por lo que el despacho opera vía Baileys o Evolution API. En Evolution API, se estaba enviando una ruta relativa `/uploads/...` en lugar de la URL pública o base64.
5. **Esquema de Base de Datos (`prisma/schema.prisma`)**:
   - `ChatMessage` ya cuenta con `mediaUrl String?` y `mediaType String?`. Es totalmente compatible.
   - Se recomienda de forma opcional y no destructiva agregar `mediaName String?` para preservar nombres originales de documentos sin depender del nombre sanitizado en disco.

---

## 2. Análisis Detallado por Componente

### 2.1. Componentes de UI del Chat Unificado

- **Ubicación Principal**: `components/shared/omnichannel/unified-omnichannel-view.tsx` (utilizado por `/floreria/omnichannel` y `/carissma/omnichannel`).
- **Control de Selección de Archivos** (Líneas 1408–1424):
  ```tsx
  <input
    ref={fileInputRef}
    type="file"
    onChange={handleFileChange}
    accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,audio/*,video/*"
    className="hidden"
  />
  <button
    type="button"
    onClick={() => fileInputRef.current?.click()}
    disabled={isSending}
    title="Adjuntar foto o catálogo"
  >
    <Paperclip className="h-4 w-4" />
  </button>
  ```
- **Manejo de Archivos en Cliente** (Líneas 525–546):
  - Validación de tamaño: límite estricto de 25 MB (`file.size > 25 * 1024 * 1024`).
  - Lectura en memoria vía `FileReader.readAsDataURL(file)` almacenando en estado `attachedFile`:
    - `name`: nombre del archivo.
    - `type`: MIME type (`image/jpeg`, `application/pdf`, etc.).
    - `base64`: string DataURL (`data:...;base64,...`).
    - `previewUrl`: DataURL para imágenes.
- **Chip de Previsualización** (Líneas 1368–1404):
  - Miniatura para imágenes.
  - Iconos específicos según categoría: `Film` para video, `Volume2` para audio, `FileText` para documentos.
  - Botón de remoción (`X`) que limpia el estado y resetea `fileInputRef.current.value`.
- **Integración con Respuestas Rápidas (QuickReplies)** (Líneas 606–619):
  - Soporta cargar adjuntos predefinidos desde el catálogo/respuestas rápidas mediante `existingUrl`.
- **Disparador del Envío** (Líneas 548–582):
  - Se activa con tecla Enter en el input de texto o clic en el botón Send (`handleSendMessage`).
  - Invoca la Server Action `sendChatMessageAction`:
    ```tsx
    const res = await sendChatMessageAction({
      threadId: activeThread.id,
      sender: "agent",
      text: textToSend,
      mediaBase64: currentAttachment?.base64 || null,
      mediaMimeType: currentAttachment?.type || null,
      mediaFileName: currentAttachment?.name || null,
      mediaUrl: currentAttachment?.existingUrl || null,
    });
    ```
- **Visualización en Burbujas de Chat** (Líneas 1154–1324):
  - Imágenes: `img` con visor Lightbox en pantalla completa al hacer clic, con fallback automático a `/api/media/...` si falla `/uploads/...`.
  - Videos: reproductor nativo `<video controls preload="metadata">`.
  - Audios: reproductor nativo `<audio controls preload="metadata">`.
  - Documentos: tarjeta descargable estilizada con icono, nombre del archivo y enlace directo con atributo `download`.

---

### 2.2. Manejo de Subida Local y Exposición Pública de Archivos

- **Directorio Local de Almacenamiento**:
  - Ruta base: `c:\Users\Lenovo\Desktop\floreria\public\uploads\`
  - Subdirectorios por canal:
    - `public/uploads/instagram/`
    - `public/uploads/whatsapp/`
    - `public/uploads/quick-replies/`
    - `public/uploads/meta/`
  - Comprobación en disco: Existen archivos reales almacenados con permisos de lectura/escritura correctos.
- **Lógica de Persistencia Local** (`app/actions/omnichannel.ts`, líneas 285–311):
  ```typescript
  if (mediaBase64 && mediaMimeType) {
    const fs = await import("fs");
    const path = await import("path");
    const channelFolder = thread?.channel?.toLowerCase() === "facebook" ? "facebook" : thread?.channel?.toLowerCase() === "instagram" ? "instagram" : "whatsapp";
    const uploadsDir = path.join(process.cwd(), "public", "uploads", channelFolder);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const ext = mediaMimeType.split("/")[1]?.split(";")[0] || "bin";
    const fname = `out_${Date.now()}_${mediaFileName ? mediaFileName.replace(/[^a-zA-Z0-9._-]/g, "_") : `file.${ext}`}`;
    const filePath = path.join(uploadsDir, fname);
    const cleanBase64 = mediaBase64.includes(",") ? mediaBase64.split(",")[1] : mediaBase64;
    fs.writeFileSync(filePath, Buffer.from(cleanBase64, "base64"));
    savedMediaUrl = `/uploads/${channelFolder}/${fname}`;
  }
  ```
- **Endpoints de Entrega de Archivos**:
  - `app/uploads/[...path]/route.ts`: Atiende `GET /uploads/...` delegando a `resolveSafeMediaFilePath` y `serveMediaFileResponse` de `@/lib/media-server`.
  - `app/api/media/[...path]/route.ts`: Endpoint alternativo para serving con prevención de path traversal y soporte para peticiones HTTP 206 Partial Content (esencial para streaming de notas de voz OGG/Opus y seek de videos).
- **Resolución Pública vía Cloudflare Tunnel**:
  - Dominio público activo: `https://omnichannel.farfalina.tech`.
  - Se verificó mediante petición HTTP que `https://omnichannel.farfalina.tech/uploads/...` devuelve status **200 OK** con cabecera `Content-Type: image/jpeg` y tamaño exacto del archivo físico.
  - **Construcción de URL Pública Requerida**:
    ```typescript
    const publicBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://omnichannel.farfalina.tech";
    const publicMediaUrl = savedMediaUrl.startsWith("http") ? savedMediaUrl : `${publicBaseUrl}${savedMediaUrl}`;
    ```

---

### 2.3. APIs de Despacho Saliente

#### 2.3.1. Instagram Direct (Meta Graph API)
- **Ubicación del Servicio**: `lib/meta-graph-api.ts`.
- **Funciones Existentes**:
  - `sendInstagramDirectTextMessage(params: { accessToken, recipientIgsid, text })`
  - `sendInstagramDirectMediaMessage(params: { accessToken, recipientIgsid, buffer?, mimeType, filename?, mediaUrl?, caption? })`
- **Mapeo de Tipos de Adjunto**:
  - La API de Instagram Messaging soporta 4 tipos de adjuntos:
    - `"image"` (JPEG, PNG, WEBP, GIF)
    - `"audio"` (Notas de voz / clips de audio)
    - `"video"` (MP4, MOV)
    - `"file"` (Documentos, PDF, DOCX, XLSX, etc.)
  - *Discrepancia detectada*: En `lib/meta-graph-api.ts` (líneas 419–422), solo se mapeaban `"video"` y `"audio"`, asignando `"image"` por defecto a los documentos PDF. Se debe incluir:
    ```typescript
    let metaMediaType: "image" | "video" | "audio" | "file" = "image";
    if (mimeType.startsWith("video/")) metaMediaType = "video";
    else if (mimeType.startsWith("audio/")) metaMediaType = "audio";
    else if (mimeType.startsWith("application/") || mimeType === "document" || mimeType.includes("pdf")) metaMediaType = "file";
    ```
- **Protocolo de Envío URL vs Multipart**:
  - Instagram Direct **no admite** carga `multipart/form-data` con campo `filedata`.
  - El payload obligatorio es:
    ```json
    {
      "recipient": { "id": "<RECIPIENT_IGSID>" },
      "message": {
        "attachment": {
          "type": "image" | "audio" | "video" | "file",
          "payload": {
            "url": "https://omnichannel.farfalina.tech/uploads/..."
          }
        }
      }
    }
    ```
- **Host de la API según Tipo de Token**:
  - Si el token inicia con `IGAA...` (Token de usuario de Instagram Graph API):
    - URL: `https://graph.instagram.com/v22.0/me/messages?access_token=<TOKEN>`
  - Si el token inicia con `EA...` (Token de FanPage de Facebook asociado a cuenta IG profesional):
    - URL: `https://graph.facebook.com/v22.0/me/messages?access_token=<TOKEN>` o `https://graph.facebook.com/v22.0/{ig_user_id}/messages`

#### 2.3.2. WhatsApp Outbound
- **Motores Existentes**:
  1. **Meta WhatsApp Cloud API v22.0** (`lib/meta-whatsapp.ts`):
     - Operaciones:
       - `sendMetaWhatsAppTextMessage`
       - `uploadMetaWhatsAppMedia` (`POST /{phoneNumberId}/media`)
       - `sendMetaWhatsAppMediaMessage` (`POST /{phoneNumberId}/messages` con objeto `link` o `id`)
       - `sendMetaWhatsAppMediaFromBase64` (orquesta subida y envío)
     - Estado actual en BD: `whatsappPhoneNumberId` y `whatsappAccessToken` están sin configurar en `ChannelConfig` (valores null).
  2. **Evolution API** (`lib/evolution-api.ts`):
     - Configurado en `.env` con `EVOLUTION_API_URL=http://localhost:8080`.
     - Función: `sendEvolutionMediaMessage(params: { to, mediaUrl, mediaType, caption?, fileName? })`.
     - Endpoint: `POST {apiUrl}/message/sendMedia/{instance}`.
     - Nota: En Evolution API, el parámetro `media` requiere una URL pública accesible (`https://omnichannel.farfalina.tech/...`) o un DataURI en base64 (`data:image/jpeg;base64,...`). Pasar una ruta relativa local (`/uploads/...`) genera error HTTP en Evolution.
  3. **WhatsApp Web Socket (Baileys)** (`lib/baileys-socket-manager.ts`):
     - Función: `sendBaileysMediaMessage(phone, buffer, mimeType, filename?, caption?, env)`.
     - Envía directamente a través del WebSocket de Baileys (`socket.sendMessage(jid, { image: buffer, ... })`).
     - Requiere que la sesión esté en estado `CONNECTED`.

---

### 2.4. Persistencia y Esquema de Base de Datos (`prisma/schema.prisma`)

#### Modelo `ChatMessage` (Líneas 118–135)
```prisma
model ChatMessage {
  id           String     @id @default(cuid())
  threadId     String
  sender       String     // customer, bot, agent
  text         String
  mediaUrl     String?    // Ruta al archivo multimedia descargado o público
  mediaType    String?    // image, video, audio, document, sticker
  environment  String     @default("farfalina")
  externalId   String?    // ID único de mensaje de Meta o WhatsApp
  rawTimestamp String?    // Timestamp original legible ("10:45 AM", "Ayer", etc.)
  timestamp    DateTime?  // Timestamp normalizado monótono
  createdAt    DateTime   @default(now())
  thread       ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@unique([threadId, environment, id], name: "chatmessage_tenant_unique")
  @@index([threadId, createdAt])
  @@index([threadId, externalId])
}
```

- **Evaluación de Campos para Multimedia**:
  - `mediaUrl`: Ya existe. Almacena la ruta relativa local (`/uploads/...`) o la URL pública HTTPS.
  - `mediaType`: Ya existe. Almacena el discriminador (`image`, `video`, `audio`, `document`, `sticker`).
  - `attachmentType`: No existe en `ChatMessage` (existe en `QuickReply` con dicho nombre). No es necesario agregar otro campo duplicado si `mediaType` cumple exactamente esa función.
  - `fileName`: Actualmente no existe en `ChatMessage`. Se recomienda agregarlo como campo opcional no destructivo (`fileName String?`) para preservar el nombre de visualización original sin alterar el comportamiento existente.

#### Modelo `ChatThread` (Líneas 96–116)
- Campos relevantes:
  - `lastMessage`: String. Al enviar un adjunto sin texto, se registra `[Imagen]` o `[Archivo adjunto]`.
  - `lastMessageAt`: DateTime?. Actualizado con la marca de tiempo del mensaje saliente.
  - `updatedAt`: DateTime. Refresca el ordenamiento en la bandeja de entrada.

---

### 2.5. Contrato de Respuesta y Manejo de Errores

- **Contrato Universal**: Definido en `types/action-response.ts`:
  ```typescript
  export type ActionResponse<T = unknown> = {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
  };
  ```
- **Implementación en `sendChatMessageAction`**:
  - En validación de entrada (`SendMessageSchema.safeParse`):
    `{ success: false, error: parsed.error.issues[0]?.message, code: "VALIDATION_ERROR" }`
  - En fallo de despacho de Meta o socket:
    Registra advertencia en consola, asigna `outboundExternalId = null`, y si no fue enviado directamente, encola en `RelayOutboundQueue` con estado `PENDING`.
  - En éxito de creación:
    `{ success: true, data: newMessage }`
  - En captura de excepciones (`catch` block):
    `{ success: false, error: errorMessage, code: "CHAT_SEND_ERROR" }`

---

## 3. Matriz de Brechas y Soluciones Técnicas Recomendadas

| Componente | Estado Actual | Brecha / Causa de Falla | Solución Arquitectónica Recomendada |
|---|---|---|---|
| **URL del Adjunto** | `savedMediaUrl = /uploads/...` (relativa) | Meta e interfaces externas no pueden descargar rutas relativas sin dominio ni localhost. | Prefijar con el origen público HTTPS (`https://omnichannel.farfalina.tech${savedMediaUrl}`) para el despacho saliente. |
| **Instagram Direct Sender** | Envía `buffer` como multipart `filedata` a `graph.facebook.com`. | Rechazo por OAuth token type y falta de soporte de multipart en Instagram Send API. | Enviar siempre `payload: { url: publicUrl }` hacia `https://graph.instagram.com/v22.0/me/messages` (cuando el token es `IGAA...`). |
| **Mapeo de Tipos en IG** | Solo contemplaba `image`, `video` y `audio`. PDFs caían en `image`. | Los archivos PDF y documentos eran rechazados por Meta como imágenes corruptas. | Mapear MIME types de documentos (`application/pdf`, docx, etc.) a `type: "file"`. |
| **WhatsApp Evolution API** | Pasa `mediaUrl` relativo local a Evolution API. | Si Evolution API corre aislado o en contenedor Docker, no puede resolver `/uploads/...`. | Pasar la URL pública completa (`https://omnichannel.farfalina.tech/uploads/...`) o DataURI base64. |
| **UI Grabador de Voz** | Solo permite seleccionar archivos de audio pregrabados mediante el explorador de archivos. | Los operadores no pueden grabar notas de voz directas con un botón de micrófono. | (Mejora futura de UI) Incorporar botón de micrófono con hook de MediaRecorder. |
