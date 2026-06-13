from odoo import models, fields


class SpkCabang(models.Model):
    _name = 'spk.cabang'
    _description = 'Master Cabang SPK'
    _order = 'name asc'

    name = fields.Char('Nama Cabang', required=True)
    active = fields.Boolean('Aktif', default=True)
