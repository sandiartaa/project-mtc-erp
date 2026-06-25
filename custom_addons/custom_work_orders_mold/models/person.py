from odoo import models, fields, api


class WoPerson(models.Model):
    """Daftar orang untuk Requestor & Approver (dipakai bersama).
    Model custom (tabel sendiri) sehingga isinya bisa di-CRUD oleh user —
    tidak mengambil dari res.users."""
    _name = 'wom.person'
    _description = 'Work Order Person (Requestor/Approver)'
    _order = 'sequence, name'

    name = fields.Char('Nama', required=True)
    sequence = fields.Integer('Urutan', default=10)
    active = fields.Boolean('Aktif', default=True)

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'Nama harus unik.'),
    ]

    @api.model
    def daftar_person(self):
        """Daftar person aktif untuk dropdown: [{id, name}] urut sequence/name."""
        recs = self.search([])
        return [{'id': r.id, 'name': r.name} for r in recs]
