@echo off
title Respaldo de Base de Datos - Floreria Farfalina
color 0B

echo ================================================================
echo     COPIA DE SEGURIDAD AUTOMATICA - BASE DE DATOS
echo ================================================================
echo.

if not exist "Respaldos" mkdir "Respaldos"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set FECHA=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%

copy /Y "prisma\dev.db" "Respaldos\copia_seguridad_%FECHA%.db" >nul

if %errorlevel% equ 0 (
    echo [OK] Respaldo completado con exito!
    echo Archivo guardado en: Respaldos\copia_seguridad_%FECHA%.db
    echo.
    echo Puedes copiar este archivo a un pendrive o Google Drive cuando quieras.
) else (
    color 0C
    echo Error al copiar la base de datos.
)

echo.
echo Presiona cualquier tecla para cerrar...
pause >nul