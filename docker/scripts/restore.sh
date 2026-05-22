#!/bin/sh
# Database restore script — restores from a gzip backup file
# Usage: ./restore.sh /backups/membership_20260402_020000.sql.gz
set -e

BACKUP_FILE="${1}"

if [ -z "${BACKUP_FILE}" ]; then
  echo "Usage: restore.sh <backup-file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lht /backups/*.sql.gz 2>/dev/null || echo "  No backups found"
  echo ""
  echo "Weekly backups:"
  ls -lht /backups/weekly/*.sql.gz 2>/dev/null || echo "  No weekly backups found"
  exit 1
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "Error: Backup file not found: ${BACKUP_FILE}"
  exit 1
fi

echo "WARNING: This will drop and recreate the database."
echo "Restoring from: ${BACKUP_FILE}"
echo "Press Ctrl+C within 5 seconds to cancel..."
sleep 5

echo "[$(date)] Dropping existing database..."
dropdb --if-exists "${PGDATABASE}"
createdb "${PGDATABASE}"

echo "[$(date)] Restoring from backup..."
gunzip -c "${BACKUP_FILE}" | psql --quiet

echo "[$(date)] Restore complete."
