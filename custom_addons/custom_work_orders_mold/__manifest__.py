# -*- coding: utf-8 -*-
{
    'name': 'Work Order Mold',
    'version': '1.5.2',
    'category': 'Custom',
    'summary': 'Manajemen Work Order: Product Details, InCharge, Timeline',
    'description': """
Work Order Mold
===========
Tabel work order dengan 3 kelompok kolom:
- Product Details: Name, Code, Brand, Details
- InCharge: user pengerjaan (hanya user yang punya akses modul Work Order Mold)
- Timeline: Barcode, Deadline, Request, Process (WIP/DONE/ON HOLD), Approval
Akses dikelola lewat grup (bisa diatur dari Master User).
""",
    'author': 'Custom',
    'license': 'LGPL-3',
    'depends': ['base', 'bus'],
    'data': [
        'security/work_orders_groups.xml',
        'security/ir.model.access.csv',
        'security/work_orders_rules.xml',
        'data/sequence.xml',
        'data/job_types.xml',
        'data/persons.xml',
        'views/work_orders_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_work_orders_mold/static/src/css/style.css',
            'custom_work_orders_mold/static/src/xml/wo_template.xml',
            'custom_work_orders_mold/static/src/js/wom_app.js',
        ],
    },
    'application': True,
    'installable': True,
}
