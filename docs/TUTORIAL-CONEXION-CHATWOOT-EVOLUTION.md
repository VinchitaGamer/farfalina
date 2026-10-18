# 📖 Guía Completa de Conexión: Chatwoot + Evolution API + Farfalina & Carissma

Esta guía detalla paso a paso cómo conectar **Chatwoot**, **Evolution API v2** y nuestro sistema **Next.js** para tener la bandeja omnicanal unificada (WhatsApp, Facebook Messenger e Instagram) operando al 100% sin salir de la plataforma.

---

## 🗺️ Mapa de Arquitectura

```
📱 Cliente (WhatsApp)       ───────► Evolution API (Baileys) ───┐
👥 Cliente (Facebook)       ───────────────────────────────────┼───► Chatwoot (Hub)
📸 Cliente (Instagram)      ───────────────────────────────────┘         │
                                                                         │ Webhook HTTP POST
                                                                         ▼
                                                             /api/webhooks/chatwoot
                                                                         │
                                                                         ▼
                                                             Base de Datos SQLite (Prisma)
                                                                         │
                                                                         ▼
                                                             🖥️ Panel Omnicanal en Vivo
                                                             (Florería / Carissma)
```

---

## 📋 Requisitos Previos

1. **Instancia de Chatwoot**: En la nube ([app.chatwoot.com](https://app.chatwoot.com)) o auto-alojada en tu VPS.
2. **Instancia de Evolution API v2**: Corriendo en tu servidor/VPS o localmente en Docker (`http://localhost:8080`).
3. **Herramienta para túnel local (solo en desarrollo)**: [Ngrok](https://ngrok.com) o [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) para que Chatwoot pueda enviar webhooks a tu `localhost:3000`.

---

## PASO 1: Obtener Credenciales de Chatwoot

### 1.1. Obtener el `Account ID`
1. Inicia sesión en Chatwoot.
2. Mira la barra de direcciones de tu navegador:
   `https://tu-chatwoot.com/app/accounts/{ACCOUNT_ID}/dashboard`
3. El número que aparece después de `/accounts/` es tu `CHATWOOT_ACCOUNT_ID` (frecuentemente es `1`).

### 1.2. Obtener el `API Access Token`
1. En la esquina inferior izquierda de Chatwoot, haz clic en tu **Avatar / Nombre**.
2. Selecciona **Ajustes de perfil** (Profile Settings).
3. Desplázate hasta abajo hasta la sección **Token de acceso a la API** (API Access Token).
4. Copia ese token. Este será tu `CHATWOOT_API_TOKEN`.

---

## PASO 2: Configurar las Bandejas de Entrada (Inboxes) en Chatwoot

### 2.1. Facebook Messenger
1. En Chatwoot, ve a **Ajustes** (icono de engranaje) ➔ **Bandejas de entrada** ➔ **Añadir bandeja de entrada**.
2. Elige **Facebook**.
3. Haz clic en **Iniciar sesión con Facebook** y autoriza los permisos.
4. Selecciona la FanPage de Florería Farfalina (o Carissma).
5. Asigna a los agentes que atenderán.
6. Al finalizar, entra en la configuración de la bandeja creada y copia el **ID numérico** que aparece en la URL del navegador (ej: `/settings/inboxes/2` ➔ el ID es `2`).

### 2.2. Instagram Direct
1. En **Añadir bandeja de entrada**, elige **Instagram**.
2. Sigue el flujo de conexión de Meta para vincular tu cuenta profesional de Instagram conectada a la FanPage.
3. Copia el **ID numérico** de esta bandeja.

---

## PASO 3: Conectar WhatsApp con Evolution API y Chatwoot

Evolution API v2 cuenta con sincronización nativa directa con Chatwoot. Con solo dos llamadas a la API, Evolution creará la bandeja en Chatwoot, configurará el webhook bidireccional y enviará los mensajes automáticamente.

### 3.1. Crear la Instancia en Evolution API
Abre tu terminal (PowerShell / Bash) o Postman y ejecuta:

```bash
curl -X POST "http://localhost:8080/instance/create" \
  -H "apikey: TU_GLOBAL_EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "farfalina",
    "token": "token-seguro-farfalina-2026",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

### 3.2. Enlazar Evolution API con Chatwoot
Ejecuta la configuración del módulo Chatwoot para la instancia `farfalina`:

```bash
curl -X POST "http://localhost:8080/chatwoot/set/farfalina" \
  -H "apikey: TU_GLOBAL_EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "url": "https://tu-chatwoot.com",
    "accountId": 1,
    "token": "TU_CHATWOOT_API_TOKEN",
    "signMsg": true,
    "signDelimiter": "\n",
    "reopenConversation": true,
    "conversationPending": false,
    "importContacts": true,
    "importMessages": true,
    "daysLimitImportMessages": 3,
    "nameInbox": "WhatsApp Farfalina",
    "organization": "Florería Farfalina"
  }'
```

> **¿Qué hace esto automáticamente?**
> - Crea una bandeja de tipo API llamada *"WhatsApp Farfalina"* en tu Chatwoot.
> - Configura el webhook interno entre Chatwoot y Evolution para que cuando respondas en Chatwoot, Evolution lo mande a WhatsApp.

### 3.3. Escanear el Código QR
1. Obtén el código QR abriendo en tu navegador:
   `http://localhost:8080/instance/connect/farfalina` (o solicitándolo vía GET con el header `apikey`).
2. Abre WhatsApp en el celular de la florería ➔ **Dispositivos vinculados** ➔ **Vincular un dispositivo**.
3. Escanea el código QR de la pantalla.
4. En cuanto se conecte, la instancia reportará `connectionStatus: open`.

*(Opcional: Si manejas un número independiente para Carissma, repite los pasos 3.1, 3.2 y 3.3 cambiando `farfalina` por `carissma`).*

---

## PASO 4: Conectar el Webhook de Chatwoot a Nuestro Sistema Next.js

Para que todos los mensajes (de WhatsApp, Messenger e Instagram) lleguen a nuestra interfaz en tiempo real y se sincronicen con el POS, CRM e inventario:

1. Si estás en entorno local de desarrollo, levanta un túnel con **Ngrok**:
   ```bash
   ngrok http 3000
   ```
   *Copia la URL HTTPS pública generada (ej: `https://abc1234.ngrok-free.app`).*
   *(En producción VPS, usa directamente tu dominio: `https://tudominio.com`).*

2. En Chatwoot, ve a **Ajustes** ➔ **Integraciones** ➔ **Webhooks** ➔ **Añadir nuevo Webhook**.
3. Completa los campos:
   - **URL del Webhook**: `https://tu-dominio-o-ngrok/api/webhooks/chatwoot`
   - **Eventos a suscribir**: Marca las casillas:
     - `message_created` (Mensaje creado)
     - `message_updated` (Mensaje actualizado)
     - `conversation_created` (Conversación creada)
     - `conversation_status_changed` (Estado de conversación cambiado)
     - `contact_created` (Contacto creado)
     - `contact_updated` (Contacto actualizado)
4. Haz clic en **Crear Webhook**.
5. Si configuras un Secreto de Webhook, cópialo para ponerlo en tu `.env`.

---

## PASO 5: Configurar el archivo `.env` del Proyecto

Abre el archivo `.env` en la raíz de `floreria` y define las siguientes variables:

```env
# ===================================================================
# INTEGRACIÓN CHATWOOT & EVOLUTION API
# ===================================================================

# 1. URL base de tu Chatwoot (sin barra diagonal final)
CHATWOOT_BASE_URL=https://tu-chatwoot.com

# 2. Token de acceso de tu usuario administrador (obtenido en Paso 1.2)
CHATWOOT_API_TOKEN=tu_token_de_acceso_aqui

# 3. ID numérico de tu cuenta (obtenido en Paso 1.1, usualmente 1)
CHATWOOT_ACCOUNT_ID=1

# 4. Secreto configurado en Ajustes -> Webhooks (Paso 4)
CHATWOOT_WEBHOOK_SECRET=tu_secreto_de_webhook_aqui

# 5. IDs de las bandejas que corresponden a Florería Farfalina
# (Separados por coma si hay varias: WhatsApp, Facebook, Instagram)
# Ejemplo: 1 es WhatsApp Farfalina, 2 es Facebook Farfalina, 3 es Instagram Farfalina
CHATWOOT_INBOX_IDS_FARFALINA=1,2,3

# 6. IDs de las bandejas que corresponden a Alquileres Carissma
# Ejemplo: 4 es WhatsApp Carissma, 5 es Facebook Carissma
CHATWOOT_INBOX_IDS_CARISSMA=4,5

# 7. Credenciales de Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=tu_global_evolution_api_key
```

---

## PASO 6: Prueba de Funcionamiento y Verificación

1. Inicia tu servidor local:
   ```bash
   npm run dev
   ```
2. Entra al sistema en tu navegador:
   `http://localhost:3000/floreria/omnichannel`
3. Abre el modal de configuración (icono de engranaje arriba a la derecha):
   - Verifica que **Chatwoot** aparezca en verde (**CONECTADO**).
   - Verifica que **Evolution API** aparezca en azul (**CONECTADO**).
4. **Prueba de Mensaje Entrante**:
   - Envía un mensaje desde cualquier celular al WhatsApp de la florería (ej: *"Hola, quisiera consultar precios"*).
   - El mensaje aparecerá de inmediato en la columna izquierda de la bandeja omnicanal con la insignia verde de WhatsApp.
5. **Prueba de Respuesta**:
   - Escribe una respuesta desde el chat en pantalla y presiona Enviar.
   - El mensaje llegará directamente al WhatsApp del cliente.
6. **Prueba de Creación de Pedido**:
   - En el panel derecho de operaciones del chat, haz clic en **"💐 Generar Pedido Floral"**.
   - Los datos del cliente se pre-cargarán automáticamente.
   - Al confirmar el pedido, se emitirá el ticket, se descontará el stock de flores vivas y se enviará la confirmación al chat del cliente.

---

## 🆘 Solución de Problemas Frecuentes

| Problema | Causa Posible | Solución |
|---|---|---|
| **Los mensajes entrantes no aparecen en pantalla** | La URL del Webhook en Chatwoot no es accesible | Si estás en desarrollo, verifica que Ngrok esté corriendo y que la URL coincida con la registrada en Chatwoot. |
| **Error al enviar mensaje desde la web** | `CHATWOOT_API_TOKEN` incorrecto o caducado | Verifica el token en tu perfil de Chatwoot y actualiza el `.env`. |
| **WhatsApp no se conecta (QR no carga)** | Evolution API no está encendido o API Key errónea | Revisa que el contenedor Docker o servicio de Evolution API esté activo en el puerto configurado. |
| **Las respuestas llegan a la marca incorrecta** | `CHATWOOT_INBOX_IDS_FARFALINA` o `CARISSMA` mal asignados | Verifica los IDs numéricos exactos de cada bandeja en Chatwoot y asígnalos al negocio correspondiente en el `.env`. |
