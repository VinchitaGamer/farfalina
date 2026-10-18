# Reporte de Revisión y Crítica Adversarial: Milestone M1

**Revisor**: Reviewer 1 (`reviewer_m1_1`)  
**Fecha**: 2026-10-06  
**Milestone**: M1 — Envío de Archivos Multimedia Salientes (Instagram Direct & WhatsApp)  
**Veredicto**: **APPROVE**

---

## 1. Resumen de Revisión (Review Summary)

**Veredicto**: **APPROVE**  
**Integridad**: **VERIFICADA (Sin violaciones)**  
**Riesgo General**: **LOW**

La implementación del Milestone M1 satisface con rigor técnico todos los requerimientos estipulados en `ORIGINAL_REQUEST.md` (§R1 bajo el follow-up de 2026-10-06T08:21:10Z) y se alinea estrictamente con los contratos de arquitectura y directivas de `AGENTS.md`.

---

## 2. Auditoría Forense y de Integridad (Integrity Audit)

Se realizó una inspección adversarial para detectar patrones de fraude o simulación:
- **Resultados de prueba o IDs hardcodeados**: **NEGATIVO**. La ejecución en vivo de `scripts/verify-outbound-media.ts` generó un nuevo identificador legítimo de Meta (`messageId: 'aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDA2ODk4ODE3OTAwOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTcxMzczNDYxNTA3NjI4MjozMzA0MzIzNzgyOTY5MDMxMTIyNzA0OTAzODIxMjc1OTU1MgZDZD'`), diferente al reportado en la ejecución previa del worker, demostrando comunicación real con `https://graph.instagram.com/v22.0/me/messages`.
- **Implementaciones dummy o fachada**: **NEGATIVO**. La lógica incluye gestión física de archivos en disco (`public/uploads/{channel}`), decodificación Base64, sanitización de nombres de archivo contra directory traversal, despacho HTTP nativo con timeouts (`AbortSignal.timeout`) y transacciones atómicas en SQLite con Prisma.
- **Atajos indebidos o bypass del requerimiento**: **NEGATIVO**. Se implementó el soporte completo para imágenes, audios, videos y documentos tanto en Instagram Direct como en WhatsApp (Evolution API y Meta WhatsApp Cloud API).
- **Auto-certificación sin evidencia**: **NEGATIVO**. Todas las aserciones fueron re-ejecutadas y verificadas de forma independiente por este revisor.

---

## 3. Conformidad con Reglas Globales (`AGENTS.md`)

| Directiva | Estado | Evidencia / Observación |
|---|---|---|
| **App Router & Server por Defecto** | ✅ CUMPLE | `app/actions/omnichannel.ts` utiliza directiva `"use server"` y Server Actions. |
| **Sin `any`** | ✅ CUMPLE | 0 ocurrencias de `: any` o `as any` en los archivos modificados. |
| **Zod como Fuente de Tipos** | ✅ CUMPLE | `SendMessageSchema`, `SendMediaMessageParamsSchema`, con extracción vía `z.infer<>`. |
| **Contrato JSON `{ success, data, error, code }`** | ✅ CUMPLE | Retornos estructurados con `ActionResponse` en todas las ramas de error y éxito. |
| **HTTP Client Nativo (`fetch`)** | ✅ CUMPLE | Despachos implementados con `fetch` nativo; 0 uso de Axios. |
| **Early Returns & Sin Anidamiento Excesivo** | ✅ CUMPLE | Guard clauses al inicio de validación de esquemas y verificación de hilos. |
| **Nomenclatura Kebab-case** | ✅ CUMPLE | `lib/meta-graph-api.ts`, `lib/evolution-api.ts`, `lib/meta-whatsapp.ts`, `scripts/verify-outbound-media.ts`. |

---

## 4. Hallazgos (Findings)

### [Minor] Observación 1: Dependencia de la Ventana de 24 Horas de Meta
- **Qué**: Meta Graph API restringe los envíos salientes a usuarios de Instagram que no hayan interactuado en las últimas 24 horas.
- **Dónde**: `lib/meta-graph-api.ts:526-530` y `app/actions/omnichannel.ts:556-558`.
- **Comportamiento**: Cuando expira la ventana, Meta retorna un error de política. La implementación actual maneja correctamente este caso: no interrumpe el flujo, captura el error, registra el mensaje en `ChatMessage` para el operador y lo marca como pendiente en `RelayOutboundQueue`.
- **Sugerencia**: En una fase futura, considerar emitir una notificación visual en la interfaz de usuario informando que la ventana de 24h ha expirado si Meta rechaza el mensaje saliente.

### [Minor] Observación 2: Sanitización de Nombre de Archivo
- **Qué**: En `app/actions/omnichannel.ts`, el nombre de archivo es sanitizado mediante `.replace(/[^a-zA-Z0-9._-]/g, "_")`.
- **Evaluación**: Excelente práctica preventiva que neutraliza por completo inyecciones de ruta o caracteres de traversal (`../`).

---

## 5. Pruebas y Desafío Adversarial (Adversarial Stress-Testing)

### Desafío 1: Token de Instagram vs Token de Facebook FanPage
- **Hipótesis**: Un token de usuario de Instagram (`IGAA...`) enviado a `graph.facebook.com` falla con `OAuthException 190`.
- **Comportamiento**: La bifurcación implementada en `sendInstagramDirectMediaMessage` evalúa si el token comienza con `EA` (Facebook Page). Si no (token `IGAA`), dirige la llamada a `https://graph.instagram.com/v22.0/me/messages`.
- **Resultado**: **PASS** (Meta aceptó la llamada y retornó ID de mensaje).

### Desafío 2: Tipado MIME de Archivos PDF y Documentos Office
- **Hipótesis**: Meta rechaza tipos de adjunto no soportados si un PDF se etiqueta como `image`.
- **Comportamiento**: La función `getInstagramMediaType` clasifica exhaustivamente formatos PDF, Office y texto a `"file"`, mientras que audios van a `"audio"` y videos a `"video"`.
- **Resultado**: **PASS**.

### Desafío 3: Rutas Relativas vs URLs Absolutas del Túnel
- **Hipótesis**: Si la Server Action genera `/uploads/instagram/...`, Meta Graph API y Evolution API no pueden descargar el archivo sin el host HTTPS del túnel.
- **Comportamiento**: `resolvePublicMediaUrl` en `lib/meta-graph-api.ts`, el pipeline de Zod en `lib/meta-whatsapp.ts` y el helper en `lib/evolution-api.ts` anteponen de forma determinista `https://omnichannel.farfalina.tech`.
- **Resultado**: **PASS**.

---

## 6. Aserciones Verificadas Independientemente

1. `npx tsx scripts/verify-outbound-media.ts`:
   - 24/24 aserciones superadas (**PASS**).
   - Llamada real a Meta Graph API v22.0 retornando `messageId` válido.
2. `npx tsc --noEmit`:
   - 0 errores de compilación TypeScript (**PASS**).
3. `npx tsx tests/multimedia-and-meta.test.ts`:
   - 19/19 aserciones superadas sin regresiones (**PASS**).

---

## 7. Conclusión

El trabajo presentado para el Milestone M1 cuenta con la más alta calidad técnica, cumple todas las políticas del proyecto, carece de vulnerabilidades de integridad y está listo para ser aprobado y fusionado en el flujo principal.
