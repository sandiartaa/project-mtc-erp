# -*- coding: utf-8 -*-
# Penyesuaian Work Order Mold:
# 1) "Finish Repair" pindah dari finish_date (Target Finish) ke field baru
#    ready_date (tanggal Ready for Approval) — data lama dipindahkan.
# 2) Mold otomatis Section=BENGKEL & Local/RRC=Local (Executor = Teknisi Repair).
# 3) WO Mold yang Finish Repair-nya sudah terisi tapi masih draft → "ready"
#    (Awaiting Approval), menyesuaikan alur baru (mengisi Finish Repair = Ready).

from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    bengkel = env.ref('custom_work_orders.section_bengkel', raise_if_not_found=False)
    molds = env['wo.work.order'].search([('wo_type', '=', 'mold')])
    for rec in molds:
        vals = {}
        # Pindahkan Finish Repair lama (finish_date) ke ready_date bila belum ada.
        if not rec.ready_date and rec.finish_date:
            vals['ready_date'] = rec.finish_date
        if bengkel and rec.section_id.id != bengkel.id:
            vals['section_id'] = bengkel.id
        if rec.lokal_rrc != 'lokal':
            vals['lokal_rrc'] = 'lokal'
        # Finish Repair terisi tapi masih draft → ajukan (ready).
        if rec.approval_state == 'draft' and (vals.get('ready_date') or rec.ready_date):
            vals['approval_state'] = 'ready'
        if vals:
            rec.with_context(skip_mold_default=True, skip_wo_audit=True).write(vals)
