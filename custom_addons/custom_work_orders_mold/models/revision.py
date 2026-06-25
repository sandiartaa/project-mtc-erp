from odoo import models, fields, api


class WoRevision(models.Model):
    """Riwayat revisi Work Order — dibuat otomatis saat pengajuan approval
    ditolak (Reject). Tabel custom sendiri (tidak menyentuh tabel bawaan).
    create_uid & create_date bawaan Odoo dipakai untuk mencatat oleh siapa
    dan kapan revisi diminta."""
    _name = 'wom.revision'
    _description = 'Work Order Revision'
    _order = 'id desc'

    work_order_id = fields.Many2one(
        'wom.work.order', 'Work Order', required=True, ondelete='cascade', index=True
    )
    detail = fields.Text('Detail Revision', required=True)
    # Gambar opsional pendukung revisi (di-upload user Full saat menolak).
    image = fields.Binary('Image', attachment=True)

    @api.model
    def revisi_wo(self, work_order_id):
        """Daftar revisi satu Work Order: [{id, detail, tanggal, oleh}] terbaru dulu."""
        wid = int(work_order_id)
        hasil = []
        for r in self.search([('work_order_id', '=', wid)], order='id desc'):
            tgl = ''
            if r.create_date:
                tgl = fields.Datetime.context_timestamp(
                    r, r.create_date).strftime('%Y-%m-%d %H:%M')
            hasil.append({
                'id': r.id,
                'detail': r.detail or '',
                'tanggal': tgl,
                'oleh': r.create_uid.name or '',
                'ada_gambar': bool(r.image),
            })
        return hasil
