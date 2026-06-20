from odoo import models, fields, api


class CuiUserInfo(models.Model):
    """Data tambahan untuk user (res.users) TANPA menyentuh tabel bawaan.

    Tabel sendiri (cui.user.info) yang berelasi Many2one ke res.users.
    Karena res.users tidak di-inherit, modul bisa di-uninstall kapan saja
    tanpa meninggalkan kolom/bekas di tabel res_users.
    """
    _name = 'cui.user.info'
    _description = 'Data Tambahan User (Kode/Divisi/Subdivisi)'
    _order = 'kode asc'
    _rec_name = 'kode'

    user_id = fields.Many2one(
        'res.users', 'User', required=True, ondelete='cascade', index=True
    )
    # Kode otomatis: KR0001, KR0002, ... (dari ir.sequence)
    kode = fields.Char(
        'Kode', readonly=True, copy=False, default='Baru', index=True
    )
    # Divisi — pilihan baku sesuai kebutuhan
    divisi = fields.Selection(
        [
            ('staf_repacking', 'STAF REPACKING'),
            ('borongan_dalam', 'BORONGAN DALAM'),
            ('borongan_luar', 'BORONGAN LUAR'),
            ('helper', 'HELPER'),
            ('stock_keeper', 'STOCK KEEPER'),
        ],
        string='Divisi'
    )
    # Subdivisi — hanya Borongan Dalam / Borongan Luar
    subdivisi = fields.Selection(
        [
            ('borongan_dalam', 'Borongan Dalam'),
            ('borongan_luar', 'Borongan Luar'),
        ],
        string='Subdivisi'
    )
    active = fields.Boolean('Aktif', default=True)

    # Odoo 19: gunakan models.Constraint (pengganti _sql_constraints)
    _user_uniq = models.Constraint(
        'unique(user_id)',
        'Setiap user hanya boleh punya satu data tambahan.',
    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('kode', 'Baru') in (False, 'Baru'):
                vals['kode'] = (
                    self.env['ir.sequence'].next_by_code('cui.user.info') or 'Baru'
                )
        return super().create(vals_list)
