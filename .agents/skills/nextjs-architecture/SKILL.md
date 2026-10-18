---
name: nextjs-architecture
description: Reglas de arquitectura para Next.js App Router, estructura de carpetas canónica, patrones de enrutamiento y límites entre Server y Client Components. Usar cuando se creen rutas, páginas, layouts, o se decida dónde ubicar un nuevo archivo en cualquier proyecto web.
---

# Next.js Architecture

Define la estructura de carpetas canónica, las convenciones de enrutamiento del App Router y los límites entre Server y Client Components para proyectos Next.js con App Router.

## When to Use

- Al crear una nueva ruta, página o layout
- Al decidir en qué directorio raíz ubicar un nuevo archivo
- Al estructurar Route Groups para aislar layouts
- Al agregar archivos especiales (`loading.tsx`, `error.tsx`, `not-found.tsx`)
- Al generar metadata SEO para una página

## When Not to Use

- Para decisiones de estado global → usar skill `rendering-and-state`
- Para decisiones de estilos o componentes UI → usar skill `design-system`
- Para seguridad y autenticación → usar skill `auth-and-security`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Tipo de ruta | Yes | Pública, privada/dashboard, o API |
| Nombre de la sección | Yes | Ej: `products`, `users`, `settings`, `blog` |
| ¿Datos dinámicos por ID? | No | Determina si se necesita ruta `[id]` |

## Workflow

### Step 1: Validar ubicación del archivo

Antes de generar código, declarar en cuál directorio canónico irá el archivo:

```
/app          → Rutas, páginas, layouts, Route Handlers, Server Actions inline
/components   → Componentes visuales (ui/, layout/, forms/, shared/)
/lib          → ORM client, cn(), formatters, configuraciones externas
/store        → Zustand stores EXCLUSIVAMENTE
/hooks        → Custom hooks de React puros (sin Zustand, sin DB)
/types        → Re-exports de z.infer<typeof Schema> (sin interfaces manuales)
```

> ⚠️ No crear carpetas raíz fuera de esta lista sin autorización explícita del Ingeniero.

### Step 2: Determinar el Route Group correcto

Usar paréntesis para aislar layouts sin afectar la URL:

```
app/
├── (auth)/
│   ├── layout.tsx            ← Layout de autenticación (fondo, logo centrado)
│   ├── login/page.tsx        → /login
│   └── register/page.tsx     → /register
├── (dashboard)/
│   ├── layout.tsx            ← Sidebar + Navbar persistentes
│   ├── page.tsx              → /  (panel principal)
│   ├── [entity]/             → /[entity]  (sección principal del dominio)
│   │   ├── page.tsx          → /[entity]
│   │   └── [id]/page.tsx     → /[entity]/[id]
│   └── settings/
│       └── page.tsx          → /settings
└── api/
    └── webhooks/
        └── route.ts          → /api/webhooks (solo para servicios externos)
```

### Step 3: Crear los archivos especiales de la ruta

Toda nueva sección debe incluir como mínimo:

| Archivo | Propósito | Obligatorio |
|---------|-----------|-------------|
| `page.tsx` | UI de la ruta | ✅ Siempre |
| `loading.tsx` | Skeleton/Suspense automático | ✅ Siempre |
| `error.tsx` | Error Boundary (`"use client"`) | ✅ Siempre |
| `layout.tsx` | Layout compartido | Si hay UI repetida |
| `not-found.tsx` | UI para `notFound()` | En raíz y rutas clave |
| `route.ts` | API Route Handler | Solo webhooks/APIs externas |

### Step 4: Clasificar componentes en `/components`

```
/components
├── ui/       → Shadcn UI base (Button, Input, Card) — no modificar directamente
├── layout/   → Navbar, Footer, Sidebar, PageHeader
├── forms/    → Formularios completos (React Hook Form + Zod + Shadcn)
└── shared/   → Componentes de dominio reutilizables (EntityCard, StatusBadge)
```

### Step 5: Agregar metadata SEO en cada `page.tsx`

```typescript
import { type Metadata } from "next"

export const metadata: Metadata = {
  title: "Sección | Nombre del Proyecto",
  description: "Descripción clara y concisa de esta sección.",
}

export default async function SectionPage() { ... }
```

Para metadata dinámica por ID:

```typescript
export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const item = await getItem(params.id)
  return { title: `${item.name} | Nombre del Proyecto` }
}
```

## Validation

- [ ] El archivo está en uno de los 6 directorios canónicos
- [ ] La ruta usa Route Group si necesita layout aislado
- [ ] Existen `page.tsx` + `loading.tsx` + `error.tsx` en la nueva sección
- [ ] `page.tsx` exporta `metadata` o `generateMetadata`
- [ ] No se crearon carpetas raíz no autorizadas

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Poner lógica de negocio en `/components/ui/` | Moverla a Server Actions o `/lib` |
| Crear Route Handlers para operaciones internas | Usar Server Actions en su lugar |
| Olvidar `loading.tsx` en rutas con fetch async | Añadirlo siempre — evita layout shift |
| Mezclar tipos manuales en `/types/` | Solo `export type X = z.infer<typeof XSchema>` |
| Poner stores Zustand en `/hooks` | Solo van en `/store` |
