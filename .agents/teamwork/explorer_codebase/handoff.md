# Reporte de Exploración del Código y Estado del Proyecto (Codebase Survey)

**Fecha de ejecución**: 2026-10-06T02:58:00Z  
**Explorador**: `teamwork_preview_explorer` (Codebase Explorer)  
**Ubicación del reporte**: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\explorer_codebase\handoff.md`  
**Directorio base**: `c:\Users\Lenovo\Desktop\floreria`  

---

## 1. Observación (Observation)

### 1.1 Rutas de Webhooks en Next.js App Router (`app/api/`)
Se realizó una inspección exhaustiva de la estructura bajo `app/api/`. Se identificaron las siguientes rutas relevantes:

| Ruta | Archivo | Métodos Soportados | Propósito |
|---|---|---|---|
| `/api/webhooks/whatsapp` | `app/api/webhooks/whatsapp/route.ts` | `GET`, `POST` | Meta WhatsApp Cloud API v22.0 (mensajes, multimedia, acuses) |
| `/api/webhooks/facebook` | `app/api/webhooks/facebook/route.ts` | `GET`, `POST` | Meta Facebook Messenger (páginas, mensajes, eco) |
| `/api/webhooks/instagram` | `app/api/webhooks/instagram/route.ts` | `GET`, `POST` | Meta Instagram Direct (mensajes, cambios, menciones) |
| `/api/webhooks/evolution` | `app/api/webhooks/evolution/route.ts` | `GET`, `POST`, `OPTIONS` | Ingesta alternativa de Evolution API |
| `/api/webhooks/tiktok` | `app/api/webhooks/tiktok/route.ts` | `GET`, `POST` | Retorna HTTP 410 (API deshabilitada en Latinoamérica) |
| `/api/auth/callback/instagram` | `app/api/auth/callback/instagram/route.ts` | `GET` | OAuth Callback de Instagram |

---

### 1.2 Mecanismo del Handshake GET de Meta (`hub.mode`, `hub.challenge`, `hub.verify_token`)
Los tres endpoints de Meta (`whatsapp`, `facebook`, `instagram`) ya cuentan con la implementación estándar requerida por Meta Developers:

#### A. WhatsApp (`app/api/webhooks/whatsapp/route.ts`, líneas 18-97)
```typescript
const DEFAULT_VERIFY_TOKEN = "farfalina_carissma_webhook_verify_token_2026";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const queryEnv = searchParams.get("env") || searchParams.get("tenant");
    ...
    if (mode !== "subscribe" || !token) {
      return NextResponse.json(
        { success: false, data: null, error: "Bad Request: Missing mode or token", code: "BAD_REQUEST" },
        { status: 400 }
      );
    }

    // 1. Check environment variable
    const envToken = process.env.META_VERIFY_TOKEN;
    if (envToken && token === envToken) {
      return new NextResponse(challenge || "OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // 2. Check fallback default token
    if (token === DEFAULT_VERIFY_TOKEN) {
      return new NextResponse(challenge || "OK", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    // 3. Check ChannelConfig in DB for matching verifyToken (scoped to tenant or global)
    ...
```

#### B. Facebook Messenger (`app/api/webhooks/facebook/route.ts`, líneas 24-70)
```typescript
const DEFAULT_VERIFY_TOKEN = "farfalina_carissma_webhook_verify_token_2026";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    const verifyToken = process.env.META_VERIFY_TOKEN;

    if (mode === "subscribe" && token) {
      if ((verifyToken && token === verifyToken) || token === DEFAULT_VERIFY_TOKEN) {
        return new NextResponse(challenge || "OK", { status: 200, headers: { "Content-Type": "text/plain" } });
      }
      // Check database configs for matching verifyToken
      ...
    }
    return NextResponse.json({ success: false, data: null, error: "Forbidden: Token mismatch", code: "FORBIDDEN" }, { status: 403 });
```

#### C. Instagram Direct (`app/api/webhooks/instagram/route.ts`, líneas 25-71)
Idéntica lógica a Facebook Messenger:
1. Valida `mode === "subscribe"` y presencia de `hub.verify_token`.
2. Compara contra `process.env.META_VERIFY_TOKEN`.
3. Compara contra el token por defecto `DEFAULT_VERIFY_TOKEN` (`farfalina_carissma_webhook_verify_token_2026`).
4. Compara contra `prisma.channelConfig.verifyToken` en la base de datos.
5. Retorna `new NextResponse(challenge || "OK", { status: 200, headers: { "Content-Type": "text/plain" } })`.
6. Si el token no coincide, responde HTTP 403 con `{ success: false, error: "Forbidden: Token mismatch", code: "FORBIDDEN" }`.

---

### 1.3 Comportamiento y Aislamiento de los Handlers POST
- Los handlers `POST` son funciones `export async function POST(req: Request)` totalmente independientes de las funciones `GET`.
- En Next.js App Router (`route.ts`), los métodos HTTP son despachados por el runtime de Next.js en función del método de la solicitud entrante. Por lo tanto, el handshake GET **no altera ni interfiere** con el procesamiento POST de eventos.
- Manejo de seguridad en POST:
  - Verificación opcional de firma HMAC SHA-256 (`x-hub-signature-256`) usando `process.env.META_APP_SECRET`. Si la variable no está definida, no bloquea el procesamiento pero admite payloads de prueba.
  - Validación segura de JSON (captura errores de formato devolviendo HTTP 400).
  - Detección de inquilino (`farfalina` vs `carissma`) vía query parameter (`?env=...`) o por ID de recurso (`whatsappPhoneNumberId`, `facebookPageId`, `instagramAccountId`).
  - Creación/actualización idempotente en `ChatThread` y `ChatMessage` con deduplicación por `externalId` y ventana de tiempo (15 segundos).
  - Siempre responden HTTP 200 con `{ success: true, data: { received: true }, code: "SUCCESS" }` para que Meta no deshabilite el webhook.

---

### 1.4 Variables de Entorno y Configuración (`.env`)
Inspección directa del archivo `c:\Users\Lenovo\Desktop\floreria\.env`:
- **Contenido actual**:
  ```env
  DATABASE_URL="file:./prisma/dev.db"
  # Chatwoot & Evolution API Integration
  CHATWOOT_BASE_URL=https://chatwoot.example.com
  CHATWOOT_API_TOKEN=your_user_token_here
  CHATWOOT_ACCOUNT_ID=1
  CHATWOOT_WEBHOOK_SECRET=your_webhook_secret
  CHATWOOT_INBOX_IDS_FARFALINA=1,2
  CHATWOOT_INBOX_IDS_CARISSMA=3

  EVOLUTION_API_URL=http://localhost:8080
  EVOLUTION_API_KEY=global_api_key_here
  ```
- **Hallazgo clave**: `META_VERIFY_TOKEN` y `META_APP_SECRET` **no están definidos actualmente en `.env`**.
- Sin embargo, los 3 endpoints cuentan con el token de respaldo:
  `farfalina_carissma_webhook_verify_token_2026`
- No existen archivos `.env.example` ni `.env.local` en la raíz del proyecto.

---

### 1.5 Estado de Salud y Dependencias del Proyecto
Inspección de `package.json`:
- **Nombre**: `floreria-carissma-saas` (v0.1.0)
- **Framework**: `next@^14.2.15` (App Router)
- **React**: `react@^18.3.1`, `react-dom@^18.3.1`
- **TypeScript**: `typescript@^5.6.3`
- **ORM / Base de Datos**: `prisma@^7.9.1`, `@prisma/client@^7.9.1`, `@prisma/adapter-better-sqlite3@^7.9.1`, `better-sqlite3@^13.0.3`
- **Validación / Estado**: `zod@^3.23.8`, `zustand@^4.5.5`
- **Scripts definidos**:
  - `"dev": "next dev"`
  - `"build": "next build"`
  - `"start": "next start"`
  - `"lint": "next lint"`
  - `"postinstall": "node scripts/patch-baileys.js"`
  - *No existe un script `"test"` configurado.*

#### Verificación del Compilador TypeScript:
- **Comando ejecutado**: `npx tsc --noEmit`
- **Código de salida**: `0`
- **Errores detectados**: `0` (Compilación 100% limpia y sin advertencias ni errores).

---

### 1.6 Scripts Existentes en el Repositorio
Se encontraron los siguientes scripts por lotes en la raíz:
1. `INICIAR_FARFALINA.bat`:
   - Verifica existencia de Node.js (`where node`).
   - Lanza el navegador en `http://localhost:3000` con `start "" "http://localhost:3000"`.
   - Ejecuta `npm run start` (requiere un build de producción previo).
2. `INSTALAR_PRIMERA_VEZ.bat`:
   - Verifica Node.js.
   - Ejecuta `npm install`, `npx prisma generate` y `npm run build`.
3. `RESPALDAR_BASE_DE_DATOS.bat`:
   - Crea carpeta `Respaldos/` y copia `prisma\dev.db` con timestamp formateado.

*Scripts en `scripts/`:*
Contiene 32 utilidades de mantenimiento y migración (ej. `patch-baileys.js`, `backup-floreria-db.py`, etc.), pero **no existe ningún script de verificación automatizada del handshake de Meta Webhooks**.

---

### 1.7 Documentación Existente (`docs/`)
1. `docs/TUTORIAL-META-WHATSAPP-CLOUD-API.md`:
   - Guía completa de configuración para Meta Graph API v22.0, System User Token permanente (`EAAG...`), registro de webhooks en Meta Developers y URLs multi-inquilino.
   - Especifica explícitamente el token por defecto `farfalina_carissma_webhook_verify_token_2026`.
2. `docs/TUTORIAL-CONEXION-CHATWOOT-EVOLUTION.md`:
   - Guía para integración con Chatwoot y Evolution API.
3. *No existe actualmente la guía de Cloudflare Tunnel (`docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md`).*

---

## 2. Cadena Lógica (Logic Chain)

1. **Premisa**: Meta Developers exige que al registrar una URL de Webhook, el servidor receptor responda de inmediato a una solicitud HTTP `GET` que incluya `hub.mode=subscribe`, `hub.verify_token=<token>` y `hub.challenge=<número_aleatorio>`, retornando HTTP 200 con el reto exacto en texto plano (`text/plain`).
   - *Evidencia*: Observación 1.2 muestra que `whatsapp`, `facebook` e `instagram` extraen dichos parámetros, validan `mode === "subscribe"`, comprueban el token contra `META_VERIFY_TOKEN` o `DEFAULT_VERIFY_TOKEN`, y retornan `new NextResponse(challenge || "OK", { status: 200, headers: { "Content-Type": "text/plain" } })`.

2. **Premisa**: El sistema debe operar tanto con tokens personalizados en variables de entorno como sin configuración previa (out-of-the-box).
   - *Evidencia*: Observación 1.2 y 1.4 demuestran que si `META_VERIFY_TOKEN` no está configurado en `.env`, el sistema recurre al fallback `farfalina_carissma_webhook_verify_token_2026`, que está documentado en `docs/TUTORIAL-META-WHATSAPP-CLOUD-API.md`. Si el usuario define `META_VERIFY_TOKEN` en `.env`, este toma precedencia automáticamente.

3. **Premisa**: El soporte para el handshake GET no debe interferir con la recepción de eventos en tiempo real.
   - *Evidencia*: Observación 1.3 demuestra que los handlers `GET` y `POST` son funciones asíncronas separadas. Los eventos POST son despachados al handler `POST` por el App Router de Next.js sin pasar por la lógica de verificación del `GET`.

4. **Premisa**: La salud del código actual es adecuada para agregar los nuevos artefactos requeridos (scripts de Cloudflare Tunnel, script de arranque con un clic, script de prueba de webhooks, guía de configuración).
   - *Evidencia*: Observación 1.5 confirma que `npx tsc --noEmit` finaliza con código de salida 0 sin ningún error de tipado o importación.

---

## 3. Advertencias y Supuestos (Caveats)

1. **Estado del servidor local**: Durante la investigación, el servidor Next.js no estaba escuchando en el puerto 3000. Cualquier script de prueba de webhooks que haga peticiones HTTP requerirá que el servidor esté activo o levantará un servidor de prueba efímero.
2. **Framework de testing ausente**: No hay Jest o Vitest instalado en `package.json`. El script de verificación de webhooks requerido (R4) debe ser un script ejecutable ligero en Node.js (ej. `scripts/verify-meta-webhooks.mjs` o `scripts/test-meta-webhooks.js`) utilizando `fetch` nativo de Node.js 18+.
3. **Archivo `.env` actual**: Las variables `META_VERIFY_TOKEN` y `META_APP_SECRET` están ausentes en `.env`. Es altamente recomendable crear un `.env.example` explicativo y opcionalmente agregar valores modelo en `.env`.

---

## 4. Conclusión (Conclusion)

1. **Estado de Webhooks**: La lógica de verificación de Meta (WhatsApp, Facebook, Instagram) está **100% implementada y lista** en el código fuente de Next.js App Router. Responde a `hub.mode=subscribe` con HTTP 200 `text/plain` y el reto exacto.
2. **Token de verificación**: Funciona tanto con el token por defecto `farfalina_carissma_webhook_verify_token_2026` como con la variable de entorno `META_VERIFY_TOKEN`.
3. **Aislamiento GET/POST**: Completamente verificado; no hay colisión entre verificación GET e ingesta POST.
4. **Salud de TypeScript**: Impecable (`0 errores`).
5. **Artefactos a generar por los siguientes roles del equipo**:
   - `docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md` (R1)
   - Scripts de instalación y servicio de `cloudflared` en Windows (R2)
   - Lanzador local transparente `start-system.bat` (R3)
   - Script automatizado de pruebas de handshake GET de Meta Developers (R4)
   - Documentación de variables en `.env.example`

---

## 5. Método de Verificación Independiente (Verification Method)

Para verificar independientemente este diagnóstico:

1. **Verificar compilación TypeScript limpia**:
   ```powershell
   npx tsc --noEmit
   ```
   *Criterio de éxito*: Código de salida 0 sin salida de texto.

2. **Inspeccionar endpoints de webhook**:
   - `app/api/webhooks/whatsapp/route.ts` (líneas 18-97)
   - `app/api/webhooks/facebook/route.ts` (líneas 24-70)
   - `app/api/webhooks/instagram/route.ts` (líneas 25-71)

3. **Verificar respuesta de handshake en servidor activo (una vez iniciado `npm run dev` o `npm run start`)**:
   ```powershell
   # WhatsApp
   curl "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=test_123&hub.verify_token=farfalina_carissma_webhook_verify_token_2026"
   
   # Facebook
   curl "http://localhost:3000/api/webhooks/facebook?hub.mode=subscribe&hub.challenge=test_123&hub.verify_token=farfalina_carissma_webhook_verify_token_2026"
   
   # Instagram
   curl "http://localhost:3000/api/webhooks/instagram?hub.mode=subscribe&hub.challenge=test_123&hub.verify_token=farfalina_carissma_webhook_verify_token_2026"
   ```
   *Criterio de éxito*: Respuesta HTTP 200 con cuerpo `test_123` y `Content-Type: text/plain`.
