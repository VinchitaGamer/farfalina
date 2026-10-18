@echo off
setlocal
chcp 65001 > nul
title Floreria Farfalina y Carissma - Verificador de Webhooks Meta (R4)

echo ======================================================================
echo   FLORERIA FARFALINA Y CARISSMA - VERIFICADOR DE WEBHOOKS META (R4)
echo ======================================================================
echo.
echo Ejecutando verificacion de endpoints de webhook de Meta Developers:
echo   - WhatsApp Cloud API:      /api/webhooks/whatsapp
echo   - Facebook Messenger:      /api/webhooks/facebook
echo   - Instagram Direct:        /api/webhooks/instagram
echo.
echo Modo por defecto: Deteccion automatica (En Vivo si el servidor responde,
echo                   o En Proceso offline sin requerir servidor).
echo ======================================================================
echo.

call npx tsx scripts/verify-meta-webhooks.ts %*
set SCRIPT_EXIT_CODE=%ERRORLEVEL%

echo.
echo ======================================================================
if %SCRIPT_EXIT_CODE% EQU 0 (
    echo   [EXITO] Todas las pruebas de verificacion pasaron exitosamente.
    echo   El sistema esta listo para handshake de Meta Developers.
) else (
    echo   [ERROR] Se detectaron fallas en la verificacion.
    echo   Revise el detalle de los errores listados arriba.
)
echo ======================================================================
echo.
pause
exit /b %SCRIPT_EXIT_CODE%
