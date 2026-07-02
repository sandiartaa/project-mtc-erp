# NPI

## Fungsi
Modul untuk mengelola NPI Product secara CRUD dengan tampilan bertingkat: daftar product (kelompok kolom Item / Packing / Production), tiap baris bisa dibuka menjadi tabel Sub Item baku (Matras, Packing, Sparepart, Deco, Karton) yang Status / Details / Notes-nya bisa diisi.

## Menu yang ditambahkan
- **NPI** (menu top-level baru) → **NPI Products**

## Model/tabel baru yang dibuat
- `npi.product` — data product (Code, Photo, Name, Brand, Packing Type/Qty, Production Place/Batch 1)
- `npi.subitem` — sub item baku per product (Sub Item, Status, Details, Notes)
- `npi.row.base` — model abstrak (tanpa tabel) berisi logika baca/simpan baris bersama
- `npi.matras` — baris tabel sub item **Matras** (Details · Timeline · Container)
- `npi.packing` — baris tabel sub item **Packing** (Details · PO · Cont)
- `npi.sparepart` — baris tabel sub item **Sparepart** (Details · PO · Cont)
- `npi.deco` — baris tabel sub item **Deco** (Details, dengan kolom Photo per baris)
- `npi.karton` — baris tabel sub item **Karton** (Details · PO)

Sub item bersifat TETAP: tiap product otomatis punya 5 sub item — Matras, Packing,
Sparepart, Deco, Karton. Tidak bisa ditambah atau dihapus, hanya diisi.

Tabel baris per sub item (klik baris sub item → popup tabel CRUD):
- **Matras** — Details: Mold Code, Description, Spec, Maker, Material, Qty · Timeline: Req/Prod/Finished Date · Container: Number, Stuffing Date, Arrival Date
- **Packing** — Details: Code, Item, Packing, Specification, Qty, Executor · PO: Date, Qty · Cont: No., Stuffing Date, Arrival Date
- **Sparepart** — Details: Code, Item, Packing, Specification, Qty (tanpa Executor) · PO: Supplier, Date, Qty · Cont: No., Stuffing Date, Arrival Date
- **Deco** — Details: Item, Qty, Executor, Photo (upload gambar per baris)
- **Karton** — Details: Code, Item, Specification · PO: Date, Qty, Arrival Date

Tidak menyentuh tabel/model bawaan Odoo sama sekali.

> Modul ini **auto-install** (`auto_install: True`) — begitu di-deploy/Update Apps List,
> NPI langsung terpasang otomatis tanpa perlu klik Install manual di menu Apps.

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
