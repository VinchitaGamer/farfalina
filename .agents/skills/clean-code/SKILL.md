---
name: clean-code
description: Normas absolutas de tipado con Zod, patrones de funciones, nomenclatura de archivos y documentación JSDoc. Usar cuando se escriba cualquier función, schema, componente o utilidad en cualquier proyecto web. La fuente de verdad de tipos es siempre Zod.
---

# Clean Code

Define las convenciones de calidad de código del proyecto: Zod como única fuente de tipos, reglas de declaración de funciones, tabla de nomenclatura estándar y obligatoriedad de JSDoc en Server Actions y utilidades de negocio.

## When to Use

- Al crear cualquier función, componente, hook o utilidad
- Al definir tipos o validaciones de TypeScript
- Al nombrar archivos, variables, constantes o schemas
- Al documentar una Server Action o función utilitaria de negocio
- Al revisar código generado para validar que cumple los estándares

## When Not to Use

- Para decidir dónde ubicar un archivo → usar skill `nextjs-architecture`
- Para convenciones de componentes visuales → usar skill `design-system`
- Para estructura de stores Zustand → usar skill `rendering-and-state`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Tipo de artefacto | Yes | Función, schema, componente, hook, utilidad o constante |
| Nombre propuesto | Yes | El agente valida contra la tabla de nomenclatura |

## Workflow

### Step 1: Definir tipos con Zod (nunca interfaces manuales)

```typescript
// ✅ CORRECTO — Zod como única fuente de verdad
import { z } from "zod"

export const ProductSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(2, "Mínimo 2 caracteres"),
  email: z.string().email("Email inválido"),
  price: z.number().positive(),
  category: z.string().optional(),
})

// El tipo se infiere del schema — nunca se escribe manualmente
export type Product = z.infer<typeof ProductSchema>

// ❌ PROHIBIDO — duplicar el tipo manualmente
export interface Product { id: string; name: string; price: number }
```

### Step 2: Elegir la sintaxis de función correcta

| Contexto | Sintaxis correcta | Ejemplo |
|----------|-------------------|---------|
| Server Component | `export default function` | `export default function ProductsPage()` |
| Client Component | `export default function` | `export default function ProductForm()` |
| Custom Hook | `export function` | `export function useProductSearch()` |
| Server Action | `export async function` | `export async function createProduct()` |
| Event handler interno | `const` + arrow | `const handleSubmit = async () => {}` |
| Callback de array | Arrow implícita | `items.map((item) => item.name)` |
| Utilidad pequeña (1-3 líneas) | `const` + arrow | `const formatPrice = (n: number) => ...` |

> **Regla de oro:** Si se exporta con nombre → declaración de función. Si es interna y pequeña → arrow function.

### Step 3: Aplicar early returns para evitar anidamiento

```typescript
// ✅ CORRECTO — plano y predecible
export async function getItem(id: string) {
  if (!id) return null
  const item = await db.item.findUnique({ where: { id } })
  if (!item) return null
  return item
}

// ❌ INCORRECTO — anidamiento profundo
export async function getItem(id: string) {
  if (id) {
    const item = await db.item.findUnique({ where: { id } })
    if (item) { return item }
  }
  return null
}
```

### Step 4: Verificar la nomenclatura

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Archivos | `kebab-case` | `product-card.tsx`, `format-price.ts` |
| Componentes React | `PascalCase` | `function ProductCard()` |
| Custom Hooks | `use` + `camelCase` | `function useProductSearch()` |
| Zustand Stores | `use` + `camelCase` | `useCartStore` |
| Variables y funciones | `camelCase` | `const productData` |
| Schemas de Zod | `PascalCase` + `Schema` | `ProductSchema`, `UserSchema` |
| Types inferidos de Zod | `PascalCase` | `type Product`, `type User` |
| Variables de entorno | `UPPER_SNAKE_CASE` | `WEBHOOK_SECRET`, `DATABASE_URL` |
| Constantes de módulo | `UPPER_SNAKE_CASE` | `const MAX_ITEMS_PER_PAGE = 50` |

> El tipo `any` está **completamente prohibido**. Usar `unknown` + narrowing.

### Step 5: Añadir JSDoc en Server Actions y utilidades de negocio

```typescript
/**
 * Crea un nuevo ítem en la base de datos y revalida la lista.
 * @param data - Datos validados según el schema correspondiente
 * @returns { success, data: T | null, error: string | null, code: number }
 */
export async function createItem(data: z.infer<typeof ItemSchema>) {
  // ...
}

/**
 * Formatea un valor numérico como precio con símbolo de moneda.
 * @param amount - Número en centavos o entero
 * @param currency - Código ISO 4217 (default: "USD")
 * @returns String formateado como "$1,234.56"
 */
export const formatPrice = (amount: number, currency = "USD"): string => {
  // ...
}
```

## Validation

- [ ] No existen interfaces TypeScript manuales — solo `z.infer<>`
- [ ] Los schemas de Zod siguen el patrón `EntidadSchema`
- [ ] Las funciones exportadas usan declaración, no arrow
- [ ] No hay `any` en ninguna parte del código
- [ ] Nombres de archivo en `kebab-case`
- [ ] Server Actions y utilidades de negocio tienen JSDoc con `@param` y `@returns`
- [ ] No hay anidamiento mayor a 2 niveles (early returns aplicados)

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| `interface Product { ... }` | Reemplazar con `z.infer<typeof ProductSchema>` |
| `const MyComponent = () => {}` exportado | Convertir a `export default function MyComponent()` |
| Usar `any` como escape hatch | Usar `unknown` y narrowing con `z.safeParse` o type guards |
| Arrow function en custom hook exportado | `export function useMyHook()` con declaración |
| Comentarios obvios línea por línea | Eliminarlos — el JSDoc va solo en actions y utilidades |
| `import type` de interfaz manual en `/types` | Exportar `type X = z.infer<typeof XSchema>` desde el schema |
