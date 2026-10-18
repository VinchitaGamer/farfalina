## 2026-10-06T02:59:54Z
You are a Documentation Specialist Worker (teamwork_preview_worker).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_m1\
You MUST read ORIGINAL_REQUEST.md at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the technical specifications from spec_miner_tunnel at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\spec_miner_tunnel\handoff.md
And the project scope at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\orchestrator_1\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & File Ownership:
You EXCLUSIVELY own: docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md
Do NOT modify any other files.

Your Mission (Milestone M1 - R1):
Create a complete, crystal-clear, production-grade, and beautifully formatted guide in `docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md` covering:
1. Prerrequisitos: cuenta gratuita en Cloudflare, dominio propio en cualquier registrador (GoDaddy, Namecheap, Hostinger, DonWeb, etc.), servidor local Next.js en puerto 3000.
2. Paso 1: Añadir el dominio propio a Cloudflare Free y seleccionar el plan gratuito.
3. Paso 2: Cambio y delegación de Nameservers (DNS) paso a paso en los registradores más comunes (GoDaddy, Namecheap, Hostinger) y tiempo de propagación.
4. Paso 3: Configuración de Seguridad y SSL/TLS en Cloudflare (Universal SSL, modo Full/Flexible, Always Use HTTPS).
5. Paso 4: Creación del Túnel en Cloudflare Zero Trust (Access > Tunnels):
   - Crear túnel (nombre del túnel).
   - Obtener el Tunnel Token para Windows.
   - Configuración de Public Hostname: Subdominio (ej. `omnichannel.tudominio.com` o `api.tudominio.com`), Dominio propio, Servicio `HTTP` hacia `localhost:3000`. Explicación del CNAME proxied generado automáticamente.
6. Paso 5: Verificación del túnel público HTTPS y prueba desde el exterior.
7. Paso 6: Configuración del Webhook en Meta Developers (WhatsApp / Facebook / Instagram):
   - Callback URL: `https://omnichannel.tudominio.com/api/webhooks/whatsapp` (o facebook/instagram)
   - Verify Token: uso del token por defecto (`farfalina_carissma_webhook_verify_token_2026`) o variable `META_VERIFY_TOKEN`.
   - Campos de suscripción recomendados (`messages`, etc.).
8. Solución de Problemas (Troubleshooting): Errores 502 Bad Gateway (Next.js apagado), 1033 (túnel desconectado), tiempos de propagación DNS, bucles SSL.

Verify the file formatting and content.
Write your completion report to `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_m1\handoff.md` and send a message to parent when done.
