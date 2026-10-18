# Extensión Chrome Relay: Meta Business Suite Bridge v3.0

Esta extensión de navegador (Manifest V3) conecta directamente la bandeja unificada de **Meta Business Suite (`business.facebook.com`)** con el CRM local de **Florería Farfalina & Carissma Alquileres** (`http://localhost:3000`), sin requerir tokens de Meta Graph API ni verificación de aplicaciones de Meta Developers.

---

## 🚀 Instalación o Recarga en 3 Pasos

1. **Abrir Administrador de Extensiones de Chrome:**
   - Abre Google Chrome y navega a `chrome://extensions/`.
2. **Activar Modo Desarrollador:**
   - En la esquina superior derecha, activa el interruptor **Modo de desarrollador** (*Developer mode*).
3. **Cargar o Recargar la Extensión:**
   - Si es la primera vez: Haz clic en **Cargar descomprimida** (*Load unpacked*) y selecciona `c:\Users\Lenovo\Desktop\floreria\extension-meta-relay`.
   - Si ya la tenías cargada: Haz clic en el ícono de flecha circular **⟳ Recargar** de la tarjeta de la extensión para aplicar todos los cambios más recientes.

---

## 🌟 Capacidades de Sincronización Total (v3.0)

### 1. 🚀 Crawler Profundo de Des-virtualización (Deep Sync)
Meta Business Suite utiliza listas virtualizadas donde solo se renderizan ~10-15 filas en el DOM a la vez. El crawler implementado resuelve esto completamente:
- **Detección Automática de Contenedor:** Localiza el contenedor virtualizado del listado lateral de conversaciones.
- **Scroll Progresivo Paso a Paso:** Desplaza el scroll en incrementos del 75% del viewport y espera a que React monte y desmonte los elementos sin saturar el hilo.
- **Extracción de Contactos:** Acumula nombres, identificadores únicos de hilo/teléfono, canales (WhatsApp, Facebook, Instagram), último mensaje y avatares reales.
- **Paginación de Historial:** Al abrir cada hilo, hace scroll progresivo hacia arriba (`scrollTop = 0`) para forzar las consultas GraphQL de paginación de Meta y capturar mensajes históricos antiguos.
- **Barra de Progreso Flotante (HUD):** Muestra el progreso en vivo (`[3/45] Danito...`), porcentaje y botón para detener en cualquier momento (`⏹️ Detener`).

### 2. 🔄 Sincronización Rápida del Chat Activo
- **Botón "🔄 Sync Chat" en el HUD o Popup:** Sincroniza al instante todos los mensajes de la conversación abierta sin tener que recorrer todo el buzón.
- También disponible directamente desde el panel CRM en Farfalina (`http://localhost:3000/omnichannel`).

### 3. 🖼️ Descarga y Caché Local Permanente de Multimedia
- Todas las imágenes y adjuntos capturados de Meta (`fbcdn.net`, `cdninstagram.com`) son descargados por el backend `/api/relay/inbound` y guardados en `public/uploads/meta/`.
- **Ventaja:** Las URLs no caducan por tokens de expiración (`oe=...&oh=...`) y se muestran limpiamente sin bloqueos de `Referrer-Policy`.
- **Visor Lightbox Integrado:** En el CRM de Farfalina, haz clic en cualquier imagen de la conversación o en el avatar del cliente para abrir el visor en pantalla completa con zoom in/out y botón de descarga.

### 4. 📤 Envío de Multimedia Outbound a Meta
- Al responder desde Farfalina adjuntando una foto o catálogo, el relay Service Worker descarga el archivo en base64, lo convierte a un objeto `File` y lo inyecta en el compositor de Meta mediante evento sintético de portapapeles (`ClipboardEvent('paste')`) o selector de archivos (`input[type="file"]`), escribiendo el mensaje y pulsando Enviar automáticamente.

### 5. 🌸 Módulos Comerciales Inyectados
- **"🌸 Pedido Floral"**: Abre el modal de venta de arreglos florales, dedicatoria, dirección y arqueo de caja con los datos del contacto precargados.
- **"👗 Reserva Carissma"**: Abre el modal de alquiler de vestidos con fechas de reserva, garantía y catálogo de vestidos.

---

## ⚡ Alternativa: Script Autónomo de DevTools Console

Si prefieres realizar una sincronización profunda completa sin usar los botones de la extensión:
1. En Chrome, entra a: `https://business.facebook.com/latest/inbox/all`
2. Presiona `F12` o `Ctrl + Shift + I` para abrir las Herramientas de Desarrollador (DevTools) y ve a la pestaña **Console**.
3. Abre el archivo `scripts/meta-deep-sync.js` de este proyecto, copia todo su contenido y pégalo en la consola.
4. Presiona `Enter`.
5. El script ejecutará:
   - **Fase 1:** Recorrido y des-virtualización de todos los contactos del sidebar.
   - **Fase 2:** Navegación por cada conversación, paginación ascendente de mensajes antiguos y extracción de fotos.
   - **Envío:** Transmisión directa por lotes a `http://localhost:3000/api/relay/inbound`.
6. En la consola verás un log detallado y colorido con el resumen final:
   ```
   🎉 Sincronización Total Finalizada:
   - Chats procesados: 42
   - Mensajes recolectados: 318
   - Lotes enviados al CRM: 5
   ```
