# Work Order Mold

## Fungsi
App khusus untuk Work Order jenis **Mold**. Modul ini **tidak punya tabel sendiri** —
semua WO yang dibuat di sini adalah `wo.work.order` (model milik modul Work Orders)
dengan `wo_type='mold'`, sehingga otomatis muncul juga di app **Work Orders** (tab Mold)
dan bisa diedit di sana.

## Menu yang ditambahkan
- **Work Order Mold** (menu top-level) → **Work Order Mold List**

## Akses
- Hanya **1 akses**: `Akses Work Order Mold` (tidak ada Full/Read-only).
- Diberikan ke user lewat modul **Master User** (centang "Work Order Mold").

## Fitur
- **Add Work Order**: digembok **password** (diatur admin). Field yang bisa diisi:
  Name, Code, Job Type, Qty, Requestor, Req Date, Details, Reference Image. Sisanya kosong.
- **Lead Time (Hour)** & **Finish Repair (Date)**: diisi **langsung (inline)** di list
  setelah WO masuk — tidak diisi saat menambah. **Finish Repair = tanggal Ready for
  Approval** (disimpan ke field `ready_date`, BUKAN Target Finish). Karena app Mold
  tidak punya tombol "Ready for Approval", mengisi Finish Repair otomatis mengajukan
  WO (status approval → "Awaiting Approval"); mengosongkannya membatalkan pengajuan.
- **Approve**: bisa lewat **app Work Orders (tab Mold)** atau tombol **Approve** oleh
  Requestor di app Mold (muncul setelah Finish Repair diisi).
- **Action**: hanya berisi **History** (audit khusus WO mold).
- Password tambah: default `mold123`. Admin bisa mengubah lewat ikon 🔑 di app, atau
  Settings → Technical → System Parameters (key: `custom_work_orders_mold.add_password`).

## Model/tabel baru yang dibuat
- Tidak ada — berbagi `wo.work.order` milik modul `custom_work_orders`
  (modul ini `depends` pada `custom_work_orders`).

## Cara Uninstall
1. Buka Odoo → Apps → cari "Work Order Mold" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: `custom_addons/custom_work_orders_mold/`
3. Apps → Update Apps List (mode developer aktif)

> Catatan: meng-uninstall modul ini TIDAK menghapus WO bertipe mold — datanya
> tetap ada di app Work Orders (tab Mold), karena tersimpan di `wo.work.order`.

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
