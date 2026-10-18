@echo off
setlocal EnableDelayedExpansion
title Configuracion de Cloudflare Tunnel - Floreria Farfalina y Carissma
color 0B
chcp 65001 >nul 2>&1

echo ======================================================================
echo    FLORERIA FARFALINA Y CARISSMA - CONFIGURADOR CLOUDFLARE TUNNEL
echo ======================================================================
echo(

:: Verificar si PowerShell esta disponible
where powershell.exe >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR FATAL] PowerShell no esta instalado o no se encuentra en el PATH.
    echo Este script requiere Windows PowerShell 5.1 o superior.
    echo(
    pause
    exit /b 1
)

:: Localizar script de PowerShell
set "PS_SCRIPT=%~dp0scripts\setup-cloudflare-tunnel.ps1"
if not exist "%PS_SCRIPT%" (
    color 0C
    echo [ERROR FATAL] No se encontro el archivo:
    echo "%PS_SCRIPT%"
    echo(
    pause
    exit /b 1
)

:: Ejecutar script de PowerShell pasando todos los argumentos
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
set "EXIT_CODE=%errorlevel%"

:: Si se invoco sin argumentos (doble clic del usuario), pausar para mantener la consola abierta
if "%~1"=="" (
    echo(
    echo Presione cualquier tecla para cerrar esta ventana...
    pause >nul
) else (
    if !EXIT_CODE! neq 0 (
        echo(
        echo Ocurrio un error durante la ejecucion [Codigo: !EXIT_CODE!].
        pause >nul
    )
)

exit /b !EXIT_CODE!
