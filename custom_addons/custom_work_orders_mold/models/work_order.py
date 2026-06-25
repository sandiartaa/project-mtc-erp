import base64
import mimetypes
from datetime import datetime

from odoo import models, fields, api
from odoo.exceptions import AccessError, ValidationError


class WoWorkOrder(models.Model):
    """Work Order — tabel custom modul ini (tidak menyentuh tabel bawaan)."""
    _name = 'wom.work.order'
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
    # Brand — dropdown ke model custom wom.brand (isinya bisa di-CRUD).
    brand_id = fields.Many2one('wom.brand', 'Brand', ondelete='set null')
    # Job Type — dropdown ke model custom wom.job.type (isinya bisa di-CRUD).
    job_type_id = fields.Many2one('wom.job.type', 'Job Type', ondelete='set null')
    details = fields.Text('Details')
    # Image referensi dari pembuat WO (acuan untuk designer mengerjakan).
    image = fields.Binary('Reference Image', attachment=True)
    # Penanda ada/tidak gambar referensi (untuk thumbnail di daftar tanpa menarik data besar)
    image_ada = fields.Boolean(
        'Ada Gambar Referensi', compute='_compute_image_ada', store=True
    )

    # ── Image hasil designer ──
    # Tiap pengajuan approval, designer meng-upload image (lihat wom.design.image).
    # Yang ditampilkan di daftar adalah image TERBARU dari designer.
    design_image_ids = fields.One2many(
        'wom.design.image', 'work_order_id', 'Designer Images'
    )
    last_design_image_id = fields.Many2one(
        'wom.design.image', 'Image Designer Terakhir',
        compute='_compute_design_info', store=True
    )
    design_image_ada = fields.Boolean(
        'Ada Image Designer', compute='_compute_design_info', store=True
    )
    design_count = fields.Integer(
        'Jumlah Image Designer', compute='_compute_design_info'
    )

    # ── IN CHARGE ──
    # Designer 2D/3D: user yang punya akses modul Work Order Mold (lihat users_incharge).
    incharge_id = fields.Many2one('res.users', 'Designer 2D/3D', ondelete='set null')
    # Nama designer ketikan bebas (dipakai bila designer bukan user sistem).
    incharge_custom = fields.Char('Designer (Custom)')
    lokal_rrc = fields.Selection(
        [('lokal', 'Lokal'), ('rrc', 'RRC')], string='Lokal/RRC'
    )

    # ── Requestor ── (daftar custom wom.person, bukan res.users)
    requestor_id = fields.Many2one('wom.person', 'Requestor', ondelete='set null')
    # Catatan: "Diinput oleh" memakai create_uid bawaan (user pembuat record yang
    # sebenarnya) — selalu user yang login, bukan superuser/OdooBot.

    # ── Timeline ──
    request_date = fields.Date('Req Date')
    target_date = fields.Date('Target')
    finish_date = fields.Date('Finish Date')

    # ── Approval ── (daftar custom wom.person, bukan res.users)
    approver_id = fields.Many2one('wom.person', 'Approver', ondelete='set null')
    approval_date = fields.Date('Approval Date')

    # ── Status keseluruhan + filter ──
    status = fields.Selection(
        [('ongoing', 'Ongoing'), ('finished', 'Finished')],
        string='Status', default='ongoing', index=True
    )

    # ── Alur pengajuan approval ──
    # draft  : belum diajukan (default)
    # ready  : Designer menekan "Ready for Approval" → menunggu approval user Full
    # approved: user Full menyetujui
    approval_state = fields.Selection(
        [('draft', 'Belum Diajukan'), ('ready', 'Menunggu Approval'),
         ('approved', 'Disetujui')],
        string='Status Approval', default='draft', index=True, copy=False
    )

    # Penanda batch impor — agar data hasil 1x impor bisa dihapus terpisah.
    import_batch = fields.Char('Batch Impor', index=True, copy=False)

    # ── Riwayat revisi ── (dibuat saat pengajuan approval ditolak)
    revisi_ids = fields.One2many('wom.revision', 'work_order_id', 'Revisions')
    revisi_count = fields.Integer('Jumlah Revisi', compute='_compute_revisi_count')

    @api.depends('image')
    def _compute_image_ada(self):
        for rec in self:
            rec.image_ada = bool(rec.image)

    @api.depends('design_image_ids')
    def _compute_design_info(self):
        """Hitung image designer terbaru. design_image_ids sudah urut id desc
        (lihat _order di wom.design.image), jadi elemen pertama = terbaru."""
        for rec in self:
            last = rec.design_image_ids[:1]
            rec.last_design_image_id = last.id if last else False
            rec.design_image_ada = bool(last)
            rec.design_count = len(rec.design_image_ids)

    @api.depends('revisi_ids')
    def _compute_revisi_count(self):
        for rec in self:
            rec.revisi_count = len(rec.revisi_ids)

    # Nama channel bus untuk siaran perubahan ke semua klien yang sedang membuka app.
    _BUS_CHANNEL = 'wom_work_order'
    _BUS_TYPE = 'wom_work_order/changed'

    def _notify_changed(self):
        """Siarkan sinyal 'data berubah' lewat bus Odoo agar semua klien yang
        sedang membuka Work Order Mold memuat ulang daftarnya (real-time, tanpa refresh).
        Payload sengaja kosong — hanya pemicu reload, tidak membawa data."""
        self.env['bus.bus']._sendone(self._BUS_CHANNEL, self._BUS_TYPE, {})

    # Ekstensi file gambar yang umum (untuk penamaan saat unduh).
    _IMG_EXT = {
        'image/png': '.png', 'image/jpeg': '.jpg', 'image/jpg': '.jpg',
        'image/gif': '.gif', 'image/webp': '.webp', 'image/bmp': '.bmp',
        'image/svg+xml': '.svg',
    }

    def _rename_image_attachment(self):
        """Beri nama file gambar sesuai No. Work Order (mis. 'WO00016.png').
        Gambar disimpan sebagai ir.attachment (filestore); yang diubah adalah
        nama file-nya — terlihat saat gambar diunduh."""
        Att = self.env['ir.attachment'].sudo()
        for rec in self:
            if not rec.image:
                continue
            att = Att.search([
                ('res_model', '=', 'wom.work.order'),
                ('res_field', '=', 'image'),
                ('res_id', '=', rec.id),
            ], limit=1)
            if not att:
                continue
            ext = self._IMG_EXT.get(
                att.mimetype, mimetypes.guess_extension(att.mimetype or '') or '.png'
            )
            nama = (rec.wo_number or 'WO') + ext
            if att.name != nama:
                att.name = nama

    # ─── AUDIT (History: siapa membuat/mengedit/menghapus apa) ───────────────
    # Field yang tidak perlu masuk keterangan audit (otomatis/turunan).
    _AUDIT_ABAIKAN = (
        'id', 'create_uid', 'create_date', 'write_uid', 'write_date',
        'image_ada', 'design_image_ada', 'last_design_image_id', 'design_count',
        'import_batch',
    )

    def _catat_audit(self, aksi, keterangan, user=None):
        """Tulis 1 baris log audit per record (selalu via sudo).
        user: pemilik aksi sebenarnya (default user yang login saat ini)."""
        Audit = self.env['wom.audit'].sudo()
        uid = (user or self.env.user).id
        for rec in self:
            Audit.create({
                'work_order_id': rec.id,
                'wo_number': rec.wo_number,
                'wo_name': rec.name,
                'aksi': aksi,
                'keterangan': keterangan,
                'user_id': uid,
            })

    def _ket_perubahan(self, vals):
        """Rangkai keterangan 'Ubah: <label field>' dari vals (buang field turunan)."""
        labels = []
        for key in vals:
            if key in self._AUDIT_ABAIKAN:
                continue
            f = self._fields.get(key)
            if f:
                labels.append(f.string or key)
        return ('Ubah: ' + ', '.join(labels)) if labels else ''

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('wo_number', 'New') in (False, 'New', ''):
                vals['wo_number'] = (
                    self.env['ir.sequence'].next_by_code('wom.work.order') or 'New'
                )
        records = super().create(vals_list)
        records._rename_image_attachment()
        records._catat_audit('create', 'Work Order dibuat')
        records._notify_changed()
        return records

    def write(self, vals):
        res = super().write(vals)
        if 'image' in vals:
            self._rename_image_attachment()
        # Audit hanya untuk edit oleh user nyata (proses sudo internal approval
        # dicatat eksplisit di method-nya, jadi dilewati di sini).
        if not self.env.su and not self.env.context.get('skip_wo_audit'):
            ket = self._ket_perubahan(vals)
            if ket:
                self._catat_audit('edit', ket)
        self._notify_changed()
        return res

    def unlink(self):
        self._catat_audit('delete', 'Work Order dihapus')
        res = super().unlink()
        self._notify_changed()
        return res

    @api.model
    def boleh_ubah(self):
        """True jika user boleh Create/Update/Delete (anggota grup Full).
        User Designer/Read-only akan mendapat False sehingga tombol aksi disembunyikan."""
        return self.env.user.has_group('custom_work_orders_mold.group_wom_user')

    @api.model
    def peran_akses(self):
        """Peran user untuk modul ini: full / designer / readonly.
        Dipakai frontend untuk menentukan tombol & filter yang tampil."""
        u = self.env.user
        return {
            'full': u.has_group('custom_work_orders_mold.group_wom_user'),
            'designer': u.has_group('custom_work_orders_mold.group_wom_designer'),
            'readonly': u.has_group('custom_work_orders_mold.group_wom_readonly'),
        }

    @api.model
    def daftar_designer_filter(self):
        """Daftar designer unik yang dipakai di WO (user sistem & nama custom),
        untuk dropdown filter (akses Full & Read-only). key: 'u:<id>' atau 'c:<nama>'."""
        recs = self.search([])
        hasil = {}
        for r in recs:
            if r.incharge_id:
                hasil['u:%d' % r.incharge_id.id] = r.incharge_id.name
            elif r.incharge_custom:
                hasil['c:%s' % r.incharge_custom] = r.incharge_custom
        return [{'key': k, 'label': v}
                for k, v in sorted(hasil.items(), key=lambda x: (x[1] or '').lower())]

    # ─── ALUR APPROVAL ───────────────────────────────────────────────────────
    def _cek_designer_atau_full(self):
        """Hanya Designer 2D/3D dari WO ini, atau user Full, yang boleh
        mengajukan/membatalkan pengajuan."""
        user = self.env.user
        if user.has_group('custom_work_orders_mold.group_wom_user'):
            return
        for rec in self:
            if rec.incharge_id.id != user.id:
                raise AccessError(
                    "Hanya Designer 2D/3D dari Work Order ini yang boleh mengajukan/membatalkan."
                )

    def _cek_full(self):
        if not self.env.user.has_group('custom_work_orders_mold.group_wom_user'):
            raise AccessError("Hanya user akses Full yang boleh menyetujui/menolak.")

    def action_set_ready(self, image=None, description=None):
        """Designer mengajukan WO untuk approval (draft → ready).
        WAJIB mengisi description; image hasil designer OPSIONAL. Keduanya
        disimpan sebagai record wom.design.image (riwayat). Image terbaru inilah
        yang ditampilkan di daftar Work Order (bila ada).
        Pakai sudo agar Designer ber-akses read-only tetap bisa mengajukan
        sendiri, namun dibatasi oleh _cek_designer_atau_full di atas."""
        self._cek_designer_atau_full()
        self.ensure_one()
        teks = (description or '').strip()
        if not teks:
            raise ValidationError("Deskripsi wajib diisi saat mengajukan approval.")
        img = self._parse_image(image)  # opsional
        self.env['wom.design.image'].sudo().create({
            'work_order_id': self.id,
            'image': img or False,
            'description': teks,
        })
        self.sudo().write({'approval_state': 'ready'})
        self._catat_audit('edit', 'Diajukan untuk approval (Ready)')
        return True

    def action_cancel_ready(self):
        """Designer membatalkan pengajuan (ready → draft) — penjaga dari salah ajukan."""
        self._cek_designer_atau_full()
        self.sudo().write({'approval_state': 'draft'})
        self._catat_audit('edit', 'Batal pengajuan approval (kembali Draft)')
        return True

    def action_approve(self):
        """User Full menyetujui WO yang sudah ready (ready → approved).
        Approved otomatis menandai status keseluruhan menjadi Finished
        (status Finished juga tetap bisa diatur manual dari form)."""
        self._cek_full()
        self.with_context(skip_wo_audit=True).write(
            {'approval_state': 'approved', 'status': 'finished'})
        self._catat_audit('edit', 'Disetujui (Approved) → Finished')
        return True

    def action_reject(self, detail=None, image=None):
        """User Full menolak pengajuan (kembali ke draft) dengan catatan revisi.
        Detail revisi wajib diisi; gambar opsional (drag-drop/upload). Disimpan
        sebagai record wom.revision (riwayat: isi revisi, gambar, oleh siapa, kapan)."""
        self._cek_full()
        teks = (detail or '').strip()
        if not teks:
            raise ValidationError("Detail Revision wajib diisi saat menolak.")
        img = self._parse_image(image)
        self.env['wom.revision'].create(
            [{'work_order_id': rec.id, 'detail': teks, 'image': img or False}
             for rec in self]
        )
        self.with_context(skip_wo_audit=True).write({'approval_state': 'draft'})
        self._catat_audit('edit', 'Ditolak (Reject) — revisi diminta')
        return True

    @api.model
    def users_incharge(self):
        """Semua user yang punya akses modul Work Order Mold — baik Full maupun
        Read-only — untuk dropdown Designer 2D/3D."""
        users = self.env['res.users'].browse()
        for xmlid in (
            'custom_work_orders_mold.group_wom_user',
            'custom_work_orders_mold.group_wom_designer',
            'custom_work_orders_mold.group_wom_readonly',
        ):
            grp = self.env.ref(xmlid, raise_if_not_found=False)
            if grp:
                users |= grp.all_user_ids
        users = users.filtered(lambda u: u.active)
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

        # Cache job type: nama(lower) -> id. Buat baru bila belum ada.
        JobType = self.env['wom.job.type']
        job_types = {(jt['name'] or '').strip().lower(): jt['id']
                     for jt in JobType.daftar_job_type()}

        def job_type_id(nama):
            if not nama:
                return False
            key = nama.lower()
            if key not in job_types:
                job_types[key] = JobType.create({'name': nama}).id
            return job_types[key]

        # Cache brand: nama(lower) -> id. Buat baru bila belum ada.
        Brand = self.env['wom.brand']
        brands = {(b['name'] or '').strip().lower(): b['id']
                  for b in Brand.daftar_brand()}

        def brand_id(nama):
            if not nama:
                return False
            key = nama.lower()
            if key not in brands:
                brands[key] = Brand.create({'name': nama}).id
            return brands[key]

        # Cache person (Requestor/Approver): nama(lower) -> id. Buat baru bila belum ada.
        Person = self.env['wom.person']
        persons = {(p['name'] or '').strip().lower(): p['id']
                   for p in Person.daftar_person()}

        def person_id(nama):
            if not nama:
                return False
            key = nama.lower()
            if key not in persons:
                persons[key] = Person.create({'name': nama}).id
            return persons[key]

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
                'brand_id': brand_id(ambil(r, 'Brand', 'brand', 'Merek')),
                'job_type_id': job_type_id(ambil(r, 'Job Type', 'JobType', 'job_type', 'Tipe')),
                'details': ambil(r, 'Details', 'details') or False,
                # Image TIDAK diimpor — dimasukkan/diedit manual lewat form.
                'incharge_id': user_id(designer),
                'lokal_rrc': lr_map.get(lr, False),
                'requestor_id': person_id(requestor),
                'request_date': self._parse_tanggal(ambil(r, 'Req Date', 'Request', 'request', 'Req')),
                'target_date': self._parse_tanggal(ambil(r, 'Target', 'target', 'Deadline')),
                'finish_date': self._parse_tanggal(ambil(r, 'Finish Date', 'Finish', 'finish_date')),
                'approver_id': person_id(approver),
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
