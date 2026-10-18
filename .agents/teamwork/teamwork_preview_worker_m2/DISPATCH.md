# Dispatch — Worker Milestone 2: POS, Catalogs & Rentals Modules

You are the Worker for Milestone 2: POS, Catalogs & Rentals Modules.
Your Working Directory: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m2`

## MANDATORY INPUTS
- Read verbatim: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## Follow-up — 2026-10-09T18:17:28Z`)
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md`
- Read Survey 2 Report: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_2\report.md`
- Read Survey 2 Handoff: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_2\handoff.md`
- Skills: `c:\Users\Lenovo\Desktop\floreria\.agents\skills\design-system\SKILL.md`, `c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## CRITICAL CONSTRAINT R4: PRESERVACIÓN DEL SERVIDOR DE DESARROLLO ACTIVO
Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso `next dev` o `npm run dev` corriendo en la terminal de VS Code del cliente. Toda validación de compilación debe ejecutarse mediante comandos independientes como `npx tsc --noEmit`.

## EXCLUSIVE FILE OWNERSHIP
You own and may edit ONLY:
- `components/floreria/pos/pos-cart-panel.tsx`
- `components/carissma/pos-view.tsx`
- `components/floreria/pos/pos-stock-table.tsx`
- `components/carissma/catalog-view.tsx`
- `components/floreria/new-arrangement-modal.tsx`
- `components/carissma/orders/orders-new-booking-modal.tsx`
- `components/carissma/orders/orders-inspection-modal.tsx`

## OBJECTIVES & DETAILED IMPLEMENTATION
1. **Florería POS (`components/floreria/pos/pos-cart-panel.tsx`)**:
   - Add a mobile tab toggle on `< 1024px` (`lg:hidden`): `[Catálogo ({itemsCount})]` and `[Ticket ({cartCount}) - Bs {total}]` with sticky bottom trigger / header tab so mobile operators can toggle between browsing items and inspecting/paying the ticket without scrolling past all products.
   - Add quick-cash denomination buttons: `Bs 10`, `Bs 20`, `Bs 50`, `Bs 100`, `Bs 200`, and `Exacto` for fast checkout without virtual keyboard.
   - Enforce minimum touch targets: `+` / `-` quantity buttons and trash button must have `min-h-[44px] min-w-[44px]` (or `h-11 w-11 p-2 active:scale-95 touch-manipulation`).
   - Use `text-base sm:text-xs md:text-sm` on inputs.
2. **Carissma POS (`components/carissma/pos-view.tsx`)**:
   - Add mobile tab toggle on `< 1024px` (`lg:hidden`): `[Vestidos ({dressesCount})]` and `[Alquiler ({cartCount}) - Bs {total}]`.
   - Add quick-cash denomination buttons: `Bs 10`, `Bs 20`, `Bs 50`, `Bs 100`, `Bs 200`, `Exacto`.
   - Enforce touch targets `>= 44x44px` on size pills, quantity controls, and delete buttons.
   - In Tab Stock (lines ~954-1030) and Tab Register (lines ~1096-1139): implement dual rendering: `hidden md:block` for the table, `block md:hidden space-y-3` for stacked touch cards.
3. **Florería Insumos Vivos Stock Table (`components/floreria/pos/pos-stock-table.tsx`)**:
   - Add dual rendering: `hidden md:block` for the 9-column table, `block md:hidden space-y-3` for stacked cards. Each card displays ingredient name, unit, cost, current stock badge, status badge, and `>= 44x44px` restock and merma action buttons.
4. **Carissma Catalog (`components/carissma/catalog-view.tsx`)**:
   - Fix floating cart bar position (around lines 474-476):
     Replace `fixed bottom-6 right-6 ... max-w-lg w-full` with:
     `fixed bottom-20 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 max-w-lg sm:w-auto z-40`
     to clear `MobileBottomNav` and avoid horizontal overflow (`overflow-x`).
5. **Modals (`new-arrangement-modal.tsx`, `orders-new-booking-modal.tsx`, `orders-inspection-modal.tsx`)**:
   - Ensure form inputs use `text-base sm:text-xs` (16px on mobile) and action/close buttons have `>= 44x44px` touch targets.

## VERIFICATION
- Run `npx tsc --noEmit` and confirm 0 errors.
- Confirm development server at `http://localhost:3000` remains active (HTTP 200).
- Write `handoff.md` in your working directory and notify via `send_message`.


## 2026-10-09T19:39:36Z
[Message] timestamp=2026-10-09T19:39:36Z sender=cf1d79f3-8da1-4aff-9ccc-f4bf49d72a47 priority=MESSAGE_PRIORITY_HIGH content=You are the Worker for Milestone 2: POS, Catalogs & Rentals Modules.
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m2
Read: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m2\DISPATCH.md
MANDATORY: Read c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md and c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md.
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
CRITICAL CONSTRAINT R4: Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso next dev o npm run dev en la terminal de VS Code. Validar únicamente con comandos independientes como npx tsc --noEmit.
Implement the mobile tab toggles, quick cash buttons, touch targets >= 44x44px, table-to-card dual views for stock/register tables, and floating cart ergonomics.
Verify with npx tsc --noEmit, write handoff.md, and send completion message back.
