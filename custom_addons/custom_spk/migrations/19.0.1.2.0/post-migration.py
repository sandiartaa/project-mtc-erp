# Migrasi: SPK tidak lagi memakai product.product bawaan & nama manual.
# Nama SPK kini diambil dari tabel custom baru spk.barang (field barang_id).
# Bersihkan kolom lama agar tabel spk_spk tidak menyimpan referensi usang.


def migrate(cr, version):
    if not version:
        # Instalasi baru — tidak ada data lama yang perlu dibersihkan
        return
    # Hapus kolom lama (referensi ke product.product & nama pekerjaan manual)
    cr.execute("ALTER TABLE spk_spk DROP COLUMN IF EXISTS product_id")
    cr.execute("ALTER TABLE spk_spk DROP COLUMN IF EXISTS nama_pekerjaan")
