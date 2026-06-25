from odoo import models, fields, api


class WoProduction(models.Model):
    """Production — daftar pilihan untuk dropdown Production di Work Order.
    Model custom (tabel sendiri) sehingga isinya bisa di-CRUD oleh user."""
    _name = 'wo.production'
    _description = 'Work Order Production'
    _order = 'sequence, name'

    name = fields.Char('Production', required=True)
    sequence = fields.Integer('Urutan', default=10)
    active = fields.Boolean('Aktif', default=True)

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'Nama Production harus unik.'),
    ]

    @api.model
    def daftar_production(self):
        """Daftar production aktif untuk dropdown: [{id, name}] urut sequence/name."""
        recs = self.search([])
        return [{'id': r.id, 'name': r.name} for r in recs]
