# Project: Infraestructura Cloudflare Tunnel, Lanzador Local y Verificación de Webhooks Meta

## Architecture
El proyecto implementa la infraestructura de exposición pública HTTPS y automatización local para Florería Farfalina & Carissma:
1. **Infraestructura Cloudflare**: Exposición segura sin necesidad de abrir puertos de router ni IP pública fija mediante Cloudflare Zero Trust Tunnel (`cloudflared`), mapeando el tráfico HTTPS del subdominio propio hacia `http://localhost:3000`.
2. **Automatización de Túnel en Windows**: Scripts en PowerShell y Batch para verificar/descargar `cloudflared.exe`, ejecutar el túnel con token y registrarlo como servicio nativo de Windows (Auto-start al encender la PC).
3. **Lanzador Local del Cliente**: Script `start-system.bat` de un solo clic que inicializa Next.js en segundo plano, sondea la disponibilidad del servidor HTTP local y lanza automáticamente el navegador en modo aplicación (`--app=http://localhost:3000`).
4. **Validación de Webhooks Meta**: Verificación formal de los endpoints GET `/api/webhooks/whatsapp`, `/api/webhooks/facebook` y `/api/webhooks/instagram` ante el handshake de Meta Developers (`hub.mode=subscribe`, `hub.challenge`, `hub.verify_token`), garantizando respuesta HTTP 200 con el reto exacto en texto plano y compatibilidad con `META_VERIFY_TOKEN` y token de respaldo `farfalina_carissma_webhook_verify_token_2026`.
5. **Calidad y TypeScript**: Suite automatizada de pruebas y compilación estricta TypeScript (`npx tsc --noEmit`) 100% limpia.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R1: Guía DNS Cloudflare | Documento exhaustivo paso a paso para añadir dominio, cambiar Nameservers (GoDaddy, Namecheap, Hostinger, etc.), configurar SSL Universal y crear subdominio hacia túnel en Cloudflare Zero Trust. | M1 | Survey (R1) |
| 2 | R2.1: Descarga y Verificación cloudflared | Detección o descarga automatizada de `cloudflared-windows-amd64.exe` desde repositorio oficial. | M2 | Survey (R2) |
| 3 | R2.2: Ejecución Ad-hoc Túnel | Script interactivo para ejecutar el túnel con token hacia `http://localhost:3000`. | M2 | Survey (R2) |
| 4 | R2.3: Servicio Nativo Windows | Instalación, inicio, verificación de estado y desinstalación de `cloudflared` como servicio de Windows. | M2 | Survey (R2) |
| 5 | R3.1: Arranque Servidor Local | Script `start-system.bat` que arranca Next.js de forma no bloqueante (`npm run start` o `npm run dev`). | M3 | Survey (R3) |
| 6 | R3.2: Polling de Disponibilidad | Sondeo inteligente por HTTP/TCP hacia `http://localhost:3000` con tolerancia a redirección 307. | M3 | Survey (R3) |
| 7 | R3.3: Lanzamiento Navegador Modo App | Apertura del navegador en modo `--app=http://localhost:3000` (Chrome, Edge o predeterminado). | M3 | Survey (R3) |
| 8 | R4.1: Handshake GET Meta Webhooks | Verificación de que WhatsApp, Facebook e Instagram responden 200 con challenge exacto en texto plano. | M4 | Survey (R4) |
| 9 | R4.2: Manejo de Tokens y Env | Verificación con token por defecto (`farfalina_carissma_webhook_verify_token_2026`), `META_VERIFY_TOKEN`, y rechazo con 403 ante tokens erróneos. | M4 | Survey (R4) |
| 10 | R4.3: Script de Pruebas Automatizado | Script automatizado (`scripts/verify-meta-webhooks.ts` + `VERIFICAR_WEBHOOKS.bat`) ejecutable en Windows. | M4 | Survey (R4) |
| 11 | R4.4: TypeScript Limpio | Verificación estricta de compilación sin errores (`npx tsc --noEmit`). | M4 | Survey (R4) |
| 12 | R5: Verificación Integral E2E | Prueba de extremo a extremo, auditoría forense de integridad y revisión independiente de todos los entregables. | M5 | Survey (E2E) |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Guía de Dominio y DNS Cloudflare | Crear `docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md` | none | DONE |
| M2 | Scripts de Automatización Cloudflare Tunnel | Crear `scripts/setup-cloudflare-tunnel.ps1` y `CONFIGURAR_TUNEL_CLOUDFLARE.bat` | none | DONE |
| M3 | Lanzador Local Cliente | Crear `start-system.bat` en la raíz | none | DONE |
| M4 | Verificación de Webhooks y Script de Pruebas | Crear `scripts/verify-meta-webhooks.ts`, `VERIFICAR_WEBHOOKS.bat`, agregar script a `package.json`, validar `tsc --noEmit` | none | DONE |
| M5 | Verificación E2E y Auditoría Forense | Ejecución de suite de pruebas, revisión técnica, test adversarial y auditoría de integridad | M1, M2, M3, M4 | DONE |

## Interface Contracts
### Contrato Webhook Handshake GET de Meta
- **URL**: `/api/webhooks/whatsapp`, `/api/webhooks/facebook`, `/api/webhooks/instagram`
- **Query Params**:
  - `hub.mode`: `"subscribe"` (obligatorio)
  - `hub.verify_token`: Token a comparar contra `process.env.META_VERIFY_TOKEN` o fallback `farfalina_carissma_webhook_verify_token_2026`
  - `hub.challenge`: Cadena aleatoria enviada por Meta
- **Respuesta Éxito**:
  - Status: `200 OK`
  - Headers: `Content-Type: text/plain`
  - Body: exactamente el valor de `hub.challenge`
- **Respuesta Error**:
  - Token erróneo o modo inválido: Status `403 Forbidden`
  - Parámetros faltantes: Status `400 Bad Request` o `403 Forbidden`

### Contrato de Servicio Windows `cloudflared`
- Servicio: Nombre `cloudflared`
- Binario: `cloudflared.exe` en `%LOCALAPPDATA%\cloudflared\` o carpeta del proyecto
- Parámetros de servicio: `service install <TOKEN>`

### Contrato Lanzador `start-system.bat`
- Puerto objetivo: `http://localhost:3000`
- Ruta de redirección esperada: `/floreria/catalog` (HTTP 307)
- Comando de arranque: `npm run start` (si existe `.next`) o `npm run dev`
- Flags de navegador: `--app=http://localhost:3000`

## Code Layout
- `docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md` → Guía de Cloudflare DNS y Tunnel
- `scripts/setup-cloudflare-tunnel.ps1` → Script PowerShell para Cloudflare Tunnel
- `CONFIGURAR_TUNEL_CLOUDFLARE.bat` → Script Batch ejecutable en la raíz para Windows
- `start-system.bat` → Lanzador local de un clic en la raíz
- `scripts/verify-meta-webhooks.ts` → Script TypeScript de prueba de webhooks
- `VERIFICAR_WEBHOOKS.bat` → Ejecutable Batch para correr la suite de verificación de webhooks
