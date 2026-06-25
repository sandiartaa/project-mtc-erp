from odoo import models, fields, api
from odoo.exceptions import AccessError


class WoAudit(models.Model):
    """Log audit aktivitas Work Order: siapa membuat/mengedit/menghapus WO apa,
    kapan, dan keterangan singkat. Tabel custom sendiri (tidak menyentuh bawaan).
    Selalu ditulis lewat sudo agar aksi designer/read-only pun tercatat tanpa
    butuh akses tulis ke tabel ini. Hanya akses Full yang boleh melihat (History)."""
    _name = 'wo.audit'
    _description = 'Work Order Audit Log'
    _order = 'id desc'

    work_order_id = fields.Many2one(
        'wo.work.order', 'Work Order', ondelete='set null', index=True
    )
    # Snapshot nomor & nama agar log tetap terbaca meski WO dihapus.
    wo_number = fields.Char('No.')
    wo_name = fields.Char('Name')
    aksi = fields.Selection(
        [('create', 'Dibuat'), ('edit', 'Diedit'), ('delete', 'Dihapus')],
        string='Aksi', required=True
    )
    keterangan = fields.Char('Keterangan')
    user_id = fields.Many2one(
        'res.users', 'Oleh', readonly=True, ondelete='set null',
        default=lambda self: self.env.user
    )
    waktu = fields.Datetime('Waktu', default=fields.Datetime.now, readonly=True)

    @api.model
    def daftar_audit(self, limit=300):
        """Daftar aktivitas terbaru: [{id, wo, aksi, keterangan, oleh, waktu}].
        Hanya untuk akses Full."""
        if not self.env.user.has_group('custom_work_orders.group_work_orders_user'):
            raise AccessError("Hanya akses Full yang boleh melihat History.")
        hasil = []
        for r in self.sudo().search([], order='id desc', limit=limit):
            w = ''
            if r.waktu:
                w = fields.Datetime.context_timestamp(r, r.waktu).strftime('%Y-%m-%d %H:%M')
            hasil.append({
                'id': r.id,
                'wo': (r.wo_number or '—') + ((' — ' + r.wo_name) if r.wo_name else ''),
                'aksi': r.aksi,
                'keterangan': r.keterangan or '',
                'oleh': r.user_id.name or '',
                'waktu': w,
            })
        return hasil
