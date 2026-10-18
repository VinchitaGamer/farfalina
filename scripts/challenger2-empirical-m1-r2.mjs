// scripts/challenger2-empirical-m1-r2.mjs
// Independent Empirical Adversarial Test Harness by Challenger 2
// Milestone 1 Iteration 2 Gate: NotificationCenter Touch Target Remediation & System Stability

import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import ts from "typescript";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

const ROOT_DIR = process.cwd();
const testResults = [];
let passCount = 0;
let failCount = 0;

function assertTest(id, name, pass, details = "") {
  if (pass) {
    passCount++;
    console.log(`  ✓ PASS [${id}]: ${name}`);
    if (details) console.log(`         Details: ${details}`);
    testResults.push({ id, name, status: "PASS", details });
  } else {
    failCount++;
    console.error(`  ✗ FAIL [${id}]: ${name}`);
    if (details) console.error(`         Failure: ${details}`);
    testResults.push({ id, name, status: "FAIL", details });
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =========================================================================
// SUITE 1: DEV SERVER LIVE CONCURRENCY & STRESS TEST
// =========================================================================
async function suite1DevServerStress() {
  console.log("\n--- SUITE 1: DEV SERVER CONCURRENCY & STRESS PROBE (HTTP 200) ---");

  // 1. Single probe
  const singleStatus = await new Promise((resolve) => {
    http.get("http://localhost:3000", { timeout: 3000 }, (res) => {
      resolve(res.statusCode);
    }).on("error", (e) => resolve(e.message));
  });
  assertTest(
    "ADV-1.1",
    "Dev server is active and responds on http://localhost:3000",
    singleStatus === 200 || singleStatus === 307 || singleStatus === 308,
    `HTTP Status: ${singleStatus}`
  );

  // 2. High concurrency burst (25 concurrent HTTP requests across key routes)
  const routes = [
    "/",
    "/floreria/catalog",
    "/floreria/pos",
    "/floreria/orders",
    "/floreria/crm",
    "/floreria/omnichannel",
    "/floreria/accounting",
    "/carissma/catalog",
    "/carissma/pos",
    "/carissma/accounting"
  ];

  const concurrentRequests = [];
  const startBurst = Date.now();
  for (let i = 0; i < 25; i++) {
    const route = routes[i % routes.length];
    concurrentRequests.push(
      new Promise((resolve) => {
        const reqStart = Date.now();
        http.get(`http://localhost:3000${route}`, { timeout: 4000 }, (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            resolve({
              route,
              status: res.statusCode,
              latency: Date.now() - reqStart,
              bodyLength: data.length,
              ok: res.statusCode >= 200 && res.statusCode < 400
            });
          });
        }).on("error", (err) => {
          resolve({ route, status: 0, error: err.message, ok: false });
        });
      })
    );
  }

  const burstResults = await Promise.all(concurrentRequests);
  const totalBurstElapsed = Date.now() - startBurst;
  const failedBurst = burstResults.filter((r) => !r.ok);
  const avgLatency = Math.round(burstResults.reduce((acc, r) => acc + (r.latency || 0), 0) / burstResults.length);

  assertTest(
    "ADV-1.2",
    "Dev server survives 25 concurrent requests across 10 routes with zero dropouts",
    failedBurst.length === 0,
    `Failed: ${failedBurst.length}/25, Avg latency: ${avgLatency}ms, Total elapsed: ${totalBurstElapsed}ms`
  );

  // 3. Viewport tag in live rendered HTML
  const liveHtml = await new Promise((resolve) => {
    http.get("http://localhost:3000/floreria/catalog", { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", () => resolve(""));
  });

  const viewportMatch = liveHtml.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i);
  const viewportContent = viewportMatch ? viewportMatch[1] : "";
  const hasInteractiveWidget = viewportContent.includes("interactive-widget=resizes-content");
  const hasDeviceWidth = viewportContent.includes("width=device-width");
  const hasInitialScale = viewportContent.includes("initial-scale=1");

  assertTest(
    "ADV-1.3",
    "Live rendered HTML delivers compliant viewport meta tag with interactive-widget=resizes-content",
    hasInteractiveWidget && hasDeviceWidth && hasInitialScale,
    `Delivered meta content: "${viewportContent}"`
  );
}

// =========================================================================
// SUITE 2: NOTIFICATION CENTER TOUCH TARGETS & ERGONOMICS (AST & ATTRIBUTES)
// =========================================================================
async function suite2NotificationCenterErgonomics() {
  console.log("\n--- SUITE 2: NOTIFICATION CENTER TOUCH TARGETS & ERGONOMICS (WCAG 2.5.5) ---");

  const notifFilePath = path.join(ROOT_DIR, "components/shared/notification-center.tsx");
  const notifContent = fs.readFileSync(notifFilePath, "utf8");
  const sf = ts.createSourceFile("notification-center.tsx", notifContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const buttonElements = [];
  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (tag === "button") {
        const text = node.getText(sf);
        const start = node.getStart(sf);
        const { line } = sf.getLineAndCharacterOfPosition(start);
        buttonElements.push({
          line: line + 1,
          tag,
          text,
          node
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  assertTest(
    "ADV-2.1",
    "NotificationCenter contains all expected interactive buttons (>= 8 buttons)",
    buttonElements.length >= 8,
    `Total buttons identified: ${buttonElements.length}`
  );

  // Check every button for min 44px height and touch manipulation
  const failingButtons = [];
  const compliantButtons = [];

  for (const btn of buttonElements) {
    const minH44 = /min-h-\[(4[4-9]|[5-9]\d)px\]/.test(btn.text) || /h-(1[1-9]|[2-9]\d)/.test(btn.text);
    const minW44OrPadded = /min-w-\[(4[4-9]|[5-9]\d)px\]/.test(btn.text) || /px-[3-9]/.test(btn.text) || /p-2\.5/.test(btn.text) || /w-(1[1-9]|[2-9]\d)/.test(btn.text);
    const touchFeedback = /touch-manipulation/.test(btn.text);
    const activeScale = /active:scale-95/.test(btn.text);

    const isCompliant = minH44 && minW44OrPadded;
    if (isCompliant) {
      compliantButtons.push({ line: btn.line, touchFeedback, activeScale });
    } else {
      failingButtons.push({ line: btn.line, snippet: btn.text.replace(/\s+/g, " ").slice(0, 100) });
    }
  }

  assertTest(
    "ADV-2.2",
    "100% of buttons in NotificationCenter meet minimum 44px touch target threshold",
    failingButtons.length === 0,
    failingButtons.length === 0
      ? `All ${buttonElements.length} buttons fully conform to >= 44px height`
      : `Violations: ${failingButtons.length} on lines: ${failingButtons.map((f) => f.line).join(", ")}`
  );

  const missingFeedback = compliantButtons.filter((b) => !b.touchFeedback || !b.activeScale);
  assertTest(
    "ADV-2.3",
    "All compliant buttons provide touch-manipulation and active:scale-95 tactile response",
    missingFeedback.length === 0,
    missingFeedback.length === 0
      ? "All buttons include touch-manipulation + active:scale-95"
      : `Missing tactile classes on lines: ${missingFeedback.map((b) => b.line).join(", ")}`
  );

  // Inspect the Filter Container ergonomics specifically
  const filterDivMatch = notifContent.match(/\{\/\*\s*Category Filters\s*\*\/\}[\s\S]*?<div\s+className=["']([^"']+)["']/i);
  const filterClasses = filterDivMatch ? filterDivMatch[1] : "";

  const hasOverflowXAuto = filterClasses.includes("overflow-x-auto");
  const hasTouchPanX = filterClasses.includes("touch-pan-x");
  const hasOverscrollContain = filterClasses.includes("overscroll-x-contain");
  const hasScrollbarHidden = filterClasses.includes("[scrollbar-width:none]") && filterClasses.includes("[&::-webkit-scrollbar]:hidden");
  const hasShrink0 = filterClasses.includes("shrink-0");

  assertTest(
    "ADV-2.4",
    "Category filter bar implements horizontal touch ergonomics (touch-pan-x, overscroll-x-contain, hidden scrollbar)",
    hasOverflowXAuto && hasTouchPanX && hasOverscrollContain && hasScrollbarHidden && hasShrink0,
    `Classes verified: overflow-x-auto=${hasOverflowXAuto}, touch-pan-x=${hasTouchPanX}, overscroll-x-contain=${hasOverscrollContain}, scrollbarHidden=${hasScrollbarHidden}`
  );

  // Check WebKit right spacer
  const hasTrailingSpacer = notifContent.includes('className="w-1 shrink-0" aria-hidden="true"');
  assertTest(
    "ADV-2.5",
    "Filter bar includes trailing right-padding spacer for iOS WebKit scroll bounds",
    hasTrailingSpacer,
    hasTrailingSpacer ? "Trailing spacer <div className='w-1 shrink-0' aria-hidden='true' /> present" : "Missing spacer"
  );
}

// =========================================================================
// SUITE 3: MOBILE BASE STYLES & AUTO-ZOOM PREVENTION COMPILATION
// =========================================================================
async function suite3MobileBaseStyles() {
  console.log("\n--- SUITE 3: CSS MOBILE FONT-SIZE GUARD & SAFE-AREA COMPILATION ---");

  const cssPath = path.join(ROOT_DIR, "app/globals.css");
  const cssRaw = fs.readFileSync(cssPath, "utf8");

  // PostCSS compilation test
  let compiledCss = "";
  try {
    const postCssResult = await postcss([tailwindcss()]).process(cssRaw, { from: cssPath });
    compiledCss = postCssResult.css;
  } catch (err) {
    assertTest("ADV-3.1", "PostCSS & Tailwind compile app/globals.css without errors", false, err.message);
    return;
  }

  assertTest(
    "ADV-3.1",
    "PostCSS & Tailwind compile app/globals.css without errors",
    Boolean(compiledCss && compiledCss.length > 50000),
    `Compiled CSS size: ${compiledCss.length} bytes`
  );

  // Check Mobile-specific media query for 16px font size
  const mobile16pxRegex = /@media[^{]*max-width:\s*767px[^{]*\{[\s\S]*?font-size:\s*16px\s*!important/i;
  const hasMobile16px = mobile16pxRegex.test(compiledCss);

  assertTest(
    "ADV-3.2",
    "Compiled CSS contains strict @media (max-width: 767px) rule enforcing font-size: 16px !important",
    hasMobile16px,
    hasMobile16px ? "16px !important present inside max-width: 767px" : "Rule missing or malformed"
  );

  // Check no accidental global font-size: 16px !important on desktop
  const cssOutsideMobile = compiledCss.replace(/@media[^{]*max-width:\s*767px[^{]*\{[\s\S]*?\}(?=\s*@|\s*\.[a-z]|\s*[a-z])/gi, "");
  const leaked16pxImportant = /font-size:\s*16px\s*!important/.test(cssOutsideMobile);

  assertTest(
    "ADV-3.3",
    "No desktop font-size leakage: 16px !important is strictly constrained to < 768px",
    !leaked16pxImportant,
    leaked16pxImportant ? "Leakage detected outside mobile media query" : "Strict isolation preserved"
  );

  // Safe-area custom properties & utility classes
  const hasSafeBottomProp = compiledCss.includes("env(safe-area-inset-bottom");
  const hasSafeTopProp = compiledCss.includes("env(safe-area-inset-top");
  const hasPbSafe = compiledCss.includes("pb-safe");

  assertTest(
    "ADV-3.4",
    "Compiled CSS includes safe-area-inset custom properties and utilities",
    hasSafeBottomProp && hasSafeTopProp && hasPbSafe,
    `safeBottom=${hasSafeBottomProp}, safeTop=${hasSafeTopProp}, pbSafe=${hasPbSafe}`
  );
}

// =========================================================================
// SUITE 4: REGRESSION CHECKS ACROSS NAVIGATION SHELL & WORKSPACE LAYOUT
// =========================================================================
async function suite4NavigationAndLayoutRegression() {
  console.log("\n--- SUITE 4: NAVIGATION SHELL & LAYOUT REGRESSION INTEGRITY ---");

  const bottomNavPath = path.join(ROOT_DIR, "components/layout/mobile-bottom-nav.tsx");
  const wsLayoutPath = path.join(ROOT_DIR, "app/(workspace)/layout.tsx");
  const toastPath = path.join(ROOT_DIR, "components/ui/toast.tsx");

  const bottomNavContent = fs.readFileSync(bottomNavPath, "utf8");
  const wsLayoutContent = fs.readFileSync(wsLayoutPath, "utf8");
  const toastContent = fs.readFileSync(toastPath, "utf8");

  // 1. MobileBottomNav safe padding and touch targets
  const navHasSafeArea = bottomNavContent.includes("pb-[env(safe-area-inset-bottom)]");
  const navTargetsCount = (bottomNavContent.match(/min-h-\[48px\]\s+min-w-\[48px\]/g) || []).length;
  assertTest(
    "ADV-4.1",
    "MobileBottomNav enforces pb-[env(safe-area-inset-bottom)] and 10 touch targets with min-h-[48px] min-w-[48px]",
    navHasSafeArea && navTargetsCount === 10,
    `safeArea=${navHasSafeArea}, targets=${navTargetsCount}/10`
  );

  // 2. Workspace Layout main bottom padding compensation
  const mainHasPaddingCalc = wsLayoutContent.includes("pb-[calc(5rem+env(safe-area-inset-bottom))]");
  assertTest(
    "ADV-4.2",
    "Workspace layout main element reserves safe height for mobile nav pb-[calc(5rem+env(safe-area-inset-bottom))]",
    mainHasPaddingCalc,
    mainHasPaddingCalc ? "Main container reserves 5rem + safe-bottom" : "Padding calculation missing"
  );

  // 3. ToastContainer elevation and click pass-through
  const toastOffset = toastContent.includes("bottom-[calc(4.5rem+env(safe-area-inset-bottom))]");
  const toastPointerEvents = toastContent.includes("pointer-events-none") && toastContent.includes("pointer-events-auto");
  assertTest(
    "ADV-4.3",
    "ToastContainer is elevated above mobile nav and uses pointer-events-none container with pointer-events-auto items",
    toastOffset && toastPointerEvents,
    `offset=${toastOffset}, pointerEvents=${toastPointerEvents}`
  );
}

// =========================================================================
// SUITE 5: TYPESCRIPT STATIC TYPECHECKING (TSC --NOEMIT)
// =========================================================================
async function suite5TypeScriptTypeCheck() {
  console.log("\n--- SUITE 5: TYPESCRIPT STATIC TYPE CHECKING (TSC --NOEMIT) ---");

  let tscSuccess = false;
  let tscOutput = "";
  try {
    const out = execSync("npx tsc --noEmit", { cwd: ROOT_DIR, stdio: "pipe" });
    tscSuccess = true;
    tscOutput = out.toString();
  } catch (err) {
    tscOutput = err.stdout?.toString() || err.stderr?.toString() || err.message;
  }

  assertTest(
    "ADV-5.1",
    "TypeScript static typecheck (npx tsc --noEmit) passes cleanly with 0 errors",
    tscSuccess,
    tscSuccess ? "Exit code 0, 0 compiler errors" : `Errors: ${tscOutput.slice(0, 300)}`
  );
}

// =========================================================================
// RUN ALL SUITES
// =========================================================================
async function main() {
  console.log("================================================================================");
  console.log("  CHALLENGER 2 EMPIRICAL ADVERSARIAL STRESS TEST HARNESS (M1 ITERATION 2)");
  console.log("  Preserving Active Dev Server (Constraint R4)");
  console.log("================================================================================");

  await suite1DevServerStress();
  await suite2NotificationCenterErgonomics();
  await suite3MobileBaseStyles();
  await suite4NavigationAndLayoutRegression();
  await suite5TypeScriptTypeCheck();

  console.log("\n================================================================================");
  console.log("  CHALLENGER 2 SUMMARY");
  console.log("================================================================================");
  console.log(`  Total Adversarial Assertions: ${testResults.length}`);
  console.log(`  Passed:                      ${passCount}`);
  console.log(`  Failed:                      ${failCount}`);
  console.log("================================================================================");

  if (failCount === 0) {
    console.log(">>> FINAL VERDICT: APPROVE (Milestone 1 Iteration 2 Gate Satisfied)");
    process.exit(0);
  } else {
    console.log(">>> FINAL VERDICT: REJECT (Defects identified)");
    process.exit(1);
  }
}

main();
