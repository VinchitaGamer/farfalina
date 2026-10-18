# Handoff Report: Reviewer 2 — Milestone M1 (Envío de Archivos Multimedia Salientes)

**Subagente**: Reviewer 2 (`reviewer_m1_2`)  
**Destinatario**: Orchestrator (`1e373fa0-941b-417b-b7c3-a8dd99f78b05`)  
**Fecha**: 2026-10-06  
**Tipo**: Hard Handoff (Review & Audit Complete)  
**Veredicto**: **APPROVE**  

---

## 1. Observation

1. **Inspección de Código**:
   - `lib/meta-graph-api.ts`:
     - Función `getInstagramMediaType` (líneas 44-66) mapea tipos MIME a `"image" | "video" | "audio" | "file"`.
     - Función `resolvePublicMediaUrl` (líneas 71-83) convierte rutas locales relativas en URLs absolutas bajo `process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://omnichannel.farfalina.tech"`.
     - Funciones `sendInstagramDirectTextMessage` (línea 424) y `sendInstagramDirectMediaMessage` (línea 513) dirigen tokens de Instagram `IGAA...` a `https://graph.instagram.com/v22.0/me/messages`, y tokens `EA...` a `META_GRAPH_BASE` (`graph.facebook.com`).
     - Función `sendInstagramDirectMediaMessage` (líneas 500-508) genera la estructura:
       ```json
       {
         "recipient": { "id": cleanIgsid },
         "message": {
           "attachment": {
             "type": metaMediaType,
             "payload": { "url": resolvedMediaUrl }
           }
         }
       }
       ```
   - `app/actions/omnichannel.ts`:
     - `SendMessageSchema` (línea 10) valida `sender: z.enum(["customer", "bot", "agent", "AGENT"]).default("agent")`.
     - `sendChatMessageAction` (líneas 296-322) persiste buffers Base64 en `public/uploads/{channel}/out_${timestamp}_${filename}`.
     - `sendChatMessageAction` (líneas 326-336) calcula `publicMediaUrl` con el dominio público del túnel HTTPS.
     - `sendChatMessageAction` (líneas 568-611) persiste en SQLite mediante transacción Prisma el registro `ChatMessage` (`sender: "agent"`, `mediaUrl`, `mediaType`, `externalId: outboundExternalId`) y actualiza `ChatThread`.
   - `lib/evolution-api.ts`:
     - `sendEvolutionMediaMessage` (líneas 113-118) prepend automático del host público HTTPS a rutas que no comienzan por `http://`, `https://` o `data:`.
   - `lib/meta-whatsapp.ts`:
     - `SendMediaMessageParamsSchema` (líneas 111-125) transforma rutas relativas a URLs completas mediante Zod transform y valida `z.string().url()`.

2. **Resultados de Comandos de Verificación**:
   - `npx tsx scripts/verify-outbound-media.ts`:
     - Salida verbatim:
       ```
       === RESUMEN DE VERIFICACIÓN: 24 PASSED, 0 FAILED ===
       ```
     - Despacho real en vivo a Meta Graph API v22.0:
       `[Instagram Direct Outbound] Despachando adjunto (image) a 1304358138230682 vía https://graph.instagram.com/v22.0/me/messages...`
       `-> Resultado de Meta Graph API: { success: true, messageId: 'aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIzNzgxODI0MjUwMTY2MjU3Nzg0ODcwNDA0MDk2MAZDZD' }`
   - `npx tsx tests/multimedia-and-meta.test.ts`:
     - Salida verbatim:
       ```
       === RESUMEN FINAL MULTIMEDIA: 19 PASSED, 0 FAILED ===
       ```
   - `npx tsc --noEmit`:
     - Completó exitosamente con código de salida 0 (sin errores de compilación ni discrepancias de tipos).

3. **Auditoría Forense de Integridad**:
   - No se detectaron mocks, simulaciones estáticas de respuesta ni bypasses de lógica en el código de producción ni en los scripts de verificación.
   - El `message_id` retornado por Meta fue emitido en tiempo real por los servidores de `graph.instagram.com`.

---

## 2. Logic Chain

1. A partir de la observación de que `graph.instagram.com/v22.0/me/messages` es el endpoint canónico requerido por Meta para tokens de usuario de Instagram (`IGAA...`), se comprueba que el enrutamiento implementado evita el error `OAuthException 190` que ocurría al enviar a `graph.facebook.com`.
2. Dado que Meta Graph API requiere que los adjuntos multimedia sean descargados por sus crawlers desde una URL pública con HTTPS, la resolución automática mediante el dominio del túnel Cloudflare (`https://omnichannel.farfalina.tech`) garantiza que los archivos almacenados localmente en `public/uploads/` sean accesibles para Meta.
3. Al comprobar que la ejecución de `scripts/verify-outbound-media.ts` generó un ID de mensaje legítimo de Meta (`aWdf...`) entregando una imagen real almacenada localmente, se confirma que el flujo completo de despacho de multimedia saliente funciona de punta a punta.
4. Al validar que la persistencia en `ChatMessage` registra `sender: "agent"`, `mediaUrl`, `mediaType` y el `externalId` del mensaje de Meta, se garantiza que el hilo de conversación mantiene coherencia y trazabilidad completa en la base de datos SQLite.
5. Al verificar que `npx tsx tests/multimedia-and-meta.test.ts` y `npx tsc --noEmit` pasaron con cero errores, se demuestra que no hubo regresiones en los módulos preexistentes ni violaciones de tipos de TypeScript.

---

## 3. Caveats

1. **Dependencia de Conectividad del Túnel Cloudflare**: El despacho de adjuntos a Meta requiere que el proceso local del túnel Cloudflare permanezca activo; de lo contrario, Meta no podrá descargar el archivo alojado en `public/uploads/`.
2. **Ventana de Mensajería Estándar de Meta (24 Horas)**: Meta restringe el envío de mensajes salientes iniciados por la empresa a usuarios que hayan enviado un mensaje en las últimas 24 horas. Los envíos fuera de esta ventana serán rechazados por Meta por política de plataforma.
3. **Despacho Secuencial de Captions en Instagram Direct**: A diferencia de WhatsApp, la API de Instagram Direct no soporta el campo `caption` dentro del objeto `attachment`, por lo que se envía el texto como un mensaje separado subsiguiente.

---

## 4. Conclusion

El Milestone M1 (Envío de Archivos Multimedia Salientes para Instagram Direct & WhatsApp) está **completamente verificado, libre de violaciones de integridad y funcionalmente operativo**.

El veredicto formal de Reviewer 2 es **APPROVE**.

---

## 5. Verification Method

Para reproducir independientemente esta verificación:

1. Ejecutar el script de verificación de multimedia saliente:
   ```powershell
   npx tsx scripts/verify-outbound-media.ts
   ```
   *Criterio de éxito*: 24 pruebas aprobadas (`24 PASSED, 0 FAILED`) y respuesta de Meta Graph API con `success: true` y `messageId`.

2. Ejecutar la suite general de pruebas de multimedia y Meta:
   ```powershell
   npx tsx tests/multimedia-and-meta.test.ts
   ```
   *Criterio de éxito*: 19 pruebas aprobadas (`19 PASSED, 0 FAILED`).

3. Ejecutar la comprobación estática de tipos de TypeScript:
   ```powershell
   npx tsc --noEmit
   ```
   *Criterio de éxito*: Código de salida 0, sin errores de TypeScript.
