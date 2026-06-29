from odoo import models, fields, api


class WoApproval(models.Model):
    """Riwayat approve Work Order — dibuat tiap kali WO disetujui (Approve),
    baik dari app Work Orders (semua tab) maupun dari app Work Order Mold.
    Detail (note) opsional. Tabel custom sendiri; create_date dipakai sebagai
    waktu approve."""
    _name = 'wo.approval'
    _description = 'Work Order Approval History'
    _order = 'id desc'

    work_order_id = fields.Many2one(
        'wo.work.order', 'Work Order', required=True, ondelete='cascade', index=True
    )
    # Nama penyetuju: app umum = user yang menyetujui; mold = Requestor.
    approver = fields.Char('Approver')
    note = fields.Text('Approve Detail')  # opsional

    @api.model
    def riwayat_wo(self, work_order_id):
        """Daftar riwayat approve satu WO: [{id, approver, note, tanggal}] terbaru dulu."""
        wid = int(work_order_id)
        hasil = []
        for r in self.search([('work_order_id', '=', wid)], order='id desc'):
            tgl = ''
            if r.create_date:
                tgl = fields.Datetime.context_timestamp(
                    r, r.create_date).strftime('%Y-%m-%d %H:%M')
            hasil.append({
                'id': r.id,
                'approver': r.approver or '',
                'note': r.note or '',
                'tanggal': tgl,
            })
        return hasil
