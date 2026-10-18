# MISIÓN: Desconectar VPS Antiguo y Solucionar Recepción de Mensajes de Instagram Direct en Local

## 1. Contexto General y Arquitectura
- El proyecto **Florería Farfalina & Carissma** se ha migrado para operar **100% en local (Windows)** en la computadora del cliente mediante **Cloudflare Tunnel**, prescindiendo de servicios externos y de VPS de pago.
- **Entorno Local**: 
  - Windows 11, Next.js 14+ App Router corriendo en `http://localhost:3000`.
  - Base de datos local: SQLite (`prisma/dev.db` usando `@prisma/adapter-better-sqlite3`).
  - Túnel Cloudflare: Servicio de Windows `cloudflared` activo y en ejecución automática.
  - Dominio público HTTPS del túnel: `https://omnichannel.farfalina.tech` apuntando a `http://localhost:3000`.
  - Handshake de webhooks probado y respondiendo HTTP 200 en `https://omnichannel.farfalina.tech/api/webhooks/instagram`.
  - Verify Token: `farfalina_carissma_webhook_verify_token_2026`.

---

## 2. Tarea 1: Cortar Conexión y Detener el VPS Antiguo
El dominio o tráfico web aún sigue llegando o interfiriendo con el VPS anterior de SOURDEV donde el sistema estuvo desplegado, provocando colisiones de endpoints y desincronización de bandejas.

### Datos de Conexión del VPS (Skill `vps-manager`):
- **IP del Servidor:** `207.211.167.189`
- **Usuario SSH:** `ubuntu`
- **Ruta de la Clave Privada SSH:** `C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key`
- **Ubicación del Proyecto en el VPS:** `/var/www/floreria-demo`
- **Proceso PM2:** `floreria` (id 0)

### Reglas Críticas para Ejecutar SSH desde PowerShell (Anti-bloqueos):
> **IMPORTANTE:** En Windows PowerShell, los comandos SSH deben usar obligatoriamente las banderas `-n` y `-o BatchMode=yes` para evitar que la terminal se congele esperando `stdin`.

### Comandos a Ejecutar en el VPS:
1. Conectarse y verificar el estado actual de PM2 y Nginx:
   ```powershell
   ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "pm2 status && sudo systemctl status nginx"
   ```
2. Detener y deshabilitar el proceso de la app en PM2 para que el VPS deje de responder a las solicitudes:
   ```powershell
   ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "pm2 stop floreria && pm2 delete floreria && pm2 save"
   ```
3. (Opcional si Nginx intercepta el dominio raíz `farfalina.tech`): Apagar Nginx o remover el virtualhost del dominio para que el tráfico quede 100% gobernado por el Cloudflare Tunnel:
   ```powershell
   ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "sudo systemctl stop nginx"
   ```
4. Verificar en el panel DNS de Cloudflare que tanto `farfalina.tech` como `omnichannel.farfalina.tech` no tengan registros `A` apuntando a la IP `207.211.167.189`, sino que apunten a los CNAMEs del túnel de Cloudflare (`<id-del-tunel>.cfargotunnel.com`).

---

## 3. Tarea 2: Solucionar Recepción de Mensajes Entrantes de Instagram Direct
A pesar de que el canal de Instagram figura como **CONECTADO** y la prueba sintética de Meta Developers ("Muestra del campo messages") llegó con éxito a la base de datos local (`Cliente Instagram (2334)` con texto `random_text`), **los mensajes directos reales entre usuarios no están ingresando**.

### Estado Actual de las Credenciales:
- **Token Instagram Direct (User/Page Token):**
  `IGAAQEc31zGvVBZAGJGbkN3YTBsdXh5YlNWSkhXVkdBNE1QVjVpRDhIUGRyYjZAiaTQ1YU5ldjc2eVk5TGlyVG1oMkI3ZAk1iNU1wU1FyUDhRQUs2NWp3UXh3bk1HN2d3SVRfa3drYWozeGFNb2NTbDZAtUnI2aUo1dk02ZA2hudmJUZAwZDZD`
- **Instagram Account ID:** `29643476368611224`
- **Username:** `sour_jhxn` (Tipo de cuenta: `MEDIA_CREATOR`)
- **Subscribed fields en Graph API:** `messages`
- **Endpoint del Webhook Local:**
  - Archivo: `app/api/webhooks/instagram/route.ts`
  - URL en Meta: `https://omnichannel.farfalina.tech/api/webhooks/instagram?env=farfalina`
  - Token de verificación: `farfalina_carissma_webhook_verify_token_2026`

### Diagnóstico Técnico que Debes Resolver:
1. **Verificar el modo de la App en Meta (Modo Desarrollo vs En Vivo):**
   - Si la App en Meta Developers está en **Modo Desarrollo** (*Development Mode*), Meta **BLOQUEA y descarta en silencio** los mensajes enviados por cualquier usuario que no tenga un rol explícito en la app.
   - La cuenta emisora del mensaje de prueba (por ejemplo, una cuenta de Instagram personal que escribe a `@sour_jhxn`) **debe estar agregada como "Evaluador de Instagram" (Instagram Tester)** dentro del panel de Meta Developers y **haber aceptado la invitación** en `https://www.instagram.com/accounts/manage_access/` (sección *Invitaciones de evaluador*).
2. **Interruptor de Privacidad en la App Móvil de Instagram:**
   - En la cuenta `@sour_jhxn` en el teléfono móvil, verificar que esté activo el permiso:
     *Instagram App ➔ Configuración y privacidad ➔ Mensajes y respuestas a historias ➔ Herramientas conectadas ➔ "Permitir acceso a los mensajes"* (**ON**). Si está apagado, la API de Meta no despacha eventos de mensajes.
3. **Payload y Formato en `app/api/webhooks/instagram/route.ts`:**
   - Inspeccionar los logs del servidor Next.js cuando se envía un mensaje real.
   - Asegurarse de que el handler POST soporte tanto el formato estándar `entry[].messaging[]` como `entry[].changes[]`.
   - Verificar si el header `x-hub-signature-256` está fallando por `META_APP_SECRET` mal configurado o vacío en el archivo `.env`.
   - Comprobar que el `ChannelConfig` en `prisma/dev.db` esté devolviendo `CONNECTED` con el `instagramAccountId` correcto.

---

## 4. Reglas de Código Obligatorias (`AGENTS.md`)
- Stack: Next.js 14+ App Router, Prisma v7 con SQLite (`prisma/dev.db`), Tailwind CSS, Zustand, Shadcn UI.
- No inventar interfaces TypeScript: Usar Zod con `z.infer<>`.
- Sin `any`.
- Fetch nativo de Next.js (prohibido Axios).
- Contrato JSON inmutable: `{ success, data, error, code }`.
