# 👗 Subagente: `subagent-carissma-rentals`
**Módulo:** Alquiler de Vestidos Carissma (Inventario, Reservas, Depreciación, Garantías & Finanzas)

---

## 🎯 Alcance y Responsabilidades
1. **Inventario por Prenda (`components/carissma/inventory-view.tsx`)**:
   - Registro de vestidos con marca, talla, costo de adquisición, depósito de garantía, color e historial de alquileres.
   - Control de estados: *Disponible*, *Reservado*, *En Uso*, *En Lavandería*.

2. **Calendario & Ciclo de Vida (`components/carissma/calendar-view.tsx`)**:
   - Bloqueo de fechas por reserva.
   - Seguimiento de retornos y etapas operativas (Ingreso, Lavado Seco, Disponibilidad).
   - *Próximamente*: Integración con el modelo de DB real `RentalBooking`.

3. **Motor de Precios Dinámicos por Depreciación (`components/carissma/pricing-engine-view.tsx`)**:
   - Algoritmo de tarifa decreciente basada en desgastes por número de usos.
   - Integración con la ficha de vestuario para cotización automática.

4. **Finanzas de Alquiler (`components/carissma/finances-view.tsx`)**:
   - Cálculo de rentabilidad por vestido, retorno de inversión (ROI) y depósitos de garantía custodiados.

---

## 🔒 Límites de Archivos Autorizados
- `components/carissma/inventory-view.tsx`
- `components/carissma/calendar-view.tsx`
- `components/carissma/pricing-engine-view.tsx`
- `components/carissma/finances-view.tsx`
- `app/actions/carissma.ts`
- Modelos de Prisma: `Dress` *(ampliar con `RentalBooking` y `GuaranteeDeposit`)*

---

## 🛡️ Reglas de Escalabilidad & Compatibilidad
- **Modelado No Destructivo**: Las adiciones a Prisma para reservas de alquiler no deben alterar ni romper las tablas de Florería.
- **Validaciones Zod**: Usar validación estricta para tallas ("XS" | "S" | "M" | "L" | "XL") y estados.
- **Independencia de Negocio**: Carissma posee sus propias reglas de deposito de garantía y penalización por mora.
