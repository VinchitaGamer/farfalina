<#
.SYNOPSIS
    Automatización de Cloudflare Tunnel (cloudflared) para Windows.
.DESCRIPTION
    Script para descargar/verificar cloudflared.exe, ejecutar túneles ad-hoc apuntando
    a http://localhost:3000, instalar/iniciar cloudflared como servicio nativo de Windows
    (arranque automático), consultar estado y desinstalar el servicio.
.PARAMETER Action
    Acción a ejecutar: 'menu', 'run', 'install', 'status', 'uninstall', 'download'.
.PARAMETER Token
    Token de autenticación de Cloudflare Tunnel generado en Zero Trust Dashboard.
.PARAMETER Protocol
    Protocolo de transporte para el túnel ('auto', 'http2', 'quic'). Por defecto: 'auto'.
.PARAMETER LocalUrl
    URL local del servicio a exponer (por defecto http://localhost:3000).
.PARAMETER ForceDownload
    Fuerza la descarga del ejecutable cloudflared.exe incluso si ya existe.
.PARAMETER NonInteractive
    Ejecuta la acción en modo desatendido/no interactivo sin esperar pulsaciones de teclas.
.EXAMPLE
    .\setup-cloudflare-tunnel.ps1
    Muestra el menú interactivo principal.
.EXAMPLE
    .\setup-cloudflare-tunnel.ps1 -Action run -Token "eyJh..."
    Ejecuta el túnel en primer plano inmediatamente con el token proporcionado.
.EXAMPLE
    .\setup-cloudflare-tunnel.ps1 -Action install -Token "eyJh..."
    Instala e inicia el túnel como servicio nativo de Windows (requiere Administrador).
.EXAMPLE
    .\setup-cloudflare-tunnel.ps1 -Action status
    Consulta el estado del servicio de Windows cloudflared.
#>

[CmdletBinding()]
param (
    [ValidateSet('menu', 'run', 'install', 'status', 'uninstall', 'download')]
    [string]$Action = 'menu',

    [Parameter(Mandatory = $false)]
    [string]$Token,

    [Parameter(Mandatory = $false)]
    [ValidateSet('auto', 'http2', 'quic')]
    [string]$Protocol = 'auto',

    [Parameter(Mandatory = $false)]
    [string]$LocalUrl = 'http://localhost:3000',

    [switch]$ForceDownload,

    [switch]$NonInteractive
)

# Establecer codificación UTF-8 para salida en consola
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Determinar directorios del proyecto
$ScriptPath = if ($PSCommandPath) { $PSCommandPath } elseif ($MyInvocation.PSCommandPath) { $MyInvocation.PSCommandPath } elseif ($PSScriptRoot) { Join-Path $PSScriptRoot "setup-cloudflare-tunnel.ps1" } else { Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "setup-cloudflare-tunnel.ps1" }
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } elseif ($ScriptPath) { Split-Path -Parent $ScriptPath } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$ProjectRoot = Split-Path -Parent $ScriptDir
$BinDir = Join-Path $ProjectRoot "bin"
$DefaultBinaryPath = Join-Path $BinDir "cloudflared.exe"
$DownloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

# -----------------------------------------------------------------------------
# Funciones Utilitarias
# -----------------------------------------------------------------------------

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor White
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-SuccessBox {
    param([string]$Message)
    Write-Host ""
    Write-Host " [ÉXITO] $Message" -ForegroundColor Green
    Write-Host ""
}

function Write-WarningBox {
    param([string]$Message)
    Write-Host ""
    Write-Host " [AVISO] $Message" -ForegroundColor Yellow
    Write-Host ""
}

function Write-ErrorBox {
    param([string]$Message)
    Write-Host ""
    Write-Host " [ERROR] $Message" -ForegroundColor Red
    Write-Host ""
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]$identity
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Elevation {
    param([string]$SubAction, [string]$TunnelToken)
    if (Test-IsAdministrator) {
        return $true
    }

    Write-WarningBox "Esta operación requiere privilegios de Administrador para modificar servicios de Windows."

    if ($NonInteractive) {
        Write-ErrorBox "No se puede continuar en modo desatendido sin permisos de Administrador."
        exit 1
    }

    Write-Host " ¿Deseas abrir una nueva ventana con permisos de Administrador? (S/N): " -NoNewline -ForegroundColor Yellow
    $resp = Read-Host
    if ($resp -match "^[sSyY]") {
        $scriptPath = if ($PSCommandPath) { $PSCommandPath } elseif ($MyInvocation.PSCommandPath) { $MyInvocation.PSCommandPath } elseif ($ScriptPath) { $ScriptPath } else { Join-Path $PSScriptRoot "setup-cloudflare-tunnel.ps1" }
        $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Action $SubAction"
        if ($TunnelToken) {
            $argList += " -Token `"$TunnelToken`""
        }
        try {
            Start-Process powershell.exe -ArgumentList $argList -Verb RunAs
            Write-Host " Solicitud enviada a UAC. Verifica la nueva ventana con permisos elevados." -ForegroundColor Green
            return $false
        } catch {
            Write-ErrorBox "No se pudo solicitar la elevación: $_"
            return $false
        }
    } else {
        Write-Host " Operación cancelada por el usuario. Ejecute PowerShell como Administrador manualmente." -ForegroundColor Yellow
        return $false
    }
}

function Find-CloudflaredBinary {
    # 1. Verificar binario local en bin/
    if (Test-Path $DefaultBinaryPath) {
        return $DefaultBinaryPath
    }

    # 2. Verificar en %LOCALAPPDATA%\cloudflared\
    $localAppDataBin = Join-Path $env:LOCALAPPDATA "cloudflared\cloudflared.exe"
    if (Test-Path $localAppDataBin) {
        return $localAppDataBin
    }

    # 3. Verificar en PATH global
    $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) {
        return $cmd.Source
    }

    return $null
}

function Ensure-Cloudflared {
    param([switch]$Force)

    $existing = Find-CloudflaredBinary
    if ($existing -and (-not $Force)) {
        # Validar integridad ejecutando --version
        try {
            $verOutput = & $existing --version 2>&1
            if ($LASTEXITCODE -eq 0 -and $verOutput -match "cloudflared version") {
                Write-Host " [OK] cloudflared detectado en: $existing" -ForegroundColor Green
                Write-Host "      Versión: $verOutput" -ForegroundColor Gray
                return $existing
            }
        } catch {
            Write-WarningBox "El binario existente en $existing parece inválido o no ejecutable. Se descargará uno nuevo."
        }
    }

    Write-Header "DESCARGA DEL CLIENTE OFICIAL CLOUDFLARED"
    Write-Host " Destino: $DefaultBinaryPath" -ForegroundColor Gray
    Write-Host " Origen : $DownloadUrl" -ForegroundColor Gray
    Write-Host ""

    if (-not (Test-Path $BinDir)) {
        New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
    }

    $tempFile = "$DefaultBinaryPath.download"
    if (Test-Path $tempFile) {
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
    }

    # Configurar protocolos TLS modernos
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13

    $downloadSuccess = $false

    # Intento 1: curl.exe si está disponible (rápido y con progreso visual)
    $curlCmd = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curlCmd) {
        Write-Host " Iniciando descarga mediante curl.exe..." -ForegroundColor Cyan
        & curl.exe -L -# -o "$tempFile" "$DownloadUrl"
        if ($LASTEXITCODE -eq 0 -and (Test-Path $tempFile)) {
            $downloadSuccess = $true
        }
    }

    # Intento 2: System.Net.WebClient (fallback de .NET)
    if (-not $downloadSuccess) {
        try {
            Write-Host " Iniciando descarga mediante cliente Web .NET..." -ForegroundColor Cyan
            $webClient = New-Object System.Net.WebClient
            $webClient.Headers.Add("User-Agent", "Farfalina-Carissma-Setup/1.0")
            $webClient.DownloadFile($DownloadUrl, $tempFile)
            $downloadSuccess = $true
        } catch {
            Write-WarningBox "Fallo con WebClient: $_"
        }
    }

    # Intento 3: Invoke-WebRequest nativo de PowerShell
    if (-not $downloadSuccess) {
        try {
            Write-Host " Iniciando descarga mediante Invoke-WebRequest..." -ForegroundColor Cyan
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $tempFile -UseBasicParsing
            $downloadSuccess = $true
        } catch {
            Write-ErrorBox "Fallo crítico en descarga con Invoke-WebRequest: $_"
        }
    }

    # Validar archivo descargado
    if ($downloadSuccess -and (Test-Path $tempFile)) {
        $fileSize = (Get-Item $tempFile).Length
        # cloudflared para Windows amd64 tiene un tamaño típico entre 30MB y 70MB (> 10MB)
        if ($fileSize -lt 10485760) {
            Write-ErrorBox "El archivo descargado es demasiado pequeño ($fileSize bytes). Posible error de red o HTML de error."
            Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
            return $null
        }

        # Renombrar archivo temporal al destino final
        Move-Item -Path $tempFile -Destination $DefaultBinaryPath -Force

        # Validar ejecución íntegra
        try {
            $ver = & $DefaultBinaryPath --version 2>&1
            if ($LASTEXITCODE -eq 0 -and $ver -match "cloudflared version") {
                Write-SuccessBox "Descarga completada e integridad verificada exitosamente."
                Write-Host " Versión instalada: $ver" -ForegroundColor Green
                return $DefaultBinaryPath
            } else {
                Write-ErrorBox "El ejecutable descargado no responde al comando --version: $ver"
                Remove-Item -Path $DefaultBinaryPath -Force -ErrorAction SilentlyContinue
                return $null
            }
        } catch {
            Write-ErrorBox "No fue posible ejecutar el binario descargado: $_"
            Remove-Item -Path $DefaultBinaryPath -Force -ErrorAction SilentlyContinue
            return $null
        }
    } else {
        Write-ErrorBox "No se pudo descargar cloudflared.exe. Verifique su conexión a Internet."
        return $null
    }
}

function Get-PromptedToken {
    param([string]$CurrentToken)
    if ($CurrentToken -and $CurrentToken.Trim() -ne "") {
        return $CurrentToken.Trim()
    }

    if ($NonInteractive) {
        Write-ErrorBox "Debe proporcionar el parámetro -Token cuando se ejecuta en modo no interactivo (-NonInteractive)."
        exit 1
    }

    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host " INGRESO DEL TOKEN DE CLOUDFLARE ZERO TRUST TUNNEL" -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host " Pasos para obtener tu token:" -ForegroundColor Gray
    Write-Host " 1. Entra a https://one.dash.cloudflare.com (Cloudflare Zero Trust)" -ForegroundColor Gray
    Write-Host " 2. Ve a Networks > Tunnels > Selecciona o crea tu túnel" -ForegroundColor Gray
    Write-Host " 3. En la sección 'Install and run a connector', elige 'Windows (64-bit)'" -ForegroundColor Gray
    Write-Host " 4. Copia el TOKEN (la cadena alfanumérica que empieza con eyJh...)" -ForegroundColor Gray
    Write-Host "----------------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host ""

    $tokenInput = Read-Host " Pegue el Token del túnel"
    if (-not $tokenInput -or $tokenInput.Trim() -eq "") {
        Write-ErrorBox "El token no puede estar vacío."
        return $null
    }
    return $tokenInput.Trim()
}

# -----------------------------------------------------------------------------
# Acciones Principales
# -----------------------------------------------------------------------------

function Invoke-TunnelRun {
    param([string]$TunnelToken, [string]$TransportProtocol, [string]$TargetUrl)

    $bin = Ensure-Cloudflared
    if (-not $bin) {
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit 1
        }
        return
    }

    $effectiveToken = Get-PromptedToken -CurrentToken $TunnelToken
    if (-not $effectiveToken) {
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit 1
        }
        return
    }

    Write-Header "EJECUCIÓN DE TÚNEL AD-HOC (PRIMER PLANO)"
    Write-Host " Servicio local destino  : $TargetUrl" -ForegroundColor Cyan
    Write-Host " Configuración de origen : Gobernado por Public Hostname en Cloudflare Zero Trust" -ForegroundColor Gray
    Write-Host " Protocolo de transporte : $TransportProtocol" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " Presiona Ctrl + C en esta ventana para detener el túnel cuando desees." -ForegroundColor Yellow
    Write-Host " Conectando al edge global de Cloudflare..." -ForegroundColor Gray
    Write-Host ""

    $arguments = @("tunnel", "run", "--token", $effectiveToken)
    if ($TransportProtocol -and $TransportProtocol -ne "auto") {
        $arguments += @("--protocol", $TransportProtocol)
    }

    try {
        & $bin @arguments
        if ($LASTEXITCODE -ne 0) {
            Write-ErrorBox "El túnel finalizó con error (Código de salida: $LASTEXITCODE)."
            if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
                exit $LASTEXITCODE
            }
        }
    } catch {
        Write-ErrorBox "Error al ejecutar el túnel: $_"
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit 1
        }
    }
}

function Install-TunnelService {
    param([string]$TunnelToken)

    if (-not (Ensure-Elevation -SubAction "install" -TunnelToken $TunnelToken)) {
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit 1
        }
        return
    }

    $bin = Ensure-Cloudflared
    if (-not $bin) {
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit 1
        }
        return
    }

    $effectiveToken = Get-PromptedToken -CurrentToken $TunnelToken
    if (-not $effectiveToken) {
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit 1
        }
        return
    }

    Write-Header "INSTALACIÓN DE CLOUDFLARE TUNNEL COMO SERVICIO DE WINDOWS"

    # 1. Comprobar si ya existe el servicio y removerlo previamente
    $existingService = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-Host " [1/3] Servicio 'cloudflared' existente detectado. Deteniendo y desinstalando..." -ForegroundColor Yellow
        try {
            Stop-Service -Name "cloudflared" -Force -ErrorAction SilentlyContinue
        } catch {}
        
        $uninstallProc = Start-Process -FilePath $bin -ArgumentList "service uninstall" -Wait -PassThru -NoNewWindow
        Start-Sleep -Seconds 2
    } else {
        Write-Host " [1/3] No hay servicios previos en conflicto." -ForegroundColor Gray
    }

    # 2. Registrar el nuevo servicio
    Write-Host " [2/3] Registrando servicio en Windows con token proporcionado..." -ForegroundColor Cyan
    $installProc = Start-Process -FilePath $bin -ArgumentList "service install $effectiveToken" -Wait -PassThru -NoNewWindow
    if ($installProc.ExitCode -ne 0) {
        Write-ErrorBox "Falló el registro del servicio (Código de salida: $($installProc.ExitCode))."
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit $installProc.ExitCode
        }
        return
    }

    Start-Sleep -Seconds 1

    # 3. Iniciar el servicio de Windows
    Write-Host " [3/3] Iniciando el servicio de Windows 'cloudflared'..." -ForegroundColor Cyan
    try {
        Start-Service -Name "cloudflared" -ErrorAction SilentlyContinue
    } catch {}

    Start-Sleep -Seconds 2

    # 4. Verificar estado final
    $svc = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-SuccessBox "El servicio 'cloudflared' fue instalado e iniciado exitosamente."
        Write-Host " Detalle del servicio:" -ForegroundColor White
        Write-Host "   Nombre       : $($svc.Name)" -ForegroundColor Gray
        Write-Host "   Nombre visual: $($svc.DisplayName)" -ForegroundColor Gray
        Write-Host "   Estado       : $($svc.Status)" -ForegroundColor Green
        Write-Host "   Tipo inicio  : $($svc.StartType)" -ForegroundColor Green
        Write-Host ""
        Write-Host " El túnel ahora se ejecuta en segundo plano y se iniciará de forma automática" -ForegroundColor White
        Write-Host " cada vez que se encienda o reinicie este equipo." -ForegroundColor White
    } else {
        Write-WarningBox "El servicio se instaló pero su estado actual es: $(if ($svc) { $svc.Status } else { 'No detectado' })."
        Write-Host " Intentando arranque alternativo con 'net start cloudflared'..." -ForegroundColor Yellow
        $netStart = Start-Process -FilePath "net.exe" -ArgumentList "start cloudflared" -Wait -PassThru -NoNewWindow
        
        $svcFinal = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
        if ($svcFinal -and $svcFinal.Status -eq "Running") {
            Write-SuccessBox "Servicio activo y en ejecución."
        } else {
            Write-ErrorBox "No se pudo confirmar el inicio del servicio. Ejecute la opción de estado para más detalles."
            if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
                exit 1
            }
        }
    }
}

function Get-TunnelStatus {
    Write-Header "CONSULTA DE ESTADO DE CLOUDFLARE TUNNEL"

    $bin = Find-CloudflaredBinary
    if ($bin) {
        Write-Host " Binario local : $bin" -ForegroundColor Gray
        try {
            $ver = & $bin --version 2>&1
            Write-Host " Versión       : $ver" -ForegroundColor Gray
        } catch {}
    } else {
        Write-WarningBox "No se encontró el ejecutable cloudflared.exe en las rutas esperadas."
    }

    Write-Host ""
    Write-Host " Estado del Servicio de Windows (Get-Service):" -ForegroundColor Cyan
    $svc = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($svc) {
        Write-Host "   Nombre         : $($svc.Name)" -ForegroundColor White
        Write-Host "   Nombre visible : $($svc.DisplayName)" -ForegroundColor White
        $statusColor = if ($svc.Status -eq "Running") { "Green" } else { "Yellow" }
        Write-Host "   Estado actual  : $($svc.Status)" -ForegroundColor $statusColor
        Write-Host "   Tipo de inicio : $($svc.StartType)" -ForegroundColor White
    } else {
        Write-Host "   El servicio de Windows 'cloudflared' NO está instalado en este sistema." -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host " Consulta a nivel de Windows Service Control Manager (sc.exe query):" -ForegroundColor Cyan
    $scQuery = & sc.exe query cloudflared 2>&1
    foreach ($line in $scQuery) {
        Write-Host "   $line" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host " Procesos 'cloudflared' activos en memoria:" -ForegroundColor Cyan
    $procs = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
    if ($procs) {
        foreach ($p in $procs) {
            $memMB = [math]::Round($p.WorkingSet64 / 1MB, 2)
            Write-Host "   [PID: $($p.Id)] - Uso de Memoria: $memMB MB - Hora de inicio: $($p.StartTime)" -ForegroundColor Green
        }
    } else {
        Write-Host "   No hay procesos 'cloudflared' ejecutándose actualmente." -ForegroundColor Gray
    }
}

function Uninstall-TunnelService {
    if (-not (Ensure-Elevation -SubAction "uninstall")) {
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit 1
        }
        return
    }

    $bin = Ensure-Cloudflared
    if (-not $bin) {
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit 1
        }
        return
    }

    Write-Header "DESINSTALACIÓN DEL SERVICIO DE WINDOWS"

    $svc = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $svc) {
        Write-WarningBox "El servicio 'cloudflared' no se encuentra instalado en este equipo."
        return
    }

    Write-Host " [1/2] Deteniendo el servicio..." -ForegroundColor Cyan
    try {
        Stop-Service -Name "cloudflared" -Force -ErrorAction SilentlyContinue
    } catch {}
    Start-Sleep -Seconds 1

    Write-Host " [2/2] Eliminando registro del servicio con cloudflared.exe service uninstall..." -ForegroundColor Cyan
    $uninstProc = Start-Process -FilePath $bin -ArgumentList "service uninstall" -Wait -PassThru -NoNewWindow
    if ($uninstProc.ExitCode -ne 0) {
        Write-WarningBox "cloudflared service uninstall devolvió código $($uninstProc.ExitCode)."
        if ($NonInteractive -or $Action.ToLower() -ne 'menu') {
            exit $uninstProc.ExitCode
        }
    }

    Start-Sleep -Seconds 2

    $checkSvc = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
    if (-not $checkSvc) {
        Write-SuccessBox "El servicio 'cloudflared' fue completamente desinstalado del sistema."
    } else {
        Write-WarningBox "El servicio aún figura en Windows (puede requerir reiniciar la consola de servicios o el sistema)."
    }
}

function Wait-MainMenuReturn {
    Write-Host ""
    Write-Host "Presione cualquier tecla para volver al menú principal..." -ForegroundColor Gray
    try {
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } catch {
        $null = Read-Host
    }
}

function Show-MainMenu {
    do {
        Clear-Host
        Write-Host "======================================================================" -ForegroundColor Magenta
        Write-Host "     FLORERIA FARFALINA & CARISSMA - CLOUDFLARE TUNNEL (WINDOWS)      " -ForegroundColor White
        Write-Host "======================================================================" -ForegroundColor Magenta
        Write-Host ""
        
        $bin = Find-CloudflaredBinary
        if ($bin) {
            Write-Host "  [+] Binario: Listo ($bin)" -ForegroundColor Green
        } else {
            Write-Host "  [-] Binario: No descargado aun" -ForegroundColor Yellow
        }

        $svc = Get-Service -Name "cloudflared" -ErrorAction SilentlyContinue
        if ($svc -and $svc.Status -eq "Running") {
            Write-Host "  [+] Servicio Windows: EN EJECUCION (Running)" -ForegroundColor Green
        } elseif ($svc) {
            Write-Host "  [!] Servicio Windows: $($svc.Status)" -ForegroundColor Yellow
        } else {
            Write-Host "  [-] Servicio Windows: No instalado" -ForegroundColor Gray
        }

        Write-Host ""
        Write-Host "  MENU DE OPCIONES:" -ForegroundColor Cyan
        Write-Host "  ------------------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host "  [1] Ejecutar túnel en primer plano (Prueba / Modo Ad-hoc)" -ForegroundColor White
        Write-Host "  [2] Instalar e iniciar como servicio de Windows (Arranque automático)" -ForegroundColor White
        Write-Host "  [3] Consultar estado detallado del servicio y procesos" -ForegroundColor White
        Write-Host "  [4] Detener y desinstalar servicio de Windows" -ForegroundColor White
        Write-Host "  [5] Descargar o verificar integridad de cloudflared.exe" -ForegroundColor White
        Write-Host "  [0] Salir" -ForegroundColor Red
        Write-Host "  ------------------------------------------------------------------" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host " Selecciona una opción (0-5): " -NoNewline -ForegroundColor Yellow
        
        $choice = Read-Host

        switch ($choice) {
            "1" {
                Invoke-TunnelRun -TunnelToken $Token -TransportProtocol $Protocol -TargetUrl $LocalUrl
                Wait-MainMenuReturn
            }
            "2" {
                Install-TunnelService -TunnelToken $Token
                Wait-MainMenuReturn
            }
            "3" {
                Get-TunnelStatus
                Wait-MainMenuReturn
            }
            "4" {
                Uninstall-TunnelService
                Wait-MainMenuReturn
            }
            "5" {
                Ensure-Cloudflared -Force:$ForceDownload
                Wait-MainMenuReturn
            }
            "0" {
                Write-Host "`n¡Hasta pronto!`n" -ForegroundColor Cyan
                return
            }
            Default {
                Write-WarningBox "Opción inválida. Ingrese un número entre 0 y 5."
                Start-Sleep -Seconds 1
            }
        }
    } while ($true)
}

# -----------------------------------------------------------------------------
# Punto de Entrada
# -----------------------------------------------------------------------------

switch ($Action.ToLower()) {
    'menu' {
        Show-MainMenu
    }
    'run' {
        Invoke-TunnelRun -TunnelToken $Token -TransportProtocol $Protocol -TargetUrl $LocalUrl
    }
    'install' {
        Install-TunnelService -TunnelToken $Token
    }
    'status' {
        Get-TunnelStatus
    }
    'uninstall' {
        Uninstall-TunnelService
    }
    'download' {
        $bin = Ensure-Cloudflared -Force:$ForceDownload
        if (-not $bin) {
            exit 1
        }
    }
}
