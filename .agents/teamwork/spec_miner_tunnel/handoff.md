# Reporte de Especificación Técnica: Integración DNS Cloudflare, Cloudflare Tunnel (Windows) y Lanzador Local

**Fecha:** 2026-10-06  
**Autor:** Specification Miner (`teamwork_preview_spec_miner`)  
**Directorio de Trabajo:** `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\spec_miner_tunnel\`  
**Fuentes de Autoridad:** Cloudflare Official Documentation, Microsoft Windows Command & Service Specifications, Meta Graph API v22.0 Webhooks Protocol, Base de Código del Proyecto (`floreria`).

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Cloudflare DNS (R1) | Onboarding de Dominio Raíz | Añadir zona DNS de un dominio propio adquirido en registradores a la cuenta gratuita de Cloudflare. | Dominio apex (ej. `midominio.com`), Plan Free ($0). | Nameservers asignados por Cloudflare (ej. `aria.ns.cloudflare.com`, `noah.ns.cloudflare.com`). | Rechaza subdominios como zonas en plan Free; requiere dominio raíz. | Cloudflare Docs (Zone Management) |
| 2 | Cloudflare DNS (R1) | Delegación NS en Registradores | Cambio de servidores de nombres autoritativos en GoDaddy, Namecheap, Hostinger, DonWeb. | Nameservers de Cloudflare en panel de registrador. | Delegación de zona activa (estado Active en Cloudflare). | Retardo de propagación DNS (TTL 2-24h, típicamente 5-15 min); bloqueo si hay DNSSEC mal configurado. | Registrar Authoritative Specs & RFC 1035 |
| 3 | Cloudflare DNS (R1) | Certificados SSL Edge (Universal SSL) | Generación automática de certificados TLS 1.3 administrados por Cloudflare para el dominio y subdominios. | Modo SSL (Full / Flexible), subdominio configurado. | Conexiones HTTPS válidas con certificado CA de Cloudflare sin necesidad de Certbot local. | Error 525 (SSL Handshake Failed) o 526 si el origen SSL es inválido cuando está en Full (Strict). | Cloudflare SSL/TLS Documentation |
| 4 | Cloudflare Tunnel (R1/R2) | Remote Tunnel Public Hostname | Creación de reglas de enrutamiento en Zero Trust que mapean un subdominio público hacia un servicio local. | Subdominio (`omnichannel`), Dominio (`midominio.com`), Servicio (`HTTP://localhost:3000`). | Generación automática de registro CNAME `omnichannel.midominio.com -> <UUID>.cfargotunnel.com`. | Conflicto si existe un registro A/AAAA previo para el mismo subdominio. | Cloudflare Zero Trust Dashboard Spec |
| 5 | Cloudflare Tunnel (R2) | Descarga Binaria Oficial de `cloudflared` | Obtención directa de `cloudflared-windows-amd64.exe` para Windows x64. | URL oficial de GitHub Releases o MSI installer. | Ejecutable standalone de `cloudflared.exe` listo en disco. | Error de red o descarga corrupta si falla TLS 1.2 en PowerShell antiguo. | GitHub Releases Cloudflare (`200 OK` verificado) |
| 6 | Cloudflare Tunnel (R2) | Ejecución Ad-Hoc (`tunnel run`) | Ejecución en primer plano sin privilegios de administrador para pruebas locales inmediatas. | `cloudflared.exe tunnel run --token <TOKEN>`. | Registro de 4 conexiones QUIC/HTTP2 hacia edge de Cloudflare; logs en consola. | Token inválido provoca error de autenticación y cierre con código 1. | Cloudflare CLI Docs & Runtime Probing |
| 7 | Cloudflare Tunnel (R2) | Instalación como Servicio Windows (`service install`) | Registro del túnel como servicio nativo del sistema operativo Windows con inicio automático (`Automatic`). | `cloudflared.exe service install <TOKEN>` (Elevado / Admin). | Servicio `cloudflared` creado bajo cuenta `NT AUTHORITY\SYSTEM`. | Error 5 (Acceso denegado) si no se ejecuta como Administrador. | Cloudflare Windows Service Spec |
| 8 | Cloudflare Tunnel (R2) | Control del Servicio Windows | Inicio, parada, consulta y desinstalación del servicio `cloudflared`. | `net start cloudflared`, `net stop cloudflared`, `sc query cloudflared`, `cloudflared service uninstall`. | Estado del servicio (RUNNING / STOPPED) o eliminación del registro de servicio. | Error si el servicio ya existe al intentar reinstalar sin previa desinstalación. | Windows Service Control Manager (`sc.exe` / `net.exe`) |
| 9 | Windows Launcher (R3) | Arranque Asíncrono del Servidor Next.js | Lanzamiento del servidor web en ventana minimizada o segundo plano para no bloquear el script de arranque. | `start "Farfalina - Servidor" /min cmd /c "npm run start"`. | Proceso Node.js iniciado escuchando en puerto 3000. | Error si `.next` no existe al correr `npm run start` (requiere build o fallback a `npm run dev`). | Windows CMD Execution Model |
| 10 | Windows Launcher (R3) | Sondeo de Disponibilidad HTTP/TCP | Polling activo para detectar cuándo el servidor web está listo para aceptar conexiones antes de abrir el navegador. | `curl.exe -s -I http://localhost:3000` o .NET `TcpClient`. | Detección de servidor activo (código 0) tras ~2-5 segundos. | Timeout tras 60 intentos si el servidor no inicia (puerto ocupado o error de compilación). | Probing local en Windows 11 |
| 11 | Windows Launcher (R3) | Apertura en Modo Aplicación (`--app`) | Lanzamiento de Google Chrome o Microsoft Edge en ventana sin barras de navegación ni pestañas (modo quiosco/app). | `chrome.exe --app=http://localhost:3000` o `msedge.exe --app=http://localhost:3000`. | Ventana limpia e independiente simulando aplicación de escritorio nativa. | Si no existen en rutas estándar, fallback transparente a `start http://localhost:3000`. | Chromium CommandLine Flags Spec |
| 12 | Meta Webhooks (R4) | Handshake GET de Verificación | Aceptación y respuesta del reto de verificación enviado por los servidores de Meta Developers. | Query params: `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`. | HTTP 200 con cuerpo idéntico a `hub.challenge` en formato `text/plain`. | HTTP 403 Forbidden si el token no coincide; HTTP 400 Bad Request si faltan parámetros. | Meta Webhooks Documentation & Route Probing |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Polling HTTP en `start-system.bat` | `GET http://localhost:3000/` con Next.js activo | En `app/page.tsx`, la raíz ejecuta `redirect("/floreria/catalog")`, devolviendo **HTTP 307 Temporary Redirect**. Un script de sondeo que espere estrictamente un código `200` fallaría o se quedaría en bucle infinito si no sigue redirecciones o no acepta códigos `200..399`. El comando `curl.exe -s -I http://localhost:3000` devuelve código de salida `0` ante un 307, resolviendo este problema limpiamente. |
| 2 | Uso de `curl` en PowerShell vs CMD | Ejecutar comando `curl -s -I ...` en PowerShell | En PowerShell de Windows, `curl` es un alias predeterminado de `Invoke-WebRequest`. Invocar `curl -s` arroja un error fatal de parámetros (`ParameterBindingException: Falta un argumento para 'SessionVariable'`). Todo script debe invocar explícitamente `curl.exe` o usar objetos nativos de .NET (`[System.Net.Sockets.TcpClient]`). |
| 3 | Ejecución de `cloudflared service install` sin permisos | Correr comando desde CMD normal sin elevación UAC | Retorna error fatal de Windows `Access is denied (Error 5)`. El script de instalación debe verificar privilegios (`net session >nul 2>&1`) y auto-elevarse vía PowerShell `Start-Process -Verb RunAs`. |
| 4 | Ruta de `cloudflared.exe` al registrar el servicio | Instalar servicio desde carpeta temporal o Desktop que luego se mueva | El servicio de Windows almacena en el registro (`HKLM\System\CurrentControlSet\Services\cloudflared\ImagePath`) la ruta exacta donde se ejecutó el comando. Si el archivo se elimina o mueve, el servicio falla al encender la PC con `Error 2: El sistema no puede encontrar el archivo especificado`. Solución: Guardar `cloudflared.exe` en una ruta permanente y fija (ej. `C:\cloudflared\cloudflared.exe` o `<directorio_del_proyecto>\bin\cloudflared.exe`). |
| 5 | Reinstalación de servicio existente | Ejecutar `cloudflared service install` cuando ya existe un servicio previo | `cloudflared` arroja error `service already exists`. El script de automatización debe ejecutar preventivamente `cloudflared.exe service uninstall` o detener el servicio antes de reconfigurar un nuevo token. |
| 6 | Puertos bloqueados por Firewall o ISP para QUIC | Tráfico saliente UDP 7844 restringido en la red local | `cloudflared` intenta conectarse por defecto mediante protocolo QUIC (UDP 7844). En redes corporativas o proveedores con bloqueo UDP, la conexión puede congelarse. Se soluciona forzando el protocolo HTTP/2 en el comando: `cloudflared.exe tunnel run --protocol http2 --token <TOKEN>`. |
| 7 | Falta de build previo en `start-system.bat` | Ejecutar `npm run start` cuando la carpeta `.next` no existe o fue borrada | Next.js falla con: `Could not find a production build in the '.next' directory`. El script `start-system.bat` debe comprobar si existe `.next\BUILD_ID` o `.next`. Si no existe, debe advertir y ejecutar `npm run build` o arrancar en modo desarrollo `npm run dev`. |
| 8 | Handshake Meta con Token Inválido o Faltante | Petición GET con `hub.verify_token=token_falso` | El endpoint responde HTTP 403 con `{ "success": false, "error": "Forbidden: Token mismatch", "code": "FORBIDDEN" }`. Si falta `hub.mode`, responde HTTP 400. Esto cumple exactamente la especificación de seguridad de Meta. |

---

# Especificación Detallada 1: Integración DNS en Cloudflare (R1)

### 1.1 Procedimiento Paso a Paso para Alta de Dominio Propio (100% Gratuito)

Cloudflare ofrece gestión autoritativa de DNS y protección perimetral gratuita sin límite de tiempo. Para integrar un dominio registrado en cualquier proveedor:

#### Paso 1: Creación de Cuenta y Añadir Dominio
1. Ingresar a [dash.cloudflare.com](https://dash.cloudflare.com/) e iniciar sesión (o registrar una cuenta gratuita).
2. En la barra superior o panel principal, hacer clic en el botón azul **Add a site** (Agregar un sitio).
3. Escribir el dominio apex (ejemplo: `midominio.com` o `farfalina.bo`). **Importante:** No escribir `www.` ni subdominios; Cloudflare gestiona la zona completa a nivel de dominio raíz.
4. Seleccionar el plan **Free** ($0 / mes) en la parte inferior y hacer clic en **Continue**.

#### Paso 2: Escaneo y Revisión de Registros DNS Existentes
1. Cloudflare escaneará automáticamente los registros DNS activos en el registrador actual (registros `A`, `CNAME`, `MX`, `TXT`).
2. **Revisión crítica:** Verificar que los registros de correo electrónico (`MX` para Google Workspace, Outlook, Titan, etc.) y de verificación de dominio (`TXT`) figuren en la lista. Si falta alguno, agregarlo manualmente.
3. Hacer clic en **Continue**.

#### Paso 3: Asignación de Nameservers de Cloudflare
Cloudflare mostrará una pantalla con:
- **Nameservers actuales a eliminar** (ej. `ns1.godaddy.com`, `ns2.godaddy.com`).
- **Nameservers de Cloudflare a colocar** (ejemplo habitual: `aria.ns.cloudflare.com` y `noah.ns.cloudflare.com` — el par exacto varía según la cuenta).

---

### 1.2 Configuración en los Principales Registradores de Dominio

#### A. GoDaddy
1. Iniciar sesión en el portal de GoDaddy e ingresar a **Mis Productos** > **Dominio** > **Administrar DNS** (o *Domain Portfolio*).
2. Desplazarse hasta la pestaña o sección **Servidores de nombres** (Nameservers).
3. Hacer clic en **Cambiar servidores de nombres** (Change Nameservers).
4. Seleccionar la opción inferior: **Usar mis propios servidores de nombres** (I'll use my own nameservers - Avanzado).
5. Borrar los servidores de GoDaddy e introducir los dos Nameservers proporcionados por Cloudflare.
6. Hacer clic en **Guardar**. Si solicita confirmación de seguridad (código por SMS/correo), confirmarlo.

#### B. Namecheap
1. Iniciar sesión en Namecheap y entrar a **Domain List**.
2. Hacer clic en el botón **Manage** a la derecha del dominio en cuestión.
3. En la pestaña **Domain**, buscar la sección **NAMESERVERS**.
4. Desplegar el menú (que por defecto dice *Namecheap BasicDNS*) y seleccionar **Custom DNS**.
5. Escribir en Nameserver 1 y Nameserver 2 los servidores de Cloudflare.
6. Hacer clic en el icono verde de verificación (✓) para guardar los cambios.

#### C. Hostinger
1. Iniciar sesión en Hostinger (hPanel) e ir a **Dominios**.
2. Seleccionar el dominio y en el menú izquierdo hacer clic en **DNS / Servidores de nombres**.
3. Hacer clic en **Cambiar servidores de nombres** (Change nameservers).
4. Seleccionar la opción **Cambiar los servidores de nombres manualmente**.
5. Reemplazar `ns1.dns-parking.com` y `ns2.dns-parking.com` con los nameservers de Cloudflare.
6. Hacer clic en **Guardar**.

#### D. Otros Registradores (DonWeb, Ferozo, nic.ar, nic.bo, etc.)
1. Ingresar al panel de control del proveedor y buscar "Delegación DNS", "Servidores DNS" o "Nameservers".
2. Reemplazar la delegación predeterminada por los 2 servidores de Cloudflare.

---

### 1.3 Verificación y Configuración de Certificados SSL/TLS en Cloudflare
1. Regresar al panel de Cloudflare y presionar **Check nameservers now** (Verificar servidores de nombres).
2. El estado pasará de *Pending Nameserver Update* a **Active** (puede demorar de 2 minutos a 15 minutos en propagarse).
3. En el menú lateral izquierdo de Cloudflare, ingresar a **SSL/TLS** > **Overview**:
   - Modo de encriptación recomendado: **Full** (o **Flexible** si el origen local maneja HTTP plano a través del túnel). Con Cloudflare Tunnel, la conexión se cifra de extremo a extremo mediante el túnel seguro de Zero Trust.
4. En **SSL/TLS** > **Edge Certificates**:
   - Activar **Always Use HTTPS** (Redirige automáticamente todo el tráfico `http://` a `https://`).
   - El certificado Universal SSL gratuito de Cloudflare cubrirá `tudominio.com` y `*.tudominio.com`.

---

### 1.4 Configuración del Túnel y Creación del Subdominio Dedicado

Para conectar el subdominio dedicado (ej. `omnichannel.tudominio.com` o `api.tudominio.com`) al sistema local sin abrir puertos en el router:

1. En el panel principal de Cloudflare, hacer clic en el menú lateral en **Zero Trust** (o ingresar directamente a [one.dash.cloudflare.com](https://one.dash.cloudflare.com/)).
2. *Si es la primera vez:* Crear un nombre de organización (Team name) y seleccionar el plan **Free** ($0, hasta 50 usuarios).
3. En el menú lateral de Zero Trust, ir a **Networks** > **Tunnels** (o *Access* > *Tunnels*).
4. Hacer clic en **Create a tunnel** (o *Add a tunnel*).
5. Seleccionar tipo de conector: **Cloudflare** y hacer clic en **Next**.
6. Asignar un nombre al túnel (ej. `floreria-pos-tunnel`) y presionar **Save tunnel**.
7. En la pantalla de instalación:
   - Seleccionar el sistema operativo **Windows** (64-bit).
   - El panel mostrará un comando que contiene el **TOKEN** del túnel (una cadena larga base64 que empieza con `eyJh...`).
   - Copiar este Token (lo usaremos en los scripts de Windows).
8. Hacer clic en **Next** para ir a la pestaña **Public Hostname** (Nombre de host público):
   - **Subdomain:** `omnichannel` (o `api`).
   - **Domain:** Seleccionar el dominio configurado en el paso 1 (ej. `midominio.com`).
   - **Path:** Dejar en blanco.
   - **Type:** Seleccionar **HTTP**.
   - **URL:** Escribir `localhost:3000` (o `127.0.0.1:3000`).
   - En *Additional application settings* (opcional): No se requieren modificaciones especiales; el túnel soporta WebSocket, Server-Sent Events y transferencias en bloque.
9. Hacer clic en **Save hostname**.

> **Resultado Automático en DNS:** Cloudflare genera automáticamente un registro CNAME en la zona DNS:  
> `omnichannel.tudominio.com  CNAME  <UUID-DEL-TUNEL>.cfargotunnel.com` (con proxy activo / nube naranja).  
> A partir de este momento, cualquier solicitud HTTPS dirigida a `https://omnichannel.tudominio.com` viaja por la red global de Cloudflare y es canalizada directamente al puerto local 3000 del equipo del usuario.

---

# Especificación Detallada 2: Cloudflare Tunnel (`cloudflared`) en Windows (R2)

### 2.1 Descargas Oficiales y Verificación
- **Ejecutable Directo Standalone (Recomendado para scripts de automatización):**  
  `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe`  
  *(Verificado HTTP 200 directo sin trabas)*
- **Instalador MSI:**  
  `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi`  
  *(Verificado HTTP 200)*
- **Instalación vía Gestor de Paquetes de Windows (`winget`):**  
  `winget install --id Cloudflare.cloudflared -e --silent --accept-source-agreements --accept-package-agreements`

### 2.2 Modos de Ejecución en Windows

#### Modo 1: Servicio Nativo de Windows (Producción Desatendida)
Ideal para la computadora de la florería: inicia automáticamente al encender la laptop/PC, opera silenciosamente sin ventanas abiertas, sobrevive a reinicios y corre bajo la cuenta `Local System`.

```cmd
:: 1. Instalar el servicio con el Token del túnel (Requiere CMD como Administrador)
cloudflared.exe service install <TOKEN_DE_CLOUDFLARE>

:: 2. Iniciar el servicio inmediatamente
net start cloudflared

:: 3. Verificar que el servicio está activo (RUNNING)
sc query cloudflared

:: 4. Detener el servicio (cuando sea necesario)
net stop cloudflared

:: 5. Desinstalar el servicio por completo
cloudflared.exe service uninstall
```

#### Modo 2: Ejecución en Primer Plano / Ad-hoc (Desarrollo y Diagnóstico)
No requiere permisos de Administrador ni altera los servicios de Windows. Ideal para validar que el token funciona antes de instalar como servicio:

```cmd
cloudflared.exe tunnel run --token <TOKEN_DE_CLOUDFLARE>
```
*Salida esperada:*
```text
INF Starting tunnel tunnelID=...
INF Version 2024.x.x
INF Generated Connector ID: ...
INF Registered tunnel connection connIndex=0 connection=... location=...
INF Registered tunnel connection connIndex=1 connection=... location=...
INF Registered tunnel connection connIndex=2 connection=... location=...
INF Registered tunnel connection connIndex=3 connection=... location=...
```

---

### 2.3 Plantilla de Script: `setup-cloudflared.ps1`

Script completo de PowerShell para comprobar presencia de `cloudflared.exe`, descargarlo si falta, y configurar el servicio de Windows:

```powershell
<#
.SYNOPSIS
    Script de instalación y configuración de Cloudflare Tunnel para Windows.
.DESCRIPTION
    Verifica privilegios de Administrador, descarga la versión oficial más reciente
    de cloudflared.exe si no existe, e instala/inicia el servicio nativo de Windows.
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory=$false)]
    [string]$TunnelToken
)

# 1. Verificar elevación de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "[ERROR] Este script requiere ejecutarse como Administrador para registrar el servicio de Windows."
    Write-Host "Por favor abre PowerShell haciendo clic derecho -> 'Ejecutar como administrador'." -ForegroundColor Yellow
    exit 1
}

$ProjectDir = Split-Path -Parent $PSScriptRoot
$BinDir = Join-Path $ProjectDir "bin"
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

$CloudflaredPath = Join-Path $BinDir "cloudflared.exe"

# 2. Descargar cloudflared.exe si no existe
if (-not (Test-Path $CloudflaredPath)) {
    Write-Host "[1/3] Descargando binario oficial de cloudflared desde GitHub Releases..." -ForegroundColor Cyan
    $DownloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $CloudflaredPath -UseBasicParsing
        Write-Host "  [OK] Descarga completada exitosamente en: $CloudflaredPath" -ForegroundColor Green
    } catch {
        Write-Error "  [FAIL] Error al descargar cloudflared: $_"
        exit 1
    }
} else {
    Write-Host "[1/3] cloudflared.exe ya se encuentra disponible en: $CloudflaredPath" -ForegroundColor Green
}

# 3. Solicitar Token si no fue provisto
if (-not $TunnelToken) {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Yellow
    Write-Host " CONFIGURACIÓN DEL TOKEN DE CLOUDFLARE TUNNEL" -ForegroundColor Yellow
    Write-Host " Pega el Token copiado del panel de Zero Trust (Networks > Tunnels):" -ForegroundColor Yellow
    Write-Host "=================================================================" -ForegroundColor Yellow
    $TunnelToken = Read-Host "Token del Túnel"
    if (-not $TunnelToken) {
        Write-Error "[ERROR] No se ingresó ningún token. Operación cancelada."
        exit 1
    }
}

# 4. Desinstalar servicio existente si ya estuviera registrado
$ExistingService = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
if ($ExistingService) {
    Write-Host "[2/3] Servicio existente detectado. Deteniendo y desinstalando..." -ForegroundColor Yellow
    Stop-Service -Name "cloudflared" -Force -ErrorAction SilentlyContinue
    Start-Process -FilePath $CloudflaredPath -ArgumentList "service uninstall" -Wait -NoNewWindow
    Start-Sleep -Seconds 2
}

# 5. Instalar e iniciar el servicio
Write-Host "[3/3] Registrando e iniciando servicio de Windows..." -ForegroundColor Cyan
$InstallProc = Start-Process -FilePath $CloudflaredPath -ArgumentList "service install $TunnelToken" -Wait -PassThru -NoNewWindow
if ($InstallProc.ExitCode -ne 0) {
    Write-Error "[FAIL] Falló la instalación del servicio cloudflared (Código de salida: $($InstallProc.ExitCode))."
    exit 1
}

Start-Sleep -Seconds 1
Start-Service -Name "cloudflared" -ErrorAction SilentlyContinue

$ServiceStatus = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
if ($ServiceStatus -and $ServiceStatus.Status -eq "Running") {
    Write-Host ""
    Write-Host "=================================================================" -ForegroundColor Green
    Write-Host " ¡CLOUDFLARE TUNNEL INSTALADO Y EN EJECUCIÓN EXITOSAMENTE!" -ForegroundColor Green
    Write-Host " Estado del servicio: $($ServiceStatus.Status)" -ForegroundColor Green
    Write-Host " El túnel iniciará automáticamente cada vez que se encienda la PC." -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Green
} else {
    Write-Warning "[AVISO] El servicio se instaló pero se encuentra en estado: $($ServiceStatus.Status)."
    Write-Host "Iniciando servicio manualmente con 'net start cloudflared'..."
    Start-Process -FilePath "net" -ArgumentList "start cloudflared" -Wait -NoNewWindow
}
```

---

### 2.4 Plantilla de Script: `CONFIGURAR_TUNEL_CLOUDFLARE.bat`

Script para doble clic directo por el usuario final, con auto-elevación por UAC si no es Administrador:

```cmd
@echo off
setlocal EnableDelayedExpansion
title Configuracion de Cloudflare Tunnel - Floreria Farfalina y Carissma
color 0B

echo ================================================================
echo    CONFIGURACION AUTOMATICA DE CLOUDFLARE TUNNEL (WINDOWS)
echo ================================================================
echo.

:: 1. Comprobar si se ejecuta como Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [SOLICITANDO PERMISOS] Se requieren privilegios de Administrador.
    echo Concediendo permisos en ventana emergente...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
if not exist "bin" mkdir "bin"

:: 2. Verificar o descargar cloudflared.exe
if not exist "bin\cloudflared.exe" (
    echo [1/3] Descargando cliente oficial cloudflared.exe...
    curl.exe -L -o "bin\cloudflared.exe" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    if %errorlevel% neq 0 (
        echo [ERROR] No se pudo descargar con curl.exe. Intentando via PowerShell...
        powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'bin\cloudflared.exe'"
    )
)

if not exist "bin\cloudflared.exe" (
    color 0C
    echo [ERROR FATAL] No se pudo obtener bin\cloudflared.exe.
    pause
    exit /b 1
)

echo [OK] bin\cloudflared.exe verificado correctamente.
echo.

:: 3. Solicitar el Token de Cloudflare Zero Trust
echo ================================================================
echo Ingrese el TUNNEL TOKEN obtenido del panel de Cloudflare:
echo (Seleccione Networks ^> Tunnels ^> Tu Tunel ^> Windows 64-bit)
echo ================================================================
set /p TOKEN="Token: "

if "%TOKEN%"=="" (
    color 0C
    echo [ERROR] El token no puede estar vacio.
    pause
    exit /b 1
)

echo.
echo [2/3] Deteniendo y desinstalando versiones previas del servicio...
net stop cloudflared >nul 2>&1
"bin\cloudflared.exe" service uninstall >nul 2>&1

echo [3/3] Registrando e iniciando servicio de Cloudflare Tunnel...
"bin\cloudflared.exe" service install %TOKEN%
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Fallo el registro del servicio.
    pause
    exit /b 1
)

net start cloudflared

echo.
color 0A
echo ================================================================
echo  ¡TUNEL CONFIGURADO Y ACTIVO EN SEGUNDO PLANO!
echo  Tu sistema local ahora esta conectado de forma segura a internet.
echo ================================================================
echo.
pause
```

---

# Especificación Detallada 3: Lanzador Local para la Máquina del Cliente (`start-system.bat`) (R3)

### 3.1 Requisitos de Experiencia de Usuario y Diseño
1. **Un solo clic:** El cliente de la florería no debe interactuar con consolas de comandos complicadas ni recordar URLs.
2. **Arranque asíncrono no bloqueante:** El servidor Next.js se inicia minimizado en la barra de tareas.
3. **Sondeo inteligente de salud (Polling):**
   - No abrir el navegador antes de tiempo (evita el error `ERR_CONNECTION_REFUSED`).
   - Soportar la redirección HTTP 307 de la ruta raíz hacia `/floreria/catalog`.
   - Límite de tiempo (timeout de 60 segundos) con mensaje amigable si ocurre un fallo.
4. **Modo Aplicación Dedicado (`--app`):**
   - Abre Google Chrome o Microsoft Edge en ventana sin barra de direcciones, sin marcadores y sin pestañas, luciendo como una aplicación de escritorio nativa para el Punto de Venta.
   - Detección en cascada: Chrome 64/32 bits -> Edge 64/32 bits -> Navegador por defecto de Windows.

---

### 3.2 Plantilla de Producción: `start-system.bat`

```cmd
@echo off
setlocal EnableDelayedExpansion
title Floreria Farfalina y Carissma - Lanzador del Sistema
color 0A

echo ================================================================
echo    FLORERIA FARFALINA Y CARISSMA VESTIDOS - SISTEMA LOCAL
echo ================================================================
echo.

cd /d "%~dp0"

:: 1. Comprobacion de entorno Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR FATAL] Node.js no esta instalado en este equipo.
    echo Descarga e instala Node.js LTS desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Determinar comando de inicio (Produccion preferida, Dev como fallback)
set "START_CMD=npm run start"
if not exist ".next" (
    echo [AVISO] No se detecto compilacion previa en .next.
    echo Iniciando en modo desarrollo...
    set "START_CMD=npm run dev"
)

:: 3. Verificar si el servidor ya esta corriendo previamente en el puerto 3000
curl.exe -s -I http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] El servidor ya se encuentra activo en http://localhost:3000.
    goto LAUNCH_BROWSER
)

:: 4. Iniciar el servidor Next.js en segundo plano minimizado
echo [1/3] Iniciando servidor Next.js (%START_CMD%)...
start "Farfalina & Carissma - Servidor Local" /min cmd /c "%START_CMD%"

:: 5. Sondeo de disponibilidad (Polling hasta responder en puerto 3000)
echo [2/3] Esperando que el sistema este listo...
set /a ATTEMPTS=0

:POLL_LOOP
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 60 (
    color 0C
    echo.
    echo [ERROR] El servidor tardo mas de 60 segundos en responder.
    echo Por favor revisa la ventana minimizada del servidor para ver posibles errores.
    echo.
    pause
    exit /b 1
)

:: Sondeo con curl.exe (soportando codigos 200 y redirecciones 307 de la raiz)
curl.exe -s -I http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 goto LAUNCH_BROWSER

:: Fallback de sondeo mediante socket TCP .NET en caso de que curl.exe no este en PATH
powershell -NoProfile -Command "try { $s = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); $s.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% equ 0 goto LAUNCH_BROWSER

timeout /t 1 /nobreak >nul
goto POLL_LOOP

:LAUNCH_BROWSER
echo [3/3] Servidor listo. Abriendo interfaz en modo aplicacion...
echo.

set "TARGET_URL=http://localhost:3000"

:: Detectar Chrome (64 bits, 32 bits, LocalAppData)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%TARGET_URL%
    goto FINISH
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=%TARGET_URL%
    goto FINISH
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --app=%TARGET_URL%
    goto FINISH
)

:: Detectar Microsoft Edge (Nativo en Windows 10 y Windows 11)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=%TARGET_URL%
    goto FINISH
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=%TARGET_URL%
    goto FINISH
)

:: Fallback al navegador por defecto del sistema
start "" "%TARGET_URL%"

:FINISH
echo ================================================================
echo  SISTEMA FARFALINA Y CARISSMA INICIADO CORRECTAMENTE
echo  Ventana abierta en: %TARGET_URL%
echo ================================================================
echo.
timeout /t 3 /nobreak >nul
exit /b 0
```

---

# Especificación Detallada 4: Verificación de Webhooks de Meta (R4)

### 4.1 Especificación del Handshake GET de Meta
Cuando Meta for Developers valida un webhook en el panel de configuración (o cuando se pulsa el botón *Verificar y Guardar*), realiza una petición HTTP GET con tres parámetros en la cadena de consulta (query string):

1. `hub.mode`: Debe tener el valor exacto `"subscribe"`.
2. `hub.verify_token`: La clave secreta configurada en Meta para corroborar que el endpoint le pertenece al usuario.
3. `hub.challenge`: Una cadena aleatoria generada por Meta (ejemplo: `1158201444`).

**Requisitos estrictos de respuesta:**
- **Código HTTP:** `200 OK`.
- **Cabecera `Content-Type`:** `text/plain` (no `application/json`).
- **Cuerpo de la respuesta:** El valor exacto recibido en `hub.challenge`.

### 4.2 Lógica de Jerarquía de Tokens en el Código Actual
En el código inspeccionado (`app/api/webhooks/whatsapp/route.ts`, `app/api/webhooks/facebook/route.ts`, `app/api/webhooks/instagram/route.ts`), la validación del token sigue la siguiente jerarquía de precedencia:

1. **Variable de Entorno (`.env`):** `process.env.META_VERIFY_TOKEN`.
2. **Token por Defecto (Fallback Global):** `"farfalina_carissma_webhook_verify_token_2026"`.
3. **Base de Datos SQLite (`ChannelConfig`):** Coincidencia con el campo `verifyToken` registrado para la empresa y canal específico.

### 4.3 Matriz de Respuestas HTTP Observadas y Verificadas

| Escenario | Parámetros Enviados | Código HTTP | Cuerpo / Contenido | Comportamiento en Meta |
|---|---|---|---|---|
| Handshake Válido (Default) | `hub.mode=subscribe&hub.verify_token=farfalina_carissma_webhook_verify_token_2026&hub.challenge=12345` | `200 OK` | `12345` (text/plain) | **Aprobado** (Check verde en Meta Developers) |
| Handshake Válido (Env Var) | `hub.mode=subscribe&hub.verify_token=<META_VERIFY_TOKEN>&hub.challenge=abcde` | `200 OK` | `abcde` (text/plain) | **Aprobado** (Check verde en Meta Developers) |
| Token Erróneo | `hub.mode=subscribe&hub.verify_token=token_invalido&hub.challenge=12345` | `403 Forbidden` | `{"success":false,"error":"Forbidden: Token mismatch","code":"FORBIDDEN"}` | **Rechazado** (Meta muestra error de validación) |
| Modo Faltante / Inválido | `hub.verify_token=farfalina_carissma_webhook_verify_token_2026&hub.challenge=12345` | `400 Bad Request` | `{"success":false,"error":"Bad Request: Missing mode or token","code":"BAD_REQUEST"}` | **Rechazado** |

### 4.4 Script Automatizado de Prueba: `tests/verify-meta-webhooks.ts`

Script para ejecución directa con `npx tsx tests/verify-meta-webhooks.ts` que valida el handshake contra los tres canales simultáneamente:

```typescript
import { GET as waGET } from "../app/api/webhooks/whatsapp/route";
import { GET as fbGET } from "../app/api/webhooks/facebook/route";
import { GET as igGET } from "../app/api/webhooks/instagram/route";

async function runMetaWebhooksVerification() {
  console.log("=================================================================");
  console.log("    PRUEBA AUTOMATIZADA: HANDSHAKE DE WEBHOOKS DE META          ");
  console.log("=================================================================\n");

  const DEFAULT_TOKEN = "farfalina_carissma_webhook_verify_token_2026";
  const TEST_CHALLENGE = "meta_challenge_auth_9988776655";

  const channels = [
    { name: "WhatsApp Cloud API", handler: waGET, url: "http://localhost:3000/api/webhooks/whatsapp" },
    { name: "Facebook Messenger", handler: fbGET, url: "http://localhost:3000/api/webhooks/facebook" },
    { name: "Instagram Direct",  handler: igGET, url: "http://localhost:3000/api/webhooks/instagram" },
  ];

  let totalTests = 0;
  let passedTests = 0;

  for (const ch of channels) {
    console.log(`Verificando canal: ${ch.name}...`);

    // 1. Caso Exitoso con Token por defecto
    totalTests++;
    const validUrl = `${ch.url}?hub.mode=subscribe&hub.verify_token=${DEFAULT_TOKEN}&hub.challenge=${TEST_CHALLENGE}`;
    const resValid = await ch.handler(new Request(validUrl));
    const bodyValid = await resValid.text();

    if (resValid.status === 200 && bodyValid === TEST_CHALLENGE) {
      console.log(`  [PASS] Handshake valido con DEFAULT_TOKEN -> HTTP 200, Reto exacto devuelto.`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Handshake valido falló: Status ${resValid.status}, Body: ${bodyValid}`);
    }

    // 2. Caso Rechazado por Token Invalido
    totalTests++;
    const invalidUrl = `${ch.url}?hub.mode=subscribe&hub.verify_token=token_incorrecto&hub.challenge=${TEST_CHALLENGE}`;
    const resInvalid = await ch.handler(new Request(invalidUrl));

    if (resInvalid.status === 403) {
      console.log(`  [PASS] Rechazo de token incorrecto -> HTTP 403 Forbidden.`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Rechazo falló: Status ${resInvalid.status}`);
    }

    // 3. Caso Rechazado por Parámetros Incompletos
    totalTests++;
    const missingUrl = `${ch.url}?hub.challenge=${TEST_CHALLENGE}`;
    const resMissing = await ch.handler(new Request(missingUrl));

    if (resMissing.status === 400 || resMissing.status === 403) {
      console.log(`  [PASS] Rechazo de solicitud incompleta -> HTTP ${resMissing.status}.`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Solicitud incompleta no rechazada debidamente: Status ${resMissing.status}`);
    }

    console.log("");
  }

  console.log("=================================================================");
  console.log(`RESUMEN: ${passedTests} de ${totalTests} pruebas pasadas exitosamente.`);
  console.log("=================================================================");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runMetaWebhooksVerification().catch((err) => {
  console.error("Error inesperado en verificacion:", err);
  process.exit(1);
});
```

---

# Handoff Report (Protocolo de 5 Componentes)

## 1. Observation
- Se comprobó mediante solicitudes HEAD HTTP que los binarios oficiales de Cloudflare están disponibles y activos en:
  - `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe` (Status 200).
  - `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi` (Status 200).
- Se ejecutó `where curl.exe` en el sistema Windows actual, confirmando su presencia nativa en `C:\WINDOWS\system32\curl.exe`.
- Se verificó que en PowerShell `curl` es un alias de `Invoke-WebRequest` y que invocarlo con banderas de curl provoca `ParameterBindingException`, exigiendo el uso explícito de `curl.exe`.
- Se observó en `app/page.tsx` línea 4 que la ruta raíz contiene `redirect("/floreria/catalog")`.
- Se verificó la presencia de los ejecutables de navegador en la máquina local:
  - `C:\Program Files\Google\Chrome\Application\chrome.exe`: `True`.
  - `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`: `True`.
- Se ejecutó `npx tsc --noEmit` comprobando que la compilación de TypeScript está 100% limpia sin errores.
- Se probaron programáticamente los controladores GET de webhook en `app/api/webhooks/whatsapp/route.ts`, `app/api/webhooks/facebook/route.ts` y `app/api/webhooks/instagram/route.ts`, verificando que devuelven status 200 con el reto exacto ante `hub.verify_token=farfalina_carissma_webhook_verify_token_2026`, 403 ante token erróneo y 400 ante parámetros incompletos.

## 2. Logic Chain
1. Dado que Meta Graph API requiere que los webhooks estén expuestos sobre HTTPS con un certificado SSL válido emitido por una autoridad certificadora reconocida, y el usuario opera en una PC local sin IP pública estática ni apertura de puertos NAT, Cloudflare Tunnel (Zero Trust) constituye la arquitectura óptima sin costo de servidor VPS.
2. Dado que `cloudflared.exe service install <TOKEN>` registra la ruta absoluta del binario en el registro de servicios de Windows, el binario debe ubicarse en una carpeta fija del proyecto (`bin\cloudflared.exe`) para evitar fallos de inicio en el arranque de la computadora.
3. Dado que la raíz de la aplicación web redirige con código HTTP 307 hacia `/floreria/catalog`, un sondeo de disponibilidad que solo verifique el código 200 se congelaría. El uso de `curl.exe -s -I http://localhost:3000` devuelve código de salida 0 ante respuestas 307, garantizando un sondeo rápido y confiable.
4. Dado que tanto Google Chrome como Microsoft Edge soportan el argumento `--app=URL` y al menos uno de ellos está preinstalado en el 100% de los entornos Windows 10/11, el lanzador puede garantizar una experiencia de usuario limpia estilo aplicación nativa de escritorio sin distracciones.

## 3. Caveats
- Se asume que el usuario tiene acceso administrativo a su cuenta del registrador de dominio (GoDaddy, Namecheap, etc.) para modificar los servidores de nombres (Nameservers).
- La propagación DNS mundial tras cambiar los Nameservers depende del TTL del registrador y suele tardar entre 5 minutos y unas pocas horas.
- La instalación del servicio nativo de Windows (`cloudflared service install`) requiere conceder permisos de Administrador mediante el diálogo UAC de Windows una única vez.

## 4. Conclusion
Las especificaciones, comandos, scripts de automatización en PowerShell/Batch, la arquitectura del lanzador local con sondeo de salud y modo quiosco/app, y las pruebas programáticas de webhooks están completamente investigadas, validadas y listas para ser entregadas e integradas por los agentes de implementación.

## 5. Verification Method
1. **Verificación de URLs de descarga:**
   ```powershell
   (Invoke-WebRequest -Method Head -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe').StatusCode
   ```
   *Debe responder:* `200`.
2. **Verificación de Handshake de Webhooks:**
   ```powershell
   npx tsx -e "import { GET } from './app/api/webhooks/whatsapp/route'; GET(new Request('http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=farfalina_carissma_webhook_verify_token_2026&hub.challenge=TEST')).then(async r => console.log('Status:', r.status, 'Body:', await r.text()))"
   ```
   *Debe imprimir:* `Status: 200 Body: TEST`.
3. **Verificación de TypeScript:**
   ```powershell
   npx tsc --noEmit
   ```
   *Debe salir con código:* `0` (sin advertencias ni errores).
