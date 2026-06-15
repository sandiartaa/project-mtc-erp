from odoo import models, fields


class SpkHpr(models.Model):
    _name = 'spk.hpr'
    _description = 'HPR — Catatan Hasil Produksi per Pengiriman SPK'
    _order = 'tanggal_kirim asc, id asc'

    # Satu catatan = satu event produksi/pengiriman untuk SPK (boleh banyak per SPK).
    # Setiap catatan mengurangi kebutuhan semua bahan baku sesuai formulasinya (akumulatif).
    spk_id = fields.Many2one(
        'spk.spk', 'SPK', required=True, ondelete='cascade', index=True
    )
    tanggal_kirim = fields.Date('Tanggal Kirim')
    hasil_produksi = fields.Float('Hasil Produksi', digits=(16, 2), default=0.0)
