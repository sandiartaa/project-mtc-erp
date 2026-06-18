# Migrasi: satuan barang berubah dari Selection (kolom varchar `satuan`)
# menjadi Many2one ke master baru spk.satuan (kolom `satuan_id`).
# Hapus kolom lama agar tabel spk_barang tidak menyimpan data usang.


def migrate(cr, version):
    if not version:
        return
    cr.execute("ALTER TABLE spk_barang DROP COLUMN IF EXISTS satuan")
