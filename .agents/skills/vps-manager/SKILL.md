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

---

## Mapa de Entornos & Servicios Activos

| Entorno / Servicio | Ruta en el Servidor | Proceso PM2 | Puerto Interno |
|---|---|---|---|
| 🚀 **Farfalina & Carissma (PRODUCCIÓN)** | `/var/www/floreria-demo` | `floreria` (id 0) | `3000` |

> [!IMPORTANT]
> **Regla de Oro de Despliegue:** NUNCA desplegar directamente en el entorno de producción sin antes verificar que `npm run build` pasa localmente con 0 errores.

---

## Variables SSH Reutilizables

Para simplificar los comandos, definir al inicio de cualquier flujo:
```powershell
$SSH_KEY = "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key"
$SSH_OPTS = "-o StrictHostKeyChecking=no -o ConnectTimeout=10"
$VPS_USER = "ubuntu@207.211.167.189"
$VPS_DIR = "/var/www/floreria-demo"
```

---

## Flujo de Despliegue Estándar

### 1. Empaquetado Local
Desde la raíz del proyecto local (`c:\Users\Lenovo\Desktop\floreria`):
```powershell
tar --exclude="*.db*" --exclude="*.sqlite*" -czf carissma-demo-deploy.tar.gz app components lib store prisma scripts types package.json package-lock.json next.config.mjs tailwind.config.ts tsconfig.json postcss.config.mjs .agents
```

> [!CAUTION]
> **REGLA CRÍTICA: NUNCA EMPAQUETAR ARCHIVOS DE BASE DE DATOS (`.db`)**:
> Incluir `prisma/dev.db` en el archivo de despliegue sobreescribe la base de datos de producción con la base de datos local del desarrollador, borrando los datos reales de clientes, ventas y pedidos generados en producción. Siempre usar `--exclude="*.db*" --exclude="*.sqlite*"`.

> [!WARNING]
> **Incluir `types/`** en el tar. Este directorio contiene schemas Zod canónicos y `ActionResponse<T>` que son requeridos por el build. Omitirlo causa `Cannot find module '@/types/...'`.

### 2. Transferencia SCP al Servidor
```powershell
scp -O -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" carissma-demo-deploy.tar.gz ubuntu@207.211.167.189:/tmp/carissma-demo-deploy.tar.gz
```

### 3. Extracción, Migración de Base de Datos y Build en el VPS
```powershell
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "cd /var/www/floreria-demo && sudo mv /tmp/carissma-demo-deploy.tar.gz . && tar -xzf carissma-demo-deploy.tar.gz && npx prisma generate && npx prisma db push --url 'file:./prisma/dev.db' && npm run build && pm2 restart floreria"
```

### 4. Verificación de Salud Post-Despliegue
```powershell
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "curl -sI http://127.0.0.1:3000 && pm2 status floreria"
```

**Respuesta esperada:** `HTTP/1.1 307 Temporary Redirect` (raíz redirige a `/floreria/catalog`) y PM2 `online`.

---

## Manera Correcta de Conectar al VPS (Protocolo Anti-Bloqueos)

Esta sección documenta las lecciones aprendidas ante fallos recurrentes de conexión, cuelgues de terminal y transferencias abortadas desde entornos Windows/PowerShell hacia el servidor Ubuntu ARM64 de producción.

### 1. El Problema de Stdin Hanging en Windows PowerShell (`-n` y `BatchMode=yes`)
* **Síntoma:** Al ejecutar un comando SSH remoto desde PowerShell, la terminal se queda congelada indefinidamente (o tarda de 3 a 5 minutos) a pesar de que el comando en el servidor ya terminó.
* **Causa Raíz:** OpenSSH en Windows mantiene abierto el descriptor de `stdin` esperando posible entrada interactiva del usuario si no se le indica explícitamente lo contrario.
* **Solución Obligatoria:** Agregar siempre la bandera `-n` (redirige `stdin` desde `/dev/null`) y `-o BatchMode=yes` (desactiva preguntas interactivas):
  ```powershell
  ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "comando"
  ```

### 2. El Protocolo SCP Legacy (`-O`)
* **Síntoma:** Al intentar subir archivos con `scp`, el comando falla con el error `Received message too long` o se cancela inmediatamente.
* **Causa Raíz:** Las versiones modernas de `scp` utilizan por defecto el protocolo SFTP. El shell del usuario `ubuntu` en el VPS emite texto (banners/MOTD) en conexiones no interactivas, lo que corrompe el encabezado binario del protocolo SFTP.
* **Solución Obligatoria:** Usar siempre la bandera `-O` para forzar el protocolo SCP legacy:
  ```powershell
  scp -O -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" archivo.tar.gz ubuntu@207.211.167.189:/tmp/
  ```

### 3. Destino Temporal de Subida y Permisos (`/tmp/` -> `/var/www/`)
* **Síntoma:** `Permission denied (13)` al subir directamente a `/var/www/floreria-demo/`.
* **Causa Raíz:** Por motivos de seguridad, el usuario `ubuntu` no tiene permisos directos de escritura en directorios raíz web mediante SCP sin elevación `sudo`.
* **Solución Obligatoria:** Subir siempre primero a `/tmp/` y luego moverlo dentro de la sesión SSH con `sudo mv`:
  ```powershell
  # Paso 1: Subir a /tmp
  scp -O -i ... carissma-demo-deploy.tar.gz ubuntu@207.211.167.189:/tmp/carissma-demo-deploy.tar.gz

  # Paso 2: Mover y descomprimir en el servidor
  ssh -n -o BatchMode=yes ... ubuntu@207.211.167.189 "cd /var/www/floreria-demo && sudo mv /tmp/carissma-demo-deploy.tar.gz . && tar -xzf carissma-demo-deploy.tar.gz"
  ```

### 4. Separadores de Comandos en Windows PowerShell (Sin `&&`)
* **Síntoma:** Error de sintaxis en PowerShell local: `El token '&&' no es un separador de instrucciones válido en esta versión`.
* **Causa Raíz:** En versiones clásicas de Windows PowerShell (v5.1), el operador `&&` no existe en la gramática del shell.
* **Solución Obligatoria:** En PowerShell local, separar comandos con `;` o ejecutarlos en llamadas independientes. Dentro del string de SSH (lo que corre en bash en el VPS), `&&` sí es completamente válido.

### 5. Prevención de Rate-Limiting y `Banner Exchange Timeout`
* **Síntoma:** Tras ejecutar varios comandos SSH en pocos segundos, las siguientes conexiones fallan con:
  ```
  kex_exchange_identification: read: Unknown error
  Connection timed out during banner exchange
  ```
* **Causa Raíz:** El demonio `sshd` del VPS y las reglas de seguridad de Oracle Cloud limitan la tasa de aperturas de socket por minuto (`MaxStartups`). Ráfagas consecutivas de SSH disparan este bloqueo temporal.
* **Solución Obligatoria:** Agrupar todas las operaciones del servidor en **un único comando remoto encadenado**, en lugar de hacer 4 o 5 llamadas SSH separadas:
  ```powershell
  ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "cd /var/www/floreria-demo && sudo mv /tmp/carissma-demo-deploy.tar.gz . && tar -xzf carissma-demo-deploy.tar.gz && npx prisma generate && npx prisma db push --url 'file:./prisma/dev.db' && npm run build && pm2 restart floreria"
  ```

### 6. Arquitectura ARM64 (Oracle Cloud Ampere A1) y Navegadores Headless
* **Síntoma:** Al iniciar Puppeteer o herramientas que descargan navegadores, el proceso colapsa con `Syntax error: ")" unexpected` (Code: 2) o `unknown flag allow-pre-commit-input` (Code: 64).
* **Causa Raíz:** El VPS tiene CPU ARM64 (`aarch64`). Los binarios predeterminados de Chrome x86_64 que descarga Puppeteer son incompatibles a nivel de instrucciones de CPU.
* **Solución Obligatoria:**
  1. Instalar Chromium nativo ARM64 vía snap: `sudo snap install chromium`.
  2. En el código (`whatsapp-socket-manager.ts`), apuntar Puppeteer a `/snap/bin/chromium`.
  3. Limpiar cualquier caché x86_64 residual con `rm -rf /home/ubuntu/.cache/puppeteer`.

---

## Comandos Útiles de Mantenimiento y Diagnóstico

### Gestión de PM2
```powershell
# Ver estado de todas las apps
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "pm2 status"

# Ver logs en vivo
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "pm2 logs floreria --lines 100 --nostream"

# Reiniciar
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "pm2 restart floreria"
```

### Gestión de Nginx
```powershell
# Probar sintaxis de Nginx
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "sudo nginx -t"

# Recargar configuración tras cambios
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "sudo systemctl reload nginx"

# Ver logs de error de Nginx
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "sudo tail -n 50 /var/log/nginx/error.log"
```

### Gestión de Almacenamiento & Memoria
```powershell
# Ver uso de disco en el VPS
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "df -h"

# Ver uso de memoria RAM
ssh -n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15 -i "$env:USERPROFILE\Desktop\ssh-key-2026-09-07 (2).key" ubuntu@207.211.167.189 "free -m"
```

---

## Gotchas Conocidos

1. **No usar `root@`** — el VPS rechaza login como root y muestra `Please login as the user "ubuntu"`.
2. **SCP sin `-O` falla** con `Received message too long` — siempre usar `-O` flag.
3. **SSH sin `-n` se congela** — en PowerShell de Windows, siempre usar `-n -o BatchMode=yes`.
4. **Prisma v7 sin `url` en datasource** — siempre pasar `--url 'file:./prisma/dev.db'` a `prisma db push`.
5. **No incluir `hooks/`** en el tar si el directorio no existe localmente — causa error de empaquetado.
6. **El `.env` del VPS** contiene `DATABASE_URL="file:./prisma/dev.db"` y no debe sobrescribirse.
7. **Arquitectura ARM64:** No descargar Chrome x86; usar siempre Chromium snap nativo (`/snap/bin/chromium`).
