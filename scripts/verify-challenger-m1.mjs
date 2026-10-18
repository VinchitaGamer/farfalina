import fs from "fs";
import path from "path";
import http from "http";
import ts from "typescript";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { execSync } from "child_process";

const ROOT_DIR = process.cwd();

const results = [];
let passCount = 0;
let failCount = 0;

function report(id, description, passed, details = "") {
  if (passed) {
    passCount++;
    console.log(`[PASS] ${id}: ${description}`);
    if (details) console.log(`       Details: ${details}`);
    results.push({ id, description, status: "PASS", details });
  } else {
    failCount++;
    console.error(`[FAIL] ${id}: ${description}`);
    if (details) console.error(`       Failure reason: ${details}`);
    results.push({ id, description, status: "FAIL", details });
  }
}

async function run() {
  console.log("=== EMPIRICAL CHALLENGER 1 (MILESTONE 1) TEST HARNESS ===");

  // ---------------------------------------------------------
  // TEST SUITE 1: VIEWPORT EXPORT & LIVE HTTP VALIDATION
  // ---------------------------------------------------------
  console.log("\n--- Suite 1: Viewport Configuration ---");
  const layoutPath = path.join(ROOT_DIR, "app/layout.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf8");

  const sfLayout = ts.createSourceFile("layout.tsx", layoutContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let foundViewportExport = false;
  let widthVal = null;
  let initialScaleVal = null;
  let interactiveWidgetVal = null;

  function visitLayout(node) {
    if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) {
        for (const decl of node.declarationList.declarations) {
          if (decl.name.getText(sfLayout) === "viewport") {
            foundViewportExport = true;
            if (decl.initializer && ts.isObjectLiteralExpression(decl.initializer)) {
              for (const prop of decl.initializer.properties) {
                if (ts.isPropertyAssignment(prop)) {
                  const key = prop.name.getText(sfLayout);
                  const val = prop.initializer.getText(sfLayout).replace(/['"]/g, "");
                  if (key === "width") widthVal = val;
                  if (key === "initialScale") initialScaleVal = Number(val);
                  if (key === "interactiveWidget") interactiveWidgetVal = val;
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visitLayout);
  }
  visitLayout(sfLayout);

  report(
    "CHALLENGE-1.1",
    "app/layout.tsx exports typed viewport with required mobile properties",
    foundViewportExport && widthVal === "device-width" && initialScaleVal === 1 && interactiveWidgetVal === "resizes-content",
    `foundExport=${foundViewportExport}, width=${widthVal}, initialScale=${initialScaleVal}, interactiveWidget=${interactiveWidgetVal}`
  );

  // Live HTTP Probe
  const liveMeta = await new Promise((resolve) => {
    http.get("http://localhost:3000", { timeout: 3000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const metaMatch = data.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i);
        resolve({ active: true, content: metaMatch ? metaMatch[1] : null, raw: metaMatch ? metaMatch[0] : null });
      });
    }).on("error", (e) => resolve({ active: false, error: e.message }));
  });

  const hasLiveViewport = liveMeta.active && liveMeta.content &&
    liveMeta.content.includes("width=device-width") &&
    liveMeta.content.includes("initial-scale=1") &&
    liveMeta.content.includes("interactive-widget=resizes-content");

  report(
    "CHALLENGE-1.2",
    "Live HTTP dev server delivers <meta name='viewport'> with interactive-widget=resizes-content",
    hasLiveViewport,
    liveMeta.active ? `Rendered meta tag: ${liveMeta.raw}` : `Server error: ${liveMeta.error}`
  );

  // ---------------------------------------------------------
  // TEST SUITE 2: MOBILE 16PX FONT-SIZE GUARD & CSS COMPILATION
  // ---------------------------------------------------------
  console.log("\n--- Suite 2: Mobile 16px Font-Size CSS Rules ---");
  const globalsPath = path.join(ROOT_DIR, "app/globals.css");
  const globalsContent = fs.readFileSync(globalsPath, "utf8");

  let compiledCss = "";
  let cssCompilePassed = false;
  try {
    const postCssResult = await postcss([tailwindcss()]).process(globalsContent, { from: globalsPath });
    compiledCss = postCssResult.css;
    cssCompilePassed = true;
  } catch (err) {
    compiledCss = err.message;
  }

  report(
    "CHALLENGE-2.1",
    "app/globals.css compiles cleanly through PostCSS / Tailwind CSS engine",
    cssCompilePassed,
    cssCompilePassed ? `Compiled CSS length: ${compiledCss.length} bytes` : `Compilation error: ${compiledCss}`
  );

  const mediaMatch = compiledCss.match(/@media\s*\(max-width:\s*767px\)\s*\{([\s\S]*?)\n\}/);
  const mediaContent = mediaMatch ? mediaMatch[1] : "";

  const enforces16px = mediaContent.includes("font-size: 16px !important;");
  const matchesInputs = mediaContent.includes("input:not([type=\"checkbox\"]):not([type=\"radio\"]):not([type=\"range\"])");
  const matchesSelect = mediaContent.includes("select");
  const matchesTextarea = mediaContent.includes("textarea");

  report(
    "CHALLENGE-2.2",
    "CSS enforces font-size: 16px !important exclusively on < 768px for input, select, textarea",
    Boolean(mediaMatch) && enforces16px && matchesInputs && matchesSelect && matchesTextarea,
    `mediaQueryFound=${Boolean(mediaMatch)}, 16px=${enforces16px}, inputs=${matchesInputs}, select=${matchesSelect}, textarea=${matchesTextarea}`
  );

  // Desktop leakage check: ensure there is no unconstrained global 16px !important outside the media query
  const cssWithoutMobileMedia = compiledCss.replace(/@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\n\}/g, "");
  const hasDesktopLeakage = /input[^\{]*\{[^\}]*font-size:\s*16px\s*!important/i.test(cssWithoutMobileMedia);

  report(
    "CHALLENGE-2.3",
    "No desktop font-size override leakage (>= 768px desktop typography preserved)",
    !hasDesktopLeakage,
    hasDesktopLeakage ? "Leakage detected outside @media query" : "Desktop typography isolated and unpolluted"
  );

  // ---------------------------------------------------------
  // TEST SUITE 3: SAFE-AREA INSETS PRESENCE & SYNTAX
  // ---------------------------------------------------------
  console.log("\n--- Suite 3: Safe-Area Insets & Ergonomic Shell ---");
  const navPath = path.join(ROOT_DIR, "components/layout/mobile-bottom-nav.tsx");
  const navContent = fs.readFileSync(navPath, "utf8");

  const wsLayoutPath = path.join(ROOT_DIR, "app/(workspace)/layout.tsx");
  const wsLayoutContent = fs.readFileSync(wsLayoutPath, "utf8");

  const toastPath = path.join(ROOT_DIR, "components/ui/toast.tsx");
  const toastContent = fs.readFileSync(toastPath, "utf8");

  const navHasSafeArea = navContent.includes("pb-[env(safe-area-inset-bottom)]");
  const wsHasSafeArea = wsLayoutContent.includes("pb-[calc(5rem+env(safe-area-inset-bottom))]");
  const toastHasSafeArea = toastContent.includes("bottom-[calc(4.5rem+env(safe-area-inset-bottom))]");

  report(
    "CHALLENGE-3.1",
    "MobileBottomNav contains pb-[env(safe-area-inset-bottom)]",
    navHasSafeArea,
    `MobileBottomNav: ${navHasSafeArea}`
  );

  report(
    "CHALLENGE-3.2",
    "Workspace layout main contains pb-[calc(5rem+env(safe-area-inset-bottom))]",
    wsHasSafeArea,
    `WorkspaceLayout: ${wsHasSafeArea}`
  );

  report(
    "CHALLENGE-3.3",
    "ToastContainer elevated with bottom-[calc(4.5rem+env(safe-area-inset-bottom))]",
    toastHasSafeArea,
    `ToastContainer: ${toastHasSafeArea}`
  );

  // Verify Tailwind CSS compilation of arbitrary calc + env rules
  const tailwindCalcCheck = compiledCss.includes("padding-bottom: calc(5rem + env(safe-area-inset-bottom))") ||
    compiledCss.includes("padding-bottom: env(safe-area-inset-bottom)");

  report(
    "CHALLENGE-3.4",
    "Tailwind compiler successfully resolves safe-area arbitrary utility classes to valid CSS",
    tailwindCalcCheck,
    `Tailwind output contains valid calc / env rules`
  );

  // ---------------------------------------------------------
  // TEST SUITE 4: TOUCH TARGET DIMENSIONS (>= 44x44px)
  // ---------------------------------------------------------
  console.log("\n--- Suite 4: Touch Target Dimensions (>= 44x44px) ---");

  // 4A: MobileBottomNav interactive elements
  const sfNav = ts.createSourceFile("nav.tsx", navContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const navElements = [];
  function visitNav(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sfNav);
      if (tag === "button" || tag === "Link" || tag === "a") {
        const text = node.getText(sfNav);
        const line = sfNav.getLineAndCharacterOfPosition(node.getStart(sfNav)).line + 1;
        navElements.push({ tag, line, text });
      }
    }
    ts.forEachChild(node, visitNav);
  }
  visitNav(sfNav);

  let navAllMeet44 = true;
  const failingNavElements = [];
  for (const el of navElements) {
    const hasMinH = /min-h-\[(4[4-9]|[5-9]\d)px\]/.test(el.text) || /h-(1[1-9]|[2-9]\d)/.test(el.text);
    const hasMinW = /min-w-\[(4[4-9]|[5-9]\d)px\]/.test(el.text) || /w-(1[1-9]|[2-9]\d)/.test(el.text);
    if (!hasMinH || !hasMinW) {
      navAllMeet44 = false;
      failingNavElements.push(el);
    }
  }

  report(
    "CHALLENGE-4.1",
    "All interactive elements in MobileBottomNav have min-h >= 44px and min-w >= 44px",
    navAllMeet44,
    navAllMeet44 ? `All ${navElements.length} navigation targets enforce min-h-[48px] min-w-[48px]` : `Failing elements: ${failingNavElements.length}`
  );

  // 4B: NotificationCenter interactive elements
  const notifPath = path.join(ROOT_DIR, "components/shared/notification-center.tsx");
  const notifContent = fs.readFileSync(notifPath, "utf8");
  const sfNotif = ts.createSourceFile("notif.tsx", notifContent, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const notifButtons = [];
  function visitNotif(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sfNotif);
      if (tag === "button") {
        const text = node.getText(sfNotif);
        const line = sfNotif.getLineAndCharacterOfPosition(node.getStart(sfNotif)).line + 1;
        notifButtons.push({ tag, line, text });
      }
    }
    ts.forEachChild(node, visitNotif);
  }
  visitNotif(sfNotif);

  let notifAllMeet44 = true;
  const failingNotifButtons = [];
  for (const btn of notifButtons) {
    const hasMinH = /min-h-\[(4[4-9]|[5-9]\d)px\]/.test(btn.text) || /h-(1[1-9]|[2-9]\d)/.test(btn.text) || /py-(3|[4-9])/.test(btn.text);
    const hasMinW = /min-w-\[(4[4-9]|[5-9]\d)px\]/.test(btn.text) || /w-(1[1-9]|[2-9]\d)/.test(btn.text) || /px-(3|[4-9])/.test(btn.text);
    
    // Check specific height constraint
    const meetsHeight = /min-h-\[(4[4-9]|[5-9]\d)px\]/.test(btn.text) || /h-(1[1-9]|[2-9]\d)/.test(btn.text);
    if (!meetsHeight) {
      notifAllMeet44 = false;
      failingNotifButtons.push({
        line: btn.line,
        snippet: btn.text.replace(/\s+/g, " ").slice(0, 80)
      });
    }
  }

  report(
    "CHALLENGE-4.2",
    "All buttons in NotificationCenter have touch target dimensions >= 44px height",
    notifAllMeet44,
    notifAllMeet44
      ? `All ${notifButtons.length} buttons meet 44px threshold`
      : `${failingNotifButtons.length} button(s) lack >= 44px height! Lines: ${failingNotifButtons.map((f) => f.line).join(", ")}. Snippets: ${JSON.stringify(failingNotifButtons)}`
  );

  // ---------------------------------------------------------
  // TEST SUITE 5: TYPESCRIPT STATIC TYPECHECK
  // ---------------------------------------------------------
  console.log("\n--- Suite 5: TypeScript Compilation ---");
  let tscPassed = false;
  let tscError = "";
  try {
    execSync("npx tsc --noEmit", { cwd: ROOT_DIR, stdio: "pipe" });
    tscPassed = true;
  } catch (e) {
    tscError = e.stdout?.toString() || e.stderr?.toString() || e.message;
  }

  report(
    "CHALLENGE-5.1",
    "TypeScript static typecheck (npx tsc --noEmit) passes with 0 errors",
    tscPassed,
    tscPassed ? "0 errors" : `Errors: ${tscError.slice(0, 200)}`
  );

  // ---------------------------------------------------------
  // SUMMARY AND VERDICT
  // ---------------------------------------------------------
  console.log("\n========================================================");
  console.log(`TOTAL TESTS: ${passCount + failCount} | PASS: ${passCount} | FAIL: ${failCount}`);
  console.log("========================================================");

  if (failCount > 0) {
    console.log("CHALLENGER VERDICT: REJECT (Bugs / Non-conformances identified)");
  } else {
    console.log("CHALLENGER VERDICT: APPROVE (All requirements satisfied)");
  }

  return { passCount, failCount, results };
}

run();
