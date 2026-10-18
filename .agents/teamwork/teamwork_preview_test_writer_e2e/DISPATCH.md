# Dispatch — E2E Test Writer: Comprehensive 4-Tier Test Suite & Test Runner

You are the E2E Test Writer for the Project.
Your Working Directory: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_test_writer_e2e`

## MANDATORY INPUTS
- Read verbatim: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## Follow-up — 2026-10-09T18:17:28Z`)
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md`
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\AGENTS.md`
- Read Survey Reports: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_1\report.md`, `survey_2\report.md`, `survey_3\report.md`
- Skills: `c:\Users\Lenovo\Desktop\floreria\.agents\skills\qa-tester\SKILL.md`, `c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md`

## CRITICAL CONSTRAINT R4: PRESERVACIÓN DEL SERVIDOR DE DESARROLLO ACTIVO
Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso `next dev` o `npm run dev` corriendo en la terminal de VS Code del cliente. Toda validación de compilación debe ejecutarse mediante comandos independientes como `npx tsc --noEmit` o scripts en subprocesos aislados.

## FILE BOUNDARIES
You own test infrastructure files only:
- Create `TEST_INFRA.md` at `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\TEST_INFRA.md`
- Create automated test runner script in `scripts/verify-responsive-e2e.mjs` (or `.ts`) that independently runs and verifies all 4 Tiers without interrupting `next dev`.
- Publish `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\TEST_READY.md` upon completion.
- DO NOT modify application source code in `/app`, `/components`, `/lib`, `/store`.

## TEST SUITE SPECIFICATION (4-TIER REQUIREMENT-DRIVEN)
1. **Tier 1 — Feature Coverage**:
   - Verify `export const viewport: Viewport` exists and includes `width: 'device-width'`, `initialScale: 1`, `interactiveWidget: 'resizes-content'`.
   - Verify CSS rules in `app/globals.css` enforcing `font-size: 16px !important` on mobile (`< 768px`) for `input, select, textarea`.
   - Verify safe area insets (`env(safe-area-inset-bottom)`) in `MobileBottomNav`, `app/(workspace)/layout.tsx`, and `ToastContainer`.
   - Verify touch target dimensions `>= 44px` on interactive elements.
   - Verify dual rendering (`hidden md:block` / `block md:hidden`) across all 9 identified dense tables (Stock, Agenda, Orders, Shifts, CRM, Guarantees).
2. **Tier 2 — Boundary & Corner Cases**:
   - Test minimum smartphone viewport (360px), mid mobile (390px/430px), tablet portrait (768px), and tablet landscape (1024px).
   - Test empty cart vs full cart floating bar coordinates.
   - Test extreme text length in customer/product cards without horizontal overflow (`overflow-x`).
3. **Tier 3 — Cross-Feature Combinations**:
   - Virtual keyboard interaction: verify `interactiveWidget: 'resizes-content'` prevents input occlusion.
   - MobileBottomNav coexistence with Toast notifications and floating cart bars.
   - Kanban column switching via mobile tabs vs desktop multi-column view.
4. **Tier 4 — Real-World Application Scenarios**:
   - Complete POS sale workflow on mobile without scrolling past full catalog to find checkout.
   - Delivery Kanban status transition on mobile using touch controls.
   - Omnichannel message sending on mobile with safe area margins.

## OUTPUTS & HANDOFF
1. `TEST_INFRA.md`
2. Automated test runner in `scripts/verify-responsive-e2e.mjs` that can be run with `node scripts/verify-responsive-e2e.mjs` and returns exit code 0 when all tests pass.
3. Run `npx tsc --noEmit` to ensure TypeScript compliance.
4. `TEST_READY.md` summarizing coverage and how to run the test suite.
5. `handoff.md` in your working directory and notify via `send_message`.


## 2026-10-09T18:52:00Z
You are the E2E Test Writer.
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_test_writer_e2e
Read your instructions in: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_test_writer_e2e\DISPATCH.md
MANDATORY: Read c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md and c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md.
CRITICAL CONSTRAINT R4: Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso next dev o npm run dev en la terminal de VS Code.
Write TEST_INFRA.md, implement the automated test runner in scripts/verify-responsive-e2e.mjs covering all 4 tiers, generate TEST_READY.md, verify with npx tsc --noEmit, write handoff.md, and send a completion message back.
