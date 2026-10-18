---
name: design-system
description: Reglas para el uso de Shadcn UI, Tailwind CSS, CVA, Lucide React y convenciones de diseño UI/UX. Incluye protocolo de cuestionario obligatorio antes de maquetar. Usar cuando se cree o modifique cualquier componente visual o interfaz en cualquier proyecto web.
---

# Design System

Gobierna todas las decisiones de interfaz visual: qué librerías usar, cómo construir componentes con CVA, cómo escribir clases Tailwind, cuándo escalar a Framer Motion, y el protocolo de cuestionario obligatorio que el agente debe ejecutar antes de maquetar cualquier UI.

## When to Use

- Al crear o modificar cualquier componente visual
- Al iniciar el desarrollo de una nueva página, sección o landing
- Al agregar un componente de Shadcn UI al proyecto
- Al implementar animaciones o transiciones
- Al aplicar estilos responsivos con Tailwind

## When Not to Use

- Para decisiones de enrutamiento o estructura de carpetas → `nextjs-architecture`
- Para manejo de estado en componentes interactivos → `rendering-and-state`
- Para lógica de formularios y validación de datos → `clean-code` + `rendering-and-state`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Paleta de colores | Yes | Primario, secundario y acento definidos por el Ingeniero |
| Dark Mode | Yes | Sí / No / Ambos — nunca asumir |
| Estilo visual | Yes | Corporativo, minimalista, moderno, playful, etc. |
| Estructura del layout | Yes | Qué secciones y en qué orden |

## Workflow

### Step 1: Ejecutar cuestionario de diseño (obligatorio antes de maquetar)

El agente **pausa la ejecución** y pregunta al Ingeniero:

1. ¿Cuáles son los colores principales y secundarios?
2. ¿Se requiere Dark Mode?
3. ¿Disposición esperada del layout? (Navbar, Sidebar, Footer, Hero, etc.)
4. ¿Estilo visual? (ej: corporativo / minimalista / moderno / playful / editorial)

> ⚠️ Bajo ninguna circunstancia el agente inventa colores o estilos. La ejecución queda suspendida hasta recibir respuestas.

### Step 2: Instalar componentes Shadcn correctamente

```bash
# ✅ Comandos correctos
npx shadcn@latest init                          # inicializar en proyecto nuevo
npx shadcn@latest add button
npx shadcn@latest add input dialog card table badge select

# ❌ Este comando NO existe
npx skills add shadcn/ui
```

Reglas de uso de Shadcn:
- **Nunca modificar** archivos en `/components/ui/` generados por Shadcn
- Para extender un componente Shadcn, crear un wrapper en `/components/shared/`
- Los componentes Shadcn son Client Components — pasarles datos como props desde Server Components

### Step 3: Construir componentes base con el patrón CVA

```typescript
// components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Clases base — siempre aplicadas
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary/90",
        outline:     "border border-input bg-background hover:bg-accent",
        ghost:       "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm:      "h-8 px-3 text-xs",
        default: "h-10 px-4 py-2",
        lg:      "h-12 px-8",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
```

Reglas del patrón CVA:
- Usar `cn()` de `@/lib/utils` para combinar clases — nunca concatenación de strings
- `tailwind-merge` y `clsx` ya están integrados en `cn()` — no importarlos por separado
- **Sin CSS inline** (`style={{ }}`) excepto para valores dinámicos de JavaScript puro

### Step 4: Escribir clases Tailwind con `cn()`

```typescript
// ✅ CORRECTO
<div className={cn(
  "flex items-center gap-4 rounded-lg p-4",        // layout
  "text-sm font-medium",                            // typography
  "bg-card text-foreground",                        // colors (variables Shadcn/CSS)
  "hover:bg-accent transition-colors duration-200", // interactions
  isActive && "border-2 border-primary",            // conditional
  className,                                         // prop override al final
)} />

// ❌ INCORRECTO
<div className={"flex " + (isActive ? "border-primary" : "")} />
```

Orden de clases: `layout → spacing → sizing → typography → colors → effects → states`

### Step 5: Aplicar responsividad Mobile-First

Las clases base son para móvil — escalar hacia arriba:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {items.map((item) => <ItemCard key={item.id} item={item} />)}
</div>
```

Breakpoints: `sm: 640px` → `md: 768px` → `lg: 1024px` → `xl: 1280px`

### Step 6: Elegir el mecanismo de animación correcto

Seguir esta jerarquía — solo escalar si la opción anterior no resuelve el requisito:

1. **Tailwind CSS** (siempre primero — sin bundle extra)
   ```tsx
   <div className="transition-all duration-200 ease-in-out hover:scale-105" />
   ```

2. **Framer Motion** (solo con aprobación explícita del Ingeniero)
   - Exclusivo para: drag & drop, layout animations, gestos complejos
   - **Siempre** dentro de un componente con `"use client"`
   ```tsx
   "use client"
   import { motion } from "framer-motion"
   <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
   ```

## Validation

- [ ] El cuestionario de diseño se ejecutó antes de generar UI
- [ ] Los colores vienen del Ingeniero, no de valores inventados
- [ ] Se usó `npx shadcn@latest add [component]` (no otro comando)
- [ ] Los componentes base usan patrón CVA con `cn()`
- [ ] No hay CSS inline (`style={{ }}`) excepto para valores JS dinámicos
- [ ] No se modificaron archivos en `/components/ui/` directamente
- [ ] El layout es Mobile-First con breakpoints `sm/md/lg/xl`
- [ ] Tailwind se usó antes de recurrir a Framer Motion

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Inventar paleta de colores sin preguntar | Detener ejecución y ejecutar el cuestionario |
| Editar un archivo generado por Shadcn en `/components/ui/` | Crear wrapper en `/components/shared/` |
| Usar Framer Motion sin autorización | Verificar si Tailwind puede resolver la animación primero |
| `"use client"` omitido en componente con Framer Motion | Siempre es la primera línea del archivo |
| Concatenar strings de clases Tailwind | Usar `cn()` de `@/lib/utils` |
| CSS inline para estilos estáticos | Reemplazar con clases Tailwind equivalentes |
