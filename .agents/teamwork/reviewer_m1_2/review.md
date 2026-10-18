# Review & Adversarial Challenge Report: Milestone M1

**Milestone**: M1 (Envío de Archivos Multimedia Salientes para Instagram Direct & WhatsApp)  
**Revisor**: Reviewer 2 (`reviewer_m1_2`)  
**Roles**: Reviewer, Critic  
**Fecha**: 2026-10-06  
**Veredicto**: **APPROVE**  

---

## 1. Resumen de Revisión y Veredicto

**VEREDICTO**: **APPROVE**

La implementación del Milestone M1 satisface con rigor técnico todos los requerimientos especificados en `ORIGINAL_REQUEST.md (§R1)` y la arquitectura de `PROJECT.md`. El despacho saliente de multimedia para Instagram Direct y WhatsApp ha sido corregido para operar con URLs públicas HTTPS servidas a través del túnel Cloudflare, cumpliendo con la especificación de Meta Graph API v22.0 (`attachment: { type, payload: { url } }`) y direccionando correctamente tokens de usuario de Instagram (`IGAA...`) hacia `https://graph.instagram.com/v22.0/me/messages`.

---

## 2. Auditoría de Integridad (Anti-Cheat & Forensics)

En cumplimiento del rol de adversarial critic y las directivas de integridad del proyecto, se auditó exhaustivamente la implementación:

| Criterio de Integridad | Hallazgo | Estado |
|---|---|---|
| **Resultados de prueba hardcodeados** | Ninguno. Las aserciones en `verify-outbound-media.ts` evalúan retornos dinámicos de funciones y respuestas HTTP en tiempo de ejecución. | ✅ Cumple |
| **Implementaciones Dummy o Facade** | Ninguna. La función `sendInstagramDirectMediaMessage` ejecuta peticiones HTTP `fetch` reales contra los servidores de Meta. | ✅ Cumple |
| **Atajos o Bypasses del Requerimiento** | Ninguno. Los archivos se persisten físicamente en `public/uploads/` y se indexan en SQLite en `ChatMessage` con rol `agent`. | ✅ Cumple |
| **Salidas de verificación fabricadas** | Ninguna. La ejecución independiente en consola generó IDs de transacción únicos emitidos por Meta (`aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEO...`). | ✅ Cumple |
| **Auto-certificación sin verificación independiente** | Ninguna. La verificación fue ejecutada y validada de forma autónoma en este entorno. | ✅ Cumple |

**Conclusión de Integridad**: Cero violaciones de integridad detectadas.

---

## 3. Evaluación de Calidad y Correctitud

### 3.1. Meta Graph API: Payload y Dominio de Endpoint
- **Endpoint**: En `lib/meta-graph-api.ts` (líneas 423-426 y 512-515), se resuelve dinámicamente el host:
  - Tokens de FanPage de Facebook (`EA...`) -> `https://graph.facebook.com/v22.0/me/messages`
  - Tokens nativos de Instagram (`IGAA...`) -> `https://graph.instagram.com/v22.0/me/messages`
  Esto resuelve de forma definitiva el error `OAuthException 190` reportado anteriormente.
- **Estructura del Payload**: Cumple estrictamente con el contrato de Meta para adjuntos:
  ```json
  {
    "recipient": { "id": "<IGSID>" },
    "message": {
      "attachment": {
        "type": "image" | "video" | "audio" | "file",
        "payload": { "url": "https://omnichannel.farfalina.tech/uploads/..." }
      }
    }
  }
  ```
- **Mapeo MIME (`getInstagramMediaType`)**: Clasifica con exactitud tipos MIME de audio, video, imagen y documentos (`application/pdf`, docx, xlsx, txt) al tipo `file` o correspondiente de Meta.

### 3.2. Resolución de URLs Públicas con Túnel Cloudflare
- `resolvePublicMediaUrl` en `lib/meta-graph-api.ts` antepone la base pública configurada (`process.env.NEXT_PUBLIC_APP_URL || "https://omnichannel.farfalina.tech"`) a rutas locales `/uploads/...`, respetando URLs externas absolutas preexistentes.
- Las transformaciones correspondientes se incorporaron consistentemente en:
  - `app/actions/omnichannel.ts` (`publicMediaUrl` en `sendChatMessageAction`)
  - `lib/evolution-api.ts` (`sendEvolutionMediaMessage` prepend automático)
  - `lib/meta-whatsapp.ts` (`SendMediaMessageParamsSchema` Zod transform)

### 3.3. Persistencia en Base de Datos (`ChatMessage` y `ChatThread`)
- `sendChatMessageAction` utiliza `prisma.$transaction`:
  - Guarda `ChatMessage` con `sender: "agent"`, `mediaUrl`, `mediaType`, `externalId: outboundExternalId` (obtenido directamente de la respuesta de Meta), `timestamp` y `environment`.
  - Actualiza `ChatThread` con `lastMessage` (`[Imagen adjunta]` o `[Archivo adjunto]`) y `lastMessageAt`.
  - Encola en `RelayOutboundQueue` con estado `"SENT"` si el envío directo tuvo éxito, asegurando consistencia auditada.

### 3.4. Conformidad con `AGENTS.md`
- **TypeScript Estricto**: `npx tsc --noEmit` completó con **0 errores**.
- **Sin `any`**: No se encontraron usos de `any` en los cambios realizados.
- **Validación con Zod**: Esquemas Zod para parámetros y payloads (`SendMessageSchema`, `SendMediaMessageParamsSchema`).
- **Contrato Bilateral**: Respuestas consistentes `{ success, data, error, code }`.
- **Fetch Nativo**: Uso exclusivo del `fetch` nativo de Node.js/Next.js con `AbortSignal.timeout`.

---

## 4. Adversarial Critic: Análisis de Esfuerzo y Modos de Falla

Como Adversarial Critic, se examinaron los supuestos implícitos y posibles puntos de ruptura:

### Desafío 1: Separación de Caption y Adjunto en Instagram Direct
- **Supuesto**: Meta Instagram Direct Send API no admite un campo de texto `caption` dentro del objeto `attachment` (a diferencia de WhatsApp).
- **Implementación**: El worker despacha el adjunto primero y, si existe texto (`caption`), despacha un mensaje de texto de seguimiento vía `sendInstagramDirectTextMessage`.
- **Escenario de Falla**: Si el adjunto se envía con éxito pero el mensaje de texto falla (por ejemplo, rate limit o timeout), el adjunto llega pero sin texto aclaratorio.
- **Evaluación y Mitigación**: El adjunto se preserva y se entrega. En la UI local, ambos contenidos quedan registrados en el `ChatMessage`. Comportamiento robusto y conforme al estándar de la plataforma.

### Desafío 2: Disponibilidad del Túnel Cloudflare para Crawlers de Meta
- **Supuesto**: Meta descarga el archivo asíncronamente desde `attachment.payload.url`.
- **Escenario de Falla**: Si el daemon de Cloudflare Tunnel (`cloudflared`) cae o se satura el ancho de banda del servidor local, el rastreador de Meta recibirá HTTP 502/504 y la entrega fallará.
- **Evaluación**: El worker adecuadamente documentó esta dependencia en los caveats. `lib/media-server.ts` ya cuenta con soporte RFC 7233 (HTTP 206 Byte-Range streaming), optimizando la descarga para crawlers externos.

### Desafío 3: Sanitización de Nombres de Archivo y Directory Traversal
- **Supuesto**: Los nombres de archivo provistos por clientes o interfaces no deben comprometer el sistema de archivos.
- **Evaluación**: En `omnichannel.ts` y `meta-graph-api.ts`, los nombres se sanean con `.replace(/[^a-zA-Z0-9._-]/g, "_")`, impidiendo secuencias de escape como `../` o caracteres nulos. La prueba de Directory Traversal en `tests/multimedia-and-meta.test.ts` pasó exitosamente.

### Desafío 4: Ventana de Mensajería de 24 Horas de Meta
- **Supuesto**: Intentar enviar multimedia a un usuario de Instagram que no ha interactuado en 24 horas generará un rechazo de Meta (`OAuthException`).
- **Evaluación**: El error es capturado limpiamente en el bloque `try/catch` de `sendInstagramDirectMediaMessage` retornando `{ success: false, error: data.error?.message }` sin provocar caídas del servidor.

---

## 5. Matriz de Afirmaciones Verificadas

| Afirmación Evaluada | Método de Verificación | Resultado |
|---|---|---|
| Mapeo de tipos MIME a tipos Meta (`image`, `video`, `audio`, `file`) | `scripts/verify-outbound-media.ts` | **PASS** (10/10 tipos) |
| Resolución de URLs relativas a absolutas HTTPS de túnel | `scripts/verify-outbound-media.ts` | **PASS** |
| Persistencia física en `public/uploads/` | Comprobación `fs.existsSync` y comparación de Buffer | **PASS** |
| Inserción en `ChatMessage` con rol `agent`, `mediaUrl` y `externalId` | Consulta SQLite vía Prisma | **PASS** |
| Despacho real a Meta Graph API v22.0 (`graph.instagram.com/v22.0/me/messages`) | Petición live con token real contra IGSID | **PASS** (retornó `message_id`) |
| Compatibilidad y soporte de documentos PDF | Envío de buffer PDF y verificación en SQLite | **PASS** (`type: document`) |
| Suite de pruebas de streaming multimedia y seguridad | `tests/multimedia-and-meta.test.ts` | **PASS** (19/19) |
| Tipado estricto TypeScript sin errores | `npx tsc --noEmit` | **PASS** (0 errores) |

---

## 6. Dictamen Final

La solución para Milestone M1 está completamente probada, respeta las directivas del proyecto, y se encuentra lista para producción. No se requieren cambios adicionales para M1.
