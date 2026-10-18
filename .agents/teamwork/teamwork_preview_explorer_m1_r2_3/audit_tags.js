const fs = require("fs");
const path = require("path");

const files = [
  "components/shared/notification-center.tsx",
  "components/layout/mobile-bottom-nav.tsx",
  "components/ui/toast.tsx"
];

files.forEach(file => {
  const fullPath = path.resolve("c:/Users/Lenovo/Desktop/floreria", file);
  const content = fs.readFileSync(fullPath, "utf8");

  console.log("\n=======================================================");
  console.log("FILE: " + file);
  console.log("=======================================================");

  // Find all opening tags of button, Link, a, or tags with onClick
  // We can scan character by character
  let i = 0;
  while (i < content.length) {
    if (content[i] === '<') {
      // Check tag name
      const rest = content.slice(i);
      const match = rest.match(/^<([a-zA-Z0-9_.-]+)/);
      if (match) {
        const tagName = match[1];
        // find end of opening tag, taking into account strings and {}
        let j = i + match[0].length;
        let inCurly = 0;
        let inQuote = null;
        let tagStr = match[0];
        while (j < content.length) {
          const char = content[j];
          tagStr += char;
          if (inQuote) {
            if (char === inQuote && content[j-1] !== '\\') {
              inQuote = null;
            }
          } else if (char === '"' || char === "'" || char === '`') {
            inQuote = char;
          } else if (char === '{') {
            inCurly++;
          } else if (char === '}') {
            inCurly--;
          } else if (char === '>' && inCurly === 0) {
            break;
          }
          j++;
        }

        const isInteractiveTag = ['button', 'Link', 'a', 'input', 'select', 'textarea'].includes(tagName);
        const hasOnClick = /onClick\s*=/.test(tagStr);
        const hasRoleBtn = /role\s*=\s*["']button["']/.test(tagStr);

        if (isInteractiveTag || hasOnClick || hasRoleBtn) {
          // get line number
          const lineNumber = content.substring(0, i).split('\n').length;
          console.log(`\n--- Line ${lineNumber}: <${tagName}> ---`);
          console.log(tagStr.replace(/\s+/g, ' ').trim().slice(0, 200));

          const hasMinH44 = /min-h-\[(4[4-9]|[5-9][0-9])px\]/.test(tagStr);
          const hasMinH48 = /min-h-\[48px\]/.test(tagStr);
          const hasMinW44 = /min-w-\[(4[4-9]|[5-9][0-9])px\]/.test(tagStr);
          const hasMinW48 = /min-w-\[48px\]/.test(tagStr);
          const hasTouchManip = /touch-manipulation/.test(tagStr);
          const hasActiveScale = /active:scale-95/.test(tagStr);

          console.log(`  Target Size: min-h>=44px: ${hasMinH44}, min-w>=44px: ${hasMinW44}`);
          console.log(`  Ergonomics: touch-manipulation: ${hasTouchManip}, active-scale: ${hasActiveScale}`);

          if (!hasMinH44 || !hasMinW44) {
            console.log(`  >>> STATUS: DEFECTIVE / MISSING TOUCH TARGET DIMENSIONS`);
          } else {
            console.log(`  >>> STATUS: PASS`);
          }
        }

        i = j;
      }
    }
    i++;
  }
});
