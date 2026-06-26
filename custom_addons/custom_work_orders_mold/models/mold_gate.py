import uuid

from odoo import models, fields, api
from odoo.exceptions import AccessError, ValidationError


class WomCredential(models.Model):
    """Kredensial untuk Work Order Mold: pasangan Username + Password yang dibuat
    ADMIN, dengan PERAN (role):
    - requestor : boleh menambah WO Mold & meng-Approve. Namanya jadi Requestor.
    - executor  : Teknisi Repair, boleh mengisi Lead Time & Finish Repair.
    User cukup memasukkan password; sistem mencocokkannya ke username + role."""
    _name = 'wom.credential'
    _description = 'Work Order Mold Credential'
    _order = 'role, username'

    username = fields.Char('Username', required=True)
    password = fields.Char('Password', required=True)
    role = fields.Selection(
        [('requestor', 'Requestor'), ('executor', 'Executor (Teknisi Repair)')],
        string='Role', required=True, default='requestor')
    active = fields.Boolean('Active', default=True)


class WomMaster(models.Model):
    """Master Mold: daftar Code + Name mold (dikelola Administrator).
    Bisa di-CRUD & di-impor dari CSV lewat tombol 'Master Mold' di app."""
    _name = 'wom.master'
    _description = 'Work Order Mold Master'
    _order = 'code, name'

    code = fields.Char('Code')
    name = fields.Char('Mold Name', required=True)
    # Penanda batch impor (untuk hapus massal hasil 1x impor).
    import_batch = fields.Char('Import Batch', index=True)


class WomMasterImport(models.Model):
    """Log tiap impor Master Mold (nama file, jumlah, waktu) — untuk history
    & menghapus hasil impor tertentu."""
    _name = 'wom.master.import'
    _description = 'Work Order Mold Master Import Log'
    _order = 'id desc'

    batch = fields.Char('Batch', required=True, index=True)
    filename = fields.Char('File')
    jumlah = fields.Integer('Rows')


class WomDeskripsi(models.Model):
    """Pilihan deskripsi untuk Work Order Mold (mis. Lengket, Pen Putus, dll).
    Bisa dikelola requestor lewat app. Saat menambah WO, user memilih satu/lebih
    deskripsi + sub-deskripsi bebas; hasilnya disimpan ke field details biasa
    (mis. 'Lengket-Jembret#bagian A') — tidak mengubah struktur database."""
    _name = 'wom.deskripsi'
    _description = 'Work Order Mold Description Option'
    _order = 'sequence, name'

    name = fields.Char('Description', required=True)
    sequence = fields.Integer('Sequence', default=10)
    active = fields.Boolean('Active', default=True)


class WoWorkOrderMold(models.Model):
    """Gerbang modul Work Order Mold di atas model BERSAMA wo.work.order
    (wo_type='mold'). WO yang dibuat di sini otomatis muncul di app Work Orders
    (tab Mold) dan bisa diedit di sana."""
    _inherit = 'wo.work.order'

    # Catatan saat Approve oleh Requestor (untuk dilihat per WO).
    wom_approve_note = fields.Text('Mold Approve Note')

    # Field yang BOLEH diisi dari app Mold saat menambah (Requestor & Job Type
    # otomatis di server, jadi tidak termasuk di sini).
    _MOLD_ADD_FIELDS = (
        'name', 'code', 'qty', 'request_date', 'details', 'image',
    )

    @api.model
    def _wom_cek_grup(self):
        u = self.env.user
        if not (u.has_group('custom_work_orders_mold.group_work_orders_mold')
                or u.has_group('base.group_system')):
            raise AccessError("Anda tidak punya akses Work Order Mold.")

    def _wom_cek_admin(self):
        if not self.env.user.has_group('base.group_system'):
            raise AccessError("Hanya Administrator yang boleh mengelola user/password.")

    @api.model
    def wom_info(self):
        Cred = self.env['wom.credential'].sudo()
        return {
            'admin': self.env.user.has_group('base.group_system'),
            'ada_requestor': bool(Cred.search_count([('role', '=', 'requestor'), ('active', '=', True)])),
            'ada_executor': bool(Cred.search_count([('role', '=', 'executor'), ('active', '=', True)])),
        }

    @api.model
    def wom_cek_password(self, password, role=None):
        """Cocokkan password ke kredensial aktif (opsional difilter role).
        Kembalikan USERNAME bila cocok, atau False."""
        if not password:
            return False
        dom = [('password', '=', password), ('active', '=', True)]
        if role:
            dom.append(('role', '=', role))
        cred = self.env['wom.credential'].sudo().search(dom, limit=1)
        return cred.username if cred else False

    @api.model
    def wom_buat(self, vals, password):
        """Tambah WO Mold — butuh password REQUESTOR. Requestor otomatis = username."""
        self._wom_cek_grup()
        username = self.wom_cek_password(password, role='requestor')
        if not username:
            raise AccessError("Password Requestor salah.")
        bersih = {k: v for k, v in (vals or {}).items() if k in self._MOLD_ADD_FIELDS}
        if not (bersih.get('name') or '').strip():
            raise ValidationError("Mold Name wajib diisi.")
        bersih['wo_type'] = 'mold'
        # Job Type otomatis "Repair" (hanya bisa diganti di app Work Orders).
        JobType = self.env['wo.job.type'].sudo()
        jt = JobType.search([('name', '=', 'Repair')], limit=1) or JobType.create({'name': 'Repair'})
        bersih['job_type_id'] = jt.id
        # Requestor otomatis = nama penginput (username kredensial).
        Person = self.env['wo.person'].sudo()
        person = Person.search([('name', '=', username)], limit=1)
        if not person:
            person = Person.create({'name': username})
        bersih['requestor_id'] = person.id
        rec = self.create(bersih)
        return rec.id

    # ─── Pilihan deskripsi (dikelola requestor) ──────────────────────────────
    @api.model
    def wom_daftar_deskripsi(self):
        self._wom_cek_grup()
        return [{'id': d.id, 'name': d.name}
                for d in self.env['wom.deskripsi'].sudo().search([])]

    @api.model
    def wom_simpan_deskripsi(self, did, name):
        self._wom_cek_grup()
        nama = (name or '').strip()
        if not nama:
            raise ValidationError("Nama deskripsi wajib diisi.")
        D = self.env['wom.deskripsi'].sudo()
        if did:
            D.browse(int(did)).write({'name': nama})
        else:
            D.create({'name': nama})
        return True

    @api.model
    def wom_hapus_deskripsi(self, did):
        self._wom_cek_grup()
        if did:
            self.env['wom.deskripsi'].sudo().browse(int(did)).unlink()
        return True

    @api.model
    def wom_daftar(self):
        """Daftar WO Mold (wo_type='mold') untuk app — urut Req Date terbaru dulu."""
        self._wom_cek_grup()
        kolom = [
            'id', 'wo_number', 'name', 'code', 'job_type_id', 'qty',
            'details', 'requestor_id', 'request_date', 'incharge_id', 'incharge_custom',
            'lead_time', 'finish_date', 'status', 'approval_state', 'wom_approve_note',
        ]
        return self.search_read(
            [('wo_type', '=', 'mold')], kolom, order='request_date desc, id desc')

    @api.model
    def daftar_teknisi_mold(self):
        """Daftar Teknisi (kredensial role=executor) untuk dropdown Executor di
        app Work Orders (tab Mold). Hanya nama yang dikembalikan."""
        creds = self.env['wom.credential'].sudo().search(
            [('role', '=', 'executor'), ('active', '=', True)], order='username')
        return [{'id': c.id, 'name': c.username} for c in creds]

    def _nama_teknisi(self):
        """Nama Executor/Teknisi WO ini (untuk mold disimpan di incharge_custom)."""
        self.ensure_one()
        return self.incharge_custom or (self.incharge_id.name if self.incharge_id else '')

    def wom_simpan_jadwal(self, lead_time=None, finish_date=None, password=None):
        """Isi Lead Time + Finish Repair — butuh password yang SAMA dengan Teknisi
        (executor) yang dipilih di WO ini. Executor ditentukan dari app Work Orders.
        Dicatat ke History."""
        self._wom_cek_grup()
        self.ensure_one()
        if self.wo_type != 'mold':
            raise AccessError("Bukan Work Order Mold.")
        if self.status == 'finished':
            raise ValidationError(
                "Work Order sudah Finished — hanya bisa diedit di app Work Orders.")
        teknisi = self._nama_teknisi()
        if not teknisi:
            raise ValidationError("Executor (Teknisi) belum ditentukan di app Work Orders.")
        # Password HARUS milik teknisi yang dipilih pada WO ini.
        cred = self.env['wom.credential'].sudo().search([
            ('role', '=', 'executor'), ('active', '=', True),
            ('username', '=', teknisi), ('password', '=', password or '')], limit=1)
        if not cred:
            raise AccessError("Password harus sesuai Teknisi yang dipilih: %s." % teknisi)
        self.with_context(skip_wo_audit=True).write({
            'lead_time': (lead_time or '').strip() or False,
            'finish_date': finish_date or False,
        })
        self._catat_audit('edit', 'Isi Lead Time=%s, Finish Repair=%s — Teknisi: %s' % (
            (lead_time or '-'), (finish_date or '-'), teknisi))
        return True

    def wom_approve(self, note=None, password=None):
        """Approve WO Mold (mirip Ready for Approval) — butuh password REQUESTOR.
        Muncul setelah Finish Repair diisi. Note opsional. Set approval ke 'ready'."""
        self._wom_cek_grup()
        self.ensure_one()
        if self.wo_type != 'mold':
            raise AccessError("Bukan Work Order Mold.")
        if not self.finish_date:
            raise ValidationError("Finish Repair belum diisi.")
        requestor = self.wom_cek_password(password, role='requestor')
        if not requestor:
            raise AccessError("Password Requestor salah.")
        teks = (note or '').strip()
        # Disetujui requestor → otomatis Approved & Finished.
        self.with_context(skip_wo_audit=True).write({
            'approval_state': 'approved',
            'status': 'finished',
            'wom_approve_note': teks or False,
        })
        ket = 'Approved & Finished oleh Requestor: %s' % requestor
        if teks:
            ket += ' — Note: ' + teks
        self._catat_audit('edit', ket)
        return True

    # ─── Kelola kredensial (Username + Password + Role) — Administrator ───────
    @api.model
    def wom_daftar_kredensial(self):
        self._wom_cek_admin()
        creds = self.env['wom.credential'].sudo().search([])
        return [{'id': c.id, 'username': c.username, 'password': c.password,
                 'role': c.role} for c in creds]

    @api.model
    def wom_simpan_kredensial(self, cid, username, password, role):
        self._wom_cek_admin()
        nama = (username or '').strip()
        sandi = (password or '').strip()
        peran = role if role in ('requestor', 'executor') else 'requestor'
        if not nama or not sandi:
            raise ValidationError("Username & password wajib diisi.")
        Cred = self.env['wom.credential'].sudo()
        bentrok = Cred.search(
            [('password', '=', sandi)] + ([('id', '!=', int(cid))] if cid else []), limit=1)
        if bentrok:
            raise ValidationError("Password sudah dipakai. Gunakan yang berbeda.")
        vals = {'username': nama, 'password': sandi, 'role': peran}
        if cid:
            Cred.browse(int(cid)).write(vals)
        else:
            Cred.create(vals)
        return True

    @api.model
    def wom_hapus_kredensial(self, cid):
        self._wom_cek_admin()
        if cid:
            self.env['wom.credential'].sudo().browse(int(cid)).unlink()
        return True

    # ─── Master Mold (Code + Name) — Administrator: CRUD + import CSV ─────────
    @api.model
    def wom_master_daftar(self):
        self._wom_cek_admin()
        return [{'id': m.id, 'code': m.code or '', 'name': m.name}
                for m in self.env['wom.master'].sudo().search([])]

    @api.model
    def wom_master_simpan(self, mid, code, name):
        self._wom_cek_admin()
        nama = (name or '').strip()
        if not nama:
            raise ValidationError("Mold Name wajib diisi.")
        M = self.env['wom.master'].sudo()
        vals = {'code': (code or '').strip() or False, 'name': nama}
        if mid:
            M.browse(int(mid)).write(vals)
        else:
            M.create(vals)
        return True

    @api.model
    def wom_master_hapus(self, mid):
        self._wom_cek_admin()
        if mid:
            self.env['wom.master'].sudo().browse(int(mid)).unlink()
        return True

    @api.model
    def wom_master_pilihan(self):
        """Daftar Master Mold untuk dropdown di Add WO (semua user akses mold)."""
        self._wom_cek_grup()
        return [{'id': m.id, 'code': m.code or '', 'name': m.name}
                for m in self.env['wom.master'].sudo().search([])]

    @api.model
    def wom_master_import(self, rows, filename=None):
        """Impor Master Mold dari CSV. Kolom diterima: Code, Name/Mold Name.
        Tiap impor dicatat (nama file, jumlah) untuk history & hapus per impor."""
        self._wom_cek_admin()
        M = self.env['wom.master'].sudo()
        # Suffix acak agar batch tetap unik bila impor terjadi di detik yang sama.
        batch = 'IMP-' + fields.Datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:4]
        dibuat = 0
        for r in rows or []:
            nama = (r.get('Name') or r.get('Mold Name') or r.get('name')
                    or r.get('Nama') or '').strip()
            if not nama:
                continue
            code = (r.get('Code') or r.get('code') or r.get('Kode') or '').strip()
            M.create({'code': code or False, 'name': nama, 'import_batch': batch})
            dibuat += 1
        if dibuat:
            self.env['wom.master.import'].sudo().create({
                'batch': batch, 'filename': (filename or '').strip() or False, 'jumlah': dibuat})
        return {'created': dibuat, 'batch': batch if dibuat else False}

    @api.model
    def wom_master_hapus_banyak(self, ids):
        """Hapus beberapa Master Mold sekaligus (yang dicentang user)."""
        self._wom_cek_admin()
        idn = [int(i) for i in (ids or [])]
        if not idn:
            return 0
        recs = self.env['wom.master'].sudo().browse(idn).exists()
        n = len(recs)
        recs.unlink()
        return n

    @api.model
    def wom_master_daftar_batch(self):
        """History impor Master Mold: [{batch, filename, jumlah, sisa, waktu}] terbaru dulu."""
        self._wom_cek_admin()
        Master = self.env['wom.master'].sudo()
        hasil = []
        for l in self.env['wom.master.import'].sudo().search([], order='id desc'):
            w = ''
            if l.create_date:
                w = fields.Datetime.context_timestamp(l, l.create_date).strftime('%Y-%m-%d %H:%M')
            hasil.append({
                'batch': l.batch,
                'filename': l.filename or l.batch,
                'jumlah': l.jumlah,
                'sisa': Master.search_count([('import_batch', '=', l.batch)]),
                'waktu': w,
            })
        return hasil

    @api.model
    def wom_master_hapus_batch(self, batch):
        """Hapus semua Master Mold dari satu impor + log-nya."""
        self._wom_cek_admin()
        if not batch:
            return 0
        recs = self.env['wom.master'].sudo().search([('import_batch', '=', batch)])
        n = len(recs)
        recs.unlink()
        self.env['wom.master.import'].sudo().search([('batch', '=', batch)]).unlink()
        return n


class WoAuditMold(models.Model):
    """Daftar audit khusus WO bertipe mold (untuk History app Mold)."""
    _inherit = 'wo.audit'

    @api.model
    def daftar_audit_mold(self, limit=300):
        u = self.env.user
        if not (u.has_group('custom_work_orders_mold.group_work_orders_mold')
                or u.has_group('base.group_system')):
            raise AccessError("Anda tidak punya akses Work Order Mold.")
        hasil = []
        recs = self.sudo().search(
            [('work_order_id.wo_type', '=', 'mold')], order='id desc', limit=limit)
        for r in recs:
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
