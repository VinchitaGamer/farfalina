# Report: Auditoría de Diseño Responsive & Ergonomía Móvil (Survey 3)
**Módulos Evaluados**: Pedidos / Logística / Kanban, CRM & Clientes, Omnicanalidad / Chat Drawer & Posts/Comentarios, y Arqueo de Caja / Contabilidad.  
**Fecha**: 2026-10-09  
**Objetivo**: Diagnosticar desajustes responsivos en pantallas móviles (<768px, 360px-430px) y tablets (768px-1024px), prevenir bugs de zoom involuntario y teclado virtual móvil, evaluar ergonomía táctil (>=44x44px), y proponer la conversión de tablas complejas a tarjetas táctiles apiladas.

---

## 1. Resumen Ejecutivo de Hallazgos

| Área de Evaluación | Estado Actual | Deficiencias Críticas | Impacto UX / Dispositivo |
|---|---|---|---|
| **Viewport Global & Teclado** | ❌ Incompleto | Falta exportación de `viewport` con `interactiveWidget: 'resizes-content'` en `app/layout.tsx`. | iOS Safari y Android comprimen o desplazan la pantalla erráticamente al desplegar el teclado. |
| **Tamaño de Fuentes en Inputs** | ❌ Incumplimiento Generalizado | `input`, `select` y `textarea` usan `text-xs` (12px) y `text-sm` (14px) en la totalidad de formularios y modales. | Auto-zoom involuntario y persistente al tocar campos en iPhone/Android. |
| **Pedidos / Kanban (Logística)** | ⚠️ Parcial | Kanban móvil en Florería fuerza scroll horizontal sin pestañas rápidas; en Carissma apila 6 columnas infinitas. Tablas de agenda sin versión card móvil. | Navegación engorrosa; botones de tarjeta/edición < 44px (~26-32px). |
| **CRM & Directorio Clientes** | ⚠️ Parcial | Directorio renderiza tarjetas, pero los botones de WhatsApp/eliminar/editar no cumplen 44px y los inputs de búsqueda/modal tienen 12px. | Errores de toque accidental y auto-zoom al buscar clientas. |
| **Omnicanal / Chat & Posts** | ❌ Crítico | Chat usa alturas fijas (`min-h-[720px]`, `max-h-[460px]`) sin `dvh`/`svh`. Sin padding `safe-area-inset-bottom`. Panel de Instagram apila publicaciones y comentarios sin selector móvil. | El teclado virtual oculta el compositor; home indicator cubre botón enviar. |
| **Arqueo de Caja & Contabilidad** | ❌ Crítico | Tablas de 7 a 9 columnas (Egresos, Pedidos Contables, Arqueos de Turno, Garantías Carissma) solo envueltas en `overflow-x-auto`, sin cards móviles. | Tablas densas ilegibles en smartphones que demandan scroll horizontal bidireccional. |
| **Áreas Táctiles (Touch Targets)** | ❌ Incumplimiento Severo | Botones e iconos con alturas de 22px a 36px (inferiores al estándar W3C/Apple de 44x44px). | Frustración de usuario al pulsar botones en pantallas táctiles pequeñas. |

---

## 2. Hallazgos Detallados por Módulo

### 2.1 Viewport, Navegación Base & Teclado Virtual

#### A. Falta de Configuración de Viewport en App Router
- **Archivo**: `app/layout.tsx` (Líneas 4-7).
- **Observación actual**:
  Solo se exporta `metadata: Metadata`. No existe la exportación requerida de `Viewport`:
  ```tsx
  // app/layout.tsx: Línea 4
  export const metadata: Metadata = {
    title: "Plataforma SaaS | Florería Farfalina & Alquiler Vestidos Carissma",
    description: "Sistema integral de gestión ERP, CRM, POS Omnicanal y Alquiler de Vestidos con Precios Dinámicos",
  };
  ```
- **Problema**:
  Sin `interactiveWidget: 'resizes-content'`, en navegadores móviles (especialmente Chrome en Android y Safari en iOS 15+) la apertura del teclado virtual se superpone al viewport sin redimensionarlo, provocando que los campos inferiores queden ocultos detrás del teclado.
- **Recomendación**:
  Exportar en `app/layout.tsx`:
  ```tsx
  import type { Metadata, Viewport } from "next";

  export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    interactiveWidget: "resizes-content",
  };
  ```

#### B. Safe Area Inset en `MobileBottomNav`
- **Archivo**: `components/layout/mobile-bottom-nav.tsx` (Línea 26).
- **Observación actual**:
  ```tsx
  <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-warm-200 lg:hidden px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden">
  ```
  Los botones interiores tienen `py-1 px-2` con `text-[10px]` (altura efectiva ~38px). Carece de margen para la barra home indicator de iOS/Android (`env(safe-area-inset-bottom)`).
- **Problema**:
  En iPhones sin botón home y smartphones Android modernos, los iconos quedan pegados o cubiertos por el indicador gestual inferior.
- **Recomendación**:
  Agregar `pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]` y asegurar que los botones tengan `min-h-[44px]`.

---

### 2.2 Módulo de Pedidos, Logística & Kanban

#### A. Tablero Kanban de Entregas (Florería Farfalina)
- **Archivo**: `components/floreria/orders-view.tsx`
- **Líneas**: 158–196 (View Switcher), 358–493 (Tablero Kanban).
- **Observación actual**:
  - El selector de vista (`Calendario`, `Kanban`, `Agenda`) usa botones con `py-1.5 px-2.5 text-[11px]` (~30px de altura).
  - El contenedor Kanban en móvil usa:
    ```tsx
    // Línea 358
    <div className="flex md:grid md:grid-cols-3 gap-4 sm:gap-6 overflow-x-auto pb-4 snap-x">
    ```
    Cada columna tiene `min-w-[285px] sm:min-w-[320px] snap-start`. En una pantalla de 360px-390px, el usuario solo ve una columna a la vez y debe arrastrar horizontalmente a ciegas para ver "En camino" o "Entregado". No existe una barra de pestañas o segmented control móvil para saltar directamente a un estado.
  - Botones de acción en tarjetas Kanban (Líneas 444–484):
    - `Tarjeta`: `py-1.5 text-xs` (~32px de altura).
    - `Editar`: `py-1.5 text-xs` (~32px de altura).
    - `Marcar "En camino"` / `Marcar "Entregado"`: `w-full py-1.5 text-xs` (~32px de altura).
- **Recomendación**:
  1. En pantallas `< 768px`, incorporar un segmented control móvil: `[ En preparación (N) | En camino (N) | Entregado (N) ]` que filtre la columna activa o permita conmutar entre columnas sin obligar al scroll horizontal.
  2. Incrementar la altura de los botones a `min-h-[44px]` (ej. `py-2.5 px-3 text-xs sm:text-sm`).

#### B. Calendario Mensual de Pedidos
- **Archivo**: `components/floreria/orders-view.tsx` (Líneas 255–354).
- **Observación actual**:
  La cuadrícula mensual está encerrada en un `min-w-[620px]` con scroll horizontal. Las tarjetas de pedido dentro de cada celda tienen botones de impresión de dedicatoria de tamaño microscópico:
  ```tsx
  // Línea 327-342
  <button onClick={...} className="p-0.5 hover:bg-black/10 rounded" title="Imprimir dedicatoria">
    <Printer className="h-3 w-3 text-terracotta-700" />
  </button>
  ```
  Área táctil real: ~18x18px. En pantallas táctiles es casi imposible de pulsar sin abrir accidentalmente la tarjeta completa.
- **Recomendación**:
  En vista móvil, el calendario mensual debe complementarse con una vista de lista compacta por día o aumentar la zona de toque del icono mediante un wrapper táctil con `min-w-[44px] min-h-[44px] flex items-center justify-center`.

#### C. Tablero Kanban de Reservas (Carissma)
- **Archivo**: `components/carissma/orders/orders-kanban-board.tsx` (Línea 29).
- **Observación actual**:
  ```tsx
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
  ```
  En pantallas móviles (`grid-cols-1`), las 6 etapas (Reservado, En Prueba, Con Clienta, Devuelto/Revisión, En Lavandería, Finalizado) se renderizan apiladas verticalmente en una sola columna infinita.
  Adicionalmente:
  - Botones de acción en tarjetas (Líneas 59–65, 93–99, 137–143): `w-full py-1 text-[10px]` (~24px de altura).
  - Botón de imprimir contrato (Líneas 47–49): `<Printer className="h-3 w-3" />` sin padding ni dimensiones mínimas.
- **Recomendación**:
  Implementar un selector de pestañas horizontal móvil (`TabsList` con scroll horizontal) que muestre únicamente la etapa seleccionada en smartphones, con indicador numérico de reservas. Llevar los botones a `min-h-[44px]`.

#### D. Tabla de Agenda de Alquileres (Carissma)
- **Archivo**: `components/carissma/orders/orders-agenda-table.tsx` (Líneas 56–128).
- **Observación actual**:
  Renderiza un elemento `<table>` de escritorio con 8 columnas dentro de un simple `overflow-x-auto`. En pantallas `< 768px`, las clientas, tallas, garantías y acciones quedan truncadas o desbordadas horizontalmente. Los botones de acción (`Recibir`, `Contrato`) son `px-2.5 py-1 text-xs` (~26px de alto).
- **Recomendación**:
  Aplicar el patrón canónico responsive:
  - `<div className="hidden md:block overflow-x-auto">` para la tabla tradicional en tablets/escritorio.
  - `<div className="grid grid-cols-1 gap-3 md:hidden">` con tarjetas táctiles apiladas que expongan contrato, clienta, fechas de renta, garantía destacada y botones de acción rápida de 44px.

#### E. Formulario de Edición de Pedidos (`EditOrderModal`)
- **Archivo**: `components/floreria/edit-order-modal.tsx` (Líneas 218–360).
- **Observación actual**:
  El contenedor declara `className="... text-xs"` y los inputs no declaran tamaño de fuente (`text-xs` / 12px heredado).
- **Problema**:
  Auto-zoom forzado al tocar campos en dispositivos móviles.
- **Recomendación**:
  Aplicar `text-base md:text-sm` a todos los `<input>`, `<select>` y `<textarea>`.

---

### 2.3 Módulo CRM & Directorio de Clientes

#### A. Directorio de Clientes en Florería Farfalina
- **Archivo**: `components/floreria/crm-view.tsx`
- **Líneas**: 228–264 (Pestañas), 597–616 (Buscador), 620–773 (Cards de Clientes).
- **Observación actual**:
  - El directorio ya utiliza un grid de tarjetas (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`), lo cual es una buena base ergonómica.
  - Sin embargo, el campo de búsqueda (Línea 604) tiene `text-xs`:
    ```tsx
    <input
      type="text"
      placeholder="Buscar por nombre, teléfono o flor favorita..."
      className="w-full pl-9 pr-4 py-2 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 ..."
    />
    ```
    Provoca auto-zoom inmediato en smartphones.
  - Botón de WhatsApp rápido (Línea 755): `py-2 rounded-xl text-xs` (~36px de altura, por debajo de 44px).
  - Botón de eliminar (Línea 762): `p-2 rounded-xl` con icono `h-4 w-4` (~32x32px de zona táctil).
  - Pestañas superiores (Línea 228): `px-3 py-1.5 text-xs` (~32px de altura).
- **Recomendación**:
  - Cambiar el input de búsqueda a `text-base md:text-xs`.
  - Incrementar el botón de WhatsApp a `min-h-[44px]` (`py-2.5`).
  - Asegurar que el botón de eliminar tenga un área táctil mínima de 44x44px.

#### B. Directorio de Clientes & Eventos en Carissma
- **Archivo**: `components/carissma/crm-view.tsx`
- **Líneas**: 250–273 (Buscador y filtros), 310–326 (Botones de card de clienta), 434–489 (Modal Nueva Clienta), 505–585 (Modal Nuevo Evento).
- **Observación actual**:
  - Input de búsqueda (Línea 253): `text-xs font-medium` (12px).
  - Filtros de nivel (Línea 263): `px-2.5 py-1 text-xs` (~26px de altura).
  - Botón de WhatsApp (Línea 315): `px-3 py-1.5 text-xs` (~32px de altura).
  - Botón eliminar (Línea 321): `p-1.5` con icono `h-3.5 w-3.5` (~26x26px de zona táctil).
  - Modales de Nueva Clienta y Nuevo Evento (Líneas 434, 505): formularios declarados con `space-y-3 text-xs`, provocando auto-zoom en inputs de nombre, teléfono, medidas, fecha y selector de eventos.
- **Recomendación**:
  - Escalar inputs en formularios y modales a `text-base md:text-sm`.
  - Ampliar los botones de acción rápida a `min-h-[44px]`.

---

### 2.4 Omnicanalidad, Chat Drawer & Publicaciones/Comentarios

#### A. Bandeja Unificada de Omnicanalidad (`UnifiedOmnichannelView`)
- **Archivo**: `components/shared/omnichannel/unified-omnichannel-view.tsx`
- **Líneas**: 834–860 (Tabs móvil), 862 (Contenedor general), 1158 (Stream de mensajes), 1480–1516 (Barra de redacción / Compositor).
- **Deficiencias observadas**:
  1. **Alturas fijas no dinámicas (Falta de `dvh`/`svh`)**:
     - Línea 862: `<div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[720px]">`.
     - Línea 1158: `<div className="p-4 space-y-3 overflow-y-auto flex-1 bg-warm-50/40 max-h-[460px] min-h-[380px]">`.
     - En una pantalla móvil con barra de navegación del navegador (Safari/Chrome) y barra de navegación inferior activa, un contenedor con `min-h-[720px]` desborda la pantalla. Cuando se abre el teclado virtual (que consume 280-340px), la ventana hace un salto brusco hacia arriba y el campo de texto se descoloca o queda oculto.
  2. **Auto-zoom involuntario en el input de chat**:
     - Línea 1506:
       ```tsx
       <input
         type="text"
         value={inputMessage}
         onChange={(e) => setInputMessage(e.target.value)}
         placeholder={attachedFile ? "Añade un mensaje opcional..." : "Escribe una respuesta al cliente..."}
         className={`flex-1 p-2.5 bg-warm-50 border border-warm-200 rounded-xl text-xs text-warm-900 focus:outline-none ...`}
       />
       ```
       El input usa `text-xs` (12px). Al tocarlo en un iPhone, Safari hace zoom automático obligatorio a 16px, agrandando toda la interfaz y desplazando el botón de enviar fuera del viewport lateral.
  3. **Ausencia de `safe-area-inset-bottom` en el compositor**:
     - Línea 1481: `<div className="p-3 bg-white border-t border-warm-200 flex items-center gap-2">`.
     - No contempla el área segura inferior. Cuando el teclado se cierra o en modo standalone PWA, el compositor colisiona directamente con el home indicator o con `MobileBottomNav`.
  4. **Zonas táctiles reducidas**:
     - Botón de envío (Línea 1512): `p-2.5` con icono `h-4 w-4` (~36x36px).
     - Botón de adjunto (Línea 1493): `p-2.5` (~36x36px).
     - Chips de respuestas rápidas (Líneas 1426, 1435): `px-2 py-0.5 text-[10px]` (~22px de altura).
- **Recomendación técnica**:
  1. Utilizar un contenedor adaptativo para móvil: `h-[calc(100dvh-12rem)] md:h-auto md:min-h-[720px] flex flex-col`.
  2. Aplicar `text-base md:text-xs` al input de redacción.
  3. Agregar `pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]` a la barra del compositor.
  4. Ajustar el botón de envío y el clip de adjuntos a `min-w-[44px] min-h-[44px]`.

#### B. Panel de Publicaciones y Comentarios de Instagram (`InstagramPostsPanel`)
- **Archivo**: `components/shared/omnichannel/instagram-posts-panel.tsx`
- **Líneas**: 330 (Grid 2 columnas), 334 (Columna izquierda: Posts), 449 (Columna derecha: Comentarios), 696–735 (Textarea de respuesta).
- **Deficiencias observadas**:
  1. **Ausencia de conmutador de vistas en móvil**:
     - Línea 330: `<div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-[640px]">`.
     - En móvil (`< 1024px`), la columna izquierda (lista de posts) y la derecha (hilo de comentarios y respuestas) quedan apiladas verticalmente. Si hay 8 publicaciones, el usuario tiene que scrollear por debajo de todas las publicaciones para llegar a los comentarios del post seleccionado.
  2. **Textarea de respuesta con tamaño de fuente vulnerable a zoom**:
     - Línea 706: `<textarea ... className="... text-xs text-warm-900 ...">`.
     - Provoca auto-zoom inmediato al enfocar para responder a un cliente.
- **Recomendación**:
  1. Añadir una barra de selector móvil (similar a `UnifiedOmnichannelView`): `[ Ver Publicaciones (N) | Hilo de Comentarios ]` en pantallas `< 1024px`.
  2. Cambiar la tipografía del textarea a `text-base md:text-xs`.

#### C. Drawers de Emisión de Pedidos y Alquileres desde Chat
- **Archivos**:
  - `components/floreria/chat-order-drawer.tsx` (Líneas 565, 576, 637, 648, 660).
  - `components/carissma/chat-rental-drawer.tsx` (Líneas 228, 237, 262, 267, 278).
- **Observación actual**:
  Todos los campos interactivos de estos dos drawers (nombre de comprador, teléfono, modalidad de envío, medidas, fechas de retiro, selección de prendas/insumos) están estilizados con `text-xs` (12px) y `text-[11px]`.
- **Recomendación**:
  Estandarizar a `text-base md:text-sm` y garantizar que los botones de acción rápida tengan `min-h-[44px]`.

---

### 2.5 Módulo de Arqueo de Caja & Contabilidad

#### A. Vista Contable de Florería Farfalina (`AccountingView`)
- **Archivo**: `components/floreria/accounting-view.tsx`
- **Tablas no adaptadas a móvil (<768px)**:
  1. **Historial de Egresos y Gastos** (Líneas 308–338):
     - Tabla HTML de 4 columnas envuelta en `overflow-x-auto`. En smartphones compactos requiere arrastre horizontal.
  2. **Historial Consolidado de Pedidos y Envíos** (Líneas 495–592):
     - Tabla HTML densa de 9 columnas (`N° Pedido`, `Fecha Entrega`, `Cliente / Teléfono`, `Destinatario & Modalidad`, `Arreglo`, `Pago`, `Estado`, `Total`, `Acciones`).
     - En pantallas de 360px a 768px, es completamente inmanejable sin tarjetas táctiles.
     - Botones "Ver Ficha" e imprimir tarjeta (Líneas 567, 581): `px-2.5 py-1 text-[11px]` (~26px de alto).
  3. **Registro Consolidado de Arqueos de Caja** (Líneas 711–765):
     - Tabla de 8 columnas (`Fecha y Hora`, `Cajero`, `Apertura`, `Efectivo`, `QR / Tarjeta`, `Declarado`, `Discrepancia`, `Reporte PDF`).
     - Botón "Imprimir Reporte": `px-3 py-1 text-[11px]` (~26px de alto).
- **Recomendación**:
  Implementar el renderizado condicional dual:
  ```tsx
  {/* Desktop / Tablet: Tabla Completa */}
  <div className="hidden md:block overflow-x-auto">
    <table className="w-full text-left text-xs">...</table>
  </div>

  {/* Mobile: Tarjetas Táctiles Ergonómicas */}
  <div className="grid grid-cols-1 gap-3 md:hidden">
    {orders.map((ord) => (
      <div key={ord.id} className="card-warm p-4 space-y-3">
        ...
      </div>
    ))}
  </div>
  ```

#### B. Control de Arqueo Diario en POS Florería (`PosShiftDrawer`)
- **Archivo**: `components/floreria/pos/pos-shift-drawer.tsx`
- **Líneas**: 162–217 (Tabla de turnos archivados), 221–288 (Modal de cierre de turno).
- **Deficiencias**:
  - La tabla de turnos archivados es de 8 columnas en `overflow-x-auto` sin versión de tarjeta táctil en móvil.
  - El modal de cierre de turno tiene campos con `text-xs` (Línea 238) y `text-sm` (Línea 251), ambos por debajo de los 16px requeridos para evitar auto-zoom.
  - El botón de "Ver / Imprimir PDF" (Línea 206) tiene `px-3 py-1 text-[11px]` (~26px de alto).
- **Recomendación**:
  Transformar la lista de turnos en cards móviles en `< 768px` y elevar los campos del modal a `text-base md:text-sm`.

#### C. Vista Contable de Carissma (`AccountingView`)
- **Archivo**: `components/carissma/accounting-view.tsx`
- **Líneas**: 340–362 (Egresos), 397–463 (Control de Garantías), 478–535 (Arqueos de Caja).
- **Deficiencias**:
  - La tabla de Control de Garantías tiene 7 columnas (`Contrato`, `Clienta`, `Prenda`, `Depósito Garantía`, `Estado Garantía`, `Estado Renta`, `Acciones`). En móvil se corta severamente.
  - Botones "Devolver" y "Contrato" (Líneas 441, 451): `px-2.5 py-1 text-xs` (~26px de alto).
- **Recomendación**:
  Convertir la tabla de garantías a tarjetas táctiles en móvil (`< 768px`) donde el monto de la garantía y el botón "Devolver Garantía" (`min-h-[44px]`) sean protagonistas.

---

## 3. Matriz Consolidada de Archivos y Recomendaciones de Corrección

| Archivo | Líneas Afectadas | Deficiencia Actual | Corrección Específica Propuesta |
|---|---|---|---|
| `app/layout.tsx` | 4–8 | Falta exportación `Viewport` | Agregar `export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 5, interactiveWidget: 'resizes-content' };` |
| `components/layout/mobile-bottom-nav.tsx` | 26, 31–140 | Sin `safe-area-inset-bottom`, botones < 44px | Agregar `pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]`, `min-h-[44px]` en botones de navegación |
| `components/floreria/orders-view.tsx` | 158–196, 358–493 | Kanban requiere scroll forzado en móvil; botones < 44px; celdas de calendario con botones de 18px | Añadir segmented control móvil de 3 estados para Kanban; botones `min-h-[44px]`; aumentar zona táctil de dedicatoria a 44x44px |
| `components/floreria/edit-order-modal.tsx` | 218, 256, 277, 338, 356 | Inputs y selects con `text-xs` (12px) | Cambiar a `text-base md:text-sm` en todos los controles de formulario |
| `components/carissma/orders/orders-kanban-board.tsx` | 29, 59–65, 93–99 | 6 columnas infinitas apiladas en vertical; botones de 24px | Añadir selector de pestañas de etapa móvil; botones de acción `min-h-[44px]` |
| `components/carissma/orders/orders-agenda-table.tsx` | 56–128 | Tabla de 8 columnas en `overflow-x-auto` sin versión cards móvil | Implementar renderizado condicional dual: tabla para desktop, cards apiladas para móvil (`< 768px`) |
| `components/floreria/crm-view.tsx` | 604, 755, 762 | Buscador con `text-xs`; botones de WhatsApp y eliminar < 44px | Input `text-base md:text-xs`; botón WhatsApp `min-h-[44px]`; botón eliminar con touch target de 44x44px |
| `components/carissma/crm-view.tsx` | 253, 315, 434–489, 505–585 | Buscador y modales con `text-xs`; botones de contacto < 44px | Inputs a `text-base md:text-sm`; botones de contacto rápido a `min-h-[44px]` |
| `components/shared/omnichannel/unified-omnichannel-view.tsx` | 862, 1158, 1481, 1506, 1512 | Altura fija `min-h-[720px]`, falta `dvh`, input chat `text-xs`, sin safe-area, botones < 44px | Contenedor con `h-[calc(100dvh-...)]`, input `text-base md:text-xs`, `pb-[calc(0.75rem+env(safe-area-inset-bottom))]`, botones `min-h-[44px]` |
| `components/shared/omnichannel/instagram-posts-panel.tsx` | 330, 706, 720 | Posts y comentarios apilados en móvil sin tabs; textarea `text-xs` | Agregar conmutador de pestañas móvil `[ Publicaciones | Comentarios ]`; textarea `text-base md:text-xs` |
| `components/floreria/chat-order-drawer.tsx` | 329, 565, 576, 601, 637 | Falta `dvh`, inputs con `text-xs`, selector de modo < 44px | Contenedor con `max-h-[92dvh]`, inputs a `text-base md:text-sm`, botones a `min-h-[44px]` |
| `components/carissma/chat-rental-drawer.tsx` | 228, 237, 262, 267 | Inputs con `text-[11px]` y `text-xs` | Inputs a `text-base md:text-sm`, filtros y tarjetas con zona táctil ergonómica |
| `components/floreria/accounting-view.tsx` | 308–338, 495–592, 711–765 | Tablas de egresos, pedidos consolidados y arqueos sin cards en móvil; botones < 44px | Implementar versión de cards apiladas en `< 768px` para las 3 tablas; botones `min-h-[44px]` |
| `components/floreria/pos/pos-shift-drawer.tsx` | 162–217, 238, 251 | Tabla de turnos sin cards en móvil; inputs con < 16px | Cards móviles para turnos archivados; inputs `text-base md:text-sm` |
| `components/carissma/accounting-view.tsx` | 340–362, 397–463, 478–535 | Tablas de gastos, garantías y turnos sin cards en móvil | Transformar a cards en `< 768px`; botones de acción ("Devolver", "Contrato") a `min-h-[44px]` |
| `components/carissma/pos-view.tsx` | 1096–1138 | Tabla de turnos archivados sin cards en móvil | Implementar versión de cards táctiles para móvil en turnos archivados |

---

## 4. Conclusión de la Exploración
La aplicación posee una arquitectura visual rica y coherente basada en Tailwind y componentes modernos. Sin embargo, su adaptación a smartphones y tablets presenta tres debilidades estructurales:
1. **Riesgo crítico de auto-zoom y descalibre visual** por ausencia del viewport `interactiveWidget: 'resizes-content'` y uso generalizado de fuentes menores a 16px en campos interactivos.
2. **Deficiencia de ergonomía táctil** con una gran concentración de botones e iconos con áreas activas inferiores a 44x44px.
3. **Persistencia de tablas de datos tabulares densas** de 7 a 9 columnas en pantallas móviles, en lugar de transformarse fluidamente en tarjetas táctiles independientes.

La implementación de las correcciones documentadas garantizará el cumplimiento estricto de los requisitos R1, R2 y R3 sin alterar la compatibilidad ni comprometer la sesión activa del cliente.
