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
    barang_bagus = fields.Float('Barang Kembali Bagus', digits=(16, 2), default=0.0)
    barang_rusak = fields.Float('Barang Kembali Rusak', digits=(16, 2), default=0.0)

    _unique_bahan = models.Constraint(
        'UNIQUE(bahan_id)',
        'Setiap bahan baku hanya boleh memiliki satu entri SBH.',
    )
