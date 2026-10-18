import sqlite3

backup_con = sqlite3.connect("/var/www/floreria/prisma/dev.db.backup_safe")
b_cur = backup_con.cursor()
b_cur.execute("SELECT id, name, type, available, unit, warningThreshold, costPerUnit, entryDate, shelfLifeDays, createdAt, updatedAt FROM RawIngredient")
rows = b_cur.fetchall()
print(f"Found {len(rows)} raw ingredients in backup.")

main_con = sqlite3.connect("/var/www/floreria/prisma/dev.db")
m_cur = main_con.cursor()
m_cur.execute("DELETE FROM RawIngredient")
m_cur.executemany("""
    INSERT INTO RawIngredient (id, name, type, available, unit, warningThreshold, costPerUnit, entryDate, shelfLifeDays, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
""", rows)
main_con.commit()

m_cur.execute("SELECT count(*) FROM RawIngredient")
count = m_cur.fetchone()[0]
print(f"Successfully restored {count} ingredients in active database!")

main_con.close()
backup_con.close()