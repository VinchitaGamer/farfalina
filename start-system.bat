@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title Florería Farfalina y Carissma - Lanzador del Sistema
color 0A

echo ================================================================
echo    FLORERÍA FARFALINA Y CARISSMA VESTIDOS - SISTEMA LOCAL
echo ================================================================
echo.

:: Cambiar al directorio raiz del script
cd /d "%~dp0"

:: 1. Verificacion inicial de Node.js y npm en el sistema
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ================================================================
    echo  [ERROR FATAL] Node.js no esta instalado o no se encuentra en PATH.
    echo ================================================================
    echo  Para ejecutar el sistema, es necesario tener instalado Node.js LTS.
    echo  Por favor descarguelo e instalelo desde: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ================================================================
    echo  [ERROR FATAL] npm no esta instalado o no se encuentra en PATH.
    echo ================================================================
    echo  Por favor verifique la instalacion de Node.js en su sistema.
    echo.
    pause
    exit /b 1
)

:: 2. Deteccion de compilacion (.next)
set "START_CMD=npm run start"
if not exist ".next" (
    echo [AVISO] No se detecto compilacion previa en .next.
    echo Iniciando servidor en modo desarrollo: npm run dev
    set "START_CMD=npm run dev"
)
if exist ".next" (
    echo [OK] Compilacion detectada en .next.
    echo Iniciando servidor en modo produccion: npm run start
    set "START_CMD=npm run start"
)

:: 3. Verificar si el servidor ya esta corriendo previamente en el puerto 3000
set "SERVER_ALREADY_ACTIVE=0"
curl.exe -s -I http://localhost:3000 >nul 2>&1
if not errorlevel 1 set "SERVER_ALREADY_ACTIVE=1"

if "!SERVER_ALREADY_ACTIVE!"=="0" (
    powershell -NoProfile -Command "try { $s = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); $s.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 set "SERVER_ALREADY_ACTIVE=1"
)

if "!SERVER_ALREADY_ACTIVE!"=="1" (
    echo [INFO] El servidor ya se encuentra activo en http://localhost:3000.
    goto LAUNCH_BROWSER
)

:: 4. Lanzamiento del servidor Next.js en segundo plano minimizado
echo.
echo [1/3] Lanzando servidor Next.js en segundo plano [%START_CMD%]...
start "Servidor Farfalina" /min cmd /c "%START_CMD%"

:: 5. Polling inteligente de disponibilidad HTTP (Tolerante a HTTP 307 de redireccion)
echo [2/3] Esperando que el sistema este listo en http://localhost:3000...
set /a ATTEMPTS=0

:POLL_LOOP
set /a ATTEMPTS+=1
if !ATTEMPTS! gtr 60 (
    color 0C
    echo.
    echo ================================================================
    echo  [ERROR] El servidor tardo mas de 60 segundos en responder.
    echo ================================================================
    echo  Por favor revise la ventana minimizada del servidor en la
    echo  barra de tareas para diagnosticar posibles errores de inicio.
    echo.
    pause
    exit /b 1
)

:: Indicador visual de espera (un punto por intento)
<nul set /p =.

:: Sondeo HTTP mediante curl.exe (valida cualquier respuesta HTTP: 200, 301, 302, 307, 308)
curl.exe -s -I http://localhost:3000 >nul 2>&1
if not errorlevel 1 (
    echo.
    goto LAUNCH_BROWSER
)

:: Sondeo alternativo mediante socket TCP por si curl.exe tuviera restricciones
powershell -NoProfile -Command "try { $s = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 3000); $s.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo.
    goto LAUNCH_BROWSER
)

timeout /t 1 >nul 2>&1 || ping -n 2 127.0.0.1 >nul
goto POLL_LOOP

:LAUNCH_BROWSER
echo [3/3] Servidor listo. Abriendo interfaz en modo aplicacion...
echo.

set "TARGET_URL=http://localhost:3000"

:: 6. Cascada de apertura de navegador en modo aplicacion (--app)

:: 6.a) Google Chrome (64-bit, 32-bit, LocalAppData)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    echo [INFO] Iniciando con Google Chrome 64-bit...
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app=%TARGET_URL%
    goto FINISH
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    echo [INFO] Iniciando con Google Chrome 32-bit...
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app=%TARGET_URL%
    goto FINISH
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" (
    echo [INFO] Iniciando con Google Chrome usuario local...
    start "" "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" --app=%TARGET_URL%
    goto FINISH
)

:: 6.b) Microsoft Edge (32-bit, 64-bit nativo en Windows 10/11)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    echo [INFO] Iniciando con Microsoft Edge...
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app=%TARGET_URL%
    goto FINISH
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    echo [INFO] Iniciando con Microsoft Edge...
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app=%TARGET_URL%
    goto FINISH
)

:: 6.c) Fallback: Navegador predeterminado del sistema
echo [INFO] Iniciando con el navegador predeterminado del sistema...
start "" "%TARGET_URL%"

:FINISH
echo.
echo ================================================================
echo  ¡SISTEMA FARFALINA Y CARISSMA INICIADO EXITOSAMENTE!
echo  La aplicacion se ha abierto en: %TARGET_URL%
echo  Para detener el sistema, cierre la ventana minimizada del servidor.
echo ================================================================
echo.
timeout /t 3 >nul 2>&1 || ping -n 4 127.0.0.1 >nul
exit /b 0
