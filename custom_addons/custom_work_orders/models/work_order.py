import base64
from datetime import datetime

from odoo import models, fields, api


class WoWorkOrder(models.Model):
    """Work Order — tabel custom modul ini (tidak menyentuh tabel bawaan)."""
    _name = 'wo.work.order'
    _description = 'Work Order'
    _order = 'id desc'
    _rec_name = 'wo_number'

    # ── No. (nomor otomatis) ──
    wo_number = fields.Char(
        'No.', readonly=True, copy=False, default='New', index=True
    )

    # ── Product ──
    name = fields.Char('Name', required=True, index=True)
    code = fields.Char('Code', index=True)
    brand = fields.Char('Brand')
    details = fields.Text('Details')
    image = fields.Binary('Image', attachment=True)
    # Penanda ada/tidak gambar (untuk thumbnail di daftar tanpa menarik data besar)
    image_ada = fields.Boolean(
        'Ada Gambar', compute='_compute_image_ada', store=True
    )

    # ── IN CHARGE ──
    # Designer 2D/3D: user yang punya akses modul Work Orders (lihat users_incharge).
    incharge_id = fields.Many2one('res.users', 'Designer 2D/3D', ondelete='set null')
    lokal_rrc = fields.Selection(
        [('lokal', 'Lokal'), ('rrc', 'RRC')], string='Lokal/RRC'
    )

    # ── Requestor ──
    requestor_id = fields.Many2one('res.users', 'Requestor', ondelete='set null')

    # ── Timeline ──
    request_date = fields.Date('Req Date')
    target_date = fields.Date('Target')
    finish_date = fields.Date('Finish Date')

    # ── Approval ──
    approver_id = fields.Many2one('res.users', 'Approver', ondelete='set null')
    approval_date = fields.Date('Approval Date')

    # ── Status keseluruhan + filter ──
    status = fields.Selection(
        [('ongoing', 'Ongoing'), ('finished', 'Finished')],
        string='Status', default='ongoing', index=True
    )

    # Penanda batch impor — agar data hasil 1x impor bisa dihapus terpisah.
    import_batch = fields.Char('Batch Impor', index=True, copy=False)

    @api.depends('image')
    def _compute_image_ada(self):
        for rec in self:
            rec.image_ada = bool(rec.image)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('wo_number', 'New') in (False, 'New', ''):
                vals['wo_number'] = (
                    self.env['ir.sequence'].next_by_code('wo.work.order') or 'New'
                )
        return super().create(vals_list)

    @api.model
    def users_incharge(self):
        """Daftar user yang punya akses modul Work Orders (untuk Designer,
        Requestor, Approver)."""
        grp = self.env.ref(
            'custom_work_orders.group_work_orders_user', raise_if_not_found=False
        )
        if not grp:
            return []
        users = grp.all_user_ids.filtered(lambda u: u.active)
        return [{'id': u.id, 'name': u.name} for u in users.sorted('name')]

    # ─── IMPOR CSV ───────────────────────────────────────────────────────────
    @api.model
    def _parse_tanggal(self, s):
        """Parse tanggal dari string CSV. Terima beberapa format umum."""
        if not s:
            return False
        s = s.strip()
        for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%d-%m-%Y', '%Y/%m/%d'):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
        return False

    @api.model
    def _parse_image(self, s):
        """Terima base64 atau data-URI ('data:image/...;base64,XXXX').
        Kembalikan base64 bersih yang valid, atau False."""
        if not s:
            return False
        s = s.strip()
        if s.startswith('data:'):
            idx = s.find('base64,')
            if idx == -1:
                return False
            s = s[idx + len('base64,'):]
        s = ''.join(s.split())  # buang spasi/baris baru
        if not s:
            return False
        try:
            base64.b64decode(s, validate=True)
        except Exception:
            return False
        return s

    @api.model
    def import_csv_rows(self, rows):
        """Buat record dari baris CSV (list of dict header->value).
        Data lama TIDAK dihapus (impor menambah). Tiap impor diberi tanda batch."""
        if not rows:
            return {'created': 0, 'batch': False}
        batch = 'IMP-' + fields.Datetime.now().strftime('%Y%m%d-%H%M%S')
        users = {(u['name'] or '').strip().lower(): u['id']
                 for u in self.users_incharge()}
        stat_map = {
            'ongoing': 'ongoing', 'berjalan': 'ongoing', 'jalan': 'ongoing', 'proses': 'ongoing',
            'finished': 'finished', 'selesai': 'finished', 'done': 'finished',
        }
        lr_map = {
            'lokal': 'lokal', 'local': 'lokal', 'rrc': 'rrc', 'china': 'rrc', 'cina': 'rrc',
        }

        def ambil(r, *keys):
            for k in keys:
                if k in r and r[k] not in (None, ''):
                    return str(r[k]).strip()
            return ''

        def user_id(nama):
            return users.get(nama.lower(), False) if nama else False

        vals_list = []
        for r in rows:
            name = ambil(r, 'Name', 'name', 'Nama', 'NAMA')
            if not name:
                continue  # baris tanpa Name dilewati
            designer = ambil(r, 'Designer 2D/3D', 'Designer', 'designer', 'InCharge', 'incharge')
            requestor = ambil(r, 'Requestor', 'requestor')
            approver = ambil(r, 'Approver', 'approver')
            lr = ambil(r, 'Lokal/RRC', 'LokalRRC', 'Lokal RRC', 'lokal_rrc', 'lokal/rrc').lower()
            stat = ambil(r, 'Status', 'status').lower()
            vals_list.append({
                'name': name,
                'code': ambil(r, 'Code', 'code') or False,
                'brand': ambil(r, 'Brand', 'brand') or False,
                'details': ambil(r, 'Details', 'details') or False,
                'image': self._parse_image(ambil(r, 'Image', 'image', 'Gambar')),
                'incharge_id': user_id(designer),
                'lokal_rrc': lr_map.get(lr, False),
                'requestor_id': user_id(requestor),
                'request_date': self._parse_tanggal(ambil(r, 'Req Date', 'Request', 'request', 'Req')),
                'target_date': self._parse_tanggal(ambil(r, 'Target', 'target', 'Deadline')),
                'finish_date': self._parse_tanggal(ambil(r, 'Finish Date', 'Finish', 'finish_date')),
                'approver_id': user_id(approver),
                'approval_date': self._parse_tanggal(ambil(r, 'Approval Date', 'Date', 'Approval', 'approval')),
                'status': stat_map.get(stat, 'ongoing'),
                'import_batch': batch,
            })
        if not vals_list:
            return {'created': 0, 'batch': False}
        self.create(vals_list)
        return {'created': len(vals_list), 'batch': batch}

    @api.model
    def daftar_batch_impor(self):
        """Ringkasan tiap batch impor: [{batch, jumlah}] terbaru dulu."""
        recs = self.search([('import_batch', '!=', False)])
        agg = {}
        for r in recs:
            agg[r.import_batch] = agg.get(r.import_batch, 0) + 1
        return [{'batch': b, 'jumlah': n}
                for b, n in sorted(agg.items(), reverse=True)]

    @api.model
    def hapus_batch_impor(self, batch):
        """Hapus hanya record dari satu batch impor."""
        if not batch:
            return 0
        recs = self.search([('import_batch', '=', batch)])
        n = len(recs)
        recs.unlink()
        return n
