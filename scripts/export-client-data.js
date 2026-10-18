const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "prisma", "dev.db");
const outputPath = path.join(__dirname, "..", "prisma", "client_data_backup.json");

const db = new Database(dbPath, { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

const backupData = {
  exportedAt: new Date().toISOString(),
  totalTables: 0,
  totalRecords: 0,
  tables: {}
};

console.log("=== EXPORTING DATABASE TABLES FROM prisma/dev.db ===");

for (const { name } of tables) {
  if (name.startsWith("sqlite_") || name.startsWith("_prisma")) continue;
  try {
    const rows = db.prepare(`SELECT * FROM "${name}"`).all();
    const count = rows.length;
    backupData.tables[name] = {
      count,
      records: rows
    };
    if (count > 0) {
      backupData.totalTables++;
      backupData.totalRecords += count;
      console.log(`- ${name}: ${count} records`);
    } else {
      console.log(`  (empty) ${name}: 0 records`);
    }
  } catch (err) {
    console.error(`Error reading table ${name}:`, err.message);
  }
}

console.log("----------------------------------------");
console.log(`Total non-empty tables: ${backupData.totalTables}`);
console.log(`Total records: ${backupData.totalRecords}`);

fs.writeFileSync(outputPath, JSON.stringify(backupData, null, 2), "utf-8");
console.log(`Saved backup to: ${outputPath}`);
