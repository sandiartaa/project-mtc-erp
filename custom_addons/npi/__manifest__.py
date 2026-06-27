# -*- coding: utf-8 -*-
{
    'name': 'NPI',
    'version': '1.0.0',
    'category': 'Custom',
    'summary': 'NPI Product: CRUD product, sub item, dan tabel custom bertingkat',
    'description': """
NPI
===
Manajemen NPI Product dengan tabel daftar 3 kelompok kolom:
- Item       : Code, Photo, Name, Brand
- Packing    : Type, Qty
- Production  : Place, Batch 1

Tiap baris bisa dibuka (dropdown) menampilkan tabel Sub Item (Sub item, Status,
Details) yang bisa di-CRUD. Tiap Sub Item bisa dibuka lagi menjadi popup tabel
custom: user menentukan jumlah kolom, judul kolom, dan tipe isian (text / number
/ dropdown).
""",
    'author': 'Custom',
    'license': 'LGPL-3',
    'depends': ['base', 'web'],
    'data': [
        'security/npi_groups.xml',
        'security/ir.model.access.csv',
        'views/npi_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'npi/static/src/css/style.css',
            'npi/static/src/xml/npi_template.xml',
            'npi/static/src/js/npi_app.js',
        ],
    },
    'application': True,
    'installable': True,
}
