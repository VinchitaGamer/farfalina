const Database = require("better-sqlite3");
const path = require("path");

function check(dbFile) {
  try {
    const db = new Database(dbFile);
    const ings = db.prepare("SELECT COUNT(*) as c FROM RawIngredient").get();
    console.log(dbFile, "=> RawIngredient count:", ings.c);
    if (ings.c > 0) {
      const sample = db.prepare("SELECT name, available, unit FROM RawIngredient LIMIT 5").all();
      console.log("Sample:", sample);
    }
  } catch(e) {
    console.log(dbFile, "=> Error:", e.message);
  }
}

check("/var/www/floreria/prisma/dev.db");
check("/var/www/floreria/prisma/dev.db.backup_safe");
check("/var/www/floreria/prisma/dev.db.backup_restored_safe");
check("/var/www/floreria/prisma/dev.db.backup_full_reconstructed");
check("/var/www/floreria/prisma/dev.db.backup_sept_orders");