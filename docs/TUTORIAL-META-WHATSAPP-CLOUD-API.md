# Guía Oficial: Configuración de Meta WhatsApp Cloud API v22.0
## Florería Farfalina & Alquileres Carissma

Esta guía detalla paso a paso cómo obtener las credenciales oficiales de **Meta WhatsApp Cloud API (Graph API v22.0)**, generar un **Token Permanente de Usuario del Sistema (System User Token)** que nunca expira, configurar los **Webhooks en Meta for Developers** y activar el soporte **Multi-inquilino** para Farfalina y Carissma.

---

## 1. Beneficios de Meta WhatsApp Cloud API frente a WhatsApp Web

| Característica | WhatsApp Web (Socket QR) | Meta WhatsApp Cloud API (Oficial) |
|---|---|---|
| **Estabilidad** | Puede desconectarse si el teléfono pierde batería | 100% en la nube de Meta, disponibilidad 24/7 |
| **Consumo de Servidor** | Requiere Chromium / Puppeteer en RAM | Conexión HTTP nativa ultraligera |
| **Multi-inquilino** | Requiere sesiones separadas en disco | Enrutamiento automático por Phone ID / WABA ID |
| **Límite de Envío** | Riesgo de baneo por spam en líneas personales | API oficial certificada por Meta |
| **Multimedia** | Conversión local en base64 | Almacenamiento y entrega directa en CDN de Meta |

---

## 2. Requisitos Previos

1. Una cuenta de Facebook Business en [Meta Business Suite](https://business.facebook.com/).
2. Acceso como Administrador del portafolio comercial de la empresa.
3. Un número de teléfono que no esté actualmente registrado en la app de WhatsApp estándar (o usar el número de prueba gratuito proporcionado por Meta).

---

## 3. Paso 1: Crear la Aplicación en Meta for Developers

1. Ingresa a [Meta for Developers](https://developers.facebook.com/) e inicia sesión.
2. En la barra superior, haz clic en **Mis Apps** (My Apps) > **Crear app** (Create App).
3. Selecciona el caso de uso: **Otro** (Other) > Haz clic en **Siguiente**.
4. Selecciona el tipo de app: **Negocios** (Business) > Haz clic en **Siguiente**.
5. Asigna los datos básicos:
   - **Nombre de la app:** `Farfalina & Carissma Omnicanal`
   - **Correo electrónico de contacto:** tu correo corporativo.
   - **Cuenta de Business Manager:** selecciona la cuenta comercial de Farfalina/Carissma.
6. Haz clic en **Crear app**.

---

## 4. Paso 2: Agregar el Producto WhatsApp

1. En el panel de control de tu aplicación recién creada, desplázate hasta encontrar **WhatsApp**.
2. Haz clic en **Configurar** (Set up).
3. Selecciona o confirma tu cuenta de Meta Business.
4. En el menú lateral izquierdo, ve a **WhatsApp** > **Primeros pasos** (API Setup / Getting Started).
5. En esta pantalla verás:
   - **Identificador de número de teléfono (Phone Number ID):** Un número de ~15 dígitos (Ej: `109283746501928`). **¡Cópialo!**
   - **Identificador de cuenta de WhatsApp Business (WABA ID):** Un número de ~15 dígitos (Ej: `102938475610293`). **¡Cópialo!**
   - **Token temporal:** Válido solo por 24 horas (no lo uses en producción, en el Paso 3 generaremos el definitivo).

---

## 5. Paso 3: Generar el Token Permanente (System User Token)

> [!IMPORTANT]
> El token que aparece en "Primeros pasos" expira en 24 horas. Para producción continua sin caídas, debes generar un **System User Token** sin fecha de caducidad.

1. Ve a [Meta Business Suite - Configuración del Negocio](https://business.facebook.com/settings).
2. En el menú lateral izquierdo, navega a **Usuarios** (Users) > **Usuarios del sistema** (System Users).
3. Haz clic en el botón azul **Agregar** (Add):
   - **Nombre del usuario del sistema:** `Farfalina-Bot-Produccion`
   - **Rol del usuario del sistema:** `Administrador` (Admin)
   - Haz clic en **Crear usuario del sistema**.
4. Selecciona al usuario recién creado y haz clic en **Asignar activos** (Assign Assets):
   - Ve a **Apps**: Marca tu aplicación `Farfalina & Carissma Omnicanal` y activa **Control total (Administrar app)**.
   - Ve a **Cuentas de WhatsApp**: Marca tu cuenta comercial y activa **Control total (Administrar cuenta de WhatsApp)**.
   - Haz clic en **Guardar cambios**.
5. Ahora haz clic en el botón **Generar nuevo token** (Generate New Token):
   - **App:** Selecciona `Farfalina & Carissma Omnicanal`.
   - **Caducidad del token (Token expiration):** Selecciona **Nunca** (Never).
   - **Permisos requeridos (Permissions):** Marca obligatoriamente las siguientes dos casillas:
     - [x] `whatsapp_business_messaging`
     - [x] `whatsapp_business_management`
6. Haz clic en **Generar token**.
7. Aparecerá una ventana con tu token permanente (`EAAG...`). **Cópialo y guárdalo en un lugar seguro**; Meta no volverá a mostrarlo.

---

## 6. Paso 4: Configurar el Webhook en Meta for Developers

El Webhook permite que cuando un cliente escriba a tu WhatsApp, Meta envíe inmediatamente el mensaje a tu servidor de Florería Farfalina y Alquileres Carissma.

1. Regresa a [Meta for Developers](https://developers.facebook.com/apps/) y abre tu app.
2. En el menú lateral izquierdo, ve a **WhatsApp** > **Configuración** (Configuration).
3. En la sección **Webhook**, haz clic en **Editar** (Edit):
   - **URL de devolución de llamada (Callback URL):**
     ```text
     https://api.farfalina.bo/api/webhooks/whatsapp
     ```
     *(O si usas túnel local o VPS: `https://tu-dominio.com/api/webhooks/whatsapp`)*
   - **Token de verificación (Verify Token):**
     ```text
     farfalina_carissma_webhook_verify_token_2026
     ```
     *(O el valor configurado en tu archivo `.env` en la variable `META_VERIFY_TOKEN`)*
4. Haz clic en **Verificar y guardar** (Verify and Save). Meta enviará un GET de verificación; el sistema responderá `200 OK` de forma instantánea.
5. Una vez guardado, en la misma sección de Webhook, haz clic en **Administrar** (Manage) debajo de **Campos del webhook**:
   - Busca el campo llamado **`messages`**.
   - Haz clic en **Suscribirse** (Subscribe).
   - Verifica que el estado cambie a `Suscrito` (Subscribed).

---

## 7. Paso 5: Ingresar las Credenciales en el Sistema

1. Abre el sistema de **Florería Farfalina** o **Alquileres Carissma** en tu navegador.
2. Ve al módulo **Chat Omnicanal** en la barra lateral.
3. Haz clic en el botón **Configuración** (icono de engranaje ⚙️) en la parte superior derecha de la bandeja.
4. En la pestaña **WhatsApp Business**, asegúrate de que esté seleccionada la opción **Meta Cloud API (Oficial Meta v22.0)**.
5. Pega los datos obtenidos:
   - **Phone Number ID:** (Ej: `109283746501928`)
   - **WABA ID:** (Ej: `102938475610293`)
   - **System User Permanent Access Token:** (El token `EAAG...` generado en el Paso 3)
   - **Número visible de WhatsApp:** (Ej: `+591 70000000`)
6. Haz clic en **Guardar Credenciales Cloud**.
7. El indicador cambiará inmediatamente a **CONECTADO A META**.

---

## 8. Soporte Multi-Inquilino (Farfalina y Carissma)

El sistema soporta aislamiento completo entre ambas marcas:

### Opción A: Una sola App con dos números de WhatsApp
Si en tu cuenta de WhatsApp Business tienes dos líneas telefónicas (por ejemplo, una para Farfalina Flores y otra para Carissma Vestidos):
1. Obtén el **Phone Number ID** de la línea 1 y configúralo en el workspace de Farfalina.
2. Obtén el **Phone Number ID** de la línea 2 y configúralo en el workspace de Carissma.
3. El webhook único `/api/webhooks/whatsapp` detectará automáticamente a qué Phone Number ID llegó el mensaje y lo enrutará al chat de Farfalina o al de Carissma según corresponda.

### Opción B: URLs dedicadas por parámetro de consulta
Si deseas asignar webhooks explícitos:
- Para Farfalina: `https://api.farfalina.bo/api/webhooks/whatsapp?env=farfalina`
- Para Carissma: `https://api.farfalina.bo/api/webhooks/whatsapp?env=carissma`

---

## 9. Variables de Entorno Recomendadas (`.env`)

Para mayor seguridad y personalización opcional, puedes agregar estas variables en tu archivo `.env`:

```env
# Token secreto para validar el Webhook de Meta
META_VERIFY_TOKEN="farfalina_carissma_webhook_verify_token_2026"

# App Secret de tu aplicación de Meta para validación de firmas HMAC SHA-256
META_APP_SECRET="tu_app_secret_de_meta_aqui"

# Inquilino predeterminado si no se especifica en la petición
WHATSAPP_ENV="farfalina"
```

---

## 10. Preguntas Frecuentes y Solución de Problemas

### 1. ¿Qué es la "Ventana de Servicio al Cliente de 24 Horas"?
Meta impone una política de privacidad: cuando un cliente envía un mensaje, se abre una ventana de 24 horas durante la cual tu empresa puede responder con cualquier mensaje de texto libre o archivo multimedia. Si transcurren más de 24 horas sin interacción del cliente, Meta exige iniciar la conversación mediante una Plantilla Aprobada (Template Message).

### 2. Meta me da error 403 al verificar el Webhook
- Verifica que el **Verify Token** en Meta coincida exactamente con `farfalina_carissma_webhook_verify_token_2026` o el definido en tu `.env`.
- Asegúrate de que el servidor sea accesible públicamente por HTTPS (Meta rechaza conexiones HTTP no seguras).

### 3. Recibo mensajes pero no puedo enviar
- Confirma que el **System User Token** tenga activos los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
- Verifica que el **Phone Number ID** no contenga espacios ni comillas adicionales.

### 4. ¿Puedo seguir usando WhatsApp Web (QR) si lo prefiero?
¡Sí! El sistema incluye un conmutador en la configuración que te permite alternar entre **Meta Cloud API** (recomendado para producción) y **WhatsApp Web QR** (ideal para pruebas locales sin cuenta comercial).
