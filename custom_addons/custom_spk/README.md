# SPK — Surat Perintah Kerja

## Fungsi
Modul untuk membuat, melihat, mengedit, dan menghapus Surat Perintah Kerja (SPK) produksi dengan tampilan modern bertema merah-biru, penomoran otomatis format `SPK/YYYY/MM/0001`, dan master data cabang sendiri.

## Menu yang ditambahkan
- **SPK** (menu top-level baru di navbar Odoo)
  - **Daftar SPK** — halaman utama dengan tabel SPK, filter, pencarian, dan pagination

## Model/tabel baru yang dibuat
- `spk.spk` — tabel utama Surat Perintah Kerja
- `spk.cabang` — master cabang (perlu diisi terlebih dahulu lewat Settings → Technical → Model)
- `spk.bahan.baku` — daftar bahan baku (PBH) per SPK
- `spk.bahan.detail` — rincian varian per bahan baku (warna/ukuran)
- `spk.formulasi` — formulasi pemakaian bahan per satuan produksi
- `spk.hpr` — catatan produksi per SPK (tanggal kirim, hasil produksi); mengurangi qty bahan secara akumulatif
- `spk.sbh` — SBH (Status Barang Kembali) per bahan baku: barang bagus & rusak (input), barang hilang & total kembali otomatis

## Fitur HPR (Hasil Produksi & Retur)
Di halaman detail SPK terdapat tab **🚚 HPR** yang menampilkan setiap bahan baku beserta:
- Kode barang dan nama bahan baku
- Qty kebutuhan (otomatis dari formulasi)
- Input: tanggal kirim, hasil produksi, dan total kembali
- **Progress %** dihitung otomatis = `total kembali ÷ qty kebutuhan × 100`, ditampilkan sebagai progress bar berwarna (merah <50%, kuning <100%, hijau ≥100%)

Setiap bahan baku memiliki satu entri HPR. Data HPR ikut terhapus otomatis bila bahan bakunya dihapus (`ondelete='cascade'`).

## Cara penggunaan awal
1. Sebelum bisa menambah SPK, buat data Cabang terlebih dahulu:
   - Aktifkan mode developer (Settings → Activate Developer Mode)
   - Buka Settings → Technical → spk.cabang → buat data cabang
2. Pastikan sudah ada minimal satu Produk di sistem (Inventory atau Sales)
3. Buka menu **SPK → Daftar SPK**, klik **+ Tambah SPK**

## Cara Uninstall
1. Buka Odoo → Apps → cari "SPK" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: `custom_addons/custom_spk/`
3. Apps → Update Apps List (mode developer aktif)

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
