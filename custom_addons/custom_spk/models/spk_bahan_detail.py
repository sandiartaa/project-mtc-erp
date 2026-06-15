from odoo import models, fields


class SpkBahanDetail(models.Model):
    _name = 'spk.bahan.detail'
    _description = 'Rincian Varian Bahan Baku SPK'
    _order = 'id asc'

    bahan_id = fields.Many2one(
        'spk.bahan.baku', 'Bahan Baku', required=True, ondelete='cascade', index=True
    )
    keterangan = fields.Char('Keterangan', required=True)
    qty = fields.Float('Qty', digits=(16, 2), required=True, default=0.0)
