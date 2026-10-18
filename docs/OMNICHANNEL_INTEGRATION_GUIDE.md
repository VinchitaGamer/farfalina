# Guía Maestra de Integración Omnicanal (Omnichannel SaaS Blueprint)

> **Documento de Arquitectura y Guía de Implementación Paso a Paso**  
> *Módulo de Comunicaciones Omnicanal: WhatsApp (Baileys + Cloud API), Instagram Direct, Facebook Messenger, TikTok y Chrome Extension Relay.*

---

## 1. Visión General de la Arquitectura

El sistema omnicanal contenido en este respaldo es una solución empresarial completa diseñada para unificar todas las conversaciones de mensajería de un negocio en una sola pantalla reactiva.

El módulo resuelve el desafío más común en mensajería empresarial: **no depender exclusivamente de las APIs oficiales de Meta (que exigen verificación comercial y pago por conversación)**, combinando tres motores complementarios:

```
                                  ┌────────────────────────────────────────┐
                                  │       Bandeja Unificada (React)        │
                                  │  components/.../unified-omnichannel    │
                                  └───────────────────┬────────────────────┘
                                                      │
                                    Server Actions & API Routes
                                                      │
         ┌────────────────────────────────────────────┼────────────────────────────────────────┐
         │                                            │                                        │
         ▼                                            ▼                                        ▼
┌──────────────────┐                       ┌──────────────────┐                     ┌─────────────────────┐
│ Motor 1: Baileys │                       │  Motor 2: Meta   │                     │ Motor 3: Chrome Ext │
│   WhatsApp Web   │                       │    Graph API     │                     │     Meta Relay      │
├──────────────────┤                       ├──────────────────┤                     ├─────────────────────┤
│ • Sin costo Meta │                       │ • WhatsApp Cloud │                     │ • Zero-API bridge   │
│ • QR Socket puro │                       │ • Instagram DM   │                     │ • Sin permisos Meta │
│ • Multi-tenant   │                       │ • FB Messenger   │                     │ • Scraper/Crawler   │
│ • Autenticación  │                       │ • Comentarios IG │                     │ • Inyección Outbound│
│   local/carpeta  │                       │ • Webhooks HTTPS │                     │ • Polling de colas  │
└──────────────────┘                       └──────────────────┘                     └─────────────────────┘
         │                                            │                                        │
         └────────────────────────────────────────────┴────────────────────────────────────────┘
                                                      │
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │     Base de Datos ORM       │
                                       │    PostgreSQL / SQLite      │
                                       │  ChatThread · ChatMessage   │
                                       │ ChannelConfig · QuickReply  │
                                       └─────────────────────────────┘
```

---

## 2. Los 3 Motores de Ingesta y Despacho

### Motor 1: WhatsApp Autónomo vía Baileys (`@whiskeysockets/baileys`)
- **Archivos:** `lib/baileys-socket-manager.ts`, `app/actions/omnichannel.ts`
- **Cómo opera:**
  - Emula un cliente web de WhatsApp directamente mediante WebSockets.
  - Genera un código QR dinámico en Base64 (`generateWhatsAppQRAction`) que el negocio escanea desde su celular WhatsApp (Dispositivos Vinculados).
  - Almacena las credenciales criptográficas de sesión en disco (`baileys_auth/{tenant}/creds.json`).
  - Escucha eventos `messages.upsert`: descarga audio, imágenes y documentos automáticamente a `public/uploads/whatsapp/`.
  - Registra o actualiza el hilo en `ChatThread` y crea el registro en `ChatMessage`.
  - Envía mensajes instantáneos sin costo alguno por mensaje.

### Motor 2: Meta Graph API Oficial v22.0
- **Archivos:** `lib/meta-whatsapp.ts`, `lib/meta-graph-api.ts`, `app/api/webhooks/`
- **Cómo opera:**
  - **WhatsApp Cloud API:** Endpoint `/api/webhooks/whatsapp`. Recibe payloads firmados (`x-hub-signature-256`), resuelve IDs de medios (`GET /{media-id}`), descarga los binarios mediante Bearer token y emite mensajes de texto, plantillas o medios con `POST /{phone-number-id}/messages`.
  - **Facebook Messenger & Instagram Direct:** Endpoints `/api/webhooks/facebook` y `/api/webhooks/instagram`.
  - **Comentarios y Posts de Instagram:** Lee posts publicados (`GET /{ig-user-id}/media`), comentarios anidados (`GET /{media-id}/comments`), permite responder públicamente y enviar **Private Replies** (iniciar un chat privado DM desde el comentario público de un cliente).

### Motor 3: Chrome Extension Relay (Meta Business Suite Bridge)
- **Archivos:** `extension-meta-relay/`, `scripts/meta-deep-sync.js`, `/api/relay/`
- **Cómo opera:**
  - **Para qué sirve:** Si el cliente tiene Facebook/Instagram pero **no tiene cuenta de desarrollador verificada en Meta Developers** o sus tokens caducaron, la extensión de Chrome se abre en `https://business.facebook.com/latest/inbox/all`.
  - **Inbound (Extracción):** El content script inspecciona el DOM virtualizado de Meta, desplaza el scroll paso a paso (*deep sync*), extrae contactos y mensajes históricos con paginación ascendente (`scrollTop = 0`), y envía los lotes en JSON a `POST /api/relay/inbound`.
  - **Outbound (Respuesta):** Cuando el operador responde desde la app web, el mensaje se encola en `RelayOutboundQueue`. La extensión consulta periódicamente `GET /api/relay/outbound`, toma el mensaje, lo escribe en el compositor de Meta, inyecta adjuntos mediante `ClipboardEvent` sintético de pegado, pulsa "Enviar" y confirma el estado a `POST /api/relay/ack`.

---

## 3. Modelo de Datos Prisma Requerido

Copia estos modelos a tu archivo `prisma/schema.prisma` en el nuevo proyecto (funciona tanto para SQLite como para PostgreSQL cambiando `@default(cuid())` por `uuid()` o dejándolo como cuid):

```prisma
// Configuración de Canales Conectados
model ChannelConfig {
  id                    String    @id @default(cuid())
  channel               String    // WhatsApp, Facebook, Instagram, TikTok
  environment           String    @default("default") // Multi-tenant / Marca
  status                String    @default("DISCONNECTED") // CONNECTED, DISCONNECTED, QR_READY
  qrCodeData            String?   // Data URL del código QR escaneable
  whatsappPhoneNumberId String?  // Meta WhatsApp Cloud API Phone Number ID
  whatsappWabaId        String?   // Meta WABA ID
  whatsappAccessToken   String?   // Token permanente de System User de Meta
  whatsappBusinessPhone String?   // Teléfono visible (ej: +591 70000000)
  facebookPageToken     String?   // Token FanPage Facebook Messenger
  facebookPageId        String?   // ID de Página de Facebook
  instagramAccessToken  String?   // Token de Acceso Instagram Direct
  instagramAccountId    String?   // ID de Cuenta de Instagram Business
  tiktokAppId           String?   // TikTok App ID
  tiktokAccessToken     String?   // TikTok Access Token
  tiktokOpenId          String?   // TikTok Open ID
  verifyToken           String?   // Token de Verificación de Webhook
  lastSyncAt            DateTime?
  updatedAt             DateTime  @updatedAt
  createdAt             DateTime  @default(now())

  @@unique([channel, environment], name: "channel_tenant_unique")
}

// Hilo / Conversación Unificada de un Cliente
model ChatThread {
  id            String        @id @default(cuid())
  clientName    String
  phone         String        // Número telefónico o identificador externo único
  channel       String        // WhatsApp, Facebook, TikTok, Instagram
  status        String        @default("Por Responder") // Pendiente, Por Responder, Archivados
  lastMessage   String
  assignedAgent String        @default("Agente General")
  profilePicUrl String?       // Avatar o foto de perfil cacheada
  environment   String        @default("default")
  lastMessageAt DateTime?
  externalId    String?       // Meta mailbox ID, PSID o IGSID
  rawTimestamp  String?
  unreadCount   Int           @default(0)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  messages      ChatMessage[]

  @@unique([channel, phone, environment], name: "chatthread_tenant_unique")
  @@index([environment, status])
}

// Mensaje Individual dentro de un Hilo
model ChatMessage {
  id           String     @id @default(cuid())
  threadId     String
  sender       String     // customer, bot, agent
  text         String
  mediaUrl     String?    // Ruta local cacheada o URL pública del adjunto
  mediaType    String?    // image, video, audio, document, sticker
  environment  String     @default("default")
  externalId   String?    // ID único de mensaje de Meta/WhatsApp para deduplicación
  rawTimestamp String?
  timestamp    DateTime?
  createdAt    DateTime   @default(now())
  thread       ChatThread @relation(fields: [threadId], references: [id], onDelete: Cascade)

  @@unique([threadId, environment, id], name: "chatmessage_tenant_unique")
  @@index([threadId, createdAt])
  @@index([threadId, externalId])
}

// Respuestas Rápidas (Canned Responses / Atajos)
model QuickReply {
  id        String   @id @default(cuid())
  title     String   // Título o descripción del atajo
  category  String   @default("General") // General, Pagos, Envíos, Catálogo
  text      String   // Contenido del texto a enviar
  mediaUrl  String?  // Adjunto opcional (PDF, imagen, catálogo)
  mediaName String?  // Nombre del archivo adjunto
  mediaType String?  // document, image, audio
  shortcut  String?  // Atajo de teclado (ej: /catalogo, /pagos)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Cola de Salida para el Bridge de la Extensión Chrome
model RelayOutboundQueue {
  id          String    @id @default(cuid())
  threadId    String
  messageId   String?
  channel     String    // Facebook, Instagram
  clientName  String?
  phone       String?
  text        String
  mediaUrl    String?
  environment String    @default("default")
  status      String    @default("PENDING") // PENDING, SENT, DELIVERED, FAILED
  error       String?
  sentAt      DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([environment, status])
}

// Posts y Comentarios de Instagram (Social Commerce)
model InstagramPost {
  id            String             @id @default(cuid())
  instagramId   String             @unique
  caption       String?
  mediaType     String?            // IMAGE, VIDEO, CAROUSEL_ALBUM, REELS
  mediaUrl      String?
  thumbnailUrl  String?
  permalink     String?
  commentsCount Int                @default(0)
  likeCount     Int                @default(0)
  timestamp     DateTime?
  environment   String             @default("default")
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  comments      InstagramComment[]

  @@index([environment, createdAt])
}

model InstagramComment {
  id                 String             @id @default(cuid())
  instagramId        String             @unique
  postId             String
  text               String
  fromId             String?
  fromUsername       String?
  userProfilePic     String?
  parentId           String?
  isReply            Boolean            @default(false)
  isPrivateReplySent Boolean            @default(false)
  privateReplyText   String?
  environment        String             @default("default")
  timestamp          DateTime?          @default(now())
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt
  post               InstagramPost      @relation(fields: [postId], references: [id], onDelete: Cascade)
  replies            InstagramComment[] @relation("CommentReplies")
  parent             InstagramComment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)

  @@index([postId, createdAt])
  @@index([environment, createdAt])
}
```

---

## 4. Dependencias NPM Necesarias

Para incluir este módulo en cualquier proyecto Next.js (App Router), instala las siguientes dependencias:

```bash
npm install @whiskeysockets/baileys qrcode pino zod lucide-react clsx tailwind-merge
npm install -D @types/qrcode @types/node
```

> **Nota Crítica sobre Baileys en Next.js:**  
> Baileys utiliza WebSocket nativo y buffer binario en Node.js. Debe excluirse del empaquetado del cliente y compilarse con Node.js en servidor. En `next.config.mjs`, agrega:
> ```javascript
> /** @type {import('next').NextConfig} */
> const nextConfig = {
>   serverExternalPackages: ["@whiskeysockets/baileys", "pino", "better-sqlite3"],
> };
> export default nextConfig;
> ```

---

## 5. Mapeo de Archivos para Clonar en tu Proyecto

Para llevarte este módulo a un nuevo SaaS, copia la siguiente estructura de archivos desde este repositorio:

| Archivo Origen | Propósito / Responsabilidad |
|---|---|
| `lib/baileys-socket-manager.ts` | Motor WebSocket de WhatsApp directo con generación de QR en Base64 y descarga de multimedia. |
| `lib/meta-whatsapp.ts` | Cliente oficial Meta WhatsApp Cloud API (v22.0). |
| `lib/meta-graph-api.ts` | Cliente Graph API para Instagram DM, Facebook Messenger, Posts y Comentarios. |
| `lib/instagram-profile.ts` | Resolvedor de avatar y handle de Instagram con fallback y caché. |
| `lib/media-server.ts` | Descargador y proxy de archivos multimedia de CDN a disco local. |
| `app/actions/omnichannel.ts` | Todas las Server Actions de la bandeja: hilos, mensajes, QR, tokens, quick replies y comentarios. |
| `app/api/webhooks/whatsapp/route.ts` | Webhook receptor y verificador para WhatsApp Cloud API. |
| `app/api/webhooks/facebook/route.ts` | Webhook para mensajes y eventos de Facebook Messenger. |
| `app/api/webhooks/instagram/route.ts` | Webhook para mensajes y comentarios de Instagram Direct. |
| `app/api/webhooks/tiktok/route.ts` | Webhook para eventos entrantes de TikTok. |
| `app/api/relay/inbound/route.ts` | Receptor de chats/mensajes enviados por la extensión de Chrome. |
| `app/api/relay/outbound/route.ts` | Despachador de mensajes pendientes para inyección en Chrome. |
| `app/api/relay/ack/route.ts` | Confirmación de envío exitoso desde la extensión de Chrome. |
| `components/shared/omnichannel/unified-omnichannel-view.tsx` | La interfaz completa de la bandeja de entrada (3 columnas: filtros, chat, cliente). |
| `components/shared/omnichannel/instagram-posts-panel.tsx` | Panel interactivo de publicaciones de Instagram con visor de comentarios y respuesta privada. |
| `extension-meta-relay/` | La carpeta con el código de la extensión de Chrome Manifest V3 lista para cargar. |
| `scripts/meta-deep-sync.js` | Script para correr en la consola DevTools de Meta Business Suite. |

---

## 6. Variables de Entorno (`.env`)

Configura estas variables en tu archivo `.env`:

```env
# URL Pública de la aplicación (o URL de Cloudflare Tunnel durante desarrollo)
NEXT_PUBLIC_APP_URL="https://tu-dominio-o-tunel.com"
APP_URL="https://tu-dominio-o-tunel.com"

# Verificación de Webhooks de Meta (Token arbitrario que inventas y pones en Meta Developers)
META_VERIFY_TOKEN="tu_token_secreto_super_seguro_2026"

# (Opcional si usas Meta Cloud API directamente en lugar de solo Baileys)
META_ACCESS_TOKEN="EAA..."
META_PHONE_NUMBER_ID="123456789012345"
META_WABA_ID="123456789012345"

# (Opcional si conectas Facebook Page)
FACEBOOK_PAGE_ID="123456789"
FACEBOOK_PAGE_TOKEN="EAA..."

# (Opcional si conectas Instagram Business)
INSTAGRAM_ACCOUNT_ID="17841400000000000"
INSTAGRAM_ACCESS_TOKEN="EAA..."
```

---

## 7. Paso a Paso: Cómo Desplegar el Omnicanal en un Nuevo Negocio

### Paso 1: Configurar la Base de Datos
1. Agrega los modelos Prisma a tu proyecto (`schema.prisma`).
2. Ejecuta `npx prisma db push` o `npx prisma migrate dev` para crear las tablas en tu base de datos (PostgreSQL o SQLite).

### Paso 2: Copiar Archivos Backend y Frontend
1. Copia `lib/baileys-socket-manager.ts`, `lib/meta-graph-api.ts`, `lib/meta-whatsapp.ts` a tu carpeta `lib/`.
2. Copia `app/actions/omnichannel.ts` a tu carpeta `app/actions/`.
3. Copia `app/api/webhooks/` y `app/api/relay/` a tu carpeta `app/api/`.
4. Copia `components/shared/omnichannel/` a tu carpeta de componentes.

### Paso 3: Crear la Página en el App Router
Crea la ruta `app/omnichannel/page.tsx` con el siguiente Server Component minimalista:

```tsx
import { UnifiedOmnichannelView } from "@/components/shared/omnichannel/unified-omnichannel-view";
import { getChatThreadsAction, getChannelConfigsAction, getQuickRepliesAction } from "@/app/actions/omnichannel";

export default async function OmnichannelPage() {
  const [threadsRes, configsRes, repliesRes] = await Promise.all([
    getChatThreadsAction("Todos"),
    getChannelConfigsAction(),
    getQuickRepliesAction(),
  ]);

  return (
    <main className="h-screen w-full overflow-hidden bg-slate-950">
      <UnifiedOmnichannelView
        initialThreads={threadsRes.success ? threadsRes.data : []}
        initialConfigs={configsRes.success ? configsRes.data : []}
        initialQuickReplies={repliesRes.success ? repliesRes.data : []}
      />
    </main>
  );
}
```

### Paso 4: Conectar WhatsApp en 30 Segundos
1. Abre tu navegador en `http://localhost:3000/omnichannel` (o tu dominio de producción).
2. Haz clic en el engranaje de **Configuración de Canales** > **WhatsApp**.
3. Selecciona **Conexión Directa QR (Baileys)** y pulsa **Generar Código QR**.
4. Abre WhatsApp en tu teléfono celular > **Dispositivos Vinculados** > **Vincular Dispositivo** y escanea el código en pantalla.
5. ¡Listo! A partir de ese momento, cada mensaje entrante aparecerá al instante en tu bandeja unificada con soporte completo para imágenes, audios de voz y documentos.

### Paso 5: (Opcional) Activar Sincronización Meta Business Suite con la Extensión
1. Abre Google Chrome y ve a `chrome://extensions/`.
2. Activa el **Modo Desarrollador** y pulsa **Cargar descomprimida**.
3. Selecciona la carpeta `extension-meta-relay/`.
4. Entra a `https://business.facebook.com/latest/inbox/all`.
5. Verás el HUD flotante de la extensión. Pulsa **🚀 Sincronizar Todo** para extraer todas las conversaciones históricas de Facebook e Instagram al CRM automáticamente.

---

## 8. Consideraciones de Producción (Netlify, Vercel y VPS)

1. **Persistencia de Sesión de Baileys:**
   - Baileys requiere un sistema de archivos local para guardar las llaves de sesión (`baileys_auth/`).
   - En plataformas serverless sin estado como Netlify Functions o Vercel Serverless, los WebSockets persistentes de larga duración no pueden mantenerse vivos permanentemente.
   - **Recomendación para despliegue en la nube:**
     - **Opción A (Recomendada para Netlify):** Utilizar la **Meta WhatsApp Cloud API oficial** y los Webhooks (`app/api/webhooks/whatsapp`), que son 100% serverless, stateless y compatibles de forma nativa con Netlify y Supabase.
     - **Opción B (Para Baileys sin costo):** Ejecutar el proceso de Baileys en un microservicio Node.js o VPS independiente (ej: PM2 en un droplet de $4/mes, Railway, Render o Fly.io) y conectarlo mediante el webhook `/api/relay/inbound`.
2. **Caché de Archivos Multimedia:**
   - Para producción con Netlify o Vercel, almacena las imágenes y archivos subidos en **Supabase Storage** o AWS S3 en lugar de `public/uploads/`.
3. **Seguridad en Webhooks:**
   - Valida siempre la firma `x-hub-signature-256` utilizando tu `APP_SECRET` de Meta para evitar ataques de inyección de payloads falsificados.

---
*Fin de la Guía Maestra Omnicanal. Este documento queda respaldado junto con el código fuente completo en `standalone-omnichannel-saas`.*
