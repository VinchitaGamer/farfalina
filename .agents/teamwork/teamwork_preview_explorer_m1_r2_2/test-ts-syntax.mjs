import fs from "fs";
import path from "path";
import ts from "typescript";

const notifPath = path.join(process.cwd(), "components/shared/notification-center.tsx");
let notifContent = fs.readFileSync(notifPath, "utf8");

// Mock the proposed change on the 4 filter buttons + container
const proposed = notifContent
  .replace(
    `<div className="p-3 border-b border-warm-200 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold pb-2">`,
    `<div className="px-3 py-2 border-b border-warm-200 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">`
  )
  .replace(
    `            onClick={() => setActiveFilter("all")}\n            className={cn(\n              "px-2.5 py-1 rounded-lg transition-all whitespace-nowrap",`,
    `            onClick={() => setActiveFilter("all")}\n            className={cn(\n              "min-h-[44px] px-3 py-2 rounded-lg transition-all whitespace-nowrap flex items-center justify-center shrink-0 active:scale-95 touch-manipulation",`
  )
  .replace(
    `            onClick={() => setActiveFilter("inventory")}\n            className={cn(\n              "px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1",`,
    `            onClick={() => setActiveFilter("inventory")}\n            className={cn(\n              "min-h-[44px] px-3 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 active:scale-95 touch-manipulation",`
  )
  .replace(
    `            onClick={() => setActiveFilter("logistics")}\n            className={cn(\n              "px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1",`,
    `            onClick={() => setActiveFilter("logistics")}\n            className={cn(\n              "min-h-[44px] px-3 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 active:scale-95 touch-manipulation",`
  )
  .replace(
    `            onClick={() => setActiveFilter("register")}\n            className={cn(\n              "px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1",`,
    `            onClick={() => setActiveFilter("register")}\n            className={cn(\n              "min-h-[44px] px-3 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 active:scale-95 touch-manipulation",`
  );

// Check diagnostics
const program = ts.createProgram({
  rootNames: [notifPath],
  options: {
    noEmit: true,
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true
  }
});

const sf = ts.createSourceFile(notifPath, proposed, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
// Parse diagnostics
const syntacticDiagnostics = sf.parseDiagnostics;
console.log("Syntactic diagnostics count:", syntacticDiagnostics?.length || 0);
if (syntacticDiagnostics && syntacticDiagnostics.length > 0) {
  console.error("Syntax errors found:", syntacticDiagnostics);
} else {
  console.log("Syntax is 100% valid TypeScript JSX!");
}
