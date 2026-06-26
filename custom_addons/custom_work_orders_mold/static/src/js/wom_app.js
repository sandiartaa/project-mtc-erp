/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class WomApp extends Component {
    static template = "custom_work_orders_mold.WomApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.bus = useService("bus_service");

        this._CHANNEL = "wo_work_order";
        this._TYPE = "wo_work_order/changed";
        this._onChanged = () => this.muatData();

        this.statusPilihan = [
            { value: "ongoing", label: "Ongoing" },
            { value: "finished", label: "Finished" },
        ];
        this.PER_HAL = 6;

        this.state = useState({
            list: [],
            memuat: true,
            cari: "",
            admin: false,
            adaRequestor: true,
            daftarDeskripsi: [],
            aksiMenuBuka: false,
            // Password requestor terverifikasi (untuk Add) + nama penginput
            sandi: "",
            penginput: "",

            gerbang: { buka: false, password: "", proses: false },
            form: {
                buka: false, menyimpan: false,
                name: "", code: "", qty: "", request_date: "",
                image_data: "", image_preview: "", namaFile: "", seret: false,
            },
            // Mold dipilih dari Master Mold (dropdown by Code → auto Name)
            daftarMaster: [],
            masterPicker: { buka: false, cari: "", halaman: 1 },
            // Deskripsi: pilihan (boleh >1) + sub-deskripsi bebas → disusun ke details.
            descPilih: [],
            subDesc: "",
            descMgr: { buka: false, editId: null, name: "", proses: false },
            // Popup isi Lead Time ATAU Finish Repair (mode), butuh password Teknisi
            jadwal: { buka: false, rec: null, mode: "lead", password: "", lead_time: "", finish_date: "", proses: false },
            // Popup Approve (butuh password Requestor) + note opsional
            approve: { buka: false, rec: null, password: "", note: "", proses: false },
            // Popup lihat detail approve per WO
            approveDetail: { buka: false, rec: null },
            // Kelola user/password (admin) — dengan role
            kred: { buka: false, items: [], memuat: false, editId: null, username: "", password: "", role: "requestor", proses: false },
            // Master Mold (admin): CRUD Code+Name + import CSV + hapus per batch + centang massal
            master: { buka: false, items: [], batch: [], pilih: [], memuat: false, editId: null, code: "", name: "", proses: false, file: null, namaFile: "", importProses: false },
            history: { buka: false, items: [], memuat: false },
        });

        onMounted(async () => {
            this.bus.addChannel(this._CHANNEL);
            this.bus.subscribe(this._TYPE, this._onChanged);
            await this.muatInfo();
            await Promise.all([this.muatData(), this.muatDeskripsi(), this.muatMasterPilihan()]);
        });
        onWillUnmount(() => {
            this.bus.unsubscribe(this._TYPE, this._onChanged);
            this.bus.deleteChannel(this._CHANNEL);
        });
    }

    async muatInfo() {
        try {
            const info = await this.orm.call("wo.work.order", "wom_info", []);
            this.state.admin = !!info.admin;
            this.state.adaRequestor = !!info.ada_requestor;
        } catch (e) { console.error("Gagal cek info:", e); }
    }
    async muatData() {
        this.state.memuat = true;
        try { this.state.list = await this.orm.call("wo.work.order", "wom_daftar", []); }
        catch (e) { console.error(e); this.notification.add("Failed to load Work Order Mold.", { type: "danger" }); }
        this.state.memuat = false;
    }
    async muatDeskripsi() {
        try { this.state.daftarDeskripsi = await this.orm.call("wo.work.order", "wom_daftar_deskripsi", []); }
        catch (e) { console.error("Gagal memuat deskripsi:", e); }
    }

    get listTersaring() {
        const cari = (this.state.cari || "").trim().toLowerCase();
        if (!cari) return this.state.list;
        return this.state.list.filter((r) =>
            (r.wo_number || "").toLowerCase().includes(cari) ||
            (r.name || "").toLowerCase().includes(cari) ||
            (r.code || "").toLowerCase().includes(cari));
    }

    // ── Label & util ──
    labelStatus(v) { const f = this.statusPilihan.find((x) => x.value === v); return f ? f.label : "—"; }
    kelasStatus(v) { return { ongoing: "cwom-st-ongoing", finished: "cwom-st-finished" }[v] || ""; }
    labelApproval(s) { return { draft: "Not Submitted", ready: "Awaiting Approval", approved: "Approved" }[s] || "—"; }
    kelasApproval(s) { return { draft: "cwom-apr-draft", ready: "cwom-apr-ready", approved: "cwom-apr-approved" }[s] || ""; }
    formatTanggal(d) {
        if (!d) return "—";
        const dt = new Date(d + "T00:00:00");
        if (isNaN(dt)) return d;
        return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
    namaJobType(rec) { return rec.job_type_id ? rec.job_type_id[1] : ""; }
    namaRequestor(rec) { return rec.requestor_id ? rec.requestor_id[1] : ""; }
    namaExecutor(rec) { return rec.incharge_id ? rec.incharge_id[1] : (rec.incharge_custom || ""); }
    barisRequestor(rec) {
        const a = this.namaRequestor(rec), b = rec.request_date ? this.formatTanggal(rec.request_date) : "";
        return [a, b].filter((x) => x).join(" - ") || "—";
    }
    subKartu(rec) { return [rec.code, this.namaJobType(rec)].filter((x) => x).join(" · ") || "—"; }
    // Pecah details "Opt1-Opt2#subdesc" jadi poin + catatan untuk tampilan bullet.
    detailPoin(details) {
        if (!details) return { opsi: [], sub: "" };
        const h = details.indexOf("#");
        const opsiStr = h !== -1 ? details.slice(0, h) : details;
        const sub = h !== -1 ? details.slice(h + 1) : "";
        const opsi = opsiStr ? opsiStr.split("-").map((s) => s.trim()).filter((s) => s) : [];
        return { opsi, sub: (sub || "").trim() };
    }
    // Executor (Teknisi Repair) ditentukan dari app Work Orders utama
    // (mold disimpan di incharge_custom = username teknisi).
    adaExecutor(rec) { return !!(rec.incharge_id || rec.incharge_custom); }
    // Approve muncul saat Finish Repair sudah diisi & belum diajukan.
    showApprove(rec) { return this.adaExecutor(rec) && !!rec.finish_date && rec.approval_state === "draft"; }
    // Sudah Finished → tidak bisa edit dari app Mold (hanya di app Work Orders).
    selesai(rec) { return rec.status === "finished"; }
    bisaEditJadwal(rec) { return this.adaExecutor(rec) && !this.selesai(rec); }
    // Detail approve bisa dilihat setelah disetujui.
    adaDetailApprove(rec) { return rec.approval_state === "approved"; }
    // Lead Time ditampilkan dengan satuan "Jam" bila berupa angka.
    tampilLeadTime(rec) {
        const v = (rec.lead_time || "").trim();
        if (!v) return "—";
        // Angka (termasuk desimal mis. 8.5 / 8,5) → tambahkan satuan "Jam".
        return /^\d+(?:[.,]\d+)?$/.test(v) ? v + " Jam" : v;
    }
    bukaApproveDetail(rec) { this.state.approveDetail.buka = true; this.state.approveDetail.rec = rec; }
    tutupApproveDetail() { this.state.approveDetail.buka = false; this.state.approveDetail.rec = null; }

    // ── Action dropdown (History) ──
    toggleAksiMenu() { this.state.aksiMenuBuka = !this.state.aksiMenuBuka; }
    tutupAksiMenu() { this.state.aksiMenuBuka = false; }
    async aksiHistory() {
        this.tutupAksiMenu();
        const h = this.state.history;
        h.buka = true; h.items = []; h.memuat = true;
        try { h.items = await this.orm.call("wo.audit", "daftar_audit_mold", []); }
        catch (e) { console.error(e); this.notification.add("Failed to load history.", { type: "danger" }); }
        h.memuat = false;
    }
    tutupHistory() { this.state.history.buka = false; }
    labelAksiAudit(a) { return { create: "Created", edit: "Edited", delete: "Deleted" }[a] || a; }
    kelasAksiAudit(a) { return { create: "cwom-aud-create", edit: "cwom-aud-edit", delete: "cwom-aud-delete" }[a] || ""; }

    // ── Gerbang password (Requestor) → Add form ──
    bukaGerbang() { const g = this.state.gerbang; g.buka = true; g.password = ""; g.proses = false; }
    tutupGerbang() { this.state.gerbang.buka = false; }
    onKeydownGerbang(ev) { if (ev.key === "Enter") this.submitGerbang(); }
    async submitGerbang() {
        const g = this.state.gerbang;
        if (!g.password) { this.notification.add("Enter the password.", { type: "warning" }); return; }
        g.proses = true;
        try {
            const username = await this.orm.call("wo.work.order", "wom_cek_password", [g.password, "requestor"]);
            if (!username) { this.notification.add("Wrong Requestor password.", { type: "danger" }); g.proses = false; return; }
            this.state.sandi = g.password;
            this.state.penginput = username;
            g.buka = false;
            this.bukaForm();
        } catch (e) {
            console.error(e); this.notification.add("Failed. Please try again.", { type: "danger" });
        }
        g.proses = false;
    }

    bukaForm() {
        const f = this.state.form;
        f.buka = true; f.menyimpan = false;
        f.name = ""; f.code = ""; f.qty = ""; f.request_date = "";
        f.image_data = ""; f.image_preview = ""; f.namaFile = ""; f.seret = false;
        this.state.descPilih = [];
        this.state.subDesc = "";
        this.state.descMgr.buka = false;
        this.state.masterPicker.buka = false;
        this.muatMasterPilihan();  // muat ulang daftar Master Mold (mungkin baru ditambah admin)
    }
    async muatMasterPilihan() {
        try { this.state.daftarMaster = await this.orm.call("wo.work.order", "wom_master_pilihan", []); }
        catch (e) { console.error("Gagal memuat Master Mold:", e); this.state.daftarMaster = []; }
    }
    // ── Picker Mold dari Master (search + next/prev), pilih Code → auto Name ──
    get masterTersaring() {
        const cari = (this.state.masterPicker.cari || "").trim().toLowerCase();
        const src = this.state.daftarMaster;
        if (!cari) return src;
        return src.filter((m) => (m.code || "").toLowerCase().includes(cari) || (m.name || "").toLowerCase().includes(cari));
    }
    get masterTotalHalaman() { return Math.max(1, Math.ceil(this.masterTersaring.length / this.PER_HAL)); }
    get masterHalaman() { const i = (this.state.masterPicker.halaman - 1) * this.PER_HAL; return this.masterTersaring.slice(i, i + this.PER_HAL); }
    bukaMasterPicker() { const p = this.state.masterPicker; p.buka = !p.buka; p.cari = ""; p.halaman = 1; }
    masterInput(ev) { this.state.masterPicker.cari = ev.target.value; this.state.masterPicker.halaman = 1; }
    masterNext() { const p = this.state.masterPicker; if (p.halaman < this.masterTotalHalaman) p.halaman++; }
    masterPrev() { const p = this.state.masterPicker; if (p.halaman > 1) p.halaman--; }
    pilihMaster(m) {
        const f = this.state.form;
        if (m) { f.code = m.code || ""; f.name = m.name || ""; }
        else { f.code = ""; f.name = ""; }
        this.state.masterPicker.buka = false;
    }
    tutupForm() { this.state.form.buka = false; this.state.sandi = ""; this.state.penginput = ""; }

    // ── Deskripsi: pilih (boleh >1) + sub-deskripsi → details "A-B#sub" ──
    descDipilih(name) { return this.state.descPilih.includes(name); }
    toggleDesc(name) {
        const arr = this.state.descPilih;
        const i = arr.indexOf(name);
        if (i === -1) arr.push(name); else arr.splice(i, 1);
    }
    _susunDetails() {
        const opsi = this.state.descPilih.join("-");
        const sub = (this.state.subDesc || "").trim();
        if (opsi && sub) return opsi + "#" + sub;
        if (opsi) return opsi;
        if (sub) return sub;
        return false;
    }

    // ── Kelola pilihan deskripsi (dikelola requestor) ──
    bukaDescMgr() { const m = this.state.descMgr; m.buka = true; m.editId = null; m.name = ""; m.proses = false; }
    tutupDescMgr() { this.state.descMgr.buka = false; }
    mulaiEditDesc(d) { const m = this.state.descMgr; m.editId = d.id; m.name = d.name; }
    batalEditDesc() { const m = this.state.descMgr; m.editId = null; m.name = ""; }
    async simpanDesc() {
        const m = this.state.descMgr;
        if (!m.name.trim()) { this.notification.add("Description name required.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.call("wo.work.order", "wom_simpan_deskripsi", [m.editId || false, m.name.trim()]);
            m.editId = null; m.name = "";
            await this.muatDeskripsi();
            this.notification.add("Saved.", { type: "success" });
        } catch (e) {
            console.error(e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        m.proses = false;
    }
    async hapusDesc(d) {
        try {
            await this.orm.call("wo.work.order", "wom_hapus_deskripsi", [d.id]);
            // buang dari pilihan aktif bila terhapus
            const i = this.state.descPilih.indexOf(d.name);
            if (i !== -1) this.state.descPilih.splice(i, 1);
            await this.muatDeskripsi();
            this.notification.add("Deleted.", { type: "success" });
        } catch (e) { console.error(e); this.notification.add("Failed to delete.", { type: "danger" }); }
    }

    // gambar referensi (opsional, tidak ditampilkan di list)
    _bacaGambar(file) {
        if (!file) return;
        const f = this.state.form;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result || "";
            f.image_preview = dataUrl;
            const idx = String(dataUrl).indexOf("base64,");
            f.image_data = idx !== -1 ? String(dataUrl).slice(idx + 7) : "";
            f.namaFile = file.name || "image";
        };
        reader.readAsDataURL(file);
    }
    onPilihGambar(ev) { this._bacaGambar(ev.target.files && ev.target.files[0]); }
    onSeretMasuk(ev) { ev.preventDefault(); this.state.form.seret = true; }
    onSeretKeluar(ev) { ev.preventDefault(); this.state.form.seret = false; }
    onJatuhkan(ev) {
        ev.preventDefault(); this.state.form.seret = false;
        const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (file && /^image\//.test(file.type)) this._bacaGambar(file);
        else this.notification.add("Drop an image file.", { type: "warning" });
    }
    hapusGambar() { const f = this.state.form; f.image_data = ""; f.image_preview = ""; f.namaFile = ""; }

    async simpanForm() {
        const f = this.state.form;
        if (!f.name.trim()) { this.notification.add("Mold Name is required.", { type: "warning" }); return; }
        if (!this.state.sandi) { this.notification.add("Session expired, please re-enter password.", { type: "warning" }); this.tutupForm(); return; }
        f.menyimpan = true;
        try {
            const vals = {
                name: f.name.trim(),
                code: f.code ? f.code.trim() : false,
                qty: f.qty ? f.qty.trim() : false,
                request_date: f.request_date || false,
                details: this._susunDetails(),
            };
            if (f.image_data) vals.image = f.image_data;
            await this.orm.call("wo.work.order", "wom_buat", [vals, this.state.sandi]);
            this.notification.add("Work Order Mold added.", { type: "success" });
            this.tutupForm();
            await this.muatData();
        } catch (e) {
            console.error(e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        f.menyimpan = false;
    }

    // ── Isi Lead Time + Finish Repair (butuh password Teknisi) ──
    bukaJadwal(rec, mode) {
        const j = this.state.jadwal;
        j.buka = true; j.rec = rec; j.mode = mode || "lead"; j.password = "";
        j.lead_time = rec.lead_time || ""; j.finish_date = rec.finish_date || ""; j.proses = false;
    }
    tutupJadwal() { this.state.jadwal.buka = false; this.state.jadwal.rec = null; }
    async simpanJadwal() {
        const j = this.state.jadwal;
        if (!j.password) { this.notification.add("Enter the Teknisi password.", { type: "warning" }); return; }
        j.proses = true;
        try {
            await this.orm.call("wo.work.order", "wom_simpan_jadwal",
                [[j.rec.id], (j.lead_time || "").trim(), j.finish_date || false, j.password]);
            this.notification.add("Lead Time / Finish Repair saved.", { type: "success" });
            this.tutupJadwal();
            await this.muatData();
        } catch (e) {
            console.error(e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        j.proses = false;
    }

    // ── Approve (butuh password Requestor) + note opsional ──
    bukaApprove(rec) {
        const a = this.state.approve;
        a.buka = true; a.rec = rec; a.password = ""; a.note = ""; a.proses = false;
    }
    tutupApprove() { this.state.approve.buka = false; this.state.approve.rec = null; }
    async kirimApprove() {
        const a = this.state.approve;
        if (!a.password) { this.notification.add("Enter the Requestor password.", { type: "warning" }); return; }
        a.proses = true;
        try {
            await this.orm.call("wo.work.order", "wom_approve",
                [[a.rec.id], (a.note || "").trim(), a.password]);
            this.notification.add("Work Order approved (awaiting approval).", { type: "success" });
            this.tutupApprove();
            await this.muatData();
        } catch (e) {
            console.error(e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        a.proses = false;
    }

    // ── Kelola user/password (admin) ──
    labelRole(r) { return { requestor: "Requestor", executor: "Teknisi Repair" }[r] || r; }
    async bukaKred() {
        const k = this.state.kred;
        k.buka = true; k.editId = null; k.username = ""; k.password = ""; k.role = "requestor"; k.proses = false; k.memuat = true;
        try { k.items = await this.orm.call("wo.work.order", "wom_daftar_kredensial", []); }
        catch (e) { console.error(e); this.notification.add("Failed to load users.", { type: "danger" }); }
        k.memuat = false;
    }
    tutupKred() { this.state.kred.buka = false; }
    mulaiEditKred(c) { const k = this.state.kred; k.editId = c.id; k.username = c.username; k.password = c.password; k.role = c.role; }
    batalEditKred() { const k = this.state.kred; k.editId = null; k.username = ""; k.password = ""; k.role = "requestor"; }
    async simpanKred() {
        const k = this.state.kred;
        if (!k.username.trim() || !k.password.trim()) { this.notification.add("Username & password required.", { type: "warning" }); return; }
        k.proses = true;
        try {
            await this.orm.call("wo.work.order", "wom_simpan_kredensial", [k.editId || false, k.username.trim(), k.password.trim(), k.role]);
            k.editId = null; k.username = ""; k.password = ""; k.role = "requestor";
            k.items = await this.orm.call("wo.work.order", "wom_daftar_kredensial", []);
            this.notification.add("Saved.", { type: "success" });
        } catch (e) {
            console.error(e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        k.proses = false;
    }
    async hapusKred(c) {
        const k = this.state.kred;
        try {
            await this.orm.call("wo.work.order", "wom_hapus_kredensial", [c.id]);
            k.items = await this.orm.call("wo.work.order", "wom_daftar_kredensial", []);
            this.notification.add("User deleted.", { type: "success" });
        } catch (e) { console.error(e); this.notification.add("Failed to delete.", { type: "danger" }); }
    }

    // ── Master Mold (admin): CRUD Code + Name + import CSV ──
    async bukaMaster() {
        const m = this.state.master;
        m.buka = true; m.editId = null; m.code = ""; m.name = ""; m.proses = false;
        m.file = null; m.namaFile = ""; m.importProses = false; m.pilih = []; m.memuat = true;
        try { await this._muatMaster(); }
        catch (e) { console.error(e); this.notification.add("Failed to load Master Mold.", { type: "danger" }); }
        m.memuat = false;
    }
    tutupMaster() { this.state.master.buka = false; }
    mulaiEditMaster(it) { const m = this.state.master; m.editId = it.id; m.code = it.code; m.name = it.name; }
    batalEditMaster() { const m = this.state.master; m.editId = null; m.code = ""; m.name = ""; }
    async _muatMaster() {
        const m = this.state.master;
        m.items = await this.orm.call("wo.work.order", "wom_master_daftar", []);
        try { m.batch = await this.orm.call("wo.work.order", "wom_master_daftar_batch", []); }
        catch (e) { m.batch = []; }
        // buang centang yang sudah terhapus
        m.pilih = m.pilih.filter((id) => m.items.some((it) => it.id === id));
    }
    // ── Centang massal Master Mold ──
    pilihMasterAda(id) { return this.state.master.pilih.includes(id); }
    togglePilihMaster(id) {
        const arr = this.state.master.pilih;
        const i = arr.indexOf(id);
        if (i === -1) arr.push(id); else arr.splice(i, 1);
    }
    get semuaMasterDipilih() {
        const m = this.state.master;
        return m.items.length > 0 && m.items.every((it) => m.pilih.includes(it.id));
    }
    toggleSemuaMaster() {
        const m = this.state.master;
        m.pilih = this.semuaMasterDipilih ? [] : m.items.map((it) => it.id);
    }
    async hapusPilihMaster() {
        const m = this.state.master;
        if (!m.pilih.length) { this.notification.add("Tick some molds first.", { type: "warning" }); return; }
        try {
            const n = await this.orm.call("wo.work.order", "wom_master_hapus_banyak", [m.pilih]);
            m.pilih = [];
            await this._muatMaster();
            this.notification.add(`${n} molds deleted.`, { type: "success" });
        } catch (e) { console.error(e); this.notification.add("Failed to delete.", { type: "danger" }); }
    }
    async hapusBatchMaster(b) {
        try {
            const n = await this.orm.call("wo.work.order", "wom_master_hapus_batch", [b.batch]);
            await this._muatMaster();
            this.notification.add(`${n} imported molds deleted.`, { type: "success" });
        } catch (e) { console.error(e); this.notification.add("Failed to delete import.", { type: "danger" }); }
    }
    async simpanMaster() {
        const m = this.state.master;
        if (!m.name.trim()) { this.notification.add("Mold Name is required.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.call("wo.work.order", "wom_master_simpan", [m.editId || false, m.code.trim(), m.name.trim()]);
            m.editId = null; m.code = ""; m.name = "";
            await this._muatMaster();
            this.notification.add("Saved.", { type: "success" });
        } catch (e) {
            console.error(e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        m.proses = false;
    }
    async hapusMaster(it) {
        try {
            await this.orm.call("wo.work.order", "wom_master_hapus", [it.id]);
            await this._muatMaster();
            this.notification.add("Deleted.", { type: "success" });
        } catch (e) { console.error(e); this.notification.add("Failed to delete.", { type: "danger" }); }
    }
    onPilihFileMaster(ev) {
        const file = ev.target.files && ev.target.files[0];
        this.state.master.file = file || null;
        this.state.master.namaFile = file ? file.name : "";
    }
    _deteksiDelimiter(text) {
        const b1 = text.split(/\r?\n/)[0] || "";
        return (b1.match(/;/g) || []).length > (b1.match(/,/g) || []).length ? ";" : ",";
    }
    _parseCsv(text, delim) {
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const rows = []; let row = [], field = "", inQ = false, i = 0;
        while (i < text.length) {
            const c = text[i];
            if (inQ) {
                if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
                field += c; i++; continue;
            }
            if (c === '"') { inQ = true; i++; continue; }
            if (c === delim) { row.push(field); field = ""; i++; continue; }
            if (c === '\r') { i++; continue; }
            if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
            field += c; i++;
        }
        if (field !== "" || row.length) { row.push(field); rows.push(row); }
        return rows;
    }
    async importMaster() {
        const m = this.state.master;
        if (!m.file) { this.notification.add("Choose a CSV file first.", { type: "warning" }); return; }
        m.importProses = true;
        try {
            const text = await m.file.text();
            const matrix = this._parseCsv(text, this._deteksiDelimiter(text));
            if (matrix.length < 2) { this.notification.add("CSV is empty.", { type: "warning" }); m.importProses = false; return; }
            const headers = matrix[0].map((h) => (h || "").trim());
            const rows = [];
            for (let r = 1; r < matrix.length; r++) {
                const arr = matrix[r];
                if (arr.every((x) => (x || "").trim() === "")) continue;
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = arr[idx] !== undefined ? arr[idx] : ""; });
                rows.push(obj);
            }
            const res = await this.orm.call("wo.work.order", "wom_master_import", [rows, m.namaFile]);
            this.notification.add(`Imported ${res.created} molds.`, { type: "success" });
            m.file = null; m.namaFile = "";
            await this._muatMaster();
        } catch (e) {
            console.error(e); this.notification.add("Failed to import CSV.", { type: "danger" });
        }
        m.importProses = false;
    }
    unduhTemplateMaster() {
        const csv = "Code,Name\nM-001,Mold Sample A\nM-002,Mold Sample B\n";
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "template_master_mold.csv"; a.click();
        URL.revokeObjectURL(url);
    }
}

registry.category("actions").add("wom_app", WomApp);
