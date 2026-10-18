import sqlite3

con = sqlite3.connect("/var/www/floreria/prisma/dev.db")
cur = con.cursor()
cur.execute("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='ChannelConfig'")
print("Existing indexes on ChannelConfig:")
for row in cur.fetchall():
    print(" ", row)

con.close()