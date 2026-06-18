from odoo import models, fields


class SpkSatuan(models.Model):
    """Master satuan untuk barang/produk SPK.

    Tabel sendiri agar daftar satuan bisa ditambah/diedit/dihapus oleh user
    (lewat popup Kelola Satuan), tidak lagi hard-coded.
    """
    _name = 'spk.satuan'
    _description = 'Satuan Barang SPK'
    _order = 'name asc'

    name = fields.Char('Nama Satuan', required=True, index=True)
    active = fields.Boolean('Aktif', default=True)
