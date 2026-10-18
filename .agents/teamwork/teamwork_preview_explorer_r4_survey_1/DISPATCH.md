# Dispatch — Explorer Survey 1: Global Viewport, Layout, Navigation & Base Styles

You are an Explorer subagent for the Project Survey Phase.
Your Working Directory: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_1`

## MANDATORY INPUTS
- Read verbatim: `c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md` (specifically `## Follow-up — 2026-10-09T18:17:28Z`)
- Read: `c:\Users\Lenovo\Desktop\floreria\.agents\AGENTS.md`
- Skills: `c:\Users\Lenovo\Desktop\floreria\.agents\skills\design-system\SKILL.md`, `c:\Users\Lenovo\Desktop\floreria\.agents\skills\ui-designer\SKILL.md`, `c:\Users\Lenovo\Desktop\floreria\.agents\skills\nextjs-architecture\SKILL.md`

## CRITICAL CONSTRAINTS
- R4: PRESERVACIÓN DEL SERVIDOR DE DESARROLLO ACTIVO. Queda terminantemente PROHIBIDO detener, reiniciar, matar o alterar el proceso `next dev` o `npm run dev`. Solo usar comandos de sólo lectura o independientes como `npx tsc --noEmit`.
- READ-ONLY: As an explorer, DO NOT modify source files. Explore, analyze, and write your report to `report.md` and `handoff.md` in your working directory.

## EXPLORATION SCOPE & ASSIGNMENT
Investigate:
1. Root Layout & Viewport Configuration:
   - Check `app/layout.tsx` (or wherever root viewport/metadata is defined). Does it export `viewport: Viewport` with `width: 'device-width'`, `initialScale: 1`, `interactiveWidget: 'resizes-content'`?
   - Check if viewport is in `metadata` or in dedicated `generateViewport` / `export const viewport: Viewport`.
2. Global CSS & Tailwind Configuration:
   - Check `app/globals.css`, `tailwind.config.ts` (or `tailwind.config.js`).
   - Check font sizes for inputs, textareas, selects. Are there global or utility rules ensuring `font-size >= 16px` on mobile (<768px) to prevent iOS Safari / Android auto-zoom?
   - Check dynamic viewport height units (`dvh`, `svh`, `min-h-[100dvh]`).
   - Check safe area utility classes or definitions (`safe-area-inset-bottom`, `env(safe-area-inset-bottom)`).
3. Shell, Navigation & Common Layouts:
   - Check `components/layout/` or equivalent: `MobileBottomNav`, `Sidebar`, `Header`, `Navbar`.
   - Check touch target sizes: Are interactive buttons, tabs, triggers >= 44x44px?
   - Check `safe-area-inset-bottom` handling in `MobileBottomNav` and floating bars to ensure they do not obstruct bottom content or action buttons.
   - Check drawers and modals (e.g. notifications drawer, omnichannel drawer, dialogs): Do they handle mobile full-screen or sheet behavior with `dvh` and safe-area insets?
4. Document specific files, line numbers, current deficiencies, and exact recommendations for fixes.

Deliver `report.md` and `handoff.md` in your working directory, then notify via `send_message`.


## 2026-10-09T18:23:27Z
Received dispatch message:
You are Layout Viewport Explorer.
Your working directory is: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_1
Read your instructions in: c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\teamwork_preview_explorer_r4_survey_1\DISPATCH.md
MANDATORY: Read c:\Users\Lenovo\Desktop\floreria\.agents\teamwork\ORIGINAL_REQUEST.md and c:\Users\Lenovo\Desktop\floreria\.agents\AGENTS.md.
CRITICAL: R4 Preservar el servidor de desarrollo activo. Queda terminantemente PROHIBIDO matar, reiniciar o detener next dev / npm run dev.
Investigate root layout, viewport config (interactiveWidget: 'resizes-content'), globals.css, tailwind config, MobileBottomNav, safe-area-inset-bottom, dvh/svh units, and >=16px input font size on mobile.
Write your findings to report.md and handoff.md in your working directory, and send a completion message back.
