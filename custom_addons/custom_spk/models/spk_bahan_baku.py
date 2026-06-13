from odoo import models, fields


class SpkBahanBaku(models.Model):
    _name = 'spk.bahan.baku'
    _description = 'Bahan Baku SPK'
    _order = 'id asc'

    spk_id = fields.Many2one('spk.spk', 'SPK', required=True, ondelete='cascade', index=True)
    kode_barang = fields.Char('Kode Barang')
    nama_bahan = fields.Char('Nama Bahan Baku', required=True)
    qty = fields.Float('Qty', default=1.0, digits=(16, 2))
    harga = fields.Float('Harga (Rp)', default=0.0, digits=(16, 0))
    pic_id = fields.Many2one('res.users', 'PIC Bahan', domain=[('active', '=', True)])
