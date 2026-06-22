# Migrasi: field gudang yang tadinya teks bebas menjadi Many2one ke master
# gudang (spk.gudang). Berlaku untuk:
#   - spk_bahan_baku.gudang_asal      -> gudang_id
#   - spk_hpr.gudang_penerima         -> gudang_id
#   - spk_sbh.gudang_penerima         -> gudang_id
# Nilai teks lama dipindahkan jadi record spk.gudang, lalu kolom lama dihapus.
from odoo import api, SUPERUSER_ID


def _kolom_ada(cr, tabel, kolom):
    cr.execute(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name = %s AND column_name = %s",
        (tabel, kolom),
    )
    return bool(cr.fetchone())


def migrate(cr, version):
    if not version:
        return

    env = api.Environment(cr, SUPERUSER_ID, {})
    Gudang = env['spk.gudang']
    cache = {}

    def gudang_id_dari(nama):
        key = (nama or '').strip()
        if not key:
            return None
        low = key.lower()
        if low not in cache:
            rec = Gudang.search([('name', '=ilike', key)], limit=1) or Gudang.create({'name': key})
            cache[low] = rec.id
        return cache[low]

    # (tabel, kolom_lama) → kolom baru selalu 'gudang_id'
    targets = [
        ('spk_bahan_baku', 'gudang_asal'),
        ('spk_hpr', 'gudang_penerima'),
        ('spk_sbh', 'gudang_penerima'),
    ]

    for tabel, kolom_lama in targets:
        if not _kolom_ada(cr, tabel, kolom_lama):
            continue
        cr.execute(
            "SELECT id, {col} FROM {tbl} "
            "WHERE {col} IS NOT NULL AND btrim({col}) <> ''".format(col=kolom_lama, tbl=tabel)
        )
        for rid, nama in cr.fetchall():
            gid = gudang_id_dari(nama)
            if gid:
                cr.execute(
                    "UPDATE {tbl} SET gudang_id = %s WHERE id = %s".format(tbl=tabel),
                    (gid, rid),
                )
        cr.execute("ALTER TABLE {tbl} DROP COLUMN {col}".format(tbl=tabel, col=kolom_lama))
