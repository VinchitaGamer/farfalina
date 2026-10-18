@echo off
title Instalacion de Dependencias - Floreria Farfalina
color 0E

echo ================================================================
echo    INSTALACION INICIAL DE FARFALINA Y CARISSMA
echo ================================================================
echo.
echo Este proceso se ejecuta una sola vez para preparar el sistema.
echo Por favor espera unos momentos...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Node.js no esta instalado.
    echo Descargalo gratis desde: https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Instalando librerias necesarias (npm install)...
call npm install

echo.
echo [2/3] Generando cliente de base de datos (prisma generate)...
call npx prisma generate

echo.
echo [3/3] Compilando aplicacion para produccion (npm run build)...
call npm run build

echo.
color 0A
echo ================================================================
echo  TODO ESTA LISTO! Ya puedes hacer doble clic en:
echo     INICIAR_FARFALINA.bat
echo ================================================================
echo.
pause