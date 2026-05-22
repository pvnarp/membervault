#!/bin/sh
# Database backup script — creates timestamped gzip dumps
# Retention: 7 daily + 4 weekly backups
set -e

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DAY_OF_WEEK=$(date +%u)
BACKUP_FILE="${BACKUP_DIR}/membership_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting database backup..."

# Create compressed backup
pg_dump --no-owner --no-acl | gzip > "${BACKUP_FILE}"

echo "[$(date)] Backup created: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Keep weekly backups (Sunday = day 7) by copying to weekly/
if [ "${DAY_OF_WEEK}" = "7" ]; then
  mkdir -p "${BACKUP_DIR}/weekly"
  cp "${BACKUP_FILE}" "${BACKUP_DIR}/weekly/"
  echo "[$(date)] Weekly backup saved"

  # Remove weekly backups older than 28 days (keep ~4 weeks)
  find "${BACKUP_DIR}/weekly" -name "*.sql.gz" -mtime +28 -delete 2>/dev/null || true
fi

# Remove daily backups older than 7 days
find "${BACKUP_DIR}" -maxdepth 1 -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true

echo "[$(date)] Backup complete. Cleanup done."
