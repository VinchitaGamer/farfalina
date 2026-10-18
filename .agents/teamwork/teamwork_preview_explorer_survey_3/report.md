# Auditoría Integral de Seguridad y Configuraciones de Meta Developers (Instagram Direct)

**Fecha**: 2026-10-06  
**Auditor**: `teamwork_preview_explorer_survey_3` (Explorer - Survey Meta & Security)  
**Alcance**: Requerimiento R3 — Modo de App Meta Developers, Evaluadores de Instagram, Directiva Móvil de Privacidad, Registro `ChannelConfig` en SQLite y Validación Criptográfica HMAC-SHA256 (`x-hub-signature-256`).

---

## 1. Resumen Ejecutivo de la Auditoría

Se realizó una investigación profunda, forense y de extremo a extremo sobre el canal de **Instagram Direct**, abarcando:
1. **Configuración de Meta Developers**: Diferencias críticas entre *Modo Desarrollo* y *Modo En Vivo*, flujo de invitación y aceptación de *Evaluadores de Instagram (Instagram Testers)* para la cuenta `@sour_jhxn` y remitentes de prueba.
2. **Directiva de Privacidad Móvil**: Interruptor de seguridad *"Permitir acceso a los mensajes"* dentro de la aplicación móvil de Instagram para cuentas de creador/empresa.
3. **Estado de `ChannelConfig` en SQLite (`prisma/dev.db`)**: Verificación de registros, ID de cuenta `29643476368611224`, validez en vivo del token de acceso vía llamadas directas a Meta Graph API v22.0.
4. **Validación Criptográfica de Firmas**: Comportamiento del encabezado `x-hub-signature-256`, lectura de `META_APP_SECRET` desde `.env` / `.env.local`, y simulación de 6 escenarios de verificación HMAC-SHA256.
5. **Hallazgos Adicionales de Impacto**: Detección de un error en `lib/instagram-profile.ts` (campo inválido `profile_pic` en Graph API) y omisión de sincronización con `CRMClient` en el webhook.

### Tabla de Diagnóstico Rápido

| Parámetro / Componente | Estado Actual | Veredicto | Impacto en Flujo de Mensajes Reales |
|---|---|---|---|
| **Canal Instagram en DB** | `CONNECTED` (`farfalina`) | ✅ Correcto | Cuenta `29643476368611224` activa en SQLite |
| **Token de Acceso Instagram** | Activo (`IGAAQEc31z...`) | ✅ 100% Válido | Verificado contra `graph.instagram.com/v22.0/me` (HTTP 200) |
| **Endpoint Webhook GET** | Responde HTTP 200 con Challenge | ✅ Operativo | Localhost:3000 y Túnel Cloudflare activos |
| **Endpoint Webhook POST** | Procesa `messaging[]` y persiste | ✅ Operativo | Mensajes guardados en `ChatMessage` y `ChatThread` |
| **Validación HMAC-SHA256** | Bypass (inactiva) | ⚠️ Permisiva | `META_APP_SECRET` ausente en `.env`; **NO está bloqueando mensajes** |
| **Modo Meta Developers** | Probable Desarrollo (*Dev Mode*) | 🔴 **BLOQUEO 1** | Meta descarta en silencio mensajes si el remitente no es Tester aceptado |
| **Privacidad en App Móvil** | Por verificar en teléfono | 🔴 **BLOQUEO 2** | Si "Permitir acceso a los mensajes" está OFF, Meta no emite webhooks |
| **Resolución de Perfil IG** | Error 100 en `profile_pic` | ⚠️ Defecto UI | Nombres caen en `Cliente Instagram (XXXX)` en vez de `@sour_jhxn` |
| **Persistencia en CRMClient** | No implementada en `route.ts` | ⚠️ Brecha R2 | Mensajes llegan a chat pero no crean/vinculan `CRMClient` |

---

## 2. Diagnóstico de Meta Developers (Modo Desarrollo vs En Vivo)

### 2.1. Comportamiento en Modo Desarrollo (*Development Mode*)
Por diseño estricto de Meta Platforms Inc.:
- Toda aplicación nueva o en desarrollo opera en un entorno cerrado (*sandbox*).
- **Regla de oro de Meta**: En modo desarrollo, la Graph API de Instagram **únicamente** despacha eventos de webhooks y permite lectura/escritura de mensajes si las partes involucradas (el titular del token y el usuario remitente) poseen un **rol activo y aceptado** dentro de la app en Meta Developers.
- **Efecto observador**: Si una cuenta de Instagram personal externa (que no es desarrollador ni tester de la app) envía un mensaje directo a `@sour_jhxn`, **Meta NO emite la petición POST al webhook**. Meta descarta el evento en sus servidores de forma silenciosa. El emisor ve el mensaje como enviado en Instagram, pero el backend jamás recibe tráfico HTTP.

### 2.2. Requisitos para Pruebas en Modo Desarrollo: Evaluadores de Instagram (*Instagram Testers*)
Para que un usuario de prueba pueda enviar un mensaje a `@sour_jhxn` y activar el webhook en local:
1. **Rol de `@sour_jhxn`**: La cuenta de Instagram `@sour_jhxn` (ID `29643476368611224`, `MEDIA_CREATOR`) es la cuenta destino (receptora) asociada al token.
2. **Rol del Remitente**: La cuenta de Instagram del usuario que envía el mensaje de prueba **DEBE ser registrada como "Evaluador de Instagram" (Instagram Tester)** en el panel de Meta Developers:
   - Ruta: *Meta Developers Console > Tu App > Roles de la aplicación > Roles > Evaluadores de Instagram > Agregar evaluadores de Instagram*.
   - Se debe ingresar el `@nombre_de_usuario` exacto de la cuenta de prueba.
3. **Paso Crítico de Aceptación (Obligatorio)**:
   - El registro en la consola deja la invitación en estado **"Pendiente"** (*Pending*).
   - Mientras la invitación esté pendiente, Meta **NO** habilitará la entrega de mensajes.
   - El titular de la cuenta de prueba debe iniciar sesión en Instagram y acceder a:  
     👉 `https://www.instagram.com/accounts/manage_access/`  
     (O en la app móvil: *Configuración y privacidad > Permisos de sitios web > Apps y sitios web > Invitaciones de evaluador*).
   - Debe pulsar el botón **"Aceptar" (Accept)**.

### 2.3. Transición a Modo En Vivo (*Live Mode*)
Para recibir mensajes de cualquier usuario público sin registrarlos como evaluadores:
- La aplicación de Meta debe pasar a **Modo En Vivo**.
- **Requisitos de Meta para Modo En Vivo en Instagram Messaging**:
  1. Solicitud de **Revisión de la aplicación (App Review)** para los permisos:
     - `instagram_manage_messages` (Acceso Avanzado)
     - `instagram_basic`
     - `pages_manage_metadata` (si se vincula a través de una Fan Page de Facebook)
  2. Subir video de demostración (*screencast*) del funcionamiento del chat y cómo interactúa el operador humano.
  3. Proporcionar URL pública de Política de Privacidad y Términos de Servicio.
  4. Realizar **Verificación de Negocio** en Meta Business Manager.
- **Conclusión de Modo**: Para la fase de puesta a punto y pruebas con el cliente, la aplicación debe mantenerse en **Modo Desarrollo**, asegurando que todos los involucrados en las pruebas estén agregados y **hayan aceptado** el rol de *Instagram Tester*.

---

## 3. Directiva de Privacidad en la Aplicación Móvil de Instagram

### 3.1. Interruptor "Permitir acceso a los mensajes" (*Connected Tools*)
En cuentas profesionales de Instagram (Creador o Empresa), Meta implementó una capa de consentimiento explícito en el dispositivo móvil:

- **Ruta exacta en la aplicación móvil de Instagram**:
  1. Abrir la app de Instagram con la sesión iniciada en `@sour_jhxn`.
  2. Ir al perfil y tocar el menú de tres líneas (esquina superior derecha).
  3. Seleccionar **"Configuración y privacidad"** (*Settings and privacy*).
  4. Deslizar hasta la sección **"Cómo pueden interactuar contigo los demás"** y pulsar en **"Mensajes y respuestas a historias"** (*Messages and story replies*).
  5. Entrar a **"Herramientas conectadas"** (*Connected tools*).
  6. Verificar el interruptor: **"Permitir acceso a los mensajes"** (*Allow access to messages*).
  7. **Debe estar en estado ACTIVO (Azul / ON)**.

### 3.2. Mecanismo de Bloqueo
- Si este interruptor está **DESACTIVADO (OFF)**:
  - Los servidores de Instagram aplican una regla de firewall a nivel de cuenta.
  - La suscripción al webhook (`messages`) queda inhibida para eventos entrantes.
  - El token de la Graph API no recibe autorización para leer la bandeja de entrada privada.
  - **No se emitirá ningún evento POST hacia `https://omnichannel.farfalina.tech/api/webhooks/instagram`**.

---

## 4. Estado de `ChannelConfig` en SQLite (`prisma/dev.db`)

Se realizó una inspección directa a la base de datos local SQLite utilizando `better-sqlite3`:

```sql
SELECT id, channel, status, environment, instagramAccountId, instagramAccessToken, verifyToken, updatedAt 
FROM ChannelConfig WHERE channel = 'Instagram';
```

### Resultados Obtenidos:

| Campo | Valor Registrado | Análisis Técnico |
|---|---|---|
| `id` | `cmuq8llpi001dpcuhly2qif4f` | CUID generado por Prisma |
| `channel` | `Instagram` | Coincide con discriminador del sistema |
| `status` | `CONNECTED` | Canal activo en interfaz de usuario |
| `environment` | `farfalina` | Entorno multitenant principal |
| `instagramAccountId` | `29643476368611224` | ID de cuenta de creador de Instagram |
| `instagramAccessToken` | `IGAAQEc31zGvVBZAGJGbkN3YTBsdXh...` | Token de larga duración (Long-Lived User Token) |
| `verifyToken` | `null` | Nulo en DB, pero `route.ts` usa fallback `DEFAULT_VERIFY_TOKEN` |
| `updatedAt` | `2026-10-06 05:45:03` | Sincronizado recientemente |

### Verificación del Token en Vivo contra Meta Graph API
Se ejecutó una consulta HTTPS en vivo desde el entorno local contra `https://graph.instagram.com/v22.0/me`:

```json
// GET https://graph.instagram.com/v22.0/me?fields=id,username,account_type&access_token=IGAAQEc31z...
{
  "id": "29643476368611224",
  "username": "sour_jhxn",
  "account_type": "MEDIA_CREATOR"
}
```

**Resultado**:
- El token almacenado en `prisma/dev.db` es **100% VÁLIDO y AUTÉNTICO**.
- Corresponde exactamente a la cuenta `@sour_jhxn` (`29643476368611224`), de tipo `MEDIA_CREATOR`.
- No ha expirado ni ha sido revocado.

---

## 5. Auditoría Criptográfica: `x-hub-signature-256` y `META_APP_SECRET`

### 5.1. Implementación en `app/api/webhooks/instagram/route.ts`
El código fuente en las líneas 76-92 implementa:

```typescript
const rawBody = await req.text();
const signature = req.headers.get("x-hub-signature-256");
const appSecret = process.env.META_APP_SECRET;

if (appSecret && signature) {
  const hmac = crypto.createHmac("sha256", appSecret);
  const digest = "sha256=" + hmac.update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(digest);
  const actualBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    return NextResponse.json(
      { success: false, data: null, error: "Invalid signature", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }
}
```

### 5.2. Evaluación de Variables de Entorno en el Servidor
Se inspeccionaron los archivos de configuración en la raíz del proyecto:
- `.env`:
  ```env
  DATABASE_URL="file:./prisma/dev.db"
  CHATWOOT_BASE_URL=https://chatwoot.example.com
  ...
  ```
  **`META_APP_SECRET` NO existe en `.env`**.
- `.env.local`: **No existe**.
- Proceso Node.js: `process.env.META_APP_SECRET === undefined`.

### 5.3. Matriz de Comportamiento de Firmas (6 Escenarios Auditados)

Se simularon y probaron los 6 escenarios operativos en el entorno de ejecución:

| Escenario | `META_APP_SECRET` | Header `x-hub-signature-256` | Resultado HTTP | ¿Bloquea Mensajes? | Detalle / Causa |
|---|---|---|---|---|---|
| **1. Estado Actual (Meta Real)** | `undefined` | Presente (`sha256=...`) | **HTTP 200 OK** | ❌ No bloquea | La condición `if (appSecret && signature)` evalúa a `false`. Verificación saltada. |
| **2. Pruebas Locales (Curl/Postman)** | `undefined` | Ausente | **HTTP 200 OK** | ❌ No bloquea | Condición evalúa a `false`. Permite pruebas sintéticas. |
| **3. Secreto Válido Configurado** | Real de Meta | Presente (Firma legítima) | **HTTP 200 OK** | ❌ No bloquea | HMAC coincide; `crypto.timingSafeEqual` valida exitosamente. |
| **4. Secreto Inválido / Placeholder** | `"tu_app_secret..."` | Presente (Firma de Meta) | **HTTP 401 UNAUTHORIZED** | 🔴 **BLOQUEO TOTAL** | El digest no coincide con la clave real de Meta. Meta descarta el webhook tras reintentos. |
| **5. Secreto Configurado pero Sin Header** | Real de Meta | Ausente | **HTTP 200 OK** | ❌ No bloquea | Al ser `if (appSecret && signature)`, permite peticiones sin firma (vulnerabilidad en producción). |
| **6. Ataque de Falsificación de Firma** | Real de Meta | Presente (Firma falsa) | **HTTP 401 UNAUTHORIZED** | 🛡️ Protegido | Algoritmo timing-safe detecta discrepancia de bytes y rechaza el ataque. |

### Conclusiones Criptográficas:
1. **La falta de recepción de mensajes NO se debe a una firma rechazada**: Dado que `META_APP_SECRET` no está configurado, la validación de firmas no está activa en el servidor local.
2. **Advertencia crítica para configuración futura**: Si un desarrollador añade `META_APP_SECRET` al archivo `.env`, **debe ser obligatoriamente el App Secret auténtico copiado de la consola de Meta Developers** (`Configuración de la app > Básica > Clave secreta de la app`). Si se coloca un valor de prueba (como `"tu_app_secret_de_meta_aqui"`), **todos los mensajes reales de Instagram quedarán bloqueados con error 401**.

---

## 6. Hallazgos Técnicos Adicionales en el Código Local

### 6.1. Defecto en `lib/instagram-profile.ts` (Error 100 de Meta Graph API)
Al recibir un mensaje de un usuario nuevo, la función `fetchInstagramProfile` (línea 70) intenta obtener los datos del remitente consultando:
```
https://graph.instagram.com/v22.0/${igsid}?fields=name,username,profile_pic
```
- **Fallo observado en prueba en vivo**: Meta responde con error:
  ```json
  {
    "error": {
      "message": "Tried accessing nonexisting field (profile_pic)",
      "type": "IGApiException",
      "code": 100
    }
  }
  ```
- **Consecuencia**: El método falla, entra en catch y devuelve `null`. El sistema crea el hilo en `ChatThread` con el nombre de reserva `Cliente Instagram (XXXX)` en lugar de mostrar `@sour_jhxn` o el nombre del cliente.
- **Corrección recomendada**: Cambiar los campos solicitados a `id,username,name,profile_picture_url`.

### 6.2. Ausencia de Sincronización con `CRMClient` en `route.ts`
El requerimiento R2 exige que los mensajes se asocien a un `CRMClient` existente o nuevo en `prisma/dev.db`.
- **Inspección de código**: En `app/api/webhooks/instagram/route.ts` (líneas 235 a 372), únicamente se interactúa con `prisma.chatThread` y `prisma.chatMessage`. No existe ninguna llamada a `prisma.cRMClient`.
- **Referencia existente**: En `app/api/relay/inbound/route.ts` (líneas 301-346) existe la lógica probada para buscar o crear `CRMClient` (`name`, `phone`, `notes`, `loyaltyTier: "Bronce"`). Esta lógica debe ser trasladada a `app/api/webhooks/instagram/route.ts`.

---

## 7. Plan de Acción y Recomendaciones

### Para el Usuario / Administrador de Meta:
1. **Verificar Modo y Roles en Meta Developers**:
   - Acceder a [developers.facebook.com](https://developers.facebook.com).
   - En *Roles de la app > Roles > Evaluadores de Instagram*, verificar que la cuenta emisora de mensajes esté agregada.
   - En el perfil de Instagram de esa cuenta emisora, entrar a `https://www.instagram.com/accounts/manage_access/` y hacer clic en **Aceptar**.
2. **Activar Interruptor de Privacidad en Móvil**:
   - En el teléfono donde está abierta la cuenta `@sour_jhxn`:
   - Ir a *Configuración y privacidad > Mensajes y respuestas a historias > Herramientas conectadas*.
   - Activar **"Permitir acceso a los mensajes"**.

### Para el Equipo de Desarrollo (Milestones M2 / M3):
1. **Mantener `META_APP_SECRET` vacío o sincronizado con la clave real**:
   - No colocar placeholders en `.env`.
   - Si se añade, extraer el valor real desde Meta Console > Configuración básica > Clave secreta de la app.
2. **Corregir campo de perfil en `lib/instagram-profile.ts`**:
   - Reemplazar `profile_pic` por `profile_picture_url` al consultar `graph.instagram.com`.
3. **Incorporar persistencia de `CRMClient` en `app/api/webhooks/instagram/route.ts`**:
   - Conectar la creación/actualización del cliente en la tabla `CRMClient` cuando ingrese un mensaje con remitente válido.
