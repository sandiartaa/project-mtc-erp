# SPK — Surat Perintah Kerja

## Fungsi
Modul untuk membuat, melihat, mengedit, dan menghapus Surat Perintah Kerja (SPK) produksi dengan tampilan modern bertema merah-biru, penomoran otomatis format `SPK/YYYY/MM/0001`, dan master data cabang sendiri.

## Menu yang ditambahkan
- **SPK** (menu top-level baru di navbar Odoo)
  - **Daftar SPK** — halaman utama dengan tabel SPK, filter, pencarian, dan pagination

## Model/tabel baru yang dibuat
- `spk.spk` — tabel utama Surat Perintah Kerja. **Nama SPK diambil dari produk** (`barang_id` → `spk.barang`), bukan input manual lagi. Harga Standar otomatis dihitung dari total bahan baku (mulai 0 saat baru); bisa di-custom manual lewat Edit (centang "Atur manual"), dan saat custom tidak ikut berubah otomatis.
- `spk.barang` — master barang/produk milik modul ini (tabel sendiri, BUKAN `product.product` bawaan). Diisi lewat tombol **+ Tambah Barang** (Kode, Nama, Harga, Satuan, PIC, Kategori, Gudang, Keterangan); menjadi sumber nama saat membuat SPK. Tiap dropdown di form ini berupa picker dengan pencarian, maksimal 5 pilihan per halaman, dan tombol next/prev.
- `spk.satuan` — master satuan barang, bisa tambah/edit/hapus lewat popup **⚙ Kelola Satuan**. Default awal: Karton, Layer, Pcs.
- `spk.kategori` — master kategori barang, bisa tambah/edit/hapus lewat popup **⚙ Kelola Kategori**.
- `spk.gudang` — master gudang, bisa tambah/edit/hapus lewat popup **⚙ Kelola Gudang**. Default awal: Gudang Bahan Kemas.
- `spk.cabang` — master cabang (perlu diisi terlebih dahulu lewat Settings → Technical → Model)
- `spk.bahan.baku` — daftar bahan baku (PBH) per SPK
- `spk.formulasi` — formulasi pemakaian bahan per satuan produksi (level SPK)
- `spk.barang.formulasi` — formulasi (resep bahan) milik tiap master barang. Satu barang BOLEH punya banyak baris formulasi, boleh juga tidak punya. Ikut terhapus otomatis bila barang induknya dihapus (`ondelete='cascade'`)
- `spk.hpr` — catatan produksi per SPK (tanggal kirim, hasil produksi, gudang penerima/PIC); mengurangi qty bahan secara akumulatif
- `spk.sbh` — SBH (Status Barang Kembali) per bahan baku: barang sisa (input, default = sisa yang diharapkan), gudang penerima/PIC, kategori (text manual). Bahan ber-kategori sama digabung jadi 1 baris & nilai gabungan dipakai untuk Ket/potongan gaji. Barang hilang & stock akhir otomatis
- `spk.riwayat` — riwayat (history) perubahan tiap SPK: mencatat siapa & kapan SPK dibuat, dan setiap kali diedit

## Fitur HPR (Hasil Produksi & Retur)
Di halaman detail SPK terdapat tab **🚚 HPR** yang menampilkan setiap bahan baku beserta:
- Kode barang dan nama bahan baku
- Qty kebutuhan (otomatis dari formulasi)
- Input: tanggal kirim, hasil produksi, dan total kembali
- **Progress %** dihitung otomatis = `total kembali ÷ qty kebutuhan × 100`, ditampilkan sebagai progress bar berwarna (merah <50%, kuning <100%, hijau ≥100%)

Setiap bahan baku memiliki satu entri HPR. Data HPR ikut terhapus otomatis bila bahan bakunya dihapus (`ondelete='cascade'`).

## Fitur Detail & Formulasi Master Barang
Di popup **📦 Master Barang**, setiap baris barang **bisa diklik** untuk membuka detailnya. Modal detail punya dua tab:
- **ℹ️ Informasi** — menampilkan seluruh data barang (nama, kode, harga, satuan, kategori, gudang, PIC, keterangan)
- **📋 Formulasi** — daftar resep bahan untuk membuat barang tersebut, lengkap dengan CRUD (tambah/edit/hapus). Karena ada barang yang punya formulasi dan ada yang tidak, kolom **Formulasi** di tabel master menampilkan badge hijau "N bahan" bila ada, atau "Tidak ada" bila kosong.

## Cara penggunaan awal
1. Sebelum bisa menambah SPK, buat data Cabang terlebih dahulu:
   - Aktifkan mode developer (Settings → Activate Developer Mode)
   - Buka Settings → Technical → spk.cabang → buat data cabang
2. Tambahkan minimal satu Barang lewat tombol **+ Tambah Barang** (di pojok kanan atas halaman Daftar SPK)
3. Buka menu **SPK → Daftar SPK**, klik **+ Tambah SPK** — klik kotak **Produk (Nama SPK)** untuk mencari & memilih barang (muncul 5 barang berurut abjad)

## Cara Uninstall
1. Buka Odoo → Apps → cari "SPK" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: `custom_addons/custom_spk/`
3. Apps → Update Apps List (mode developer aktif)

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
