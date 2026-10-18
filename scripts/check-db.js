const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '../prisma/dev.db'));
console.log('Tables:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables.map(t => t.name));
for (const t of tables) {
  if (t.name.startsWith('_') || t.name === 'sqlite_sequence') continue;
  try {
    const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
    console.log(`${t.name}: ${count.c} rows`);
  } catch(e) {
    console.log(`${t.name}: error ${e.message}`);
  }
}