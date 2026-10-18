import os
import sqlite3
import glob

print("=== 1. CHECKING CURRENT DB ===")
db_path = "/var/www/floreria-demo/prisma/dev.db"
if os.path.exists(db_path):
    print(f"DB exists, size: {os.path.getsize(db_path)} bytes, mtime: {os.path.getmtime(db_path)}")
    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        print(f"Total tables: {len(tables)}")
        for t in tables:
            if t.startswith("_") or t == "sqlite_sequence":
                continue
            try:
                cur.execute(f'SELECT count(*) FROM "{t}"')
                cnt = cur.fetchone()[0]
                print(f"  {t}: {cnt} rows")
            except Exception as e:
                print(f"  {t}: error {e}")
        con.close()
    except Exception as e:
        print(f"Error reading DB: {e}")
else:
    print(f"DB not found at {db_path}")

print("\n=== 2. SEARCHING FOR ALL .DB AND BACKUP FILES ON DISK ===")
candidates = []
for search_root in ["/var/www", "/home/ubuntu", "/tmp", "/var/backups", "/opt"]:
    for root, dirs, files in os.walk(search_root):
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        if ".next" in dirs:
            dirs.remove(".next")
        if ".git" in dirs:
            dirs.remove(".git")
        for f in files:
            fl = f.lower()
            if fl.endswith(".db") or fl.endswith(".sqlite") or "backup" in fl or fl.endswith(".bak") or fl.endswith(".tar.gz") or fl.endswith(".zip"):
                full = os.path.join(root, f)
                try:
                    candidates.append((full, os.path.getsize(full), os.path.getmtime(full)))
                except Exception:
                    pass

for c, sz, mt in sorted(candidates, key=lambda x: x[2], reverse=True):
    print(f"{c} | size: {sz} bytes | mtime: {mt}")

print("\n=== 3. CHECKING JOURNAL / RECENT FILES IN PRISMA DIR ===")
for p in glob.glob("/var/www/floreria-demo/prisma/*"):
    print(f"  {p} ({os.path.getsize(p)} bytes)")

