const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..');

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    process.exit(1);
  }
  console.log('PASS:', message);
}

console.log('--- Verifying Milestone 1 Implementation ---');

// 1. app/layout.tsx
const layoutContent = fs.readFileSync(path.join(rootDir, 'app/layout.tsx'), 'utf8');
assert(layoutContent.includes('export const viewport: Viewport = {'), 'app/layout.tsx exports viewport');
assert(layoutContent.includes('interactiveWidget: "resizes-content"'), 'app/layout.tsx includes resizes-content');
assert(layoutContent.includes('width: "device-width"'), 'app/layout.tsx includes width device-width');
assert(layoutContent.includes('initialScale: 1'), 'app/layout.tsx includes initialScale: 1');
assert(layoutContent.includes('min-h-[100dvh]'), 'app/layout.tsx uses min-h-[100dvh]');

// 2. app/globals.css
const cssContent = fs.readFileSync(path.join(rootDir, 'app/globals.css'), 'utf8');
assert(cssContent.includes('@media (max-width: 767px)'), 'app/globals.css includes mobile media query');
assert(cssContent.includes('font-size: 16px !important;'), 'app/globals.css enforces font-size: 16px !important');
assert(cssContent.includes('--safe-bottom: env(safe-area-inset-bottom, 0px)'), 'app/globals.css defines --safe-bottom');
assert(cssContent.includes('--safe-top: env(safe-area-inset-top, 0px)'), 'app/globals.css defines --safe-top');
assert(cssContent.includes('.pb-safe'), 'app/globals.css defines .pb-safe');
assert(cssContent.includes('.pt-safe'), 'app/globals.css defines .pt-safe');

// 3. components/layout/mobile-bottom-nav.tsx
const navContent = fs.readFileSync(path.join(rootDir, 'components/layout/mobile-bottom-nav.tsx'), 'utf8');
assert(navContent.includes('pb-[env(safe-area-inset-bottom)]'), 'MobileBottomNav includes safe-area inset bottom padding');
assert(navContent.includes('min-h-[48px] min-w-[48px]'), 'MobileBottomNav includes 48x48px min touch targets');
assert(navContent.includes('active:scale-95 touch-manipulation'), 'MobileBottomNav includes active touch feedback');

// 4. app/(workspace)/layout.tsx
const wsLayoutContent = fs.readFileSync(path.join(rootDir, 'app/(workspace)/layout.tsx'), 'utf8');
assert(wsLayoutContent.includes('min-h-[100dvh]'), 'WorkspaceLayout uses min-h-[100dvh]');
assert(wsLayoutContent.includes('pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-8'), 'WorkspaceLayout uses dynamic safe-area bottom padding');

// 5. components/ui/toast.tsx
const toastContent = fs.readFileSync(path.join(rootDir, 'components/ui/toast.tsx'), 'utf8');
assert(toastContent.includes('bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-5 right-3 sm:right-5'), 'ToastContainer elevated above mobile bottom nav');
assert(toastContent.includes('min-h-[44px] min-w-[44px]'), 'Toast close button meets 44x44px touch target');

// 6. components/shared/notification-center.tsx
const notifContent = fs.readFileSync(path.join(rootDir, 'components/shared/notification-center.tsx'), 'utf8');
assert(notifContent.includes('h-[100dvh]'), 'NotificationCenter uses h-[100dvh]');
assert(notifContent.includes('pb-safe'), 'NotificationCenter uses pb-safe');
assert(notifContent.includes('min-h-[44px] min-w-[44px]'), 'NotificationCenter uses >=44x44px buttons');

console.log('All Milestone 1 structural assertions PASSED successfully!');
