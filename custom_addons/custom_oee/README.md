# custom_oee (OEE)

## Fungsi
Mencatat data harian OEE (Overall Equipment Effectiveness) per tanggal/shift/mesin/mold — meniru struktur file rekap Excel "Daily Entry" — lalu menampilkan dashboard grafik Efficiency, Effectiveness, Down Time, dan pareto top 5 mesin/matras/penyebab downtime terburuk.

Tampilan bertema hijau modern (mengikuti gaya modul NPI), responsive untuk HP dan desktop, dengan font besar agar nyaman dipakai orang tua.

## Menu yang ditambahkan
- **OEE** (menu top-level)
  - **Input** — aplikasi tabel data bulanan dengan tombol besar Tambah / Edit / Hapus (CRUD penuh). Form berisi: tanggal, shift, no mesin, mold, down time + penyebab, counter produksi, ideal cycle time, reject — lengkap dengan pratinjau hasil hitung (Effectiveness, Efficiency, FG, OEE) langsung di form.
  - **Import** — upload file Excel rekap OEE (sheet "Daily Entry"). Setiap import tercatat sebagai satu batch di daftar riwayat; tombol Hapus pada batch akan menghapus seluruh baris data hasil import itu saja (input manual tidak tersentuh).
  - **Graph** — dashboard grafik dengan filter bulan/tahun:
    1. Tabel + line chart Down Time per tanggal
    2. Tabel + line chart Efficiency (%), Effectiveness (%), Down Time per tanggal
    3. Pareto chart Top 5 Worst No Machine (berdasarkan menit down time)
    4. Pareto chart Top 5 Worst Name Matras
    5. Pareto chart Top 5 Other Contribution (berdasarkan penyebab downtime)

## Model/tabel baru yang dibuat
- `oee.entry` — data harian OEE (semua input + hasil perhitungan)
- `oee.downtime.reason` — master penyebab downtime (untuk pareto Other Contribution)
- `oee.import.batch` — riwayat import Excel (hapus batch = hapus data hasil import tersebut)

## Hak akses
- Grup **"Akses OEE"** (`custom_oee.group_oee_user`) — menu OEE dan semua tabelnya hanya
  terlihat oleh anggota grup ini (admin otomatis anggota).
- Akses per user diatur dari menu **Master User** (daftar "OEE" muncul otomatis di
  pengaturan Akses Modul milik modul custom_master_user).

Tidak menyentuh model/view bawaan Odoo sama sekali.

## Definisi perhitungan (mengikuti formula Excel sumber)
- Waktu Operasi = Total Waktu Tersedia − Down Time
- **Effectiveness (%)** = Waktu Operasi ÷ Total Waktu Tersedia (availability)
- **Efficiency / CT (%)** = (Ideal CT × HPR Actual) ÷ (Waktu Operasi × 60) (performance)
- FG (%) = OK ÷ HPR Actual (quality)
- OEE (%) = Effectiveness × Efficiency × FG

## Cara Uninstall
1. Buka Odoo → Apps → cari "OEE" → klik Uninstall
2. Setelah uninstall selesai, hapus folder: custom_addons/custom_oee/
3. Apps → Update Apps List (mode developer aktif)

## PERINGATAN
JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.
