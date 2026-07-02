# -*- coding: utf-8 -*-
# Model utama OEE — meniru struktur sheet "Daily Entry" pada file rekap Excel:
# input manual = tanggal, shift, mesin, mold, downtime, waktu tersedia,
# counter produksi, ideal cycle time, reject. Sisanya dihitung otomatis.
from datetime import date, timedelta

from odoo import api, fields, models
from odoo.exceptions import ValidationError

# Nama hari & bulan Indonesia (index 0 = Senin / Januari)
HARI_ID = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']


class OeeDowntimeReason(models.Model):
    """Master penyebab downtime — dipakai untuk pareto Top 5 Other Contribution."""
    _name = 'oee.downtime.reason'
    _description = 'Penyebab Downtime OEE'
    _order = 'name'

    name = fields.Char(string='Penyebab', required=True)

    _name_uniq = models.Constraint(
        'unique(name)',
        'Penyebab downtime sudah ada.',
    )


class OeeRiwayat(models.Model):
    """Riwayat perubahan data OEE (audit log): siapa & kapan menambah,
    mengedit, menghapus, atau import data. Ditulis secara sudo agar
    pencatatan tidak gagal karena keterbatasan akses user."""
    _name = 'oee.riwayat'
    _description = 'Riwayat Perubahan Data OEE'
    _order = 'id desc'

    aksi = fields.Selection(
        [('create', 'Ditambah'), ('edit', 'Diedit'), ('delete', 'Dihapus'),
         ('import', 'Import Excel'), ('hapus_import', 'Hapus Import')],
        string='Aksi', required=True)
    keterangan = fields.Char('Keterangan')
    user_id = fields.Many2one(
        'res.users', 'Oleh', default=lambda self: self.env.user, readonly=True)
    waktu = fields.Datetime('Waktu', default=fields.Datetime.now, readonly=True)

    @api.model
    def _catat(self, aksi, keterangan):
        # user_id diisi user nyata; create via sudo agar selalu berhasil
        self.sudo().create({
            'aksi': aksi, 'keterangan': keterangan, 'user_id': self.env.user.id,
        })

    @api.model
    def oee_riwayat_daftar(self, limit=200):
        """Daftar riwayat terbaru untuk popup History di menu Input."""
        label = dict(self._fields['aksi'].selection)
        hasil = []
        for r in self.sudo().search([], limit=int(limit)):
            hasil.append({
                'id': r.id,
                'aksi': r.aksi,
                'label_aksi': label.get(r.aksi, r.aksi),
                'keterangan': r.keterangan or '',
                'oleh': r.user_id.name or '-',
                'waktu': (fields.Datetime.context_timestamp(r, r.waktu)
                          .strftime('%d/%m/%Y %H:%M') if r.waktu else ''),
            })
        return hasil


class OeeEntry(models.Model):
    _name = 'oee.entry'
    _description = 'OEE Daily Entry'
    _order = 'tanggal desc, no_mesin, shift'
    _rec_name = 'mold'

    # ==== INPUT MANUAL ====
    tanggal = fields.Date(string='Tanggal', required=True, default=fields.Date.context_today)
    shift = fields.Selection(
        [('1', 'Shift 1'), ('2', 'Shift 2'), ('3', 'Shift 3')],
        string='Shift', required=True, default='1')
    no_mesin = fields.Char(string='No Mesin', required=True)
    mold = fields.Char(string='Nama Matras / Mold', required=True)

    total_menit = fields.Float(
        string='Total Waktu Tersedia (Menit)', default=720.0, required=True,
        help='Total jam kerja shift dalam menit. Contoh: 12 jam = 720 menit.')
    downtime_unplanned = fields.Float(
        string='Down Time (Menit)',
        help='Waktu berhenti tidak terencana (unplanned downtime) dalam menit.')
    downtime_jenis = fields.Selection(
        [('dt1', 'DT-1 Mesin'),
         ('dt2', 'DT-2 Matras'),
         ('dt3', 'DT-3 Nunggu Bahan/Material'),
         ('dt4', 'DT-4 Mati Listrik'),
         ('dt5', 'DT-5 Operasi Absen'),
         ('dt6', 'DT-6 Other')],
        string='Jenis Down Time')
    downtime_reason_id = fields.Many2one(
        'oee.downtime.reason', string='Penyebab Downtime',
        help='Penyebab utama downtime — dipakai untuk grafik Top 5 Other Contribution.')

    target_produksi = fields.Integer(
        string='Target Produksi (Pcs)',
        help='Target hasil produksi shift ini (informasi perencanaan).')
    counter_awal = fields.Integer(string='Shot Awal')
    counter_akhir = fields.Integer(string='Shot Akhir')
    hpr_actual = fields.Integer(
        string='Hasil Produksi (Pcs)', compute='_compute_hpr_actual', store=True, readonly=False,
        help='Hasil produksi aktual. Terisi otomatis dari selisih shot, tapi bisa diketik manual.')

    ideal_ct = fields.Float(
        string='Cycle Time (Detik)',
        help='Waktu siklus ideal per pcs dalam detik. Contoh: 19 detik.')
    total_reject = fields.Integer(string='Total Reject (Pcs)')

    import_batch_id = fields.Many2one(
        'oee.import.batch', string='Hasil Import', ondelete='cascade', index=True,
        help='Terisi jika baris ini berasal dari import Excel. Kosong = input manual.')

    # ==== HASIL PERHITUNGAN (otomatis, meniru formula Excel) ====
    planned_menit = fields.Float(
        string='Waktu Operasi (Menit)', compute='_compute_all', store=True,
        help='Total waktu tersedia dikurangi down time.')
    effectiveness_pct = fields.Float(
        string='Effectiveness (%)', compute='_compute_all', store=True, digits=(16, 2),
        help='Availability: waktu operasi / total waktu tersedia.', aggregator='avg')
    target_production_sec = fields.Float(
        string='Target Production (Detik)', compute='_compute_all', store=True)
    real_production_sec = fields.Float(
        string='Real Production (Detik)', compute='_compute_all', store=True)
    avg_ct = fields.Float(
        string='Avg CT (Detik)', compute='_compute_all', store=True, digits=(16, 2))
    efficiency_pct = fields.Float(
        string='Efficiency / CT (%)', compute='_compute_all', store=True, digits=(16, 2),
        help='Performance: waktu produksi ideal / waktu produksi aktual.', aggregator='avg')
    ok_pcs = fields.Integer(string='OK (Pcs)', compute='_compute_all', store=True)
    fg_pct = fields.Float(
        string='FG (%)', compute='_compute_all', store=True, digits=(16, 2),
        help='Quality: pcs OK / total pcs.', aggregator='avg')
    oee_pct = fields.Float(
        string='OEE (%)', compute='_compute_all', store=True, digits=(16, 2),
        help='Effectiveness x Efficiency x FG.', aggregator='avg')

    @api.depends('counter_awal', 'counter_akhir')
    def _compute_hpr_actual(self):
        for rec in self:
            if rec.counter_akhir or rec.counter_awal:
                rec.hpr_actual = max(0, rec.counter_akhir - rec.counter_awal)
            else:
                rec.hpr_actual = rec.hpr_actual or 0

    @api.depends('total_menit', 'downtime_unplanned', 'hpr_actual', 'ideal_ct', 'total_reject')
    def _compute_all(self):
        for rec in self:
            rec.planned_menit = max(0.0, rec.total_menit - rec.downtime_unplanned)
            rec.effectiveness_pct = (
                rec.planned_menit / rec.total_menit * 100.0 if rec.total_menit else 0.0)
            rec.target_production_sec = rec.ideal_ct * rec.hpr_actual
            rec.real_production_sec = rec.planned_menit * 60.0
            rec.avg_ct = (
                rec.real_production_sec / rec.hpr_actual if rec.hpr_actual else 0.0)
            rec.efficiency_pct = (
                rec.target_production_sec / rec.real_production_sec * 100.0
                if rec.real_production_sec else 0.0)
            rec.ok_pcs = max(0, rec.hpr_actual - rec.total_reject)
            rec.fg_pct = (
                rec.ok_pcs / rec.hpr_actual * 100.0 if rec.hpr_actual else 0.0)
            rec.oee_pct = (
                rec.effectiveness_pct * rec.efficiency_pct * rec.fg_pct / 10000.0)

    # ==== RIWAYAT (audit log) ====
    def _oee_identitas(self):
        """Teks singkat identitas baris untuk keterangan riwayat."""
        self.ensure_one()
        return '%s Shift %s — Mesin %s (%s)' % (
            self.tanggal.strftime('%d/%m/%Y') if self.tanggal else '-',
            self.shift or '-', self.no_mesin or '-', self.mold or '-')

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        # import Excel mencatat 1 baris riwayat sendiri (skip per record)
        if not self.env.context.get('skip_oee_riwayat'):
            R = self.env['oee.riwayat']
            for rec in records:
                R._catat('create', 'Tambah data: ' + rec._oee_identitas())
        return records

    def write(self, vals):
        res = super().write(vals)
        if not self.env.context.get('skip_oee_riwayat'):
            magic = ('id', 'create_uid', 'create_date', 'write_uid', 'write_date')
            labels = []
            for key in vals:
                field = self._fields.get(key)
                if key not in magic and field and not field.compute:
                    labels.append(field.string or key)
            R = self.env['oee.riwayat']
            for rec in self:
                ket = 'Ubah data: ' + rec._oee_identitas()
                if labels:
                    ket += ' — kolom: ' + ', '.join(labels)
                R._catat('edit', ket)
        return res

    def unlink(self):
        if not self.env.context.get('skip_oee_riwayat'):
            R = self.env['oee.riwayat']
            for rec in self:
                R._catat('delete', 'Hapus data: ' + rec._oee_identitas())
        return super().unlink()

    @api.constrains('downtime_unplanned', 'total_menit')
    def _check_downtime(self):
        for rec in self:
            if rec.downtime_unplanned < 0:
                raise ValidationError('Down time tidak boleh negatif.')
            if rec.total_menit and rec.downtime_unplanned > rec.total_menit:
                raise ValidationError('Down time tidak boleh melebihi total waktu tersedia.')

    # ==== HELPER UNTUK APLIKASI OWL MENU INPUT (CRUD) ====
    @api.model
    def oee_daftar(self, year=None, month=None):
        """Daftar data satu bulan untuk tabel di menu Input."""
        all_entries = self.search_read([], ['tanggal'])
        years = sorted({e['tanggal'].year for e in all_entries if e['tanggal']}, reverse=True)

        if not year:
            latest = self.search([], order='tanggal desc', limit=1)
            ref = latest.tanggal if latest else date.today()
            year, month = ref.year, ref.month
        year, month = int(year), int(month)

        date_from = date(year, month, 1)
        date_to = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        rows = []
        for rec in self.search(
                [('tanggal', '>=', date_from), ('tanggal', '<', date_to)],
                order='tanggal desc, no_mesin, shift'):
            rows.append({
                'id': rec.id,
                'tanggal': rec.tanggal.strftime('%d/%m/%Y'),
                'tanggal_iso': rec.tanggal.isoformat(),
                'shift': rec.shift,
                'no_mesin': rec.no_mesin,
                'mold': rec.mold,
                'total_menit': rec.total_menit,
                'downtime': rec.downtime_unplanned,
                'jenis_dt': rec.downtime_jenis or '',
                'penyebab': rec.downtime_reason_id.name or '',
                'target': rec.target_produksi,
                'counter_awal': rec.counter_awal,
                'counter_akhir': rec.counter_akhir,
                'hpr': rec.hpr_actual,
                'ideal_ct': rec.ideal_ct,
                'reject': rec.total_reject,
                'oee': round(rec.oee_pct, 1),
                'effectiveness': round(rec.effectiveness_pct, 1),
                'efficiency': round(rec.efficiency_pct, 1),
                'dari_import': bool(rec.import_batch_id),
            })
        reasons = self.env['oee.downtime.reason'].search([]).mapped('name')
        return {
            'year': year, 'month': month, 'years': years or [year],
            'rows': rows, 'reasons': reasons,
        }

    @api.model
    def oee_simpan(self, vals, rec_id=None):
        """Simpan data dari form Input (tambah baru atau edit)."""
        if not vals.get('tanggal') or not vals.get('mold') or not vals.get('no_mesin'):
            raise ValidationError('Tanggal, No Mesin, dan Nama Matras wajib diisi.')

        # penyebab downtime dikirim sebagai teks — cari atau buat masternya
        penyebab = (vals.pop('penyebab', '') or '').strip()
        reason_id = False
        if penyebab:
            Reason = self.env['oee.downtime.reason']
            reason = Reason.search([('name', '=ilike', penyebab)], limit=1)
            reason_id = reason.id if reason else Reason.create({'name': penyebab}).id
        vals['downtime_reason_id'] = reason_id

        if rec_id:
            rec = self.browse(int(rec_id)).exists()
            if not rec:
                raise ValidationError('Data tidak ditemukan (mungkin sudah dihapus).')
            rec.write(vals)
            return rec.id
        return self.create(vals).id

    @api.model
    def oee_hapus(self, rec_id):
        self.browse(int(rec_id)).exists().unlink()
        return True

    @api.model
    def oee_daftar_mold(self):
        """Daftar mold (code + name) untuk dropdown form Input — bisa dicari
        berdasarkan kode maupun nama.

        Sumber utama: Master Mold milik modul Work Order Mold (wom.master).
        Jika modul itu tidak terpasang / masternya kosong, fallback ke nama
        mold yang sudah pernah dipakai di data OEE (tanpa kode).
        """
        if 'wom.master' in self.env:
            hasil, terlihat = [], set()
            for m in self.env['wom.master'].sudo().search([], order='name, code'):
                nama = (m.name or '').strip()
                kode = (m.code or '').strip()
                if not nama or (kode, nama) in terlihat:
                    continue
                terlihat.add((kode, nama))
                hasil.append({'code': kode, 'name': nama})
            if hasil:
                return hasil
        return [{'code': '', 'name': n} for n in sorted({
            e['mold'].strip() for e in self.search_read([], ['mold'])
            if e['mold'] and e['mold'].strip()})]

    # ==== DATA UNTUK DASHBOARD GRAPH ====
    @api.model
    def get_graph_data(self, period='week', date_start=None, date_end=None):
        """Kembalikan semua agregat yang dibutuhkan menu Graph.

        period: 'week' (7 hari terakhir, default), 'month' (bulan berjalan),
        'year' (tahun berjalan) — selalu berakhir di hari ini — atau
        'custom' dengan date_start & date_end pilihan user sendiri.
        Jika periode berjalan belum punya data (misal baru import data lama),
        otomatis mundur ke periode dari tanggal data terakhir supaya grafik
        tidak kosong (khusus week/month/year; custom mengikuti pilihan user).

        Persentase dihitung tertimbang (weighted):
        - Effectiveness = total waktu operasi / total waktu tersedia
        - Efficiency    = total waktu produksi ideal / total waktu produksi aktual
        - Down Time     = jumlah menit downtime
        """
        if period not in ('week', 'month', 'year', 'custom'):
            period = 'week'
        today = fields.Date.context_today(self)

        if period == 'custom':
            # rentang tanggal bebas pilihan user
            date_from = fields.Date.to_date(date_start) or today - timedelta(days=6)
            date_to = fields.Date.to_date(date_end) or today
            if date_from > date_to:
                date_from, date_to = date_to, date_from
            records = self.search(
                [('tanggal', '>=', date_from), ('tanggal', '<=', date_to)])
        else:
            def rentang(anchor):
                # awal periode sampai tanggal anchor (to date)
                if period == 'week':
                    # 7 hari terakhir termasuk hari anchor
                    mulai = anchor - timedelta(days=6)
                elif period == 'month':
                    mulai = anchor.replace(day=1)
                else:
                    mulai = anchor.replace(month=1, day=1)
                return mulai, anchor

            date_from, date_to = rentang(today)
            records = self.search(
                [('tanggal', '>=', date_from), ('tanggal', '<=', date_to)])
            if not records:
                latest = self.search([], order='tanggal desc', limit=1)
                if latest:
                    date_from, date_to = rentang(latest.tanggal)
                    records = self.search(
                        [('tanggal', '>=', date_from), ('tanggal', '<=', date_to)])

        # rentang panjang dikelompokkan per bulan agar grafik tidak terlalu padat
        if period == 'year':
            mode = 'bulanan'
        elif period == 'custom':
            mode = 'bulanan' if (date_to - date_from).days > 62 else 'harian'
        else:
            mode = 'harian'

        # agregasi per tanggal (harian) atau per bulan (bulanan)
        daily = {}
        machine, mold, reason = {}, {}, {}
        tot = dict(total=0.0, planned=0.0, target=0.0, real=0.0, hpr=0, ok=0, dt=0.0)
        for rec in records:
            kunci = rec.tanggal if mode == 'harian' else rec.tanggal.replace(day=1)
            d = daily.setdefault(kunci, dict(
                total=0.0, planned=0.0, target=0.0, real=0.0, dt=0.0))
            d['total'] += rec.total_menit
            d['planned'] += rec.planned_menit
            d['target'] += rec.target_production_sec
            d['real'] += rec.real_production_sec
            d['dt'] += rec.downtime_unplanned

            tot['total'] += rec.total_menit
            tot['planned'] += rec.planned_menit
            tot['target'] += rec.target_production_sec
            tot['real'] += rec.real_production_sec
            tot['hpr'] += rec.hpr_actual
            tot['ok'] += rec.ok_pcs
            tot['dt'] += rec.downtime_unplanned

            if rec.downtime_unplanned:
                key_m = 'Mesin %s' % rec.no_mesin
                machine[key_m] = machine.get(key_m, 0.0) + rec.downtime_unplanned
                mold[rec.mold] = mold.get(rec.mold, 0.0) + rec.downtime_unplanned
                if rec.downtime_reason_id:
                    r = rec.downtime_reason_id.name
                    reason[r] = reason.get(r, 0.0) + rec.downtime_unplanned

        def pct(num, den):
            return round(num / den * 100.0, 2) if den else 0.0

        daily_rows = []
        for tgl in sorted(daily):
            d = daily[tgl]
            if mode == 'harian':
                hari = HARI_ID[tgl.weekday()]
                tanggal_str = tgl.strftime('%d/%m/%Y')
                label = '%s %s' % (hari[:3], tgl.strftime('%d/%m'))
            else:
                hari = ''
                tanggal_str = '%s %s' % (BULAN_ID[tgl.month - 1], tgl.year)
                label = BULAN_ID[tgl.month - 1][:3]
            daily_rows.append({
                'hari': hari,
                'tanggal': tanggal_str,
                'label': label,
                'downtime': round(d['dt'], 1),
                # persen downtime = menit downtime / total waktu tersedia
                # (komplemen dari Effectiveness: DT% = 100% - Effectiveness%)
                'downtime_pct': pct(d['dt'], d['total']),
                'efficiency': pct(d['target'], d['real']),
                'effectiveness': pct(d['planned'], d['total']),
            })

        def pareto(data, limit=5):
            # top-N nilai terbesar + persentase kumulatif terhadap total seluruh grup
            grand = sum(data.values())
            rows, cum = [], 0.0
            for name, val in sorted(data.items(), key=lambda x: x[1], reverse=True)[:limit]:
                cum += val
                rows.append({
                    'name': name,
                    'value': round(val, 1),
                    'cum': round(cum / grand * 100.0, 1) if grand else 0.0,
                })
            return rows

        eff = pct(tot['target'], tot['real'])
        av = pct(tot['planned'], tot['total'])
        fg = pct(tot['ok'], tot['hpr'])
        return {
            'period': period,
            'mode': mode,
            'range_label': '%s, %s  s/d  %s, %s' % (
                HARI_ID[date_from.weekday()], date_from.strftime('%d/%m/%Y'),
                HARI_ID[date_to.weekday()], date_to.strftime('%d/%m/%Y')),
            'summary': {
                'efficiency': eff,
                'effectiveness': av,
                'oee': round(eff * av * fg / 10000.0, 2),
                'downtime': round(tot['dt'], 1),
                'downtime_pct': pct(tot['dt'], tot['total']),
            },
            'daily': daily_rows,
            'pareto_machine': pareto(machine),
            'pareto_mold': pareto(mold),
            'pareto_reason': pareto(reason),
        }
