from odoo import models, fields


class SpkBarang(models.Model):
    """Master data barang/produk milik modul SPK.

    Tabel sendiri (BUKAN product.product bawaan) agar SPK punya sumber nama
    produk yang dikelola penuh oleh modul ini. Nama SPK diambil dari sini,
    dan modul tetap bisa di-uninstall tanpa menyentuh tabel bawaan Odoo.
    """
    _name = 'spk.barang'
    _description = 'Barang / Produk SPK'
    _order = 'name asc'

    kode = fields.Char('Kode Barang')
    name = fields.Char('Nama Barang', required=True, index=True)
    harga = fields.Float('Harga (Rp)', default=0.0, digits=(16, 0))
    # Satuan harga — master sendiri (spk.satuan) agar bisa tambah/edit/hapus
    satuan_id = fields.Many2one('spk.satuan', 'Satuan', ondelete='set null')
    pic_id = fields.Many2one('res.users', 'PIC', domain=[('active', '=', True)])
    kategori_id = fields.Many2one('spk.kategori', 'Kategori', ondelete='set null')
    gudang_id = fields.Many2one('spk.gudang', 'Gudang', ondelete='set null')
    keterangan = fields.Char('Keterangan')
    active = fields.Boolean('Aktif', default=True)
