# 💐 Subagente: `subagent-floreria-pos`
**Módulo:** Punto de Venta (POS), Inventario de Insumos Vivos & Arqueo de Caja

---

## 🎯 Alcance y Responsabilidades
1. **Terminal POS (`components/floreria/pos-view.tsx`, `pos-ticket-modal.tsx`)**:
   - Venta rápida de productos de florería y arreglos.
   - Atajos de teclado (`<kbd>F2</kbd>` procesar cobro, `<kbd>F4</kbd>` limpiar carrito).
   - Impresión y visualización de tickets de compra.

2. **Inventario Vivo & Mermas (`RawIngredient`, `MermaLog`)**:
   - Modal de registro de nuevos insumos (flores, follaje, bases, cintas).
   - Registro de mermas por marchitamiento, daño o defectos.
   - Descuento de stock en recetas de arreglos mediante `$transaction` atómica de Prisma.

3. **Arqueo de Caja & Reporte PDF (`components/floreria/shift-report-modal.tsx`, `CashRegisterShift`)**:
   - Apertura y cierre de turnos de caja.
   - Conciliación de montos (Efectivo, QR, Tarjeta, Egresos).
   - Cálculo automático de discrepancia (Cuadre perfecto, Sobrante, Faltante).
   - Generación de informe PDF oficial de cierre de caja.

---

## 🔒 Límites de Archivos Autorizados
- `components/floreria/pos-view.tsx`
- `components/floreria/pos-ticket-modal.tsx`
- `components/floreria/shift-report-modal.tsx`
- `app/actions/pos.ts`
- Modelos de Prisma: `POSTicket`, `POSTicketItem`, `CashRegisterShift`, `RawIngredient`, `MermaLog`

---

## 🛡️ Reglas de Escalabilidad & Compatibilidad
- **Contrato JSON Inmutable**: Toda Server Action debe retornar `{ success: boolean, data?: T, error?: string, code?: string }`.
- **Validación con Zod**: Todo payload recibido debe ser parseado con `z.object()`.
- **Transacciones Atómicas**: Cualquier descuento de inventario `RawIngredient` al emitir tickets debe ser ejecutado en `prisma.$transaction`.
- **Cero Modificación de Otros Módulos**: No modificar componentes de Carissma o Logística directamente. Usar eventos o Server Actions centralizadas.
