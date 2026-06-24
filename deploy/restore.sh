#!/usr/bin/env bash
# =============================================================================
# restore.sh - Restore backup Odoo ke dalam container Docker di server.
#
# Menerima file .tar.gz hasil backup.sh (berisi dump.sql + filestore/ +
# manifest.json), lalu: matikan Odoo -> buat ulang database -> import data ->
# pasang filestore -> nyalakan Odoo lagi.
#
# CARA PAKAI (di server, setelah file di-upload ke /tmp):
#   bash restore.sh /tmp/odoo_dev_20260624_120000.tar.gz
#
# PERINGATAN: ini MENIMPA seluruh database '$DB_NAME' di server.
# Data yang sudah ada di server akan hilang dan diganti isi backup.
# =============================================================================
set -euo pipefail

# ===== Konfigurasi (sesuaikan bila nama container berubah) ===================
DB_CONTAINER="odoo-postgres"
WEB_CONTAINER="odoo19"
PGUSER="odoo"
DB_NAME="odoo_dev"
# =============================================================================

ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Pemakaian: bash restore.sh <file-backup.tar.gz>"
  echo "Contoh   : bash restore.sh /tmp/odoo_dev_20260624_120000.tar.gz"
  exit 1
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "[1/6] Ekstrak arsip ..."
tar -xzf "$ARCHIVE" -C "$WORK"
[ -f "$WORK/dump.sql" ] || { echo "ERROR: dump.sql tidak ada di arsip."; exit 1; }

echo "[2/6] Matikan Odoo (lepas koneksi ke database) ..."
docker stop "$WEB_CONTAINER" >/dev/null

echo "[3/6] Buat ulang database '$DB_NAME' ..."
docker exec -i "$DB_CONTAINER" dropdb -U "$PGUSER" --if-exists "$DB_NAME"
docker exec -i "$DB_CONTAINER" createdb -U "$PGUSER" -O "$PGUSER" "$DB_NAME"

echo "[4/6] Import data (ERROR yang muncul akan ditampilkan) ..."
cat "$WORK/dump.sql" | docker exec -i "$DB_CONTAINER" psql -q -U "$PGUSER" -d "$DB_NAME" \
  2>&1 | grep -i "error" | grep -v "transaction_timeout" || echo "      (tidak ada error berarti)"

echo "[5/6] Pasang filestore ..."
docker start "$WEB_CONTAINER" >/dev/null
docker exec -u root "$WEB_CONTAINER" rm -rf "/var/lib/odoo/filestore/$DB_NAME"
docker exec -u root "$WEB_CONTAINER" mkdir -p /var/lib/odoo/filestore
docker cp "$WORK/filestore" "$WEB_CONTAINER:/var/lib/odoo/filestore/$DB_NAME"

echo "[6/6] Restart Odoo ..."
docker restart "$WEB_CONTAINER" >/dev/null

echo ""
echo "SELESAI. Cek di browser:  http://<IP-server>:8069"
echo "Pantau log:  docker logs -f --tail=50 $WEB_CONTAINER"
