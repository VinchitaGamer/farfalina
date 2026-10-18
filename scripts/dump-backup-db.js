const Database = require("better-sqlite3");

const dbPath = "C:/Users/Lenovo/Desktop/Floreria_Farfalina_Sistema_Local_Completo/prisma/dev.db";
const db = new Database(dbPath, { readonly: true });

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("ALL TABLES AND ROW COUNTS IN Floreria_Farfalina_Sistema_Local_Completo:");

for (const { name } of tables) {
  if (name.startsWith("sqlite_")) continue;
  try {
    const count = db.prepare(`SELECT count(*) as c FROM "${name}"`).get().c;
    console.log(`- ${name}: ${count} rows`);
    if (count > 0) {
      const rows = db.prepare(`SELECT * FROM "${name}" LIMIT 5`).all();
      console.log(`  Sample:`, JSON.stringify(rows[0]));
    }
  } catch (e) {
    console.log(`- ${name}: ERROR: ${e.message}`);
  }
}
