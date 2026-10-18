---
name: auth-and-security
description: Reglas de autenticación con NextAuth.js v5, protección de rutas con middleware, acceso a sesión por contexto y buenas prácticas de seguridad para cualquier proyecto web con Next.js App Router. Usar cuando se proteja una ruta, se acceda a la sesión o se manejen credenciales.
---

# Auth and Security

Cubre toda la superficie de autenticación y autorización del proyecto: configuración de NextAuth.js v5, middleware de protección de rutas, acceso a sesión por contexto (Server Components, Server Actions y Route Handlers), y reglas de seguridad para proteger datos de usuarios.

## When to Use

- Al proteger una ruta o página privada del proyecto
- Al acceder a la sesión del usuario en cualquier contexto (página, action, handler)
- Al configurar NextAuth.js o sus providers de autenticación
- Al crear variables de entorno relacionadas con auth o secrets
- Al implementar autorización por rol o permisos específicos

## When Not to Use

- Para proteger Route Handlers de webhooks externos con Bearer Token → `backend-integration`
- Para validar datos de formularios de login con Zod → combinar con skill `clean-code`
- Para estructura de carpetas del proyecto de auth → `nextjs-architecture`

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Tipo de contexto | Yes | Server Component, Server Action, o Route Handler |
| Roles del proyecto | No | Ej: ADMIN, EDITOR, USER, VIEWER — definidos por el Ingeniero |
| Provider de auth | No | Credentials, Google, GitHub, etc. |

## Workflow

### Step 1: Configurar NextAuth.js v5

```typescript
// auth.ts (raíz del proyecto, mismo nivel que /app)
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        })
        if (!user || !user.password) return null

        const match = await bcrypt.compare(parsed.data.password, user.password)
        if (!match) return null

        // NUNCA incluir el hash del password en el objeto retornado
        return { id: user.id, name: user.name, email: user.email, role: user.role }
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
})
```

### Step 2: Proteger rutas con middleware

```typescript
// middleware.ts (raíz del proyecto — mismo nivel que /app)
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isAuthenticated = !!req.auth
  const { pathname } = req.nextUrl

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register")
  const isPublicRoute = pathname === "/" || pathname.startsWith("/api/webhooks")

  // Redirigir usuarios no autenticados a /login
  if (!isAuthenticated && !isAuthRoute && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Redirigir usuarios ya autenticados fuera del login
  if (isAuthenticated && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
}
```

### Step 3: Acceder a la sesión según el contexto

**En Server Components:**
```typescript
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function PrivatePage() {
  const session = await auth()
  if (!session) redirect("/login")
  return <Dashboard user={session.user} />
}
```

**En Server Actions:**
```typescript
"use server"
import { auth } from "@/auth"

export async function deleteResource(resourceId: string) {
  const session = await auth()
  if (!session) {
    return { success: false, data: null, error: "No autenticado", code: 401 }
  }
  // Verificar permisos a nivel de rol (no solo autenticación)
  if (!["ADMIN", "EDITOR"].includes(session.user.role)) {
    return { success: false, data: null, error: "Sin permisos", code: 403 }
  }
  // ... lógica de eliminación
}
```

**En Route Handlers:**
```typescript
import { auth } from "@/auth"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized", code: 401 },
      { status: 401 }
    )
  }
  // ...
}
```

### Step 4: Configurar variables de entorno de seguridad

```env
# .env.local — NUNCA commitear este archivo al repositorio
AUTH_SECRET="mínimo-32-caracteres"    # Generar: openssl rand -base64 32
DATABASE_URL="postgresql://..."
WEBHOOK_SECRET="cadena-aleatoria-segura"
```

**Regla:** `AUTH_SECRET` debe tener al menos 32 caracteres. Generarlo con:
```bash
openssl rand -base64 32
```

## Validation

- [ ] `auth.ts` existe en la raíz del proyecto (no dentro de `/app`)
- [ ] `middleware.ts` existe en la raíz y filtra rutas correctamente
- [ ] El objeto de sesión nunca incluye el hash del password
- [ ] Las Server Actions verifican sesión antes de ejecutar lógica de negocio
- [ ] Se verifica el rol además de la autenticación en operaciones sensibles
- [ ] `AUTH_SECRET` tiene al menos 32 caracteres
- [ ] No hay JWT ni cookies de sesión implementadas manualmente
- [ ] Las variables sensibles están en `.env.local` (no en el código fuente)

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Confiar solo en el middleware para autorización | Añadir `auth()` también dentro de cada Server Action |
| Exponer `user.password` en el objeto de sesión | El `authorize()` retorna solo id, name, email, role |
| `AUTH_SECRET` con menos de 32 caracteres | Regenerar con `openssl rand -base64 32` |
| Implementar JWT manualmente | Usar exclusivamente NextAuth.js v5 |
| `middleware.ts` dentro de `/app` | Debe estar en la raíz del proyecto |
| Loguear datos personales del usuario en errores | Los logs incluyen solo IDs, timestamps y códigos |
| Autorización solo por autenticación (sin verificar rol) | Siempre verificar `session.user.role` en operaciones sensibles |
| Hardcodear roles como strings sueltos | Definir un enum o schema Zod para los roles del proyecto |
