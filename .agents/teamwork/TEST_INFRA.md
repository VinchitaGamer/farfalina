# TEST_INFRA.md: Infraestructura de Pruebas E2E Responsive y Ergonomía Móvil

**Proyecto:** SaaS Florería Farfalina & Alquiler de Vestidos Carissma  
**Versión:** 1.0.0 (Release Responsive Mobile & Tablet First)  
**Autor:** E2E Test Writer (`teamwork_preview_test_writer_e2e`)  
**Fecha:** 2026-10-09  
**Estado:** ACTIVO / ESPECIFICACIÓN CANÓNICA  

---

## 1. Resumen Ejecutivo y Arquitectura

Esta infraestructura define el marco formal de pruebas de extremo a extremo (E2E), límites de tolerancia táctil, análisis estático y dinámico de diseño responsive para pantallas de smartphones (360px – 430px) y tablets (768px – 1024px), garantizando el cumplimiento irrestricto de los requisitos R1, R2, R3 y R4 de `ORIGINAL_REQUEST.md`.

### Principios Rectores:
1. **Preservación Estricta del Servidor de Desarrollo Activo (R4):** Queda terminantemente prohibido detener, reiniciar, matar o interferir con el proceso `next dev` en ejecución en el puerto 3000. Todas las pruebas automatizadas se ejecutan como scripts Node.js aislados (`scripts/verify-responsive-e2e.mjs`) e invocaciones no intrusivas (`npx tsc --noEmit`).
2. **Evaluación de Caja Opaca y Basada en Especificación:** Las pruebas derivan sus valores esperados directamente de las especificaciones de diseño, contratos de componentes y estándares de accesibilidad (Apple Human Interface Guidelines, WCAG 2.1 AA y CSS Viewport & Mobile specs), sin acomodarse a imperfecciones de implementación.
3. **Estructura en 4 Niveles (4-Tier Architecture):**
   - **Tier 1:** Cobertura Funcional de Características (Feature Coverage).
   - **Tier 2:** Casos Límite y Esquinas (Boundary & Corner Cases).
   - **Tier 3:** Combinaciones Entre Módulos (Cross-Feature Combinations).
   - **Tier 4:** Escenarios de Aplicación Real (Real-World Application Scenarios).

---

## 2. Especificación Detallada de los 4 Niveles (4-Tier Test Suite)

### Tier 1 — Cobertura Funcional de Características (Feature Coverage)

| ID | Característica Evaluada | Archivo / Componente | Criterio de Aceptación Autorizado |
|---|---|---|---|
| **T1.1** | Exportación de Viewport Next.js 14+ | `app/layout.tsx` | Debe existir `export const viewport: Viewport` con `width: 'device-width'`, `initialScale: 1` y `interactiveWidget: 'resizes-content'`. |
| **T1.2** | Guardia de Tamaño de Fuente en Inputs Móviles (>= 16px) | `app/globals.css` | Regla `@layer base` en `@media (max-width: 767px)` forzando `font-size: 16px !important` en `input, select, textarea` para eliminar el auto-zoom de iOS Safari y Android. |
| **T1.3** | Integración de Safe-Area Inset Bottom | `components/layout/mobile-bottom-nav.tsx`, `app/(workspace)/layout.tsx`, `components/ui/toast.tsx` | Uso explícito de `env(safe-area-inset-bottom)` o clases `.pb-safe` para evitar colisiones con el home indicator gestual. |
| **T1.4** | Ergonomía Táctil en Elementos Interactivos (>= 44px) | `MobileBottomNav`, `TopHeader`, POS tickets, controles de cantidad | Elementos interactivos (botones, pestañas, contadores `+`/`-`, iconos de eliminar) deben contar con dimensiones mínimas de toque de 44x44px (`min-h-[44px] min-w-[44px]`). |
| **T1.5** | Transformación Dual: Tabla a Tarjetas en 9 Vistas Densas | Inventario Insumos, Agenda Devoluciones, Pedidos Consolidados, Arqueos, CRM y Garantías | Renderizado condicional dual: vista tabular para tablet/escritorio (`hidden md:block` / `hidden md:table`) y vista de tarjetas táctiles apiladas para smartphones (`block md:hidden` / `grid md:hidden`). |

#### Inventario de las 9 Tablas Críticas Auditadas:
1. **Florería POS - Insumos Vivos:** `components/floreria/pos/pos-stock-table.tsx`
2. **Florería POS - Turnos Archivados:** `components/floreria/pos/pos-shift-drawer.tsx`
3. **Carissma Agenda de Devoluciones:** `components/carissma/orders/orders-agenda-table.tsx`
4. **Florería Contabilidad - Egresos:** `components/floreria/accounting-view.tsx`
5. **Florería Contabilidad - Pedidos Consolidados:** `components/floreria/accounting-view.tsx`
6. **Florería Contabilidad - Arqueos de Caja:** `components/floreria/accounting-view.tsx`
7. **Carissma Contabilidad - Control de Garantías:** `components/carissma/accounting-view.tsx`
8. **Carissma POS - Stock de Vestidos:** `components/carissma/pos-view.tsx`
9. **Carissma POS / Contabilidad - Turnos de Alquiler:** `components/carissma/pos-view.tsx` / `accounting-view.tsx`

---

### Tier 2 — Casos Límite y Esquinas (Boundary & Corner Cases)

| ID | Escenario Límite | Condiciones de Prueba | Criterio de Éxito |
|---|---|---|---|
| **T2.1** | Resoluciones Móviles Extremas (360px – 1024px) | Simulación geométrica de: 360px (Samsung Galaxy A/J), 390px (iPhone 12-15), 430px (iPhone Pro Max), 768px (iPad portrait), 1024px (iPad landscape). | Ausencia de contenedores rígidos (`w-[>360px]` sin `max-w-full`), inexistencia de `overflow-x` no deseado en el body y layout raíz. |
| **T2.2** | Estado de Carrito Vacío vs Carrito Poblado | Carrito flotante en Catálogo Carissma (`components/carissma/catalog-view.tsx`) y POS Florería (`pos-cart-panel.tsx`). | Con 0 ítems no debe obstruir la navegación. Con 1+ ítems, la barra flotante debe ubicarse sobre la navegación móvil con márgenes balanceados (`left-3 right-3 sm:left-auto sm:right-6`). |
| **T2.3** | Nombres y Direcciones con Longitud Extrema | Tarjetas de clientes, descripciones de arreglos, notas de pedidos en CRM, POS y Kanban. | Implementación de `truncate`, `break-words`, `line-clamp-2` y `min-w-0` previniendo desbordamientos horizontales de las tarjetas. |

---

### Tier 3 — Combinaciones Entre Módulos (Cross-Feature Combinations)

| ID | Combinación Interactiva | Desafío Técnico | Verificación |
|---|---|---|---|
| **T3.1** | Teclado Virtual + Alturas Dinámicas (`dvh`) | La apertura del teclado reduce el viewport útil en 280px–350px. Si el contenedor usa `100vh` estático, los botones de acción inferior quedan inaccesibles. | Contenedor raíz, modales y drawers usan `100dvh`, `max-h-[85dvh]` o `max-h-[90dvh]` combinados con `interactiveWidget: 'resizes-content'`. |
| **T3.2** | Jerarquía de Apilamiento (Z-Index & Coexistencia) | Coexistencia en pantalla de `MobileBottomNav`, notificaciones `ToastContainer` y barras flotantes de carrito. | `ToastContainer` (`z-50`) elevado a `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]` o `bottom-20` para no tapar `MobileBottomNav` (`z-30`) ni la barra de carrito (`z-40`). |
| **T3.3** | Tableros Kanban: Conmutación de Pestañas Móviles vs Multi-Columna | En pantallas `< 768px`, las 3 columnas de Florería o las 6 etapas de Carissma no deben forzar desplazamiento horizontal ciego. | Presencia de selector segmentado de pestañas (`segmented control / tabs`) en móvil conmutando la etapa visible, mientras en desktop (`md:grid`) se exhiben todas las columnas en paralelo. |

---

### Tier 4 — Escenarios de Aplicación Real (Real-World Application Scenarios)

| ID | Flujo de Usuario | Simulación de Uso | Verificación |
|---|---|---|---|
| **T4.1** | Venta POS Móvil Completa | El cajero añade un producto en Florería o Carissma POS en smartphone. | El cajero conmuta instantáneamente entre `[Catálogo]` y `[Ticket / Cobro]` sin tener que deslizarse por debajo de todo el catálogo. Opciones de billetes rápidos (`Bs 10`, `20`, `50`, `100`, `200`, `Exacto`). |
| **T4.2** | Transición de Estado en Kanban Logístico Móvil | El despachador actualiza un pedido de "En preparación" a "En camino" o "Entregado" con una sola mano. | Botones de transición accesibles con área de toque `>= 44px` y respuesta táctil inmediata sin zooms involuntarios. |
| **T4.3** | Redacción y Envío de Mensaje Omnicanal en Móvil | El asesor abre el chat unificado, redacta respuesta y adjunta archivo con teclado virtual activo. | Barra de redacción se ancla al borde superior del teclado con `dvh`, margen seguro para home indicator (`pb-safe`), input `>= 16px` y botones de envío ergonómicos. |

---

## 3. Arquitectura del Ejecutor Automatizado (`scripts/verify-responsive-e2e.mjs`)

El ejecutor está construido como un módulo ECMAScript nativo (`.mjs`) sin dependencias de compilación adicionales. Puede ejecutarse en cualquier entorno con Node.js 18+.

### Modos de Ejecución:
1. **Modo Estándar (Test Runner CI/CD):**
   ```bash
   node scripts/verify-responsive-e2e.mjs
   ```
   Ejecuta la totalidad de pruebas de los 4 niveles. Retorna código de salida `0` si el 100% de las pruebas pasa, o código `1` ante cualquier fallo.

2. **Modo Auditoría Forense / Reporte:**
   ```bash
   node scripts/verify-responsive-e2e.mjs --audit
   ```
   Genera el desglose completo del estado de cada prueba y retorna código `0` para permitir inspecciones diagnósticas intermedias.

3. **Modo Filtrado por Nivel:**
   ```bash
   node scripts/verify-responsive-e2e.mjs --tier=1
   ```

### Capacidades de Inspección Híbrida:
- **Inspección Estática Estructural (AST / Regex Tokenizer):** Analiza directamente el código fuente de los componentes, hojas de estilo Tailwind y layouts para asegurar la presencia de directivas, clases utilitarias y estructuras HTML.
- **Sonda Dinámica HTTP (Zero-Disruption Probe):** Si el servidor de desarrollo local `http://localhost:3000` está activo, consulta de forma no destructiva la cabecera HTML emitida por Next.js para corroborar la etiqueta `<meta name="viewport">` real servida al cliente.

---

## 4. Oráculos de Verificación Autorizados

- **Next.js 14 App Router Viewport API:** `next/types` y documentación oficial Next.js 14.2+.
- **W3C Mobile Accessibility Guidelines:** Minimum Target Size (44 x 44 CSS pixels).
- **CSS Values and Units Module Level 4:** Dynamic Viewport Units (`dvh`, `svh`, `lvh`).
- **Apple Human Interface Guidelines:** Adaptability and Safe Areas (`env(safe-area-inset-*)`).
- **Base de Datos y Modelos:** `prisma/schema.prisma` y `prisma/dev.db`.

---

## 5. Condiciones de Invalidación

La suite de pruebas declarará un estado de fallo (INVALIDACIÓN) si:
1. Se detecta el intento de reiniciar o detener el proceso de desarrollo activo (violación de R4).
2. Se introduce la palabra clave `any` en TypeScript o interfaces manuales sin Zod.
3. El viewport carece de `interactiveWidget: 'resizes-content'`.
4. Los campos interactivos en pantallas móviles son inferiores a 16px, reactivando el auto-zoom en iOS Safari.
5. Alguna de las 9 tablas de datos densas no cuenta con su vista correspondiente en tarjetas móviles (`block md:hidden`).
