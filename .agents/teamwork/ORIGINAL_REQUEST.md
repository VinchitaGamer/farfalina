# Original User Request

## Initial Request — 2026-10-06T06:01:13Z

Requested team: Equipo completo multidisciplinario (gestión de VPS + backend webhook + verificación de Meta)

Detener y deshabilitar los servicios en el VPS antiguo de SOURDEV (207.211.167.189) para cortar colisiones de tráfico y webhooks, y diagnosticar y asegurar el flujo completo de recepción y persistencia de mensajes reales de Instagram Direct en el entorno local (Next.js 14, Cloudflare Tunnel, SQLite).

Working directory: c:\Users\Lenovo\Desktop\floreria
Integrity mode: development

## Requirements

### R1. Desconexión y Cierre Definitivo de Servicios en VPS Antiguo
Ejecutar la detención y eliminación del proceso PM2 `floreria` (`pm2 stop floreria && pm2 delete floreria && pm2 save`) y detener el servidor Nginx en la IP `207.211.167.189` utilizando la clave SSH privada en `C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key` con flags no interactivos (`-n -o BatchMode=yes -o StrictHostKeyChecking=no -o ConnectTimeout=15`), asegurando que el VPS ya no responda peticiones web ni intercepte tráfico.

### R2. Recepción y Persistencia de Mensajes de Instagram Direct en Local
Asegurar que el endpoint `app/api/webhooks/instagram/route.ts` procese sin errores los mensajes entrantes reales provenientes de la Graph API de Instagram Direct (`entry[].messaging[]`), asociándolos al `ChannelConfig` correspondiente, creando o vinculando el cliente en `CRMClient` y registrando el mensaje en `ChatMessage` dentro de `prisma/dev.db`.

### R3. Auditoría de Configuraciones y Bloqueos de Meta
Diagnosticar y resolver cualquier bloqueo externo o interno de Meta:
1. Validar el modo de la aplicación en Meta Developers (Modo Desarrollo vs En Vivo). Si está en Desarrollo, confirmar que el remitente esté registrado como Evaluador de Instagram (Instagram Tester) con invitación aceptada.
2. Comprobar la directiva de privacidad en la cuenta `@sour_jhxn` en la app móvil de Instagram ("Permitir acceso a los mensajes" activo en Herramientas conectadas).
3. Verificar que la validación de firma `x-hub-signature-256` y `META_APP_SECRET` no descarte mensajes legítimos.

## Controlled Infrastructure & Resources

- Conexión SSH a VPS: `ubuntu@207.211.167.189` mediante la llave `C:\Users\Lenovo\Desktop\ssh-key-2026-09-07 (2).key`.
- Servidor local en ejecución en `http://localhost:3000` con túnel Cloudflare activo en `https://omnichannel.farfalina.tech`.
- Base de datos local SQLite: `prisma/dev.db`.

## Verification Resources

- Script de verificación por SSH del estado de PM2 y Nginx en el VPS (`pm2 status`, `systemctl status nginx`).
- Script automatizado de pruebas enviando payload representativo de Instagram Direct (`POST /api/webhooks/instagram`) y comprobando mediante consulta a SQLite que el mensaje se registró en `ChatMessage` con estado y remitente correctos.

## Acceptance Criteria

### Infraestructura VPS
- [ ] En el servidor `207.211.167.189`, el proceso PM2 `floreria` está detenido, eliminado de la lista y la configuración persistida con `pm2 save`.
- [ ] El servicio Nginx en el servidor `207.211.167.189` está detenido o no atiende solicitudes para los dominios del proyecto.

### Webhook de Instagram Direct
- [ ] El endpoint `POST /api/webhooks/instagram` procesa exitosamente payloads con estructura `entry[].messaging[]` (incluyendo `sender.id`, `recipient.id`, `message.mid`, texto y adjuntos).
- [ ] Los mensajes recibidos se almacenan en la tabla `ChatMessage` y se asocian a un `CRMClient` existente o nuevo en `prisma/dev.db`.
- [ ] La respuesta HTTP del webhook es 200 `{ success: true, data: { received: true }, code: "SUCCESS" }`.

### Verificación de Meta y Canal
- [ ] La tabla `ChannelConfig` contiene el registro para `Instagram` con estado `CONNECTED`, `instagramAccountId: "29643476368611224"` y tokens válidos.
- [ ] Se documenta el estado de la verificación de Evaluador de Instagram y la directiva de acceso a mensajes en la aplicación móvil para garantizar el flujo en producción y pruebas.


## Follow-up — 2026-10-06T08:21:10Z

Requested team: Equipo completo multidisciplinario (frontend chat UI, integrador Graph API, base de datos SQLite y QA)

Implementar de forma integral en la suite omnicanal el envío de archivos multimedia salientes (Instagram Direct y WhatsApp), la extracción y persistencia de perfiles con username y fotos de perfil reales, la visualización y respuesta a publicaciones y comentarios de Instagram (webhook `comments`), y la sincronización retroactiva (backfill) de conversaciones históricas previas.

Working directory: c:\Users\Lenovo\Desktop\floreria
Integrity mode: development

## Requirements

### R1. Envío de Archivos Multimedia Salientes (Instagram Direct & WhatsApp)
Habilitar en la interfaz de chat unificada la carga y despacho de imágenes, notas de voz/audio y archivos (PDF/documentos), subiéndolos localmente a `/public/uploads/` para generar una URL pública accesible mediante el túnel HTTPS (`https://omnichannel.farfalina.tech/...`) y despachándolos mediante las APIs de Meta (Instagram Graph API `POST /{ig_user_id}/messages` con objeto `attachment`, y Evolution API / WhatsApp Cloud API con tipo `media`), registrándolos en `ChatMessage`.

### R2. Enriquecimiento Persistente de Perfiles (Username, Display Name y Avatar)
Garantizar que al recibir o sincronizar conversaciones de Instagram y WhatsApp, el sistema consulte los datos de perfil del remitente (resolviendo `@username`, nombre real y foto de perfil `profile_picture_url`), descargando y cacheando localmente el avatar para evitar vencimientos de URLs efímeras de CDN de Meta, y actualizando tanto el hilo en `ChatThread` como la ficha de cliente en `CRMClient`.

### R3. Visualización y Respuesta a Publicaciones y Comentarios de Instagram
Aprovechar la suscripción activa al webhook de `comments` en Meta para:
1. Capturar en tiempo real los comentarios entrantes sobre las publicaciones de la cuenta (`@sour_jhxn`).
2. Mostrar una vista o panel en el módulo omnicanal con las publicaciones recientes y sus respectivos comentarios con usuario, texto y timestamp.
3. Permitir a los asesores responder directamente al comentario (respuesta pública mediante `POST /{comment_id}/replies` y/o mensaje directo privado mediante Private Reply de la Graph API).

### R4. Sincronización Retroactiva de Conversaciones Previas (Backfill de Historial)
Implementar una acción de sincronización bajo demanda (botón "Sincronizar Histórico" en la interfaz) que consulte a Meta Graph API (`GET /{ig_account_id}/conversations?fields=id,updated_time,participants,messages{id,created_time,from,to,message,attachments}`), recorra las páginas de mensajes históricos y los inserte en `ChatThread` y `ChatMessage` en `prisma/dev.db` asegurando la deduplicación por `externalId` para que los operadores tengan acceso a todo el historial anterior al encendido del sistema.

## Controlled Infrastructure & Resources

- Servidor local en ejecución en `http://localhost:3000` conectado al túnel Cloudflare público `https://omnichannel.farfalina.tech`.
- Base de datos local SQLite: `prisma/dev.db`.
- Credenciales configuradas en `ChannelConfig`: Instagram Account ID `29643476368611224`, tokens de acceso Graph API.

## Verification Resources

- Endpoint y Server Action para subida y envío de multimedia probados mediante script de prueba simulando envío con URL pública.
- Script de consulta del webhook `comments` y validación de inserción en base de datos.
- Script de prueba de la función de backfill histórico contra Meta Graph API para validar importación de hilos y mensajes sin duplicados en `prisma/dev.db`.

## Acceptance Criteria

### Multimedia Saliente
- [ ] La UI del chat permite adjuntar imágenes o documentos y enviarlos a usuarios de Instagram y WhatsApp.
- [ ] El payload enviado a Meta incluye la estructura de adjunto correcta y el mensaje saliente queda guardado en `ChatMessage` con su `mediaUrl` y rol `agent`.

### Perfiles y Avatares
- [ ] Los chats de Instagram muestran el `@username` y foto de perfil real del usuario cuando están disponibles en la API de Meta.
- [ ] Los avatares se descargan y sirven desde `/public/uploads/` sin enlaces rotos por expiración de token de Meta.

### Posts y Comentarios
- [ ] El webhook `POST /api/webhooks/instagram` procesa eventos del campo `comments` guardando el comentario asociado al post.
- [ ] Existe una interfaz accesible para ver los comentarios de los posts y enviar respuestas que se despachen a Instagram.

### Sincronización Histórica
- [ ] Al accionar la sincronización de mensajes históricos, los hilos y mensajes anteriores a la fecha actual se importan correctamente a `ChatThread` y `ChatMessage`.
- [ ] No se duplican mensajes ya registrados previamente en SQLite.


## Follow-up — 2026-10-09T18:17:28Z

Implementación integral de diseño responsive para tablets y smartphones en el sistema SaaS de Florería Farfalina y Alquiler de Vestidos Carissma, eliminando bugs de zoom y teclado móvil, y manteniendo la ejecución continua del servidor de desarrollo activo.

Working directory: c:/Users/Lenovo/Desktop/floreria
Integrity mode: development

## Requirements

### R1. Adaptación Responsive Integral de Módulos (Mobile & Tablet First)
Adaptar las interfaces de usuario de todos los módulos del sistema (POS, Pedidos/Kanban de entregas, Omnicanal/Chat, CRM, Catálogo y Arqueo/Contabilidad) para pantallas de tablets (768px - 1024px) y smartphones (360px - 430px). En pantallas móviles, las tablas complejas y listas densas deben transformarse en tarjetas táctiles (cards apiladas) con espaciado ergonómico, manteniendo la visualización tabular en pantallas de tablet y escritorio.

### R2. Prevención de Bugs Móviles Nativos (Teclado Virtual, Auto-Zoom y Viewport)
Configurar el viewport de Next.js (`width=device-width`, `initial-scale=1`, `interactiveWidget: 'resizes-content'`) y asegurar que los campos interactivos (`input`, `select`, `textarea`) tengan un tamaño de fuente mínimo de 16px (1rem) en vistas móviles para evitar el zoom involuntario que activan iOS Safari y Android al desplegar el teclado. Implementar unidades de viewport dinámicas (`dvh`/`svh`) para evitar desajustes visuales y saltos de pantalla cuando el teclado móvil se abre o se cierra.

### R3. Ergonomía Táctil y Navegación Segura
Asegurar áreas de toque mínimas de 44x44px en botones, controles y selectores. Garantizar que modales, drawers (como el centro de notificaciones y panel omnicanal) y la barra de navegación inferior móvil (`MobileBottomNav`) respeten los márgenes seguros (`safe-area-inset-bottom`) sin superponerse ni bloquear el contenido interactivo.

### R4. Preservación Estricta del Servidor de Desarrollo Activo
Queda estrictamente prohibido detener, reiniciar o matar el proceso que se encuentra corriendo en la terminal de VS Code (`next dev` / `npm run dev`), ya que el cliente está utilizando el sistema en vivo. Toda validación de código debe ejecutarse en procesos secundarios independientes (por ejemplo `npx tsc --noEmit`) sin interrumpir la sesión activa del cliente. Si en algún momento es indispensable reiniciar el servidor, se debe notificar explícitamente al usuario para que lo haga de forma manual.

## Acceptance Criteria

### Viewport y Comportamiento de Teclado
- [ ] La configuración del viewport exportada en la aplicación incluye `interactiveWidget: 'resizes-content'` para evitar distorsiones al abrir teclados móviles.
- [ ] Ningún campo de entrada (`input`, `textarea`, `select`) genera auto-zoom al recibir foco en navegadores móviles (tamaño de fuente `>= 16px` en móvil).
- [ ] No existen desbordamientos horizontales de página (`overflow-x` indeseado) en anchos de pantalla desde 360px hasta 1024px.

### Ergonomía de Pantalla y Componentes
- [ ] Los elementos interactivos (botones, pestañas, disparadores de acciones) cuentan con zonas de toque accesibles (mínimo 44x44px).
- [ ] En pantallas móviles (`< 768px`), las tablas de órdenes, clientes y movimientos se renderizan como tarjetas táctiles legibles y navegables.
- [ ] La barra inferior móvil (`MobileBottomNav`) y los modales no tapan botones de confirmación, campos de texto ni botones de acción principal.

### Verificación Técnica y Estabilidad
- [ ] El chequeo de tipos de TypeScript (`npx tsc --noEmit`) se ejecuta limpiamente con 0 errores.
- [ ] El proceso de desarrollo existente en la terminal de VS Code permanece activo e intacto durante toda la intervención.
