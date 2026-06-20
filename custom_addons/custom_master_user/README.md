# Master User

## Fungsi
Menampilkan semua user beserta **Nama, Kode, Divisi, Subdivisi**, dan tombol **History**. Hanya bisa diakses **Administrator**. Admin dapat menambah, mengedit, dan menghapus entri master. Tombol History menampilkan siapa pembuat entri, siapa saja yang mengedit, dan kapan. Tidak mengubah tabel bawaan `res.users` (hanya membaca nama user).

## Menu yang ditambahkan
- Menu top-level **Master User** → submenu **Daftar User** (khusus grup Administrator/Settings)

## Model/tabel baru yang dibuat
- `mu.user.riwayat` — audit log perubahan (pembuat, editor, waktu, aksi)
- Menambah relasi/aksi pada `cui.user.info` (model custom dari modul `custom_user_info`) — `res.users` tidak disentuh.

## Ketergantungan
- Membutuhkan modul **custom_user_info** (penyimpan kode/divisi/subdivisi).

## Catatan instalasi
- Saat dipasang, modul otomatis membuat entri master untuk semua user internal yang ada (lewat post_init_hook), sehingga daftar langsung terisi.

## Cara Uninstall
1. Buka Odoo → Apps → cari "Master User" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: custom_addons/custom_master_user/
3. Apps → Update Apps List (mode developer aktif)

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
Uninstall Master User hanya menghapus audit log & menu; data kode/divisi/subdivisi tetap ada di modul custom_user_info.
