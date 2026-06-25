from odoo import models, fields, api


class WoDesignImage(models.Model):
    """Image hasil designer untuk sebuah Work Order.
    Dibuat tiap kali designer menekan 'Ready for Approval' (lewat popup
    upload image + description). Image terbaru-lah yang ditampilkan di
    daftar Work Order. Tabel custom sendiri (tidak menyentuh tabel bawaan).
    create_uid & create_date bawaan dipakai untuk mencatat oleh siapa & kapan."""
    _name = 'wo.design.image'
    _description = 'Work Order Designer Image'
    _order = 'id desc'

    work_order_id = fields.Many2one(
        'wo.work.order', 'Work Order', required=True, ondelete='cascade', index=True
    )
    image = fields.Binary('Image', attachment=True)
    description = fields.Text('Description')

    @api.model
    def riwayat_wo(self, work_order_id):
        """Daftar image designer satu Work Order: [{id, description, tanggal, oleh, ada_gambar}]
        terbaru dulu."""
        wid = int(work_order_id)
        hasil = []
        for r in self.search([('work_order_id', '=', wid)], order='id desc'):
            tgl = ''
            if r.create_date:
                tgl = fields.Datetime.context_timestamp(
                    r, r.create_date).strftime('%Y-%m-%d %H:%M')
            hasil.append({
                'id': r.id,
                'description': r.description or '',
                'tanggal': tgl,
                'oleh': r.create_uid.name or '',
                'ada_gambar': bool(r.image),
            })
        return hasil
