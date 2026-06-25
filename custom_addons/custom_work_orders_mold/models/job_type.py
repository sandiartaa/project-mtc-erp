from odoo import models, fields, api


class WoJobType(models.Model):
    """Job Type — daftar pilihan untuk dropdown Job Type di Work Order.
    Model custom (tabel sendiri) sehingga isinya bisa di-CRUD oleh user."""
    _name = 'wom.job.type'
    _description = 'Work Order Job Type'
    _order = 'sequence, name'

    name = fields.Char('Job Type', required=True)
    sequence = fields.Integer('Urutan', default=10)
    active = fields.Boolean('Aktif', default=True)

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'Nama Job Type harus unik.'),
    ]

    @api.model
    def daftar_job_type(self):
        """Daftar job type aktif untuk dropdown: [{id, name}] urut sequence/name."""
        recs = self.search([])
        return [{'id': r.id, 'name': r.name} for r in recs]
