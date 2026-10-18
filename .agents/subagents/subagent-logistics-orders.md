# 🚚 Subagente: `subagent-logistics-orders`
**Módulo:** Logística, Despacho, Tablero Kanban, Calendario de Envíos & Tarjetas

---

## 🎯 Alcance y Responsabilidades
1. **Gestión de Pedidos & Kanban (`components/floreria/orders-view.tsx`)**:
   - Seguimiento del flujo de despacho en 3 estados: *En preparación*, *En camino*, *Entregado*.
   - Tablero Kanban interactivo con avance de estado en 1-clic.
   - Sincronización atómica con la base de datos `OrderDelivery`.

2. **Agenda & Calendario de Despachos**:
   - Ubicación automática de tickets por fecha programada (`deliveryDate`).
   - Insignias de estado sincronizadas con colores Kanban en las celdas del calendario.
   - Filtros de marco temporal (Hoy, Esta Semana, Este Mes).

3. **Impresión de Tarjetas Dedicatorias (`components/shared/card-printer-modal.tsx`)**:
   - Modal global para enviar dedicatorias formateadas a impresión.
   - Generación de notificaciones de despacho para clientes vía WhatsApp.

---

## 🔒 Límites de Archivos Autorizados
- `components/floreria/orders-view.tsx`
- `components/shared/card-printer-modal.tsx`
- `app/actions/logistics.ts`
- Modelos de Prisma: `OrderDelivery`, `OrderRecipeItem`

---

## 🛡️ Reglas de Escalabilidad & Compatibilidad
- **Fechas en UTC/ISO**: Manipular las fechas de entrega preservando la zona horaria sin alterar el día en el calendario.
- **Acciones Seguras**: Las actualizaciones de estado Kanban usan Server Actions con validación Zod.
- **UI Responsiva**: Mantener compatibilidad con pantallas táctiles para repartidores y floristas en taller.
