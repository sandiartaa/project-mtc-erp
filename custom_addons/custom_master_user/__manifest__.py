# -*- coding: utf-8 -*-
{
    'name': 'Master User',
    'version': '1.4',
    'summary': 'Kelola data master user (nama, kode, divisi, subdivisi) + riwayat, khusus Administrator',
    'description': """
Master User
===========
Menampilkan semua user beserta kode/divisi/subdivisi (dari tabel custom
cui.user.info). Hanya bisa diakses Administrator. Admin dapat menambah,
mengedit, dan menghapus entri master. Tersedia tombol History yang
menampilkan siapa pembuatnya, siapa saja yang mengedit, dan kapan.

Tidak menyentuh tabel bawaan res.users (hanya membacanya).
""",
    'category': 'Human Resources',
    'license': 'LGPL-3',
    'depends': ['custom_user_info'],
    'data': [
        'security/ir.model.access.csv',
        'views/master_user_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_master_user/static/src/css/style.css',
            'custom_master_user/static/src/xml/mu_template.xml',
            'custom_master_user/static/src/js/mu_app.js',
        ],
    },
    'post_init_hook': 'post_init_hook',
    'application': True,
    'installable': True,
}
