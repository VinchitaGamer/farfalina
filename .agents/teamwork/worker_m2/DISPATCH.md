## 2026-10-06T02:59:54Z
You are a Windows Automation Worker (teamwork_preview_worker).
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_m2\
You MUST read ORIGINAL_REQUEST.md at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the technical specifications from spec_miner_tunnel at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\spec_miner_tunnel\handoff.md
And the project scope at: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\orchestrator_1\PROJECT.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & File Ownership:
You EXCLUSIVELY own:
1. `scripts/setup-cloudflare-tunnel.ps1`
2. `CONFIGURAR_TUNEL_CLOUDFLARE.bat`
Do NOT modify any other files.

Your Mission (Milestone M2 - R2):
Implement Windows automation scripts for Cloudflare Tunnel (`cloudflared`):
1. `scripts/setup-cloudflare-tunnel.ps1`:
   - Descarga o verificación de presencia de `cloudflared.exe`. Si no existe en el directorio de herramientas (ej. `bin/` o `%LOCALAPPDATA%\cloudflared\`), descargarlo automáticamente desde la URL oficial de GitHub:
     `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe`
     con barra de progreso o mensaje claro y validación de descarga íntegra.
   - Menú interactivo y soporte de parámetros para:
     a) Ejecutar túnel ad-hoc en primer plano: solicita token (o usa variable/parámetro) y ejecuta `cloudflared.exe tunnel run --token <TOKEN>` apuntando al tráfico hacia `http://localhost:3000`.
     b) Instalar como servicio nativo de Windows: ejecuta `cloudflared.exe service install <TOKEN>` (requiere privilegios de Administrador; debe elevar o verificar privilegios con advertencia amigable), e iniciar el servicio (`Start-Service cloudflared` o `net start cloudflared`).
     c) Consultar estado del servicio (`sc.exe query cloudflared` / `Get-Service cloudflared`).
     d) Detener y desinstalar el servicio (`cloudflared.exe service uninstall`).
2. `CONFIGURAR_TUNEL_CLOUDFLARE.bat`:
   - Lanzador Batch en la raíz del proyecto para que el usuario en Windows pueda hacer doble clic.
   - Llama a PowerShell con `-NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-cloudflare-tunnel.ps1"`.
   - Interfaz de consola elegante en español, pausando al final para que la ventana no se cierre abruptamente.

Test the syntax and execution of the scripts. Document test commands and results in your handoff report.
Write your completion report to `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_m2\handoff.md` and send a message to parent when done.
