# Project: Florería Farfalina & Alquiler Carissma — Responsive Mobile & Tablet First

## Architecture
- **Root Layout & Global Shell (`app/layout.tsx`, `app/globals.css`, `components/layout/`)**:
  - Next.js 14 App Router `viewport` export with `interactiveWidget: 'resizes-content'`, `width: 'device-width'`, `initialScale: 1`.
  - Global CSS `@layer base` mobile rules enforcing `font-size: 16px !important` on `< 768px` for `input`, `select`, `textarea` to prevent iOS Safari & Android auto-zoom.
  - Safe-area utilities (`env(safe-area-inset-bottom)`) integrated into `MobileBottomNav`, chat composer, modals, and drawers.
  - Dynamic viewport units (`100dvh`, `svh`) on root body, dialogs, drawers, and omnichannel chat streams.
  - Floating toast positioning elevated above mobile bottom navigation.
- **POS & Catalogs (`components/floreria/pos/`, `components/carissma/`, `components/floreria/`)**:
  - Florería POS & Carissma POS with mobile tab toggles (`[Catálogo (N)] | [Ticket (N) - Bs Total]`) on `< 1024px`.
  - Quick-cash denomination buttons (`Bs 10`, `20`, `50`, `100`, `200`, `Exacto`).
  - Touch targets expanded to `>= 44x44px` across quantity counters, trash triggers, and filters.
  - Stock table dual rendering: table on tablet/desktop, stacked touch cards on `< 768px`.
  - Carissma catalog floating cart repositioned to prevent overflow-x and mobile nav obstruction.
- **Logistics, Kanban & CRM (`components/floreria/`, `components/carissma/orders/`, `components/*/crm-view.tsx`)**:
  - Florería Delivery Kanban: Mobile segmented control tabs (`[Pendiente (N)]`, `[En Preparación (M)]`, `[En Camino (K)]`) with `>= 44x44px` action buttons.
  - Carissma Rental Kanban: Mobile segmented control tabs across 6 lifecycle stages with touch-friendly stage progression.
  - Carissma Agenda table: Dual rendering (tabular on `>= 768px`, stacked cards on `< 768px`).
  - CRM Client Lists: Dual rendering (tabular on `>= 768px`, ergonomic touch cards on `< 768px`).
- **Omnichannel & Accounting / Cash Registers (`components/shared/omnichannel/`, `components/*/accounting-view.tsx`)**:
  - Unified Omnichannel Chat: Viewport fitting with `dvh`, keyboard resizing, safe-area inset on message composer, minimum 16px input font size.
  - Instagram Posts Panel: Mobile segmented selector between posts list and comment thread on `< 1024px`.
  - Chat Drawer (Orders & Rentals): Safe area padding and dynamic viewport sizing.
  - Accounting & Cash Registers: Dual rendering for Consolidated Orders, Expenses (Egresos), Cash Shifts (Arqueos), and Guarantees.
- **Strict Constraint R4**: Dev server `next dev` running in VS Code terminal preserved 100% active. All verification executed via independent `npx tsc --noEmit` and DOM inspection scripts.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Next.js Viewport Configuration | Export `viewport: Viewport` with `interactiveWidget: 'resizes-content'`, `width: 'device-width'`, `initialScale: 1` in `app/layout.tsx` | M1 | ORIGINAL_REQUEST §R2 |
| 2 | Mobile Input Font-Size Guard (>=16px) | Global `@layer base` CSS rule forcing `font-size: 16px !important` on `< 768px` for inputs/selects/textareas to stop iOS/Android auto-zoom | M1 | ORIGINAL_REQUEST §R2 |
| 3 | Safe-Area Inset Utilities & BottomNav | Implement `env(safe-area-inset-bottom)` and `>=44x44px` touch targets on `MobileBottomNav` | M1 | ORIGINAL_REQUEST §R3 |
| 4 | Toast Container Elevation | Offset `ToastContainer` on mobile to avoid colliding with `MobileBottomNav` | M1 | ORIGINAL_REQUEST §R3 |
| 5 | Workspace Root Dynamic Heights (`100dvh`) | Replace static `min-h-screen` with `min-h-[100dvh]` and safe-bottom padding in workspace shell | M1 | ORIGINAL_REQUEST §R2 |
| 6 | POS Mobile Cart & Ticket Toggle | Mobile tab toggle (`[Catálogo (N)] \| [Ticket (N) - Bs Total]`) on `< 1024px` for Florería POS & Carissma POS | M2 | ORIGINAL_REQUEST §R1 |
| 7 | POS Quick-Cash Denomination Buttons | Quick cash buttons (`Bs 10`, `20`, `50`, `100`, `200`, `Exacto`) in Florería and Carissma POS tickets | M2 | ORIGINAL_REQUEST §R1 |
| 8 | POS & Catalog Touch Targets (>=44x44px) | Enforce `>= 44x44px` hit areas on quantity `+`/`-`, trash, size pills, and action buttons | M2 | ORIGINAL_REQUEST §R3 |
| 9 | Insumos Vivos Stock Dual-View | Dual rendering (table on desktop/tablet, stacked cards on `< 768px`) for `pos-stock-table.tsx` | M2 | ORIGINAL_REQUEST §R1 |
| 10 | Carissma Catalog Floating Cart Ergonomics | Reposition floating cart in `catalog-view.tsx` to prevent `overflow-x` and `MobileBottomNav` collision | M2 | ORIGINAL_REQUEST §R3 |
| 11 | Florería Delivery Kanban Mobile Tabs | Mobile segmented control selector for 3-state delivery kanban and `>=44x44px` action buttons | M3 | ORIGINAL_REQUEST §R1, R3 |
| 12 | Carissma Rental Kanban Mobile Tabs | Mobile segmented control selector for 6-stage lifecycle kanban and touch-friendly advance buttons | M3 | ORIGINAL_REQUEST §R1, R3 |
| 13 | Carissma Rental Agenda Table Dual-View | Dual rendering (table on desktop/tablet, stacked cards on `< 768px`) for `orders-agenda-table.tsx` | M3 | ORIGINAL_REQUEST §R1 |
| 14 | CRM Client Lists Dual-View | Dual rendering (table on desktop/tablet, touch cards on `< 768px`) for Florería & Carissma CRM views | M3 | ORIGINAL_REQUEST §R1 |
| 15 | Omnichannel Chat Keyboard & Dynamic Heights | Responsive chat container using `dvh`, keyboard resizing without message obscuration, safe-area composer | M4 | ORIGINAL_REQUEST §R2, R3 |
| 16 | Instagram Posts Panel Mobile Selector | Mobile segmented toggle between posts list and comment thread on `< 1024px` | M4 | ORIGINAL_REQUEST §R1 |
| 17 | Accounting Tables Dual-View (Florería) | Dual rendering (table on desktop/tablet, stacked cards on `< 768px`) for Orders, Expenses & Shifts | M4 | ORIGINAL_REQUEST §R1 |
| 18 | Accounting Tables Dual-View (Carissma) | Dual rendering (table on desktop/tablet, stacked cards on `< 768px`) for Guarantees table | M4 | ORIGINAL_REQUEST §R1 |
| 19 | Archived Shifts Dual-View (POS Shift Drawer) | Dual rendering (table on desktop/tablet, stacked cards on `< 768px`) in `pos-shift-drawer.tsx` | M4 | ORIGINAL_REQUEST §R1 |
| 20 | E2E Automated Verification Suite & Forensics | Automated TypeScript type-checking, CSS inspection, mobile layout tests, and Forensic Integrity Audit | M_E2E | ORIGINAL_REQUEST §Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Viewport, Base Styles & Navigation Shell | `app/layout.tsx`, `app/globals.css`, `components/layout/mobile-bottom-nav.tsx`, `app/(workspace)/layout.tsx`, `components/ui/toast.tsx`, `components/shared/notification-center.tsx` | none | DONE |
| M2 | POS, Catalogs & Rentals Modules | `components/floreria/pos/pos-cart-panel.tsx`, `components/carissma/pos-view.tsx`, `components/floreria/pos/pos-stock-table.tsx`, `components/carissma/catalog-view.tsx`, `components/floreria/new-arrangement-modal.tsx`, `components/carissma/orders/orders-new-booking-modal.tsx`, `components/carissma/orders/orders-inspection-modal.tsx` | M1 | DONE |
| M3 | Logistics Kanban, CRM & Agenda | `components/floreria/orders-view.tsx`, `components/carissma/orders/orders-kanban-board.tsx`, `components/carissma/orders/orders-agenda-table.tsx`, `components/floreria/crm-view.tsx`, `components/carissma/crm-view.tsx`, `components/floreria/edit-order-modal.tsx` | M1 | IN_PROGRESS |
| M4 | Omnichannel Chat, Posts & Accounting Tables | `components/shared/omnichannel/unified-omnichannel-view.tsx`, `components/shared/omnichannel/instagram-posts-panel.tsx`, `components/floreria/chat-order-drawer.tsx`, `components/carissma/chat-rental-drawer.tsx`, `components/floreria/accounting-view.tsx`, `components/carissma/accounting-view.tsx`, `components/floreria/pos/pos-shift-drawer.tsx` | M1 | PLANNED |
| M_E2E | E2E Verification & Forensic Integrity Gate | Opaque-box automated validation of R1-R4, TypeScript compilation, mobile viewport assertions, and Forensic Audit | M1, M2, M3, M4 | PLANNED |

## Code Layout
- `app/layout.tsx`: Root HTML shell, `Viewport` configuration, dynamic height units
- `app/globals.css`: Base mobile CSS rules, safe area insets, 16px form font size guard
- `components/layout/mobile-bottom-nav.tsx`: Fixed bottom mobile navigation with safe-area padding and 48px touch targets
- `app/(workspace)/layout.tsx`: Main workspace shell with responsive bottom padding
- `components/ui/toast.tsx`: Toast notifications container with mobile offset
- `components/floreria/pos/`: Florería POS cart panel, stock table, and shift drawer
- `components/carissma/pos-view.tsx` & `catalog-view.tsx`: Carissma POS and dress catalog
- `components/floreria/orders-view.tsx`: Florería logistics kanban and delivery management
- `components/carissma/orders/`: Carissma rental kanban and return agenda
- `components/*/crm-view.tsx`: Customer CRM views
- `components/shared/omnichannel/`: Unified chat view and Instagram posts panel
- `components/*/accounting-view.tsx`: Financial accounting and cash registers

## Interface Contracts
### Viewport & Mobile Typography Contract
- `export const viewport: Viewport = { width: 'device-width', initialScale: 1, interactiveWidget: 'resizes-content' }`
- On screens `< 768px`, all `input, select, textarea` MUST compute to `font-size: 16px` (or `1rem`) to prevent iOS Safari / Chrome auto-zoom.

### Safe Area & Tap Ergonomics Contract
- Floating bottom bars and `MobileBottomNav` MUST include `env(safe-area-inset-bottom)`.
- All clickable buttons and triggers MUST have a minimum bounding box of `44px x 44px`.

### Table to Card Dual-View Contract
- Dense tables MUST render:
  - `<div className="hidden md:block">...table...</div>` for tablet/desktop
  - `<div className="block md:hidden space-y-3">...cards...</div>` for smartphone screens (`< 768px`)
- Card view must preserve all underlying data, statuses, badges, and action triggers without modifying backend contracts.
