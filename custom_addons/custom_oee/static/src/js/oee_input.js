/** @odoo-module **/
// Aplikasi menu Input OEE — tabel data bulanan + form tambah/edit/hapus (CRUD).
import { Component, useState, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export const BULAN_OEE = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function num(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
}

export class OeeInputApp extends Component {
    static template = "custom_oee.InputApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.bulanList = BULAN_OEE;

        this.state = useState({
            memuat: true,
            year: 0,
            month: 1,
            years: [],
            rows: [],
            reasons: [],
            cari: "",
            form: {
                buka: false, mode: "tambah", id: null, proses: false,
                tanggal: "", shift: "1", no_mesin: "", mold: "",
                total_menit: "720", downtime: "0", penyebab: "",
                counter_awal: "", counter_akhir: "", hpr: "",
                ideal_ct: "", reject: "0",
            },
        });

        onMounted(() => this.muatData());
    }

    async muatData(year = null, month = null) {
        this.state.memuat = true;
        try {
            const data = await this.orm.call("oee.entry", "oee_daftar", [year, month]);
            this.state.year = data.year;
            this.state.month = data.month;
            this.state.years = data.years;
            this.state.rows = data.rows;
            this.state.reasons = data.reasons;
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
        this.state.memuat = false;
    }

    onFilter() {
        this.muatData(this.state.year, this.state.month);
    }

    resetCari() {
        this.state.cari = "";
    }

    get rowsTerfilter() {
        const q = (this.state.cari || "").trim().toLowerCase();
        if (!q) {
            return this.state.rows;
        }
        return this.state.rows.filter((r) =>
            (r.mold + " " + r.no_mesin + " " + r.penyebab + " " + r.tanggal)
                .toLowerCase().includes(q)
        );
    }

    // ================= FORM TAMBAH / EDIT =================
    bukaTambah() {
        const hariIni = new Date().toISOString().slice(0, 10);
        Object.assign(this.state.form, {
            buka: true, mode: "tambah", id: null, proses: false,
            tanggal: hariIni, shift: "1", no_mesin: "", mold: "",
            total_menit: "720", downtime: "0", penyebab: "",
            counter_awal: "", counter_akhir: "", hpr: "",
            ideal_ct: "", reject: "0",
        });
    }

    bukaEdit(rec) {
        Object.assign(this.state.form, {
            buka: true, mode: "edit", id: rec.id, proses: false,
            tanggal: rec.tanggal_iso, shift: rec.shift,
            no_mesin: rec.no_mesin, mold: rec.mold,
            total_menit: String(rec.total_menit), downtime: String(rec.downtime),
            penyebab: rec.penyebab,
            counter_awal: rec.counter_awal ? String(rec.counter_awal) : "",
            counter_akhir: rec.counter_akhir ? String(rec.counter_akhir) : "",
            hpr: String(rec.hpr), ideal_ct: String(rec.ideal_ct),
            reject: String(rec.reject),
        });
    }

    tutupForm() {
        this.state.form.buka = false;
    }

    // Hasil produksi terisi otomatis dari selisih counter (tetap bisa diketik manual)
    onCounter() {
        const f = this.state.form;
        const akhir = num(f.counter_akhir);
        if (akhir > 0) {
            f.hpr = String(Math.max(0, akhir - num(f.counter_awal)));
        }
    }

    // Pratinjau hasil perhitungan langsung di form (supaya user tua langsung paham)
    get preview() {
        const f = this.state.form;
        const total = num(f.total_menit);
        const dt = num(f.downtime);
        const planned = Math.max(0, total - dt);
        const hpr = num(f.hpr);
        const reject = num(f.reject);
        const eff = total ? (planned / total) * 100 : 0;
        const realSec = planned * 60;
        const ct = realSec ? (num(f.ideal_ct) * hpr / realSec) * 100 : 0;
        const fg = hpr ? (Math.max(0, hpr - reject) / hpr) * 100 : 0;
        return {
            effectiveness: eff.toFixed(1),
            efficiency: ct.toFixed(1),
            fg: fg.toFixed(1),
            oee: ((eff * ct * fg) / 10000).toFixed(1),
        };
    }

    async simpanForm() {
        const f = this.state.form;
        if (!f.tanggal || !(f.no_mesin || "").trim() || !(f.mold || "").trim()) {
            this.notification.add("Tanggal, No Mesin, dan Nama Matras wajib diisi.", { type: "warning" });
            return;
        }
        f.proses = true;
        const vals = {
            tanggal: f.tanggal,
            shift: f.shift,
            no_mesin: f.no_mesin.trim(),
            mold: f.mold.trim(),
            total_menit: num(f.total_menit),
            downtime_unplanned: num(f.downtime),
            penyebab: f.penyebab,
            counter_awal: Math.round(num(f.counter_awal)),
            counter_akhir: Math.round(num(f.counter_akhir)),
            hpr_actual: Math.round(num(f.hpr)),
            ideal_ct: num(f.ideal_ct),
            total_reject: Math.round(num(f.reject)),
        };
        try {
            await this.orm.call("oee.entry", "oee_simpan", [vals, f.id]);
            this.state.form.buka = false;
            await this.muatData(this.state.year, this.state.month);
            this.notification.add("Data tersimpan.", { type: "success" });
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
        f.proses = false;
    }

    async hapusEntry(rec) {
        const pesan = "Hapus data tanggal " + rec.tanggal + " — Mesin " + rec.no_mesin +
            " (" + rec.mold + ")?\nData yang dihapus tidak bisa dikembalikan.";
        if (!window.confirm(pesan)) {
            return;
        }
        try {
            await this.orm.call("oee.entry", "oee_hapus", [rec.id]);
            await this.muatData(this.state.year, this.state.month);
            this.notification.add("Data terhapus.", { type: "success" });
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
    }

    _pesanError(e) {
        const d = e && e.data ? e.data : null;
        if (d && d.message) {
            return d.message;
        }
        return (e && e.message) ? e.message : "Terjadi kesalahan.";
    }
}

registry.category("actions").add("custom_oee.input_app", OeeInputApp);
