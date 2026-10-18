# DB Backend Architect Methodology
Source: c:\Users\Lenovo\Desktop\floreria\.agents\skills\db-backend-architect\SKILL.md

- Zod as single source of truth for all types and input validation.
- Bilateral JSON contract: { success: boolean, data: T | null, error: string | null, code: number | string }.
- Early returns for validation, permissions, error guards.
- Server cache and Prisma ORM optimization.
- Additive/non-breaking DB operations.
