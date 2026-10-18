# Registro de Cambios: Milestone M1 — Envío de Archivos Multimedia Salientes (Instagram Direct & WhatsApp)

**Subagente**: Worker Follow-up M1 (`worker_followup_m1`)  
**Fecha**: 2026-10-06  
**Milestone**: M1 (Envío de Archivos Multimedia Salientes)  
**Estado**: Completado y Verificado  

---

## 1. Archivos Modificados

### 1.1. `lib/meta-graph-api.ts`
- **Ampliación de Mapeo MIME**:
  - Incorporado soporte para formatos adicionales en `MIME_TO_EXT`: Excel (`.xls`, `.xlsx`), Word (`.doc`, `.docx`), texto plano (`.txt`).
  - Creada y exportada función pura `getInstagramMediaType(mimeType: string): "image" | "video" | "audio" | "file"` con mapeo estricto:
    - `image/*` -> `'image'`
    - `video/*` -> `'video'`
    - `audio/*` -> `'audio'`
    - `application/*`, PDF, documentos Office, `text/*` -> `'file'`
- **Resolución de URL Pública**:
  - Implementada y exportada función helper `resolvePublicMediaUrl(mediaUrl: string): string` que antepone el origen HTTPS público del túnel Cloudflare (`https://omnichannel.farfalina.tech`) a cualquier ruta local o relativa (`/uploads/...`), preservando URLs absolutas preexistentes.
- **Corrección de Endpoint de Instagram Graph API**:
  - `sendInstagramDirectTextMessage`: Dirigido a `https://graph.instagram.com/v22.0/me/messages` para tokens de Instagram (`IGAA...`), reservando `META_GRAPH_BASE` (`graph.facebook.com`) únicamente para tokens de FanPage de Facebook (`EA...`).
  - `sendInstagramDirectMediaMessage`:
    - Eliminado el intento multipart `form-data` con campo `filedata` hacia `graph.facebook.com` (que causaba error `OAuthException 190` en tokens `IGAA...`).
    - Despacho obligatorio mediante payload JSON con objeto `attachment`:
      ```json
      {
        "recipient": { "id": "<RECIPIENT_IGSID>" },
        "message": {
          "attachment": {
            "type": "image" | "video" | "audio" | "file",
            "payload": { "url": "https://omnichannel.farfalina.tech/uploads/..." }
          }
        }
      }
      ```
    - Si se recibe un buffer en memoria sin URL, se persiste en `public/uploads/instagram/out_${timestamp}_...` y se despacha su URL pública correspondiente.

### 1.2. `app/actions/omnichannel.ts`
- **Esquema de Validación `SendMessageSchema`**:
  - Soporte ampliado en campo `sender`: admite tanto minúsculas `"agent"` como mayúsculas `"AGENT"` (`z.enum(["customer", "bot", "agent", "AGENT"])`), normalizándolo a `"agent"`.
- **Acción del Servidor `sendChatMessageAction`**:
  - Verificación de existencia de conversación (`thread`) con early return `{ success: false, error: "Conversación no encontrada", code: "THREAD_NOT_FOUND" }`.
  - Guardado físico de adjuntos entrantes en disco (`public/uploads/{channel}/out_${timestamp}_${filename}`).
  - Construcción de URL pública absoluta mediante `publicAppUrl` (`process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://omnichannel.farfalina.tech"`).
  - **Despacho Instagram Direct**: Despacha prioritariamente vía `sendInstagramDirectMediaMessage` enviando la URL pública `publicMediaUrl` y el tipo MIME respectivo. Si la API retorna éxito, marca `sentDirectlyViaMeta = true` y almacena el `outboundExternalId` con el Meta `message_id`.
  - **Despacho WhatsApp**:
    - Meta WhatsApp Cloud API: Envía `mediaLink: publicMediaUrl`.
    - Evolution API: Pasa `mediaUrl: publicMediaUrl` (eliminando el traspaso de rutas locales relativas inaccesibles).
  - **Persistencia en SQLite**:
    - Registra en `ChatMessage` el mensaje con `sender: normalizedSender` (`agent`), `mediaUrl: savedMediaUrl`, `mediaType: computedMediaType`, `externalId: outboundExternalId`, `timestamp` monótono y actualización de `lastMessage` en `ChatThread`.
    - Encola en `RelayOutboundQueue` con estado `"SENT"` si fue despachado exitosamente por la API directa de Meta.

### 1.3. `lib/evolution-api.ts`
- **Resolución Automática de URLs en `sendEvolutionMediaMessage`**:
  - Se añadió guardia de resolución: si `mediaUrl` no inicia con `http://`, `https://` ni `data:`, se concatena automáticamente con el host público HTTPS (`https://omnichannel.farfalina.tech`) para asegurar accesibilidad por Evolution API.

### 1.4. `lib/meta-whatsapp.ts`
- **Transformación de URL en `SendMediaMessageParamsSchema`**:
  - El campo `mediaLink` utiliza una transformación en Zod que antepone el host del túnel Cloudflare a rutas relativas antes de verificar que sea una URL válida (`z.string().url()`).

### 1.5. `scripts/verify-outbound-media.ts` (Nuevo)
- Script automatizado de pruebas de integración con 24 aserciones independientes que valida:
  1. Mapeo de tipos MIME a tipos de adjuntos de Instagram (`image`, `audio`, `video`, `file`).
  2. Generación y resolución de URLs públicas de túnel.
  3. Guardado físico en disco y persistencia en `ChatMessage` con rol `agent`.
  4. Guardado y tipado de documentos PDF (`type: 'document'`).
  5. Despacho real y estructura de llamada a Meta Graph API contra la cuenta de Instagram configurada retornando un `message_id` legítimo.

---

## 2. Resumen de Pruebas y Verificación

1. **Suite E2E de Verificación**:
   - Comando: `npx tsx scripts/verify-outbound-media.ts`
   - Resultado: **24 PASSED, 0 FAILED** (100% de éxito).
   - Respuesta real de Meta Graph API v22.0:
     `{ success: true, messageId: 'aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIzMjY5MjE2NDgxODg4MjE1MDI5MjExNDExMjUxMgZDZD' }`
2. **Suite de Pruebas Multimedia Existente**:
   - Comando: `npx tsx tests/multimedia-and-meta.test.ts`
   - Resultado: **19 PASSED, 0 FAILED** (sin regresiones).
3. **Verificación Estática de Tipos TypeScript**:
   - Comando: `npx tsc --noEmit`
   - Resultado: **0 errores**.
