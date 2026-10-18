# Handoff Report — Explorer Survey 2: POS, Catalog, and Carissma Rentals

**Date:** 2026-10-09  
**Agent:** POS, Catalog & Carissma Rentals Explorer  
**Working Directory:** `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_2`  
**Handoff Type:** Hard (Survey Phase Complete)

---

## 1. Observation

### Observation 1: Ausencia de exportación de viewport en `app/layout.tsx`
- **Archivo:** `c:\Users\Lenovo\Desktop\floreria\app\layout.tsx`
- **Líneas 4-7:**
  ```typescript
  export const metadata: Metadata = {
    title: "Plataforma SaaS | Florería Farfalina & Alquiler Vestidos Carissma",
    description: "Sistema integral de gestión ERP, CRM, POS Omnicanal y Alquiler de Vestidos con Precios Dinámicos",
  };
  ```
- **Detalle observado:** El archivo únicamente exporta `metadata`. No existe `export const viewport: Viewport`, omitiendo la directiva de Next.js `interactiveWidget: 'resizes-content'` estipulada en R2 del requerimiento.

### Observation 2: Defecto masivo de Auto-Zoom en campos de entrada (`font-size < 16px`)
Se observaron clases `text-xs` (12px = 0.75rem) y `text-[11px]` en todos los campos `<input>`, `<select>` y `<textarea>` inspeccionados:
- `components/floreria/pos/pos-cart-panel.tsx`:
  - Línea 202: `className="w-full pl-8 pr-3 py-1.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium text-warm-900..."`
  - Línea 336: `className="w-full p-2 text-xs bg-white border border-warm-200 rounded-lg text-warm-900..."`
  - Línea 378: `className="w-full p-2 text-xs bg-white border border-warm-200 rounded-lg text-warm-900..."`
  - Línea 442: `className="w-20 p-1 text-right text-xs bg-warm-50 border border-warm-200 rounded-lg text-warm-900 font-mono font-bold..."`
- `components/carissma/pos-view.tsx`:
  - Línea 628: `className="w-full pl-9 pr-3 py-1.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium..."`
  - Línea 723: `className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs font-medium..."`
  - Línea 747: `className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl text-xs..."`
  - Línea 845: `className="w-full p-2 bg-warm-50 border border-warm-200 rounded-xl font-mono text-xs font-bold..."`
- `components/floreria/new-arrangement-modal.tsx`:
  - Línea 217: `className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900..."`
  - Línea 309: `className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs..."`
  - Línea 335: `className="w-full p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs..."`
- `components/carissma/orders/orders-new-booking-modal.tsx`:
  - Línea 109, 129, 139, 152, 162, 176, 187: Todos inputs con texto de 12px dentro de formulario con `text-xs`.
- `components/carissma/orders/orders-inspection-modal.tsx`:
  - Líneas 114, 126, 144, 158: `text-xs` en penalización y selects de garantía.
- `components/carissma/chat-rental-drawer.tsx`:
  - Líneas 228, 237: `text-xs`; Líneas 262, 267, 278: `text-[11px]`.
- `components/carissma/pricing-engine-view.tsx`:
  - Líneas 196, 207, 279, 296, 313, 327, 341: `text-xs font-bold text-warm-900`.

### Observation 3: Carrito POS desfasado y apilado al fondo en pantallas móviles (< 1024px)
- **Florería:** En `components/floreria/pos/pos-cart-panel.tsx` línea 184:
  `<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`
  `<div className="lg:col-span-2 space-y-4">` (cuadrícula de arreglos de mostrador)
  `<div id="pos-checkout-section" className="bg-white p-4 sm:p-5 rounded-2xl border border-warm-200 shadow-sm space-y-4 h-fit scroll-mt-20">` (ticket de cobro)
- **Carissma:** En `components/carissma/pos-view.tsx` línea 598:
  `<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">`
  `<div className="lg:col-span-7 space-y-4">` (cuadrícula de vestidos)
  `<div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-warm-200 shadow-sm space-y-4">` (orden de alquiler)
- **Detalle observado:** En ambos módulos, no existe navegación móvil (pestañas o drawer o sticky bottom bar). En teléfonos móviles (`< 768px`), el operador tiene que desplazarse verticalmente hasta el final de todos los productos para ver los ítems cargados al ticket o para presionar el botón de cobro.

### Observation 4: Botones con Touch Targets muy inferiores a 44x44px
- `components/floreria/pos/pos-cart-panel.tsx` (Líneas 409-415):
  ```tsx
  <button onClick={() => updateQty(item.id, -1)} className="text-warm-500 hover:text-warm-900">
    <Minus className="h-3 w-3" />
  </button>
  <span className="font-bold text-warm-900 px-1">{item.qty}</span>
  <button onClick={() => updateQty(item.id, 1)} className="text-warm-500 hover:text-warm-900">
    <Plus className="h-3 w-3" />
  </button>
  ```
  Los botones `Minus` y `Plus` tienen un área interactiva de ~18x18px (icono 12px sin padding).
- `components/floreria/pos/pos-cart-panel.tsx` (Línea 420):
  Botón de basura: `<button onClick={() => removeItem(item.id)} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>` (~18x18px).
- `components/carissma/pos-view.tsx` (Líneas 637-646):
  Selector de tallas: `<button className="px-2.5 py-0.5 rounded-lg text-xs font-bold ...">{sz}</button>` (altura ~22px).
- `components/carissma/pos-view.tsx` (Línea 787):
  Eliminación en carrito: `<button onClick={() => removeFromCart(item.dress.id)} className="p-1 text-rose-500 hover:text-rose-700 rounded"><Trash2 className="h-3.5 w-3.5" /></button>` (~20x20px).
- `components/carissma/orders/orders-kanban-board.tsx`:
  Líneas 61, 95, 139, 173, 204: Botones de avance de etapa usan `py-1 text-[10px]` (altura ~24px).
  Línea 48: Botón de contrato `<Printer className="h-3 w-3 text-warm-400 hover:text-warm-700" />` (área de ~12x12px).
- `components/floreria/pos/pos-stock-table.tsx` (Líneas 208-230):
  Acciones de Re-Stock y Merma usan `px-2.5 py-1 text-[11px]` (altura ~24px). Basura `p-1` con icono 14px (~22x22px).

### Observation 5: Inexistencia de teclado numérico táctil ni atajos de billetes rápidos
- En `components/floreria/pos/pos-cart-panel.tsx` y en `components/carissma/pos-view.tsx`, no existe ningún teclado numérico táctil (numpad) en pantalla ni botones rápidos para montos de efectivo frecuentes (Bs 10, Bs 20, Bs 50, Bs 100, Bs 200, Exacto). Todo monto depende de invocar el teclado virtual del dispositivo móvil.

### Observation 6: Colisión de Barra Flotante de Carrito con `MobileBottomNav`
- **Archivo:** `components/carissma/catalog-view.tsx` (Líneas 474-476):
  ```tsx
  {cart.length > 0 && (
    <div className="fixed bottom-6 right-6 z-40 bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-amberGold-300 shadow-2xl flex items-center gap-4 max-w-lg w-full animate-in slide-in-from-bottom duration-200">
  ```
- **Detalle observado:** `bottom-6` posiciona la barra a 24px de la base. En dispositivos móviles, `MobileBottomNav` ocupa `fixed bottom-0 z-30` con altura aproximada de 60px. Ambas barras chocan y los botones se superponen. Adicionalmente, `right-6` con `w-full` en pantallas de 360px desborda 24px hacia la izquierda fuera de la pantalla.

### Observation 7: 5 Tablas con desplazamiento horizontal forzado en móvil sin tarjetas táctiles
1. `components/floreria/pos/pos-stock-table.tsx` (Líneas 123-238): 9 columnas en `overflow-x-auto`.
2. `components/floreria/pos/pos-shift-drawer.tsx` (Líneas 162-216): 8 columnas en `overflow-x-auto`.
3. `components/carissma/pos-view.tsx` Tab Stock (Líneas 954-1030): 8 columnas en `overflow-x-auto`.
4. `components/carissma/pos-view.tsx` Tab Register (Líneas 1096-1139): 7 columnas en `overflow-x-auto`.
5. `components/carissma/orders/orders-agenda-table.tsx` (Líneas 56-129): 8 columnas en `overflow-x-auto`.

### Observation 8: Verificación de tipos TypeScript inicial
- **Comando ejecutado:** `npx tsc --noEmit`
- **Resultado:** Código de salida `0`, sin errores de compilación previos. Servidor de desarrollo `next dev` preservado intacto.

---

## 2. Logic Chain

1. **Desde Observation 1:**
   - La especificación R2 exige: "Configurar el viewport de Next.js (`width=device-width`, `initial-scale=1`, `interactiveWidget: 'resizes-content'`)".
   - Al no estar definido en `app/layout.tsx`, el navegador no redimensiona el área interactiva cuando el teclado móvil se abre, causando que el teclado tape los botones de confirmación y formularios.
   - *Inferencia:* Es necesario agregar `export const viewport: Viewport = { ... }` en `app/layout.tsx`.

2. **Desde Observation 2:**
   - iOS Safari y Android activan el zoom de accesibilidad automático cada vez que un campo interactivo (`input`, `select`, `textarea`) con `font-size < 16px` recibe foco.
   - En todos los archivos analizados, los inputs usan `text-xs` (12px) o `text-[11px]`.
   - *Inferencia:* Es obligatorio aplicar `text-base sm:text-xs md:text-sm` en todos los inputs para garantizar 16px en móvil y desactivar el auto-zoom nativo sin alterar la densidad visual de tablet/escritorio.

3. **Desde Observation 3:**
   - En móvil (`< 1024px`), el diseño en grid de 3 columnas (Florería) o 12 columnas (Carissma) colapsa a 1 sola columna vertical.
   - Debido a esto, la cuadrícula de productos se renderiza primero y el ticket/checkout queda apilado abajo.
   - Cuando un cajero agrega un producto, no recibe retroalimentación visual inmediata a menos que desplace la pantalla varios cientos de píxeles hacia abajo.
   - *Inferencia:* Se requiere un componente de navegación móvil para POS: o bien un selector de pestañas en la parte superior (`lg:hidden`: `[Catálogo (N)]` vs `[Ticket (N) - Bs Total]`) o una barra fija/drawer inferior que indique el subtotal actual y permita abrir el ticket de forma inmediata.

4. **Desde Observation 4:**
   - La regla R3 y el estándar WCAG exigen áreas táctiles mínimas de 44x44px.
   - Los botones de incremento/decremento (`+`/`-`), tachos de basura, selectores de tallas y botones de acción en filas de tablas tienen áreas entre 12px y 26px.
   - Un operador en un mostrador con prisa comete errores frecuentes de pulsación accidental.
   - *Inferencia:* Es mandatorio rediseñar los botones para asegurar `min-h-[44px] min-w-[44px]` en móvil con espaciado ergonómico.

5. **Desde Observation 5:**
   - En una terminal de ventas rápida de mostrador, depender del teclado del sistema operativo ralentiza la atención y oculta la mitad de la interfaz.
   - *Inferencia:* Es necesario dotar a la terminal POS de botones rápidos de denominación de billetes bolivianos (`Bs 10`, `Bs 20`, `Bs 50`, `Bs 100`, `Bs 200`, `Monto Exacto`) y un numpad táctil en pantalla opcional.

6. **Desde Observation 6:**
   - `bottom-6` (24px) y `bottom-0` (`MobileBottomNav`, altura ~60px) colisionan directamente. Además, `right-6` con `w-full` provoca que el elemento exceda el ancho del viewport de 360px (`overflow-x`).
   - *Inferencia:* La barra flotante del catálogo de Carissma debe ubicarse en `bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 max-w-lg sm:w-auto` para ubicarse con seguridad por encima de la barra de navegación sin desbordar los laterales.

7. **Desde Observation 7:**
   - Una tabla con 7 a 9 columnas en una pantalla de 360px a 430px es ilegible y difícil de manipular mediante scroll horizontal.
   - La especificación R1 ordena: "En pantallas móviles, las tablas complejas y listas densas deben transformarse en tarjetas táctiles (cards apiladas) con espaciado ergonómico, manteniendo la visualización tabular en pantallas de tablet y escritorio".
   - *Inferencia:* Las 5 tablas identificadas deben incorporar un bloque `block md:hidden` que dibuje tarjetas táctiles y un bloque `hidden md:block` que conserve la tabla tradicional.

---

## 3. Caveats

- **No Caveats en el Alcance Asignado:** Se examinaron minuciosamente todos los archivos de rutas, componentes y modales vinculados a POS, Catálogo y Alquileres de Carissma.
- **Alcance Acotado:** Los módulos de CRM general (`crm-view.tsx`), Chat Omnicanal (`omnichannel-view.tsx`) y Logística de Florería (`floreria/orders-view.tsx`) pertenecen a la competencia de otros subagentes o exploradores. Se revisaron únicamente como referencia para verificar coherencia con la barra `MobileBottomNav` y el layout global.

---

## 4. Conclusion

El sistema posee una sólida arquitectura técnica en TypeScript y lógica funcional completa con Server Actions y base de datos SQLite. Sin embargo, en términos de experiencia móvil y táctil (smartphones de 360px a 430px y tablets de 768px a 1024px), adolece de tres tipos de deficiencias críticas:
1. **Bugs de Navegador:** Auto-zoom involuntario al pulsar cualquier campo interactivo (fuente < 16px) y colisión con el teclado virtual por falta de configuración de viewport con `interactiveWidget: 'resizes-content'`.
2. **Deficiencias de Ergonomía Táctil:** Carrito de POS invisible en móvil sin scroll forzado, ausencia de botones de cobro rápido de billetes/numpad, colisión de barras flotantes con `MobileBottomNav`, y botones con áreas de toque inferiores a 44x44px.
3. **Tablas Móviles No Adaptadas:** Cinco tablas densas que no se transforman en tarjetas en pantallas de ancho reducido.

La solución está completamente diagnosticada, mapeada con exactitud de líneas y lista para su implementación por los subagentes correspondientes (`subagent-floreria-pos`, `subagent-carissma-rentals`).

---

## 5. Verification Method

Para verificar independientemente estos hallazgos:
1. **Inspección de Archivos Clave:**
   - `c:\Users\Lenovo\Desktop\floreria\app\layout.tsx` (Líneas 4-7: constatar ausencia de `viewport`).
   - `c:\Users\Lenovo\Desktop\floreria\components\carissma\catalog-view.tsx` (Líneas 474-476: constatar `bottom-6 right-6 ... w-full`).
   - `c:\Users\Lenovo\Desktop\floreria\components\floreria\pos\pos-cart-panel.tsx` (Líneas 202, 336, 409-422: constatar `text-xs` y botones de 18px).
   - `c:\Users\Lenovo\Desktop\floreria\components\carissma\orders\orders-agenda-table.tsx` (Líneas 56-129: constatar ausencia de renderizado de tarjetas para móvil).
2. **Comprobación de Tipos sin Alterar el Servidor Activo (R4):**
   ```powershell
   npx tsc --noEmit
   ```
   *Condición de éxito:* Código de retorno 0.
3. **Condición de Invalidación:**
   Si se demostrara que `app/layout.tsx` ya contiene `viewport` con `interactiveWidget: 'resizes-content'`, o que las 5 tablas ya cuentan con versión `cards` en móvil, las observaciones 1 y 7 quedarían invalidadas.
