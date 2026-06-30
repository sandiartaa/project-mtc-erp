from odoo import models, fields, api
from odoo.exceptions import AccessError

# Daftar grup "akses modul" yang dikelola dari Master User.
# (xmlid grup, label tampilan). Grup yang modulnya belum terpasang dilewati.
MODUL_AKSES = [
    ('custom_spk.group_spk_user', 'SPK'),
    # Work Orders punya 3 level: Full (CRUD + approve), Designer (WO miliknya +
    # Ready for Approval), Read-only (lihat semua, tanpa aksi).
    # Admin pilih salah satu untuk tiap user.
    # Work Orders: Full (semua + semua tab), Read-only (read + semua tab).
    ('custom_work_orders.group_work_orders_user', 'Work Orders (Full)'),
    ('custom_work_orders.group_work_orders_readonly', 'Work Orders (Read-only)'),
    # "WO Tab: <jenis>" = peran Designer untuk jenis itu (hanya tab tsb).
    # Menggantikan grup "Work Orders (Designer)" lama (sudah digabung ke WO Tab: Design).
    ('custom_work_orders.group_wo_type_design', 'WO Tab: Design'),
    ('custom_work_orders.group_wo_type_mold', 'WO Tab: Mold'),
    ('custom_work_orders.group_wo_type_maintenance', 'WO Tab: Maintenance'),
    ('custom_work_orders.group_wo_type_utility', 'WO Tab: Utility'),
    # Work Order Mold — hanya 1 akses (berbagi data dengan Work Orders, tab Mold).
    ('custom_work_orders_mold.group_work_orders_mold', 'Work Order Mold'),
    # NPI — satu akses untuk modul NPI.
    ('npi.group_npi_user', 'NPI'),
]


class MuUserRiwayat(models.Model):
    """Riwayat perubahan data master user (audit log).

    Mencatat siapa pembuat entri, siapa saja yang mengedit, dan kapan.
    Ditulis secara sudo (sistem) agar user non-admin yang mengedit lewat
    menu lain tetap tercatat tanpa butuh akses tulis ke tabel ini.
    """
    _name = 'mu.user.riwayat'
    _description = 'Riwayat Perubahan Data User'
    _order = 'id desc'

    info_id = fields.Many2one(
        'cui.user.info', 'Data User',
        required=True, ondelete='cascade', index=True
    )
    aksi = fields.Selection(
        [('create', 'Dibuat'), ('edit', 'Diedit')],
        string='Aksi', required=True
    )
    keterangan = fields.Char('Keterangan')
    user_id = fields.Many2one(
        'res.users', 'Oleh',
        default=lambda self: self.env.user, readonly=True
    )
    waktu = fields.Datetime('Waktu', default=fields.Datetime.now, readonly=True)


class CuiUserInfo(models.Model):
    """Tambahan ke model custom cui.user.info (model milik sendiri, bukan
    bawaan Odoo) untuk: relasi riwayat + pencatatan audit + tombol History.
    """
    _inherit = 'cui.user.info'

    riwayat_ids = fields.One2many('mu.user.riwayat', 'info_id', 'Riwayat')

    def _catat_riwayat(self, aksi, keterangan):
        # user_id diisi user nyata (self.env.user), create dijalankan sudo
        # agar pencatatan tidak gagal karena keterbatasan akses.
        riwayat = self.env['mu.user.riwayat'].sudo()
        for rec in self:
            riwayat.create({
                'info_id': rec.id,
                'aksi': aksi,
                'keterangan': keterangan,
                'user_id': self.env.user.id,
            })

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records._catat_riwayat('create', 'Data user dibuat')
        return records

    def write(self, vals):
        res = super().write(vals)
        if not self.env.context.get('skip_riwayat'):
            magic = ('id', 'create_uid', 'create_date', 'write_uid', 'write_date')
            labels = []
            for key in vals:
                if key in magic:
                    continue
                field = self._fields.get(key)
                if field:
                    labels.append(field.string or key)
            ket = 'Ubah: ' + ', '.join(labels) if labels else 'Diedit'
            self._catat_riwayat('edit', ket)
        return res

    # ─── AKSES MODUL (kelola grup app per user dari Master User) ──────────────
    @api.model
    def modul_akses_tersedia(self):
        """Daftar grup akses modul yang tersedia (modul terpasang saja)."""
        hasil = []
        for xmlid, label in MODUL_AKSES:
            grp = self.env.ref(xmlid, raise_if_not_found=False)
            if grp:
                hasil.append({'id': grp.id, 'label': label})
        return hasil

    @api.model
    def akses_modul_user(self, user_id):
        """Status tiap modul (granted/tidak) untuk satu user."""
        user = self.env['res.users'].browse(int(user_id))
        dimiliki = set(user.all_group_ids.ids)
        return [
            {'id': g['id'], 'label': g['label'], 'granted': g['id'] in dimiliki}
            for g in self.modul_akses_tersedia()
        ]

    @api.model
    def akses_modul_map(self, user_ids):
        """Map {user_id: [label modul]} untuk ditampilkan di daftar."""
        tersedia = self.modul_akses_tersedia()
        res = {}
        for u in self.env['res.users'].browse([int(i) for i in user_ids]):
            gids = set(u.all_group_ids.ids)
            res[str(u.id)] = [g['label'] for g in tersedia if g['id'] in gids]
        return res

    @api.model
    def set_akses_modul(self, user_id, granted_ids):
        """Atur keanggotaan grup modul untuk user.
        Hanya menyentuh grup yang ada di MODUL_AKSES (grup lain tidak diubah).
        """
        if not self.env.user.has_group('base.group_system'):
            raise AccessError('Hanya Administrator yang boleh mengatur akses modul.')
        tersedia = [g['id'] for g in self.modul_akses_tersedia()]
        granted = set(int(x) for x in granted_ids if int(x) in tersedia)
        user = self.env['res.users'].browse(int(user_id))
        dimiliki = set(user.group_ids.ids)
        cmds = []
        for gid in tersedia:
            if gid in granted and gid not in dimiliki:
                cmds.append((4, gid))
            elif gid not in granted and gid in dimiliki:
                cmds.append((3, gid))
        if cmds:
            user.sudo().write({'group_ids': cmds})
        return True

    @api.model
    def set_tipe_user(self, user_id, jadi_internal):
        """Ubah tipe user: Internal <-> Portal (tanpa perlu Settings bawaan)."""
        if not self.env.user.has_group('base.group_system'):
            raise AccessError('Hanya Administrator yang boleh mengubah tipe user.')
        user = self.env['res.users'].browse(int(user_id))
        internal = self.env.ref('base.group_user')
        portal = self.env.ref('base.group_portal')
        if jadi_internal:
            if not user.has_group('base.group_user'):
                user.sudo().write({'group_ids': [(3, portal.id), (4, internal.id)]})
        else:
            # Pengaman: jangan men-demote diri sendiri atau Administrator
            admin = self.env.ref('base.user_admin')
            if user.id in (self.env.user.id, admin.id):
                raise AccessError(
                    'Administrator / diri sendiri tidak boleh diubah menjadi Portal.'
                )
            if not user.share:
                # Lepas grup internal + semua grup modul (yang implikasinya internal)
                cmds = [(3, internal.id), (4, portal.id)]
                for g in self.modul_akses_tersedia():
                    cmds.append((3, g['id']))
                user.sudo().write({'group_ids': cmds})
        return True
