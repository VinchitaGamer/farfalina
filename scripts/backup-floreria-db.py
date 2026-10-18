#!/usr/bin/env python3
"""
Automated ACID-compliant online backup for Florería Farfalina & Carissma SQLite Database.
Uses python's built-in sqlite3.Connection.backup() to ensure point-in-time consistency
without locking the production database.
"""
import sqlite3
import datetime
import os
import glob
import sys

SRC = "/var/www/floreria-demo/prisma/dev.db"
BACKUP_DIR = "/var/backups/floreria"

def run_backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)

    if not os.path.exists(SRC):
        print(f"[{datetime.datetime.now()}] ERROR: Source database {SRC} not found.", file=sys.stderr)
        sys.exit(1)

    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    dst_file = os.path.join(BACKUP_DIR, f"dev_{timestamp}.db")

    try:
        src_conn = sqlite3.connect(SRC)
        dst_conn = sqlite3.connect(dst_file)
        with dst_conn:
            src_conn.backup(dst_conn, pages=100, sleep=0.01)
        dst_conn.close()
        src_conn.close()
        size_kb = os.path.getsize(dst_file) / 1024
        print(f"[{datetime.datetime.now()}] ✅ Backup created: {dst_file} ({size_kb:.1f} KB)")

        # Retention policy: Keep the last 30 backups (~7 to 15 days depending on frequency)
        all_backups = sorted(glob.glob(os.path.join(BACKUP_DIR, "dev_*.db")))
        MAX_BACKUPS = 30
        if len(all_backups) > MAX_BACKUPS:
            to_remove = all_backups[:-MAX_BACKUPS]
            for old_path in to_remove:
                try:
                    os.remove(old_path)
                    print(f"[{datetime.datetime.now()}] 🗑️ Rotated old backup: {os.path.basename(old_path)}")
                except Exception as e:
                    print(f"Warning removing {old_path}: {e}", file=sys.stderr)

    except Exception as err:
        print(f"[{datetime.datetime.now()}] ❌ Backup failed: {err}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    run_backup()
