# Handoff Report: Survey 3 — Orders/Kanban, CRM, Omnichannel/Chat & Cash Register

**Agent**: Orders CRM Omnichannel Cash Explorer (`teamwork_preview_explorer_r4_survey_3`)  
**Type**: Hard Handoff (Investigation & Survey Complete)  
**Target Recipient**: Orchestrator (`cf1d79f3-8da1-4aff-9ccc-f4bf49d72a47`) / Implementation Subagents  
**Constraint R4 Status**: Respetado estrictamente. El servidor de desarrollo activo no fue detenido, reiniciado ni alterado.

---

## 1. Observation

A través de herramientas de lectura estricta (`view_file`, `grep_search`, `run_command` para `npx tsc --noEmit`), se observaron las siguientes evidencias directas en el código:

1. **Configuración de Viewport Inexistente**:
   - Archivo: `app/layout.tsx:4-7`.
   - Código textual observado:
     ```tsx
     export const metadata: Metadata = {
       title: "Plataforma SaaS | Florería Farfalina & Alquiler Vestidos Carissma",
       description: "Sistema integral de gestión ERP, CRM, POS Omnicanal y Alquiler de Vestidos con Precios Dinámicos",
     };
     ```
     No existe `export const viewport: Viewport` ni la directiva `interactiveWidget: 'resizes-content'`.

2. **Falta de Margen Seguro (Safe-Area) en Barra Inferior Móvil**:
   - Archivo: `components/layout/mobile-bottom-nav.tsx:26`.
   - Código textual:
     ```tsx
     <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-warm-200 lg:hidden px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden">
     ```
     Carece de `env(safe-area-inset-bottom)`. Sus botones internos tienen padding `py-1 px-2` con altura ~38px (< 44px).

3. **Tableros Kanban sin Conmutador Móvil Ergonómico y con Botones Pequeños**:
   - Archivo: `components/floreria/orders-view.tsx:358-484`.
     - Contenedor: `<div className="flex md:grid md:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto pb-4 snap-x">` con columnas de `min-w-[285px] sm:min-w-[320px]`.
     - Botones de acción: `Tarjeta` (`py-1.5 text-xs`), `Editar` (`py-1.5 text-xs`), `Marcar "En camino"` (`w-full py-1.5 text-xs`) — todos con altura efectiva de ~30-32px (< 44px).
   - Archivo: `components/carissma/orders/orders-kanban-board.tsx:29-140`.
     - Contenedor: `<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">`. En móvil (<768px), las 6 columnas se despliegan en una lista vertical interminable.
     - Botones de transición de etapa: `w-full py-1 text-[10px]` (~24px de altura).
     - Botón de imprimir contrato: `<Printer className="h-3 w-3 text-warm-400 hover:text-warm-700" />` sin padding (~16x16px).

4. **Tablas Complejas sin Adaptación a Tarjetas Móviles (<768px)**:
   - Archivo: `components/floreria/accounting-view.tsx:495-592`. Tabla de pedidos consolidados con 9 columnas (`N° Pedido`, `Fecha Entrega`, `Cliente / Teléfono`, `Destinatario & Modalidad`, `Arreglo`, `Pago`, `Estado`, `Total`, `Acciones`), envuelta solo en `overflow-x-auto`.
   - Archivo: `components/floreria/accounting-view.tsx:711-765`. Tabla de arqueos de caja con 8 columnas en `overflow-x-auto`.
   - Archivo: `components/floreria/accounting-view.tsx:308-338`. Tabla de egresos en `overflow-x-auto`.
   - Archivo: `components/carissma/orders/orders-agenda-table.tsx:56-128`. Tabla de agenda de alquileres con 8 columnas en `overflow-x-auto`.
   - Archivo: `components/carissma/accounting-view.tsx:397-463`. Tabla de control de garantías de 7 columnas en `overflow-x-auto`.
   - Archivo: `components/floreria/pos/pos-shift-drawer.tsx:162-217`. Tabla de turnos archivados de 8 columnas en `overflow-x-auto`.

5. **Omnicanalidad: Alturas Rígidas, Auto-Zoom en Chat Composer y Falta de Safe-Area**:
   - Archivo: `components/shared/omnichannel/unified-omnichannel-view.tsx`:
     - Línea 862: `<div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[720px]">`.
     - Línea 1158: Stream de mensajes con `max-h-[460px] min-h-[380px]`. No utiliza unidades dinámicas `dvh`/`svh`.
     - Línea 1481: Barra del compositor `<div className="p-3 bg-white border-t border-warm-200 flex items-center gap-2">` sin margen inferior `safe-area-inset-bottom`.
     - Línea 1506: Input de mensaje con clase `text-xs text-warm-900` (12px).
     - Línea 1512: Botón de envío con `p-2.5` e icono `h-4 w-4` (~36x36px).
   - Archivo: `components/shared/omnichannel/instagram-posts-panel.tsx`:
     - Línea 330: `<div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[640px]">`.
     - En pantallas móviles (<1024px), la lista de posts y el panel de comentarios se apilan sin selector de pestañas.
     - Línea 706: Textarea de respuesta con clase `text-xs text-warm-900` (12px).

6. **Generalización de Tipografía < 16px en Formularios y Modales (Riesgo de Auto-Zoom)**:
   - `components/floreria/edit-order-modal.tsx:218, 256, 277, 338, 356`: `text-xs`.
   - `components/floreria/crm-view.tsx:604`: input de búsqueda con `text-xs`.
   - `components/carissma/crm-view.tsx:253, 441, 451, 462, 472, 511, 529`: `text-xs`.
   - `components/floreria/chat-order-drawer.tsx:565, 576, 637, 648, 660`: `text-xs`.
   - `components/carissma/chat-rental-drawer.tsx:228, 237, 262, 267`: `text-[11px]` y `text-xs`.
   - `components/floreria/omnichannel-config-modal.tsx:555, 568, 583`: `text-xs`.
   - `components/floreria/pos/pos-shift-drawer.tsx:238, 251`: `text-xs` y `text-sm`.

7. **Verificación de Tipos Baseline**:
   - Comando: `npx tsc --noEmit`
   - Salida: Exit code 0, sin errores de compilación TypeScript.

---

## 2. Logic Chain

1. **De la Observación 1 a la Inestabilidad del Teclado**:
   Al carecer de `interactiveWidget: 'resizes-content'` en el `viewport` de `app/layout.tsx`, los motores Blink (Chrome) y WebKit (Safari) manejan la apertura del teclado móvil dibujando una capa superpuesta opaca sobre el viewport existente. Esto provoca que el campo activo y los botones de acción inferior queden cubiertos detrás del teclado.

2. **De las Observaciones 5 y 6 al Bug de Auto-Zoom**:
   iOS Safari y Android aplican zoom forzado automático si el campo `input`, `select` o `textarea` que recibe foco posee un tamaño computado menor a 16px (1rem). Dado que en `unified-omnichannel-view.tsx:1506`, `instagram-posts-panel.tsx:706`, `edit-order-modal.tsx`, `crm-view.tsx:604`, `pos-shift-drawer.tsx` y los drawers de chat todos los controles tienen `text-xs` (12px) o `text-sm` (14px), cada interacción táctil en smartphone desencadena zoom indeseado que desajusta el viewport horizontal.

3. **De la Observación 4 a la Degradación en Móvil de Tablas Complejas**:
   Una tabla de 7 a 9 columnas (`AccountingView` pedidos/turnos/egresos, `Carissma` garantías y agenda) tiene un ancho intrínseco superior a 800px. Al estar contenida únicamente en `overflow-x-auto` sin una vista alternativa de tarjetas apiladas, el usuario en una pantalla de 360px-430px está obligado a realizar scroll horizontal constante para leer datos básicos o pulsar botones de acción rápida.

4. **De las Observaciones 2, 3 y 5 a la Deficiencia de Ergonomía Táctil**:
   El estándar W3C/WCAG 2.1 y las directrices de Apple/Google exigen un área táctil mínima de 44x44px. Los botones con `py-1`, `py-1.5` o iconos `p-0.5` con `h-3 w-3` (~16px a 32px) provocan fallos de pulsación, cierres accidentales o toques fantasma.

---

## 3. Caveats

- **No Caveats**: Todos los módulos asignados (Pedidos/Kanban, CRM, Omnicanalidad/Chat/Posts, y Caja/Arqueo) fueron explorados y analizados directamente a nivel de código fuente en sus implementaciones de Florería y Carissma.
- **Supuestos de Implementación**: La implementación de tarjetas móviles (`<div className="md:hidden space-y-3">`) debe reutilizar exactamente los mismos estados y acciones de Server Actions ya existentes, sin alterar contratos de datos ni modelos de base de datos.

---

## 4. Conclusion

El sistema cuenta con una base estética de alta calidad, pero requiere tres ajustes estructurales para alcanzar la ergonomía responsive exigida en los requisitos R1, R2 y R3:
1. **Configuración de Viewport**: Exportar `viewport` con `interactiveWidget: 'resizes-content'` en `app/layout.tsx`.
2. **Prevención de Zoom & Safe-Area**: Estandarizar todos los inputs y textareas a `text-base md:text-sm` (o `text-base md:text-xs`) e inyectar `env(safe-area-inset-bottom)` en `MobileBottomNav` y en el compositor de chat.
3. **Conversión Dual (Tabla/Card)**: Transformar las tablas densas de pedidos, arqueos, garantías y agendas a tarjetas táctiles apiladas con botones `>= 44x44px` en pantallas móviles (`< 768px`).

---

## 5. Verification Method

Para verificar independientemente este diagnóstico y las futuras implementaciones:

1. **Chequeo de Tipos de TypeScript**:
   ```powershell
   npx tsc --noEmit
   ```
   *Criterio de éxito*: Salida limpia con código de retorno 0.

2. **Inspección de Viewport**:
   Verificar en `app/layout.tsx` que la exportación `viewport` contenga:
   ```ts
   interactiveWidget: 'resizes-content'
   ```

3. **Verificación de Fuentes en Controles Móviles**:
   Inspeccionar con Developer Tools (Device Mode iPhone 14 Pro, 393x852px) que ningún campo interactivo tenga `font-size < 16px` al recibir foco.

4. **Inspección de Tarjetas Móviles (<768px)**:
   Ajustar el viewport a 375px de ancho en:
   - `/floreria/orders` (Kanban y Agenda)
   - `/floreria/crm` y `/carissma/crm`
   - `/floreria/omnichannel` (Chat y Posts)
   - `/floreria/accounting` y `/carissma/accounting` (Pedidos, Gastos, Garantías y Arqueos)
   *Criterio de éxito*: No debe existir `overflow-x` involuntario en la página principal, las tablas densas deben renderizarse como cards táctiles apiladas, y los botones deben tener un área mínima de 44x44px.

5. **Condición de Invalidación**:
   Si alguna modificación altera o detiene el servidor `next dev` o introduce errores en `npx tsc --noEmit`, la intervención se considerará no conforme a R4.
