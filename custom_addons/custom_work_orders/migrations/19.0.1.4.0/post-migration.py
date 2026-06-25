from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    """Restrukturisasi akses jadi 3 level.

    Sebelumnya grup 'group_work_orders_readonly' BERPERAN sebagai Designer
    (hanya melihat WO miliknya & bisa Ready for Approval). Sekarang:
    - 'group_work_orders_designer' (BARU) = peran Designer.
    - 'group_work_orders_readonly' = Read-only MURNI (lihat semua, tanpa aksi).

    Maka semua anggota lama grup read-only adalah Designer → dipindahkan
    ke grup Designer baru, lalu dilepas dari read-only (yang kini bermakna
    read-only murni dan dimulai kosong)."""
    env = api.Environment(cr, SUPERUSER_ID, {})
    lama = env.ref('custom_work_orders.group_work_orders_readonly', raise_if_not_found=False)
    baru = env.ref('custom_work_orders.group_work_orders_designer', raise_if_not_found=False)
    if not lama or not baru:
        return
    anggota = lama.user_ids
    if not anggota:
        return
    ids = anggota.ids
    baru.sudo().write({'user_ids': [(4, uid) for uid in ids]})
    lama.sudo().write({'user_ids': [(3, uid) for uid in ids]})
