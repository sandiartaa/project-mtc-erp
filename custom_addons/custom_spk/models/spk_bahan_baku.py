from odoo import models, fields


class SpkBahanBaku(models.Model):
    _name = 'spk.bahan.baku'
    _description = 'Bahan Baku SPK'
    _order = 'id asc'

    spk_id = fields.Many2one('spk.spk', 'SPK', required=True, ondelete='cascade', index=True)
    kode_barang = fields.Char('Kode Barang')
    nama_bahan = fields.Char('Nama Bahan Baku', required=True)
    qty = fields.Float('Qty', default=1.0, digits=(16, 2))
    # True = user override qty manual; False = qty mengikuti formulasi otomatis
    is_qty_custom = fields.Boolean('Qty Custom', default=False)
    harga = fields.Float('Harga (Rp)', default=0.0, digits=(16, 0))
    pic_id = fields.Many2one('res.users', 'PIC Bahan', domain=[('active', '=', True)])
    gudang_asal = fields.Char('Gudang Asal')
    keterangan = fields.Char('Keterangan')
    has_rincian = fields.Boolean('Aktifkan Rincian', default=False)

    def write(self, vals):
        # Jika nama_bahan berubah, sinkronkan ke formulasi SPK yang sama
        if 'nama_bahan' in vals:
            new_nama = vals['nama_bahan']
            for rec in self:
                if rec.nama_bahan != new_nama:
                    formulasi = self.env['spk.formulasi'].search([
                        ('spk_id', '=', rec.spk_id.id),
                        ('nama_bahan', '=', rec.nama_bahan),
                    ])
                    if formulasi:
                        formulasi.write({'nama_bahan': new_nama})
        return super().write(vals)
