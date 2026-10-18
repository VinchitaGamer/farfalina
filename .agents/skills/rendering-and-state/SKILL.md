---
name: rendering-and-state
description: Directivas para Server Components vs Client Components, uso correcto de "use client" y "use server", gestión de estado global con Zustand (prohibición de Context API), y Server Actions como mecanismo primario de mutación de datos. Usar en cualquier decisión de renderizado o estado en proyectos Next.js.
---

# Rendering and State

Define cuándo un componente debe ser Server o Client Component, cómo aplicar correctamente las directivas `"use client"` y `"use server"`, cómo estructurar el estado global con Zustand, y cómo implementar mutaciones con Server Actions en cualquier proyecto Next.js con App Router.

## When to Use

- Al decidir si un componente necesita `"use client"`
- Al crear un Server Action para mutación de datos
- Al diseñar un Zustand store para estado global
- Al implementar feedback de UI durante una mutación (loading, error)
- Al detectar un `useEffect` usado para fetching de datos

## When Not to Use

- Para estructura de carpetas del proyecto → `nextjs-architecture`
- Para seguridad de rutas o sesiones → `auth-and-security`
- Para el contrato de respuesta JSON → `backend-integration`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Tipo de componente | Yes | Página, layout, form, botón interactivo, widget, etc. |
| Usa hooks de React | Yes | Determina si necesita `"use client"` |
| Tipo de operación | No | Lectura (fetch) o escritura (mutación) |

## Workflow

### Step 1: Determinar si el componente necesita `"use client"`

Todo componente es **Server Component por defecto**. Agregar `"use client"` como primera línea **solo** cuando use alguno de:

| Requiere `"use client"` | No requiere `"use client"` |
|-------------------------|---------------------------|
| `useState`, `useReducer` | Acceso a la base de datos |
| `useEffect`, `useLayoutEffect` | Variables de entorno del servidor |
| `useRef` en DOM | `async/await` para fetch de datos |
| `useContext` | Renderizar Server Components como `children` |
| Event handlers (`onClick`, `onChange`) | Export de `metadata` |
| Web APIs del browser (`localStorage`, `window`) | — |
| Hooks de terceros (Zustand, React Hook Form) | — |

```typescript
// ✅ CORRECTO — primera línea, antes de cualquier import
"use client"

import { useState } from "react"

export default function SearchBar() {
  const [query, setQuery] = useState("")
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />
}

// ❌ ANTI-PATRÓN — "use client" en layout que no usa hooks
// Contamina todo el subtárbol y elimina los beneficios de RSC
"use client"
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex">{children}</div>
}
```

**Regla de islas:** mover `"use client"` lo más abajo posible en el árbol. Los datos viajan del servidor al cliente como props, nunca al revés.

### Step 2: Implementar fetch de datos en el servidor (no en useEffect)

```typescript
// ✅ CORRECTO — Server Component con acceso directo a DB
export default async function ItemsPage() {
  const items = await db.item.findMany()
  return <ItemTable items={items} />
}

// ❌ PROHIBIDO — useEffect para fetching (re-fetch innecesario, sin SSR)
"use client"
export default function ItemsPage() {
  const [items, setItems] = useState([])
  useEffect(() => {
    fetch("/api/items").then(...)
  }, [])
}
```

### Step 3: Crear Server Actions para mutaciones

```typescript
// app/actions/item-actions.ts
"use server"

import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ItemSchema } from "@/lib/schemas"

/**
 * Crea un nuevo ítem y revalida la lista.
 * @param data - Datos validados según ItemSchema
 * @returns { success, data, error, code }
 */
export async function createItem(data: z.infer<typeof ItemSchema>) {
  const validated = ItemSchema.safeParse(data)
  if (!validated.success) {
    return { success: false, data: null, error: "Datos inválidos", code: 422 }
  }
  try {
    const item = await db.item.create({ data: validated.data })
    revalidatePath("/items")
    return { success: true, data: item, error: null, code: 201 }
  } catch {
    return { success: false, data: null, error: "Error al crear el ítem", code: 500 }
  }
}
```

### Step 4: Conectar la mutación con feedback de UI

```typescript
// Con useActionState — para formularios (React 19+, preferido)
"use client"
import { useActionState } from "react"
import { createItem } from "@/app/actions/item-actions"

export function ItemForm() {
  const [state, formAction, isPending] = useActionState(createItem, null)
  return (
    <form action={formAction}>
      <input name="name" required />
      <button type="submit" disabled={isPending}>
        {isPending ? "Guardando..." : "Guardar"}
      </button>
      {state?.error && <p className="text-destructive">{state.error}</p>}
    </form>
  )
}

// Con useTransition — para acciones programáticas (no forms)
"use client"
import { useTransition } from "react"

export function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <button onClick={() => startTransition(() => deleteItem(id))} disabled={isPending}>
      {isPending ? "Eliminando..." : "Eliminar"}
    </button>
  )
}
```

### Step 5: Gestionar estado global con Zustand (nunca Context API)

```typescript
// store/ui-store.ts
import { create } from "zustand"
import { devtools } from "zustand/middleware"

type UiState = { isSidebarOpen: boolean; activeModal: string | null }
type UiActions = {
  toggleSidebar: () => void
  openModal: (id: string) => void
  closeModal: () => void
}

export const useUiStore = create<UiState & UiActions>()(
  devtools(
    (set) => ({
      isSidebarOpen: true,
      activeModal: null,
      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
      openModal: (id) => set({ activeModal: id }),
      closeModal: () => set({ activeModal: null }),
    }),
    { name: "ui-store" }
  )
)

// Consumo con selector granular — evita re-renders innecesarios
const isSidebarOpen = useUiStore((state) => state.isSidebarOpen) // ✅
const { isSidebarOpen } = useUiStore()                            // ❌
```

Context API de React está **completamente prohibida** como alternativa a Zustand.

## Validation

- [ ] `"use client"` solo aparece cuando el componente usa hooks o event handlers
- [ ] `"use client"` está en la primera línea, antes de los imports
- [ ] No hay `useEffect` para fetching de datos — se usa Server Component
- [ ] Las mutaciones usan Server Actions (no Route Handlers internos)
- [ ] Los Server Actions tienen `"use server"` y están en `/app/actions/`
- [ ] El estado global está en `/store` con Zustand (no Context API)
- [ ] Los stores usan el middleware `devtools()`
- [ ] Los selectores de Zustand son granulares (un valor por llamada)

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| `"use client"` en layout o página que no usa hooks | Eliminar la directiva |
| `useEffect` para fetch de datos | Mover fetch a Server Component y pasar como prop |
| Context API para estado compartido | Crear Zustand store en `/store` |
| `const { a, b, c } = useMyStore()` | Un selector por valor: `const a = useMyStore(s => s.a)` |
| Store Zustand en `/hooks/` | Moverlo a `/store/` exclusivamente |
| Route Handler para mutación de formulario | Convertir a Server Action con `"use server"` |
| `useActionState` sin renderizar el estado de error | Siempre mostrar `state?.error` si existe |
