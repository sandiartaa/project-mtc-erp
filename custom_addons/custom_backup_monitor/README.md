# Backup Monitor

## Fungsi
Dashboard khusus **Administrator** untuk memantau backup server: daftar file backup + status (berhasil/segar), jam server (UTC & WIB), penyimpanan (disk), kecepatan server (CPU/RAM + uji kecepatan disk), dan **unduh file backup** langsung dari web.

## Menu yang ditambahkan
- Menu top-level **Backup Monitor** → submenu **Dashboard** (hanya Administrator).

## Model/tabel baru
- `backup.monitor` — TransientModel (tanpa data tersimpan), hanya berisi method baca filesystem & statistik server. Tidak menyentuh tabel bawaan Odoo.

## Cara kerja
- Membaca folder backup di server (default `/opt/odoo/backups`).
- Status dihitung dari kesegaran file terbaru: **Sehat** (≤26 jam), **Perlu dicek** (≤50 jam), **Usang** (>50 jam).
- Disk = `shutil.disk_usage`, CPU = `os.getloadavg`, RAM = `/proc/meminfo` (Linux).
- Unduh lewat controller `/backup_monitor/download` (hanya admin, nama file divalidasi ketat — tidak bisa keluar folder backup).

## ⚠️ Wajib di server: mount folder backup ke container
Agar Odoo (di dalam Docker) bisa membaca `/opt/odoo/backups`, tambahkan bind-mount
pada service `odoo19` (dan `odoo19-sandbox` bila perlu), lalu recreate container:
```yaml
volumes:
  - /opt/odoo/backups:/opt/odoo/backups
```
Tanpa mount ini, daftar file & disk akan kosong (modul tetap jalan, hanya tidak ada data).

Folder backup bisa diganti lewat **Settings → Technical → System Parameters**,
kunci `custom_backup_monitor.dir`.

## Cara Uninstall
1. Buka Odoo → Apps → cari "Backup Monitor" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: custom_addons/custom_backup_monitor/
3. Apps → Update Apps List (mode developer aktif)

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
