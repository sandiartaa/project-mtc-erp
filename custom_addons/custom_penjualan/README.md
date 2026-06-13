# Penjualan Indonesia

## Fungsi
Dashboard penjualan modern dengan bahasa Indonesia sehari-hari, tema merah-biru, dan popup animasi untuk melihat detail pesanan.

## Menu yang ditambahkan
- **Penjualan** (menu top-level baru)
  - Dashboard Pesanan

## Model/tabel baru yang dibuat
Tidak ada — hanya membaca data bawaan (`sale.order` dan `sale.order.line`)

## Fitur
- Kartu statistik: total pesanan, pendapatan, pesanan baru, pesanan selesai
- Filter cepat: Semua / Baru / Diproses / Selesai / Dibatalkan
- Grid kartu pesanan dengan hover effect
- **Popup animasi** saat klik kartu: detail pembeli, tanggal, daftar barang, total
- Tombol "Buka di Odoo" untuk langsung ke form asli

## Cara Uninstall
1. Buka Odoo → Apps → cari "Penjualan Indonesia" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: `custom_addons/custom_penjualan/`
3. Apps → Update Apps List (mode developer aktif)

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
