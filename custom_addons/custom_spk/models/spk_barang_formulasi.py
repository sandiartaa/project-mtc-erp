from odoo import models, fields


class SpkBarangFormulasi(models.Model):
    """Formulasi (resep bahan) milik satu master barang spk.barang.

    Tabel terpisah dari spk.formulasi (yang menempel ke SPK). Di sini formulasi
    menempel langsung ke master barang: satu barang BOLEH punya banyak baris
    formulasi, boleh juga tidak punya sama sekali. Karena ondelete='cascade',
    formulasi otomatis ikut terhapus bila barang induknya dihapus.
    """
    _name = 'spk.barang.formulasi'
    _description = 'Formulasi per Master Barang SPK'
    _order = 'id asc'

    barang_id = fields.Many2one('spk.barang', 'Barang', required=True, ondelete='cascade', index=True)
    nama_bahan = fields.Char('Nama Bahan', required=True)
    qty = fields.Float('Qty', default=1.0, digits=(16, 2))
    satuan_hitung = fields.Selection([
        ('pcs', 'Per Pcs'),
        ('layer', 'Per Layer'),
        ('karton', 'Per Karton'),
    ], string='Per Satuan', required=True, default='pcs')
    keterangan = fields.Char('Keterangan')

    # Odoo 19: pakai models.Constraint, bukan _sql_constraints (sudah deprecated)
    _unique_barang_bahan = models.Constraint(
        'UNIQUE(barang_id, nama_bahan)',
        'Bahan yang sama sudah ada dalam formulasi barang ini.',
    )
