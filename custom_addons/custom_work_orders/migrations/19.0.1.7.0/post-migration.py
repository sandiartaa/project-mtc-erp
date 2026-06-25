from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    """Gabungkan peran Designer ke "WO Tab: Design".

    Dulu grup 'group_work_orders_designer' diberikan langsung ke user designer.
    Sekarang grup itu jadi BASIS tersembunyi; peran designer diberikan lewat
    'group_wo_type_design' (yang meng-imply basis tsb) sekaligus membatasi ke
    tab Design. Maka semua anggota langsung grup designer lama dipindahkan ke
    'group_wo_type_design'."""
    env = api.Environment(cr, SUPERUSER_ID, {})
    basis = env.ref('custom_work_orders.group_work_orders_designer', raise_if_not_found=False)
    design = env.ref('custom_work_orders.group_wo_type_design', raise_if_not_found=False)
    if not basis or not design:
        return
    anggota = basis.user_ids
    if not anggota:
        return
    ids = anggota.ids
    design.sudo().write({'user_ids': [(4, uid) for uid in ids]})
    # Lepas keanggotaan LANGSUNG dari basis (akan tetap didapat lewat implikasi).
    basis.sudo().write({'user_ids': [(3, uid) for uid in ids]})
