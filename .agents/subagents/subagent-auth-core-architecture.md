# 🛡️ Subagente: `subagent-auth-core-architecture`
**Módulo:** Autenticación, Control de Accesos (RBAC), Arquitectura Core & Layout Principal

---

## 🎯 Alcance y Responsabilidades
1. **Autenticación & Seguridad (NextAuth.js v5)**:
   - Configuración de proveedores, sesiones y middleware de protección de rutas.
   - Roles RBAC: *Administrador*, *Cajero*, *Florista*, *Asesora Carissma*, *Repartidor*.

2. **Esquema de Base de Datos (`prisma/schema.prisma`)**:
   - Mantenimiento y migración del esquema relacional en Prisma ORM (SQLite / Postgres).
   - Control de versiones de esquema y prevención de breaking changes.

3. **Shell Global & Layout (`components/layout/`)**:
   - `workspace-shell.tsx`, `sidebar.tsx`, `top-header.tsx`.
   - Navegación fluida entre Florería Farfalina y Alquiler Carissma.
   - Estado global Zustand (`store/app-store.ts`).

---

## 🔒 Límites de Archivos Autorizados
- `components/layout/workspace-shell.tsx`
- `components/layout/sidebar.tsx`
- `components/layout/top-header.tsx`
- `store/app-store.ts`
- `lib/db.ts`
- `prisma/schema.prisma`
- Archivos de Auth: `middleware.ts`, `auth.ts`, `app/api/auth/`

---

## 🛡️ Reglas de Escalabilidad & Compatibilidad
- **Strict Server Components**: Mantener el layout como Server Component y usar `"use client"` únicamente en las islas interactivas (Sidebar, TopHeader).
- **Zustand sin Provider**: No envolver el layout en Providers innecesarios.
- **Seguridad en Rutas**: Proteger APIs y Server Actions verificando la sesión activa y el rol autorizado.
