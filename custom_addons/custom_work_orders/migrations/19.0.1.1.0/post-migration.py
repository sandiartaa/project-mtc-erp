# Migrasi: Brand berubah dari teks bebas (kolom varchar `brand`) menjadi
# Many2one ke master baru wo.brand (kolom `brand_id`).
# Nilai brand lama dipindahkan jadi record wo.brand, lalu kolom lama dihapus.
from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    if not version:
        return
    # Kolom lama 'brand' masih ada (Odoo tidak otomatis menghapus kolom usang).
    cr.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'wo_work_order' AND column_name = 'brand'
    """)
    if not cr.fetchone():
        return

    env = api.Environment(cr, SUPERUSER_ID, {})
    Brand = env['wo.brand']
    cache = {}

    cr.execute(
        "SELECT id, brand FROM wo_work_order "
        "WHERE brand IS NOT NULL AND btrim(brand) <> ''"
    )
    for wid, bname in cr.fetchall():
        key = bname.strip()
        low = key.lower()
        if low not in cache:
            rec = Brand.search([('name', '=ilike', key)], limit=1) or Brand.create({'name': key})
            cache[low] = rec.id
        cr.execute("UPDATE wo_work_order SET brand_id = %s WHERE id = %s", (cache[low], wid))

    # Hapus kolom lama agar tabel tidak menyimpan data usang.
    cr.execute("ALTER TABLE wo_work_order DROP COLUMN brand")
