# Informe de Auditoría y Encuesta: Módulos POS, Catálogo y Alquiler de Vestidos Carissma

**Fecha:** 2026-10-09  
**Explorador:** POS, Catalog & Carissma Rentals Explorer  
**Área de Trabajo:** `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_2`  
**Directiva de Integridad:** R4 Preservación Estricta del Servidor de Desarrollo Activo (0 reinicios, 0 detenciones).

---

## 1. Resumen Ejecutivo

Se realizó una inspección minuciosa y de sólo lectura de los módulos de Punto de Venta (POS Florería Farfalina y POS Carissma), Catálogo/E-Commerce (Arreglos florales y Vestidos de gala), y el ciclo de vida de Alquiler de Vestidos (Kanban de 6 fases, Calendario mensual, Agenda de devoluciones, Modales de inspección, Contratos y Motor de depreciación).

### Hallazgos Principales:
1. **Falta de Configuración de Viewport en Next.js:** En `app/layout.tsx` no se exporta la constante `viewport`, omitiendo `interactiveWidget: 'resizes-content'`, lo que provoca distorsiones visuales y desajustes de pantalla en dispositivos móviles cuando el teclado virtual aparece.
2. **Defecto Sistemático de Auto-Zoom Móvil (Inputs < 16px):** El 100% de los campos `<input>`, `<select>` y `<textarea>` en POS, Catálogo y Alquileres están configurados con clases `text-xs` (12px, 0.75rem) o `text-[11px]`. En navegadores móviles iOS Safari y Android Chrome, cualquier elemento interactivo con tamaño de fuente menor a 16px (1rem / `text-base`) dispara un zoom involuntario y forzado que rompe la navegación del operador.
3. **Punto de Venta no Ergonómico en Móvil (Carrito Desplazado al Fondo):** Tanto en Florería (`pos-cart-panel.tsx`) como en Carissma (`pos-view.tsx`), el carrito/ticket de venta se renderiza como una columna lateral en escritorio, pero en pantallas móviles (`< 1024px`) queda apilado verticalmente al final de toda la lista de productos/vestidos. El cajero debe desplazarse cientos de píxeles hacia abajo para ver qué agregó o pulsar el botón de cobro. Se carece de una barra inferior persistente (sticky cart bar), cajón táctil (drawer) o selector de pestañas (`[Catálogo] | [Ticket (N)]`).
4. **Ausencia de Teclado Numérico Táctil y Botones de Efectivo Rápido:** Ni en POS Florería ni en Carissma existe un teclado numérico táctil en pantalla ni denominaciones rápidas de billetes bolivianos (ej. Bs 10, Bs 20, Bs 50, Bs 100, Bs 200, "Monto Exacto"), obligando al cajero a invocar el teclado del sistema operativo para cada cobro.
5. **Zonas de Toque Críticamente Sub-dimensionadas (< 44x44px):** Botones de incremento/decremento de cantidad (`+` / `-`), eliminación (`Trash2`), píldoras de categorías, selectores de tallas y botones de acción en filas de tablas tienen alturas de entre 18px y 26px, violando la regla R3 y el estándar WCAG/Apple HIG de 44x44px.
6. **Colisión de Barra Flotante de Carrito con `MobileBottomNav`:** En el catálogo de Carissma (`components/carissma/catalog-view.tsx` línea 475), la barra flotante de orden tiene `fixed bottom-6 right-6 z-40 max-w-lg w-full`. Esta posición choca directamente contra la barra inferior `MobileBottomNav` (`fixed bottom-0 z-30` con altura ~60px) y provoca desbordamiento horizontal en pantallas de 360px-390px.
7. **5 Tablas Complejas sin Adaptación a Tarjetas Móviles:** Cinco vistas de datos densas (Inventario de insumos vivos, Historial de arqueos de caja, Control de stock de vestidos, Turnos archivados de Carissma y Agenda de devoluciones) se renderizan únicamente como elementos `<table>` con 7 a 9 columnas dentro de `overflow-x-auto`, sin alternativa de tarjetas apiladas en pantallas `< 768px`.

---

## 2. Auditoría Global: Viewport, Teclado Virtual y Safe Areas

### 2.1. Configuración de Viewport (`app/layout.tsx`)
- **Archivo:** `c:\Users\Lenovo\Desktop\floreria\app\layout.tsx` (Líneas 1-22)
- **Estado Actual:** Solo exporta `metadata: Metadata`. No existe exportación de `viewport: Viewport`.
- **Impacto:** En Next.js 14 App Router, la propiedad `interactiveWidget: 'resizes-content'` debe definirse en el objeto `viewport`. Al no existir, el teclado virtual móvil se superpone a los formularios sin redimensionar el contenedor de la aplicación, tapando botones de acción y campos de entrada.
- **Recomendación:** Exportar en `app/layout.tsx`:
  ```typescript
  import type { Metadata, Viewport } from "next";

  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    interactiveWidget: "resizes-content",
  };
  ```

### 2.2. Barra de Navegación Móvil y Safe-Area-Inset (`components/layout/mobile-bottom-nav.tsx`)
- **Archivo:** `c:\Users\Lenovo\Desktop\floreria\components\layout\mobile-bottom-nav.tsx` (Línea 26)
- **Estado Actual:** `className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-warm-200 lg:hidden px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden"`
- **Deficiencia:** No incluye padding para `safe-area-inset-bottom`. En terminales iPhone con barra de gestos inferior, los iconos quedan pegados o cubiertos por el indicador del sistema operativo.
- **Recomendación:** Agregar `pb-[calc(0.375rem+env(safe-area-inset-bottom))]` o `pb-safe`.

---

## 3. Módulo Punto de Venta (POS): Florería & Carissma

### 3.1. POS Florería Farfalina (`components/floreria/pos/pos-cart-panel.tsx` y `pos-view.tsx`)

#### A. Disposición Visual (Layout) Móvil vs Escritorio
- **Línea 184:** `<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`
- **Línea 185:** `<div className="lg:col-span-2 space-y-4">` (Catálogo de arreglos)
- **Línea 303:** `<div id="pos-checkout-section" className="bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4 h-fit scroll-mt-20">` (Ticket de cobro)
- **Deficiencia:** En móvil (`< 1024px`), el panel de checkout queda debajo de todos los arreglos florales. Un operador que añade un arreglo no ve si se añadió ni cuál es el total sin hacer scroll profundo.
- **Solución Propuesta:**
  1. Agregar un interruptor de vista en cabecera para móvil (`lg:hidden`):
     Pestañas móviles: `[Catálogo (${arrangementsList.length})]` vs `[Ticket (${saleItems.length}) - ${formatCurrency(finalTotal)}]`.
  2. Implementar una barra flotante inferior en móvil (`lg:hidden`) cuando `saleItems.length > 0`:
     Barra fija sobre la barra de navegación que muestra cantidad de productos, total a cobrar y botón táctil "Cobrar Ticket" que abre el drawer de cobro o hace scroll suave automático a `#pos-checkout-section`.

#### B. Ergonomía Táctil y Touch Targets
- **Botones de Cantidad (+ / -) (Líneas 408-416):**
  ```tsx
  <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-lg border border-warm-200">
    <button onClick={() => updateQty(item.id, -1)} className="text-warm-500 hover:text-warm-900">
      <Minus className="h-3 w-3" />
    </button>
    <span className="font-bold text-warm-900 px-1">{item.qty}</span>
    <button onClick={() => updateQty(item.id, 1)} className="text-warm-500 hover:text-warm-900">
      <Plus className="h-3 w-3" />
    </button>
  </div>
  ```
  *Deficiencia:* El tamaño del botón es de ~18x18px con iconos de 12x12px (`h-3 w-3`).
  *Recomendación:* Convertir a botones con área táctil mínima de 44x44px (o mínimo 40x40px táctil):
  `min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl active:bg-warm-100`.
- **Botón de Eliminar Ítem (Línea 420):**
  `<button onClick={() => removeItem(item.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>`
  *Deficiencia:* Área de toque de ~16x16px. Se presiona accidentalmente o se falla al pulsar.
  *Recomendación:* Asignar `min-h-[44px] min-w-[44px] flex items-center justify-center p-2`.
- **Píldoras de Categorías (Líneas 207-222):**
  `<button className="px-3 py-1 rounded-xl text-xs font-bold ...">` (Altura: ~26px).
  *Recomendación:* `px-4 py-2.5 text-xs sm:text-xs min-h-[44px] sm:min-h-[36px]`.

#### C. Bug de Auto-Zoom en Inputs (Tamaño de Fuente < 16px)
- **Línea 202 (Buscador):** `className="... text-xs font-medium ..."` (12px &rarr; AUTO-ZOOM)
- **Línea 336 (Nombre Cliente):** `className="... text-xs ..."` (12px &rarr; AUTO-ZOOM)
- **Línea 378 (Teléfono Cliente):** `className="... text-xs ..."` (12px &rarr; AUTO-ZOOM)
- **Línea 442 (Descuento Manual):** `className="... text-xs font-mono font-bold ..."` (12px &rarr; AUTO-ZOOM)
- **Recomendación:** Aplicar la regla canónica de tipografía responsiva en formularios:
  `text-base sm:text-xs md:text-sm` en todos los inputs. Al tener 16px (`text-base`) en móvil, los navegadores no disparan zoom.

#### D. Teclado Numérico y Denominaciones de Efectivo Rápido
- **Deficiencia:** Para ingresar el descuento o cobrar en efectivo, el cajero debe interactuar con el teclado nativo del teléfono, que cubre la mitad inferior de la pantalla.
- **Recomendación:**
  1. Agregar selector de billetes rápidos en efectivo: `[Bs 10] [Bs 20] [Bs 50] [Bs 100] [Bs 200] [Monto Exacto]`.
  2. Incorporar un teclado numérico táctil (numpad con teclas de 48x48px: 1-9, 0, 00, ., C) opcional en modal o drawer de cobro.

---

### 3.2. POS Carissma Alquileres (`components/carissma/pos-view.tsx`)

#### A. Disposición Visual (Layout)
- **Línea 598:** `<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">`
- **Línea 600:** `<div className="lg:col-span-7 space-y-4">` (Selección de vestidos)
- **Línea 706:** `<div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4">` (Orden de Alquiler Mostrador)
- **Deficiencia:** En móvil, la orden de alquiler queda debajo de la cuadrícula de vestidos. El cajero selecciona un vestido pero no ve el resumen de renta + garantía hasta bajar completamente.
- **Solución Propuesta:** Implementar pestañas en móvil (`lg:hidden`):
  `[Vestidos (${filteredDresses.length})]` vs `[Orden (${cart.length}) - ${formatCurrency(grandTotal)}]` con indicador visual de badge.

#### B. Ergonomía Táctil y Touch Targets
- **Filtro de Tallas (Líneas 635-647):**
  `<button className="px-2.5 py-0.5 rounded-lg text-xs font-bold ...">{sz}</button>`
  *Deficiencia:* Altura de apenas 22px. En pantallas táctiles de tablet o smartphone resulta difícil acertar entre tallas continuas (ej. S y M).
  *Recomendación:* `px-3.5 py-2 min-h-[44px] sm:min-h-[36px] min-w-[44px] text-xs font-bold`.
- **Eliminación de Prenda en Carrito (Líneas 787-792):**
  `<button onClick={() => removeFromCart(item.dress.id)} className="p-1 text-rose-500 hover:text-rose-700 rounded"><Trash2 className="h-3.5 w-3.5" /></button>`
  *Deficiencia:* Área táctil ~20x20px.
  *Recomendación:* `min-h-[44px] min-w-[44px] flex items-center justify-center p-2`.

#### C. Bug de Auto-Zoom en Inputs
- **Línea 628:** `input ... text-xs` &rarr; AUTO-ZOOM
- **Línea 724:** `input ... text-xs` &rarr; AUTO-ZOOM
- **Línea 748:** `input ... text-xs` &rarr; AUTO-ZOOM
- **Líneas 760, 769:** `input type="date" ... font-medium text-warm-900` &rarr; Requiere `text-base sm:text-xs`
- **Línea 845:** `input cashGiven ... text-xs font-bold` &rarr; AUTO-ZOOM
- **Líneas 907, 1165, 1177, 1187, 1233, 1243, 1254, 1268, 1311, 1321, 1367:** Todos `< 16px`.

#### D. Teclado Numérico y Denominaciones de Efectivo
- En la sección de cobro en efectivo (línea 834-854), sólo hay un campo `inputMode="decimal"` manual.
- **Recomendación:** Agregar botones de acceso rápido para efectivo entregado:
  `[Exacto (${grandTotal})] [Bs 100] [Bs 200] [Bs 500] [Bs 1000]`.

---

## 4. Módulo Catálogo & E-Commerce

### 4.1. Catálogo Florería Farfalina (`components/floreria/catalog-view.tsx`)

#### A. Cuadrícula de Productos y Desbordamiento
- **Líneas 257-425:**
  - El catálogo se estructura en `grid grid-cols-1 lg:grid-cols-3 gap-6`.
  - La cuadrícula de arreglos florales usa `grid grid-cols-1 sm:grid-cols-2 gap-4`.
  - Las tarjetas de producto son estables, pero los botones de acción como "Cotizar" (`px-3 py-1.5 text-xs`, altura 28px) y "Editar" (`p-1.5`, tamaño 26x26px) son inferiores a 44x44px.
  - El carrito lateral de cotización (líneas 375-424) queda apilado al fondo en móvil sin aviso visual para el usuario.

#### B. Modales de Creación y Edición (`new-arrangement-modal.tsx`, `edit-arrangement-modal.tsx`)
- **Altura de modal:** `max-h-[90vh]` sin `dvh`. Al abrir el teclado en smartphones, la altura de pantalla visible se reduce a ~40vh, provocando que los botones de "Guardar" y "Cancelar" queden inaccesibles debajo del teclado virtual.
- **Inputs:** `text-xs font-medium` (12px) en nombre, precio, descripción y selectores de insumos. Disparan auto-zoom en iOS Safari.
- **Recomendación:** Reemplazar `max-h-[90vh]` por `max-h-[85dvh]`, agregar `text-base sm:text-xs` en los inputs y asegurar `p-4 sm:p-6` para no recortar márgenes.

---

### 4.2. Catálogo Carissma Vestidos (`components/carissma/catalog-view.tsx`)

#### A. Colisión Crítica: Barra Flotante de Carrito vs `MobileBottomNav`
- **Línea 474-496:**
  ```tsx
  {/* Floating Cart Drawer Bar */}
  {cart.length > 0 && (
    <div className="fixed bottom-6 right-6 z-40 bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-amberGold-300 shadow-2xl flex items-center gap-4 max-w-lg w-full animate-in slide-in-from-bottom duration-200">
  ```
- **Deficiencias Detectadas:**
  1. `bottom-6` ubica la barra a 24px del borde inferior. La barra de navegación `MobileBottomNav` tiene altura de ~60px en `fixed bottom-0 z-30`. La barra del carrito se superpone directamente a los accesos directos de navegación y queda semitapada.
  2. `right-6` con `w-full` y `max-w-lg`: En smartphones de 360px a 390px de ancho, la combinación de `right-6` (24px a la derecha) con ancho completo empuja el borde izquierdo de la barra 24px fuera de la pantalla (`overflow-x` indeseado).
- **Corrección Recomendada:**
  ```tsx
  <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-40 max-w-lg sm:w-auto bg-white/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-amberGold-300 shadow-2xl flex items-center gap-3 sm:gap-4 animate-in slide-in-from-bottom duration-200">
  ```
  Esto garantiza que en móvil flote por encima de `MobileBottomNav` (a 80px del borde inferior), con márgenes equilibrados a ambos lados (`left-3 right-3`), sin generar desbordamiento lateral.

#### B. Tarjetas de Vestidos y Touch Targets
- **Líneas 441-467:**
  - Botón Editar: `p-2` con icono de 14px (~32x32px).
  - Botón Eliminar: `p-2` con icono de 14px (~32x32px).
  - Botón Alquilar: `py-2 px-3 text-xs` (~34px de altura).
  - Requieren `min-h-[44px]` para confort en pantallas táctiles.

---

## 5. Módulo Carissma Rentals & Ciclo de Vida de Vestidos

### 5.1. Tablero Kanban de 6 Fases (`components/carissma/orders/orders-kanban-board.tsx`)
- **Línea 29:** `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">`
- **Comportamiento Responsivo:**
  - En móvil (`< 768px`), las 6 columnas se apilan verticalmente.
  - En tablet (`768px - 1023px`), se muestran en 2 columnas; en laptop en 3 columnas; en monitor ultra-ancho en 6 columnas.
- **Deficiencias Táctiles:**
  - Botones de transición de etapa (Líneas 61, 95, 139, 173, 204): `py-1 text-[10px]` con altura de ~24px.
  - Botón de imprimir contrato (Línea 48): `<Printer className="h-3 w-3" />` sin padding, target de ~12x12px.
- **Recomendación:** Los botones de avance de fase deben contar con `py-2.5 px-3 min-h-[44px] text-xs font-bold` y el botón de impresión debe contar con `min-h-[40px] min-w-[40px] flex items-center justify-center p-2 rounded-lg`.

### 5.2. Calendario Mensual de Rentas (`components/carissma/orders/orders-calendar-view.tsx`)
- **Línea 78:** `<div className="grid grid-cols-7 gap-1 text-center text-xs">`
- **Comportamiento en Móvil:** En pantallas estrechas (360px), cada columna mide ~46px. Las celdas con `min-h-16` (64px) y `p-2` aprietan el texto de los eventos.
- **Recomendación:**
  - Usar `p-1 sm:p-2 min-h-12 sm:min-h-16` en las celdas del calendario.
  - Reducir encabezados de días a 1 letra en móvil: `Dom &rarr; D, Lun &rarr; L, Mar &rarr; M...` mediante `hidden sm:inline` y `inline sm:hidden`.
  - Botones de navegación de mes (`ChevronLeft`, `ChevronRight`): Ampliar a `min-h-[44px] min-w-[44px] flex items-center justify-center p-2`.

### 5.3. Agenda de Devoluciones (`components/carissma/orders/orders-agenda-table.tsx`)
- **Línea 56-129:** Se renderiza como `table` de 8 columnas dentro de `overflow-x-auto`.
- **Deficiencia:** Requiere desplazamiento horizontal obligatorio en móvil. No existe visualización alternativa de tarjetas.
- **Solución:** Implementar renderizado condicional:
  - Móvil (`block md:hidden`): Lista de tarjetas táctiles apiladas con folio, clienta, vestido, fechas, garantía y botones de acción de 44px.
  - Tablet/Escritorio (`hidden md:block`): Tabla completa actual.

### 5.4. Modales Operativos: Inspección, Nueva Reserva y Contrato
1. **`orders-inspection-modal.tsx` (Líneas 69-182):**
   - Todos los inputs y selects usan `p-2.5 text-xs` (12px) &rarr; Provocan zoom.
   - `max-h-[90vh]` &rarr; Debe usar `max-h-[85dvh]` para evitar que el teclado oculte el botón "Confirmar Recepción".
2. **`orders-new-booking-modal.tsx` (Líneas 94-236):**
   - Inputs de clienta, teléfono, fechas y tarifas usan `p-2.5 text-xs` &rarr; Provocan zoom.
   - Requiere `text-base sm:text-xs`.
3. **`chat-rental-drawer.tsx` (Líneas 190-425):**
   - Los filtros rápidos de categoría y talla tienen `text-[11px]` (11px).
   - El drawer debe tener `h-[100dvh]` en lugar de `h-full` para ajustarse perfectamente al viewport dinámico de dispositivos móviles.
4. **`rental-contract-modal.tsx` (Líneas 83-331):**
   - En el encabezado del modal (línea 109), el texto `"Imprimir / Guardar PDF (1 Página Carta)"` en botón `text-xs` desborda en pantallas `< 400px`.
   - Recomendación: En móvil mostrar solo el icono de impresora o texto resumido: `<Printer className="h-4 w-4" /><span className="hidden sm:inline">Imprimir / Guardar PDF</span>`.

---

## 6. Inventario de Tablas a Transformar en Tarjetas Móviles

Se identificaron **5 tablas principales** que deben transformarse a vista de tarjetas en pantallas móviles (`< 768px`) conservando su formato tabular en tablets y escritorio (`>= 768px`):

| # | Archivo | Líneas | Columnas | Contenido | Solución Móvil Requerida |
|---|---|---|---|---|---|
| **1** | `components/floreria/pos/pos-stock-table.tsx` | 123-238 | 9 columnas | Insumos vivos, unidad, disponible, costo, frescura, acciones | Card con nombre, tipo, stock disponible en badge grande, badge de frescura/vida útil y botones "Re-Stock" y "Merma" de ancho completo (>=44px). |
| **2** | `components/floreria/pos/pos-shift-drawer.tsx` | 162-216 | 8 columnas | Cierres de caja archivados, cajero, ventas, declarado, discrepancia | Card con fecha, cajero, desglose de ventas en grid 2x2, badge de discrepancia y botón de exportar PDF de 44px. |
| **3** | `components/carissma/pos-view.tsx` (Tab Stock) | 954-1030 | 8 columnas | Stock de vestidos, marca, talla, tarifa, garantía, usos, estado, acciones | Card con foto/miniatura, nombre, talla, tarifa + garantía, selector de estado táctil y botones de editar/eliminar de 44px. |
| **4** | `components/carissma/pos-view.tsx` (Tab Arqueo) | 1096-1139 | 7 columnas | Turnos archivados de Carissma, cajero, apertura, alquileres, cierre, informe | Card con fecha, cajero, resumen financiero, badge de discrepancia y botón "Ver Informe" táctil. |
| **5** | `components/carissma/orders/orders-agenda-table.tsx` | 56-129 | 8 columnas | Agenda de devoluciones, contrato, clienta, vestido, fechas, tarifa, estado, acciones | Card con folio de contrato, clienta con teléfono clickeable (`tel:`), vestido, fecha límite con alerta de mora y botón "Recibir" de 44px. |

---

## 7. Plan de Acción y Recomendaciones Técnicas Concretas

### 7.1. Regla Universal de Prevención de Auto-Zoom
En todos los campos de entrada de formularios (`input`, `select`, `textarea`):
- **Antes:** `className="... text-xs ..."`
- **Después:** `className="... text-base sm:text-xs md:text-sm ..."`
- **Razón:** Los navegadores móviles activan zoom involuntario cuando `font-size < 16px`. Con `text-base` (16px) como clase base móvil y escalado a `sm:text-xs` (12px) a partir de 640px, el zoom se desactiva de forma nativa sin afectar el diseño compacto de escritorio.

### 7.2. Regla Universal de Ergonomía Táctil (Touch Targets >= 44x44px)
Para todo elemento interactivo (`button`, enlaces pequeños, selectores):
- Asegurar `min-h-[44px] min-w-[44px]` en móvil o envolver iconos con contenedor de padding adecuado (`p-2.5 sm:p-1.5`).
- En controles de cantidad (`Minus` / `Plus`), separar visualmente los botones y asignar dimensiones mínimas de 40x40px o 44x44px con respuesta háptica/visual `active:scale-95`.

### 7.3. Unidades de Viewport Dinámicas para Teclado Móvil
En todos los modales y drawers:
- Reemplazar `max-h-[90vh]` / `h-full` por `max-h-[85dvh]` / `h-[100dvh]` o `max-h-[90svh]`.
- Asignar `overflow-y-auto` en el cuerpo del formulario y fijar el pie de botones (`sticky bottom-0` con fondo sólido o backdrop blur) para que el botón de confirmación siempre sea visible sin importar la altura del teclado virtual.

### 7.4. Módulo POS: Experiencia Móvil de Primer Nivel
1. **Interruptor de Pestaña Móvil:** En pantallas `< 1024px`, incluir selector persistente superior:
   - `[Catálogo de Arreglos/Prendas]`
   - `[Ticket de Venta (N ítems) — Bs Total]`
2. **Barra Resumen Inferior:** Cuando el carrito tenga al menos 1 ítem, desplegar una barra flotante en la parte inferior (sobre la navegación móvil) con botón de llamada a la acción para cobrar de inmediato.
3. **Botones Rápidos de Denominación de Efectivo:** En la sección de cobro en efectivo, desplegar atajos para denominaciones comunes (`[Monto Exacto]`, `[Bs 20]`, `[Bs 50]`, `[Bs 100]`, `[Bs 200]`).

---

## 8. Verificación y Preservación del Servidor (R4)

- **Verificación de Tipos TypeScript:**
  Se ejecutó de forma independiente en proceso secundario:
  ```powershell
  npx tsc --noEmit
  ```
  **Resultado:** Código de salida `0` (0 errores de compilación TypeScript).
- **Preservación del Servidor:**
  El proceso activo `next dev` en el puerto 3000 y el túnel Cloudflare permanecen 100% operativos e intactos, sin ninguna interrupción.

---
*Reporte preparado para la fase de implementación por el equipo de ingeniería.*
