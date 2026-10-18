import sqlite3

def migrate(db_path):
    print(f"Migrating {db_path}...")
    con = sqlite3.connect(db_path)
    cur = con.cursor()

    # Check columns in ChannelConfig
    cur.execute("PRAGMA table_info(ChannelConfig)")
    cols = [r[1] for r in cur.fetchall()]
    print(f"Current columns in ChannelConfig: {cols}")

    if "environment" not in cols:
        print("Adding environment column to ChannelConfig...")
        cur.execute("ALTER TABLE ChannelConfig ADD COLUMN environment TEXT NOT NULL DEFAULT 'farfalina'")
    
    # Drop old single-column unique index if present
    cur.execute("DROP INDEX IF EXISTS ChannelConfig_channel_key")
    cur.execute("DROP INDEX IF EXISTS ChannelConfig_channel_environment_key")
    
    # Create composite unique index
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS ChannelConfig_channel_environment_key ON ChannelConfig(channel, environment)")
    
    con.commit()
    
    cur.execute("SELECT channel, environment, status FROM ChannelConfig")
    print("ChannelConfig rows:", cur.fetchall())
    
    # Also verify RawIngredient
    cur.execute("SELECT count(*) FROM RawIngredient")
    print("RawIngredient count:", cur.fetchone()[0])
    
    con.close()
    print(f"Successfully migrated {db_path}!\n")

migrate("/var/www/floreria/prisma/dev.db")