# Guía Completa de Configuración: Dominio Propio, Cloudflare Tunnel y Webhooks de Meta

**Proyecto:** Florería Farfalina & Carissma Vestidos  
**Entorno:** Windows Local + Cloudflare Zero Trust (100% Gratuito, Sin VPS, Sin Abrir Puertos)  
**Versión:** 1.0 (Producción)  
**Fecha:** Octubre 2026  

---

## 📋 Tabla de Contenidos

1. [Arquitectura General y Beneficios](#1-arquitectura-general-y-beneficios)
2. [Prerrequisitos del Sistema](#2-prerrequisitos-del-sistema)
3. [Paso 1: Añadir Dominio a Cloudflare Free](#paso-1-añadir-el-dominio-propio-a-cloudflare-free)
4. [Paso 2: Delegación de Nameservers (DNS) por Registrador](#paso-2-cambio-y-delegación-de-nameservers-dns)
   - [2.1 GoDaddy](#21-godaddy)
   - [2.2 Namecheap](#22-namecheap)
   - [2.3 Hostinger](#23-hostinger)
   - [2.4 DonWeb y Otros Registradores](#24-donweb-y-otros-registradores-ferozo-nic)
   - [2.5 Tiempos de Propagación y Verificación](#25-tiempos-de-propagación-y-verificación)
5. [Paso 3: Configuración de Seguridad y SSL/TLS en Cloudflare](#paso-3-configuración-de-seguridad-y-ssltls-en-cloudflare)
6. [Paso 4: Creación del Túnel en Cloudflare Zero Trust](#paso-4-creación-del-túnel-en-cloudflare-zero-trust)
   - [4.1 Acceso al Dashboard de Zero Trust](#41-acceso-al-dashboard-de-zero-trust)
   - [4.2 Creación del Túnel y Obtención del Token](#42-creación-del-túnel-y-obtención-del-tunnel-token)
   - [4.3 Configuración de Public Hostname (Subdominio Local)](#43-configuración-de-public-hostname)
   - [4.4 Registro CNAME Proxied Automático](#44-explicación-del-registro-cname-proxied-automático)
7. [Paso 5: Verificación del Túnel HTTPS desde el Exterior](#paso-5-verificación-del-túnel-público-https)
8. [Paso 6: Configuración de Webhooks en Meta for Developers](#paso-6-configuración-de-webhooks-en-meta-developers)
   - [6.1 URLs de Retorno (Callback URLs)](#61-urls-de-retorno-callback-urls)
   - [6.2 Token de Verificación (Verify Token)](#62-token-de-verificación-verify-token)
   - [6.3 Campos de Suscripción Recomendados](#63-campos-de-suscripción-recomendados)
   - [6.4 Procedimiento en el Panel de Meta Developers](#64-procedimiento-paso-a-paso-en-meta-developers)
9. [Solución de Problemas (Troubleshooting)](#9-solución-de-problemas-troubleshooting)
   - [Error 502 Bad Gateway](#91-error-502-bad-gateway)
   - [Error 1033 Cloudflare Tunnel Error](#92-error-1033-cloudflare-tunnel-error)
   - [Retardo en Propagación DNS](#93-retardo-en-propagación-dns)
   - [Bucle de Redirección SSL (ERR_TOO_MANY_REDIRECTS)](#94-bucle-de-redirección-ssl-err_too_many_redirects)
   - [Bloqueo de Protocolo QUIC / UDP 7844](#95-bloqueo-de-protocolo-quic--udp-7844-por-el-isp-o-firewall)

---

## 1. Arquitectura General y Beneficios

La solución implementada conecta el sistema de gestión y punto de venta local de **Florería Farfalina & Carissma** con la red global de Cloudflare y los servidores de Meta (WhatsApp Cloud API, Facebook Messenger e Instagram Direct) **sin necesidad de contratar servidores VPS, sin pagar licencias de túneles comerciales (como ngrok) y sin abrir puertos en el módem/router**.

```
  ┌─────────────────────────────────────────────────────────────┐
  │                 USUARIOS Y SERVIDORES DE META               │
  │     (WhatsApp Webhooks / Clientes / Navegadores Web)        │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ HTTPS (Puerto 443 estándar)
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 CLOUDFLARE EDGE NETWORK                     │
  │  - Dominio Propio: omnichannel.tudominio.com                │
  │  - Certificado SSL Universal Gratuito                       │
  │  - Mitigación DDoS y WAF perimetral                         │
  │  - Enrutamiento Zero Trust Argo Tunnel                      │
  └──────────────────────────────┬──────────────────────────────┘
                                 │ Conexión Saliente Cifrada
                                 │ (QUIC / HTTP2 - Sin puertos entrantes)
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │              MÁQUINA LOCAL WINDOWS (PC / CAJA)              │
  │                                                             │
  │  ┌───────────────────────┐       ┌───────────────────────┐  │
  │  │   cloudflared.exe     │ HTTP  │  Next.js 14 App Router│  │
  │  │ (Servicio de Windows) ├──────►│   http://localhost:3000│  │
  │  │   Túnel Zero Trust    │       │     Florería POS      │  │
  │  └───────────────────────┘       └───────────────────────┘  │
  └─────────────────────────────────────────────────────────────┘
```

### Ventajas Clave:
1. **Costo Cero ($0 USD/mes):** Tanto la cuenta Cloudflare Free como Cloudflare Zero Trust Tunnels (hasta 50 usuarios) son completamente gratuitos.
2. **Seguridad Total:** No se expone la dirección IP pública real de la florería ni se requiere DMZ ni apertura de puertos NAT (Port Forwarding).
3. **Certificado SSL Válido:** Meta Developers exige HTTPS con certificados emitidos por una autoridad certificadora reconocida. Cloudflare provee y renueva automáticamente estos certificados.
4. **Persistencia Automática:** Al configurarse como servicio de Windows, el túnel arranca silenciosamente al encender la computadora sin intervención humana.

---

## 2. Prerrequisitos del Sistema

Antes de iniciar la configuración, asegúrate de contar con los siguientes elementos:

1. **Dominio Propio Activo:**
   - Un dominio registrado en cualquier registrador comercial (ej. `midominio.com`, `farfalina.bo`, `carissma.com`).
   - Acceso con credenciales de administrador al panel de control del registrador (GoDaddy, Namecheap, Hostinger, DonWeb, etc.).
2. **Cuenta Gratuita en Cloudflare:**
   - Registro activo en [dash.cloudflare.com](https://dash.cloudflare.com/). No se requiere ingresar tarjeta de crédito para el plan Free.
3. **Computadora con Windows 10 u 11 (64 bits):**
   - Cuenta de usuario con permisos de Administrador para registrar servicios del sistema.
   - Conexión a internet estable.
4. **Servidor Next.js del Proyecto:**
   - Node.js versión LTS instalada (v18.x, v20.x o superior).
   - El proyecto `floreria` corriendo localmente en el puerto `3000` (`http://localhost:3000`).

---

## Paso 1: Añadir el Dominio Propio a Cloudflare Free

Cloudflare actúa como servidor autoritativo de DNS y capa de seguridad para todo el dominio. Sigue estos pasos para darlo de alta:

1. **Iniciar Sesión:** Accede a [dash.cloudflare.com](https://dash.cloudflare.com/).
2. **Agregar Sitio:** En la pantalla principal o menú superior, haz clic en **Add a site** (o *Agregar un sitio*).
3. **Ingresar el Dominio Raíz:**
   - Escribe el dominio apex adquirido (por ejemplo: `midominio.com` o `farfalina.bo`).
   - ⚠️ **Importante:** No agregues `www.` ni subdominios en este paso (Cloudflare requiere el dominio raíz para gestionar la zona completa).
4. **Seleccionar Plan Gratuito:**
   - Desplázate hacia el final de la página de planes y selecciona la opción **Free** ($0 / mes).
   - Haz clic en **Continue** (Continuar).
5. **Escaneo de Registros DNS Existentes:**
   - Cloudflare escaneará automáticamente la zona DNS actual buscando registros `A`, `MX`, `TXT` y `CNAME`.
   - **Verificación:** Si el dominio ya tiene correos corporativos configurados (como Google Workspace, Microsoft 365, Titan Mail o cPanel), revisa que los registros de tipo `MX` figuren en la lista para no interrumpir el correo. Si falta alguno, agrégalo manualmente.
   - Haz clic en **Continue**.
6. **Obtención de Nameservers Asignados:**
   - Cloudflare presentará la pantalla de delegación con dos datos esenciales:
     - **Nameservers actuales a quitar** (los que tiene tu registrador actual).
     - **Nameservers de Cloudflare a colocar** (ejemplo habitual: `aria.ns.cloudflare.com` y `noah.ns.cloudflare.com` — el par exacto se genera específicamente para tu cuenta).
   - **Copia o anota ambos nombres de servidor de Cloudflare**.

---

## Paso 2: Cambio y Delegación de Nameservers (DNS)

Para que Cloudflare tome el control del enrutamiento y la seguridad de tu dominio, debes sustituir los servidores DNS del registrador por los provistos por Cloudflare.

### 2.1 GoDaddy
1. Inicia sesión en tu cuenta de [GoDaddy](https://www.godaddy.com/).
2. Ve a **Mis Productos** (My Products) > Ubica tu dominio > Haz clic en **DNS** o **Administrar DNS**.
3. En la sección **Servidores de nombres** (Nameservers), haz clic en **Cambiar servidores de nombres** (Change Nameservers).
4. Selecciona la opción **Usar mis propios servidores de nombres** (*I'll use my own nameservers - Avanzado*).
5. Elimina los servidores existentes de GoDaddy e ingresa los dos Nameservers asignados por Cloudflare.
6. Haz clic en **Guardar** (Save). Si GoDaddy solicita verificación de seguridad (código por correo o SMS), autorízalo.

### 2.2 Namecheap
1. Inicia sesión en [Namecheap](https://www.namecheap.com/).
2. En el panel izquierdo, haz clic en **Domain List**.
3. Busca tu dominio y presiona el botón **Manage** a la derecha.
4. En la pestaña **Domain**, localiza la sección **NAMESERVERS**.
5. Cambia el selector desplegable de *Namecheap BasicDNS* a **Custom DNS**.
6. Introduce en *Nameserver 1* y *Nameserver 2* los servidores de Cloudflare.
7. Haz clic en la marca verde de verificación (**✓**) en la esquina superior derecha para guardar.

### 2.3 Hostinger
1. Inicia sesión en [Hostinger hPanel](https://hpanel.hostinger.com/).
2. En el menú superior o lateral, ve a **Dominios** (Domains) y selecciona tu dominio.
3. En el menú izquierdo, haz clic en **DNS / Servidores de nombres**.
4. Haz clic en el botón **Cambiar servidores de nombres** (Change nameservers).
5. Marca la casilla **Cambiar los servidores de nombres manualmente**.
6. Sustituye los valores existentes (`ns1.dns-parking.com`, `ns2.dns-parking.com`) por los dos nameservers de Cloudflare.
7. Haz clic en **Guardar**.

### 2.4 DonWeb y Otros Registradores (Ferozo, NIC)
1. Ingresa al panel de control de tu registrador (DonWeb, Nic.ar, Nic.bo, etc.).
2. Accede a la sección de **Dominios** > **Delegar Dominio** / **Servidores DNS**.
3. Reemplaza los servidores actuales por los dos provistos por Cloudflare (deja vacíos los campos de IP o Glue Records si no son requeridos).
4. Confirma la operación.

### 2.5 Tiempos de Propagación y Verificación
- **Tiempo estimado:** La actualización a nivel de DNS raíz global suele tomar entre **5 minutos y 2 horas** (el plazo máximo teórico según el estándar DNS es de hasta 24 a 48 horas).
- **Comprobación en Cloudflare:** Vuelve a la pestaña de Cloudflare y presiona **Check nameservers now** (Verificar servidores de nombres ahora).
- Cuando la delegación sea exitosa, el estado del dominio cambiará de *Pending Nameserver Update* a **Active** con un icono de verificación verde.
- Puedes verificar la propagación pública en cualquier momento usando herramientas online como [dnschecker.org](https://dnschecker.org/#NS/) buscando el registro `NS` de tu dominio.

---

## Paso 3: Configuración de Seguridad y SSL/TLS en Cloudflare

Para garantizar que Meta y los navegadores web confíen al 100% en la conexión HTTPS, aplica los siguientes ajustes en el panel de Cloudflare:

1. **Ingresar a la Configuración SSL/TLS:**
   - En el panel del dominio dentro de Cloudflare, ve al menú lateral izquierdo > **SSL/TLS** > **Overview**.
2. **Modo de Encriptación Recomendado:**
   - Selecciona **Full** (o **Flexible** si tu origen local solo maneja HTTP simple).
   - 💡 *Nota técnica:* Al usar Cloudflare Zero Trust Tunnel, la comunicación entre la máquina local y el edge de Cloudflare está completamente cifrada por el túnel autenticado (`cloudflared`). El modo **Full** o **Flexible** en el panel asegura que los clientes externos siempre establezcan conexiones HTTPS válidas con el certificado Edge de Cloudflare.
3. **Forzar Redirección HTTPS Automática:**
   - Ve a **SSL/TLS** > **Edge Certificates** (Certificados perimetrales).
   - Activa el interruptor **Always Use HTTPS** (Siempre usar HTTPS). Esto convierte automáticamente cualquier visita `http://` en `https://`.
   - Verifica que **Automatic HTTPS Rewrites** esté activado.
   - Verifica que **Universal SSL** se encuentre en estado **Active** (proporciona cobertura para `tudominio.com` y `*.tudominio.com`).

---

## Paso 4: Creación del Túnel en Cloudflare Zero Trust

Cloudflare Zero Trust Tunnel (anteriormente conocido como Argo Tunnel) permite exponer un servicio local hacia un subdominio público mediante un conector saliente cifrado (`cloudflared`).

### 4.1 Acceso al Dashboard de Zero Trust
1. En el panel principal de Cloudflare, haz clic en el menú lateral en **Zero Trust** (o ingresa directamente a [one.dash.cloudflare.com](https://one.dash.cloudflare.com/)).
2. *Configuración inicial (solo primera vez):*
   - Si nunca habías ingresado, te solicitará elegir un **Team Name** (nombre de organización, por ejemplo: `farfalina-carissma`).
   - Elige el plan **Free** ($0, incluye hasta 50 usuarios). No requiere tarjeta.

### 4.2 Creación del Túnel y Obtención del Tunnel Token
1. En el menú lateral de Zero Trust, dirígete a **Networks** > **Tunnels** (en algunas versiones del panel: *Access* > *Tunnels*).
2. Haz clic en el botón azul **Create a tunnel** (o *Add a tunnel*).
3. **Tipo de Conector:** Selecciona **Cloudflare** (conector administrado) y presiona **Next**.
4. **Nombre del Túnel:** Asígnale un nombre descriptivo, por ejemplo:
   ```text
   farfalina-omnichannel-tunnel
   ```
5. Presiona **Save tunnel**.
6. **Selección de Entorno Operativo:**
   - En la sección *Install and run a connector*, selecciona la pestaña **Windows** (64-bit).
   - Aparecerá un bloque de comandos que contiene el parámetro `--token` seguido de una cadena larga codificada en Base64 (que empieza típicamente con `eyJh...`).
   - **Copia y guarda este TOKEN del túnel**. Este token es la credencial única que vincula tu máquina local con la red de Cloudflare.

### 4.3 Configuración de Public Hostname
Haz clic en **Next** (o ve a la pestaña **Public Hostname** del túnel recién creado) y completa los campos exactamente como sigue:

| Campo | Valor Recomendado | Explicación |
|---|---|---|
| **Subdomain** | `omnichannel` (o `api`) | El prefijo del subdominio público donde responderá el sistema. |
| **Domain** | `tudominio.com` | Selecciona en la lista desplegable tu dominio propio añadido en el Paso 1. |
| **Path** | *(Dejar vacío)* | Cubre todas las rutas raíz y de API (`/`, `/api/webhooks/*`, etc.). |
| **Type** | `HTTP` | Tipo de protocolo hacia el servicio local. |
| **URL** | `localhost:3000` | Puerto donde corre el servidor Next.js localmente en Windows. |

*Ejemplo resultante del Hostname público:*
```text
https://omnichannel.tudominio.com
```

Presiona **Save hostname**.

### 4.4 Explicación del Registro CNAME Proxied Automático
Al guardar el Public Hostname, Cloudflare realiza una acción automática e instantánea en tu zona DNS:
- Crea un registro DNS de tipo `CNAME`:
  ```text
  omnichannel.tudominio.com  CNAME  <UUID-DE-TU-TUNEL>.cfargotunnel.com
  ```
- Este registro cuenta con la nube naranja de **Proxy activo** (Proxied).
- **¿Qué significa esto?** Cualquier visitante o servidor de Meta que acceda a `https://omnichannel.tudominio.com` se conecta a los centros de datos perimetrales de Cloudflare con SSL de alta velocidad, y Cloudflare redirige ese tráfico hacia tu computadora a través de `cloudflared.exe`.

---

## Paso 5: Verificación del Túnel Público HTTPS

Una vez que el túnel esté iniciado en tu máquina local (usando el script provisto en el proyecto `CONFIGURAR_TUNEL_CLOUDFLARE.bat` o el script de PowerShell `scripts/setup-cloudflare-tunnel.ps1`), verifica que el servicio responda públicamente:

### 5.1 Comprobación en el Panel de Cloudflare
1. En Zero Trust > **Networks** > **Tunnels**, ubica tu túnel.
2. La columna **Status** debe mostrar **HEALTHY** con un punto verde y registrar al menos 1 o 2 conectores activos.

### 5.2 Comprobación desde el Navegador o Celular
1. Conéctate desde una red externa (por ejemplo, desde el navegador de un celular con datos móviles 4G/5G, fuera de la red WiFi local).
2. Ingresa a la URL de tu subdominio:
   ```text
   https://omnichannel.tudominio.com
   ```
3. Debes observar que el navegador muestra el **candado de seguridad HTTPS válido** y carga la interfaz del catálogo de florería (`/floreria/catalog`) o la pantalla de inicio del sistema.

### 5.3 Comprobación por Consola (cURL / PowerShell)
Ejecuta en tu terminal el siguiente comando apuntando a tu subdominio público:

```powershell
curl.exe -I https://omnichannel.tudominio.com
```

*Respuesta esperada:*
```http
HTTP/2 307
date: ...
location: /floreria/catalog
server: cloudflare
...
```
*(El código 307 confirma que Next.js recibió la petición y está respondiendo con la redirección inicial de catálogo).*

---

## Paso 6: Configuración de Webhooks en Meta Developers

Meta requiere que registres tu URL pública HTTPS y verifiques la propiedad del webhook mediante un desafío criptográfico simple (*handshake GET*).

### 6.1 URLs de Retorno (Callback URLs)
Dependiendo de qué canal de mensajería estés configurando en Meta for Developers, dispones de tres endpoints independientes y optimizados:

| Canal de Comunicación | Callback URL a Ingresar en Meta |
|---|---|
| **WhatsApp Cloud API** | `https://omnichannel.tudominio.com/api/webhooks/whatsapp` |
| **Facebook Messenger** | `https://omnichannel.tudominio.com/api/webhooks/facebook` |
| **Instagram Direct** | `https://omnichannel.tudominio.com/api/webhooks/instagram` |

### 6.2 Token de Verificación (Verify Token)
Meta solicita un **Verify Token** arbitrario para corroborar que tu servidor autoriza la suscripción. El sistema tiene configurada la siguiente jerarquía:

1. **Token por Defecto (Listo para usar sin configuración extra):**
   ```text
   farfalina_carissma_webhook_verify_token_2026
   ```
2. **Variable de Entorno Personalizada (Opcional):**
   Si deseas utilizar un token secreto personalizado, puedes definirlo en tu archivo `.env.local` en la raíz del proyecto:
   ```env
   META_VERIFY_TOKEN=mi_token_secreto_personalizado_2026
   ```
   *(El endpoint automáticamente prioriza `META_VERIFY_TOKEN`; si no está definida, utiliza el token por defecto).*

### 6.3 Campos de Suscripción Recomendados
Para recibir mensajes, estados de entrega y eventos multimedia de los clientes en tiempo real, suscríbete a los siguientes campos en Meta Developers:

#### Para WhatsApp Cloud API:
- `messages` *(Esencial: mensajes entrantes de texto, audio, imagen, documentos y botones).*
- `message_deliveries` *(Opcional: confirmaciones de entrega y doble check).*
- `message_reads` *(Opcional: confirmaciones de lectura).*

#### Para Facebook Messenger / Instagram Direct:
- `messages` *(Esencial: mensajes enviados por los clientes).*
- `messaging_postbacks` *(Esencial: clics en botones de plantillas y menú persistente).*
- `messaging_optins` *(Opcional: suscripciones y botones web).*

### 6.4 Procedimiento Paso a Paso en Meta Developers
1. Ingresa a [developers.facebook.com](https://developers.facebook.com/) e inicia sesión.
2. Selecciona tu aplicación en **Mis Apps** (My Apps).
3. **Para WhatsApp:**
   - En el menú lateral, dirígete a **WhatsApp** > **Configuración** (Configuration).
   - En la sección **Webhook**, haz clic en el botón **Editar** (Edit).
   - En **URL de devolución de llamada** (Callback URL), pega:
     ```text
     https://omnichannel.tudominio.com/api/webhooks/whatsapp
     ```
   - En **Identificador de verificación** (Verify Token), pega:
     ```text
     farfalina_carissma_webhook_verify_token_2026
     ```
   - Haz clic en **Verificar y Guardar** (Verify and Save).
   - Meta enviará una solicitud `GET` instantánea a tu servidor a través del túnel Cloudflare. Si el servidor y el túnel están encendidos, el modal se cerrará con éxito y mostrará un círculo verde.
   - En **Campos de webhook**, haz clic en **Administrar** (Manage) y pulsa **Suscribirse** (Subscribe) al campo `messages`.
4. **Para Messenger o Instagram:**
   - En el menú lateral, ve a **Webhooks**.
   - En el desplegable superior, selecciona **Instagram** o **Page** (Página de Facebook).
   - Haz clic en **Suscribirse a este objeto**.
   - Ingresa la Callback URL correspondiente (`/api/webhooks/facebook` o `/api/webhooks/instagram`) y el mismo Verify Token.
   - Presiona **Verificar y Guardar** y suscríbete al campo `messages`.

---

## 9. Solución de Problemas (Troubleshooting)

A continuación se detallan las causas raíces y soluciones exactas para los incidentes más frecuentes:

### 9.1 Error 502 Bad Gateway
```text
HTTP 502 Bad Gateway (Cloudflare Edge)
Host Error: Unable to reach the origin web server
```
- **Causa Raíz:** El túnel `cloudflared` está conectado exitosamente a Cloudflare, pero el servidor local de Next.js **no está corriendo** en `http://localhost:3000` o fue apagado.
- **Diagnóstico:**
  1. Abre el navegador local en la PC y navega a `http://localhost:3000`.
  2. Si el navegador indica *No se puede conectar*, Next.js está detenido.
- **Solución:**
  1. Ejecuta el lanzador del sistema haciendo doble clic en `start-system.bat` en la raíz del proyecto.
  2. O inicia manualmente en terminal con:
     ```powershell
     npm run start
     ```
     *(Si no has compilado el proyecto previamente, usa `npm run dev`)*.

---

### 9.2 Error 1033 Cloudflare Tunnel Error
```text
Error 1033: Argo Tunnel error
Could not connect to the cloudflared process
```
- **Causa Raíz:** Cloudflare no encuentra un conector `cloudflared` activo en tu computadora. El servicio de Windows está detenido o el proceso se cerró.
- **Diagnóstico:**
  Abre una consola de PowerShell como Administrador y consulta el estado del servicio:
  ```powershell
  sc.exe query cloudflared
  ```
- **Solución:**
  1. Si el estado es `STOPPED`, inicia el servicio:
     ```powershell
     net start cloudflared
     ```
  2. Si el servicio no existe o el token cambió, ejecuta el configurador automático:
     - Haz clic derecho sobre `CONFIGURAR_TUNEL_CLOUDFLARE.bat` y selecciona **Ejecutar como administrador**.
     - Ingresa nuevamente tu Token de Cloudflare Zero Trust.

---

### 9.3 Retardo en Propagación DNS
```text
ERR_NAME_NOT_RESOLVED o Cloudflare muestra "Pending Nameserver Update"
```
- **Causa Raíz:** Los servidores raíz globales de internet aún almacenan en caché los servidores DNS anteriores del registrador debido al TTL (*Time to Live*).
- **Diagnóstico:**
  Ejecuta en consola para consultar qué Nameservers están respondiendo:
  ```powershell
  nslookup -type=NS tudominio.com 8.8.8.8
  ```
- **Solución:**
  1. Espera entre 10 y 30 minutos a que expire el TTL anterior.
  2. Vacía la caché DNS local en Windows ejecutando:
     ```cmd
     ipconfig /flushdns
     ```
  3. En Cloudflare, presiona periódicamente el botón **Check nameservers now**.

---

### 9.4 Bucle de Redirección SSL (`ERR_TOO_MANY_REDIRECTS`)
```text
Esta página no funciona. omnichannel.tudominio.com te redirigió demasiadas veces.
```
- **Causa Raíz:** Ocurre cuando el modo SSL en Cloudflare está configurado en **Flexible** y una regla en Next.js fuerza redirecciones HTTPS internas sobre solicitudes que el túnel entrega como HTTP local.
- **Solución:**
  1. En el panel de Cloudflare, ve a **SSL/TLS** > **Overview**.
  2. Cambia el modo de encriptación a **Full**.
  3. En **Networks** > **Tunnels** > Tu Túnel > **Public Hostname**, asegúrate de que el tipo de servicio sea `HTTP` hacia `localhost:3000` (no `HTTPS://localhost:3000`, a menos que Next.js tenga certificados SSL locales configurados).

---

### 9.5 Bloqueo de Protocolo QUIC / UDP 7844 por el ISP o Firewall
```text
cloudflared logs: "quic: timeout waiting for initial handshake"
```
- **Causa Raíz:** Algunos proveedores de internet (ISP) o routers comerciales bloquean o ralentizan el tráfico saliente por protocolo QUIC (puerto UDP 7844).
- **Diagnóstico:**
  El servicio de túnel tarda minutos en conectar o se desconecta repetidamente.
- **Solución:**
  Forzar el protocolo **HTTP/2 sobre TCP** (puerto estándar 443 saliente, nunca bloqueado):
  1. En la línea de comandos o servicio de `cloudflared`, agrega el flag `--protocol http2`:
     ```powershell
     cloudflared.exe tunnel run --protocol http2 --token <TU_TOKEN>
     ```
  2. Esta opción garantiza conectividad fluida en cualquier red corporativa o módem hogareño.

---

## 📌 Resumen de Rutas y Tokens Rápidos

Guarda estos valores a mano al realizar el alta en Meta Developers:

```text
Dominio Base:        https://omnichannel.tudominio.com
Webhook WhatsApp:    https://omnichannel.tudominio.com/api/webhooks/whatsapp
Webhook Facebook:    https://omnichannel.tudominio.com/api/webhooks/facebook
Webhook Instagram:   https://omnichannel.tudominio.com/api/webhooks/instagram

Verify Token:        farfalina_carissma_webhook_verify_token_2026
Puerto Local:        3000
```
