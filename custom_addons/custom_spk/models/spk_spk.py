from odoo import models, fields, api
from odoo.exceptions import ValidationError


class SpkSpk(models.Model):
    _name = 'spk.spk'
    _description = 'Surat Perintah Kerja'
    _order = 'spk_date desc, id desc'

    name = fields.Char(
        'No. SPK', readonly=True, default='Baru', copy=False, index=True
    )
    custom_number = fields.Char('Nomor Custom')
    spk_date = fields.Date(
        'Tanggal SPK', required=True, default=fields.Date.today, index=True
    )
    branch_id = fields.Many2one(
        'spk.cabang', 'Cabang', required=False, ondelete='restrict', index=True
    )
    pic_id = fields.Many2one(
        'res.users', 'Diperintahkan Kepada (PIC)', required=True
    )
    # Nama SPK diambil dari barang ini (tabel custom spk.barang), bukan input manual.
    # required=False di level DB agar update modul pada data lama tidak gagal;
    # kewajiban diisi divalidasi di UI saat membuat/edit SPK.
    barang_id = fields.Many2one(
        'spk.barang', 'Produk', ondelete='restrict', index=True
    )
    qty = fields.Float('Jumlah (Qty)', required=True, default=1.0, digits=(16, 4))
    unit = fields.Selection(
        [('karton', 'Karton'), ('layer', 'Layer'), ('pcs', 'Pcs')],
        string='Satuan', required=True
    )
    layer_per_karton = fields.Integer('Layer per Karton', default=1)
    pcs_per_layer = fields.Integer('Pcs per Layer', default=1)
    # Harga per satuan (otomatis dari harga produk saat dipilih, bisa diubah manual)
    harga_satuan = fields.Float('Harga per Satuan', digits=(16, 4), default=0.0)
    # Harga total = harga per satuan x qty (dihitung otomatis)
    harga_total = fields.Float(
        'Harga Total', digits=(16, 4),
        compute='_compute_harga_total', store=True
    )
    standard_price = fields.Float(
        'Harga Standar', digits=(16, 4), default=0.0
    )
    # True = harga standar diatur manual user; False = otomatis dari total bahan baku
    is_harga_standar_custom = fields.Boolean('Harga Standar Custom', default=False)
    status = fields.Selection(
        [('open', 'Open'), ('closed', 'Closed')],
        string='Status', required=True, default='open'
    )
    tgl_selesai = fields.Date('Tanggal Selesai')
    active = fields.Boolean('Aktif', default=True)

    @api.depends('harga_satuan', 'qty')
    def _compute_harga_total(self):
        for rec in self:
            rec.harga_total = (rec.harga_satuan or 0.0) * (rec.qty or 0.0)

    @api.constrains('qty')
    def _check_qty(self):
        for rec in self:
            if rec.qty <= 0:
                raise ValidationError('Jumlah (Qty) harus lebih dari 0.')

    @api.constrains('standard_price')
    def _check_standard_price(self):
        for rec in self:
            if rec.standard_price < 0:
                raise ValidationError('Harga Standar tidak boleh negatif.')

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'Baru') == 'Baru':
                vals['name'] = (
                    self.env['ir.sequence'].next_by_code('spk.spk') or 'Baru'
                )
        records = super().create(vals_list)
        # Catat riwayat pembuatan SPK
        for rec in records:
            self.env['spk.riwayat'].create({
                'spk_id': rec.id,
                'aksi': 'create',
                'keterangan': 'SPK dibuat',
            })
        return records

    def sinkron_bahan_baku(self):
        """Samakan daftar Bahan Baku dengan FORMULASI produk (master barang).

        Bahan baku dibuat OTOMATIS dari formulasi — nama, harga, & kode ikut
        master barang. Tidak ada penambahan manual. Bahan yang tidak lagi ada
        di formulasi (atau bila produk tanpa formulasi) akan dihapus.
        PIC, Gudang, & Keterangan per bahan tetap dipertahankan.
        Qty & subtotal dihitung di frontend dari formulasi × jumlah produksi.
        """
        self.ensure_one()
        Bahan = self.env['spk.bahan.baku']
        Barang = self.env['spk.barang']
        Formulasi = self.env['spk.barang.formulasi']
        formulasi = (
            Formulasi.search([('barang_id', '=', self.barang_id.id)], order='id asc')
            if self.barang_id else Formulasi.browse()
        )
        nama_dipakai = []
        for f in formulasi:
            nama = (f.nama_bahan or '').strip()
            if not nama or nama in nama_dipakai:
                continue
            nama_dipakai.append(nama)
            # Ambil harga & kode dari master barang dengan nama sama (bila ada)
            b = Barang.search([('name', '=', nama)], limit=1)
            existing = Bahan.search(
                [('spk_id', '=', self.id), ('nama_bahan', '=', nama)], limit=1)
            if existing:
                # Kode selalu ikut master. Harga HANYA disamakan bila tidak di-custom
                # user. Qty & flag custom (qty/harga) tidak diutak-atik agar override
                # user tetap dipakai di HPR/SBH/Gaji.
                vals = {'kode_barang': (b.kode or False) if b else False}
                if not existing.is_harga_custom:
                    vals['harga'] = b.harga if b else 0.0
                existing.write(vals)
            else:
                Bahan.create({
                    'spk_id': self.id, 'nama_bahan': nama,
                    'harga': b.harga if b else 0.0,
                    'kode_barang': (b.kode or False) if b else False,
                    'is_qty_custom': False,
                    'is_harga_custom': False,
                })
        # Hapus bahan baku yang tidak ada dalam formulasi (atau semua bila kosong)
        orphan = Bahan.search([('spk_id', '=', self.id)]).filtered(
            lambda r: (r.nama_bahan or '').strip() not in nama_dipakai
        )
        if orphan:
            orphan.unlink()
        return True

    def write(self, vals):
        res = super().write(vals)
        # Catat setiap perubahan ke riwayat (siapa & kapan otomatis).
        # context skip_riwayat dipakai bila perlu menulis tanpa mencatat.
        if not self.env.context.get('skip_riwayat'):
            # Susun daftar nama field yang diubah (abaikan kolom teknis bawaan)
            magic = ('id', 'create_uid', 'create_date', 'write_uid', 'write_date')
            labels = []
            for key in vals:
                if key in magic:
                    continue
                field = self._fields.get(key)
                if field:
                    labels.append(field.string or key)
            ket = 'Ubah: ' + ', '.join(labels) if labels else 'Diedit'
            for rec in self:
                self.env['spk.riwayat'].create({
                    'spk_id': rec.id,
                    'aksi': 'edit',
                    'keterangan': ket,
                })
        return res
