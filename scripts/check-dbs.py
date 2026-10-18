import sqlite3
import glob

for path in sorted(glob.glob("/var/www/floreria/prisma/dev.db*")):
    try:
        con = sqlite3.connect(path)
        cur = con.cursor()
        cur.execute("SELECT count(*) FROM RawIngredient")
        count = cur.fetchone()[0]
        cur.execute("SELECT name, available, unit FROM RawIngredient LIMIT 3")
        samples = cur.fetchall()
        print(f"{path} => RawIngredient: {count} items. Samples: {samples}")
    except Exception as e:
        print(f"{path} => Error: {e}")