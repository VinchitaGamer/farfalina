---
name: backend-integration
description: Normas para comunicación HTTP con fetch nativo, seguridad en Route Handlers, contrato JSON bilateral de respuestas, y decisión entre Server Actions y Route Handlers en Next.js App Router. Usar cuando se creen endpoints, webhooks, o llamadas a servicios externos en cualquier proyecto web.
---

# Backend Integration

Establece las reglas para toda comunicación HTTP del proyecto: qué cliente usar, cómo proteger endpoints, cuándo elegir Server Action vs Route Handler, y el contrato JSON que toda respuesta debe respetar.

## When to Use

- Al crear un Route Handler en `/app/api`
- Al consumir una API o microservicio externo con `fetch`
- Al decidir entre Server Action y Route Handler para una operación
- Al recibir un webhook de un servicio externo (Stripe, N8N, Zapier, etc.)
- Al definir la estructura de una respuesta JSON

## When Not to Use

- Para mutaciones internas de formularios → usar Server Actions (ver skill `rendering-and-state`)
- Para lógica de autenticación → usar skill `auth-and-security`
- Para acceso directo a base de datos desde Server Components → usar el ORM client directamente

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Tipo de operación | Yes | Mutación interna, webhook externo, o consumo de API |
| Requiere autenticación | Yes | Determina si se valida Bearer Token o sesión |
| Estrategia de caché | No | No-store, revalidate, o permanente |

## Workflow

### Step 1: Elegir el mecanismo correcto

| Caso de uso | Mecanismo |
|-------------|-----------|
| Formulario del usuario (crear, editar, eliminar) | ✅ Server Action |
| Lógica interna con revalidación de caché | ✅ Server Action |
| Webhook de servicio externo (Stripe, N8N, etc.) | ✅ Route Handler |
| API consumida por app móvil o cliente externo | ✅ Route Handler |
| Fetch inicial de datos en una página | ✅ Server Component directo |
| Polling o tiempo real desde el cliente | ✅ Route Handler + SWR |

> `/app/api` está reservado para integraciones externas y webhooks exclusivamente.

### Step 2: Implementar fetch nativo (si se consume API externa)

Nunca usar Axios. Elegir la estrategia de caché según el tipo de dato:

```typescript
// Datos dinámicos — sin caché (ej: inventario en tiempo real)
const res = await fetch("https://api.example.com/items", {
  cache: "no-store",
})

// Datos revalidables — caché con TTL (ej: catálogo de productos)
const res = await fetch("https://api.example.com/catalog", {
  next: { revalidate: 3600 },
})

// Datos inmutables — caché permanente (ej: configuración estática)
const res = await fetch("https://api.example.com/config")
```

### Step 3: Proteger el Route Handler con Bearer Token

Todo endpoint expuesto públicamente valida el token como primera operación (early return):

```typescript
// app/api/webhooks/route.ts
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  // Early return — validar antes de cualquier lógica
  const token = req.headers.get("Authorization")?.replace("Bearer ", "")
  if (!token || token !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized", code: 401 },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    // ... lógica de negocio
    return NextResponse.json({
      success: true,
      data: { received: true },
      error: null,
      code: 200,
    })
  } catch (error) {
    console.error("[WEBHOOK_ERROR]", error)
    return NextResponse.json(
      { success: false, data: null, error: "Internal Server Error", code: 500 },
      { status: 500 }
    )
  }
}
```

### Step 4: Aplicar el contrato JSON bilateral

Los cuatro campos son **siempre obligatorios** en toda respuesta, sin excepción:

```json
// Éxito
{ "success": true,  "data": { "id": "abc123" }, "error": null,          "code": 200 }

// Error
{ "success": false, "data": null,               "error": "Descripción", "code": 500 }
```

| Situación | `code` | HTTP Status |
|-----------|--------|-------------|
| Éxito | 200 | 200 |
| Creado | 201 | 201 |
| No autenticado | 401 | 401 |
| Sin permisos | 403 | 403 |
| No encontrado | 404 | 404 |
| Validación fallida | 422 | 422 |
| Error interno | 500 | 500 |

## Validation

- [ ] Se usa `fetch` nativo (no Axios ni ninguna otra librería HTTP)
- [ ] El Route Handler tiene early return con validación de `WEBHOOK_SECRET`
- [ ] Toda la lógica del handler está dentro de `try/catch`
- [ ] La respuesta incluye los cuatro campos: `success`, `data`, `error`, `code`
- [ ] No se devuelven strings planos ni objetos de error nativos de JS
- [ ] La variable de entorno usada es `WEBHOOK_SECRET`

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Importar Axios | Eliminarlo y reemplazar con `fetch` nativo |
| Devolver solo `{ message: "ok" }` | Siempre usar el contrato de 4 campos |
| Lógica de negocio antes de validar token | El early return va en la primera línea del handler |
| Route Handler para operación interna de formulario | Convertir a Server Action |
| Omitir `try/catch` en el handler | Toda la lógica siempre va dentro del bloque |
| Hardcodear tokens o secrets | Siempre usar variables de entorno (`process.env.WEBHOOK_SECRET`) |
