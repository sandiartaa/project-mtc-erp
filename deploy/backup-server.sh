#!/usr/bin/env bash
# =============================================================================
# backup-server.sh - Backup DB + filestore Odoo DI SERVER (sandbox/production).
#
# Membuat 1 file .tar.gz berisi: dump.sql + filestore/ + manifest.json
# (FORMAT SAMA dengan backup.sh lokal) -> bisa langsung dipulihkan restore.sh.
#
# PEMAKAIAN:
#   bash backup-server.sh production            # backup PRODUKSI  -> /opt/odoo/
#   bash backup-server.sh sandbox               # backup SANDBOX
#   bash backup-server.sh production /tmp       # tentukan folder output sendiri
#
# Tidak perlu mematikan Odoo: pg_dump mengambil snapshot konsisten dan
# filestore (file gambar/lampiran) disalin apa adanya. Jadi TANPA downtime.
#
# Mengembalikan nanti:  bash restore.sh <target> <file.tar.gz>
# Ambil ke laptop    :  scp root@5.223.95.218:/opt/odoo/backup_*.tar.gz .
# =============================================================================
set -euo pipefail

TARGET="${1:-}"
OUTDIR="${2:-/opt/odoo}"

case "$TARGET" in
  sandbox)
    DB_CONTAINER="odoo-postgres-sandbox"
    WEB_CONTAINER="odoo19-sandbox"
    LABEL="SANDBOX (:8070)"
    ;;
  production|produksi)
    DB_CONTAINER="odoo-postgres"
    WEB_CONTAINER="odoo19"
    LABEL="PRODUCTION (:8069)"
    ;;
  *)
    echo "Pemakaian: bash backup-server.sh <sandbox|production> [folder_output]"
    echo "Contoh   : bash backup-server.sh production"
    echo "           bash backup-server.sh sandbox /tmp"
    exit 1
    ;;
esac

DB_NAME="odoo_dev"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="${OUTDIR%/}/backup_${TARGET}_${TS}.tar.gz"

mkdir -p "$OUTDIR"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "Target  : $LABEL"
echo "  DB    : $DB_CONTAINER / database '$DB_NAME'"
echo "  Web   : $WEB_CONTAINER"
echo "  Output: $OUT"
echo ""

echo "[1/4] Dump database ..."
docker exec "$DB_CONTAINER" pg_dump -U odoo --no-owner -d "$DB_NAME" > "$STAGE/dump.sql"
echo "      dump.sql = $(du -h "$STAGE/dump.sql" | cut -f1)"

echo "[2/4] Salin filestore (gambar/lampiran) ..."
if docker exec "$WEB_CONTAINER" test -d "/var/lib/odoo/filestore/$DB_NAME"; then
  docker cp "$WEB_CONTAINER:/var/lib/odoo/filestore/$DB_NAME" "$STAGE/filestore"
else
  echo "      (filestore belum ada) - dibuat folder kosong"
  mkdir -p "$STAGE/filestore"
fi

echo "[3/4] Tulis manifest ..."
cat > "$STAGE/manifest.json" <<EOF
{"db_name": "$DB_NAME", "target": "$TARGET", "waktu": "$TS", "sumber": "backup-server.sh"}
EOF

echo "[4/4] Kompres jadi .tar.gz ..."
tar -czf "$OUT" -C "$STAGE" dump.sql filestore manifest.json

echo ""
echo "SELESAI. Backup tersimpan:"
ls -lh "$OUT"
echo ""
echo "Ambil ke laptop :  scp root@5.223.95.218:$OUT ."
echo "Pulihkan nanti  :  bash $(dirname "$0")/restore.sh $TARGET \"$OUT\""
