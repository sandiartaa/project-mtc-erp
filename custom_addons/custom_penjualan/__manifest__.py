{
    'name': 'Penjualan Indonesia',
    'version': '1.0.0',
    'category': 'Custom',
    'summary': 'Kelola pesanan penjualan dengan bahasa Indonesia sehari-hari',
    'description': 'Dashboard penjualan modern dengan bahasa Indonesia, popup animasi, dan tema merah-biru.',
    'author': 'Custom',
    'depends': ['sale'],
    'data': [
        'security/penjualan_groups.xml',
        'security/ir.model.access.csv',
        'views/penjualan_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_penjualan/static/src/css/style.css',
            'custom_penjualan/static/src/xml/penjualan_template.xml',
            'custom_penjualan/static/src/js/penjualan_dashboard.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
