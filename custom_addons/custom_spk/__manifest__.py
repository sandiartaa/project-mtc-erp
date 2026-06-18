{
    'name': 'SPK — Surat Perintah Kerja',
    'version': '1.4.0',
    'category': 'Custom',
    'summary': 'Manajemen Surat Perintah Kerja (SPK) produksi',
    'description': (
        'Modul untuk membuat dan mengelola Surat Perintah Kerja '
        'dengan tampilan modern merah-biru, CRUD lengkap, dan penomoran otomatis.'
    ),
    'author': 'Custom',
    'depends': ['base'],
    'data': [
        'security/ir.model.access.csv',
        'data/spk_sequence.xml',
        'data/spk_satuan.xml',
        'data/spk_gudang.xml',
        'views/spk_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'custom_spk/static/src/css/style.css',
            'custom_spk/static/src/xml/spk_template.xml',
            'custom_spk/static/src/js/spk_app.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
