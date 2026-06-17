from odoo import models, fields


class SpkRiwayat(models.Model):
    _name = 'spk.riwayat'
    _description = 'Riwayat (History) Perubahan SPK'
    _order = 'id desc'

    spk_id = fields.Many2one(
        'spk.spk', 'SPK', required=True, ondelete='cascade', index=True
    )
    # Siapa yang melakukan aksi (default = user yang sedang login)
    user_id = fields.Many2one(
        'res.users', 'Oleh', required=True, default=lambda self: self.env.user
    )
    aksi = fields.Selection(
        [('create', 'Dibuat'), ('edit', 'Diedit')],
        string='Aksi', required=True, default='edit'
    )
    keterangan = fields.Char('Keterangan')
    # Waktu memakai field bawaan create_date (otomatis).
