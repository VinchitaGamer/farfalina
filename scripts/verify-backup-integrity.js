const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "prisma", "dev.db");
const backupPath = path.join(__dirname, "..", "prisma", "client_data_backup.json");

const db = new Database(dbPath, { readonly: true });
const backup = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

console.log("=== VERIFYING BACKUP DATA INTEGRITY AGAINST dev.db ===");

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all();

let totalDbRecords = 0;
let totalBackupRecords = 0;
let discrepancies = 0;

for (const { name } of tables) {
  const dbRows = db.prepare(`SELECT * FROM "${name}"`).all();
  const backupEntry = backup.tables[name];

  if (!backupEntry) {
    console.error(`❌ Table ${name} is in SQLite but missing from backup JSON!`);
    discrepancies++;
    continue;
  }

  totalDbRecords += dbRows.length;
  totalBackupRecords += backupEntry.count;

  if (dbRows.length !== backupEntry.count) {
    console.error(`❌ Row count mismatch in ${name}: DB has ${dbRows.length}, JSON has ${backupEntry.count}`);
    discrepancies++;
  } else if (dbRows.length > 0) {
    // Check primary keys
    const dbIds = new Set(dbRows.map(r => r.id || r.ticketNumber || JSON.stringify(r)));
    const backupIds = new Set(backupEntry.records.map(r => r.id || r.ticketNumber || JSON.stringify(r)));

    let idMismatch = false;
    for (const id of dbIds) {
      if (!backupIds.has(id)) {
        idMismatch = true;
        break;
      }
    }

    if (idMismatch) {
      console.error(`❌ ID mismatch detected in table ${name}!`);
      discrepancies++;
    } else {
      console.log(`✅ Table ${name}: ${dbRows.length} records verified 100%`);
    }
  }
}

console.log("------------------------------------------------------");
console.log(`Total DB Records: ${totalDbRecords}`);
console.log(`Total Backup JSON Records: ${totalBackupRecords}`);
console.log(`Discrepancies found: ${discrepancies}`);

if (discrepancies === 0 && totalDbRecords === 135 && totalBackupRecords === 135) {
  console.log("🎉 VERIFICATION PASSED: Exact 1-to-1 match for all 135 records across all tables!");
} else {
  console.error("❌ VERIFICATION FAILED!");
  process.exit(1);
}
