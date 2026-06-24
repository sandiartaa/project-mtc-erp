#!/usr/bin/env bash
# =============================================================================
# restore.sh - Restore backup Odoo ke SANDBOX atau PRODUCTION (di server).
#
# Menerima file .tar.gz hasil backup.sh (dump.sql + filestore/ + manifest.json),
# lalu: matikan Odoo -> buat ulang database -> import data -> pasang filestore ->
# nyalakan Odoo lagi. Pada container target yang dipilih.
#
# PEMAKAIAN:
#   bash restore.sh sandbox    <file.tar.gz>   # ke SANDBOX (:8070) - aman untuk uji
#   bash restore.sh production <file.tar.gz>   # ke PRODUKSI (:8069) - minta konfirmasi
#
# ALUR AMAN yang disarankan:
#   1) restore ke sandbox dulu  -> cek di :8070
#   2) kalau OK, baru restore ke production
#
# PERINGATAN: target 'production' MENIMPA seluruh data produksi yang sedang dipakai.
# =============================================================================
set -euo pipefail

TARGET="${1:-}"
ARCHIVE="${2:-}"

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
    echo "Pemakaian: bash restore.sh <sandbox|production> <file.tar.gz>"
    echo "Contoh   : bash restore.sh sandbox /tmp/odoo_dev_20260624_120000.tar.gz"
    exit 1
    ;;
esac

DB_NAME="odoo_dev"

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "ERROR: file backup tidak ditemukan: '$ARCHIVE'"
  exit 1
fi

echo "Target  : $LABEL"
echo "  DB    : $DB_CONTAINER / database '$DB_NAME'"
echo "  Web   : $WEB_CONTAINER"
echo "  File  : $ARCHIVE"
echo ""

# --- Pengaman khusus PRODUCTION: wajib ketik YA ---
if [ "$WEB_CONTAINER" = "odoo19" ]; then
  echo "!!! PERINGATAN: ini MENIMPA seluruh data PRODUKSI yang sedang dipakai. !!!"
  echo "    Data produksi saat ini akan HILANG dan diganti isi backup."
  read -r -p "    Ketik persis 'YA' untuk lanjut (selain itu batal): " CONFIRM
  if [ "$CONFIRM" != "YA" ]; then
    echo "Dibatalkan."
    exit 1
  fi
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "[1/6] Ekstrak arsip ..."
tar -xzf "$ARCHIVE" -C "$WORK"
[ -f "$WORK/dump.sql" ] || { echo "ERROR: dump.sql tidak ada di arsip."; exit 1; }

echo "[2/6] Matikan Odoo ($WEB_CONTAINER) ..."
docker stop "$WEB_CONTAINER" >/dev/null

echo "[3/6] Buat ulang database '$DB_NAME' ..."
docker exec -i "$DB_CONTAINER" dropdb -U odoo --if-exists "$DB_NAME"
docker exec -i "$DB_CONTAINER" createdb -U odoo -O odoo "$DB_NAME"

echo "[4/6] Import data (ERROR penting akan ditampilkan) ..."
cat "$WORK/dump.sql" | docker exec -i "$DB_CONTAINER" psql -q -U odoo -d "$DB_NAME" \
  2>&1 | grep -i "error" | grep -v "transaction_timeout" || echo "      (tidak ada error berarti)"

echo "[5/6] Pasang filestore ..."
docker start "$WEB_CONTAINER" >/dev/null
docker exec -u root "$WEB_CONTAINER" rm -rf "/var/lib/odoo/filestore/$DB_NAME"
docker exec -u root "$WEB_CONTAINER" mkdir -p /var/lib/odoo/filestore
docker cp "$WORK/filestore" "$WEB_CONTAINER:/var/lib/odoo/filestore/$DB_NAME"

echo "[6/6] Restart Odoo ..."
docker restart "$WEB_CONTAINER" >/dev/null

echo ""
echo "SELESAI. Restore ke $LABEL beres."
echo "Pantau log: docker logs -f --tail=50 $WEB_CONTAINER"
