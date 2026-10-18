---
name: vps-manager
description: Reglas y procedimientos para administrar servicios PM2, Nginx, SQLite y despliegues en el VPS de SOURDEV (IP 207.211.167.189). Usar al monitorear, desplegar o depurar el entorno de pruebas (demo) y producción de Florería Farfalina & Carissma.
---

# VPS Manager Skill

Habilidad oficial para la administración, monitoreo y despliegue continuo de los sistemas **Florería Farfalina & Carissma** y servicios auxiliares en el VPS de SOURDEV.

---

## Información Clave del VPS

- **IP del Servidor:** `207.211.167.189`
- **Usuario SSH:** `ubuntu` (conexión autorizada por clave privada)
- **Clave SSH Privada:** `C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key`
- **Comando base de conexión (PowerShell sin bloqueos):**
  ```powershell
  ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "comando"
  ```
- **Gestor de Procesos:** PM2 (`pm2 status`, `pm2 logs`, `pm2 restart`)
- **Servidor Web / Proxy Reverso:** Nginx (`systemctl reload nginx`, `nginx -t`)
- **Arquitectura del VPS:** **ARM64 (`aarch64`)** — Chromium nativo en `/snap/bin/chromium` (NO usar binarios x86_64 de Chrome)
- **Prisma ORM:** v7 — requiere `--url 'file:./prisma/dev.db'` en comandos `prisma db push`

> [!IMPORTANT]
> **REGLAS DE ORO DE CONEXIÓN Y TRANSFERENCIA:**
> 1. **`-n` y `BatchMode=yes` en SSH:** En Windows PowerShell, si no se incluye `-n`, SSH queda a la espera de stdin y se congela varios minutos.
> 2. **SCP requiere flag `-O`:** El shell del VPS emite banners en sesiones no interactivas, rompiendo el protocolo SFTP moderno (`Received message too long`).
> 3. **SCP debe subir a `/tmp/`:** El usuario `ubuntu` no puede escribir directamente en directorios raíz de `/var/www/`.
> 4. **Comandos compuestos en el servidor:** Para evitar bloqueos por rate-limiting de SSH (`banner exchange timeout`), ejecutar todas las tareas del servidor en un único comando remoto encadenado.
