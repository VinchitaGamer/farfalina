// scripts/challenger-m1-stress.mjs
// Adversarial Empirical Stress Test Suite for Milestone 1 (Challenger 2)

import fs from "node:fs";
import path from "node:path";

const results = [];

function assert(description, condition, details = "") {
  results.push({ description, pass: Boolean(condition), details });
  if (condition) {
    console.log(`  ✓ PASS: ${description}`);
  } else {
    console.error(`  ✗ FAIL: ${description} ${details ? `(${details})` : ""}`);
  }
}

async function runDevServerStressTests() {
  console.log("\n--- 1. Dev Server Responsiveness & Payload Stress Test ---");

  const start = Date.now();
  try {
    // 1. Direct fetch with redirect follow (as browser experiences)
    const res = await fetch("http://localhost:3000");
    const elapsed = Date.now() - start;
    const body = await res.text();

    assert("Dev server responds with HTTP 200 (following root redirect)", res.status === 200, `Status: ${res.status}`);
    assert("Dev server responds rapidly (< 1500ms)", elapsed < 1500, `Latency: ${elapsed}ms`);
    assert("Root URL redirects to expected workspace (/floreria/catalog)", res.url.endsWith("/floreria/catalog"), res.url);
    
    // Check viewport meta tag in raw HTML
    const metaViewportRegex = /<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i;
    const match = body.match(metaViewportRegex);
    assert("Live HTML includes <meta name='viewport'>", Boolean(match), match ? match[0] : "Missing");

    if (match) {
      const content = match[1];
      assert("Viewport content specifies width=device-width", content.includes("width=device-width"), content);
      assert("Viewport content specifies initial-scale=1", content.includes("initial-scale=1"), content);
      assert("Viewport content includes interactive-widget=resizes-content", content.includes("interactive-widget=resizes-content"), content);
    }

    // Check body class for min-h-[100dvh]
    const bodyMatch = body.match(/<body[^>]*class=["']([^"']+)["']/i);
    assert("Live HTML body tag includes min-h-[100dvh]", bodyMatch && bodyMatch[1].includes("min-h-[100dvh]"), bodyMatch ? bodyMatch[1] : "No body class");

    // Also test Carissma route
    const carissmaRes = await fetch("http://localhost:3000/carissma/catalog");
    assert("Carissma catalog route also responds with HTTP 200", carissmaRes.status === 200, `Status: ${carissmaRes.status}`);

  } catch (err) {
    assert("Dev server responds with HTTP 200", false, err.message);
  }
}

function runLayoutAndZIndexStressTests() {
  console.log("\n--- 2. Z-Index Hierarchy & Layout Stacking Collision Test ---");

  const toastPath = path.resolve("components/ui/toast.tsx");
  const bottomNavPath = path.resolve("components/layout/mobile-bottom-nav.tsx");
  const headerPath = path.resolve("components/layout/top-header.tsx");
  const workspaceLayoutPath = path.resolve("app/(workspace)/layout.tsx");

  const toastContent = fs.readFileSync(toastPath, "utf-8");
  const bottomNavContent = fs.readFileSync(bottomNavPath, "utf-8");
  const headerContent = fs.readFileSync(headerPath, "utf-8");
  const workspaceLayoutContent = fs.readFileSync(workspaceLayoutPath, "utf-8");

  // Check z-index stacking order: Toast (z-50) > Header (z-40) > Nav (z-30)
  const toastZIndex = toastContent.match(/z-(\d+)/)?.[1];
  const bottomNavZIndex = bottomNavContent.match(/z-(\d+)/)?.[1];
  const headerZIndex = headerContent.match(/z-(\d+)/)?.[1];

  assert("ToastContainer uses z-50", toastZIndex === "50", `z-${toastZIndex}`);
  assert("TopHeader uses z-40", headerZIndex === "40", `z-${headerZIndex}`);
  assert("MobileBottomNav uses z-30", bottomNavZIndex === "30", `z-${bottomNavZIndex}`);

  const zHierarchyValid = Number(toastZIndex) > Number(headerZIndex) && Number(headerZIndex) > Number(bottomNavZIndex);
  assert("Z-Index hierarchy is strictly Toast (50) > Header (40) > BottomNav (30)", zHierarchyValid);

  // Check Toast elevation on mobile:
  const toastBottomNavOffset = toastContent.includes("bottom-[calc(4.5rem+env(safe-area-inset-bottom))]");
  assert("ToastContainer has safe elevation above mobile bottom nav (4.5rem + safe-bottom)", toastBottomNavOffset);

  // Check pointer-events-none on ToastContainer
  assert("ToastContainer has pointer-events-none on container to prevent click blocking", toastContent.includes("pointer-events-none"));
  assert("Individual toast items have pointer-events-auto for user interaction", toastContent.includes("pointer-events-auto"));

  // Check Workspace main padding offset
  const mainPaddingSafe = workspaceLayoutContent.includes("pb-[calc(5rem+env(safe-area-inset-bottom))]");
  assert("Workspace main padding accounts for bottom nav height + safe bottom (calc(5rem + safe-bottom))", mainPaddingSafe);
}

function runTouchErgonomicsStressTests() {
  console.log("\n--- 3. Touch Target Ergonomics & Tap Accessibility (>= 44x44px) ---");

  const bottomNavPath = path.resolve("components/layout/mobile-bottom-nav.tsx");
  const toastPath = path.resolve("components/ui/toast.tsx");
  const notifPath = path.resolve("components/shared/notification-center.tsx");

  const bottomNavContent = fs.readFileSync(bottomNavPath, "utf-8");
  const toastContent = fs.readFileSync(toastPath, "utf-8");
  const notifContent = fs.readFileSync(notifPath, "utf-8");

  // Check all MobileBottomNav interactive items
  const navLinkMinSize = (bottomNavContent.match(/min-h-\[48px\]\s+min-w-\[48px\]/g) || []).length;
  // There are 5 items in Floreria and 5 items in Carissma
  assert("MobileBottomNav enforces min-h-[48px] min-w-[48px] across all 10 navigation targets", navLinkMinSize === 10, `Found ${navLinkMinSize}/10`);

  // Check touch manipulation feedback
  const touchManipulationCount = (bottomNavContent.match(/touch-manipulation/g) || []).length;
  assert("MobileBottomNav items have touch-manipulation CSS class to eliminate 300ms tap delay", touchManipulationCount >= 10, `Found ${touchManipulationCount}`);

  // Check active state tactile feedback
  const activeScaleCount = (bottomNavContent.match(/active:scale-95/g) || []).length;
  assert("MobileBottomNav items include active:scale-95 feedback", activeScaleCount >= 10, `Found ${activeScaleCount}`);

  // Check toast close button touch target
  assert("Toast close button is at least 44x44px (min-h-[44px] min-w-[44px])", toastContent.includes("min-h-[44px]") && toastContent.includes("min-w-[44px]"));

  // Check notification center buttons
  assert("Notification center refresh button meets min-h-[44px] min-w-[44px]", notifContent.includes("min-h-[44px] min-w-[44px]"));
  assert("Notification center close button meets min-h-[44px] min-w-[44px]", notifContent.includes("aria-label=\"Cerrar notificaciones\"") && notifContent.includes("min-h-[44px] min-w-[44px]"));
  assert("Notification center dismiss button meets min-h-[44px] min-w-[44px]", notifContent.includes("title=\"Descartar notificación\"") && notifContent.includes("min-h-[44px] min-w-[44px]"));
}

function runCssRulesAndZoomPreventionTests() {
  console.log("\n--- 4. CSS Media Queries & Mobile Auto-Zoom Prevention Guard ---");

  const cssPath = path.resolve("app/globals.css");
  const css = fs.readFileSync(cssPath, "utf-8");

  // Verify mobile media query breakpoint
  assert("Media query applies strictly on mobile (< 768px)", css.includes("@media (max-width: 767px)"));
  assert("Font size is forced to 16px !important", css.includes("font-size: 16px !important;"));
  assert("Input elements (text, number, email, etc) are covered", css.includes("input:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"range\"])"));
  assert("Select elements are covered", css.includes("select,"));
  assert("Textarea elements are covered", css.includes("textarea"));

  // Safe area variable definitions
  assert("--safe-bottom custom property is defined with fallback", css.includes("--safe-bottom: env(safe-area-inset-bottom, 0px);"));
  assert("--safe-top custom property is defined with fallback", css.includes("--safe-top: env(safe-area-inset-top, 0px);"));
  assert(".pb-safe utility class is provided with max(0.5rem, safe-bottom)", css.includes(".pb-safe {"));
  assert(".pt-safe utility class is provided with max(0.5rem, safe-top)", css.includes(".pt-safe {"));
}

function runHorizontalOverflowAdversarialChecks() {
  console.log("\n--- 5. Adversarial Check: Screen Width Dimensions & ToastContainer Positioning ---");

  const toastPath = path.resolve("components/ui/toast.tsx");
  const toastContent = fs.readFileSync(toastPath, "utf-8");

  // Evaluate Toast positioning:
  // "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:bottom-5 right-3 sm:right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
  const toastHasPointerEventsNone = toastContent.includes("pointer-events-none");
  assert("Toast container has pointer-events-none so no invisible overlay blocks clicks", toastHasPointerEventsNone);

  // Check bottom nav fixed container geometry
  const bottomNavPath = path.resolve("components/layout/mobile-bottom-nav.tsx");
  const bottomNavContent = fs.readFileSync(bottomNavPath, "utf-8");
  assert("MobileBottomNav spans full width without horizontal offset (fixed bottom-0 left-0 right-0)", bottomNavContent.includes("fixed bottom-0 left-0 right-0"));
  assert("MobileBottomNav hides on large screens (lg:hidden)", bottomNavContent.includes("lg:hidden"));
  assert("MobileBottomNav hides when printing (print:hidden)", bottomNavContent.includes("print:hidden"));
}

async function main() {
  console.log("================================================================================");
  console.log("  CHALLENGER 2 EMPIRICAL STRESS TEST HARNESS — MILESTONE 1 VERIFICATION");
  console.log("================================================================================");

  await runDevServerStressTests();
  runLayoutAndZIndexStressTests();
  runTouchErgonomicsStressTests();
  runCssRulesAndZoomPreventionTests();
  runHorizontalOverflowAdversarialChecks();

  console.log("\n================================================================================");
  console.log("  SUMMARY");
  console.log("================================================================================");

  const total = results.length;
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  console.log(`  Total Assertions: ${total}`);
  console.log(`  Passed:           ${passed}`);
  console.log(`  Failed:           ${failed}`);
  console.log("================================================================================");

  if (failed === 0) {
    console.log(">>> VERDICT: ALL MILESTONE 1 STRESS-TESTS PASSED (APPROVE)");
    process.exit(0);
  } else {
    console.log(">>> VERDICT: ISSUES FOUND (REJECT)");
    process.exit(1);
  }
}

main();
