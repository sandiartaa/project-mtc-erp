# Work Orders

## Fungsi
Mengelola Work Order dengan tabel ber-header bertingkat, terbagi 3 kelompok kolom:
- **Product Details**: Name, Code, Brand, Details
- **InCharge**: user pengerjaan (hanya user yang punya akses modul Work Orders)
- **Timeline**: Barcode, Deadline, Request, Process (WIP/DONE/ON HOLD), Approval

## Menu yang ditambahkan
- Menu top-level **Work Orders** → submenu **Daftar Work Order** (khusus grup "Akses Work Orders").

## Model/tabel baru
- `wo.work.order` — tabel custom (tidak menyentuh tabel bawaan Odoo).

## Akses
- Grup **Akses Work Orders** (`group_work_orders_user`). Bisa di-assign ke user dari modul **Master User** (kolom/centang Akses Modul) atau Settings → Users.
- Hanya user dalam grup ini yang bisa membuka modul DAN yang muncul sebagai pilihan InCharge.

## Cara Uninstall
1. Apps → cari "Work Orders" → Uninstall
2. Hapus folder: custom_addons/custom_work_orders/
3. Apps → Update Apps List (mode developer)

## PERINGATAN
Jangan hapus folder sebelum uninstall dari Apps.
