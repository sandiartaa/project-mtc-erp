from odoo import models, fields


class SpkKategori(models.Model):
    """Master kategori barang/produk SPK.

    Tabel sendiri agar daftar kategori bisa ditambah/diedit/dihapus user
    (lewat popup Kelola Kategori), sama seperti satuan.
    """
    _name = 'spk.kategori'
    _description = 'Kategori Barang SPK'
    _order = 'name asc'

    name = fields.Char('Nama Kategori', required=True, index=True)
    active = fields.Boolean('Aktif', default=True)
