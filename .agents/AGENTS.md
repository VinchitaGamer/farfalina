# AGENTS.md — Reglas Globales del Proyecto

Este archivo define las restricciones y convenciones absolutas para todos los agentes
de IA que trabajen en este workspace. Estas reglas tienen **prioridad máxima** y no
pueden ser ignoradas bajo ninguna circunstancia.

---

## Stack Tecnológico Obligatorio

| Categoría | Tecnología | Prohibición |
|---|---|---|
| Framework | Next.js 14+ App Router | ❌ Pages Router |
| Componentes UI | Shadcn UI + Radix UI | — |
| Estilos | Tailwind CSS | — |
| Animaciones | Tailwind (primero) · Framer Motion (solo si aprobado) | — |
| Estado Global | Zustand | ❌ React Context API |
| HTTP Client | `fetch` nativo de Next.js | ❌ Axios |
| Validación | Zod + `z.infer<>` | ❌ Interfaces TypeScript manuales |
| Tipado | TypeScript estricto | ❌ `any` |
| Iconos | Lucide React | — |
| Auth | NextAuth.js v5 (Auth.js) | ❌ JWT manual |

---

## Reglas de Oro (Non-Negotiable)

1. **Server por defecto.** Todo componente es Server Component a menos que se justifique `"use client"`.
2. **`"use client"` mínimo.** Añadirlo solo cuando el componente use hooks, event handlers o Web APIs.
3. **Fetch en el servidor.** Nunca usar `useEffect` para fetching de datos — usar Server Components.
4. **Contrato JSON inmutable.** Toda respuesta de API respeta `{ success, data, error, code }`.
5. **Zustand sin Provider.** Los stores de Zustand no requieren `<Provider>` en el layout.
6. **Zod como única fuente de tipos.** Los tipos TypeScript se extraen con `z.infer<typeof Schema>`.
7. **Mutaciones vía Server Actions.** Solo usar Route Handlers para webhooks externos y APIs de terceros.
8. **Early returns siempre.** Evitar anidamiento profundo con guardias al inicio de funciones.
9. **kebab-case para archivos.** Sin excepción. PascalCase solo para nombres de funciones de componentes.
10. **Sin `any`.** Prohibido en cualquier parte del código.

---

## Skills Activas en Este Workspace

Las siguientes Skills amplían estas reglas con instrucciones detalladas y ejemplos:

- `nextjs-architecture` — Estructura de carpetas, routing, App Router patterns.
- `backend-integration` — Fetch nativo, Route Handlers, contrato JSON, seguridad.
- `clean-code` — Zod como única fuente de tipos, nomenclatura, JSDoc, patrones de funciones.
- `design-system` — Shadcn UI, Tailwind CSS, CVA, responsividad y animaciones.
- `rendering-and-state` — Server/Client Components, Zustand, Server Actions.
- `auth-and-security` — NextAuth.js v5, middleware, protección de rutas y roles.
- `create-skill` — Generación de nuevas habilidades estructuradas para el agente.

---

## Directorios Canónicos del Proyecto

```
/app          → Rutas, páginas, layouts, Route Handlers, Server Actions
/components   → UI (Shadcn), layout, forms, shared
/lib          → ORM client, utilidades, configuraciones
/store        → Zustand stores EXCLUSIVAMENTE
/hooks        → Custom hooks de React (sin Zustand, sin lógica de negocio)
/types        → Re-exports de z.infer<> (sin interfaces manuales)
/.agents      → Configuración de subagentes, skills y reglas del proyecto
```

> El agente **NO debe** crear carpetas raíz fuera de esta lista sin autorización explícita del Ingeniero.

---

## Subagentes Oficiales del Proyecto (`/.agents/subagents/`)

Para garantizar **desarrollo modular sin efectos secundarios**, cada cambio debe ser ejecutado por el subagente correspondiente a su dominio:

1. 💐 **`subagent-floreria-pos`**: POS, Insumos Vivos (`RawIngredient`), Mermas (`MermaLog`) y Arqueo de Caja (`CashRegisterShift`).
2. 💬 **`subagent-omnichannel-crm`**: Atencion Omnicanal (WhatsApp/FB/TikTok), Chat Drawer y CRM de Clientes (`CRMClient`, `CRMSpecialEvent`).
3. 🚚 **`subagent-logistics-orders`**: Logistica, Kanban de 3 estados, Calendario de Envíos (`OrderDelivery`) e Impresión de Tarjetas.
4. 👗 **`subagent-carissma-rentals`**: Alquiler de Vestidos (`Dress`), Reservas (`RentalBooking`), Ciclo de Vida (Lavandería, Devolución), Motor de Depreciación y Garantías.
5. 🛡️ **`subagent-auth-core-architecture`**: Autenticación (NextAuth v5), Roles RBAC, Esquema Prisma Core (`schema.prisma`), Zustand Store y Layout Global.

---

## Gobernanza & Escalabilidad No Destructiva

1. **Aislamiento de Cambios**: Ningún subagente puede modificar archivos fuera de sus *Límites de Archivos Autorizados* sin aprobación del `subagent-auth-core-architecture`.
2. **Compatibilidad Estricta de BD**: No eliminar ni renombrar columnas en `schema.prisma`. Toda evolución de esquema debe ser **aditiva (non-breaking changes)**.
3. **Contrato de Respuesta Bilateral**: Toda Server Action responde estrictamente `{ success, data, error, code }`.

