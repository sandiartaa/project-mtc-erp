# -*- coding: utf-8 -*-
{
    'name': 'Work Order Mold',
    'version': '2.13.0',
    'category': 'Custom',
    'summary': 'Work Order khusus jenis Mold (berbagi data dengan Work Orders)',
    'description': "Work Order khusus jenis Mold. Tidak punya tabel sendiri: "
                   "berbagi wo.work.order (wo_type=mold) dengan modul Work Orders, "
                   "sehingga otomatis muncul di tab Mold app utama. Hanya 1 akses, "
                   "tambah WO digembok password, Lead Time & Target Finish diisi inline.",
    'author': 'Custom',
    'license': 'LGPL-3',
    'depends': ['base', 'bus', 'custom_work_orders'],
    'data': [
        'security/work_orders_groups.xml',
        'security/ir.model.access.csv',
        'security/work_orders_rules.xml',
        'data/config.xml',
        'views/work_orders_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_work_orders_mold/static/src/css/style.css',
            'custom_work_orders_mold/static/src/xml/wom_template.xml',
            'custom_work_orders_mold/static/src/js/wom_app.js',
        ],
    },
    'application': True,
    'installable': True,
}
