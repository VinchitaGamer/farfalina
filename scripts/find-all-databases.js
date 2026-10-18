const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

function searchFolder(dir, maxDepth = 3, currentDepth = 0) {
  let results = [];
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "AppData") continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        results = results.concat(searchFolder(full, maxDepth, currentDepth + 1));
      } else if (e.name.endsWith(".db") || e.name.endsWith(".sqlite") || e.name.endsWith(".bak")) {
        results.push(full);
      }
    }
  } catch (err) {}
  return results;
}

const foldersToSearch = [
  "C:/Users/Lenovo/Desktop",
  "C:/Users/Lenovo/Downloads",
  "C:/Users/Lenovo/Documents"
];

console.log("Searching for SQLite databases...");
const allDbFiles = [];
for (const f of foldersToSearch) {
  allDbFiles.push(...searchFolder(f, 3));
}

console.log(`Found ${allDbFiles.length} database files:`);
for (const dbPath of allDbFiles) {
  try {
    const stat = fs.statSync(dbPath);
    const db = new Database(dbPath, { readonly: true });
    let info = [];
    
    // Check tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    for (const t of ["RawIngredient", "Arrangement", "Dress", "OrderDelivery", "CRMClient", "POSTicket"]) {
      if (tables.includes(t)) {
        try {
          const c = db.prepare(`SELECT count(*) as c FROM "${t}"`).get().c;
          info.push(`${t}:${c}`);
        } catch(e) {}
      }
    }
    db.close();
    console.log(`\n=> [${stat.size} bytes | ${stat.mtime.toLocaleDateString()}] ${dbPath}`);
    console.log(`   Tables: ${info.join(", ") || "None of target tables"}`);
  } catch (e) {
    // Not a valid sqlite or locked
  }
}
