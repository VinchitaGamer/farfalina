# Registro de Cambios — Milestone M3: Publicaciones y Comentarios de Instagram

**Fecha:** 2026-10-06  
**Subagente:** Worker M3 (implementer, qa, specialist)  
**Entorno:** `c:\Users\Lenovo\Desktop\floreria`

---

## 1. Modelos Aditivos en Prisma (`prisma/schema.prisma`)
- Se agregaron los modelos `InstagramPost` e `InstagramComment` respetando la política de gobernanza estricta de `AGENTS.md` (no destructivo, 100% compatible con SQLite).
  - `InstagramPost`: Almacena `instagramId` (@unique), `caption`, `mediaType`, `mediaUrl`, `thumbnailUrl`, `permalink`, `commentsCount`, `likeCount`, `timestamp`, `environment`, `createdAt`, `updatedAt` e índice `@@index([environment, createdAt])`.
  - `InstagramComment`: Almacena `instagramId` (@unique), `postId` (FK `InstagramPost`), `text`, `fromId`, `fromUsername`, `userProfilePic`, `parentId` (FK autorrelación `parent` / `replies`), `isReply`, `isPrivateReplySent`, `privateReplyText`, `environment`, `timestamp`, `createdAt`, `updatedAt`, e índices `@@index([postId, createdAt])`, `@@index([environment, createdAt])`, `@@index([fromId])`.
- Se ejecutó `npx prisma db push` para aplicar los cambios a `prisma/dev.db` sin pérdida de datos.
- Se ejecutó `npx prisma generate` para sincronizar los tipos de Prisma Client v7.

## 2. Bifurcación y Enrutamiento en Webhook (`app/api/webhooks/instagram/route.ts`)
- Se incorporó el esquema Zod `MetaInstagramCommentChangeValueSchema` para validar la estructura del evento `field: 'comments'` de Meta Graph API.
- Se implementó la bifurcación en el bucle de `changes` (`lines 335–370`):
  - Cuando `change.field === 'comments'` o `'live_comments'`, se despacha a `processInstagramCommentEvent`.
  - Se garantiza que los comentarios **no ingresan** a `processInstagramMessage`, protegiendo la integridad de `ChatThread` y `ChatMessage` de mensajes directos.
- Se implementó `processInstagramCommentEvent`:
  - Extrae `mediaId`, `commentId`, `text`, `fromId`, `fromUsername`, `parent_id` y `created_time`.
  - Resuelve y descarga automáticamente el avatar del comentarista vía `getInstagramUserProfile`.
  - Realiza `upsert` de `InstagramPost` e intenta enriquecer metadatos multimedia si hay token activo.
  - Vincula comentarios anidados al `InstagramComment` padre mediante `internalParentId`.
  - Realiza `upsert` de `InstagramComment`.
  - Recalcula y actualiza `post.commentsCount`.
- Se dio soporte para `field: 'comments'` en eventos directos de muestra (Formato 0 de Meta).

## 3. Despacho de Respuestas en Graph API (`lib/meta-graph-api.ts`)
- Se implementó `replyInstagramCommentPublic`:
  - Llama a `POST https://graph.instagram.com/v22.0/{comment_id}/replies?access_token={token}` con `{ message }`.
  - Utiliza el dominio `graph.instagram.com` requerido para tokens de usuario de Instagram (`IGAA...`).
- Se implementó `replyInstagramCommentPrivate`:
  - Llama a `POST https://graph.instagram.com/v22.0/me/messages` con `recipient: { comment_id }` y `message: { text }`.
- Se agregaron las funciones auxiliares de sincronización:
  - `fetchInstagramMediaFromGraphApi`: Consulta `/me/media` con campos completos de publicaciones.
  - `fetchInstagramCommentsFromGraphApi`: Consulta `/{media_id}/comments` con comentarios y respuestas anidadas.

## 4. Server Actions de Omnicanalidad (`app/actions/omnichannel.ts`)
- Se implementaron 4 Server Actions con contrato JSON bilateral `{ success, data, error, code }`:
  - `getInstagramPostsAction({ environment })`: Retorna publicaciones con conteo y vista previa de comentarios.
  - `getInstagramCommentsAction({ postId, environment })`: Retorna comentarios y respuestas anidadas de un post.
  - `replyInstagramCommentAction({ commentId, text, replyType: 'public' | 'private', environment })`:
    - Valida parámetros y existencia de comentario en SQLite.
    - Aplica reglas estrictas de Meta para Private Reply (máx. 1 respuesta privada, límite de 7 días).
    - Despacha mediante Graph API y persiste la respuesta pública como nuevo comentario o actualiza `isPrivateReplySent` y sincroniza el hilo DM en `ChatThread`/`ChatMessage`.
  - `syncInstagramPostsAction({ environment })`: Sincroniza publicaciones y comentarios bajo demanda desde Meta.

## 5. Interfaz de Usuario Omnicanal
- Se creó `components/shared/omnichannel/instagram-posts-panel.tsx`:
  - Vista de 2 columnas: feed de publicaciones con miniaturas, estadísticas y enlaces directos a Instagram a la izquierda; hilo de comentarios interactivo y compositor a la derecha.
  - Soporte de visualización de avatares reales, autor `@username`, fecha formateada y auditoría de respuestas privadas enviadas.
  - Compositor con conmutador `[💬 Respuesta Pública]` y `[🔒 Mensaje Privado (DM)]` con notas contextuales y estado de carga.
  - Botón "Sincronizar Meta" para sincronización manual.
- Se actualizó `components/shared/omnichannel/unified-omnichannel-view.tsx`:
  - Se incorporó un selector de modo en la cabecera `Relay Control Bar` para alternar entre `[💬 Chats Directos]` y `[📸 Publicaciones & Comentarios]`.
  - Conexión fluida con el panel `InstagramPostsPanel` manteniendo la coherencia de estilos de Farfalina y Carissma.

## 6. Verificación Automatizada
- Se creó `scripts/verify-instagram-comments.ts`:
  - Verificó credenciales en `ChannelConfig`.
  - Simuló webhook de comentario principal y anidado.
  - Comprobó persistencia en SQLite (`InstagramPost` e `InstagramComment`).
  - Verificó aislamiento estricto de hilos de chat directo.
  - Probó `getInstagramPostsAction`, `getInstagramCommentsAction` y validaciones de `replyInstagramCommentAction`.
  - Validó llamadas de despacho contra Meta Graph API v22.0.
  - Ejecución exitosa con código de salida 0.
- Se ejecutó `npx tsc --noEmit` confirmando 0 errores de compilación TypeScript.
