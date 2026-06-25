# deploy/ — Alat Deployment Project Odoo ke Server

Folder ini berisi script & panduan untuk mengirim/meng-update project Odoo ke server Docker.
**Bukan modul Odoo** — hanya alat deployment.

- Server: `root@5.223.95.218` · Repo GitHub: `sandiartaa/project-mtc-erp`
- **PRODUKSI**: `:8069` · container `odoo19` · branch `main`
- **SANDBOX** : `:8070` · container `odoo19-sandbox` · branch `dev`

> Catatan: hanya **nama repo GitHub** yang di-rename jadi `project-mtc-erp`.
> **Folder server tetap** `/opt/odoo/project-odoo-mtc` (tidak diubah).

## 📚 Dokumen
| File | Isi |
|------|-----|
| `PANDUAN-DEPLOY.md` | Panduan lengkap + daftar error & solusinya |
| `ALUR-HARIAN.md` | Alur update **kode** harian: local → sandbox → production |
| `sandbox/README.md` | Cara pakai, reset, & hapus sandbox |

## 🧰 Script
| Script | Fungsi | Dijalankan di |
|--------|--------|---------------|
| `backup.sh` | Backup database lokal (dump + filestore, auto-tambal PG18→16) | Lokal (Git Bash) |
| `backup-server.sh` | Backup DB + filestore di server (sandbox/produksi) → `.tar.gz` siap restore | Server |
| `cron-backup.sh` | Backup produksi otomatis (dipanggil cron) + hapus backup > 7 hari | Server (cron) |
| `restore.sh` | Restore backup ke **sandbox** / **produksi** | Server |
| `upgrade.sh` | Upgrade 1 modul di container lalu restart | Server |

## Ada 2 jenis pekerjaan

### A. Update KODE / modul (paling sering) → baca `ALUR-HARIAN.md`
Ringkas: lokal (branch `dev`) → uji sandbox (`:8070`) → merge ke `main` → produksi (`:8069`).
```bash
# Lokal
git checkout dev   # edit modul, lalu:
git add custom_addons/ && git commit -m "..." && git push
# Server: uji sandbox
cd /opt/odoo/sandbox-tree && git pull
bash /opt/odoo/project-odoo-mtc/deploy/upgrade.sh odoo19-sandbox NAMA_MODUL
# Lokal: promote
git checkout main && git merge dev && git push && git checkout dev
# Server: produksi
cd /opt/odoo/project-odoo-mtc && git pull
bash /opt/odoo/project-odoo-mtc/deploy/upgrade.sh odoo19 NAMA_MODUL
```

### B. Kirim DATA (database) dari lokal → baca `PANDUAN-DEPLOY.md` Bagian 1
```bash
# Lokal
bash deploy/backup.sh
scp odoo_dev_<tanggal>.tar.gz root@5.223.95.218:/tmp/
# Server: uji sandbox dulu, baru produksi
cd /opt/odoo/project-odoo-mtc
bash deploy/restore.sh sandbox    /tmp/odoo_dev_<tanggal>.tar.gz
bash deploy/restore.sh production /tmp/odoo_dev_<tanggal>.tar.gz   # minta ketik 'YA'
```
> ⚠️ `restore.sh production` **menimpa** seluruh data produksi. Data asli sekarang ada di
> produksi (dipakai harian), jadi pakai ini hanya kalau lokal memang sumber data yang benar.

## Catatan teknis
- Lokal PostgreSQL **18**, server **16** → dump PG18 pakai sintaks `NOT NULL` yang tak dikenal
  PG16; `backup.sh` otomatis menambalnya.
- `.gitignore` mengabaikan folder `lib/`, jadi `phone_validation/lib` hilang di server.
  Diperbaiki permanen lewat bind-mount (`deploy/odoo-libs/`) di compose produksi & sandbox.
- Kode produksi & sandbox **terpisah penuh** (folder + branch beda) lewat `git worktree`
  di `/opt/odoo/sandbox-tree` (branch `dev`).
