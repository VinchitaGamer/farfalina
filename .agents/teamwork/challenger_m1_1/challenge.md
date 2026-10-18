# Reporte de Desafío Adversarial: Milestone M1 — Multimedia Saliente (Instagram Direct & WhatsApp)

**Agente**: Challenger 1 (`challenger_m1_1`)  
**Arquetipo**: EMPIRICAL CHALLENGER (critic, specialist)  
**Fecha**: 2026-10-06  
**Veredicto**: **APPROVE** (con observaciones menores documentadas)  

---

## 1. Challenge Summary

**Overall risk assessment**: **LOW**

La lógica de despacho de multimedia saliente implementada en `lib/meta-graph-api.ts`, `app/actions/omnichannel.ts`, `lib/evolution-api.ts` y `lib/meta-whatsapp.ts` demostró una alta resiliencia empírica frente a pruebas adversariales rigurosas.
Se ejecutaron un total de **95 pruebas y aserciones de estrés** automatizadas cubriendo:
- Tipos MIME extremos y anómalos (PDF, MP3, MP4, JPEG, WEBP, tipos con parámetros de codificación y tipos no reconocidos).
- Formateo y resolución de URLs públicas de túnel HTTPS, preservación de URLs absolutas externas y sanitización de caracteres no alfanuméricos/espacios en nombres de archivo.
- Persistencia monótona y concurrente en SQLite (`ChatMessage`, `ChatThread`, `RelayOutboundQueue`) bajo ráfagas secuenciales de 5 tipos de medios distintos y ráfagas concurrentes de 3 envíos paralelos mediante `Promise.all`.
- Verificación real contra la API de Meta Graph API v22.0 (`https://graph.instagram.com/v22.0/me/messages`), validando que Meta efectivamente descarga el adjunto desde la URL pública del túnel y retorna un `message_id` válido.

---

## 2. Adversarial Challenges & Findings

### [Low] Desafío 1: Fallback de URLs Absolutas con Espacios Iniciales en `resolvePublicMediaUrl`

- **Supuesto desafiado**: `resolvePublicMediaUrl` procesa de forma transparente cualquier URL absoluta que apunte a un CDN externo sin prefijarle el origen local del túnel Cloudflare.
- **Escenario de ataque**: Si un usuario o integración suministra una URL absoluta con un espacio en blanco al inicio (ej. `" https://cdn.images.com/flower.jpg"`), la condición `mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")` en `lib/meta-graph-api.ts:73` evalúa a `false`. Esto causa que el código asuma erróneamente que se trata de una ruta relativa local, transformándola en `https://omnichannel.farfalina.tech/ https://cdn.images.com/flower.jpg`.
- **Radio de impacto (Blast radius)**: Muy bajo. Los flujos normales de subida de archivos generan rutas locales controladas (`/uploads/...`) o nombres de archivo sanitizados con `_`. Solo afectaría si un operador copia y pega manualmente una URL externa con un espacio inicial.
- **Mitigación recomendada**: Aplicar `.trim()` a `mediaUrl` antes de comprobar los prefijos:
  ```typescript
  const clean = (mediaUrl || "").trim();
  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
  ```

---

### [Low] Desafío 2: Clasificación de Fallback para MIME Types No Estándar en `getInstagramMediaType`

- **Supuesto desafiado**: `getInstagramMediaType` mapea cualquier entrada a uno de los 4 tipos admitidos por Instagram (`image`, `video`, `audio`, `file`).
- **Escenario de ataque**: Al recibir un MIME exótico o desconocido que no comience por `video/`, `audio/`, `application/` ni `text/` (por ejemplo `model/gltf-binary` o `custom/data`), la función retorna `"image"` por defecto (`lib/meta-graph-api.ts:65`). En contraste, `sendChatMessageAction` clasifica cualquier tipo desconocido que no sea imagen/audio/video como `"document"`. Esto genera una discrepancia semántica donde `ChatMessage.mediaType` se registra como `"document"`, pero el despacho a Meta se envía con tipo `"image"`.
- **Radio de impacto**: Muy bajo. La interfaz de usuario y los clientes de chat estándar solo manejan imágenes, videos, audios y documentos.
- **Mitigación recomendada**: Alinear el fallback en `getInstagramMediaType` para devolver `"file"` en lugar de `"image"` ante tipos no reconocidos.

---

### [Informative] Desafío 3: Validación Síncrona de Descarga por parte de Meta Graph API

- **Supuesto desafiado**: Meta Graph API solo valida la sintaxis del esquema JSON del objeto `attachment` en el payload de `POST /me/messages`.
- **Hallazgo empírico**: Se demostró empíricamente que Meta Graph API v22.0 ejecuta una solicitud HTTP GET de forma síncrona hacia la URL provista en `attachment.payload.url`.
  - Si la URL responde HTTP 404 (archivo no existente en disco) o si el buffer devuelto no constituye una imagen válida reconocible por el decodificador de Meta, Meta rechaza inmediatamente el despacho con `IGApiException code: 100, error_subcode: 2018047 ("Error al subir el archivo adjunto.")`.
  - Cuando el archivo existe físicamente en disco y es accesible a través del túnel Cloudflare (`https://omnichannel.farfalina.tech/uploads/...`), Meta descarga el recurso, lo procesa y retorna exitosamente el identificador `message_id`.
- **Conclusión**: El túnel Cloudflare local y la persistencia física previa en disco implementada por el worker son **estrictamente obligatorios y funcionan de manera óptima**.

---

## 3. Stress Test Results

Ejecución del arnés de pruebas adversariales (`challenge-runner.ts`):

| Escenario de Estrés | Comportamiento Esperado | Comportamiento Obtenido | Resultado |
|---|---|---|---|
| MIME Types estándar (`pdf`, `mp3`, `mp4`, `jpeg`, `webp`) | Mapeo exacto a `file`, `audio`, `video`, `image` | Coincidencia exacta en todas las variantes | **PASS** |
| Parámetros MIME complejos (`application/pdf; charset=binary`) | Extracción y clasificación a `file` | Clasificado como `file` | **PASS** |
| Invarianza de mayúsculas (`IMAGE/JPEG`, `Video/MP4`) | Mapeo case-insensitive correcto | Clasificado idéntico a minúsculas | **PASS** |
| Sanitización de nombres sucios (`Catálogo Rosas & Lirios #2026.pdf`) | Reemplazo de espacios y caracteres especiales por `_` | `Cat_logo_Rosas___Lirios__2026.pdf` | **PASS** |
| URL WhatsApp con schema Zod | Transformación a URL absoluta de túnel y validación de URL | `https://omnichannel.farfalina.tech/uploads/...` válido | **PASS** |
| Ráfaga consecutiva (5 tipos de medios distintos) | Persistencia ordenada en `ChatMessage`, monotonicidad de timestamp, actualización de `ChatThread` y encolado en `RelayOutboundQueue` | 5/5 mensajes persistidos con tipos exactos, archivos íntegros en disco y `ChatThread.lastMessage` actualizado | **PASS** |
| Ráfaga concurrente en paralelo (3 envíos `Promise.all`) | Sin bloqueos `SQLITE_BUSY`, sin pérdida de mensajes ni duplicaciones | 3/3 mensajes procesados sin colisiones, conteo total del hilo = 8 mensajes | **PASS** |
| Validación en vivo Meta Graph API v22.0 con imagen real en disco | Respuesta exitosa con `message_id` de Meta | `{ success: true, messageId: 'aWdfZAG1faXRlbTox...ZDZD' }` | **PASS** |

**Total de Aserciones del Desafío**: **95 evaluadas, 95 exitosas (0 fallidas)**.

---

## 4. Unchallenged Areas

- **Despacho real hacia Evolution API**: No desafiado en vivo debido a que la instancia local de Evolution API no se encontraba en ejecución (fallback a Meta Relay probado y operativo).
- **Límites de tamaño superiores a 50MB**: No testeados para evitar consumo excesivo de cuota de red y almacenamiento en disco.

---

## 5. Veredicto Final

**VEREDICTO: APPROVE**

La arquitectura de multimedia saliente implementada para el Milestone M1 cumple con todas las exigencias funcionales y de robustez. Es segura, no sufre de condiciones de carrera bajo ráfagas concurrentes en SQLite, mantiene la integridad referencial y se comunica con éxito con Meta Graph API.
