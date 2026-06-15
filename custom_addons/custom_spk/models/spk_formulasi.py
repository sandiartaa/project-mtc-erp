from odoo import models, fields


class SpkFormulasi(models.Model):
    _name = 'spk.formulasi'
    _description = 'Formulasi Produk SPK'
    _order = 'id asc'

    spk_id = fields.Many2one('spk.spk', 'SPK', required=True, ondelete='cascade', index=True)
    nama_bahan = fields.Char('Nama Bahan', required=True)
    qty = fields.Float('Qty', default=1.0, digits=(16, 2))
    satuan_hitung = fields.Selection([
        ('pcs', 'Per Pcs'),
        ('layer', 'Per Layer'),
        ('karton', 'Per Karton'),
    ], string='Per Satuan', required=True, default='pcs')
    is_pengganti = fields.Boolean('Barang Pengganti', default=False)
    boleh_ubah_qty = fields.Boolean('Boleh Ubah Qty', default=True)
    boleh_hapus = fields.Boolean('Boleh Dihapus', default=True)

    # Odoo 19: pakai models.Constraint, bukan _sql_constraints (sudah deprecated)
    _unique_spk_bahan = models.Constraint(
        'UNIQUE(spk_id, nama_bahan)',
        'Bahan yang sama sudah ada dalam formulasi SPK ini.',
    )
