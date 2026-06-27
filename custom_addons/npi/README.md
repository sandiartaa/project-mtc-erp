# NPI

## Fungsi
Modul untuk mengelola NPI Product secara CRUD dengan tampilan bertingkat: daftar product (kelompok kolom Item / Packing / Production), tiap baris bisa dibuka menjadi tabel Sub Item baku (Matras, Packing, Sparepart, Deco, Karton) yang Status / Details / Notes-nya bisa diisi.

## Menu yang ditambahkan
- **NPI** (menu top-level baru) → **NPI Products**

## Model/tabel baru yang dibuat
- `npi.product` — data product (Code, Photo, Name, Brand, Packing Type/Qty, Production Place/Batch 1)
- `npi.subitem` — sub item baku per product (Sub Item, Status, Details, Notes)

Sub item bersifat TETAP: tiap product otomatis punya 5 sub item — Matras, Packing,
Sparepart, Deco, Karton. Tidak bisa ditambah atau dihapus, hanya diisi.

Tidak menyentuh tabel/model bawaan Odoo sama sekali.

## Cara pakai
1. Buka menu **NPI → NPI Products**.
2. **+ Add Product** untuk menambah product (isi Item/Packing/Production + foto opsional).
   Saat product dibuat, 5 sub item baku otomatis dibuat.
3. Klik sebuah baris product → terbuka panel **Sub Items** (Matras, Packing, Sparepart, Deco, Karton).
4. Klik **Edit** pada sebuah Sub Item untuk mengisi **Status / Details / Notes**.

## Cara Uninstall
1. Buka Odoo → Apps → cari "NPI" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: custom_addons/npi/
3. Apps → Update Apps List (mode developer aktif)

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
