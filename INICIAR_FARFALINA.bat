@echo off
title Floreria Farfalina y Carissma - Servidor Local
color 0A

echo ================================================================
echo    FLORERIA FARFALINA Y CARISSMA VESTIDOS - SISTEMA LOCAL
echo ================================================================
echo.
echo [1/3] Verificando entorno Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERROR: Node.js no esta instalado en esta laptop.
    echo Por favor descarga e instala Node.js LTS desde:
    echo https://nodejs.org/
    echo.
    pause
    exit /b
)

echo [OK] Node.js detectado correctamente.
echo.
echo [2/3] Iniciando el servidor en http://localhost:3000 ...
echo (No cierres esta ventana mientras uses el sistema)
echo.

start "" "http://localhost:3000"

echo [3/3] Abriendo navegador...
echo.
echo ================================================================
echo  SISTEMA ACTIVO EN TU COMPUTADORA LOCAL
echo  URL: http://localhost:3000
echo  Para salir: Cierra esta ventana.
echo ================================================================
echo.

npm run start

pause