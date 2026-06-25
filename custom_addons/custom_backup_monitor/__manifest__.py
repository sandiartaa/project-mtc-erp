# -*- coding: utf-8 -*-
{
    'name': 'Backup Monitor',
    'version': '1.0',
    'category': 'Custom',
    'summary': 'Pantau hasil backup + status, jam server, penyimpanan & kecepatan server, dan unduh backup',
    'description': """
Backup Monitor
==============
Dashboard khusus Administrator untuk memantau backup server:
- Daftar file backup (nama, ukuran, jam WIB) + status berhasil/segar.
- Jam server (UTC & WIB).
- Penyimpanan server (disk terpakai/total/sisa).
- Kecepatan server (jumlah core, beban CPU, RAM) + uji kecepatan disk.
- Unduh file backup langsung dari web.

Membaca folder backup di server (default /opt/odoo/backups). Tidak mengubah
data Odoo apa pun — hanya membaca filesystem & statistik server.
""",
    'author': 'Custom',
    'license': 'LGPL-3',
    'depends': ['base', 'web'],
    'data': [
        'security/ir.model.access.csv',
        'views/backup_monitor_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_backup_monitor/static/src/css/style.css',
            'custom_backup_monitor/static/src/xml/backup_template.xml',
            'custom_backup_monitor/static/src/js/backup_app.js',
        ],
    },
    'application': True,
    'installable': True,
}
