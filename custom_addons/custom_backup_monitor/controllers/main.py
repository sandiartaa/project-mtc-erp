import os

from odoo import http
from odoo.http import request, content_disposition


class BackupMonitorController(http.Controller):
    """Unduh file backup. Hanya Administrator; nama file divalidasi ketat
    (cuma basename + pola backup_*.tar.gz) agar tidak bisa keluar folder backup."""

    @http.route('/backup_monitor/download', type='http', auth='user')
    def download(self, name=None, **kw):
        # Hanya admin
        if not request.env.user.has_group('base.group_system'):
            return request.not_found()
        if not name:
            return request.not_found()

        # Cegah path traversal: ambil basename saja + validasi pola
        name = os.path.basename(name)
        if not (name.startswith('backup_') and name.endswith('.tar.gz')):
            return request.not_found()

        base = request.env['ir.config_parameter'].sudo().get_param(
            'custom_backup_monitor.dir', '/opt/odoo/backups')
        path = os.path.join(base, name)
        if not os.path.isfile(path):
            return request.not_found()

        with open(path, 'rb') as f:
            data = f.read()
        headers = [
            ('Content-Type', 'application/gzip'),
            ('Content-Length', str(len(data))),
            ('Content-Disposition', content_disposition(name)),
        ]
        return request.make_response(data, headers)
