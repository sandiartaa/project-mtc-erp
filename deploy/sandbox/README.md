# Sandbox Odoo — Cara Pakai

Lingkungan uji coba terpisah dari produksi. Bebas dipakai coba-coba; tidak menyentuh data produksi.

| | Produksi | Sandbox |
|---|---|---|
| Akses | http://5.223.95.218:**8069** | http://5.223.95.218:**8070** |
| Container Odoo | `odoo19` | `odoo19-sandbox` |
| Container DB | `odoo-postgres` | `odoo-postgres-sandbox` |
| Folder kode (custom_addons) | `project-odoo-mtc/custom_addons` | `sandbox-tree/custom_addons` |
| Branch git | `main` | `dev` |
| Folder data/filestore | `odoo-data/` | `odoo-data-sandbox/` |
| Project Docker | (default) | `odoo-sandbox` |

Semua perintah dijalankan di server: `cd /opt/odoo/project-odoo-mtc/deploy/sandbox`

## Nyalakan / matikan sandbox
```bash
# nyalakan
docker compose -p odoo-sandbox up -d

# matikan (container berhenti, DATA TETAP ADA)
docker compose -p odoo-sandbox stop

# matikan & hapus container + network (DATA di volume TETAP ADA)
docker compose -p odoo-sandbox down
```

## Restart cepat (mis. setelah ubah modul)
```bash
docker restart odoo19-sandbox
docker logs -f --tail=50 odoo19-sandbox    # Ctrl+C untuk berhenti lihat log
```

## Reset / segarkan sandbox = salin ulang dari produksi
Pakai ini kalau mau sandbox kembali sama seperti produksi terkini:
```bash
docker stop odoo19-sandbox
docker exec odoo-postgres pg_dump -U odoo --no-owner -d odoo_dev > /tmp/prod_copy.sql
docker exec -i odoo-postgres-sandbox dropdb -U odoo --if-exists odoo_dev
docker exec -i odoo-postgres-sandbox createdb -U odoo -O odoo odoo_dev
cat /tmp/prod_copy.sql | docker exec -i odoo-postgres-sandbox psql -q -U odoo -d odoo_dev
rm -rf /opt/odoo/project-odoo-mtc/odoo-data-sandbox/filestore/odoo_dev
cp -r /opt/odoo/project-odoo-mtc/odoo-data/filestore/odoo_dev \
      /opt/odoo/project-odoo-mtc/odoo-data-sandbox/filestore/odoo_dev
docker start odoo19-sandbox
```
> Produksi & sandbox sama-sama PostgreSQL 16, jadi penyalinan bersih tanpa tambalan.

## Hapus sandbox sepenuhnya (kalau tak terpakai)
```bash
docker compose -p odoo-sandbox down -v        # -v ikut hapus volume database sandbox
rm -rf /opt/odoo/project-odoo-mtc/odoo-data-sandbox
```
Produksi tidak terpengaruh sama sekali.

## Catatan penting
- Sandbox & produksi punya **`custom_addons` TERPISAH** (sandbox baca branch `dev` dari
  `/opt/odoo/sandbox-tree`, produksi baca branch `main`). Jadi **kode, database, dan
  filestore semuanya terpisah penuh** — uji apa pun di sandbox tidak menyentuh produksi.
  Alur update kode: lihat **`deploy/ALUR-HARIAN.md`**.
- Untuk **mengisi data sandbox dari file backup lokal**, bisa juga:
  `bash /opt/odoo/project-odoo-mtc/deploy/restore.sh sandbox <file.tar.gz>`
- Folder `lib` (`phone_validation`) dipasang permanen via bind-mount di compose sandbox,
  jadi tidak akan crash lagi walau container dibuat ulang.
