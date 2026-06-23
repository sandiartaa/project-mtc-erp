# Work Orders

## Fungsi
Mengelola Work Order dengan tabel ber-header bertingkat, terbagi 3 kelompok kolom:
- **Product Details**: Name, Code, Brand, Job Type, Details
- **InCharge**: user pengerjaan (hanya user yang punya akses modul Work Orders)
- **Timeline**: Barcode, Deadline, Request, Process (WIP/DONE/ON HOLD), Approval

**Job Type** adalah dropdown yang isinya bisa di-CRUD (tambah/ubah/hapus) langsung dari form
lewat tombol **⚙ Kelola**. Pilihan awal: Layer, Hanger, OPP, Kartu, Displaybox, Box, Inner,
Shrink, Karton, Sablon, UV, Spray, Sticker.

**Requestor & Approver** memakai satu daftar nama bersama (model `wo.person`, bukan user Odoo)
yang juga bisa di-CRUD lewat tombol **⚙ Kelola**. Pilihan awal: P. Setiadi, P. Apin, P. Minto,
P. Rahmatk, Rei.

## Real-time (tanpa refresh)
Memakai **bus Odoo**: setiap kali ada Work Order ditambah/diubah/dihapus/impor oleh
user mana pun, server menyiarkan sinyal ke channel `wo_work_order` dan semua klien yang
sedang membuka modul langsung memuat ulang daftarnya otomatis. Butuh longpolling/websocket
Odoo aktif (default sudah aktif saat menjalankan odoo-bin).

## Menu yang ditambahkan
- Menu top-level **Work Orders** → submenu **Daftar Work Order** (khusus grup "Akses Work Orders").

## Model/tabel baru
- `wo.work.order` — tabel custom (tidak menyentuh tabel bawaan Odoo).
- `wo.job.type` — daftar pilihan Job Type (dropdown CRUD).
- `wo.brand` — daftar pilihan Brand (dropdown CRUD).
- `wo.person` — daftar nama untuk Requestor & Approver (dropdown CRUD).
- `wo.revision` — riwayat revisi tiap Work Order (dibuat saat pengajuan approval ditolak; mencatat isi revisi, oleh siapa, kapan).

## Logika Approval & Revisi
- **Approve** → `approval_state` jadi *Approved* dan **status keseluruhan otomatis jadi Finished**. Status *Finished* juga tetap bisa diset manual dari toggle Status di form.
- **Reject** → muncul dialog dengan textarea besar **Revision Detail** (wajib diisi). Saat dikirim, status approval kembali ke draft dan catatan revisi tersimpan sebagai record `wo.revision`.
- Tombol **Revisions** ada di tiap Work Order (desktop & mobile) → membuka popup berisi daftar revisi: isi revisi, oleh siapa, dan kapan. Jumlah revisi tampil di label tombol.

## Akses (2 level, diatur admin via Master User)
- **Work Orders (Full)** — `group_work_orders_user`: boleh Create / View / Update / Delete. Tombol Tambah, Import, Edit, Hapus, dan ⚙ Kelola muncul.
- **Work Orders (Read-only)** — `group_work_orders_readonly`: hanya bisa melihat (Read). Semua tombol aksi disembunyikan dan server menolak operasi tulis.
- Admin memilih salah satu level untuk tiap user dari modul **Master User** (centang "Work Orders (Full)" atau "Work Orders (Read-only)").
- **Visibilitas data:** user Full melihat **semua** Work Order; user Read-only (Designer) hanya melihat Work Order yang dia jadi **Designer 2D/3D**-nya (record rule `ir.rule`).
- **Alur approval:** Designer menekan "Ready for Approval" pada WO miliknya → muncul real-time ke user Full untuk di-Approve/Tolak. Designer bisa Cancel selama belum di-approve.
- Designer 2D/3D tetap diambil dari user Internal (lihat InCharge); Requestor/Approver dari daftar `wo.person`.

## Cara Uninstall
1. Apps → cari "Work Orders" → Uninstall
2. Hapus folder: custom_addons/custom_work_orders/
3. Apps → Update Apps List (mode developer)

## PERINGATAN
Jangan hapus folder sebelum uninstall dari Apps.
