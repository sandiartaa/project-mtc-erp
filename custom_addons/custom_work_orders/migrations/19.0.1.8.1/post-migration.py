# -*- coding: utf-8 -*-
# Perbarui prefix sequence nomor WO ke format bertanggal: W<jenis>-YYMMDD-NNNN
# (mis. WMO-260626-0012). Sequence dibuat noupdate=1, jadi perubahan prefix di
# data XML tidak otomatis menimpa yang sudah ada — maka diperbarui di sini.


def migrate(cr, version):
    prefiks = {
        'wo.work.order.design': 'WDE-%(y)s%(month)s%(day)s-',
        'wo.work.order.mold': 'WMO-%(y)s%(month)s%(day)s-',
        'wo.work.order.maintenance': 'WMA-%(y)s%(month)s%(day)s-',
        'wo.work.order.utility': 'WUT-%(y)s%(month)s%(day)s-',
    }
    for code, prefix in prefiks.items():
        cr.execute(
            "UPDATE ir_sequence SET prefix = %s, padding = 4 WHERE code = %s",
            (prefix, code),
        )
