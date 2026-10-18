# Report — Survey 1: Global Viewport, Layout, Navigation & Base Styles

**Agent**: Layout Viewport Explorer (`teamwork_preview_explorer_r4_survey_1`)  
**Timestamp**: 2026-10-09T18:45:00Z  
**Project**: SaaS Florería Farfalina & Alquiler de Vestidos Carissma  
**Working Directory**: `c:\Users\Lenovo\Desktop\floreria`

---

## 1. Executive Summary

This investigation analyzed the application shell, viewport configurations, responsive stylesheets, touch targets, and layout containers across the SaaS platform to prepare for the mobile/tablet responsive adaptation (Requirements R1, R2, R3, R4 of `ORIGINAL_REQUEST.md`).

A total of 8 structural deficiencies were identified that directly impact mobile and tablet user experience:
1. **Missing dedicated Next.js 14+ `viewport` export**: `app/layout.tsx` lacks `export const viewport: Viewport` with `interactiveWidget: 'resizes-content'`, `width: 'device-width'`, and `initialScale: 1`. This leads to virtual keyboard screen clipping and broken layouts on iOS Safari and Android Chrome.
2. **Missing global form control minimum font size (`>= 16px`) on mobile**: Native `<input>`, `<select>`, and `<textarea>` elements across all modules use `text-xs` (12px) and `text-sm` (14px). Without a global CSS guard on `< 768px`, iOS Safari forcefully activates native viewport auto-zoom upon focusing any input field, distorting the viewport and causing horizontal scroll bugs.
3. **Absence of Safe-Area Inset Handling**: Neither `app/globals.css` nor `tailwind.config.ts` configure CSS variables or utilities for `env(safe-area-inset-*)`. As a result, `MobileBottomNav`, `TopHeader`, modal footers, and slide-over drawers clash directly with device notches and home indicator bars.
4. **Toast Notification Placement Collision**: `ToastContainer` is pinned to `fixed bottom-5 right-5`, causing toast notifications to render directly underneath or colliding with the mobile bottom navigation bar (`MobileBottomNav` at `bottom-0`).
5. **Static Viewport Heights (`100vh` vs `100dvh`)**: Root body and layouts use `min-h-screen` (`100vh`) and modals use `max-h-[92vh]`/`max-h-[88vh]`. On mobile browsers with dynamic address and tool bars, `100vh` exceeds the actual visible viewport, cutting off modal action buttons and footer bars.
6. **Sub-44px Touch Targets**: Several critical interactive buttons (sidebar close button `p-1.5` with 16px icon, top header hamburger and bell buttons `36x36px`, notification dismiss buttons `22x22px`, modal cancel/confirm buttons) fail the WCAG and Apple Human Interface Guidelines 44x44px minimum touch target requirement.
7. **Mobile Header Switcher Squeeze**: On narrow screens (360px-390px), `TopHeader` displays brand, system switch ("Florería Farfalina" + "Carissma"), and user controls on a single row, creating horizontal crampedness.
8. **Lack of Responsive Card Fallbacks for Dense Tables**: Views like `pos-stock-table.tsx`, `orders-agenda-table.tsx`, and `accounting-view.tsx` only provide horizontal scrolling (`overflow-x-auto`) for wide data tables rather than rendering ergonomic stacked cards on viewports `< 768px`.

Baseline type check was verified independently (`npx tsc --noEmit` exited with code 0). Development server integrity (R4) was strictly preserved.

---

## 2. Detailed Findings by Area

### 2.1. Root Layout & Viewport Configuration (`app/layout.tsx`)

#### Observation
- **File**: `app/layout.tsx` (Lines 1–22)
- Current code:
  ```typescript
  import "./globals.css";
  import type { Metadata } from "next";

  export const metadata: Metadata = {
    title: "Plataforma SaaS | Florería Farfalina & Alquiler Vestidos Carissma",
    description: "Sistema integral de gestión ERP, CRM, POS Omnicanal y Alquiler de Vestidos con Precios Dinámicos",
  };

  export default function RootLayout({ children }: { children: React.ReactNode; }) {
    return (
      <html lang="es">
        <body className="min-h-screen bg-warm-50 text-warm-900 selection:bg-terracotta-100 selection:text-terracotta-700">
          {children}
        </body>
      </html>
    );
  }
  ```

#### Analysis
- In Next.js 14+ (this repository uses `next@14.2.15`), viewport parameters (`width`, `initialScale`, `interactiveWidget`, `themeColor`, `maximumScale`) must be exported separately via `export const viewport: Viewport = { ... }`.
- `interactiveWidget: 'resizes-content'` is completely absent. Without this meta directive (`viewport-fit=cover, interactive-widget=resizes-content`), virtual keyboard opening on modern mobile browsers compresses or overlays fixed overlays unpredictably.
- `min-h-screen` on `<body>` is mapped to `min-height: 100vh`, which is known to cause jumping when mobile address bars hide/show. It should use `min-h-[100dvh]` or `min-h-dvh`.

#### Proposed Fix
```typescript
import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Plataforma SaaS | Florería Farfalina & Alquiler Vestidos Carissma",
  description: "Sistema integral de gestión ERP, CRM, POS Omnicanal y Alquiler de Vestidos con Precios Dinámicos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  interactiveWidget: "resizes-content",
  themeColor: "#FAF7F2",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-[100dvh] bg-warm-50 text-warm-900 selection:bg-terracotta-100 selection:text-terracotta-700 antialiased">
        {children}
      </body>
    </html>
  );
}
```

---

### 2.2. Global CSS & Tailwind Configuration

#### Observation
- **File**: `app/globals.css` (Lines 1–137)
  - No mobile input font-size normalization exists.
  - No safe-area variables or utility classes exist.
- **File**: `tailwind.config.ts` (Lines 1–74)
  - Colors and font families are defined, but no spacing or safe-area utilities are configured.
  - Tailwind version is `3.4.14` (supports native `h-dvh`, `min-h-dvh`, `max-h-dvh`).

#### Analysis
- **Mobile Auto-Zoom Vulnerability**: Across hundreds of instances (in POS, CRM, Omnichannel, Orders, Modals), inputs, selects, and textareas use Tailwind classes `text-xs` (12px) or `text-sm` (14px). When iOS Safari focuses any input with font-size `< 16px`, it forcibly zooms in on the input. This ruins the responsive experience, causes horizontal scroll bleed, and requires the user to pinch-to-zoom out manually.
- Adding a single `@layer base` rule in `globals.css` solves this globally without risking regressions across dozens of individual component files:
  ```css
  @layer base {
    @media (max-width: 767px) {
      input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
      select,
      textarea {
        font-size: 16px !important;
      }
    }
  }
  ```
- **Safe Area Inset Support**: Devices like iPhone 10–16 and Android with gesture navigation require `env(safe-area-inset-*)`. Defining standard utilities in `globals.css` allows components to safely dock to screen edges:
  ```css
  :root {
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-left: env(safe-area-inset-left, 0px);
    --safe-right: env(safe-area-inset-right, 0px);
  }

  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .pt-safe {
    padding-top: env(safe-area-inset-top, 0px);
  }
  .safe-h-bottom {
    height: env(safe-area-inset-bottom, 0px);
  }
  ```

---

### 2.3. Workspace Shell & Mobile Navigation

#### Observation
- **File**: `app/(workspace)/layout.tsx` (Lines 23, 33, 39, 48)
  - Line 23: `<div className="min-h-screen flex flex-col bg-warm-50 text-warm-900 font-sans">`
  - Line 33: `<main className="flex-1 p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8 overflow-y-auto max-w-7xl w-full min-w-0">`
  - Line 39: `<MobileBottomNav />`
- **File**: `components/layout/mobile-bottom-nav.tsx` (Line 26)
  - Line 26: `<nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-warm-200 lg:hidden px-2 py-1.5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] print:hidden">`
  - Button targets: `className="flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all"`
- **File**: `components/ui/toast.tsx` (Line 15)
  - Line 15: `<div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">`

#### Analysis
1. `MobileBottomNav` has no `pb-safe` or `pb-[env(safe-area-inset-bottom)]`. On bezel-less phones, the iOS home indicator bar renders directly over the navigation labels ("Catálogo", "POS", "Chats", "Pedidos", "Más").
2. The padding in `main` (`pb-24`) accounts for standard 6rem height, but should be combined with safe-area: `pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8` to ensure page content or floating actions are never obscured when the nav height expands with safe-area insets.
3. In `MobileBottomNav`, each item should have an explicit `min-h-[48px] min-w-[48px]` touch target box to comply with ergonomic standards.
4. `ToastContainer` sits at `bottom-5 right-5`. When `MobileBottomNav` is visible (mobile screens `< 1024px`), toasts appear directly underneath or overlap the nav, blocking interaction. Toasts must be elevated to `bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-5`.

---

### 2.4. Top Header & Sidebar Drawer

#### Observation
- **File**: `components/layout/top-header.tsx`
  - Line 20: `<header className="sticky top-0 z-40 w-full border-b border-warm-200 bg-white/95 backdrop-blur-md px-3 sm:px-6 lg:px-8 py-2.5 transition-colors duration-200 print:hidden">`
  - Line 26: Hamburger toggle has `p-2` with `h-5 w-5` (36x36px target).
  - Line 89: Bell notification button has `p-2` with `h-5 w-5` (36x36px target).
  - Line 46: System switcher buttons ("Florería Farfalina" / "Carissma") use full labels that cause horizontal crowding on 360px viewports.
- **File**: `components/layout/sidebar.tsx`
  - Line 211: Desktop aside uses `min-h-[calc(100vh-61px)]` instead of `min-h-[calc(100dvh-61px)]`.
  - Line 226: Drawer container `<div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl p-4 overflow-y-auto z-10 flex flex-col justify-between...">` lacks `pt-safe` and `pb-safe`.
  - Line 74: Close button `<button onClick={() => setMobileMenuOpen(false)} className="p-1.5 text-warm-500 hover:text-warm-900 rounded-lg lg:hidden">` is only 28x28px.

#### Analysis
- Header and sidebar drawers must respect safe-area insets (`pt-safe`, `pb-safe`) so that status bars, notches, and home indicators do not collide with navigation buttons.
- Touch targets for hamburger menu, drawer close button, notification bell, and modal cancel/confirm buttons should have `min-h-[44px] min-w-[44px]` touch targets.

---

### 2.5. Drawers, Modals & Floating Overlays

#### Observation
- **File**: `components/shared/notification-center.tsx`
  - Line 99: `w-full max-w-md bg-white h-full`. Lacks safe area padding at top and bottom.
  - Line 134: Close button is `p-1.5` with `h-5 w-5` (32x32px).
  - Line 276: Notification dismiss button is `p-1` with `h-3.5 w-3.5` (22x22px).
- **File**: `components/ui/confirm-dialog.tsx`
  - Line 63: Modal dialog overlay uses `fixed inset-0 z-[100] p-4`.
  - Line 87-106: Action buttons are small inline buttons (`px-4 py-2 text-sm` and `px-5 py-2 text-sm`).
- **File**: `components/floreria/edit-order-modal.tsx`
  - Line 192: `max-h-[92vh]`. When virtual keyboard opens, `92vh` overflows the viewport and pushes "Guardar Cambios" off-screen.
- **File**: `components/floreria/chat-order-drawer.tsx`
  - Line 292: `max-h-[92vh] sm:max-h-[88vh]`.
  - Line 478: Search input uses `text-[11px]` (causes iOS zoom).
- **File**: `components/carissma/chat-rental-drawer.tsx`
  - Line 191: `h-full`. Footer action buttons (line 403) have no `pb-safe`.

#### Analysis
- Replacing `vh` with `dvh` (e.g. `max-h-[90dvh]`) prevents modals from being clipped by mobile browser chrome.
- Drawer headers need `pt-safe` and drawer footers need `pb-safe`.
- Interactive buttons in modals and dialogs should stack vertically on mobile (`flex-col-reverse sm:flex-row`) with `min-h-[44px]` touch targets for optimal thumb ergonomics.

---

### 2.6. Dense Tables vs Mobile Cards (R1 Audit)

#### Observation
The following modules currently render wide data tables with only horizontal scroll wrappers (`<div className="overflow-x-auto">`):
1. **`components/floreria/pos/pos-stock-table.tsx`** (Line 124): 9 columns (`Código`, `Insumo`, `Categoría`, `Disponible`, `Costo Unit.`, `Fecha Ingreso`, `Vida Útil`, `Estado`, `Acciones`).
2. **`components/carissma/orders/orders-agenda-table.tsx`** (Line 57): 8 columns (`Contrato`, `Clienta`, `Prenda`, `Fechas Renta`, `Tarifa`, `Garantía`, `Estado`, `Acciones`).
3. **`components/floreria/accounting-view.tsx`** (Lines 309, 496, 712): Tables for expenses, shift summaries, and cash logs.
4. **`components/carissma/accounting-view.tsx`** (Lines 341, 398, 479): Rental income and expense tables.
5. **`components/carissma/pos-view.tsx`** (Lines 956, 1097): Dress catalog and rental tables.

#### Analysis
- On mobile smartphones (360px–430px), scrolling a 9-column table horizontally creates poor usability, accidental navigation triggers, and horizontal container stretching.
- To fulfill Requirement R1, these tables must render as:
  - **Mobile (< 768px)**: Stacked responsive cards (`hidden md:table` for the table, `md:hidden space-y-3` for cards) showing key identifiers, badges, and primary action buttons.
  - **Tablet & Desktop (>= 768px)**: Standard dense tabular view.

---

## 3. Prioritized Implementation Recommendations

| Priority | File / Area | Issue | Solution |
|---|---|---|---|
| **P0** | `app/layout.tsx` | Missing `viewport` export & `interactiveWidget: 'resizes-content'` | Export `viewport: Viewport` with `width: 'device-width'`, `initialScale: 1`, `interactiveWidget: 'resizes-content'`. Change body to `min-h-[100dvh]`. |
| **P0** | `app/globals.css` | `<input>`, `<select>`, `<textarea>` trigger auto-zoom on iOS Safari (< 16px font size) | Add `@layer base` media query rule setting `font-size: 16px !important` on `< 768px` for text inputs, selects, and textareas. |
| **P0** | `app/globals.css` & `tailwind.config.ts` | Missing safe-area inset variables and utility classes | Define `--safe-bottom`, `--safe-top`, `.pb-safe`, `.pt-safe`, and dynamic height classes. |
| **P0** | `components/layout/mobile-bottom-nav.tsx` | Nav bar overlaps iOS/Android home indicator bar | Add `pb-[env(safe-area-inset-bottom)]`, set minimum 48px touch targets for nav items. |
| **P1** | `app/(workspace)/layout.tsx` | Main padding does not account for safe area insets | Update main `pb` to `pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-8`. |
| **P1** | `components/ui/toast.tsx` | Toasts collide with mobile bottom nav | Set bottom offset to `bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-5`. |
| **P1** | `components/layout/sidebar.tsx` & `TopHeader` | Status bar and notch collisions; small touch targets (<44px) | Add `pt-safe` to header and drawer; enlarge hamburger, bell, and close button touch targets to `>= 44x44px`. |
| **P2** | Modals & Drawers (`edit-order-modal`, `chat-order-drawer`, etc.) | Hardcoded `vh` heights (`max-h-[92vh]`) overflow mobile viewport | Switch to `max-h-[90dvh]` and add `pb-safe` to drawer footers. |
| **P2** | Tables in POS, Orders & Accounting | 8-9 column tables are unreadable on smartphones | Implement dual layout: stacked touch cards on `< 768px`, table on `>= 768px`. |
