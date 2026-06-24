#!/usr/bin/env bash
# =============================================================================
# upgrade.sh - Upgrade satu modul di dalam container Odoo lalu restart.
#
# Dipakai di SERVER untuk menerapkan perubahan kode modul (XML/view/data/Python).
#
# Pemakaian:
#   bash upgrade.sh <container> <nama_modul>
#
# Contoh:
#   bash upgrade.sh odoo19-sandbox custom_spk     # uji di sandbox (:8070)
#   bash upgrade.sh odoo19 custom_spk             # terapkan di produksi (:8069)
# =============================================================================
set -euo pipefail

CONTAINER="${1:?Pemakaian: bash upgrade.sh <container> <nama_modul>}"
MODULE="${2:?Pemakaian: bash upgrade.sh <container> <nama_modul>}"

echo "[1/2] Upgrade modul '$MODULE' di container '$CONTAINER' ..."
docker exec "$CONTAINER" python3 odoo-bin -u "$MODULE" -d odoo_dev --stop-after-init \
  --db_host=postgres --db_user=odoo --db_password=odoo \
  --data-dir=/var/lib/odoo \
  --addons-path=/opt/odoo/odoo/addons,/opt/odoo/custom_addons

echo "[2/2] Restart '$CONTAINER' ..."
docker restart "$CONTAINER"

echo "Selesai: '$MODULE' di-upgrade & '$CONTAINER' di-restart."
