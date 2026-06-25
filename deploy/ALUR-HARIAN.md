# 🔄 Alur Harian: Local → Sandbox → Production (Isolasi Penuh)

Setup ini memisahkan kode pakai 2 branch git:

```
GitHub (origin)
 ├── branch main → PRODUKSI (:8069)  folder server: /opt/odoo/project-odoo-mtc/custom_addons
 └── branch dev  → SANDBOX  (:8070)  folder server: /opt/odoo/sandbox-tree/custom_addons
```

Aturan emas: **selalu kerja & uji di `dev`/sandbox dulu. Produksi (`main`) hanya disentuh setelah lolos uji.**

---

## ✏️ Tahap 1 — Develop di LOKAL (branch dev)
Di Git Bash / VS Code laptop:
```bash
git checkout dev            # pastikan di branch dev
# ... edit modul di custom_addons/ ...
git add custom_addons/
git commit -m "Penjelasan perubahan"
git push
```

## 🧪 Tahap 2 — Uji di SANDBOX (:8070)
Di SSH server:
```bash
cd /opt/odoo/sandbox-tree
git pull                                    # tarik perubahan branch dev
bash /opt/odoo/project-odoo-mtc/deploy/upgrade.sh odoo19-sandbox NAMA_MODUL
```
Lalu buka **http://5.223.95.218:8070** dan cek.
- ❌ Ada bug? Balik ke Tahap 1, perbaiki, ulangi. **Produksi tetap aman 100%.**
- ✅ Sudah benar? Lanjut Tahap 3.

> Kalau cuma ubah logika Python (bukan tampilan/data), boleh skip `upgrade.sh`,
> cukup: `docker restart odoo19-sandbox`.

## 🚀 Tahap 3 — Promote: gabung dev → main (LOKAL)
```bash
git checkout main
git merge dev
git push
git checkout dev            # balik ke dev untuk kerja berikutnya
```

## 🏭 Tahap 4 — Terapkan di PRODUCTION (:8069)
Di SSH server:
```bash
# 0) BACKUP DULU (pengaman) — DB + filestore jadi 1 .tar.gz
bash /opt/odoo/project-odoo-mtc/deploy/backup-server.sh production

cd /opt/odoo/project-odoo-mtc
git pull                                    # tarik perubahan branch main
bash /opt/odoo/project-odoo-mtc/deploy/upgrade.sh odoo19 NAMA_MODUL
```
Cek **http://5.223.95.218:8069** (atau https://mtc-erp.com). Selesai — kode resmi naik produksi.

> 💾 **Selalu jalankan `backup-server.sh production` sebelum upgrade produksi.** Hasilnya
> `/opt/odoo/backup_production_<tanggal>.tar.gz` — kalau perlu balik: `bash deploy/restore.sh production <file>`.

---

## Alternatif tanpa script (lewat web Odoo)
Setelah `git pull` + `docker restart <container>`:
1. Buka Odoo (sandbox/produksi) → aktifkan **mode developer**
2. **Apps → Update Apps List**
3. Cari modul → klik **Upgrade**

---

## ⚠️ Catatan penting
- **Data tidak ikut mengalir.** Pipeline ini untuk KODE. Perubahan data/konfigurasi
  lewat klik UI di sandbox tidak otomatis pindah ke produksi (database terpisah).
  Untuk menyegarkan data sandbox = produksi, lihat `deploy/sandbox/README.md` (bagian reset).
- **Modul baru (belum pernah di-install):** ganti `-u` (upgrade) jadi `-i` (install) —
  atau di `upgrade.sh` ganti sekali untuk modul baru. Cara web: Apps → Install.
- **Konflik saat merge dev → main:** kalau git minta resolusi konflik, jangan panik —
  itu tandanya `main` & `dev` mengubah baris yang sama. Selesaikan di lokal lalu push.
- **Jangan commit langsung ke `main`** untuk perubahan modul. Selalu lewat `dev` → uji → merge.
