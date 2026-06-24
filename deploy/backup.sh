#!/usr/bin/env bash
# =============================================================================
# backup.sh - Buat backup database Odoo lokal (dump SQL + filestore).
#
# Otomatis menambal sintaks PostgreSQL 18 ("NOT NULL <kolom>") agar hasil dump
# bisa di-restore ke server yang masih PostgreSQL 16. Hasil akhir berupa satu
# file .tar.gz berisi: dump.sql + filestore/ + manifest.json
#
# CARA PAKAI (lewat Git Bash):
#   bash deploy/backup.sh
#
# Hasil tersimpan di Desktop, lalu kirim ke server:
#   scp "<file>.tar.gz" root@5.223.95.218:/tmp/
# =============================================================================
set -euo pipefail

# ===== Konfigurasi (sesuaikan bila ada yang berubah) =========================
DB_NAME="odoo_dev"
DB_USER="odoo_user"
DB_PASS="odoo123"
DB_HOST="localhost"
DB_PORT="5432"
PG_BIN="/c/Program Files/PostgreSQL/18/bin"
FILESTORE="/c/Users/USER/AppData/Local/OpenERP S.A/Odoo/filestore/$DB_NAME"
OUT_DIR="$HOME/Desktop"
# =============================================================================

STAMP=$(date +%Y%m%d_%H%M%S)
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

echo "[1/4] Dump database '$DB_NAME' ..."
PGPASSWORD="$DB_PASS" "$PG_BIN/pg_dump" --no-owner \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -f "$STAGE/dump.sql"

echo "[2/4] Tambal sintaks PG18 NOT NULL (kompatibel PG16) ..."
sed -i -E '/^[[:space:]]*(CONSTRAINT [A-Za-z0-9_]+ )?NOT NULL "?[A-Za-z0-9_]+"?,?[[:space:]]*$/d' "$STAGE/dump.sql"

echo "[3/4] Salin filestore ..."
if [ -d "$FILESTORE" ]; then
  cp -r "$FILESTORE" "$STAGE/filestore"
  echo "      $(find "$STAGE/filestore" -type f | wc -l) file disalin."
else
  echo "      (filestore tidak ditemukan di '$FILESTORE' - dilewati)"
  mkdir -p "$STAGE/filestore"
fi

cat > "$STAGE/manifest.json" <<EOF
{"odoo_dump": "1", "db_name": "$DB_NAME", "version": "19.0", "version_info": [19, 0, 0, "final", 0, ""], "major_version": "19.0", "pg_version": "16.0"}
EOF

echo "[4/4] Kompres jadi arsip ..."
mkdir -p "$OUT_DIR"
OUT="$OUT_DIR/${DB_NAME}_${STAMP}.tar.gz"
tar -czf "$OUT" -C "$STAGE" dump.sql filestore manifest.json

echo ""
echo "SELESAI. File backup:"
echo "  $OUT"
echo ""
echo "Kirim ke server (jalankan dari cmd/PowerShell di folder Desktop):"
echo "  scp ${DB_NAME}_${STAMP}.tar.gz root@5.223.95.218:/tmp/"
