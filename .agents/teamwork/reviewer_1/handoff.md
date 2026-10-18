# Handoff Report - Review & Adversarial Critic: Milestone M1 & M2

**Reviewer / Critic:** Reviewer 1 (`teamwork_preview_reviewer`)  
**Directorio de Trabajo:** `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\reviewer_1\`  
**Archivos Evaluados:**
1. `docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md` (Milestone M1 - R1)
2. `scripts/setup-cloudflare-tunnel.ps1` (Milestone M2 - R2)
3. `CONFIGURAR_TUNEL_CLOUDFLARE.bat` (Milestone M2 - R2)

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**

- **Milestone M1 (`docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md`)**: **APPROVE (Calidad sobresaliente)**. Cubre de forma exhaustiva, didáctica y técnica todos los requerimientos de R1 (DNS, registradores GoDaddy, Namecheap, Hostinger, DonWeb/NIC, Universal SSL, Zero Trust, Public Hostname hacia `localhost:3000`, Webhooks de Meta con WhatsApp, Facebook e Instagram, tokens y Troubleshooting de errores 502, 1033, propagación, bucles SSL y QUIC/UDP 7844).
- **Milestone M2 (`scripts/setup-cloudflare-tunnel.ps1` y `CONFIGURAR_TUNEL_CLOUDFLARE.bat`)**: **REQUEST_CHANGES**. El script PowerShell y el lanzador Batch presentan una excelente base funcional, análisis de sintaxis 100% limpio y descarga verificada de `cloudflared.exe`. Sin embargo, las pruebas adversariales descubrieron **dos fallos mayores de ejecución** en escenarios reales de cliente:
  1. La elevación automática de UAC en `Ensure-Elevation` falla y aborta porque evalúa `$MyInvocation.MyCommand.Path` dentro del ámbito de una función (donde retorna `$null`), lanzando PowerShell con `-File ""` lo cual crashea la ventana de elevación.
  2. En modo no interactivo (`-NonInteractive`), si no se proporciona el parámetro `-Token`, `Get-PromptedToken` invoca incondicionalmente `Read-Host`, bloqueando indefinidamente la ejecución del proceso en segundo plano / CI / tareas desatendidas.

---

## 1. Observation

### Obs 1: Inspección de M1 (`docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md`)
- **Ruta:** `c:\Users\Lenovo\Desktop\floreria\docs\GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md` (446 líneas, 26,394 bytes).
- **Cobertura de Requerimientos:**
  - Arquitectura y flujo sin VPS / sin abrir puertos (Líneas 42-79).
  - Prerrequisitos de sistema operativo, dominio y Next.js en puerto 3000 (Líneas 82-97).
  - Paso 1: Onboarding en Cloudflare Free, escaneo de registros DNS (preservación de MX) y asignación de Nameservers (Líneas 100-121).
  - Paso 2: Delegación por registrador: GoDaddy (2.1), Namecheap (2.2), Hostinger (2.3), DonWeb / NIC (2.4) y verificación de propagación (2.5) (Líneas 124-165).
  - Paso 3: SSL/TLS Universal, modos Full vs Flexible, Always Use HTTPS y Automatic HTTPS Rewrites (Líneas 168-182).
  - Paso 4: Cloudflare Zero Trust Tunnels, creación de conector administrado en Windows 64-bit, obtención del Token base64 y Public Hostname hacia `HTTP` `localhost:3000`, explicando el CNAME proxied generado (`<UUID>.cfargotunnel.com`) (Líneas 185-235).
  - Paso 5: Verificación HTTPS externa, celular 4G/5G y cURL con expectativa de HTTP 307 hacia `/floreria/catalog` (Líneas 238-270).
  - Paso 6: Configuración de Webhooks de Meta Developers para WhatsApp (`/api/webhooks/whatsapp`), Facebook (`/api/webhooks/facebook`) e Instagram (`/api/webhooks/instagram`), jerarquía de tokens (`farfalina_carissma_webhook_verify_token_2026` y `META_VERIFY_TOKEN`) y suscripción al campo `messages` (Líneas 273-336).
  - Troubleshooting: Error 502 Bad Gateway, Error 1033 Tunnel, retardo DNS, bucle de redirección SSL y bloqueo de protocolo QUIC/UDP 7844 con solución `--protocol http2` (Líneas 339-431).
- **Comprobación de Rutas en Código Fuente:**
  Se verificó mediante `grep_search` que las rutas `/app/api/webhooks/whatsapp/route.ts`, `/app/api/webhooks/facebook/route.ts` y `/app/api/webhooks/instagram/route.ts` contienen de forma exacta:
  ```typescript
  const DEFAULT_VERIFY_TOKEN = "farfalina_carissma_webhook_verify_token_2026";
  ```
  y evalúan tanto `META_VERIFY_TOKEN` como el token de respaldo, validando la fidelidad total de la documentación.

### Obs 2: Análisis Sintáctico de M2 (`setup-cloudflare-tunnel.ps1`)
- Se ejecutó el parser del motor de PowerShell:
  ```powershell
  [System.Management.Automation.Language.Parser]::ParseFile('c:\Users\Lenovo\Desktop\floreria\scripts\setup-cloudflare-tunnel.ps1', [ref]$null, [ref]$errs)
  ```
- **Resultado:** 0 errores de sintaxis (`$errs.Count -eq 0`). Codificación UTF-8 con BOM correcta para PowerShell 5.1.

### Obs 3: Verificación del Binario `cloudflared.exe`
- Se verificó la existencia y ejecución de `bin\cloudflared.exe`:
  - Tamaño: 55,365,048 bytes.
  - Salida de `bin\cloudflared.exe --version`:
    ```text
    cloudflared version 2026.10.0 (built 2026-10-05T08:39 UTC)
    ```

### Obs 4: Falla en Elevación UAC (`Ensure-Elevation`)
- **Código en `scripts/setup-cloudflare-tunnel.ps1` (Línea 120):**
  ```powershell
  $argList = "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`" -Action $SubAction"
  ```
- **Comportamiento Observado:**
  En PowerShell, dentro del cuerpo de una función (`function Ensure-Elevation`), `$MyInvocation.MyCommand` representa un objeto `FunctionInfo`, cuyo atributo `.Path` es `$null` / cadena vacía.
  Al ejecutarse `Start-Process powershell.exe -ArgumentList $argList -Verb RunAs`, se envía:
  `-NoProfile -ExecutionPolicy Bypass -File "" -Action install`
- **Error Verbatim de Windows PowerShell:**
  ```text
  Error al procesar -File '-Action' porque el archivo no tiene la extensión '.ps1'. Especifique un nombre de archivo de script de Windows PowerShell válido e inténtelo de nuevo.
  ```
  La ventana elevada de PowerShell se cierra inmediatamente con error y la función retorna `$false`.

### Obs 5: Bloqueo Indefinido (Hang) en Modo No Interactivo sin Token
- **Código en `scripts/setup-cloudflare-tunnel.ps1` (Línea 285):**
  ```powershell
  function Get-PromptedToken {
      param([string]$CurrentToken)
      if ($CurrentToken -and $CurrentToken.Trim() -ne "") {
          return $CurrentToken.Trim()
      }
      ...
      $tokenInput = Read-Host " Pegue el Token del túnel"
  ```
- **Comprobación:**
  Al invocar:
  ```powershell
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-cloudflare-tunnel.ps1" -Action run -NonInteractive
  ```
  El proceso se congeló esperando entrada por stdin en `Read-Host` y tuvo que ser abortado como tarea en segundo plano (`task-68`).
  La bandera `$NonInteractive` no es consultada dentro de `Get-PromptedToken`.

### Obs 6: Truncamiento del Código de Salida (Exit Code 0 ante fallos de `cloudflared`)
- Al invocar `cloudflared.exe tunnel run --token dummy_token`, el ejecutable finaliza con error:
  `Provided Tunnel token is not valid.` y devuelve código de salida `1`.
- Sin embargo, `Invoke-TunnelRun` y el script `setup-cloudflare-tunnel.ps1` finalizan con código de salida `0` hacia el sistema operativo (`%ERRORLEVEL% = 0` en CMD), impidiendo que scripts automatizados o `CONFIGURAR_TUNEL_CLOUDFLARE.bat` detecten el fallo.

---

## 2. Logic Chain

1. **Evaluación de M1 (Documentación):**
   - Premisa: El Requerimiento R1 exige una guía paso a paso para añadir el dominio a Cloudflare, cambiar Nameservers, configurar SSL Universal, crear el túnel hacia `http://localhost:3000`, verificar webhooks de Meta y documentar solución de problemas.
   - Observación (Obs 1): `docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md` contiene todas las secciones, parámetros exactos, correspondencia con el código de Next.js y diagramas operativos.
   - Deducción: M1 cumple al 100% con los criterios de aceptación y está listo para producción.

2. **Evaluación de M2 (Scripts de Automatización):**
   - Premisa: El Requerimiento R2 exige scripts en PowerShell y Batch para ejecutar el túnel ad-hoc y permitir instalarlo como servicio nativo de Windows (arranque automático).
   - Observación (Obs 2 y Obs 3): El script tiene sintaxis válida y descarga/valida el binario `cloudflared.exe`.
   - Observación (Obs 4): Para instalar un servicio de Windows se requieren permisos de Administrador. Si el usuario abre la terminal normal o hace doble clic en el `.bat` y escoge la opción 2 ("Instalar servicio"), el script detecta que no es admin y ofrece elevarse mediante UAC. Al aceptar, `$MyInvocation.MyCommand.Path` es `$null` dentro de la función, por lo que invoca PowerShell con `-File ""` y falla inmediatamente con error de sintaxis de línea de comandos.
   - Deducción: El flujo de elevación interactivo está roto. Esto impedirá a cualquier usuario no técnico instalar el servicio de Windows a menos que sepa abrir previamente una consola elevada.
   - Observación (Obs 5): Si cualquier sistema automatizado, script de prueba o invocación CLI llama al script con `-NonInteractive` sin proporcionar `-Token`, el script queda esperando en `Read-Host` de forma indefinida en lugar de salir con un mensaje de error y código de salida 1.
   - Observación (Obs 6): Si `cloudflared` falla, el script PowerShell no propaga el código de salida a `%ERRORLEVEL%`.
   - Deducción: M2 requiere correcciones técnicas antes de ser aprobado.

---

## Findings

### [Major] Finding 1: Fallo crítico de elevación UAC en `Ensure-Elevation`
- **Qué:** La elevación UAC falla al invocar PowerShell con `-File ""` vacío.
- **Dónde:** `scripts/setup-cloudflare-tunnel.ps1`, Línea 120.
- **Por qué:** Dentro de una función de PowerShell, `$MyInvocation.MyCommand` apunta a la función `Ensure-Elevation` (`FunctionInfo`), cuya propiedad `.Path` es `$null`. La propiedad `.Path` del script sólo existe a nivel global de script o mediante `$PSCommandPath`.
- **Sugerencia de corrección:** Reemplazar en la línea 120 `$($MyInvocation.MyCommand.Path)` por `$PSCommandPath` (o almacenar `$ScriptPath = $MyInvocation.MyCommand.Path` en la raíz del script antes de las funciones y usar `$ScriptPath`).

### [Major] Finding 2: Bloqueo indefinido (Hang) por `Read-Host` en modo no interactivo
- **Qué:** `Get-PromptedToken` congela la ejecución esperando `Read-Host` en entornos desatendidos o automatizados si falta el parámetro `-Token`.
- **Dónde:** `scripts/setup-cloudflare-tunnel.ps1`, Líneas 267-291.
- **Por qué:** La función no comprueba si `$NonInteractive` está activo antes de invocar `Read-Host`.
- **Sugerencia de corrección:** Al inicio de `Get-PromptedToken`:
  ```powershell
  if (-not ($CurrentToken -and $CurrentToken.Trim() -ne "")) {
      if ($NonInteractive) {
          Write-ErrorBox "Debe proporcionar el parámetro -Token cuando se ejecuta en modo no interactivo (-NonInteractive)."
          return $null
      }
  }
  ```

### [Minor] Finding 3: Falta de propagación del código de error de `cloudflared`
- **Qué:** El script retorna código de salida `0` al sistema operativo cuando `cloudflared` falla con error.
- **Dónde:** `scripts/setup-cloudflare-tunnel.ps1`, Líneas 320-324, 358-361 y bloque final de switch (líneas 567-586).
- **Por qué:** PowerShell no lanza excepción terminante en llamadas nativas a ejecutables con código de salida distinto de 0 y el script no ejecuta `exit $LASTEXITCODE`.
- **Sugerencia de corrección:** En el modo no interactivo (`if ($NonInteractive)`), si `$LASTEXITCODE -ne 0` o el proceso de instalación falla, invocar `exit 1` o `exit $LASTEXITCODE`.

### [Minor] Finding 4: Excepción potencial en `$Host.UI.RawUI.ReadKey` en terminales redirigidas
- **Qué:** En entornos donde la entrada estándar está redirigida o no hay consola interactiva completa (ciertos runners de CI o extensiones de terminal), `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")` arroja una excepción terminante.
- **Dónde:** `scripts/setup-cloudflare-tunnel.ps1`, Líneas 525, 531, 537, 543, 549.
- **Sugerencia de corrección:** Envolver la llamada en `try { $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") } catch { Read-Host }`.

### [Minor] Finding 5: Parámetro `$LocalUrl` no utilizado en túneles basados en Token
- **Qué:** En `Invoke-TunnelRun`, `$TargetUrl` se recibe y se imprime en pantalla, pero no se pasa ningún argumento a `cloudflared`.
- **Dónde:** `scripts/setup-cloudflare-tunnel.ps1`, Líneas 298 y 314.
- **Por qué:** Los túneles de Cloudflare Zero Trust que usan `--token` configuran el origen exclusivamente en el dashboard de Zero Trust (Public Hostname).
- **Sugerencia de corrección:** Añadir una nota aclaratoria en la consola o en la ayuda del script indicando que el mapeo local hacia el puerto 3000 es gobernado por la regla de Public Hostname configurada en el panel de Cloudflare Zero Trust.

---

## Adversarial Challenge & Stress-Testing Report

**Overall Risk Assessment:** **MEDIUM**

### Challenge 1: Elevación UAC sin privilegios previos
- **Hipótesis desafiada:** "El usuario puede ejecutar `CONFIGURAR_TUNEL_CLOUDFLARE.bat` con doble clic estándar e instalar el servicio sin requerir conocimientos técnicos avanzados".
- **Escenario de Ataque:** Ejecutar el configurador desde una consola estándar de usuario y seleccionar la opción de instalar servicio.
- **Resultado:** **FAIL**. Al autorizar la elevación, la nueva ventana de PowerShell arroja error de archivo inválido (`-File ""`) y la instalación no se realiza.
- **Blast Radius:** Experiencia de usuario rota para instalación desatendida.
- **Mitigación:** Corregir variable de ruta a `$PSCommandPath`.

### Challenge 2: Invocación en Pipelines o Scripts Desatendidos sin Token
- **Hipótesis desafiada:** "La bandera `-NonInteractive` garantiza que el script nunca se detenga a solicitar entradas de usuario".
- **Escenario de Ataque:** Invocación CLI desatendida con `-Action run -NonInteractive` sin suministrar `-Token`.
- **Resultado:** **FAIL**. Se detiene en `Read-Host` y cuelga el proceso indefinidamente.
- **Blast Radius:** Bloqueo de pipelines de CI, scripts de inicio de Windows o tareas en segundo plano.
- **Mitigación:** Guardia de validación para abortar inmediatamente si `$NonInteractive` es verdadero.

### Challenge 3: Inyección de Tokens Inválidos / Errores de Conexión
- **Hipótesis desafiada:** "Si el token proporcionado por el usuario es inválido, el sistema notifica el fallo al caller".
- **Escenario de Ataque:** Ejecución con token corrupto (`-Token "dummy_token"`).
- **Resultado:** `cloudflared` reporta `Provided Tunnel token is not valid.`, pero el proceso PowerShell finaliza con exit code `0`.
- **Blast Radius:** Scripts superiores (como launchers o scripts de chequeo) asumen éxito cuando en realidad el túnel falló.
- **Mitigación:** Propagar exit code no nulo.

---

## Integrity Audit

- **Hardcoded test results:** Ninguno detectado.
- **Dummy or facade implementations:** Ninguno. La integración con `cloudflared.exe`, las descargas desde GitHub y las llamadas a `sc.exe`, `net.exe` y `Start-Process` son genuinas y operativas.
- **Shortcuts que evitan la tarea:** Ninguno.
- **Salidas o logs fabricados:** Ninguno.
- **Autocertificación sin pruebas reales:** Las pruebas de Worker M2 fueron reales, pero omitieron la prueba del flujo UAC no elevado y la combinación `-NonInteractive` sin token, las cuales fueron descubiertas mediante este análisis adversarial independiente.

---

## 3. Caveats

- **Prueba con credenciales reales de Cloudflare Zero Trust:** Se validó la interacción de `cloudflared` hasta el punto de autenticación con el edge. Una prueba conectada de extremo a extremo requerirá que el usuario final ingrese su token real generado en su cuenta de Zero Trust siguiendo `docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md`.

---

## 4. Conclusion

1. **Milestone M1 (`docs/GUIA-DOMINIO-CLOUDFLARE-TUNNEL.md`)**: Se encuentra completamente aprobado (**APPROVE**). La guía es exhaustiva, clara y cubre con exactitud el 100% de los requerimientos.
2. **Milestone M2 (`scripts/setup-cloudflare-tunnel.ps1` y `CONFIGURAR_TUNEL_CLOUDFLARE.bat`)**: Requiere ajustes (**REQUEST_CHANGES**) debido a los Findings 1 y 2 (elevación UAC fallida por ámbito de variable en funciones, y bloqueo en `Read-Host` en modo desatendido).
3. Una vez corregidas estas dos líneas en `scripts/setup-cloudflare-tunnel.ps1`, ambos hitos estarán en estado óptimo para producción.

---

## 5. Verification Method

Para verificar independientemente la presencia de los fallos y validar las futuras correcciones:

1. **Reproducir el error de elevación UAC (Finding 1):**
   ```powershell
   powershell.exe -NoProfile -Command "& { function Test-Inv { Write-Host ('Path=' + $MyInvocation.MyCommand.Path); Write-Host ('PSCommandPath=' + $PSCommandPath) }; Test-Inv }"
   ```
   *Observación esperada:* `Path=` está vacío, mientras que `PSCommandPath=` contiene la ruta válida del script.

2. **Reproducir el cuelgue en modo desatendido (Finding 2):**
   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-cloudflare-tunnel.ps1" -Action run -NonInteractive
   ```
   *Comportamiento actual defectuoso:* Queda bloqueado en `Read-Host`.  
   *Comportamiento esperado tras el fix:* Debe emitir un error indicando que `-Token` es obligatorio en modo `-NonInteractive` y salir inmediatamente con código 1.

3. **Verificar análisis sintáctico:**
   ```powershell
   powershell.exe -NoProfile -Command "$errs = $null; [System.Management.Automation.Language.Parser]::ParseFile('c:\Users\Lenovo\Desktop\floreria\scripts\setup-cloudflare-tunnel.ps1', [ref]$null, [ref]$errs); if ($errs.Count -eq 0) { Write-Host 'PASS: Syntax OK' } else { Write-Host 'FAIL' }"
   ```
   *Salida esperada:* `PASS: Syntax OK`.
