from odoo import models, fields


class SpkSbh(models.Model):
    _name = 'spk.sbh'
    _description = 'SBH — Status Barang Kembali (bagus/rusak/hilang) per Bahan Baku'
    _order = 'id asc'

    # Satu entri SBH untuk setiap bahan baku (relasi 1-1).
    # Total kembali & barang hilang dihitung di frontend (turunan dari HPR), tidak disimpan.
    bahan_id = fields.Many2one(
        'spk.bahan.baku', 'Bahan Baku', required=True, ondelete='cascade', index=True
    )
    # Barang sisa = gabungan barang kembali (bagus + rusak) yang diinput user.
    # Nilai default 0; barang hilang & stock akhir dihitung di frontend.
    barang_sisa = fields.Float('Barang Sisa', digits=(16, 2), default=0.0)
    # Tujuan barang kembali: nama gudang penerima atau PIC penerima
    gudang_penerima = fields.Char('Gudang Penerima / PIC')
    # Kategori manual (text). Bahan dengan kategori sama dianggap 1 kesatuan
    # (mis. Corong merah/biru/kuning → kategori "Corong"), beda warna saja.
    kategori = fields.Char('Kategori')

    _unique_bahan = models.Constraint(
        'UNIQUE(bahan_id)',
        'Setiap bahan baku hanya boleh memiliki satu entri SBH.',
    )
