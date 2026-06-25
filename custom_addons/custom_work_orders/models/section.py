from odoo import models, fields, api


class WoSection(models.Model):
    """Section — daftar pilihan untuk dropdown Section di Work Order (mis. 2D, 3D,
    INJ, DECO, ASSY). Model custom (tabel sendiri) sehingga isinya bisa di-CRUD."""
    _name = 'wo.section'
    _description = 'Work Order Section'
    _order = 'sequence, name'

    name = fields.Char('Section', required=True)
    sequence = fields.Integer('Urutan', default=10)
    active = fields.Boolean('Aktif', default=True)

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'Nama Section harus unik.'),
    ]

    @api.model
    def daftar_section(self):
        """Daftar section aktif untuk dropdown: [{id, name}] urut sequence/name."""
        recs = self.search([])
        return [{'id': r.id, 'name': r.name} for r in recs]
