from odoo import models, fields, api


class SpkGudang(models.Model):
    """Master gudang untuk barang/produk SPK.

    Tabel sendiri agar daftar gudang bisa ditambah/diedit/dihapus user
    (lewat popup Master Gudang).
    """
    _name = 'spk.gudang'
    _description = 'Gudang SPK'
    _order = 'name asc'

    name = fields.Char('Nama Gudang', required=True, index=True)
    active = fields.Boolean('Aktif', default=True)

    @api.model
    def histori_gudang(self, gudang_id):
        """Riwayat pergerakan barang untuk satu gudang:
        - MASUK : hasil produksi (HPR) + barang kembali (SBH) yang penerimanya gudang ini
        - KELUAR: bahan baku yang gudang asalnya gudang ini (dipakai untuk produksi)
        """
        gid = int(gudang_id)
        masuk, keluar = [], []

        # MASUK — Hasil Produksi (HPR)
        for h in self.env['spk.hpr'].search(
                [('gudang_id', '=', gid)], order='tanggal_kirim desc, id desc'):
            masuk.append({
                'tipe': 'Hasil Produksi',
                'tanggal': h.tanggal_kirim and h.tanggal_kirim.strftime('%Y-%m-%d') or '',
                'keterangan': h.spk_id.name or '',
                'qty': h.hasil_produksi,
            })
        # MASUK — Barang Kembali (SBH)
        for s in self.env['spk.sbh'].search([('gudang_id', '=', gid)], order='id desc'):
            masuk.append({
                'tipe': 'Barang Kembali',
                'tanggal': s.create_date and s.create_date.strftime('%Y-%m-%d') or '',
                'keterangan': s.bahan_id.nama_bahan or '',
                'qty': s.barang_sisa,
            })

        # KELUAR — Bahan Baku (gudang asal)
        for b in self.env['spk.bahan.baku'].search([('gudang_id', '=', gid)], order='id desc'):
            keluar.append({
                'tanggal': b.create_date and b.create_date.strftime('%Y-%m-%d') or '',
                'bahan': b.nama_bahan or '',
                'qty': b.qty,
                'spk': b.spk_id.name or '',
                'pic': b.pic_id.name or '',
            })

        return {'masuk': masuk, 'keluar': keluar}
