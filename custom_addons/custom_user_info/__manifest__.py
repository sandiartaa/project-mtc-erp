# -*- coding: utf-8 -*-
{
    'name': 'Custom User Info',
    'version': '1.0',
    'summary': 'Data tambahan user (kode, divisi, subdivisi) tanpa mengubah res.users',
    'description': """
Menyimpan data tambahan untuk tiap user — kode (KR0001, ...), divisi, subdivisi —
di tabel custom sendiri (cui.user.info) yang berelasi ke res.users.
Tabel bawaan res.users TIDAK disentuh sama sekali, jadi modul bisa di-uninstall
bersih tanpa meninggalkan bekas.
""",
    'category': 'Human Resources',
    'license': 'LGPL-3',
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
        'data/sequence.xml',
        'views/user_info_views.xml',
    ],
    'application': True,
    'installable': True,
}
