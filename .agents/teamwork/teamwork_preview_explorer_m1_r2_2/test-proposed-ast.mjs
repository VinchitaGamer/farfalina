import fs from "fs";
import path from "path";
import ts from "typescript";

const notifPath = path.join(process.cwd(), "components/shared/notification-center.tsx");
let notifContent = fs.readFileSync(notifPath, "utf8");

// Mock the proposed change on the 4 filter buttons
const proposedReplacement = notifContent
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

// Also test container classes optimization
const proposedWithContainer = proposedReplacement.replace(
  `<div className="p-3 border-b border-warm-200 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold pb-2">`,
  `<div className="px-3 py-2 border-b border-warm-200 bg-white flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold touch-pan-x overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">`
);

const sfNotif = ts.createSourceFile("notif.tsx", proposedWithContainer, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

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

console.log(`Total buttons found: ${notifButtons.length}`);
let failing = 0;
for (const btn of notifButtons) {
  const meetsHeight = /min-h-\[(4[4-9]|[5-9]\d)px\]/.test(btn.text) || /h-(1[1-9]|[2-9]\d)/.test(btn.text);
  if (!meetsHeight) {
    failing++;
    console.error(`FAIL button at line ${btn.line}: ${btn.text.slice(0, 60)}`);
  }
}

if (failing === 0) {
  console.log("PASS: All " + notifButtons.length + " buttons in notification-center.tsx satisfy min-h >= 44px!");
} else {
  console.log(`FAIL: ${failing} buttons still fail!`);
}
