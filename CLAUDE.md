# CLAUDE.md
Project Odoo 19 Community, jalan lokal di Windows, dengan venv.

## Konteks Default (PENTING)
- SEMUA modul, file, dan kode custom SELALU dibuat di ./custom_addons/ — tanpa perlu diminta
- Jangan pernah membuat file di luar ./custom_addons/
- Setiap permintaan "buatkan tampilan X" = buat modul Odoo lengkap yang menampilkan view tersebut di dalam web Odoo (localhost:8069), filenya tetap di ./custom_addons/

## Aturan Data & Model (JELAS, TIDAK AMBIGU)
Prinsip: BACA boleh, UBAH tidak boleh.

### Yang BOLEH:
- MEMBACA data dari model bawaan Odoo (sale.order, res.partner, product.template, dll) untuk ditampilkan di view custom
- Membuat MODEL BARU dengan nama sendiri (prefix nama modul, contoh: csk.sales.note) jika fitur custom butuh menyimpan data sendiri — ini membuat TABEL BARU di database, tidak menyentuh tabel bawaan, tapi boleh punya relasi (Many2one/Many2many) ke model bawaan
- Membuat view baru, action baru, menu top-level baru

### Yang DILARANG KERAS:
- Mengubah, menambah field, atau inherit MODEL bawaan Odoo (jangan pernah _inherit ke sale.order, res.partner, dll untuk menambah/mengubah field)
- Mengubah atau menghapus data di tabel bawaan kecuali user minta eksplisit (misal "buatkan 10 data sales dummy" = boleh, karena itu menambah record lewat jalur normal)
- Mengedit, inherit (inherit_id), atau mengubah VIEW bawaan Odoo
- Menambahkan menuitem ke dalam MENU bawaan (Sales, CRM, Inventory, dll)
- Menyentuh struktur tabel bawaan di database dalam bentuk apapun

### Contoh penerapan:
- User: "buatkan tampilan sales bentuk grid" → modul baru + menu top-level baru "Sales Grid" yang MEMBACA sale.order. Menu Sales asli tidak tersentuh sama sekali.
- User: "buatkan fitur catatan untuk tiap sales order" → JANGAN tambah field di sale.order. Buat model baru (misal csn.sales.note) yang punya field relasi Many2one ke sale.order. Tabel sale_order asli tetap utuh.
- User: "buatkan sistem absensi custom" → model baru sepenuhnya + menu baru. Tidak ada hubungan dengan modul HR bawaan.

### Tujuan aturan ini:
Setiap modul custom harus bisa di-uninstall kapan saja dan Odoo kembali 100% seperti semula tanpa bekas.

## Struktur
- ./odoo-19.0/ = source Odoo asli (READ-ONLY, jangan pernah edit)
- ./custom_addons/ = semua modul custom dibuat di sini
- ./venv/ = Python virtual environment

## Commands
- Aktifkan venv dulu: venv\Scripts\activate
- Jalankan Odoo: python odoo-19.0/odoo-bin -c odoo.conf -d odoo_dev
- Update modul: python odoo-19.0/odoo-bin -c odoo.conf -d odoo_dev -u nama_modul --stop-after-init
- Install modul baru: python odoo-19.0/odoo-bin -c odoo.conf -d odoo_dev -i nama_modul --stop-after-init
- Setelah membuat/mengubah modul, SELALU tawarkan untuk menjalankan command install/update

### Saat user minta "jalankan odoo"
- Jalankan Odoo sebagai background process agar terminal tidak terblokir:
  start /b python odoo-19.0/odoo-bin -c odoo.conf -d odoo_dev
- Tunggu beberapa detik sampai log menunjukkan "HTTP service (werkzeug) running" atau "Modules loaded"
- Setelah server siap, buka browser otomatis: start http://localhost:8069
- Jika port 8069 sudah dipakai (Odoo sudah jalan sebelumnya), jangan jalankan ulang — langsung buka browser saja

## Workflow Membuat Tampilan Custom
- Setiap tampilan custom = modul baru berisi: ir.ui.view (view BARU dari nol) + ir.actions.act_window + menuitem TOP-LEVEL baru
- DILARANG pakai inherit_id ke view bawaan — selalu buat view baru dari nol (konsisten dengan Aturan Data & Model di atas)
- Action menunjuk ke model bawaan Odoo (sale.order, res.partner, dll) untuk MEMBACA datanya, dengan view custom
- Tipe view yang tersedia: list, form, kanban, calendar, pivot, graph, search
- Penamaan modul: gunakan prefix custom_ (contoh: custom_sales_grid)
- Nama menu top-level harus jelas dan beda dari menu bawaan (contoh: "Sales Grid", "Dashboard Penjualan" — jangan "Sales" saja)
- PERHATIAN Odoo 19: tag view daftar adalah <list>, BUKAN <tree> (sudah diganti sejak Odoo 18)

## Standar Desain UI (WAJIB untuk semua tampilan)
Setiap membuat tampilan, utamakan hasil yang modern dan enak dilihat:

### Pilihan jenis view
- Untuk tampilan daftar yang menarik: UTAMAKAN kanban view dengan card design custom, bukan list biasa
- Untuk halaman ringkasan/laporan: buat dashboard dengan OWL component
- List view biasa hanya jika user butuh tabel data padat

### Desain kanban card
- Card dengan border-radius 8-12px, shadow halus (box-shadow: 0 1px 3px rgba(0,0,0,0.1))
- Padding dalam card minimal 16px
- Hierarki teks jelas: judul bold 14-16px, info sekunder 12-13px warna abu (#6b7280)
- Gunakan badge berwarna untuk status (hijau=selesai, biru=proses, abu=draft, merah=batal)
- Tampilkan avatar/gambar jika model punya field image
- Hover effect halus (transform atau shadow naik)

### Warna & spacing
- Palet utama: netral putih/abu dengan satu warna aksen (ungu #714B67 khas Odoo, atau biru #2563eb)
- Jangan lebih dari 3 warna dalam satu tampilan
- Spacing konsisten kelipatan 4px (8, 12, 16, 24)
- Jangan pakai warna mencolok/neon

### CSS custom
- Setiap modul UI boleh punya file static/src/css/style.css sendiri
- Daftarkan di __manifest__.py bagian 'assets': 'web.assets_backend'
- Class CSS pakai prefix nama modul agar tidak bentrok (contoh: .csg_card untuk modul custom_sales_grid)

### Aturan js_class
- HINDARI pakai js_class di kanban/list kecuali benar-benar butuh perilaku JS custom
- Styling cukup pakai CSS via static/src/css + class di template XML
- Kalau terpaksa pakai js_class: nama di registry.category("views").add("nama_x") HARUS sama persis dengan js_class="nama_x" di XML, dan file JS WAJIB terdaftar di 'web.assets_backend' dalam __manifest__.py
- Setelah ubah file JS/CSS: restart Odoo dan ingatkan user hard refresh browser (Ctrl+Shift+R)

### Dashboard OWL
- Untuk dashboard: kartu statistik di atas (angka besar + label), grafik/daftar di bawah
- Responsive: gunakan flexbox/grid, tampil baik di layar kecil
- Loading state saat fetch data

## Aturan Kode
- Selalu pakai ORM Odoo, jangan raw SQL
- Lihat ./odoo-19.0/addons/sale/ sebagai referensi pola kode (referensi BACA saja, bukan untuk diubah)
- Setiap model baru wajib ada security/ir.model.access.csv
- Frontend pakai OWL framework
- Komentar kode dalam bahasa Indonesia

## Dokumentasi Wajib Tiap Modul
Setiap modul yang dibuat WAJIB menyertakan file README.md di root foldernya dengan format:

    # Nama Modul

    ## Fungsi
    (1-2 kalimat apa yang dilakukan modul ini)

    ## Menu yang ditambahkan
    - (daftar menu baru yang muncul di Odoo)

    ## Model/tabel baru yang dibuat
    - (daftar model baru, atau tulis "Tidak ada — hanya membaca data bawaan")

    ## Cara Uninstall
    1. Buka Odoo → Apps → cari "nama_modul" → klik Uninstall
    2. Setelah uninstall selesai, hapus folder: custom_addons/nama_modul/
    3. Apps → Update Apps List (mode developer aktif)

    ## PERINGATAN
    JANGAN hapus folder sebelum uninstall dari Apps — akan menyebabkan error di database.

## Aturan Hapus Modul
- JANGAN PERNAH menghapus folder modul yang masih ter-install di database
- Urutan benar: 1) Uninstall dari Apps di Odoo, 2) baru hapus folder, 3) Update Apps List
- Jika user minta hapus modul, lakukan urutan di atas secara otomatis

## Setelah Selesai
- Beri tahu langkah untuk melihat hasilnya di browser (menu baru apa yang muncul di localhost:8069)
- Sebutkan ringkasan cara uninstall modul tersebut
- Ingatkan jika perlu Update Apps List di mode developer
- Jika ada error saat install/update, baca log-nya dan perbaiki sendiri sebelum lapor ke user