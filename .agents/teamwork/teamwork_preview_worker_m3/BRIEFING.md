# BRIEFING — 2026-10-09T20:26:00Z

## Mission
Implement responsive mobile & tablet features for Milestone 3: Logistics Kanban, CRM & Agenda (Florería & Carissma) with >= 44x44px touch targets, dual table-to-card rendering, and mobile tab switchers.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m3
- Original parent: cf1d79f3-8da1-4aff-9ccc-f4bf49d72a47
- Milestone: Milestone 3: Logistics Kanban, CRM & Agenda

## 🔒 Key Constraints
- Critical Constraint R4: Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso next dev o npm run dev en la terminal de VS Code. Validar únicamente con comandos independientes como npx tsc --noEmit.
- Exclusive file ownership:
  - components/floreria/orders-view.tsx
  - components/carissma/orders/orders-kanban-board.tsx
  - components/carissma/orders/orders-agenda-table.tsx
  - components/floreria/crm-view.tsx
  - components/carissma/crm-view.tsx
  - components/floreria/edit-order-modal.tsx
- Touch targets >= 44x44px.
- Dual rendering: table on >= 768px (hidden md:block), stacked cards on < 768px (block md:hidden space-y-3).
- Input font size >= 16px on mobile (text-base sm:text-xs or text-base md:text-sm) to prevent auto-zoom.

## Current Parent
- Conversation ID: cf1d79f3-8da1-4aff-9ccc-f4bf49d72a47
- Updated: not yet

## Task Summary
- **What to build**: Mobile Kanban segmented control tabs, touch targets >= 44x44px, dual table-to-card rendering in orders-agenda-table and CRM views, font-size >= 16px on mobile form inputs.
- **Success criteria**: Clean compilation with `npx tsc --noEmit` (0 errors), responsive card views for mobile, active dev server intact.
- **Interface contracts**: PROJECT.md Table to Card Dual-View Contract & Safe Area / Tap Ergonomics Contract.
- **Code layout**: PROJECT.md Code Layout.

## Change Tracker
- **Files modified**: none yet
- **Build status**: pending
- **Pending issues**: none

## Quality Status
- **Build/test result**: pending
- **Lint status**: clean
- **Tests added/modified**: none

## Loaded Skills
- **Source**: c:\Users\Lenovo\Desktop\floreria\.agents\skills\design-system\SKILL.md
  - **Local copy**: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m3\skills\design-system.md
  - **Core methodology**: Mobile-first Tailwind, Shadcn/CVA, >= 44x44px touch targets.
- **Source**: c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md
  - **Local copy**: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m3\skills\clean-code.md
  - **Core methodology**: Zod as single source of truth, early returns, no any, proper naming.

## Key Decisions Made
- Focus edits strictly on the 6 owned files: orders-view.tsx, orders-kanban-board.tsx, orders-agenda-table.tsx, floreria/crm-view.tsx, carissma/crm-view.tsx, edit-order-modal.tsx.

## Artifact Index
- DISPATCH.md — Assignment instructions
- skills/design-system.md — Design system skill summary
- skills/clean-code.md — Clean code skill summary
