from . import models


def post_init_hook(env):
    """Saat modul dipasang, buatkan entri master untuk semua user internal
    yang ada agar Master User langsung menampilkan semua user.

    Hanya membuat record di tabel custom cui.user.info (tidak menyentuh
    res.users). User yang sudah punya entri dilewati.
    """
    Info = env['cui.user.info']
    sudah = Info.with_context(active_test=False).search([]).mapped('user_id').ids
    users = env['res.users'].search([('share', '=', False)])
    vals = [{'user_id': u.id} for u in users if u.id not in sudah]
    if vals:
        Info.create(vals)
