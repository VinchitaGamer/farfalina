# Análisis Técnico Exhaustivo — Requisito R3: Publicaciones y Comentarios de Instagram

**Fecha:** 2026-10-06  
**Agente Investigador:** Explorer Subagent (Codebase Explorer R3)  
**Entorno de Trabajo:** `c:\Users\Lenovo\Desktop\floreria`  
**Objetivo:** Diagnosticar, auditar y mapear los requerimientos técnicos y arquitectónicos para la captura por webhook, persistencia en SQLite, visualización omnicanal y despacho de respuestas (públicas y privadas) a publicaciones y comentarios de Instagram.

---

## 1. Resumen Ejecutivo

El Requisito R3 establece la necesidad de transformar la suite omnicanal para que no solo procese mensajes directos (DMs) de Instagram, sino que además capture en tiempo real los comentarios entrantes sobre las publicaciones de la cuenta (`@sour_jhxn`), visualice los posts y sus hilos de comentarios con datos del autor y fecha, y permita a los operadores emitir respuestas públicas (`POST /{comment_id}/replies`) o privadas (Private Reply de Instagram Messaging API).

### Hallazgos Principales:
1. **Comportamiento Crítico en Webhook Existente:** En `app/api/webhooks/instagram/route.ts` (líneas 286–306), el bucle que procesa `entry[].changes` no discrimina el campo `change.field`. Si Meta entrega un evento con `field: "comments"`, el código actual intenta interpretarlo como un mensaje directo privado, creando un hilo `ChatThread` con número `val.from.id` y registrando el comentario como un mensaje de chat privado sin contexto de publicación.
2. **Ausencia de Modelos en Base de Datos:** `prisma/schema.prisma` cuenta con modelos para `ChatThread`, `ChatMessage`, `CRMClient` y `ChannelConfig`, pero carece por completo de entidades para `InstagramPost` o `InstagramComment`. Se diseñaron dos nuevos modelos aditivos compatibles al 100% con SQLite y con la regla de gobernanza no destructiva de `AGENTS.md`.
3. **Credencial y Cuenta Verificadas en Vivo:** En `ChannelConfig` existe un registro activo para `Instagram` en `farfalina` con `instagramAccountId: "29643476368611224"` y un token nativo de Instagram User Token (`IGAA...`). Se comprobó mediante consulta real a Meta Graph API (`https://graph.instagram.com/v22.0/me`) que el token es **completamente válido**, pertenece a `@sour_jhxn` (tipo `MEDIA_CREATOR`), con `media_count: 0`.
4. **Regla de Enrutamiento de URLs de Meta:** Los tokens que inician con `IGAA` pertenecen a Instagram User Login y deben consumirse mediante `https://graph.instagram.com/v22.0/`. Al invocarse contra `https://graph.facebook.com/`, Meta rechaza la petición con código 190 (`Invalid OAuth access token`).
5. **Integración en UI:** La vista unificada `UnifiedOmnichannelView` (`components/shared/omnichannel/unified-omnichannel-view.tsx`) implementa un workspace denso de 3 columnas para DMs. Se determinó que la integración óptima para comentarios es un conmutador de vista en la barra superior (`Relay Control Bar`) que alterna entre `[💬 Chats Directos]` y `[📸 Publicaciones & Comentarios]`, reutilizando los colores y estado multi-tenant de Farfalina y Carissma.

---

## 2. Auditoría y Procesamiento del Webhook (`app/api/webhooks/instagram/route.ts`)

### 2.1. Estado Actual de la Implementación
El archivo `app/api/webhooks/instagram/route.ts` (528 líneas) cuenta con la siguiente estructura de recepción:
- **Verificación GET (Líneas 93–139):** Valida `hub.mode === "subscribe"` comparando `hub.verify_token` contra `process.env.META_VERIFY_TOKEN`, `DEFAULT_VERIFY_TOKEN` ("farfalina_carissma_webhook_verify_token_2026") o `ChannelConfig.verifyToken`.
- **Firma POST (Líneas 145–160):** Valida `x-hub-signature-256` mediante HMAC SHA-256 si `META_APP_SECRET` está configurado.
- **Formato 0 (Líneas 189–206):** Maneja eventos de prueba directa de Meta (`field: "messages"` a nivel raíz).
- **Formato 1 (Líneas 241–284):** Recorre `entry[].messaging[]`, procesa mensajes directos salientes (Echoes) y entrantes, descargando adjuntos con `downloadAndCacheMetaMedia`.
- **Formato 2 (Líneas 287–306):** Recorre `entry[].changes[]`:
```typescript
// Líneas 287-306 en app/api/webhooks/instagram/route.ts:
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

### 2.2. Diagnóstico del Error de Diseño
El código anterior asume que todo elemento en `entry.changes` es un mensaje directo. Sin embargo:
- Cuando Meta emite una notificación de comentario, el campo es `change.field === "comments"`.
- En este caso, `val.from.id` es el ID del usuario que comentó, `val.text` es el texto del comentario y `val.id` es el ID del comentario.
- Al pasarlo ciegamente a `processInstagramMessage`:
  1. Se busca o crea un `ChatThread` con canal `"Instagram"` y teléfono igual a `val.from.id`.
  2. Se inserta un `ChatMessage` en ese chat privado.
  3. Se pierde la referencia a la publicación (`val.media.id`) y al comentario padre (`val.parent_id`).
  4. La bandeja de entrada privada de la florista se llena de comentarios sueltos fuera de contexto.

### 2.3. Estructura Exacta del Payload de Meta para `comments`
Cuando un usuario comenta en una publicación o reel de la cuenta de Instagram conectada, Meta entrega un payload con la siguiente estructura:

```json
{
  "object": "instagram",
  "entry": [
    {
      "id": "29643476368611224",
      "time": 1740000000,
      "changes": [
        {
          "field": "comments",
          "value": {
            "id": "17890123456789012",
            "text": "¿Tienen disponibilidad de rosas rojas para hoy?",
            "from": {
              "id": "9876543210123456",
              "username": "maria_flores_bo"
            },
            "media": {
              "id": "17901234567890123",
              "media_product_type": "FEED"
            },
            "parent_id": "17855555555555555"
          }
        }
      ]
    }
  ]
}
```

#### Catálogo de Campos de Meta:
| Campo | Tipo | Presencia | Descripción |
|---|---|---|---|
| `entry[].id` | String | Obligatorio | ID de la cuenta de Instagram Business/Creator (`29643476368611224`). |
| `entry[].changes[].field` | String | Obligatorio | Debe ser `"comments"` (o `"live_comments"` en transmisiones en vivo). |
| `value.id` | String | Obligatorio | ID global único del comentario en Instagram. |
| `value.text` | String | Obligatorio | Contenido textual del comentario. |
| `value.from.id` | String | Opcional/Frecuente | IGSID (Instagram Scoped User ID) del autor del comentario. |
| `value.from.username` | String | Frecuente | Nombre de usuario público sin `@` (`maria_flores_bo`). |
| `value.media.id` | String | Obligatorio | ID del objeto multimedia (Post, Carousel o Reel) sobre el que se comentó. |
| `value.media.media_product_type` | String | Opcional | Tipo de producto: `FEED`, `STORY`, `REELS`, `AD`. |
| `value.parent_id` | String | Condicional | Presente únicamente si el comentario es una respuesta anidada a otro comentario. Si es comentario principal, este campo no viene o es `null`. |

### 2.4. Esquema Zod Propuesto para el Webhook
Para adherirse estrictamente a `clean-code` y `AGENTS.md`:

```typescript
export const MetaInstagramCommentChangeValueSchema = z.object({
  id: z.string().min(1, "El ID del comentario es requerido"),
  text: z.string().optional().default(""),
  from: z.object({
    id: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
  }).optional().nullable(),
  media: z.object({
    id: z.string().min(1, "El ID del medio es requerido"),
    media_product_type: z.string().optional().nullable(),
  }),
  parent_id: z.string().optional().nullable(),
}).passthrough();

export type MetaInstagramCommentChangeValue = z.infer<typeof MetaInstagramCommentChangeValueSchema>;
```

### 2.5. Lógica de Despacho en el Webhook
En `app/api/webhooks/instagram/route.ts`, se debe incorporar una bifurcación explícita según `change.field`:
```typescript
for (const change of changesList) {
  if (change.field === "comments" || change.field === "live_comments") {
    await processInstagramCommentEvent({
      changeValue: change.value,
      environment,
      accessToken: igToken,
      accountId: igAccountId,
    });
  } else if (change.field === "messages" || !change.field) {
    // Procesar mensaje directo existente
    ...
  }
}
```

---

## 3. Almacenamiento y Persistencia de Datos (`prisma/schema.prisma`)

### 3.1. Estado Actual del Esquema
En `prisma/schema.prisma` no existen tablas para publicaciones o comentarios sociales. Las tablas actuales del dominio de mensajería son:
- `ChatThread`: Modelada exclusivamente para conversaciones 1-a-1 identificadas por un número de teléfono o IGSID único (`chatthread_tenant_unique: @@unique([channel, phone, environment])`).
- `ChatMessage`: Mensajes vinculados a un único `threadId`.

### 3.2. Razón para Modelos Dedicados (`InstagramPost` & `InstagramComment`)
Intentar forzar los comentarios en `ChatThread` viola los principios de diseño de datos:
1. Una publicación de Instagram tiene decenas de usuarios distintos comentando en el mismo hilo. `ChatThread` solo soporta un `clientName` y un `phone` por hilo.
2. Un post cuenta con metadatos multimedia propios: `mediaUrl`, `caption`, `permalink`, `commentsCount`, `likeCount`, `thumbnailUrl`.
3. Mezclar comentarios públicos con pedidos privados en la bandeja de chat generaría caos operativo en las floristas.

### 3.3. Modelos Aditivos Propuestos para `prisma/schema.prisma`
De acuerdo con la directiva de Gobernanza No Destructiva de `AGENTS.md` (no alterar ni eliminar columnas existentes, evolución 100% aditiva):

```prisma
model InstagramPost {
  id            String             @id @default(cuid())
  instagramId   String             @unique // ID del Media en Meta Graph API (ej: 17901234567890123)
  caption       String?
  mediaType     String?            // IMAGE, VIDEO, CAROUSEL_ALBUM, REELS
  mediaUrl      String?            // URL del medio o imagen cacheada
  thumbnailUrl  String?            // Miniatura para videos o reels
  permalink     String?            // Enlace directo en instagram.com
  commentsCount Int                @default(0)
  likeCount     Int                @default(0)
  timestamp     DateTime?          // Fecha original de publicación en Instagram
  environment   String             @default("farfalina") // farfalina, carissma
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  comments      InstagramComment[]

  @@index([environment, createdAt])
}

model InstagramComment {
  id                 String             @id @default(cuid())
  instagramId        String             @unique // ID del comentario en Meta Graph API
  postId             String             // Relación con InstagramPost
  text               String
  fromId             String?            // IGSID del autor del comentario
  fromUsername       String?            // Handle @username del autor
  userProfilePic     String?            // Avatar resuelto y cacheado localmente
  parentId           String?            // ID de comentario padre si es respuesta anidada
  isReply            Boolean            @default(false)
  isPrivateReplySent Boolean            @default(false) // Bandera de Private Reply enviado
  privateReplyText   String?            // Registro del texto enviado por DM
  environment        String             @default("farfalina")
  timestamp          DateTime?          @default(now())
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  post               InstagramPost      @relation(fields: [postId], references: [id], onDelete: Cascade)
  replies            InstagramComment[] @relation("CommentReplies")
  parent             InstagramComment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)

  @@index([postId, createdAt])
  @@index([environment, createdAt])
  @@index([fromId])
}
```

#### Ventajas del Diseño:
- **Idempotencia:** `@unique` en `instagramId` asegura que reintentos de webhooks de Meta no dupliquen comentarios.
- **Relación Anidada:** La autorrelación `"CommentReplies"` modela con precisión hilos de discusión y respuestas de los asesores.
- **Auditoría de Private Reply:** `isPrivateReplySent` previene violar la estricta cuota de Meta (máximo 1 respuesta privada por comentario).
- **Compatibilidad SQLite:** No requiere tipos enum nativos (usa strings) ni triggers complejos.

---

## 4. Arquitectura de Interfaz Omnicanal (UI/UX)

### 4.1. Análisis del Workspace Existente
- **Páginas de Entrada:**
  - `app/(workspace)/floreria/omnichannel/page.tsx`
  - `app/(workspace)/carissma/omnichannel/page.tsx`
  Ambas páginas instancian `UnifiedOmnichannelView` (`components/shared/omnichannel/unified-omnichannel-view.tsx`).
- **Estructura Visual de `UnifiedOmnichannelView`:**
  - **Barra Superior (Líneas 688–757):** Badge del módulo, indicador de conectividad de canales (WhatsApp, Messenger, Instagram), botón "Abrir Meta Business Suite", modal de configuración y botón de limpieza de caché.
  - **Columna 1 (Líneas 792–950):** Lista de hilos de chat con buscador, filtro de canales y estados ("Todos", "Por Responder", "Pendientes", "Archivados").
  - **Columna 2 (Líneas 951–1450):** Ventana de conversación activa con burbujas de chat, visualizador multimedia y barra de escritura.
  - **Columna 3 (Líneas 1451–1850):** Panel CRM y Drawer de emisión rápida de pedidos o contratos.

### 4.2. Propuesta de Ubicación e Integración de UI
Para ofrecer la mejor experiencia sin romper el flujo de chat en vivo:
1. **Conmutador de Modo en la Barra Superior:**
   Incorporar en la barra superior un selector de pestañas principal:
   - `[💬 Mensajes Directos (DMs)]`
   - `[📸 Publicaciones & Comentarios]` (con badge indicador de comentarios sin responder).
2. **Subcomponente Dedicado `InstagramPostsPanel`:**
   Al seleccionar el modo `Publicaciones & Comentarios`, se renderiza una vista optimizada de 2 o 3 columnas:
   - **Columna Izquierda (Feed de Publicaciones):**
     - Grid/Lista de posts con imagen miniatura, snippet del caption, fecha, conteo de comentarios y likes.
     - Botón "Sincronizar Publicaciones" con Meta Graph API.
     - Enlace externo a la publicación en Instagram (`permalink`).
   - **Columna Central (Hilo de Comentarios del Post Seleccionado):**
     - Encabezado con imagen/video completa del post, caption extendido y estadísticas.
     - Lista jerárquica de comentarios: autor con `@username`, avatar, texto del comentario, tiempo transcurrido (e.g., "Hace 15 min").
     - Estado visual si ya se emitió respuesta pública o privada.
     - Barra de redacción con selector de modalidad:
       - `[💬 Respuesta Pública]`: Se publica bajo el comentario en Instagram.
       - `[🔒 Mensaje Privado (DM)]`: Se envía como Direct Message privado aprovechando el Private Reply de Meta.
   - **Columna Derecha (Ficha CRM del Comentarista):**
     - Si el comentarista tiene interacciones previas o está registrado en `CRMClient`, se despliega su ficha para que la asesora conozca su historial de compras y preferencias.

---

## 5. Mecanismo de Despacho de Respuestas (Graph API)

### 5.1. Respuesta Pública a Comentarios
- **Endpoint:** `POST https://graph.instagram.com/v22.0/{comment_id}/replies` (o `https://graph.facebook.com/v22.0/{comment_id}/replies`).
- **Parámetros:**
  - `message`: Texto de la respuesta (string obligatorio).
  - `access_token`: Token de Instagram configurado en `ChannelConfig`.
- **Restricciones de Meta:**
  - Solo se puede responder públicamente a comentarios de **primer nivel** (no admite anidamiento mayor a 1 nivel).
  - La respuesta queda registrada inmediatamente en Instagram bajo el post público.

### 5.2. Respuesta Privada (Private Reply)
- **Endpoint:** `POST https://graph.facebook.com/v22.0/{page_id}/messages` o `POST https://graph.instagram.com/v22.0/me/messages`.
- **Estructura del Payload:**
```json
{
  "recipient": {
    "comment_id": "<COMMENT_ID>"
  },
  "message": {
    "text": "Hola @maria_flores_bo, te enviamos el catálogo y precios por privado..."
  }
}
```
- **Reglas Estrictas de Meta Graph API:**
  1. **Límite Temporal (7 días):** Solo se puede enviar una respuesta privada dentro de los **7 días** siguientes a la creación del comentario.
  2. **Regla de Mensaje Único:** Se permite exactamente **UNA** respuesta privada por comentario. Todo intento adicional fallará con error de Graph API.
  3. **Ventana de Conversación:** El envío del mensaje privado abre el canal de DM en la bandeja del usuario; sin embargo, la ventana estándar de 24 horas para envío de mensajes subsiguientes solo se activa una vez que el usuario responde al mensaje directo.
  4. **Persistencia en Omnicanal:** Al despachar un Private Reply:
     - Se actualiza `InstagramComment.isPrivateReplySent = true`.
     - Se crea o actualiza el hilo en `ChatThread` y se inserta el `ChatMessage` como saliente (`sender: "agent"`), garantizando que si el cliente responde, la conversación continúe naturalmente en la bandeja de DMs.

### 5.3. Estado de Tokens y Permisos en `ChannelConfig`
- Se auditó la base de datos `prisma/dev.db`:
  - `channel: "Instagram"`, `environment: "farfalina"`.
  - `instagramAccountId: "29643476368611224"`.
  - `instagramAccessToken: "IGAAQEc31zGv..."`.
- **Validación en Vivo Realizada:**
  - Petición: `GET https://graph.instagram.com/v22.0/me?fields=id,username,account_type,media_count&access_token=IGAA...`
  - Resultado:
    ```json
    {
      "id": "29643476368611224",
      "username": "sour_jhxn",
      "media_count": 0,
      "account_type": "MEDIA_CREATOR"
    }
    ```
- **Hallazgo Crítico:** La cuenta `@sour_jhxn` actualmente tiene `media_count: 0`. Para el proceso de desarrollo y pruebas QA, se deberán proveer mocks representativos o simular webhooks de publicaciones y comentarios mediante scripts de prueba.

---

## 6. Plan de Implementación Recomendado (Blueprint)

### Paso 1: Extensión de Esquema Prisma
- Agregar `InstagramPost` e `InstagramComment` en `prisma/schema.prisma`.
- Ejecutar `npx prisma db push` o script con adapter BetterSqlite3 para aplicar los cambios sin pérdida de datos.

### Paso 2: Biblioteca de Integración Meta (`lib/instagram-comments.ts` o `lib/meta-graph-api.ts`)
- Implementar funciones:
  - `fetchInstagramPosts(token, accountId)`
  - `fetchInstagramComments(token, mediaId)`
  - `replyPublicInstagramComment(token, commentId, message)`
  - `replyPrivateInstagramComment(token, accountId, commentId, message)`

### Paso 3: Refactorización del Webhook (`app/api/webhooks/instagram/route.ts`)
- Añadir el esquema `MetaInstagramCommentChangeValueSchema`.
- Agregar la bifurcación para `change.field === "comments"`.
- Implementar `processInstagramCommentEvent` para upsert de `InstagramPost` e `InstagramComment`.

### Paso 4: Server Actions (`app/actions/instagram-comments.ts`)
- `getInstagramPostsWithCommentsAction(environment)`
- `syncInstagramPostsAction(environment)`
- `sendCommentReplyAction({ commentId, text, mode, environment })`

### Paso 5: Componente de UI (`components/shared/omnichannel/instagram-posts-panel.tsx`)
- Crear el componente visual con lista de posts, hilo de comentarios y formulario de respuesta doble (pública / privada).
- Integrar la pestaña en `UnifiedOmnichannelView`.

---

## 7. Conclusión
La arquitectura del proyecto está preparada para albergar el Requisito R3 de forma limpia y robusta. La corrección del desvío en el webhook actual es prioritaria para evitar la corrupción de la bandeja de mensajes directos, y los nuevos modelos aditivos permitirán una experiencia fluida tanto para la visualización de publicaciones como para el despacho de respuestas públicas y privadas.
