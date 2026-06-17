# Migrasi: hapus fitur Rincian Bahan Baku.
# Menghapus seluruh data rincian (spk.bahan.detail) beserta tabelnya
# karena model & fiturnya sudah dihapus dari modul.


def migrate(cr, version):
    if not version:
        # Instalasi baru — tidak ada data lama yang perlu dibersihkan
        return
    cr.execute("DROP TABLE IF EXISTS spk_bahan_detail CASCADE")
