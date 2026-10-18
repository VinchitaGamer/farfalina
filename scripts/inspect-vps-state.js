const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log("=== 1. CURRENT DEV.DB INSPECTION ===");
try {
  const db = new Database('/var/www/floreria-demo/prisma/dev.db');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log("Found", tables.length, "tables:");
  for (const t of tables) {
    if (t.name.startsWith('_') || t.name === 'sqlite_sequence') continue;
    try {
      const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
      console.log(` - ${t.name}: ${count.c} rows`);
      if (count.c > 0 && count.c <= 5) {
        const rows = db.prepare(`SELECT * FROM "${t.name}" LIMIT 3`).all();
        console.log(`   Sample:`, JSON.stringify(rows));
      }
    } catch (e) {
      console.log(` - ${t.name}: error ${e.message}`);
    }
  }
} catch (e) {
  console.error("Error opening current dev.db:", e.message);
}

console.log("\n=== 2. SEARCHING FOR OTHER .DB FILES ===");
function findFiles(dir, maxDepth = 4, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    for (const file of list) {
      if (file === 'node_modules' || file === '.next' || file === '.git') continue;
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(findFiles(fullPath, maxDepth, currentDepth + 1));
        } else if (file.endsWith('.db') || file.includes('backup') || file.endsWith('.sqlite')) {
          results.push({ path: fullPath, size: stat.size, mtime: stat.mtime });
        }
      } catch (err) {}
    }
  } catch (err) {}
  return results;
}

const found = findFiles('/var/www').concat(findFiles('/home/ubuntu')).concat(findFiles('/tmp'));
console.log("Found database/backup files:", JSON.stringify(found, null, 2));

console.log("\n=== 3. CHECKING /proc FOR OPEN HANDLES ===");
try {
  const { execSync } = require('child_process');
  const lsof = execSync('lsof 2>/dev/null | grep dev.db || true').toString();
  console.log("lsof dev.db:\n", lsof || "(none)");
} catch (e) {
  console.log("lsof error:", e.message);
}
