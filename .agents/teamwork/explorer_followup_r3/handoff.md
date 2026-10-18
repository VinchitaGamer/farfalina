# Handoff Report — Requisito R3: Publicaciones y Comentarios de Instagram

**Agente:** Codebase Explorer R3  
**Directorio de Trabajo:** `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r3`  
**Destinatario:** Orchestrator (Conversation ID: `1e373fa0-941b-417b-b7c3-a8dd99f78b05`)  
**Fecha:** 2026-10-06  

---

## 1. Observation

1. **Webhook Handler en `app/api/webhooks/instagram/route.ts` (Líneas 286–306):**
   ```typescript
   // Líneas 287-306
   const changesList = Array.isArray(entry?.changes) ? entry.changes : [];
   for (const change of changesList) {
     const val = change?.value;
     if (!val) continue;
     const senderId = val.sender?.id || val.from?.id;
     const rawMsg = val.message;
     const messageText = (typeof rawMsg === "object" ? rawMsg?.text : typeof rawMsg === "string" ? rawMsg : undefined) || val.text || "";
     const changeMid = (typeof rawMsg === "object" ? rawMsg?.mid : undefined) || val.id || null;

     if (senderId && messageText) {
       await processInstagramMessage({
         senderId,
         text: messageText,
         isEcho: false,
         environment,
         instagramAccessToken: igToken,
         externalId: changeMid,
       });
     }
   }
   ```
   Se observó que `change.field` no se evalúa dentro del ciclo. Cualquier objeto en `changes` con `from.id` y `text` (estructura de un comentario) es enviado a `processInstagramMessage`, el cual crea o actualiza un `ChatThread` de tipo mensaje directo privado.

2. **Esquema de Base de Datos en `prisma/schema.prisma`:**
   El archivo contiene 381 líneas definiendo modelos para `RawIngredient`, `Arrangement`, `POSTicket`, `CashRegisterShift`, `ChatThread`, `ChatMessage`, `CRMClient`, `Dress`, `RentalBooking`, `ChannelConfig` y `RelayOutboundQueue`. No existe ningún modelo para publicaciones (`InstagramPost`) ni comentarios (`InstagramComment`).

3. **Configuración del Canal en SQLite `prisma/dev.db`:**
   Ejecución de consulta a `prisma.channelConfig`:
   ```json
   {
     "channel": "Instagram",
     "environment": "farfalina",
     "status": "CONNECTED",
     "instagramAccountId": "29643476368611224",
     "instagramAccessToken": "IGAAQEc31zGv..."
   }
   ```
   El token configurado inicia con `IGAA`, correspondiente a un Instagram User Token.

4. **Validación en Vivo contra Meta Graph API:**
   - Comando ejecutado:
     `fetch('https://graph.instagram.com/v22.0/me?fields=id,username,media_count,account_type&access_token=' + token)`
   - Respuesta obtenida de Meta:
     ```json
     {
       "id": "29643476368611224",
       "username": "sour_jhxn",
       "media_count": 0,
       "account_type": "MEDIA_CREATOR"
     }
     ```
   - Al probar contra `https://graph.facebook.com/v22.0/me`, Meta devolvió:
     ```json
     {
       "error": {
         "message": "Invalid OAuth access token - Cannot parse access token",
         "type": "OAuthException",
         "code": 190
       }
     }
     ```
   Esto comprueba que el token es válido exclusivamente sobre `graph.instagram.com`.

5. **Estructura de UI Omnicanal:**
   - En `components/shared/omnichannel/unified-omnichannel-view.tsx` (1882 líneas), existe una barra superior (`Relay Control Bar`, líneas 688–757) y un grid de 3 columnas (hilos, chat activo y CRM/pedidos).
   - Las páginas `app/(workspace)/floreria/omnichannel/page.tsx` y `app/(workspace)/carissma/omnichannel/page.tsx` montan este componente unificado pasando `environment="farfalina"` y `environment="carissma"`.

---

## 2. Logic Chain

1. **De la observación 1:** El código actual de `app/api/webhooks/instagram/route.ts` no verifica `change.field`. Por tanto, cuando Meta envía un evento de suscripción con `field: "comments"`, el handler procesa erróneamente el comentario como un mensaje directo privado en `ChatThread`, asociando el IGSID del comentarista como si fuera el teléfono de un chat 1-a-1.
2. **De la observación 2 y la regla de gobernanza `AGENTS.md`:** La regla prohíbe eliminar o renombrar columnas y exige compatibilidad aditiva estricta en SQLite. `ChatThread` requiere unicidad `@@unique([channel, phone, environment])` y no soporta múltiples comentaristas por post ni metadatos de medios. Por consiguiente, es obligatorio crear dos modelos aditivos en `prisma/schema.prisma`: `InstagramPost` e `InstagramComment`.
3. **De las observaciones 3 y 4:** El token activo pertenece a la cuenta de creador `@sour_jhxn` y su cuenta actualmente posee `media_count: 0`. Esto significa que el despacho de llamadas debe usar el dominio `graph.instagram.com` (para tokens `IGAA...`) y que las pruebas automatizadas deben incluir payloads de prueba o mocking para validar el flujo completo mientras la cuenta no tenga posts públicos reales.
4. **De la documentación de Meta y la observación 4:**
   - Para respuesta pública: `POST https://graph.instagram.com/v22.0/{comment_id}/replies?message=...` crea la respuesta en el post.
   - Para respuesta privada (Private Reply): `POST https://graph.instagram.com/v22.0/me/messages` (o `graph.facebook.com` si se usa token de página) con `recipient: { comment_id: ... }` despacha un DM al comentarista bajo las restricciones estrictas de Meta (máximo 1 envío por comentario dentro de los 7 días posteriores).
5. **De la observación 5:** El lugar idóneo para la visualización de publicaciones y comentarios es un conmutador de vista en la barra superior de `UnifiedOmnichannelView`, que alterne entre `[💬 Chats Directos]` y `[📸 Publicaciones & Comentarios]`, delegando en un panel especializado `InstagramPostsPanel` que muestre posts a la izquierda, hilo de comentarios al centro con selector de respuesta pública/privada, y contexto de cliente a la derecha.

---

## 3. Caveats

1. **Cuenta en Modo Desarrollo / Live en Meta:** La cuenta `@sour_jhxn` es un `MEDIA_CREATOR`. Si la aplicación de Meta en developers.facebook.com se encuentra en "Modo Desarrollo", las respuestas a comentarios de usuarios que no sean evaluadores registrados (Instagram Testers) pueden ser rechazadas por Meta con error de permisos.
2. **Volumen de Medios Actual:** Dado que `@sour_jhxn` tiene actualmente `media_count: 0`, la sincronización inicial vía Graph API retornará un array vacío hasta que se publiquen fotos/reels en dicha cuenta o se inserten registros de prueba en SQLite.
3. **Restricción de Anidamiento de Meta:** Meta Graph API no permite responder públicamente a respuestas de segundo nivel (solo a comentarios de nivel superior). El selector en la interfaz debe desactivar el botón de respuesta pública en comentarios que ya sean respuestas (`isReply: true`).

---

## 4. Conclusion

El requerimiento R3 es completamente viable y técnicamente compatible con la arquitectura actual. Requiere:
1. **Actualización del Webhook:** Agregar bifurcación para `change.field === "comments"`.
2. **Ampliación Aditiva de Prisma:** Incorporar `InstagramPost` e `InstagramComment`.
3. **Nueva Biblioteca Graph API:** Funciones en `lib/meta-graph-api.ts` o módulo dedicado para listar comentarios y despachar respuestas públicas (`/replies`) y privadas (`recipient.comment_id`).
4. **UI en Omnicanalidad:** Conmutador de modo en la cabecera de `UnifiedOmnichannelView` y componente `InstagramPostsPanel` con compositor de respuesta dual.

El reporte detallado completo ha sido escrito en:
`c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_followup_r3\analysis.md`.

---

## 5. Verification Method

Para verificar independientemente las conclusiones y el estado de la integración:

1. **Verificar el token y cuenta configurada de Instagram:**
   ```powershell
   node -e "const token = 'IGAAQEc31zGvVBZAGJGbkN3YTBsdXh5YlNWSkhXVkdBNE1QVjVpRDhIUGRyYjZAiaTQ1YU5ldjc2eVk5TGlyVG1oMkI3ZAk1iNU1wU1FyUDhRQUs2NWp3UXh3bk1HN2d3SVRfa3drYWozeGFNb2NTbDZAtUnI2aUo1dk02ZA2hudmJUZAwZDZD'; fetch('https://graph.instagram.com/v22.0/me?fields=id,username,media_count,account_type&access_token=' + token).then(r => r.json()).then(console.log);"
   ```
   *Resultado esperado:* `{ id: "29643476368611224", username: "sour_jhxn", media_count: 0, account_type: "MEDIA_CREATOR" }`.

2. **Verificar el código del webhook actual en `app/api/webhooks/instagram/route.ts`:**
   Inspeccionar líneas 286–306 para confirmar que `change.field` se omite y se delega a `processInstagramMessage`.

3. **Verificar ausencia de modelos en `prisma/schema.prisma`:**
   Comprobar que no existen modelos `InstagramPost` ni `InstagramComment`.
