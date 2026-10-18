const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '../../../prisma/dev.db');
const db = new Database(dbPath);

console.log('=== LATEST CHAT MESSAGES ===');
console.table(db.prepare("SELECT id, threadId, sender, text, environment, externalId, datetime(createdAt) as createdAt FROM ChatMessage ORDER BY createdAt DESC LIMIT 5").all());

console.log('\n=== LATEST CHAT THREADS ===');
console.table(db.prepare("SELECT id, clientName, phone, channel, status, lastMessage, environment, datetime(updatedAt) as updatedAt FROM ChatThread ORDER BY updatedAt DESC LIMIT 5").all());
