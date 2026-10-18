const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '../prisma/dev.db'));

const cols = db.prepare("PRAGMA table_info(ChannelConfig)").all().map(r => r.name);
if (!cols.includes("environment")) {
  db.prepare("ALTER TABLE ChannelConfig ADD COLUMN environment TEXT NOT NULL DEFAULT 'farfalina'").run();
}

db.prepare("DROP INDEX IF EXISTS ChannelConfig_channel_key").run();
db.prepare("DROP INDEX IF EXISTS ChannelConfig_channel_environment_key").run();
db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS ChannelConfig_channel_environment_key ON ChannelConfig(channel, environment)").run();

console.log('Local ChannelConfig migrated successfully.');