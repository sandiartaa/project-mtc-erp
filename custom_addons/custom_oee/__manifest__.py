# -*- coding: utf-8 -*-
{
    'name': 'OEE',
    'version': '1.0',
    'category': 'Manufacturing',
    'summary': 'Input harian OEE (Overall Equipment Effectiveness) + dashboard grafik Efficiency, Effectiveness, dan Down Time',
    'description': """
Modul OEE untuk mencatat performa mesin dan matras (mold) per shift per hari,
lalu menampilkannya dalam dashboard grafik (line chart per tanggal + pareto chart
mesin/matras/penyebab downtime terburuk).
    """,
    'author': 'Custom',
    'depends': ['base', 'web'],
    'data': [
        'security/oee_groups.xml',
        'security/ir.model.access.csv',
        'views/oee_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_oee/static/src/js/**/*',
            'custom_oee/static/src/xml/**/*',
            'custom_oee/static/src/css/**/*',
        ],
    },
    'application': True,
    'installable': True,
    'license': 'LGPL-3',
}
