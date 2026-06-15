from odoo import models, fields, api
from odoo.exceptions import ValidationError


class SpkSpk(models.Model):
    _name = 'spk.spk'
    _description = 'Surat Perintah Kerja'
    _order = 'spk_date desc, id desc'

    name = fields.Char(
        'No. SPK', readonly=True, default='Baru', copy=False, index=True
    )
    nama_pekerjaan = fields.Char('Nama Pekerjaan', default='')
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
    product_id = fields.Many2one(
        'product.product', 'Produksi', required=True
    )
    qty = fields.Float('Jumlah (Qty)', required=True, default=1.0, digits=(16, 2))
    unit = fields.Selection(
        [('karton', 'Karton'), ('layer', 'Layer'), ('pcs', 'Pcs')],
        string='Satuan', required=True
    )
    layer_per_karton = fields.Integer('Layer per Karton', default=1)
    pcs_per_layer = fields.Integer('Pcs per Layer', default=1)
    standard_price = fields.Float(
        'Harga Standar', required=True, digits=(16, 0)
    )
    # Nominal gaji per satuan produksi (dipakai di tab Gaji)
    nominal_gaji = fields.Float('Nominal Gaji', digits=(16, 0), default=0.0)
    status = fields.Selection(
        [('open', 'Open'), ('closed', 'Closed')],
        string='Status', required=True, default='open'
    )
    tgl_selesai = fields.Date('Tanggal Selesai')
    active = fields.Boolean('Aktif', default=True)

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
        return super().create(vals_list)
