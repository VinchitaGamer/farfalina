import sqlite3

con = sqlite3.connect("/var/www/floreria/prisma/dev.db")
cur = con.cursor()

rows = cur.execute("SELECT id, threadId, sender, text, mediaUrl, mediaType, createdAt FROM ChatMessage WHERE text LIKE '%no se pudo descargar%' OR text LIKE '%Archivo adjunto%' OR mediaUrl IS NOT NULL ORDER BY createdAt DESC").fetchall()

print(f"Total mensajes con media o texto de adjunto: {len(rows)}")
for r in rows[:15]:
    print(f"ID: {r[0]} | Sender: {r[2]} | MediaUrl: {r[4]} | MediaType: {r[5]} | Text: {r[3][:40]} | Date: {r[6]}")

con.close()
