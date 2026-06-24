# 📘 Panduan Lengkap: Kirim Project Odoo ke Server

Dokumen ini menjelaskan **langkah demi langkah** cara memindahkan/meng-update
project Odoo dari komputer lokal (Windows) ke server, ditulis sesederhana mungkin.
Di bagian akhir ada **daftar error yang sering muncul + cara mengatasinya**.

> 💡 Cukup ikuti dari atas ke bawah. Setiap perintah tinggal copy-paste.

---

## 🗺️ Peta Singkat (kenali dulu "pemain"-nya)

| Istilah | Penjelasan sederhana | Nilai di project ini |
|---|---|---|
| **Komputer lokal** | Laptop/PC Windows tempat kamu develop | Windows, PostgreSQL **18** |
| **Server** | Komputer awan tempat Odoo dipakai online | `root@5.223.95.218` |
| **Repo GitHub** | Sumber kode bersama | `sandiartaa/project-mtc-erp` |
| **PRODUKSI** | Odoo yang dipakai resmi/online | `:8069` · container `odoo19` · branch `main` |
| **SANDBOX** | Odoo untuk uji coba (terpisah) | `:8070` · container `odoo19-sandbox` · branch `dev` |
| **Container Database** | "Kotak" berisi PostgreSQL di server | `odoo-postgres` (produksi) & `odoo-postgres-sandbox` (PostgreSQL **16**) |
| **Database** | Tempat semua data tersimpan | `odoo_dev` (terpisah antara produksi & sandbox) |
| **Filestore** | Tempat file/gambar/lampiran tersimpan | folder terpisah dari database |
| **User database** | Login ke PostgreSQL | `odoo` / `odoo` |

**Hal penting yang harus diingat:**
- Lokal pakai PostgreSQL **18**, server pakai PostgreSQL **16** → ada beda kecil yang
  bikin error kalau tidak ditambal. Tapi tenang, **script `backup.sh` sudah otomatis menambalnya.**
- Backup yang benar = **database + filestore** (kalau cuma database, gambar/lampiran hilang).
- **Dua branch:** `main` = kode PRODUKSI, `dev` = kode SANDBOX. Develop & uji selalu di
  `dev`/sandbox dulu, baru promote ke `main`/produksi. Alur lengkapnya: **`deploy/ALUR-HARIAN.md`**.
- Folder kode di server: produksi `/opt/odoo/project-odoo-mtc/custom_addons`,
  sandbox `/opt/odoo/sandbox-tree/custom_addons` (terpisah, lewat git worktree).

---

## 🧰 Yang Harus Disiapkan Sekali Saja

1. **Git Bash** di Windows (untuk menjalankan `backup.sh`). Biasanya sudah ada bila pakai Git.
2. Bisa **SSH ke server** (`ssh root@5.223.95.218` + password).
3. Di server sudah ada perintah `unzip`/`tar` (kalau belum: `apt install -y unzip`).

---

# BAGIAN 1 — Kirim DATABASE dari Lokal ke Server

Pakai ini saat kamu mau mengirim **seluruh data** dari lokal ke server.

> ⚠️ **PENTING — arah data:** sekarang data asli ada di **PRODUKSI** (dipakai harian).
> Restore dari lokal akan **MENIMPA** data tujuan. Maka:
> - **Uji ke SANDBOX dulu** (`:8070`) — aman, tidak menyentuh produksi.
> - Ke **PRODUKSI** (`:8069`) **hanya** kalau yakin lokal memang sumber data yang benar.
>   `restore.sh` akan minta ketik **`YA`** dulu sebelum menimpa produksi.
>
> Kalau yang berubah cuma **kode/modul** (bukan data), JANGAN pakai Bagian 1 —
> pakai **Bagian 2**.

### Langkah 1 — Buat backup di lokal
Buka **Git Bash** di folder project, lalu ketik:
```bash
bash deploy/backup.sh
```
Hasilnya: muncul file seperti `odoo_dev_20260624_120000.tar.gz` **di Desktop**.
File ini sudah otomatis ditambal agar cocok dengan PostgreSQL 16 di server.

### Langkah 2 — Upload ke server
Buka **Command Prompt (cmd)** atau **PowerShell**, masuk ke Desktop:
```
cd %USERPROFILE%\Desktop
scp odoo_dev_20260624_120000.tar.gz root@5.223.95.218:/tmp/
```
Ketik password root saat diminta. (Ganti nama file sesuai hasil Langkah 1.)

### Langkah 3 — Restore di server (SANDBOX dulu)
Masuk ke server:
```bash
ssh root@5.223.95.218
cd /opt/odoo/project-odoo-mtc
```
Restore ke **sandbox** dulu untuk uji:
```bash
bash deploy/restore.sh sandbox /tmp/odoo_dev_20260624_120000.tar.gz
```
Script otomatis: matikan Odoo → buat ulang database → import data → pasang filestore → nyalakan Odoo.
Lalu cek di browser: **http://5.223.95.218:8070**

### Langkah 4 — Kalau sandbox sudah benar, baru ke PRODUKSI
```bash
bash deploy/restore.sh production /tmp/odoo_dev_20260624_120000.tar.gz
```
Akan muncul peringatan — ketik **`YA`** untuk lanjut (selain itu otomatis batal).
Lalu cek di browser: **http://5.223.95.218:8069** (login dengan user/password seperti lokal).

> **Catatan:** `restore.sh` ada di server setelah `git pull` (sudah masuk folder `deploy/`).

### (Opsional) Pantau log kalau ragu
```bash
docker logs -f --tail=50 odoo19-sandbox     # untuk sandbox
docker logs -f --tail=50 odoo19             # untuk produksi
```
Tunggu sampai muncul `Modules loaded` dan `HTTP service (werkzeug) running`.
Tekan **Ctrl+C** untuk berhenti melihat log (Odoo tetap jalan).

---

# BAGIAN 2 — UPDATE Kode / Modul (Local → Sandbox → Production)

Ini cara **sehari-hari** untuk mengubah/menambah modul. **Tidak menyentuh data.**
Sekarang pakai **isolasi penuh**: uji di sandbox (`dev`) dulu, baru naik produksi (`main`).

> 📖 Panduan rinci ada di **`deploy/ALUR-HARIAN.md`**. Ringkasannya di bawah.

### Ringkas: 4 tahap
```
1. LOKAL (branch dev):   edit → git add → git commit → git push
2. SANDBOX (:8070):      cd /opt/odoo/sandbox-tree && git pull
                         bash /opt/odoo/project-odoo-mtc/deploy/upgrade.sh odoo19-sandbox NAMA_MODUL
                         → cek http://5.223.95.218:8070
3. PROMOTE (lokal):      git checkout main && git merge dev && git push && git checkout dev
4. PRODUKSI (:8069):     cd /opt/odoo/project-odoo-mtc && git pull
                         bash /opt/odoo/project-odoo-mtc/deploy/upgrade.sh odoo19 NAMA_MODUL
                         → cek http://5.223.95.218:8069
```

> - Modul BARU (belum pernah di-install): di `upgrade.sh` ganti `-u` jadi `-i`, atau lewat
>   web **Apps → Install**.
> - Cuma ubah logika Python: cukup `docker restart <container>` (tanpa upgrade).
> - Ubah JS/CSS: setelah restart, **hard refresh** browser (Ctrl + Shift + R).
> - **Penting:** kode di sandbox & produksi sekarang BENAR-BENAR terpisah (folder & branch
>   beda), jadi produksi aman selama kamu belum promote ke `main`.

---

# BAGIAN 3 — Ringkasan Kapan Pakai yang Mana

| Situasi | Pakai | Menyentuh database? |
|---|---|---|
| Ubah/tambah modul (alur normal) | **Bagian 2** (dev → uji → main) | ❌ Tidak |
| Mau samakan seluruh data server dengan lokal | **Bagian 1** (backup + restore) | ✅ Ya (menimpa) |
| Mau samakan data sandbox = produksi | `deploy/sandbox/README.md` (bagian reset) | ✅ Ya (hanya sandbox) |
| Cuma ubah tampilan (CSS/JS) | **Bagian 2** + hard refresh | ❌ Tidak |

**Aturan emas:** kalau ragu, **jangan** pakai Bagian 1 (restore) — karena itu menimpa data.
Untuk perubahan kode, selalu lewat **Bagian 2** (uji di sandbox dulu).

---

---

# 🛟 CATATAN: Daftar Error yang Sering Muncul & Solusinya

Berikut error-error nyata yang mungkin kamu temui beserta artinya dan cara mengatasi.
Cari yang mirip dengan pesan di layar kamu.

### ❌ 1. `ssh: Could not resolve hostname $env: No such host is known`
**Artinya:** kamu menjalankan perintah PowerShell (`$env:...`) di **Command Prompt (cmd)**.
**Solusi:** kalau sudah berada di folder Desktop, cukup pakai nama file langsung:
```
scp odoo_dev_xxx.tar.gz root@5.223.95.218:/tmp/
```

---

### ❌ 2. `scp: C:: Name or service not known` (atau menganggap `C:` sebagai host)
**Artinya:** `scp` salah mengira `C:` adalah nama server.
**Solusi:** pindah dulu ke folder file-nya, baru kirim pakai nama file saja:
```
cd %USERPROFILE%\Desktop
scp namafile.tar.gz root@5.223.95.218:/tmp/
```

---

### ❌ 3. `Command 'unzip' not found`
**Artinya:** server belum punya alat `unzip`.
**Solusi:**
```bash
apt install -y unzip
```
(Tapi kalau pakai `backup.sh`/`restore.sh`, formatnya `.tar.gz` yang dibuka pakai
`tar` — biasanya `tar` sudah ada, jadi error ini tidak muncul.)

---

### ❌ 4. `database "odoo_dev" is being accessed by other users`
**Artinya:** Odoo masih nyambung ke database, jadi tidak bisa dihapus/dibuat ulang.
**Solusi:** matikan Odoo dulu, baru ulangi:
```bash
docker stop odoo19
# ... lakukan dropdb / createdb ...
docker start odoo19
```
(`restore.sh` sudah otomatis melakukan ini.)

---

### ❌ 5. Banyak `ERROR: relation "public.ir_act_window" does not exist` saat import
**Artinya:** ada beberapa tabel gagal dibuat di awal, jadi semua yang bergantung ikut gagal.
Biasanya akarnya: **beda versi PostgreSQL 18 → 16** (sintaks `NOT NULL` model baru).
**Solusi:** pastikan dump sudah ditambal. Kalau pakai `backup.sh`, ini **otomatis**.
Kalau dump dibuat manual, jalankan tambalan ini sebelum import:
```bash
sed -i -E '/^[[:space:]]*(CONSTRAINT [A-Za-z0-9_]+ )?NOT NULL "?[A-Za-z0-9_]+"?,?[[:space:]]*$/d' dump.sql
```

---

### ❌ 6. `ERROR: unrecognized configuration parameter "transaction_timeout"`
**Artinya:** ini **tidak berbahaya** — cuma satu pengaturan PG18 yang tidak dikenal PG16.
**Solusi:** abaikan. Import tetap jalan normal.

---

### ❌ 7. `CRITICAL ... Couldn't load module phone_validation` /
`ImportError: cannot import name 'lib' ...`
**Artinya:** modul `phone_validation` kehilangan folder `lib` di server (karena `.gitignore`
mengabaikan semua folder bernama `lib`).
**Solusi:** pasang folder `lib`-nya ke container:
```bash
# upload dulu dari lokal: scp missing-lib.tar.gz root@5.223.95.218:/tmp/
cd /tmp && tar -xzf missing-lib.tar.gz
docker cp /tmp/phone_validation/lib odoo19:/opt/odoo/addons/phone_validation/lib
docker restart odoo19
```
> Cara membuat `missing-lib.tar.gz` di lokal (Git Bash):
> ```bash
> cd odoo-19.0/addons
> tar -czf ~/Desktop/missing-lib.tar.gz phone_validation/lib l10n_tr_nilvera/lib
> ```

---

### ❌ 8. `chown: invalid user: 'odoo:odoo'`
**Artinya:** di dalam container tidak ada user bernama `odoo` (container jalan sebagai `root`).
**Solusi:** **abaikan** — karena jalan sebagai root, file yang di-copy sudah otomatis
milik root dan bisa dibaca. Tidak perlu `chown`.

---

### ❌ 9. "Access Denied" saat restore lewat Database Manager Odoo (web)
**Artinya:** master password / izin database manager di server dibatasi.
**Solusi:** jangan pakai cara web. Gunakan **Bagian 1** (restore lewat SSH / `restore.sh`).

---

### ❌ 10. Login Odoo gagal / database tidak muncul di halaman login
**Kemungkinan & solusi:**
- **Password sama dengan lokal** — coba user/password yang sama persis seperti di lokal.
- **Database tak muncul:** cek pengaturan `list_db = True` di config Odoo server, lalu restart.
- **Lupa password admin:** bisa direset (minta bantuan, ada cara lewat database).

---

### ❌ 11. Gambar/lampiran kosong setelah restore
**Artinya:** filestore tidak ikut atau salah lokasi.
**Solusi:** pastikan filestore masuk ke `/var/lib/odoo/filestore/odoo_dev` (nama folder
**harus** sama dengan nama database). `restore.sh` sudah menanganinya otomatis.

---

### ❌ 12. Perintah panjang "kepotong" saat di-paste (mis. `psql -q` saja)
**Artinya:** sebagian perintah hilang saat copy-paste, sehingga jalan tidak lengkap.
**Solusi:** pastikan baris ikut **utuh sampai akhir** sebelum tekan Enter. Untuk perintah
panjang, lebih aman taruh di dalam script (seperti `restore.sh`) lalu jalankan script-nya.
Kalau membuat file pakai `cat > file <<'EOF'` lalu hasilnya rusak/dobel, lebih aman
**scp file dari lokal** (`scp deploy/.../file root@5.223.95.218:/tujuan/`) daripada paste.

---

### ❌ 13. `validating ...: volumes must be a mapping` saat `docker compose up`
**Artinya:** file `docker-compose.yml` rusak/terpotong saat dibuat (biasanya paste heredoc).
**Solusi:** cek & validasi sebelum jalan:
```bash
head -1 docker-compose.yml                       # harus 'services:'
docker compose -f docker-compose.yml config      # harus tampil tanpa error
```
Kalau rusak, buat ulang file-nya (lebih aman scp dari lokal).

---

### ❌ 14. `odoo-bin: error: unrecognized parameters: python3 odoo-bin`
**Artinya:** baris `command:` di compose dobel (mis. `python3 odoo-bin` muncul 2×),
biasanya akibat paste terpotong/terduplikasi.
**Solusi:** cek command yang benar-benar terpasang:
```bash
docker inspect odoo19-sandbox --format 'CMD={{json .Config.Cmd}}'
```
Kalau ada `python3 odoo-bin` dobel, perbaiki `docker-compose.yml` (pastikan baris command
hanya sekali), lalu: `docker compose -p odoo-sandbox up -d`.

---

## 🔁 Cara Cepat Membaca Log Saat Ada Masalah
Kalau Odoo tidak mau jalan, lihat pesan errornya:
```bash
docker logs --tail=60 odoo19
```
Cari baris berisi **`CRITICAL`** atau **`ERROR`** — itu petunjuk utamanya. Salin baris
itu untuk dicari di daftar di atas, atau minta bantuan dengan menyertakan pesan tersebut.

---

## 📌 Tips Keamanan
- Selalu **backup server dulu** sebelum melakukan restore yang menimpa (Bagian 1).
- Jangan ketik password di chat/dokumen mana pun.
- Untuk perubahan rutin, biasakan pakai **Bagian 2** (update kode), bukan menimpa database.
