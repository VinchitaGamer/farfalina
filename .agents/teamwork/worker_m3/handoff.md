# Handoff Report: Lanzador Local para la Máquina del Cliente (`start-system.bat`) (Milestone M3 - R3)

**Fecha:** 2026-10-06  
**Autor:** Windows System Launcher Worker (`teamwork_preview_worker`)  
**Directorio de Trabajo:** `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\worker_m3\`  
**Archivos Afectados / Creados:** `c:\Users\Lenovo\Desktop\floreria\start-system.bat` (exclusivo)

---

## 1. Observation

1. **Ubicación y Entorno:**
   - La raíz del proyecto se ubica en `c:\Users\Lenovo\Desktop\floreria\`.
   - Se ejecutó `where.exe curl.exe node npm` confirmando la disponibilidad de las herramientas en el sistema operativo Windows:
     - `C:\Windows\System32\curl.exe`
     - `C:\Program Files\nodejs\node.exe`
     - `C:\Program Files\nodejs\npm.cmd`
2. **Navegadores Instalados:**
   - Se validaron las rutas de navegadores en la máquina local:
     - `C:\Program Files\Google\Chrome\Application\chrome.exe` -> `True`
     - `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` -> `True`
3. **Comportamiento del Servidor y Redirección HTTP 307:**
   - Al ejecutar `npm run start` y sondear con `curl.exe -s -I http://localhost:3000`:
     ```text
     HTTP/1.1 307 Temporary Redirect
     Vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch, Accept-Encoding
     x-nextjs-cache: HIT
     X-Powered-By: Next.js
     Cache-Control: s-maxage=31536000, stale-while-revalidate
     Content-Type: text/html; charset=utf-8
     Date: Tue, 06 Oct 2026 03:07:31 GMT
     Connection: keep-alive
     ```
   - El código de salida de `curl.exe` ante esta respuesta 307 es `0`, mientras que cuando el servidor no está corriendo retorna código `1` (o `7`).
4. **Particularidades Críticas de CMD de Windows Resueltas:**
   - Se detectó que archivos `.bat` con saltos de línea LF puros (`\n`) provocan que CMD desplace punteros de caracteres y recorte los primeros caracteres de cada línea (`"cho" no se reconoce...`, `"d" no se reconoce...`). Se garantizó que `start-system.bat` posee terminadores CRLF (`\r\n`) al 100%.
   - Se evitó el uso de caracteres de paréntesis `)` no escapados dentro de bloques condicionales `if ... (` para impedir que CMD termine prematuramente la instrucción arrojando `No se esperaba ... en este momento`.
   - Se evitó el uso de `&` en el título de ventana de `start` (`start "Servidor Farfalina" /min cmd /c "%START_CMD%"`), impidiendo que CMD interprete el ampersand como un operador de separación de comandos.
   - Se utilizó `timeout /t 1 >nul 2>&1 || ping -n 2 127.0.0.1 >nul` para asegurar que las esperas temporales funcionen tanto en terminales interactivos como en entornos con redirección de entrada estándar (`ERROR: No es compatible la redirección de entradas`).
5. **Ejecución en Vivo de `start-system.bat`:**
   - La ejecución en vivo del script ejecutó satisfactoriamente:
     ```text
     ================================================================
        FLORERÍA FARFALINA Y CARISSMA VESTIDOS - SISTEMA LOCAL
     ================================================================

     [OK] Compilacion detectada en .next.
     Iniciando servidor en modo produccion: npm run start

     [1/3] Lanzando servidor Next.js en segundo plano [npm run start]...
     [2/3] Esperando que el sistema este listo en http://localhost:3000...
     .
     [3/3] Servidor listo. Abriendo interfaz en modo aplicacion...

     [INFO] Iniciando con Google Chrome 64-bit...

     ================================================================
      ¡SISTEMA FARFALINA Y CARISSMA INICIADO EXITOSAMENTE!
      La aplicacion se ha abierto en: http://localhost:3000
      Para detener el sistema, cierre la ventana minimizada del servidor.
     ================================================================
     ```
   - Código de salida: `0`.

---

## 2. Logic Chain

1. Dado que los usuarios finales de la florería y alquiler de vestidos no son desarrolladores de software, el proceso de arranque debe ser accesible con un solo clic sin necesidad de abrir terminales ni ingresar comandos de consola.
2. Dado que Next.js ofrece modo producción de alto rendimiento cuando existe el directorio `.next`, el script verifica `if not exist ".next"` para utilizar `npm run dev` como fallback transparente, o `npm run start` cuando la compilación está disponible.
3. Para evitar bloquear la terminal o mostrar consolas intrusivas que el usuario pueda cerrar por accidente, el servidor se inicia de forma asíncrona minimizado en la barra de tareas (`start "Servidor Farfalina" /min cmd /c "%START_CMD%"`).
4. Para evitar errores prematuros en el navegador (`ERR_CONNECTION_REFUSED`), se implementó un bucle de polling inteligente de hasta 60 intentos (1 segundo entre intentos) empleando `curl.exe -s -I http://localhost:3000` con `if not errorlevel 1`, aceptando tanto respuestas 200 como la redirección 307 de la ruta raíz hacia `/floreria/catalog`, con respaldo adicional mediante socket TCP en PowerShell.
5. Para brindar una experiencia nativa de escritorio para el Punto de Venta, el script evalúa en cascada la existencia de Google Chrome (64-bit, 32-bit y LocalAppData) y Microsoft Edge (32-bit y 64-bit) para ejecutarlos con el argumento `--app=http://localhost:3000`, ocultando barras de direcciones y menús del navegador, con fallback al navegador predeterminado de Windows si ninguno estuviera en las rutas estándar.
6. Si el servidor ya se encontraba ejecutándose previamente en el puerto 3000, el script lo detecta de inmediato (`SERVER_ALREADY_ACTIVE`), evitando lanzar una segunda instancia conflictiva (`EADDRINUSE`) y abriendo directamente la ventana del navegador.

---

## 3. Caveats

- Si el puerto 3000 está ocupado por una aplicación ajena a Next.js antes de ejecutar el lanzador, el script detectará que el puerto responde y abrirá la URL `http://localhost:3000`.
- En entornos virtuales o contenedores sin interfaz gráfica ni navegadores instalados, el script utilizará el fallback `start "" "%TARGET_URL%"`.
- No caveats adicionales.

---

## 4. Conclusion

El lanzador local de un solo clic `start-system.bat` ha sido implementado y probado exhaustivamente en la raíz del proyecto. Cumple estrictamente todos los requisitos de M3 (R3), respetando el alcance exclusivo de archivos, soportando saltos de línea Windows CRLF, tolerancia completa al HTTP 307 de Next.js, lanzamiento asíncrono no bloqueante, cascada de navegadores en modo aplicación `--app`, y mensajes claros en español.

---

## 5. Verification Method

Para verificar independientemente el correcto funcionamiento de `start-system.bat`:

1. **Inspección de codificación y terminadores de línea:**
   ```powershell
   node -e "const buf = require('fs').readFileSync('start-system.bat'); let cr=0, lf=0; for(const b of buf){if(b===13)cr++; if(b===10)lf++;} console.log('CR:', cr, 'LF:', lf, 'CRLF Match:', cr===lf);"
   ```
   *Resultado esperado:* `CRLF Match: true`.

2. **Ejecución directa desde CMD:**
   ```cmd
   cmd /c start-system.bat
   ```
   *Resultado esperado:* Código de salida `0`, mensajes amigables en consola, detección de servidor e inicio del navegador en modo aplicación.

3. **Verificación de detección de servidor ya activo:**
   Ejecutar `cmd /c start-system.bat` una segunda vez con el servidor ya corriendo.
   *Resultado esperado:* Imprime `[INFO] El servidor ya se encuentra activo en http://localhost:3000.` y abre la interfaz sin iniciar un proceso duplicado.
