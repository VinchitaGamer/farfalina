# Dispatch — Worker Milestone 1: Viewport, Base Styles & Navigation Shell

You are the Worker for Milestone 1: Viewport, Base Styles & Navigation Shell.
Your Working Directory: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m1`

## MANDATORY INPUTS
- Read verbatim: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## Follow-up — 2026-10-09T18:17:28Z`)
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md`
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\AGENTS.md`
- Read Survey 1 Report & Handoff: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_1\report.md` and `handoff.md`
- Skills: `c:\Users\Lenovo\Desktop\floreria\.agents\skills\design-system\SKILL.md`, `c:\Users\Lenovo\Desktop\floreria\.agents\skills\clean-code\SKILL.md`

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## CRITICAL CONSTRAINT R4: PRESERVACIÓN DEL SERVIDOR DE DESARROLLO ACTIVO
Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso `next dev` o `npm run dev` corriendo en la terminal de VS Code del cliente. Toda validación de compilación debe ejecutarse mediante comandos independientes como `npx tsc --noEmit`.

## EXCLUSIVE FILE OWNERSHIP
You own and may edit ONLY the following files for Milestone 1:
- `app/layout.tsx`
- `app/globals.css`
- `components/layout/mobile-bottom-nav.tsx`
- `app/(workspace)/layout.tsx`
- `components/ui/toast.tsx`
- `components/shared/notification-center.tsx`

Do NOT touch any other files in this milestone.

## OBJECTIVES & DETAILED TASKS
1. `app/layout.tsx`:
   - Import `Viewport` from `'next'`.
   - Export `viewport: Viewport` with:
     ```typescript
     export const viewport: Viewport = {
       width: "device-width",
       initialScale: 1,
       interactiveWidget: "resizes-content",
     };
     ```
   - Change body class from `min-h-screen` to `min-h-[100dvh]`.
2. `app/globals.css`:
   - Under `@layer base`, add mobile form font-size normalization to eliminate iOS Safari / Android auto-zoom:
     ```css
     @media (max-width: 767px) {
       input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
       select,
       textarea {
         font-size: 16px !important;
       }
     }
     ```
   - Define safe area custom properties and utilities:
     ```css
     :root {
       --safe-bottom: env(safe-area-inset-bottom, 0px);
       --safe-top: env(safe-area-inset-top, 0px);
     }
     .pb-safe {
       padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));
     }
     .pt-safe {
       padding-top: max(0.5rem, env(safe-area-inset-top, 0px));
     }
     ```
3. `components/layout/mobile-bottom-nav.tsx`:
   - Add `pb-[env(safe-area-inset-bottom)]` to the fixed bottom container to keep navigation items above the device home indicator.
   - Enforce minimum touch target heights: nav links should have `min-h-[48px] min-w-[48px]` and active touch-friendly feedback.
4. `app/(workspace)/layout.tsx`:
   - Update `<main>` padding-bottom to account for both `MobileBottomNav` and safe-area: `pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8`.
5. `components/ui/toast.tsx`:
   - Offset the floating toast notifications container on mobile to prevent overlapping `MobileBottomNav`:
     `bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-5 right-3 sm:right-5`.
6. `components/shared/notification-center.tsx`:
   - Ensure the notification center drawer uses `h-[100dvh]` and safe-area padding (`pb-safe`), with close / dismiss action buttons having `>= 44x44px` touch target areas (or `p-2.5` wrapper).

## VERIFICATION
- Run `npx tsc --noEmit` and confirm 0 errors.
- Verify that `next dev` server was not disturbed.
- Write your changes summary, build outputs, and verification details in `handoff.md` in your working directory.
- Send a completion message via `send_message`.


## 2026-10-09T18:52:00Z
[Message] sender=cf1d79f3-8da1-4aff-9ccc-f4bf49d72a47 priority=MESSAGE_PRIORITY_HIGH
You are the Worker for Milestone 1: Viewport, Base Styles & Navigation Shell.
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m1
Read your instructions in: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_worker_m1\DISPATCH.md
MANDATORY: Read c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md and c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\PROJECT.md.
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
CRITICAL CONSTRAINT R4: Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso next dev o npm run dev en la terminal de VS Code. Validar únicamente con comandos independientes como npx tsc --noEmit.
Implement the viewport export in app/layout.tsx, global mobile font-size >=16px in app/globals.css, safe-area-inset-bottom in MobileBottomNav and app/(workspace)/layout.tsx, and offset ToastContainer.
Verify with npx tsc --noEmit, write handoff.md, and send a completion message back.
