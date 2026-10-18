const fs = require("fs");
const path = require("path");

const files = [
  "components/layout/top-header.tsx",
  "components/layout/sidebar.tsx",
  "components/shared/card-printer-modal.tsx",
  "components/ui/confirm-dialog.tsx"
];

files.forEach(file => {
  const fullPath = path.resolve("c:/Users/Lenovo/Desktop/floreria", file);
  const content = fs.readFileSync(fullPath, "utf8");

  console.log("\n=======================================================");
  console.log("FILE: " + file);
  console.log("=======================================================");

  let i = 0;
  while (i < content.length) {
    if (content[i] === '<') {
      const rest = content.slice(i);
      const match = rest.match(/^<([a-zA-Z0-9_.-]+)/);
      if (match) {
        const tagName = match[1];
        let j = i + match[0].length;
        let inCurly = 0;
        let inQuote = null;
        let tagStr = match[0];
        while (j < content.length) {
          const char = content[j];
          tagStr += char;
          if (inQuote) {
            if (char === inQuote && content[j-1] !== '\\') inQuote = null;
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
          const lineNumber = content.substring(0, i).split('\n').length;
          console.log(`\n--- Line ${lineNumber}: <${tagName}> ---`);
          console.log(tagStr.replace(/\s+/g, ' ').trim().slice(0, 160));

          const hasMinH44 = /min-h-\[(4[4-9]|[5-9][0-9])px\]/.test(tagStr);
          const hasMinW44 = /min-w-\[(4[4-9]|[5-9][0-9])px\]/.test(tagStr);
          console.log(`  min-h>=44px: ${hasMinH44}, min-w>=44px: ${hasMinW44}`);
        }

        i = j;
      }
    }
    i++;
  }
});
