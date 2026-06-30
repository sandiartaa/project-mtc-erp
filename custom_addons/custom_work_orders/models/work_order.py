import base64
import mimetypes
from datetime import datetime

from odoo import models, fields, api
from odoo.exceptions import AccessError, ValidationError


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

    # ── Jenis Work Order (penentu TAB) ──
    wo_type = fields.Selection(
        [('design', 'Design'), ('mold', 'Mold'),
         ('maintenance', 'Maintenance'), ('utility', 'Utility')],
        string='Type', required=True, default='design', index=True
    )

    # ── Product ──
    name = fields.Char('Name', required=True, index=True)
    code = fields.Char('Code', index=True)
    # Brand — dropdown ke model custom wo.brand (isinya bisa di-CRUD).
    brand_id = fields.Many2one('wo.brand', 'Brand', ondelete='set null')
    # Job Type — dropdown ke model custom wo.job.type (isinya bisa di-CRUD).
    job_type_id = fields.Many2one('wo.job.type', 'Job Type', ondelete='set null')
    # Production — dropdown ke model custom wo.production (bisa di-CRUD & search).
    production_id = fields.Many2one('wo.production', 'Production', ondelete='set null')
    # Qty (jumlah) — teks bebas agar fleksibel (bisa angka atau "100 pcs").
    qty = fields.Char('Qty')
    details = fields.Text('Details')
    # Image referensi dari pembuat WO (acuan untuk designer mengerjakan).
    image = fields.Binary('Reference Image', attachment=True)
    # Penanda ada/tidak gambar referensi (untuk thumbnail di daftar tanpa menarik data besar)
    image_ada = fields.Boolean(
        'Ada Gambar Referensi', compute='_compute_image_ada', store=True
    )

    # ── Image hasil designer ──
    # Tiap pengajuan approval, designer meng-upload image (lihat wo.design.image).
    # Yang ditampilkan di daftar adalah image TERBARU dari designer.
    design_image_ids = fields.One2many(
        'wo.design.image', 'work_order_id', 'Designer Images'
    )
    last_design_image_id = fields.Many2one(
        'wo.design.image', 'Image Designer Terakhir',
        compute='_compute_design_info', store=True
    )
    design_image_ada = fields.Boolean(
        'Ada Image Designer', compute='_compute_design_info', store=True
    )
    design_count = fields.Integer(
        'Jumlah Image Designer', compute='_compute_design_info'
    )

    # ── IN CHARGE ──
    # Executor: user yang punya akses modul Work Orders (lihat users_incharge).
    incharge_id = fields.Many2one('res.users', 'Executor', ondelete='set null')
    # Nama executor ketikan bebas (dipakai bila executor bukan user sistem).
    incharge_custom = fields.Char('Executor (Custom)')
    # Section — dropdown ke model custom wo.section (mis. 2D/3D/INJ/DECO/ASSY).
    section_id = fields.Many2one('wo.section', 'Section', ondelete='set null')
    lokal_rrc = fields.Selection(
        [('lokal', 'Lokal'), ('rrc', 'RRC')], string='Lokal/RRC'
    )

    # ── Requestor ── (daftar custom wo.person, bukan res.users)
    requestor_id = fields.Many2one('wo.person', 'Requestor', ondelete='set null')
    # Catatan: "Diinput oleh" memakai create_uid bawaan (user pembuat record yang
    # sebenarnya) — selalu user yang login, bukan superuser/OdooBot.

    # ── Timeline ──
    request_date = fields.Date('Req Date')   # ditampilkan di bagian Requestor (Date)
    lead_time = fields.Char('Lead Time (Hour)')
    finish_date = fields.Date('Target Finish (Date)')

    # ── Approval ── (daftar custom wo.person, bukan res.users)
    approver_id = fields.Many2one('wo.person', 'Approver', ondelete='set null')
    approval_date = fields.Date('Approval Date')
    # Tanggal "Ready for Approval" (saat WO diajukan). Di app Work Order Mold
    # ditampilkan sebagai "Finish Repair": mengisinya = menekan Ready for Approval.
    ready_date = fields.Date('Ready Date')

    # ── Status keseluruhan + filter ──
    status = fields.Selection(
        [('ongoing', 'Ongoing'), ('hold', 'Hold'), ('finished', 'Finished')],
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
    revisi_ids = fields.One2many('wo.revision', 'work_order_id', 'Revisions')
    revisi_count = fields.Integer('Jumlah Revisi', compute='_compute_revisi_count')

    @api.depends('image')
    def _compute_image_ada(self):
        for rec in self:
            rec.image_ada = bool(rec.image)

    @api.depends('design_image_ids')
    def _compute_design_info(self):
        """Hitung image designer terbaru. design_image_ids sudah urut id desc
        (lihat _order di wo.design.image), jadi elemen pertama = terbaru."""
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
    _BUS_CHANNEL = 'wo_work_order'
    _BUS_TYPE = 'wo_work_order/changed'

    def _notify_changed(self):
        """Siarkan sinyal 'data berubah' lewat bus Odoo agar semua klien yang
        sedang membuka Work Orders memuat ulang daftarnya (real-time, tanpa refresh).
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
                ('res_model', '=', 'wo.work.order'),
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
        Audit = self.env['wo.audit'].sudo()
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

    # Prefix nomor per jenis WO: W + 2 huruf jenis (WDE/WMO/WMA/WUT).
    _PREFIX_BY_TYPE = {
        'design': 'WDE',
        'mold': 'WMO',
        'maintenance': 'WMA',
        'utility': 'WUT',
    }

    def _seed_nomor(self, pre, yymm):
        """Nomor urut TERTINGGI yang sudah dipakai untuk jenis ini di bulan yymm.
        Dipakai sebagai titik mulai counter bulanan (deterministik dari data,
        sehingga transisi dari penomoran lama mulus & tahan walau data dihapus)."""
        pola = '%s-%s' % (pre, yymm)  # mis. 'WDE-2606' → cocok 'WDE-2606xx-####'
        recs = self.sudo().with_context(active_test=False).search(
            [('wo_number', '=like', pola + '%')])
        maxn = 0
        for r in recs:
            ekor = (r.wo_number or '').rsplit('-', 1)[-1]
            if ekor.isdigit():
                maxn = max(maxn, int(ekor))
        return maxn

    def _alokasi_wo_number(self, tipe, jejak):
        """Alokasikan nomor WO: <PREFIX>-<YYMMDD>-<#### urut bulanan>.
        4 digit terakhir reset ke 0001 tiap bulan baru (otomatis karna dihitung
        per periode YYMM). `jejak` melacak nomor dalam SATU batch create agar
        beberapa WO sekaligus (mis. import) tidak bertabrakan."""
        pre = self._PREFIX_BY_TYPE.get(tipe, 'WO')
        lokal = fields.Datetime.context_timestamp(self, fields.Datetime.now())
        yymm = lokal.strftime('%y%m')
        yymmdd = lokal.strftime('%y%m%d')
        kunci = (pre, yymm)
        if kunci not in jejak:
            jejak[kunci] = self._seed_nomor(pre, yymm)
        jejak[kunci] += 1
        return '%s-%s-%04d' % (pre, yymmdd, jejak[kunci])

    def _section_bengkel(self):
        """Section khusus mold (BENGKEL). Dipakai untuk default otomatis WO Mold."""
        return self.env.ref('custom_work_orders.section_bengkel', raise_if_not_found=False)

    def _terapkan_default_mold(self, vals):
        """WO Mold otomatis: Section=BENGKEL & Local/RRC=Local (Executor = Teknisi
        Repair). Mengubah dict vals di tempat. Hanya berlaku bila wo_type='mold'."""
        bengkel = self._section_bengkel()
        if bengkel:
            vals['section_id'] = bengkel.id
        vals['lokal_rrc'] = 'lokal'
        return vals

    @api.model_create_multi
    def create(self, vals_list):
        jejak = {}  # (prefix, YYMM) -> nomor terakhir dalam batch ini
        for vals in vals_list:
            if vals.get('wo_number', 'New') in (False, 'New', ''):
                tipe = vals.get('wo_type') or 'design'
                vals['wo_number'] = self._alokasi_wo_number(tipe, jejak)
            if (vals.get('wo_type') or 'design') == 'mold':
                self._terapkan_default_mold(vals)
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
        # WO Mold dijaga tetap Section=BENGKEL & Local — hanya saat field terkait
        # ikut diubah (hindari overhead & rekursi via flag context).
        if (not self.env.context.get('skip_mold_default')
                and any(k in vals for k in ('section_id', 'lokal_rrc', 'wo_type'))):
            self._paksa_default_mold()
        return res

    def _paksa_default_mold(self):
        """Pastikan tiap WO Mold tetap Section=BENGKEL & Local/RRC=Local."""
        bengkel = self._section_bengkel()
        for rec in self:
            if rec.wo_type != 'mold':
                continue
            upd = {}
            if bengkel and rec.section_id.id != bengkel.id:
                upd['section_id'] = bengkel.id
            if rec.lokal_rrc != 'lokal':
                upd['lokal_rrc'] = 'lokal'
            if upd:
                rec.with_context(skip_mold_default=True, skip_wo_audit=True).write(upd)

    def unlink(self):
        self._catat_audit('delete', 'Work Order dihapus')
        res = super().unlink()
        self._notify_changed()
        return res

    @api.model
    def boleh_ubah(self):
        """True jika user boleh Create/Update/Delete (anggota grup Full).
        User Designer/Read-only akan mendapat False sehingga tombol aksi disembunyikan."""
        return self.env.user.has_group('custom_work_orders.group_work_orders_user')

    @api.model
    def peran_akses(self):
        """Peran user untuk modul ini: full / designer / readonly.
        Dipakai frontend untuk menentukan tombol & filter yang tampil.
        Sertakan juga 'divisi' user (dari data master, bila modulnya ada)."""
        u = self.env.user
        divisi = ''
        # cui.user.info modul terpisah — baca aman (sudo) bila terpasang.
        if 'cui.user.info' in self.env:
            info = self.env['cui.user.info'].sudo().search(
                [('user_id', '=', u.id)], limit=1)
            divisi = info.divisi or ''
        return {
            'full': u.has_group('custom_work_orders.group_work_orders_user'),
            'designer': u.has_group('custom_work_orders.group_work_orders_designer'),
            'readonly': u.has_group('custom_work_orders.group_work_orders_readonly'),
            'divisi': divisi,
        }

    # Urutan & label jenis Work Order (penentu tab).
    _WO_TYPES = [
        ('design', 'Design'), ('mold', 'Mold'),
        ('maintenance', 'Maintenance'), ('utility', 'Utility'),
    ]

    @api.model
    def tab_tersedia(self):
        """Tab jenis WO yang boleh dilihat user.
        - Full / Read-only / Administrator -> SEMUA tab.
        - Designer (grup "WO Tab: <jenis>") -> hanya tab jenis yang dimiliki.
        - Fallback (tak punya grup apa pun) -> SEMUA tab."""
        u = self.env.user
        semua = [{'value': v, 'label': l} for v, l in self._WO_TYPES]
        if (u.has_group('base.group_system')
                or u.has_group('custom_work_orders.group_work_orders_user')
                or u.has_group('custom_work_orders.group_work_orders_readonly')):
            return semua
        dipilih = [{'value': v, 'label': l} for v, l in self._WO_TYPES
                   if u.has_group('custom_work_orders.group_wo_type_%s' % v)]
        return dipilih or semua

    @api.model
    def daftar_production(self):
        """Daftar production untuk dropdown (delegasi ke model wo.production)."""
        return self.env['wo.production'].daftar_production()

    @api.model
    def daftar_section(self):
        """Daftar section untuk dropdown (delegasi ke model wo.section)."""
        return self.env['wo.section'].daftar_section()

    @api.model
    def daftar_executor_custom(self):
        """Daftar nama Executor custom (incharge_custom) yang dipakai WO, beserta
        jumlahnya — untuk fitur 'Gabung Executor' (akses Full). Nama custom muncul
        bila saat impor user tidak cocok dengan user sistem mana pun."""
        recs = self.search([('incharge_custom', '!=', False)])
        agg = {}
        for r in recs:
            nm = (r.incharge_custom or '').strip()
            if nm:
                agg[nm] = agg.get(nm, 0) + 1
        return [{'nama': n, 'jumlah': c}
                for n, c in sorted(agg.items(), key=lambda x: x[0].lower())]

    @api.model
    def gabung_executor(self, nama_custom, user_id):
        """Gabungkan semua Work Order ber-Executor custom `nama_custom` menjadi
        user sistem `user_id` (mis. 'Bu Tina' → user 'Tina' yang baru daftar).
        Hanya akses Full. Mengembalikan jumlah WO yang diperbarui."""
        self._cek_full()
        nama = (nama_custom or '').strip()
        if not nama or not user_id:
            return 0
        u = self.env['res.users'].browse(int(user_id))
        if not u.exists():
            raise ValidationError("Target user tidak ditemukan.")
        recs = self.search([('incharge_custom', '=', nama)])
        n = len(recs)
        if n:
            recs.with_context(skip_wo_audit=True).write(
                {'incharge_id': u.id, 'incharge_custom': False})
            recs._catat_audit('edit', 'Gabung Executor "%s" → %s' % (nama, u.name))
        return n

    @api.model
    def daftar_requestor_merge(self):
        """Daftar Requestor (wo.person) yang dipakai di WO beserta jumlahnya —
        untuk fitur 'Merge Requestor' (akses Full). Dipakai sebagai sumber gabung."""
        recs = self.search([('requestor_id', '!=', False)])
        agg = {}
        for r in recs:
            p = r.requestor_id
            if p:
                agg.setdefault(p.id, [p.name, 0])
                agg[p.id][1] += 1
        return [{'id': pid, 'nama': v[0], 'jumlah': v[1]}
                for pid, v in sorted(agg.items(), key=lambda x: (x[1][0] or '').lower())]

    @api.model
    def gabung_requestor(self, source_id, target_id):
        """Gabungkan Requestor `source_id` → `target_id` (wo.person). Semua WO yang
        memakai source (sebagai Requestor atau Approver) dialihkan ke target, lalu
        record person source dihapus (dedupe). Hanya akses Full.
        Mengembalikan jumlah WO yang Requestor-nya diperbarui."""
        self._cek_full()
        if not source_id or not target_id:
            return 0
        sid, tid = int(source_id), int(target_id)
        if sid == tid:
            raise ValidationError("Source dan target tidak boleh sama.")
        Person = self.env['wo.person']
        src, tgt = Person.browse(sid), Person.browse(tid)
        if not src.exists() or not tgt.exists():
            raise ValidationError("Requestor tidak ditemukan.")
        wo_req = self.search([('requestor_id', '=', sid)])
        wo_apr = self.search([('approver_id', '=', sid)])
        n = len(wo_req)
        if wo_req:
            wo_req.with_context(skip_wo_audit=True).write({'requestor_id': tid})
            wo_req._catat_audit('edit', 'Gabung Requestor "%s" → %s' % (src.name, tgt.name))
        if wo_apr:
            wo_apr.with_context(skip_wo_audit=True).write({'approver_id': tid})
        src.sudo().unlink()
        return n

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
        if user.has_group('custom_work_orders.group_work_orders_user'):
            return
        for rec in self:
            if rec.incharge_id.id != user.id:
                raise AccessError(
                    "Hanya Designer 2D/3D dari Work Order ini yang boleh mengajukan/membatalkan."
                )

    def _cek_full(self):
        if not self.env.user.has_group('custom_work_orders.group_work_orders_user'):
            raise AccessError("Hanya user akses Full yang boleh menyetujui/menolak.")

    def action_set_ready(self, image=None, description=None):
        """Designer mengajukan WO untuk approval (draft → ready).
        WAJIB mengisi description; image hasil designer OPSIONAL. Keduanya
        disimpan sebagai record wo.design.image (riwayat). Image terbaru inilah
        yang ditampilkan di daftar Work Order (bila ada).
        Pakai sudo agar Designer ber-akses read-only tetap bisa mengajukan
        sendiri, namun dibatasi oleh _cek_designer_atau_full di atas."""
        self._cek_designer_atau_full()
        self.ensure_one()
        teks = (description or '').strip()
        if not teks:
            raise ValidationError("Deskripsi wajib diisi saat mengajukan approval.")
        img = self._parse_image(image)  # opsional
        self.env['wo.design.image'].sudo().create({
            'work_order_id': self.id,
            'image': img or False,
            'description': teks,
        })
        self.sudo().write({'approval_state': 'ready'})
        self._catat_audit('edit', 'Diajukan untuk approval (Ready)')
        return True

    def tambah_design_image(self, image=None, description=None):
        """User Full menambahkan Image Approval (image hasil executor) secara
        MANUAL — dipakai untuk data hasil impor yang tanpa gambar. Disimpan
        sebagai wo.design.image (sama seperti yang di-upload executor saat Ready),
        jadi menjadi image yang ditampilkan di daftar Work Order. Image wajib,
        deskripsi opsional. Berbeda dari Reference Image (acuan dari pembuat WO)."""
        self._cek_full()
        self.ensure_one()
        img = self._parse_image(image)
        if not img:
            raise ValidationError("Gambar wajib diisi.")
        self.env['wo.design.image'].create({
            'work_order_id': self.id,
            'image': img,
            'description': (description or '').strip() or False,
        })
        self._catat_audit('edit', 'Tambah Image Approval (manual)')
        self._notify_changed()
        return True

    def simpan_jadwal(self, lead_time=None, finish_date=None):
        """Designer (pemegang WO) atau user Full mengisi Lead Time (jam) &
        Target Finish (tanggal) untuk WO-nya sendiri. Pakai sudo agar Designer
        ber-akses read-only tetap bisa menulis 2 field ini (dibatasi oleh
        _cek_designer_atau_full)."""
        self._cek_designer_atau_full()
        self.ensure_one()
        vals = {
            'lead_time': (lead_time or '').strip() or False,
            'finish_date': finish_date or False,
        }
        self.sudo().with_context(skip_wo_audit=True).write(vals)
        self._catat_audit('edit', 'Ubah Lead Time / Target Finish')
        return True

    def action_cancel_ready(self):
        """Designer membatalkan pengajuan (ready → draft) — penjaga dari salah ajukan."""
        self._cek_designer_atau_full()
        self.sudo().write({'approval_state': 'draft'})
        self._catat_audit('edit', 'Batal pengajuan approval (kembali Draft)')
        return True

    def action_approve(self, note=None):
        """User Full menyetujui WO yang sudah ready (ready → approved).
        Approved otomatis menandai status keseluruhan menjadi Finished
        (status Finished juga tetap bisa diatur manual dari form).
        'note' (Approve Detail) opsional — dicatat ke riwayat approve."""
        self._cek_full()
        self.with_context(skip_wo_audit=True).write({
            'approval_state': 'approved', 'status': 'finished',
            'approval_date': fields.Date.context_today(self),
        })
        for rec in self:
            rec._catat_approve(note=note)
        self._catat_audit('edit', 'Disetujui (Approved) → Finished')
        return True

    def _catat_approve(self, note=None, approver=None):
        """Tambahkan satu entri riwayat approve untuk WO ini. approver default =
        nama user yang login (app umum); untuk mold diisi nama Requestor."""
        self.ensure_one()
        self.env['wo.approval'].sudo().create({
            'work_order_id': self.id,
            'approver': approver or self.env.user.name,
            'note': (note or '').strip() or False,
        })

    def action_reject(self, detail=None, image=None):
        """User Full menolak pengajuan (kembali ke draft) dengan catatan revisi.
        Detail revisi wajib diisi; gambar opsional (drag-drop/upload). Disimpan
        sebagai record wo.revision (riwayat: isi revisi, gambar, oleh siapa, kapan)."""
        self._cek_full()
        teks = (detail or '').strip()
        if not teks:
            raise ValidationError("Detail Revision wajib diisi saat menolak.")
        img = self._parse_image(image)
        self.env['wo.revision'].create(
            [{'work_order_id': rec.id, 'detail': teks, 'image': img or False}
             for rec in self]
        )
        self.with_context(skip_wo_audit=True).write({'approval_state': 'draft'})
        self._catat_audit('edit', 'Ditolak (Reject) — revisi diminta')
        return True

    @api.model
    def users_incharge(self):
        """Semua user yang punya akses modul Work Orders — baik Full maupun
        Read-only — untuk dropdown Designer 2D/3D."""
        users = self.env['res.users'].browse()
        for xmlid in (
            'custom_work_orders.group_work_orders_user',
            'custom_work_orders.group_work_orders_designer',
            'custom_work_orders.group_work_orders_readonly',
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
            'hold': 'hold', 'tahan': 'hold', 'tunda': 'hold', 'pending': 'hold',
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
        JobType = self.env['wo.job.type']
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
        Brand = self.env['wo.brand']
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
        Person = self.env['wo.person']
        persons = {(p['name'] or '').strip().lower(): p['id']
                   for p in Person.daftar_person()}

        def person_id(nama):
            if not nama:
                return False
            key = nama.lower()
            if key not in persons:
                persons[key] = Person.create({'name': nama}).id
            return persons[key]

        # Cache production: nama(lower) -> id. Buat baru bila belum ada.
        Production = self.env['wo.production']
        productions = {(p['name'] or '').strip().lower(): p['id']
                       for p in Production.daftar_production()}

        def production_id(nama):
            if not nama:
                return False
            key = nama.lower()
            if key not in productions:
                productions[key] = Production.create({'name': nama}).id
            return productions[key]

        # Cache section: nama(lower) -> id. Buat baru bila belum ada.
        Section = self.env['wo.section']
        sections = {(s['name'] or '').strip().lower(): s['id']
                    for s in Section.daftar_section()}

        def section_id(nama):
            if not nama:
                return False
            key = nama.lower()
            if key not in sections:
                sections[key] = Section.create({'name': nama}).id
            return sections[key]

        type_map = {
            'design': 'design', 'mold': 'mold',
            'maintenance': 'maintenance', 'utility': 'utility',
        }

        vals_list = []
        for r in rows:
            name = ambil(r, 'Name', 'name', 'Nama', 'NAMA')
            if not name:
                continue  # baris tanpa Name dilewati
            designer = ambil(r, 'Executor', 'executor', 'Designer 2D/3D', 'Designer', 'designer', 'InCharge', 'incharge')
            # Cocokkan ke user sistem; bila tidak ada yang cocok, simpan sebagai
            # nama Executor custom (bisa digabung ke user lewat 'Gabung Executor').
            exec_uid = user_id(designer)
            requestor = ambil(r, 'Requestor', 'requestor')
            approver = ambil(r, 'Approver', 'approver')
            lr = ambil(r, 'Lokal/RRC', 'LokalRRC', 'Lokal RRC', 'lokal_rrc', 'lokal/rrc').lower()
            stat = ambil(r, 'Status', 'status').lower()
            status_final = stat_map.get(stat, 'ongoing')
            tipe = ambil(r, 'Type', 'type', 'Jenis', 'jenis', 'Tab').lower()
            vals_list.append({
                'name': name,
                'wo_type': type_map.get(tipe, 'design'),
                'code': ambil(r, 'Code', 'code') or False,
                'brand_id': brand_id(ambil(r, 'Brand', 'brand', 'Merek')),
                'job_type_id': job_type_id(ambil(r, 'Job Type', 'JobType', 'job_type', 'Tipe')),
                'production_id': production_id(ambil(r, 'Production', 'production', 'Produksi')),
                'qty': ambil(r, 'Qty', 'qty', 'Quantity', 'Jumlah') or False,
                'details': ambil(r, 'Details', 'details') or False,
                # Image TIDAK diimpor — dimasukkan/diedit manual lewat form.
                'incharge_id': exec_uid,
                'incharge_custom': (designer if (designer and not exec_uid) else False),
                'section_id': section_id(ambil(r, 'Section', 'section', 'Seksi')),
                'lokal_rrc': lr_map.get(lr, False),
                'requestor_id': person_id(requestor),
                'request_date': self._parse_tanggal(ambil(r, 'Req Date', 'Request', 'request', 'Req')),
                'lead_time': ambil(r, 'Lead Time (Hour)', 'Lead Time', 'LeadTime', 'lead_time') or False,
                'finish_date': self._parse_tanggal(ambil(r, 'Target Finish (Date)', 'Target Finish', 'Finish Date', 'Finish', 'finish_date')),
                'approver_id': person_id(approver),
                'approval_date': self._parse_tanggal(ambil(r, 'Approval Date', 'Date', 'Approval', 'approval')),
                'status': status_final,
                # Data Finished hasil impor dianggap sudah disetujui (approved).
                'approval_state': ('approved' if status_final == 'finished' else 'draft'),
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
