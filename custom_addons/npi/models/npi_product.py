# -*- coding: utf-8 -*-
from odoo import models, fields, api
from odoo.exceptions import ValidationError

# Sub item BAKU (tetap) untuk tiap product — tidak bisa ditambah/dihapus.
SUB_TETAP = ['Matras', 'Packing', 'Sparepart', 'Deco', 'Karton']


class NpiProduct(models.Model):
    """NPI Product — tabel custom modul ini (tidak menyentuh tabel bawaan).

    Daftar product dibagi 3 kelompok kolom:
    - Item       : Code, Photo, Name, Brand
    - Packing    : Type, Qty
    - Production  : Place, Batch 1
    """
    _name = 'npi.product'
    _description = 'NPI Product'
    _order = 'id desc'
    _rec_name = 'name'

    # ── Item ──
    code = fields.Char('Code', index=True)
    photo = fields.Binary('Photo', attachment=True)
    photo_ada = fields.Boolean(
        'Ada Photo', compute='_compute_photo_ada', store=True
    )
    name = fields.Char('Name', required=True, index=True)
    brand = fields.Char('Brand')

    # ── Packing ──
    pack_type = fields.Char('Type')
    pack_qty = fields.Char('Qty')

    # ── Production ──
    prod_place = fields.Char('Place')
    prod_batch1 = fields.Char('Batch 1')

    # ── Detail (dropdown saat baris diklik) ──
    subitem_ids = fields.One2many('npi.subitem', 'product_id', 'Sub Items')

    # ── Status product ──
    # Otomatis dari sub item, KECUALI status_custom dicentang (pilih manual).
    status_custom = fields.Boolean('Status Custom', default=False)
    status_manual = fields.Selection(
        [('ongoing', 'Ongoing'), ('hold', 'Hold'), ('finished', 'Finished')],
        string='Status Manual', default='ongoing'
    )
    status = fields.Selection(
        [('ongoing', 'Ongoing'), ('hold', 'Hold'), ('finished', 'Finished')],
        string='Status', compute='_compute_status'
    )

    @api.depends('photo')
    def _compute_photo_ada(self):
        for rec in self:
            rec.photo_ada = bool(rec.photo)

    @api.depends('status_custom', 'status_manual', 'subitem_ids.status')
    def _compute_status(self):
        for rec in self:
            if rec.status_custom:
                rec.status = rec.status_manual or 'ongoing'
                continue
            subs = rec.subitem_ids
            if subs and all(s.status == 'finished' for s in subs):
                rec.status = 'finished'
            elif any(s.status == 'ongoing' for s in subs):
                rec.status = 'ongoing'
            elif subs:
                rec.status = 'hold'
            else:
                rec.status = 'ongoing'

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        for rec in records:
            rec._buat_sub_tetap()
        return records

    def _buat_sub_tetap(self):
        """Buat 5 sub item baku (Matras, Packing, Sparepart, Deco, Karton)."""
        self.ensure_one()
        Sub = self.env['npi.subitem']
        seq = 10
        for nama in SUB_TETAP:
            Sub.create({'product_id': self.id, 'name': nama, 'sequence': seq})
            seq += 10

    # ====================================================================
    # API untuk OWL app
    # ====================================================================
    @api.model
    def npi_daftar(self):
        """Kembalikan daftar product + jumlah sub item untuk ditampilkan."""
        recs = self.search([])
        hasil = []
        for r in recs:
            hasil.append({
                'id': r.id,
                'code': r.code or '',
                'photo_ada': r.photo_ada,
                'name': r.name or '',
                'brand': r.brand or '',
                'pack_type': r.pack_type or '',
                'pack_qty': r.pack_qty or '',
                'prod_place': r.prod_place or '',
                'prod_batch1': r.prod_batch1 or '',
                'jumlah_sub': len(r.subitem_ids),
                'status': r.status or 'ongoing',
                'status_custom': r.status_custom,
                'status_manual': r.status_manual or 'ongoing',
            })
        return hasil

    @api.model
    def npi_simpan(self, vals, rec_id=None):
        """Buat (rec_id kosong) atau ubah product."""
        izin = {
            'code', 'photo', 'name', 'brand',
            'pack_type', 'pack_qty', 'prod_place', 'prod_batch1',
            'status_custom', 'status_manual',
        }
        data = {k: v for k, v in (vals or {}).items() if k in izin}
        if not (data.get('name') or '').strip() and not rec_id:
            raise ValidationError('Name wajib diisi.')
        if rec_id:
            self.browse(int(rec_id)).write(data)
            return int(rec_id)
        return self.create(data).id

    @api.model
    def npi_hapus(self, rec_id):
        self.browse(int(rec_id)).unlink()
        return True


class NpiSubitem(models.Model):
    """Sub item BAKU dari sebuah NPI Product (muncul di panel dropdown).

    Daftar sub item tetap: Matras, Packing, Sparepart, Deco, Karton.
    Hanya Status, Details, dan Notes yang bisa diubah (tidak bisa tambah/hapus).
    """
    _name = 'npi.subitem'
    _description = 'NPI Sub Item'
    _order = 'sequence, id'

    product_id = fields.Many2one(
        'npi.product', 'Product', required=True, ondelete='cascade', index=True
    )
    sequence = fields.Integer('Urutan', default=10)
    name = fields.Char('Sub Item', required=True)
    status = fields.Selection(
        [('ongoing', 'Ongoing'), ('hold', 'Hold'), ('finished', 'Finished')],
        string='Status', default='ongoing'
    )
    details = fields.Text('Details')
    notes = fields.Text('Notes')
    # Metadata tabel popup tiap sub item (untuk semua jenis sub item)
    table_name = fields.Char('Table Name')
    table_code = fields.Char('Code')
    # Baris tabel per jenis sub item (CRUD)
    matras_ids = fields.One2many('npi.matras', 'subitem_id', 'Matras Rows')
    packing_ids = fields.One2many('npi.packing', 'subitem_id', 'Packing Rows')
    sparepart_ids = fields.One2many('npi.sparepart', 'subitem_id', 'Sparepart Rows')
    deco_ids = fields.One2many('npi.deco', 'subitem_id', 'Deco Rows')
    karton_ids = fields.One2many('npi.karton', 'subitem_id', 'Karton Rows')

    # Sub item yang punya tabel baris sendiri + model barisnya
    _JENIS_TABEL = {
        'Matras': 'npi.matras',
        'Packing': 'npi.packing',
        'Sparepart': 'npi.sparepart',
        'Deco': 'npi.deco',
        'Karton': 'npi.karton',
    }

    # ====================================================================
    # API untuk OWL app
    # ====================================================================
    @api.model
    def npi_sub_daftar(self, product_id):
        """Daftar sub item baku. Auto-buat bila product belum punya."""
        prod = self.env['npi.product'].browse(int(product_id))
        if prod.exists() and not prod.subitem_ids:
            prod._buat_sub_tetap()
        recs = self.search([('product_id', '=', int(product_id))])
        hasil = []
        for r in recs:
            hasil.append({
                'id': r.id,
                'name': r.name or '',
                'status': r.status or 'ongoing',
                'details': r.details or '',
                'notes': r.notes or '',
                'table_name': r.table_name or '',
                'table_code': r.table_code or '',
            })
        return hasil

    @api.model
    def npi_sub_buka(self, rec_id):
        """Data lengkap untuk popup tabel sebuah sub item."""
        r = self.browse(int(rec_id))
        nm = r.name or ''
        model = self._JENIS_TABEL.get(nm)
        rows = self.env[model]._daftar_baris(r.id) if model else []
        return {
            'id': r.id,
            'name': nm,
            'status': r.status or 'ongoing',
            'details': r.details or '',
            'notes': r.notes or '',
            'table_name': r.table_name or '',
            'table_code': r.table_code or '',
            'jenis': nm if model else '',
            'is_matras': nm == 'Matras',
            'is_packing': nm == 'Packing',
            'is_sparepart': nm == 'Sparepart',
            'is_deco': nm == 'Deco',
            'is_karton': nm == 'Karton',
            'rows': rows,
        }

    @api.model
    def npi_sub_simpan_popup(self, rec_id, vals, rows=None):
        """Simpan metadata sub item (status/details/notes/table_name/code).
        Bila sub item punya tabel baris (Matras/Packing/Sparepart), sekaligus
        simpan baris tabelnya.
        """
        r = self.browse(int(rec_id))
        izin = {'status', 'details', 'notes', 'table_name', 'table_code'}
        data = {k: v for k, v in (vals or {}).items() if k in izin}
        r.write(data)
        model = self._JENIS_TABEL.get(r.name or '')
        if rows is not None and model:
            self.env[model]._simpan_baris(r.id, rows)
        return self.npi_sub_buka(r.id)


class NpiRowBase(models.AbstractModel):
    """Basis abstrak untuk semua tabel baris sub item (Matras/Packing/Sparepart).

    Model turunan cukup mendefinisikan field + dua tuple `_F_CHAR` (kolom teks)
    dan `_F_DATE` (kolom tanggal). Semua logika baca/simpan/sinkron baris dipakai
    bersama dari sini.
    """
    _name = 'npi.row.base'
    _description = 'NPI Row Base (abstrak)'
    _order = 'sequence, id'

    subitem_id = fields.Many2one(
        'npi.subitem', 'Sub Item', required=True, ondelete='cascade', index=True
    )
    sequence = fields.Integer('Urutan', default=10)

    # Diisi oleh model turunan
    _F_CHAR = ()
    _F_DATE = ()
    _F_BIN = ()   # kolom gambar (Binary) — dikirim sebagai flag _ada, bukan datanya

    def _ke_dict(self):
        self.ensure_one()
        row = {'id': self.id}
        for f in self._F_CHAR:
            row[f] = self[f] or ''
        for f in self._F_DATE:
            row[f] = self[f].isoformat() if self[f] else ''
        for f in self._F_BIN:
            # Jangan kirim base64 besar; cukup flag "ada gambar".
            # Gambar ditampilkan via /web/image. Kolom data dikosongkan,
            # flag _ubah=False supaya save tidak menimpa gambar lama.
            row[f] = ''
            row[f + '_ada'] = bool(self[f])
            row[f + '_ubah'] = False
        return row

    @api.model
    def _daftar_baris(self, subitem_id):
        recs = self.search([('subitem_id', '=', int(subitem_id))])
        return [r._ke_dict() for r in recs]

    def _bersih_vals(self, r):
        vals = {}
        for f in self._F_CHAR:
            v = r.get(f)
            vals[f] = '' if v in (None, False) else str(v)  # number → str (kolom Char/Text)
        for f in self._F_DATE:
            vals[f] = r.get(f) or False  # '' → False agar Date valid
        for f in self._F_BIN:
            # Hanya tulis gambar bila benar-benar diubah user (upload/hapus).
            if r.get(f + '_ubah'):
                vals[f] = r.get(f) or False
        return vals

    @api.model
    def _simpan_baris(self, subitem_id, rows):
        """Sinkron baris: update yang ada, buat baru, hapus yang dibuang."""
        sub_id = int(subitem_id)
        ada = self.search([('subitem_id', '=', sub_id)])
        simpan_ids = set()
        seq = 10
        for r in (rows or []):
            vals = self._bersih_vals(r)
            vals['sequence'] = seq
            rid = r.get('id')
            if rid:
                self.browse(int(rid)).write(vals)
                simpan_ids.add(int(rid))
            else:
                vals['subitem_id'] = sub_id
                simpan_ids.add(self.create(vals).id)
            seq += 10
        buang = ada - self.browse(list(simpan_ids))
        if buang:
            buang.unlink()
        return self._daftar_baris(sub_id)


class NpiMatras(models.Model):
    """Baris tabel sub item Matras (CRUD), 3 kelompok kolom:
    - Details   : Mold Code, Description, Spec, Maker, Material, Qty
    - Timeline  : Req Date, Prod Date, Finished Date
    - Container : Number, Stuffing Date, ARR Date
    """
    _name = 'npi.matras'
    _inherit = 'npi.row.base'
    _description = 'NPI Matras Row'

    # Details
    mold_code = fields.Char('Mold Code')
    description = fields.Text('Description')  # bisa panjang → editor textarea
    spec = fields.Char('Spec')
    maker = fields.Char('Maker')
    material = fields.Char('Material')
    qty = fields.Char('Qty')
    # Timeline
    req_date = fields.Date('Req Date')
    prod_date = fields.Date('Prod Date')
    finished_date = fields.Date('Finished Date')
    # Container
    number = fields.Char('Number')
    stuffing_date = fields.Date('Stuffing Date')
    arr_date = fields.Date('ARR Date')

    _F_CHAR = ('mold_code', 'description', 'spec', 'maker', 'material', 'qty', 'number')
    _F_DATE = ('req_date', 'prod_date', 'finished_date', 'stuffing_date', 'arr_date')


class NpiPacking(models.Model):
    """Baris tabel sub item Packing (CRUD), 3 kelompok kolom:
    - Details : Code, Item, Packing, Specification, Qty, Executor
    - PO      : Date, Qty
    - Cont    : No., Stuffing Date, Arrival Date
    """
    _name = 'npi.packing'
    _inherit = 'npi.row.base'
    _description = 'NPI Packing Row'

    # Details
    code = fields.Char('Code')
    item = fields.Char('Item')
    packing = fields.Char('Packing')
    specification = fields.Text('Specification')  # bisa panjang → editor textarea
    qty = fields.Char('Qty')
    executor = fields.Char('Executor')
    # PO
    po_date = fields.Date('PO Date')
    po_qty = fields.Char('PO Qty')
    # Cont
    cont_no = fields.Char('No.')
    stuffing_date = fields.Date('Stuffing Date')
    arrival_date = fields.Date('Arrival Date')

    _F_CHAR = ('code', 'item', 'packing', 'specification', 'qty', 'executor', 'po_qty', 'cont_no')
    _F_DATE = ('po_date', 'stuffing_date', 'arrival_date')


class NpiSparepart(models.Model):
    """Baris tabel sub item Sparepart (CRUD), 3 kelompok kolom — mirip Packing,
    bedanya: Details TANPA Executor, dan PO ada Supplier sebelum Date.
    - Details : Code, Item, Packing, Specification, Qty
    - PO      : Supplier, Date, Qty
    - Cont    : No., Stuffing Date, Arrival Date
    """
    _name = 'npi.sparepart'
    _inherit = 'npi.row.base'
    _description = 'NPI Sparepart Row'

    # Details
    code = fields.Char('Code')
    item = fields.Char('Item')
    packing = fields.Char('Packing')
    specification = fields.Text('Specification')  # bisa panjang → editor textarea
    qty = fields.Char('Qty')
    # PO
    supplier = fields.Char('Supplier')
    po_date = fields.Date('PO Date')
    po_qty = fields.Char('PO Qty')
    # Cont
    cont_no = fields.Char('No.')
    stuffing_date = fields.Date('Stuffing Date')
    arrival_date = fields.Date('Arrival Date')

    _F_CHAR = ('code', 'item', 'packing', 'specification', 'qty', 'supplier', 'po_qty', 'cont_no')
    _F_DATE = ('po_date', 'stuffing_date', 'arrival_date')


class NpiDeco(models.Model):
    """Baris tabel sub item Deco (CRUD), 1 kelompok kolom:
    - Details : Item, Qty, Executor, Photo
    """
    _name = 'npi.deco'
    _inherit = 'npi.row.base'
    _description = 'NPI Deco Row'

    # Details
    item = fields.Char('Item')
    qty = fields.Char('Qty')
    executor = fields.Char('Executor')
    photo = fields.Binary('Photo', attachment=True)

    _F_CHAR = ('item', 'qty', 'executor')
    _F_DATE = ()
    _F_BIN = ('photo',)


class NpiKarton(models.Model):
    """Baris tabel sub item Karton (CRUD), 2 kelompok kolom:
    - Details : Code, Item, Specification
    - PO      : Date, Qty, Arrival Date
    """
    _name = 'npi.karton'
    _inherit = 'npi.row.base'
    _description = 'NPI Karton Row'

    # Details
    code = fields.Char('Code')
    item = fields.Char('Item')
    specification = fields.Text('Specification')  # bisa panjang → editor textarea
    # PO
    po_date = fields.Date('PO Date')
    po_qty = fields.Char('PO Qty')
    arrival_date = fields.Date('Arrival Date')

    _F_CHAR = ('code', 'item', 'specification', 'po_qty')
    _F_DATE = ('po_date', 'arrival_date')
