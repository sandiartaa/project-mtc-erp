#!/usr/bin/env bash
# =============================================================================
# cron-backup.sh - Dipanggil oleh cron tiap hari: backup PRODUKSI + buang yang lama.
#
# - Simpan hasil ke /opt/odoo/backups/
# - Hapus otomatis backup lebih lama dari RETENSI_HARI (default 30) agar disk aman.
#
# Pasang di cron (lihat panduan): jalan tiap 02:00 WIB.
# Uji manual:  bash deploy/cron-backup.sh
# =============================================================================
set -euo pipefail

# docker biasanya di /usr/bin; pastikan PATH lengkap saat dijalankan cron.
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="/opt/odoo/backups"
RETENSI_HARI=30

mkdir -p "$BACKUP_DIR"

echo "===== [$(date '+%F %T %Z')] mulai backup otomatis ====="
bash "$DIR/backup-server.sh" production "$BACKUP_DIR"

echo "Buang backup lebih lama dari ${RETENSI_HARI} hari ..."
find "$BACKUP_DIR" -name 'backup_production_*.tar.gz' -mtime +"$RETENSI_HARI" -print -delete || true

JML=$(find "$BACKUP_DIR" -name 'backup_production_*.tar.gz' | wc -l)
echo "Selesai. Total backup tersimpan: $JML file."
echo ""
