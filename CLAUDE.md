# CLAUDE.md
Project Odoo 19 Community, jalan lokal di Windows.

## Struktur
- ./odoo-19.0/ = source Odoo asli (READ-ONLY, jangan pernah edit)
- ./custom_addons/ = semua modul custom dibuat di sini

## Commands
- Jalankan Odoo: python odoo-19.0/odoo-bin -c odoo.conf -d odoo_dev
- Update modul: python odoo-19.0/odoo-bin -c odoo.conf -d odoo_dev -u nama_modul --stop-after-init

## Aturan
- Selalu pakai ORM Odoo, jangan raw SQL
- Lihat ./odoo-19.0/addons/sale/ sebagai referensi pola kode
- Setiap model baru wajib ada security/ir.model.access.csv
- Frontend pakai OWL framework