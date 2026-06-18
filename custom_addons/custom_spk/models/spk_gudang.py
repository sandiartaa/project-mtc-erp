from odoo import models, fields


class SpkGudang(models.Model):
    """Master gudang untuk barang/produk SPK.

    Tabel sendiri agar daftar gudang bisa ditambah/diedit/dihapus user
    (lewat popup Kelola Gudang).
    """
    _name = 'spk.gudang'
    _description = 'Gudang SPK'
    _order = 'name asc'

    name = fields.Char('Nama Gudang', required=True, index=True)
    active = fields.Boolean('Aktif', default=True)
