# TEST_READY.md: Suite de Pruebas E2E Responsive y Ergonomía Móvil Lista

**Estado:** PUBLICADO / LISTO PARA VERIFICACIÓN CONTINUA (TEST READY)  
**Fecha:** 2026-10-09T19:00:00Z  
**Autor:** E2E Test Writer (`teamwork_preview_test_writer_e2e`)  
**Archivos Generados:**
- Especificación de Infraestructura: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\TEST_INFRA.md`
- Ejecutor Automatizado 4-Tier: `c:\Users\Lenovo\Desktop\floreria\scripts\verify-responsive-e2e.mjs`
- Reporte de Disponibilidad: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\TEST_READY.md`

---

## 1. Resumen de la Suite de Pruebas

Se ha implementado e integrado formalmente la suite automatizada de pruebas de diseño responsive y ergonomía móvil para tablets (768px – 1024px) y smartphones (360px – 430px) de la plataforma SaaS Florería Farfalina y Alquiler de Vestidos Carissma.

La suite sigue una estructura rigurosa de **4 Niveles (4-Tier Requirement-Driven Architecture)** y se ejecuta mediante un script Node.js ESM nativo que opera con **preservación total del servidor de desarrollo activo (`next dev`) en el puerto 3000 (Regla R4: 0 detenciones, 0 reinicios)**.

---

## 2. Cómo Ejecutar la Suite de Pruebas

### Comando Estándar (Modo Gate CI/CD)
```bash
node scripts/verify-responsive-e2e.mjs
```
- Evalúa los 4 niveles en secuencia.
- Retorna código de salida `0` si todas las pruebas pasan.
- Retorna código de salida `1` si existe algún fallo, bloqueando el avance si las condiciones de aceptación no se cumplen.

### Modo Auditoría y Reporte Diagnóstico
```bash
node scripts/verify-responsive-e2e.mjs --audit
```
- Imprime la matriz completa de resultados con detalles diagnósticos.
- Retorna código de salida `0` para auditorías intermedias mientras los módulos están en desarrollo activo.

### Filtrado por Nivel Específico
```bash
node scripts/verify-responsive-e2e.mjs --tier=1
node scripts/verify-responsive-e2e.mjs --tier=2
node scripts/verify-responsive-e2e.mjs --tier=3
node scripts/verify-responsive-e2e.mjs --tier=4
```

### Verificación de Tipos TypeScript (Aislado)
```bash
npx tsc --noEmit
```

---

## 3. Matriz de Cobertura de los 4 Niveles

| Tier | ID | Nombre de la Prueba | Archivo Evaluado | Estado Actual |
|---|---|---|---|:---:|
| **Tier 1** | `T1.1` | Viewport export en App Router (`resizes-content`, `width: device-width`) | `app/layout.tsx` | **PASS** |
| **Tier 1** | `T1.1-LIVE` | Sonda HTTP en vivo del `<meta name="viewport">` en dev server activo | `http://localhost:3000` | **PASS** |
| **Tier 1** | `T1.2` | Prevención de auto-zoom: `font-size: 16px !important` en `< 768px` | `app/globals.css` | **PASS** |
| **Tier 1** | `T1.3` | Safe-Area insets en `MobileBottomNav`, `WorkspaceLayout` y `ToastContainer` | Layouts & Nav | **PASS** |
| **Tier 1** | `T1.4` | Ergonomía táctil mínima (>= 44x44px) en navegación y cabecera | `MobileBottomNav`, `TopHeader` | **PASS** |
| **Tier 1** | `T1.5` | Renderizado dual (Tabla vs Cards móviles) en 9 tablas densas | POS, Agenda, Contabilidad | **FAIL** *(Pendiente M2-M4)* |
| **Tier 2** | `T2.1` | Resolución móvil 360px sin contenedores rígidos desbordantes | `orders-view.tsx`, Layouts | **FAIL** *(min-w-[620px])* |
| **Tier 2** | `T2.2` | Coordenadas de barra flotante de carrito sobre `MobileBottomNav` | `carissma/catalog-view.tsx` | **FAIL** *(bottom-6)* |
| **Tier 2** | `T2.3` | Contención de textos largos (`truncate`, `break-words`, `min-w-0`) | CRM, POS, Orders | **FAIL** *(CRM names)* |
| **Tier 3** | `T3.1` | Teclado virtual + Unidades dinámicas (`interactiveWidget` + `dvh`) | `app/layout.tsx`, Modales | **PASS** |
| **Tier 3** | `T3.2` | Jerarquía Z-Index (Toast: z-50 > Header: z-40 > Nav: z-30) | Shell UI Components | **PASS** |
| **Tier 3** | `T3.3` | Conmutación segmentada de pestañas en Kanban móvil | `orders-view.tsx`, `orders-kanban-board.tsx` | **PASS** |
| **Tier 4** | `T4.1` | Flujo POS móvil: Acceso directo a checkout y controles táctiles | Florería y Carissma POS | **PASS** |
| **Tier 4** | `T4.2` | Transición táctil de pedidos en Kanban logístico móvil | `orders-view.tsx` | **PASS** |
| **Tier 4** | `T4.3` | Compositor omnicanal móvil con safe-area y prevención de zoom | `unified-omnichannel-view.tsx` | **PASS** |

**Balance Actual de Línea Base:**
- **Total Pruebas:** 15
- **Aprobadas (PASS):** 11 (73.3%)
- **Pendientes / Fallos de Implementación (FAIL):** 4 (26.7%)

---

## 4. Defectos de Implementación Detectados para Escalamiento

Los siguientes 4 defectos fueron detectados objetivamente por la suite de pruebas y corresponden al alcance asignado a los agentes de implementación de los hitos M2, M3 y M4:

1. **Defecto E2E-D1 (Asignado a M2 & M4): Falta de Renderizado Dual en 9 Tablas Complejas (`T1.5`)**
   - *Impacto:* Tablas con 7 a 9 columnas en `pos-stock-table.tsx`, `pos-shift-drawer.tsx`, `orders-agenda-table.tsx`, `accounting-view.tsx` y `pos-view.tsx` requieren desplazamiento horizontal obligatorio en pantallas móviles `< 768px`.
   - *Solución Requerida:* Implementar `<div className="hidden md:block">...table...</div>` para desktop y `<div className="block md:hidden space-y-3">...cards...</div>` para smartphones.

2. **Defecto E2E-D2 (Asignado a M3): Desbordamiento Rígido en Vista Calendario de Pedidos (`T2.1`)**
   - *Impacto:* `components/floreria/orders-view.tsx` contiene `min-w-[620px]` sin vista adaptada a lista móvil, causando estiramiento horizontal en teléfonos de 360px a 430px.
   - *Solución Requerida:* Reemplazar o envolver con vista compacta por día o selector responsivo en pantallas pequeñas.

3. **Defecto E2E-D3 (Asignado a M2): Colisión de Barra Flotante de Carrito en Catálogo Carissma (`T2.2`)**
   - *Impacto:* `components/carissma/catalog-view.tsx` ubica la barra de carrito en `bottom-6`, colisionando directamente contra `MobileBottomNav` (`bottom-0` altura ~60px), y usa `right-6 w-full` que causa desbordamiento en smartphones estrechos.
   - *Solución Requerida:* Modificar coordenadas a `bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6`.

4. **Defecto E2E-D4 (Asignado a M3): Desbordamiento de Texto en Tarjetas de Clientes CRM (`T2.3`)**
   - *Impacto:* En `components/floreria/crm-view.tsx` y `components/carissma/crm-view.tsx`, nombres extensos de clientas o notas no usan `truncate` / `break-words`, estirando las tarjetas fuera de su contenedor.
   - *Solución Requerida:* Añadir `truncate` y `min-w-0` a los encabezados de cliente.

---

## 5. Garantía de Cumplimiento de Restricciones

- **Restricción Crítica R4:** Cumplida al 100%. El proceso de desarrollo `next dev` en VS Code se mantuvo en ejecución continua e ininterrumpida. La sonda HTTP en vivo confirmó la disponibilidad y correcta entrega de los metadatos del viewport sin reiniciar la instancia.
- **Tipado TypeScript:** `npx tsc --noEmit` verificado de forma autónoma con 0 errores de compilación.
- **Integridad de Código Fuente:** El rol de E2E Test Writer respetó estrictamente las fronteras de archivos: únicamente se crearon y modificaron scripts de prueba y especificaciones de infraestructura.
