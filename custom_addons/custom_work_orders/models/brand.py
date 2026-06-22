from odoo import models, fields, api


class WoBrand(models.Model):
    """Brand — daftar pilihan untuk dropdown Brand di Work Order.
    Model custom (tabel sendiri) sehingga isinya bisa di-CRUD oleh user."""
    _name = 'wo.brand'
    _description = 'Work Order Brand'
    _order = 'sequence, name'

    name = fields.Char('Brand', required=True)
    sequence = fields.Integer('Urutan', default=10)
    active = fields.Boolean('Aktif', default=True)

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'Nama Brand harus unik.'),
    ]

    @api.model
    def daftar_brand(self):
        """Daftar brand aktif untuk dropdown: [{id, name}] urut sequence/name."""
        recs = self.search([])
        return [{'id': r.id, 'name': r.name} for r in recs]
