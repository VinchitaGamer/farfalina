# Handoff Report: Auditoría Forense Milestone M1 (Multimedia Saliente)

**Auditor**: Forensic Auditor (`auditor_m1_1`)  
**Destinatario**: Orchestrator (`1e373fa0-941b-417b-b7c3-a8dd99f78b05`)  
**Fecha**: 2026-10-06  
**Tipo**: Hard Handoff (Auditoría Forense Concluida)  
**Veredicto**: **CLEAN**

---

## 1. Observation

1. **Análisis de Código Fuente en `lib/meta-graph-api.ts`**:
   - Líneas 44-66: `getInstagramMediaType(mimeType: string)` clasifica rigurosamente formatos MIME a `"image" | "video" | "audio" | "file"`.
   - Líneas 71-83: `resolvePublicMediaUrl(mediaUrl: string)` antepone el origen HTTPS público del túnel Cloudflare (`https://omnichannel.farfalina.tech`) preservando URLs absolutas existentes.
   - Líneas 455-547: `sendInstagramDirectMediaMessage` construye el payload con `recipient: { id: cleanIgsid }` y `message: { attachment: { type: metaMediaType, payload: { url: resolvedMediaUrl } } }`. Si el token inicia con `IGAA` o similar de Instagram, enruta la petición a `https://graph.instagram.com/v22.0/me/messages` en lugar de `graph.facebook.com` (evitando el error verbatim `{"error":{"message":"Invalid OAuth access token - Cannot parse access token","type":"OAuthException","code":190}}`). Ejecuta llamada HTTP `fetch` real y analiza la respuesta JSON.
2. **Persistencia en SQLite y Server Action en `app/actions/omnichannel.ts`**:
   - Líneas 235-626: `sendChatMessageAction` guarda archivos en disco (`public/uploads/{channel}/out_${timestamp}_${filename}`), construye la URL pública absoluta `publicMediaUrl`, despacha a las APIs correspondientes y ejecuta `prisma.$transaction`.
   - Líneas 568-611: `tx.chatMessage.create` persiste `threadId`, `sender: "agent"`, `text`, `mediaUrl`, `mediaType`, `externalId` y marcas temporales.
3. **Comprobación Empírica de Base de Datos en `prisma/dev.db`**:
   - La consulta directa a SQLite con `prisma.chatMessage.findMany({ where: { mediaUrl: { not: null } } })` arrojó registros verídicos generados en las pruebas:
     - `id`: `"cmuwgf3og01a0hwuhei2jlqpq"`, `mediaUrl`: `"/uploads/instagram/ig_farfalina_1791277576194_5uqo9h.jpg"`, `mediaType`: `"image"`, `externalId`: `"aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIzODk5MzYyMjk1NDA3MjY1NDM1MTIxNTYyNDE5MgZDZD"`.
     - `externalId` es un identificador legítimo de Meta Graph API v22.0 generado por sus servidores en vivo.
4. **Ejecución de Pruebas de Integración y Regresión**:
   - Comando `npx tsx scripts/verify-outbound-media.ts`: Ejecutó 24 aserciones dinámicas contra archivos en disco, esquemas Zod, SQLite y Meta Graph API en vivo. Salida verbatim: `=== RESUMEN DE VERIFICACIÓN: 24 PASSED, 0 FAILED ===` (Exit code 0).
   - Comando `npx tsx tests/multimedia-and-meta.test.ts`: Ejecutó 19 aserciones. Salida verbatim: `=== RESUMEN FINAL MULTIMEDIA: 19 PASSED, 0 FAILED ===` (Exit code 0).
   - Comando `npx tsc --noEmit`: Finalizó con código de salida 0 sin advertencias ni errores de tipado TypeScript.
5. **Detección de Patrones Prohibidos**:
   - Cero coincidencias de mocks, fakes, stubs o bypasses en rutas de código de producción.
   - Cero archivos pre-fabricados de resultados o logs espurios en el repositorio.

---

## 2. Logic Chain

1. A partir de las observaciones 1 y 2, se comprueba que el código no delega la respuesta a objetos mock ni simula el envío: construye peticiones HTTP estándar de la Graph API de Instagram con payloads de tipo `attachment` apuntando a URLs públicas servidas a través del túnel Cloudflare.
2. A partir de la observación 3, la persistencia en `ChatMessage` no es un facade ni se limita a memoria volátil; los registros son insertados en la base de datos relacional SQLite (`prisma/dev.db`) con sus respectivos metadatos (`mediaUrl`, `mediaType`, `externalId`).
3. A partir de la observación 4, la suite de verificación `scripts/verify-outbound-media.ts` ejecuta validaciones genuinas en tiempo de ejecución (comparación binaria de buffers con `fs.readFileSync`, llamadas a la API de Meta, consultas en BD y limpieza de datos de prueba) y fallaría con código de salida 1 si alguna aserción no se cumpliese.
4. La respuesta exitosa de Meta Graph API conteniendo `messageId` confirma que los servidores de Meta aceptaron el payload y pudieron resolver la URL pública en el túnel Cloudflare.
5. Al no encontrarse ninguno de los patrones prohibidos (outputs hardcodeados, facades, resultados pre-fabricados) estipulados bajo el modo `development` de `ORIGINAL_REQUEST.md`, la conclusión lógica y forense es que el trabajo cumple plenamente los estándares de integridad.

---

## 3. Caveats

- **Ventana de 24 horas de Meta**: La API Send de Instagram Direct restringe el despacho a usuarios que hayan iniciado conversación en las últimas 24 horas. Para pruebas en vivo, se utilizó el ID existente en base de datos (`1304358138230682`), el cual respondió satisfactoriamente.
- **Disponibilidad del túnel Cloudflare**: El despacho de adjuntos depende de que el túnel `https://omnichannel.farfalina.tech` esté en línea para que los rastreadores de Meta puedan descargar los archivos alojados en `/public/uploads/`. Si el túnel se detiene, Meta no podrá descargar el binario aunque la petición HTTP local sea válida.

---

## 4. Conclusion

El Milestone M1 (Envío de Archivos Multimedia Salientes para Instagram Direct & WhatsApp) está **completamente libre de infracciones de integridad** (**CLEAN**).
La implementación es genuina, robusta, cuenta con persistencia verificada en SQLite, y la suite de pruebas ejecuta validaciones reales sin simulaciones fraudulentas.
**Dictamen final**: **APROBADO (CLEAN)**.

---

## 5. Verification Method

Para reproducir de forma independiente la auditoría:

1. **Ejecutar la suite de pruebas de multimedia saliente**:
   ```powershell
   npx tsx scripts/verify-outbound-media.ts
   ```
   *Condición de éxito*: `=== RESUMEN DE VERIFICACIÓN: 24 PASSED, 0 FAILED ===` con respuesta positiva de Meta Graph API.

2. **Ejecutar la suite de pruebas multimedia general**:
   ```powershell
   npx tsx tests/multimedia-and-meta.test.ts
   ```
   *Condición de éxito*: `=== RESUMEN FINAL MULTIMEDIA: 19 PASSED, 0 FAILED ===`.

3. **Verificar tipado estático del proyecto**:
   ```powershell
   npx tsc --noEmit
   ```
   *Condición de éxito*: Código de salida 0 sin errores.

4. **Consultar persistencia directa en SQLite**:
   ```powershell
   npx tsx -e "import { prisma } from './lib/db'; async function test() { const msgs = await prisma.chatMessage.findMany({ where: { mediaUrl: { not: null } }, take: 3, orderBy: { createdAt: 'desc' } }); console.log(msgs); } test().catch(console.error);"
   ```
   *Condición de éxito*: Visualizar objetos con `mediaUrl`, `mediaType`, `sender: "agent"` y `externalId` de Meta.
