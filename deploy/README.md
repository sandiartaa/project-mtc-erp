# deploy/ — Alat Kirim Database ke Server

Folder ini berisi script untuk mem-backup database Odoo lokal dan me-restore-nya
ke server Docker. **Bukan modul Odoo**, hanya alat deployment.

Server tujuan: `root@5.223.95.218` — container `odoo19` (Odoo) & `odoo-postgres` (PostgreSQL 16).

## Alur lengkap (Skenario kirim DATA dari local ke server)

### 1. Backup di local (Git Bash)
```bash
bash deploy/backup.sh
```
Hasil: file `odoo_dev_<tanggal>.tar.gz` di Desktop (sudah otomatis ditambal agar
kompatibel PostgreSQL 16).

### 2. Upload ke server (cmd / PowerShell, dari folder Desktop)
```
scp odoo_dev_<tanggal>.tar.gz root@5.223.95.218:/tmp/
```

### 3. Restore di server (SSH ke server dulu)
```bash
ssh root@5.223.95.218
# salin restore.sh ke server bila belum ada, lalu:
bash restore.sh /tmp/odoo_dev_<tanggal>.tar.gz
```

> ⚠️ `restore.sh` **menimpa** seluruh database `odoo_dev` di server. Pakai hanya
> bila local memang sumber data yang benar.

## Update KODE / modul custom (tidak perlu sentuh database)
`custom_addons` di server di-mount dari host, jadi cukup:
```bash
# di server
cd /opt/odoo/project-odoo-mtc && git pull
docker exec odoo19 odoo -u nama_modul -d odoo_dev --stop-after-init
docker restart odoo19
```

## Catatan teknis (kenapa perlu tambalan)
- **Local PostgreSQL 18**, **server PostgreSQL 16**. Dump dari PG18 memakai sintaks
  `NOT NULL <kolom>` yang tidak dikenal PG16 → `backup.sh` otomatis menghapusnya.
- Folder `lib/` di-`.gitignore`, sehingga modul seperti `phone_validation` kehilangan
  folder `lib`-nya di server. Lihat catatan perbaikan permanen di bawah.

## Perbaikan permanen folder `lib` (server)
Folder `lib` dipasang permanen lewat bind-mount di `docker-compose.yml` server,
mengarah ke `deploy/odoo-libs/` di host. Jadi tidak hilang saat container dibuat ulang.
