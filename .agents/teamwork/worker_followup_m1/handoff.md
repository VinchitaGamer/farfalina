# Handoff Report: Milestone M1 — Envío de Archivos Multimedia Salientes (Instagram Direct & WhatsApp)

**Subagente**: Worker Follow-up M1 (`worker_followup_m1`)  
**Destinatario**: Orchestrator (`1e373fa0-941b-417b-b7c3-a8dd99f78b05`)  
**Fecha**: 2026-10-06  
**Tipo**: Hard Handoff (Milestone Complete)  

---

## 1. Observation

1. **Estado Inicial del Despacho Saliente de Instagram**:
   - En `lib/meta-graph-api.ts`, la función `sendInstagramDirectMediaMessage` intentaba subir el buffer en memoria mediante un multipart `form-data` con campo `filedata` hacia `https://graph.facebook.com/v22.0/me/messages`.
   - Cuando se usaban tokens de usuario de Instagram (`IGAA...`), `graph.facebook.com` rechazaba la petición con el error verbatim:
     `{"error":{"message":"Invalid OAuth access token - Cannot parse access token","type":"OAuthException","code":190}}`.
   - Además, la API Send de Instagram Direct no admite subida directa de archivos binarios; exige un objeto `attachment` con una URL pública accesible.
   - En `lib/meta-graph-api.ts`, los tipos MIME no mapeaban `application/pdf` ni documentos Office a `file`, cayendo por defecto en `image`, lo que provocaba rechazos en Meta por archivos no reconocidos.
2. **Estado Inicial de `sendChatMessageAction` en `app/actions/omnichannel.ts`**:
   - Al procesar adjuntos, se guardaba el archivo en `public/uploads/{channel}/out_${timestamp}_...` y se generaba una ruta relativa local `/uploads/...`.
   - Al despachar hacia Instagram, se evaluaba `if (outgoingBase64 && outgoingMimeType)` antes que la URL pública, enviando el buffer y cayendo en el fallo multipart mencionado.
   - Para WhatsApp, `sendEvolutionMediaMessage` recibía la ruta relativa `/uploads/...`, la cual fallaba si Evolution API se ejecutaba de forma aislada.
3. **Modificaciones Implementadas**:
   - `lib/meta-graph-api.ts`:
     - Implementadas funciones `getInstagramMediaType` y `resolvePublicMediaUrl`.
     - `sendInstagramDirectTextMessage` y `sendInstagramDirectMediaMessage` dirigen las solicitudes con tokens `IGAA...` a `https://graph.instagram.com/v22.0/me/messages`.
     - `sendInstagramDirectMediaMessage` construye el payload con `attachment: { type: metaMediaType, payload: { url: publicUrl } }`.
     - Mapeo de tipos: `image/*` -> `image`, `audio/*` -> `audio`, `video/*` -> `video`, `application/*` / PDF / docs -> `file`.
   - `app/actions/omnichannel.ts`:
     - `sendChatMessageAction` genera la URL pública con prefijo `https://omnichannel.farfalina.tech`.
     - Despacha prioritariamente con la URL pública hacia Instagram Direct y WhatsApp (Evolution API / Meta WhatsApp Cloud).
     - Persiste el mensaje en `ChatMessage` con `sender: "agent"`, `mediaUrl`, `mediaType`, `externalId` del mensaje de Meta, y actualiza el hilo en `ChatThread`.
   - `lib/evolution-api.ts` y `lib/meta-whatsapp.ts`:
     - Incorporada resolución automática de rutas relativas a URLs públicas absolutas.
4. **Verificación y Pruebas**:
   - Se creó y ejecutó el script automatizado `scripts/verify-outbound-media.ts`.
   - Todas las 24 aserciones pasaron exitosamente (**24 PASSED, 0 FAILED**).
   - La llamada en vivo a Meta Graph API v22.0 retornó verbatim:
     `{ success: true, messageId: 'aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIzMjY5MjE2NDgxODg4MjE1MDI5MjExNDExMjUxMgZDZD' }`.
   - La suite existente de pruebas (`tests/multimedia-and-meta.test.ts`) ejecutó con **19 PASSED, 0 FAILED**.
   - `npx tsc --noEmit` completó con **0 errores**.

---

## 2. Logic Chain

1. A partir de la observación de que `graph.facebook.com` rechaza tokens de Instagram `IGAA...` con código 190, se identificó que todas las peticiones con dichos tokens deben dirigirse exclusivamente al host `https://graph.instagram.com/v22.0/me/messages`.
2. Dado que Instagram Send API no permite subidas de archivos en memoria con multipart `form-data`, el único canal válido para enviar multimedia es proveer una URL pública accesible en `message.attachment.payload.url`.
3. Al disponer del túnel Cloudflare activo en `https://omnichannel.farfalina.tech` apuntando al servidor local, cualquier archivo almacenado en `public/uploads/...` es accesible de inmediato por los servidores de Meta mediante `https://omnichannel.farfalina.tech/uploads/...`.
4. Al asegurar que `sendChatMessageAction` guarde el archivo en disco, construya dicha URL pública HTTPS y la pase a `sendInstagramDirectMediaMessage` y `sendEvolutionMediaMessage`, Meta Graph API descarga el recurso directamente y entrega el mensaje en la bandeja de entrada del usuario de Instagram Direct.
5. Al mapear correctamente los tipos MIME de documentos a `file` y fotos a `image`, Meta valida el archivo sin errores de procesamiento.
6. La persistencia en `ChatMessage` con rol `agent`, `mediaUrl` y `externalId` asegura trazabilidad completa en la base de datos local y coherencia en la interfaz de chat.

---

## 3. Caveats

- **Ventana de Mensajería de 24 Horas de Meta**: Según las políticas de la plataforma de Meta, solo se pueden enviar mensajes salientes a usuarios de Instagram que hayan interactuado en las últimas 24 horas. Para pruebas y producción, el destinatario debe haber enviado un mensaje reciente.
- **Túnel Cloudflare**: El despacho saliente depende de que el túnel `https://omnichannel.farfalina.tech` permanezca en línea para que los rastreadores de Meta puedan descargar los archivos adjuntos. Si el túnel se interrumpe, Meta no podrá acceder al archivo local.

---

## 4. Conclusion

- El Milestone M1 está **completamente implementado, operativo y verificado**.
- Tanto Instagram Direct como WhatsApp ahora cuentan con despacho saliente de imágenes, audio, video y documentos mediante URLs públicas de alta disponibilidad servidas a través del túnel Cloudflare.
- Los mensajes quedan debidamente persistidos en `ChatMessage` con su respectivo identificador de Meta (`externalId`), tipo multimedia y rol de agente.
- No se introdujeron cambios destructivos en el esquema de la base de datos ni regresiones en la suite de pruebas existente.

---

## 5. Verification Method

Para reproducir y verificar de forma independiente la funcionalidad:

1. **Ejecutar la suite de verificación automatizada de multimedia saliente**:
   ```powershell
   npx tsx scripts/verify-outbound-media.ts
   ```
   *Resultado esperado*: `=== RESUMEN DE VERIFICACIÓN: 24 PASSED, 0 FAILED ===` con respuesta exitosa y `messageId` de Meta Graph API.

2. **Ejecutar la suite general de pruebas de multimedia y Meta**:
   ```powershell
   npx tsx tests/multimedia-and-meta.test.ts
   ```
   *Resultado esperado*: `=== RESUMEN FINAL MULTIMEDIA: 19 PASSED, 0 FAILED ===`.

3. **Verificar tipado y ausencia de errores de compilación**:
   ```powershell
   npx tsc --noEmit
   ```
   *Resultado esperado*: Retorno limpio sin errores de TypeScript (exit code 0).
