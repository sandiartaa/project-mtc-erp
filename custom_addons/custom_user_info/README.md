# Custom User Info

## Fungsi
Menyimpan data tambahan tiap user — **kode** (KR0001, KR0002, ...), **divisi**, dan **subdivisi** — di tabel custom sendiri yang berelasi ke `res.users`. Tabel bawaan `res.users` tidak diubah sama sekali.

## Menu yang ditambahkan
- Menu top-level baru: **Data Karyawan** → submenu **Daftar Data Karyawan**

## Model/tabel baru yang dibuat
- `cui.user.info` — relasi Many2one ke `res.users`, dengan field:
  - `kode` — otomatis KR0001, KR0002, ... (dari ir.sequence)
  - `divisi` — STAF REPACKING / BORONGAN DALAM / BORONGAN LUAR / HELPER / STOCK KEEPER
  - `subdivisi` — Borongan Dalam / Borongan Luar
- (Catatan: `res.users` TIDAK di-inherit / tidak ditambah kolom.)

## Cara Uninstall
1. Buka Odoo → Apps → cari "Custom User Info" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: custom_addons/custom_user_info/
3. Apps → Update Apps List (mode developer aktif)

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
