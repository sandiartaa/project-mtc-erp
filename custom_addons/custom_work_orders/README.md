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
- `wo.revision` — riwayat revisi tiap Work Order (dibuat saat pengajuan approval ditolak; mencatat isi revisi, **gambar opsional**, oleh siapa, kapan).
- `wo.design.image` — riwayat per pengajuan "Ready for Approval": description (wajib) + image (opsional), oleh siapa, kapan.
- `wo.audit` — log aktivitas Work Order (create/edit/delete): siapa, apa, kapan. Dibaca lewat tombol **History** (khusus akses Full).
- `wo.production` — daftar pilihan Production (dropdown CRUD + search).
- `wo.section` — daftar pilihan Section (dropdown CRUD + search). Default: 2D, 3D, INJ, DECO, ASSY.

## Jenis Work Order & Tab
- Tiap Work Order punya **Type**: **Design / Mold / Maintenance / Utility** (wajib dipilih saat Add).
- Daftar ditampilkan per **tab** sesuai Type (tab Design hanya menampilkan WO Design, dst).
- **Admin mengatur tab mana yang muncul untuk tiap user** lewat **Master User** (grup `WO Tab: Design/Mold/Maintenance/Utility`). Jika user tidak dicentang satu pun tab, ia melihat **semua** tab (default tanpa batasan); Administrator selalu melihat semua.

## Kolom baru
- **Production** (dropdown CRUD), **Qty** (sebelum Details), **Section** (di sebelah Executor, dropdown CRUD: 2D/3D/INJ/DECO/ASSY).
- **Executor** = nama lama "Designer 2D/3D" (field sama, hanya label). Tetap bisa pilih user sistem atau ketik nama custom.

## Designer (dropdown ATAU ketik custom)
Field **Designer 2D/3D** bisa dipilih dari daftar user sistem **atau** diketik bebas
(nama custom, mis. vendor/freelancer) lewat kotak "Or type a custom name" di picker.
Jika designer bukan user sistem, user **Full** yang mengajukan/membatalkan Ready.

## Requestor login (Input by)
Tiap Work Order menampilkan **user yang membuat** WO (memakai `create_uid` bawaan — selalu
user yang login sebenarnya, bukan superuser/OdooBot). Label *Input by*, tampil di kolom
Requestor (desktop) & baris "Input by" (mobile).

## Alur Image (referensi vs hasil designer)
- **Reference Image** (field `image`) = gambar acuan dari pembuat WO untuk designer.
- **Designer Image** (`wo.design.image`) = gambar hasil designer, di-upload saat menekan
  "Ready for Approval". Yang **ditampilkan utama** di daftar adalah image **terbaru** dari designer.
- Bila belum ada image designer, daftar menampilkan Reference Image dengan tag **Ref**.
- Tag angka berikon di sel image membuka **riwayat semua image designer** (image + description + oleh + kapan).

## Logika Approval & Revisi
- **Approve** → `approval_state` jadi *Approved* dan **status keseluruhan otomatis jadi Finished**. Status *Finished* juga tetap bisa diset manual dari toggle Status di form.
- **Reject** → muncul dialog dengan textarea besar **Revision Detail** (wajib diisi). Saat dikirim, status approval kembali ke draft dan catatan revisi tersimpan sebagai record `wo.revision`.
- Tombol **Revisions** ada di tiap Work Order (desktop & mobile) → membuka popup berisi daftar revisi: isi revisi, oleh siapa, dan kapan. Jumlah revisi tampil di label tombol.

## Akses (3 level, diatur admin via Master User)
- **Work Orders (Full)** — `group_work_orders_user`: Create / View / Update / Delete + **Approve/Reject**. Melihat **semua** WO. **Tidak** menampilkan tombol "Ready for Approval" (itu khusus Designer).
- **Work Orders (Designer)** — `group_work_orders_designer`: hanya melihat WO yang dia jadi **Designer 2D/3D**-nya, dan bisa menekan **"Ready for Approval"**. Tidak bisa CRUD. Badge header: **🎨 Designer Only**.
- **Work Orders (Read-only)** — `group_work_orders_readonly`: **read murni** — melihat **semua** WO, tanpa aksi apa pun (tidak ada Ready/Approve/Reject/CRUD). Badge header: **👁 Read Only**.
- Admin memilih salah satu level untuk tiap user dari modul **Master User**.
- **Visibilitas data (record rule `ir.rule`):** Full & Read-only lihat **semua**; Designer hanya WO miliknya.
- **Alur approval:** Designer menekan "Ready for Approval" pada WO miliknya → **popup description (WAJIB) + image designer (opsional, drag-drop/upload)** → setelah submit, muncul real-time ke user Full untuk di-Approve/Reject.
- **Reject + gambar:** saat user Full menolak, **Detail Revision wajib**; gambar **opsional** (drag-drop/upload). Gambar + deskripsi tampil di popup **Revisions** (history).
- **Hapus entri history:** user Full bisa menghapus tiap entri di popup **Revisions** & **Designer Images** (tombol 🗑).
- Designer 2D/3D bisa dari user Internal **atau** nama custom (ketik bebas); Requestor/Approver dari daftar `wo.person`.

## Filter (1 tombol)
Tombol **Filter** membuka popup berisi semua filter:
- **Status:** All / Ongoing / Finished.
- **Period (semua akses):** pilih field tanggal (Req/Target/Finish/Approval) + tanggal **dari–sampai** (bisa per bulan/periode).
- **Per designer (Full & Read-only saja):** dropdown untuk mengecek WO milik designer tertentu (A/B). Mencakup designer user sistem **dan** nama custom. Designer tidak butuh filter ini (sudah otomatis hanya WO-nya).
Badge angka di tombol Filter = jumlah filter aktif.

## History / Audit (khusus akses Full)
Tombol **History** (di sebelah Filter, hanya akses Full) membuka log aktivitas: siapa
**membuat / mengedit / menghapus** Work Order apa, keterangan singkat, dan kapan
(termasuk aksi approval: Ready / Approve / Reject). Data dari model `wo.audit`.

## Cara Uninstall
1. Apps → cari "Work Orders" → Uninstall
2. Hapus folder: custom_addons/custom_work_orders/
3. Apps → Update Apps List (mode developer)

## PERINGATAN
Jangan hapus folder sebelum uninstall dari Apps.
