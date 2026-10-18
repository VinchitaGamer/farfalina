# Handoff Report — Layout Viewport Explorer (Survey 1)

**Agent**: Layout Viewport Explorer (`teamwork_preview_explorer_r4_survey_1`)  
**Timestamp**: 2026-10-09T18:46:00Z  
**Type**: Hard Handoff (Investigation Complete)  
**Parent Conversation ID**: `cf1d79f3-8da1-4aff-9ccc-f4bf49d72a47`

---

## 1. Observation

Direct observations from source inspection and execution:

1. **`app/layout.tsx` (Lines 4–21)**:
   - Contains only:
     ```typescript
     export const metadata: Metadata = {
       title: "Plataforma SaaS | Florería Farfalina & Alquiler Vestidos Carissma",
       description: "Sistema integral de gestión ERP, CRM, POS Omnicanal y Alquiler de Vestidos con Precios Dinámicos",
     };

     export default function RootLayout({ children }: { children: React.ReactNode }) {
       return (
         <html lang="es">
           <body className="min-h-screen bg-warm-50 text-warm-900 selection:bg-terracotta-100 selection:text-terracotta-700">
             {children}
           </body>
         </html>
       );
     }
     ```
   - Verbatim absence: There is NO `export const viewport: Viewport` exported in `app/layout.tsx`.
   - Verbatim absence: There is no `interactiveWidget: 'resizes-content'`, `width: 'device-width'`, or `initialScale: 1`.
   - Line 16: Body uses `min-h-screen` (`min-height: 100vh`) rather than dynamic viewport units (`100dvh`).

2. **`app/globals.css` (Lines 1–137)**:
   - Line 5–17:
     ```css
     @layer base {
       :root {
         --background: 40 30% 97%;
         --foreground: 20 15% 15%;
       }
       body { ... }
     }
     ```
   - Verbatim absence: No `@media (max-width: 767px)` rule setting minimum font-size for `input`, `select`, `textarea`.
   - Verbatim absence: No definitions of `--safe-bottom`, `--safe-top`, `.pb-safe`, `.pt-safe`, or `env(safe-area-inset-*)`.

3. **Ubiquitous Sub-16px Inputs across Modules**:
   - `components/floreria/pos-view.tsx` (Lines 274, 295, 298, 310, 314, 318, 320): Inputs have `className="... text-xs ..."`.
   - `components/shared/omnichannel/unified-omnichannel-view.tsx` (Line 1506): Main chat input has `className="... text-xs ..."`.
   - `components/floreria/chat-order-drawer.tsx` (Line 478): Input has `className="... text-[11px] ..."`.
   - `components/floreria/edit-order-modal.tsx` (Line 452): Dedication textarea has `className="... font-serif italic text-xs"`.
   - `components/floreria/pos/pos-shift-drawer.tsx` (Lines 238, 251): Inputs have `text-xs` and `text-sm`.

4. **`components/layout/mobile-bottom-nav.tsx` (Lines 26, 34, 56, 76, 98, 119)**:
   - Line 26: `<nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-warm-200 lg:hidden px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden">`
   - Verbatim absence: No `pb-[env(safe-area-inset-bottom)]` or `safe-area-inset-bottom`.
   - Navigation links have `py-1 px-2` with no explicit minimum tap area constraints (`min-h-[44px]` or `min-w-[44px]`).

5. **`components/ui/toast.tsx` (Line 15)**:
   - Line 15: `<div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">`
   - Positioned at `bottom-5 right-5`, which directly collides with `MobileBottomNav` on mobile screens.

6. **`app/(workspace)/layout.tsx` (Lines 23, 33)**:
   - Line 23: `<div className="min-h-screen flex flex-col bg-warm-50 text-warm-900 font-sans">`
   - Line 33: `<main className="flex-1 p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8 overflow-y-auto max-w-7xl w-full min-w-0">`
   - Bottom padding `pb-24` does not account for `env(safe-area-inset-bottom)`.

7. **Drawers and Modals**:
   - `components/shared/notification-center.tsx` (Line 99): Slide-over drawer has `h-full` without `pt-safe` or `pb-safe`. Close button (Line 134) is 32x32px (`p-1.5`, `h-5 w-5`), dismiss button (Line 276) is 22x22px (`p-1`, `h-3.5 w-3.5`).
   - `components/floreria/edit-order-modal.tsx` (Line 192): Uses `max-h-[92vh]`.
   - `components/floreria/chat-order-drawer.tsx` (Lines 292, 329): Uses `max-h-[92vh] sm:max-h-[88vh]`.

8. **Type Check Baseline Command**:
   - Tool call: `run_command` with CommandLine `npx tsc --noEmit`.
   - Result: Exited with code 0 (no errors).

---

## 2. Logic Chain

1. **Root Viewport Deficiency**:
   - Observation 1 shows `app/layout.tsx` lacks `export const viewport: Viewport` with `interactiveWidget: 'resizes-content'`.
   - In Next.js 14.2, viewport configuration is decoupled from `metadata`.
   - Without `interactiveWidget: 'resizes-content'`, mobile virtual keyboards in Safari and Chrome do not resize the layout viewport, resulting in obscured form fields and clipped floating bars.

2. **Mobile Form Zoom Vulnerability**:
   - Observation 3 shows inputs and textareas across all modules use `text-xs` (12px) and `text-sm` (14px).
   - iOS Safari triggers automatic viewport zoom whenever an input with font-size `< 16px` receives focus.
   - Observation 2 shows `app/globals.css` lacks any mobile font-size normalization.
   - Therefore, without a global CSS guard enforcing `font-size: 16px !important` for form elements on screens `< 768px`, users on iPhones will experience unavoidable auto-zoom and horizontal layout distortion.

3. **Safe-Area Inset Obscuration**:
   - Observations 2 and 4 show neither CSS safe-area variables nor `MobileBottomNav` include `env(safe-area-inset-bottom)`.
   - Modern mobile devices (iPhone X through 16, gesture-based Android) display an overlay home bar in the bottom 34px.
   - Therefore, `MobileBottomNav` icons and labels are rendered directly underneath the system home indicator, leading to accidental home swipes when tapping navigation buttons.
   - Similarly, Observation 5 shows `ToastContainer` at `bottom-5 right-5` directly collides with `MobileBottomNav` on mobile viewports.

4. **Dynamic Viewport Height (`dvh`) and Layout Truncation**:
   - Observations 1, 6, and 7 show body and modals use `min-h-screen` (`100vh`) and `max-h-[92vh]`.
   - `100vh` on mobile corresponds to the large viewport height (`100lvh`), which ignores browser URL and navigation bars.
   - Consequently, modal headers/footers and workspace bottoms are clipped when browser chrome is visible. Switching to `100dvh` and `90dvh` resolves this.

5. **Ergonomic Touch Targets**:
   - Observation 4 and 7 show buttons with `p-1` to `p-1.5` producing hit areas between 22px and 36px.
   - Ergonomic standards (WCAG 2.5.5, Apple HIG) require a minimum target size of 44x44px for reliable touch interaction.

---

## 3. Caveats

- **No source code was modified**: Per explorer rules and Read-Only constraints, no application files were changed.
- **Server process preservation**: Development server running `next dev` was not touched, stopped, or restarted.
- **Sub-module specific implementations**: Detailed card-transformation implementation for POS, Orders, CRM, and Accounting will be executed by implementation subagents; this survey provides the global architecture and foundations.

---

## 4. Conclusion

The application requires targeted architectural fixes in 4 key areas:
1. **`app/layout.tsx`**: Add `export const viewport: Viewport` with `width: 'device-width'`, `initialScale: 1`, `interactiveWidget: 'resizes-content'`, and update body class to `min-h-[100dvh]`.
2. **`app/globals.css`**: Add global `@layer base` rule setting `font-size: 16px !important` for text inputs/selects/textareas on `@media (max-width: 767px)` to eliminate iOS auto-zoom, and declare safe-area utilities (`.pb-safe`, `.pt-safe`, `--safe-bottom`).
3. **`components/layout/mobile-bottom-nav.tsx` & `app/(workspace)/layout.tsx`**: Apply `pb-[env(safe-area-inset-bottom)]` to the nav bar, enforce `min-h-[48px]` touch targets, and adjust workspace `<main>` padding to `pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8`.
4. **`components/ui/toast.tsx`**: Elevate toast notifications on mobile to `bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-5` to avoid colliding with `MobileBottomNav`.

---

## 5. Verification Method

To verify after implementation:
1. **Type Check**:
   ```powershell
   npx tsc --noEmit
   ```
   Must exit with code 0.
2. **Viewport Meta Inspection**:
   Inspect HTML rendered at `http://localhost:3000` (or `curl http://localhost:3000` / view page source) and verify `<meta name="viewport" content="width=device-width, initial-scale=1, interactive-widget=resizes-content">` is present in `<head>`.
3. **Computed Font-Size on Mobile**:
   In Chrome/Safari DevTools responsive mode (set width to 375px), inspect any `<input>` in POS or Omnichannel. Verify computed `font-size` is `16px`.
4. **Safe Area Clearance**:
   Verify `MobileBottomNav` has bottom padding matching `env(safe-area-inset-bottom)`.
