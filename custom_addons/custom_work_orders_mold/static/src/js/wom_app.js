/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount, markup } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";

class WomApp extends Component {
    static template = "custom_work_orders_mold.WomApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.bus = useService("bus_service");

        // Channel & handler real-time: tiap ada perubahan Work Order dari user mana pun,
        // server menyiarkan sinyal lewat bus → daftar dimuat ulang otomatis tanpa refresh.
        this._WO_CHANNEL = "wom_work_order";
        this._WO_TYPE = "wom_work_order/changed";
        this._onWoChanged = () => this.muatData();

        this._aksiKonfirmasi = null;
        this._konfirmasiPesan = markup("");

        this.statusPilihan = [
            { value: "ongoing", label: "Ongoing" },
            { value: "finished", label: "Finished" },
        ];
        this.lokalRrcPilihan = [
            { value: "lokal", label: "Local" },
            { value: "rrc", label: "RRC" },
        ];

        this.state = useState({
            list: [],
            memuat: true,
            bisaUbah: false,        // true = grup Full (boleh CRUD)
            adalahDesigner: false,  // true = grup Designer (boleh Ready for Approval)
            bolehFilterDesigner: false, // true = Full / Read-only (filter per designer)
            cari: "",
            filterStatus: "",
            filterDesigner: "",     // key 'u:<id>' / 'c:<nama>' untuk filter designer
            filterTglField: "request_date", // field tanggal yang difilter
            filterTglDari: "",
            filterTglSampai: "",
            daftarDesignerFilter: [], // pilihan designer untuk dropdown filter
            daftarUser: [],   // user (akses Work Order Mold) untuk Designer
            daftarJobType: [], // pilihan Job Type (model wom.job.type, bisa di-CRUD)
            daftarPerson: [],  // pilihan Requestor/Approver (model wom.person, bisa di-CRUD)
            daftarBrand: [],   // pilihan Brand (model wom.brand, bisa di-CRUD)

            // Pengelola Job Type (CRUD daftar dropdown)
            jobTypeMgr: { buka: false, baru: "", editId: null, editNama: "", proses: false },
            // Pengelola Person/Requestor-Approver (CRUD daftar dropdown)
            personMgr: { buka: false, baru: "", editId: null, editNama: "", proses: false },
            // Pengelola Brand (CRUD daftar dropdown)
            brandMgr: { buka: false, baru: "", editId: null, editNama: "", proses: false },

            // Picker user generik (target: incharge) + input nama custom (designer ketik bebas)
            userPicker: { buka: false, target: "", cari: "", halaman: 1, custom: "" },

            // Picker field generik untuk dropdown form (job_type | lokal_rrc | requestor | approver)
            fieldPicker: { buka: false, target: "", cari: "", halaman: 1 },

            form: {
                buka: false,
                mode: "tambah",
                id: null,
                menyimpan: false,
                wo_number: "",
                // Product
                name: "",
                code: "",
                brand_id: "", brand_nama: "",
                job_type_id: "", job_type_nama: "",
                details: "",
                // IN CHARGE (incharge_id = user sistem; incharge_custom = nama ketik bebas)
                incharge_id: "", incharge_nama: "", incharge_custom: "",
                lokal_rrc: "",
                // Requestor
                requestor_id: "", requestor_nama: "",
                // Timeline
                request_date: "",
                target_date: "",
                finish_date: "",
                // Approval
                approver_id: "", approver_nama: "",
                approval_date: "",
                // Status
                status: "ongoing",
                // Gambar
                image_data: "", image_preview: "", image_hapus: false, image_ada: false,
            },

            impor: { buka: false, file: null, namaFile: "", proses: false, batch: [] },
            konfirmasi: { buka: false, judul: "", labelYa: "Ya", warnaYa: "merah" },
            // Kartu mobile yang sedang dibuka (accordion). Key = id work order → true.
            kartuTerbuka: {},
            // Popup lihat gambar (dipicu dari thumbnail tabel desktop)
            imgPopup: { buka: false, url: "", judul: "", ref: false },
            // Form Reject + isi Detail Revision (textarea besar) + gambar opsional
            revisiForm: {
                buka: false, rec: null, detail: "", proses: false, seret: false,
                image_data: "", image_preview: "", namaFile: "",
            },
            // Popup daftar Revisions tiap Work Order
            revisiList: { buka: false, judul: "", items: [], memuat: false, woId: null },
            // Popup Ready for Approval: designer upload image + description
            readyForm: {
                buka: false, rec: null, proses: false, seret: false,
                image_data: "", image_preview: "", namaFile: "", description: "",
            },
            // Popup riwayat image designer tiap Work Order
            designList: { buka: false, judul: "", items: [], memuat: false, woId: null },
            // Popup Filter (gabungan: status + period + designer)
            filterPopup: { buka: false },
            // Popup History (audit) — khusus akses Full
            history: { buka: false, items: [], memuat: false },
        });

        onMounted(async () => {
            // Daftarkan diri ke channel bus & mulai dengarkan sinyal perubahan.
            this.bus.addChannel(this._WO_CHANNEL);
            this.bus.subscribe(this._WO_TYPE, this._onWoChanged);
            await this.muatHakAkses();
            await Promise.all([
                this.muatData(), this.muatUser(),
                this.muatJobType(), this.muatPerson(), this.muatBrand(),
                this.muatDesignerFilter(),
            ]);
        });

        onWillUnmount(() => {
            this.bus.unsubscribe(this._WO_TYPE, this._onWoChanged);
            this.bus.deleteChannel(this._WO_CHANNEL);
        });
    }

    // ─── DATA ────────────────────────────────────────────────────────────────
    async muatData() {
        this.state.memuat = true;
        try {
            const domain = [];
            const cari = (this.state.cari || "").trim();
            if (cari) {
                domain.push(
                    "|", "|",
                    ["wo_number", "ilike", cari],
                    ["name", "ilike", cari],
                    ["code", "ilike", cari]
                );
            }
            if (this.state.filterStatus) {
                domain.push(["status", "=", this.state.filterStatus]);
            }
            // Filter rentang tanggal (semua akses) pada field tanggal terpilih.
            const tf = this.state.filterTglField || "request_date";
            if (this.state.filterTglDari) domain.push([tf, ">=", this.state.filterTglDari]);
            if (this.state.filterTglSampai) domain.push([tf, "<=", this.state.filterTglSampai]);
            // Filter per designer (Full & Read-only): user sistem atau nama custom.
            if (this.state.bolehFilterDesigner && this.state.filterDesigner) {
                const fd = this.state.filterDesigner;
                if (fd.startsWith("u:")) domain.push(["incharge_id", "=", parseInt(fd.slice(2))]);
                else if (fd.startsWith("c:")) domain.push(["incharge_custom", "=", fd.slice(2)]);
            }
            this.state.list = await this.orm.searchRead(
                "wom.work.order",
                domain,
                ["id", "wo_number", "name", "code", "brand_id", "job_type_id", "details", "image_ada",
                 "design_image_ada", "last_design_image_id", "design_count",
                 "incharge_id", "incharge_custom", "lokal_rrc", "requestor_id", "create_uid",
                 "request_date", "target_date", "finish_date",
                 "approver_id", "approval_date", "status", "approval_state", "revisi_count"],
                { order: "id desc" }
            );
        } catch (e) {
            console.error("Gagal memuat work order:", e);
            this.notification.add("Failed to load Work Order data.", { type: "danger" });
        }
        this.state.memuat = false;
    }

    async muatUser() {
        try {
            this.state.daftarUser = await this.orm.call(
                "wom.work.order", "users_incharge", []
            );
        } catch (e) {
            console.error("Gagal memuat user:", e);
        }
    }

    async muatHakAkses() {
        try {
            const p = await this.orm.call("wom.work.order", "peran_akses", []);
            this.state.bisaUbah = !!p.full;
            this.state.adalahDesigner = !!p.designer;
            // Filter per designer hanya untuk Full & Read-only (Designer cuma lihat WO sendiri).
            this.state.bolehFilterDesigner = !!(p.full || p.readonly);
        } catch (e) {
            console.error("Gagal cek hak akses:", e);
            this.state.bisaUbah = false;
            this.state.adalahDesigner = false;
            this.state.bolehFilterDesigner = false;
        }
    }

    async muatDesignerFilter() {
        if (!this.state.bolehFilterDesigner) return;
        try {
            this.state.daftarDesignerFilter = await this.orm.call(
                "wom.work.order", "daftar_designer_filter", []
            );
        } catch (e) {
            console.error("Gagal memuat daftar designer filter:", e);
        }
    }

    async muatJobType() {
        try {
            this.state.daftarJobType = await this.orm.call(
                "wom.job.type", "daftar_job_type", []
            );
        } catch (e) {
            console.error("Gagal memuat Job Type:", e);
        }
    }

    async muatPerson() {
        try {
            this.state.daftarPerson = await this.orm.call(
                "wom.person", "daftar_person", []
            );
        } catch (e) {
            console.error("Gagal memuat Requestor/Approver:", e);
        }
    }

    async muatBrand() {
        try {
            this.state.daftarBrand = await this.orm.call(
                "wom.brand", "daftar_brand", []
            );
        } catch (e) {
            console.error("Gagal memuat Brand:", e);
        }
    }

    cariData() { this.muatData(); }
    handleKeydown(ev) { if (ev.key === "Enter") this.muatData(); }
    resetCari() {
        this.state.cari = ""; this.state.filterStatus = "";
        this.state.filterDesigner = "";
        this.state.filterTglField = "request_date";
        this.state.filterTglDari = ""; this.state.filterTglSampai = "";
        this.muatData();
    }
    setFilterStatus(v) { this.state.filterStatus = v; this.muatData(); }
    setFilterDesigner(ev) { this.state.filterDesigner = ev.target.value; this.muatData(); }
    setFilterTglField(ev) { this.state.filterTglField = ev.target.value; this.muatData(); }
    setFilterTglDari(ev) { this.state.filterTglDari = ev.target.value; this.muatData(); }
    setFilterTglSampai(ev) { this.state.filterTglSampai = ev.target.value; this.muatData(); }
    // Label field tanggal yang sedang difilter (untuk teks ringkas).
    labelTglField() {
        return { request_date: "Req Date", target_date: "Target",
                 finish_date: "Finish Date", approval_date: "Approval Date" }[this.state.filterTglField] || "Date";
    }
    // ── Popup Filter (1 tombol) ──
    bukaFilter() { this.state.filterPopup.buka = true; }
    tutupFilter() { this.state.filterPopup.buka = false; }
    // Jumlah filter aktif (untuk badge di tombol Filter).
    get filterAktifJumlah() {
        let n = 0;
        if (this.state.filterStatus) n++;
        if (this.state.filterTglDari || this.state.filterTglSampai) n++;
        if (this.state.bolehFilterDesigner && this.state.filterDesigner) n++;
        return n;
    }

    // ── Popup History (audit) — akses Full ──
    async bukaHistory() {
        const h = this.state.history;
        h.buka = true; h.items = []; h.memuat = true;
        try {
            h.items = await this.orm.call("wom.audit", "daftar_audit", []);
        } catch (e) {
            console.error("Gagal memuat history:", e);
            this.notification.add("Failed to load history.", { type: "danger" });
        }
        h.memuat = false;
    }
    tutupHistory() { this.state.history.buka = false; }
    labelAksiAudit(a) {
        return { create: "Created", edit: "Edited", delete: "Deleted" }[a] || a;
    }
    kelasAksiAudit(a) {
        return { create: "cwom-aud-create", edit: "cwom-aud-edit", delete: "cwom-aud-delete" }[a] || "";
    }

    // Enlarge gambar generik dari url (dipakai history revisi & image designer).
    bukaGambarPopup(url, judul) {
        this.state.imgPopup.buka = true;
        this.state.imgPopup.url = url;
        this.state.imgPopup.ref = false;
        this.state.imgPopup.judul = judul || "";
    }

    labelStatus(v) {
        const f = this.statusPilihan.find((x) => x.value === v);
        return f ? f.label : "—";
    }
    kelasStatus(v) {
        return { ongoing: "cwom-st-ongoing", finished: "cwom-st-finished" }[v] || "";
    }
    labelLokalRrc(v) {
        const f = this.lokalRrcPilihan.find((x) => x.value === v);
        return f ? f.label : "—";
    }

    // ─── ALUR APPROVAL (Ready / Cancel / Approve / Tolak) ────────────────────
    labelApproval(s) {
        return { draft: "Not Submitted", ready: "Awaiting Approval", approved: "Approved" }[s] || "—";
    }
    kelasApproval(s) {
        return { draft: "cwom-apr-draft", ready: "cwom-apr-ready", approved: "cwom-apr-approved" }[s] || "";
    }
    // Apakah user yang login adalah Designer 2D/3D dari WO ini
    isDesigner(rec) {
        return !!(rec.incharge_id && rec.incharge_id[0] === user.userId);
    }
    // Ready/Cancel HANYA untuk Designer pada WO miliknya sendiri.
    // User Full TIDAK menampilkan tombol Ready (hanya Approve/Reject).
    showReady(rec) { return this.state.adalahDesigner && this.isDesigner(rec) && rec.approval_state === "draft"; }
    showCancel(rec) { return this.state.adalahDesigner && this.isDesigner(rec) && rec.approval_state === "ready"; }
    showApprove(rec) { return this.state.bisaUbah && rec.approval_state === "ready"; }
    showTolak(rec) { return this.state.bisaUbah && rec.approval_state === "ready"; }

    async _aksiApproval(rec, method, pesanOk) {
        try {
            await this.orm.call("wom.work.order", method, [[rec.id]]);
            this.notification.add(pesanOk, { type: "success" });
            await this.muatData();
        } catch (e) {
            console.error("Gagal aksi approval:", e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
    }
    // Ready for Approval kini membuka popup upload image designer + description.
    setReady(rec) {
        const rf = this.state.readyForm;
        rf.buka = true; rf.rec = rec; rf.proses = false; rf.seret = false;
        rf.image_data = ""; rf.image_preview = ""; rf.namaFile = ""; rf.description = "";
    }
    tutupReadyForm() {
        const rf = this.state.readyForm;
        rf.buka = false; rf.rec = null;
        rf.image_data = ""; rf.image_preview = ""; rf.namaFile = ""; rf.description = "";
    }
    // Baca file gambar (dipakai input file & drag-drop) → simpan base64 + preview.
    _bacaGambarReady(file) {
        if (!file) return;
        const rf = this.state.readyForm;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result || "";
            rf.image_preview = dataUrl;
            const idx = String(dataUrl).indexOf("base64,");
            rf.image_data = idx !== -1 ? String(dataUrl).slice(idx + 7) : "";
            rf.namaFile = file.name || "image";
        };
        reader.readAsDataURL(file);
    }
    onPilihGambarReady(ev) {
        const file = ev.target.files && ev.target.files[0];
        this._bacaGambarReady(file);
    }
    onSeretMasuk(ev) { ev.preventDefault(); this.state.readyForm.seret = true; }
    onSeretKeluar(ev) { ev.preventDefault(); this.state.readyForm.seret = false; }
    onJatuhkanGambar(ev) {
        ev.preventDefault();
        this.state.readyForm.seret = false;
        const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (file && /^image\//.test(file.type)) {
            this._bacaGambarReady(file);
        } else {
            this.notification.add("Drop an image file.", { type: "warning" });
        }
    }
    hapusGambarReady() {
        const rf = this.state.readyForm;
        rf.image_data = ""; rf.image_preview = ""; rf.namaFile = "";
    }
    async kirimReady() {
        const rf = this.state.readyForm;
        const desc = (rf.description || "").trim();
        if (!desc) {
            this.notification.add("Description is required.", { type: "warning" });
            return;
        }
        rf.proses = true;
        try {
            await this.orm.call(
                "wom.work.order", "action_set_ready",
                [[rf.rec.id], rf.image_data || false, desc]
            );
            this.notification.add("Work Order submitted for approval.", { type: "success" });
            this.tutupReadyForm();
            await this.muatData();
        } catch (e) {
            console.error("Gagal ajukan approval:", e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        rf.proses = false;
    }
    cancelReady(rec) { this._aksiApproval(rec, "action_cancel_ready", "Submission cancelled."); }
    approve(rec) {
        this.tampilKonfirmasi({
            judul: "Approve Work Order",
            pesan: `Approve Work Order <b>${rec.wo_number}</b> (${rec.name})?`,
            labelYa: "Yes, Approve", warnaYa: "merah",
            aksi: () => this._aksiApproval(rec, "action_approve", "Work Order approved."),
        });
    }
    // Reject membuka form Detail Revision (textarea besar) — bukan konfirmasi biasa.
    reject(rec) {
        const rf = this.state.revisiForm;
        rf.buka = true; rf.rec = rec; rf.detail = ""; rf.proses = false; rf.seret = false;
        rf.image_data = ""; rf.image_preview = ""; rf.namaFile = "";
    }
    tutupRevisiForm() {
        const rf = this.state.revisiForm;
        rf.buka = false; rf.rec = null; rf.detail = "";
        rf.image_data = ""; rf.image_preview = ""; rf.namaFile = "";
    }
    // ── Gambar opsional di form Reject (drag-drop / upload) ──
    _bacaGambarRevisi(file) {
        if (!file) return;
        const rf = this.state.revisiForm;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result || "";
            rf.image_preview = dataUrl;
            const idx = String(dataUrl).indexOf("base64,");
            rf.image_data = idx !== -1 ? String(dataUrl).slice(idx + 7) : "";
            rf.namaFile = file.name || "image";
        };
        reader.readAsDataURL(file);
    }
    onPilihGambarRevisi(ev) { this._bacaGambarRevisi(ev.target.files && ev.target.files[0]); }
    onSeretMasukRevisi(ev) { ev.preventDefault(); this.state.revisiForm.seret = true; }
    onSeretKeluarRevisi(ev) { ev.preventDefault(); this.state.revisiForm.seret = false; }
    onJatuhkanGambarRevisi(ev) {
        ev.preventDefault();
        this.state.revisiForm.seret = false;
        const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (file && /^image\//.test(file.type)) this._bacaGambarRevisi(file);
        else this.notification.add("Drop an image file.", { type: "warning" });
    }
    hapusGambarRevisi() {
        const rf = this.state.revisiForm;
        rf.image_data = ""; rf.image_preview = ""; rf.namaFile = "";
    }
    async kirimRevisi() {
        const rf = this.state.revisiForm;
        const detail = (rf.detail || "").trim();
        if (!detail) {
            this.notification.add("Revision Detail is required.", { type: "warning" });
            return;
        }
        rf.proses = true;
        try {
            await this.orm.call("wom.work.order", "action_reject", [[rf.rec.id], detail, rf.image_data || false]);
            this.notification.add("Submission rejected. Revision saved.", { type: "success" });
            this.tutupRevisiForm();
            await this.muatData();
        } catch (e) {
            console.error("Gagal tolak/revisi:", e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        rf.proses = false;
    }

    // ─── DAFTAR REVISIONS (popup per Work Order) ─────────────────────────────
    async bukaRevisiList(rec) {
        const rl = this.state.revisiList;
        rl.buka = true; rl.woId = rec.id;
        rl.judul = rec.wo_number + (rec.name ? " — " + rec.name : "");
        rl.items = []; rl.memuat = true;
        try {
            rl.items = await this.orm.call("wom.revision", "revisi_wo", [rec.id]);
        } catch (e) {
            console.error("Gagal memuat revisi:", e);
            this.notification.add("Failed to load revisions.", { type: "danger" });
        }
        rl.memuat = false;
    }
    tutupRevisiList() { this.state.revisiList.buka = false; }
    // Hapus 1 entri revisi (akses Full).
    hapusRevisiItem(rv) {
        this.tampilKonfirmasi({
            judul: "Delete Revision",
            pesan: "Delete this revision entry (and its image)? This cannot be undone.",
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this._lakukanHapusRevisiItem(rv),
        });
    }
    async _lakukanHapusRevisiItem(rv) {
        try {
            await this.orm.unlink("wom.revision", [rv.id]);
            this.notification.add("Revision deleted.", { type: "success" });
            const rl = this.state.revisiList;
            if (rl.woId) rl.items = await this.orm.call("wom.revision", "revisi_wo", [rl.woId]);
            await this.muatData();
        } catch (e) {
            console.error("Gagal hapus revisi:", e);
            this.notification.add("Failed to delete revision.", { type: "danger" });
        }
    }
    formatTanggal(d) {
        if (!d) return "—";
        const dt = new Date(d + "T00:00:00");
        if (isNaN(dt)) return d;
        return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }

    // ─── Buka/tutup kartu (accordion mobile) ─────────────────────────────────
    toggleKartu(id) {
        if (this.state.kartuTerbuka[id]) {
            delete this.state.kartuTerbuka[id];
        } else {
            this.state.kartuTerbuka[id] = true;
        }
    }
    // URL image referensi (dari pembuat WO).
    urlRef(rec) { return "/web/image/wom.work.order/" + rec.id + "/image"; }
    // URL image designer terbaru (yang ditampilkan utama).
    urlDesign(rec) {
        const d = rec.last_design_image_id;
        return d ? "/web/image/wom.design.image/" + d[0] + "/image" : "";
    }
    // Apakah ada gambar untuk ditampilkan (designer terbaru, atau referensi).
    adaGambarTampil(rec) { return !!(rec.design_image_ada || rec.image_ada); }
    // Yang dipakai referensi (belum ada image designer tapi ada referensi).
    pakaiReferensi(rec) { return !rec.design_image_ada && !!rec.image_ada; }
    // URL gambar yang ditampilkan: image designer terbaru, jika belum ada pakai referensi.
    urlGambar(rec) {
        return rec.design_image_ada ? this.urlDesign(rec) : this.urlRef(rec);
    }

    // ─── Popup lihat gambar (desktop) ────────────────────────────────────────
    bukaImgPopup(rec) {
        this.state.imgPopup.buka = true;
        this.state.imgPopup.url = this.urlGambar(rec);
        this.state.imgPopup.ref = this.pakaiReferensi(rec);
        this.state.imgPopup.judul = rec.wo_number + (rec.name ? " — " + rec.name : "");
    }
    tutupImgPopup() { this.state.imgPopup.buka = false; }

    // ─── Popup riwayat image designer ────────────────────────────────────────
    async bukaDesignList(rec) {
        const dl = this.state.designList;
        dl.buka = true; dl.woId = rec.id;
        dl.judul = rec.wo_number + (rec.name ? " — " + rec.name : "");
        dl.items = []; dl.memuat = true;
        try {
            dl.items = await this.orm.call("wom.design.image", "riwayat_wo", [rec.id]);
        } catch (e) {
            console.error("Gagal memuat image designer:", e);
            this.notification.add("Failed to load designer images.", { type: "danger" });
        }
        dl.memuat = false;
    }
    tutupDesignList() { this.state.designList.buka = false; }
    // Hapus 1 image designer (akses Full).
    hapusDesignItem(di) {
        this.tampilKonfirmasi({
            judul: "Delete Designer Image",
            pesan: "Delete this designer image? This cannot be undone.",
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this._lakukanHapusDesignItem(di),
        });
    }
    async _lakukanHapusDesignItem(di) {
        try {
            await this.orm.unlink("wom.design.image", [di.id]);
            this.notification.add("Designer image deleted.", { type: "success" });
            const dl = this.state.designList;
            if (dl.woId) dl.items = await this.orm.call("wom.design.image", "riwayat_wo", [dl.woId]);
            await this.muatData();
        } catch (e) {
            console.error("Gagal hapus image designer:", e);
            this.notification.add("Failed to delete designer image.", { type: "danger" });
        }
    }
    urlDesignItem(id) { return "/web/image/wom.design.image/" + id + "/image"; }
    urlRevisiItem(id) { return "/web/image/wom.revision/" + id + "/image"; }

    // ─── Gabungan baris untuk tampilan kartu (mobile) ────────────────────────
    _gabung(parts) {
        return parts.filter((p) => p !== false && p !== null && p !== undefined && p !== "").join(" - ") || "—";
    }
    // Code - Brand - Job Type  (mis. "WT016 - STAR RIDER - Layer")
    barisProduk(rec) {
        return this._gabung([
            rec.code,
            rec.brand_id ? rec.brand_id[1] : null,
            rec.job_type_id ? rec.job_type_id[1] : null,
        ]);
    }
    // Nama designer: user sistem bila ada, jika tidak pakai nama custom (ketik bebas).
    namaDesigner(rec) {
        if (rec.incharge_id) return rec.incharge_id[1];
        if (rec.incharge_custom) return rec.incharge_custom;
        return "";
    }
    // Designer - Lokal/RRC  (mis. "Izza - Lokal")
    barisDesigner(rec) {
        return this._gabung([
            this.namaDesigner(rec) || null,
            rec.lokal_rrc ? this.labelLokalRrc(rec.lokal_rrc) : null,
        ]);
    }
    // Requestor - Req Date  (mis. "P. Apin - 20 Jun 2026")
    barisRequestor(rec) {
        return this._gabung([
            rec.requestor_id ? rec.requestor_id[1] : null,
            rec.request_date ? this.formatTanggal(rec.request_date) : null,
        ]);
    }
    // Approver - Approval Date
    barisApprover(rec) {
        return this._gabung([
            rec.approver_id ? rec.approver_id[1] : null,
            rec.approval_date ? this.formatTanggal(rec.approval_date) : null,
        ]);
    }

    // ─── PICKER USER GENERIK (Designer/Requestor/Approver) ───────────────────
    get userTerfilter() {
        const cari = (this.state.userPicker.cari || "").trim().toLowerCase();
        const src = this.state.daftarUser;
        return cari ? src.filter((u) => (u.name || "").toLowerCase().includes(cari)) : src;
    }
    get userTotalHalaman() { return Math.max(1, Math.ceil(this.userTerfilter.length / 5)); }
    get userHalaman() {
        const mulai = (this.state.userPicker.halaman - 1) * 5;
        return this.userTerfilter.slice(mulai, mulai + 5);
    }
    bukaUserPicker(target) {
        const p = this.state.userPicker;
        if (p.buka && p.target === target) { p.buka = false; return; }
        this.tutupFieldPicker();
        p.buka = true; p.target = target; p.cari = ""; p.halaman = 1;
        p.custom = target === "incharge" ? (this.state.form.incharge_custom || "") : "";
    }
    tutupUserPicker() { this.state.userPicker.buka = false; }
    userInput(ev) { this.state.userPicker.cari = ev.target.value; this.state.userPicker.halaman = 1; }
    userNext() { const p = this.state.userPicker; if (p.halaman < this.userTotalHalaman) p.halaman++; }
    userPrev() { const p = this.state.userPicker; if (p.halaman > 1) p.halaman--; }
    pilihUser(u) {
        const t = this.state.userPicker.target;
        const f = this.state.form;
        if (u) { f[t + "_id"] = String(u.id); f[t + "_nama"] = u.name; }
        else { f[t + "_id"] = ""; f[t + "_nama"] = ""; }
        // Memilih user sistem membatalkan nama designer custom.
        if (t === "incharge") { f.incharge_custom = ""; }
        this.tutupUserPicker();
    }
    userCustomInput(ev) { this.state.userPicker.custom = ev.target.value; }
    // Pakai nama designer ketik bebas → kosongkan pilihan user sistem.
    pakaiDesignerCustom() {
        const val = (this.state.userPicker.custom || "").trim();
        if (!val) { this.notification.add("Type a designer name first.", { type: "warning" }); return; }
        const f = this.state.form;
        f.incharge_id = ""; f.incharge_nama = ""; f.incharge_custom = val;
        this.tutupUserPicker();
    }
    // Teks yang tampil di kotak Designer (user sistem atau nama custom).
    designerTampil() {
        const f = this.state.form;
        return f.incharge_nama || f.incharge_custom || "";
    }

    // ─── PICKER FIELD GENERIK (Job Type / Lokal-RRC / Requestor / Approver) ──
    // Config tiap target: sumber daftar [{key,label}], get nama terpilih, set pilihan
    _fieldCfg(target) {
        const f = this.state.form;
        const cfg = {
            brand: {
                sumber: () => this.state.daftarBrand.map(x => ({ key: x.id, label: x.name })),
                nama: () => f.brand_nama,
                set: (it) => { f.brand_id = it ? String(it.key) : ""; f.brand_nama = it ? it.label : ""; },
            },
            job_type: {
                sumber: () => this.state.daftarJobType.map(x => ({ key: x.id, label: x.name })),
                nama: () => f.job_type_nama,
                set: (it) => { f.job_type_id = it ? String(it.key) : ""; f.job_type_nama = it ? it.label : ""; },
            },
            lokal_rrc: {
                sumber: () => this.lokalRrcPilihan.map(x => ({ key: x.value, label: x.label })),
                nama: () => this.labelLokalRrcNama(),
                set: (it) => { f.lokal_rrc = it ? it.key : ""; },
            },
            requestor: {
                sumber: () => this.state.daftarPerson.map(x => ({ key: x.id, label: x.name })),
                nama: () => f.requestor_nama,
                set: (it) => { f.requestor_id = it ? String(it.key) : ""; f.requestor_nama = it ? it.label : ""; },
            },
            approver: {
                sumber: () => this.state.daftarPerson.map(x => ({ key: x.id, label: x.name })),
                nama: () => f.approver_nama,
                set: (it) => { f.approver_id = it ? String(it.key) : ""; f.approver_nama = it ? it.label : ""; },
            },
        };
        return cfg[target] || null;
    }

    labelLokalRrcNama() {
        const x = this.lokalRrcPilihan.find(o => o.value === this.state.form.lokal_rrc);
        return x ? x.label : "";
    }

    fieldNama(target) {
        const c = this._fieldCfg(target);
        return c ? (c.nama() || "") : "";
    }

    get _fieldSource() {
        const c = this._fieldCfg(this.state.fieldPicker.target);
        return c ? (c.sumber() || []) : [];
    }
    get fieldTersaring() {
        const cari = (this.state.fieldPicker.cari || "").trim().toLowerCase();
        const src = this._fieldSource;
        return cari ? src.filter(x => (x.label || "").toLowerCase().includes(cari)) : src;
    }
    get fieldHalaman() {
        const mulai = (this.state.fieldPicker.halaman - 1) * 5;
        return this.fieldTersaring.slice(mulai, mulai + 5);
    }
    get fieldTotalHalaman() { return Math.max(1, Math.ceil(this.fieldTersaring.length / 5)); }

    bukaFieldPicker(target) {
        const p = this.state.fieldPicker;
        if (p.buka && p.target === target) { p.buka = false; return; }
        this.tutupUserPicker();
        p.buka = true; p.target = target; p.cari = ""; p.halaman = 1;
    }
    tutupFieldPicker() { this.state.fieldPicker.buka = false; }
    fieldInput(ev) { this.state.fieldPicker.cari = ev.target.value; this.state.fieldPicker.halaman = 1; }
    fieldNext() { const p = this.state.fieldPicker; if (p.halaman < this.fieldTotalHalaman) p.halaman++; }
    fieldPrev() { const p = this.state.fieldPicker; if (p.halaman > 1) p.halaman--; }
    pilihFieldItem(item) {
        const c = this._fieldCfg(this.state.fieldPicker.target);
        if (c) c.set(item || null);
        this.tutupFieldPicker();
    }

    // ─── FORM ────────────────────────────────────────────────────────────────
    async bukaFormTambah() {
        const f = this.state.form;
        f.buka = true; f.mode = "tambah"; f.id = null; f.menyimpan = false;
        f.wo_number = "";
        f.name = ""; f.code = "";
        f.brand_id = ""; f.brand_nama = "";
        f.job_type_id = ""; f.job_type_nama = ""; f.details = "";
        f.incharge_id = ""; f.incharge_nama = ""; f.incharge_custom = ""; f.lokal_rrc = "";
        f.requestor_id = ""; f.requestor_nama = "";
        f.request_date = ""; f.target_date = ""; f.finish_date = "";
        f.approver_id = ""; f.approver_nama = ""; f.approval_date = "";
        f.status = "ongoing";
        f.image_data = ""; f.image_preview = ""; f.image_hapus = false; f.image_ada = false;
        this.tutupUserPicker();
        this.tutupFieldPicker();
        await Promise.all([this.muatUser(), this.muatJobType(), this.muatPerson(), this.muatBrand()]);
    }

    async bukaFormEdit(rec) {
        const f = this.state.form;
        f.buka = true; f.mode = "edit"; f.id = rec.id; f.menyimpan = false;
        f.wo_number = rec.wo_number || "";
        f.name = rec.name || "";
        f.code = rec.code || "";
        f.brand_id = rec.brand_id ? String(rec.brand_id[0]) : "";
        f.brand_nama = rec.brand_id ? rec.brand_id[1] : "";
        f.job_type_id = rec.job_type_id ? String(rec.job_type_id[0]) : "";
        f.job_type_nama = rec.job_type_id ? rec.job_type_id[1] : "";
        f.details = rec.details || "";
        f.incharge_id = rec.incharge_id ? String(rec.incharge_id[0]) : "";
        f.incharge_nama = rec.incharge_id ? rec.incharge_id[1] : "";
        f.incharge_custom = rec.incharge_custom || "";
        f.lokal_rrc = rec.lokal_rrc || "";
        f.requestor_id = rec.requestor_id ? String(rec.requestor_id[0]) : "";
        f.requestor_nama = rec.requestor_id ? rec.requestor_id[1] : "";
        f.request_date = rec.request_date || "";
        f.target_date = rec.target_date || "";
        f.finish_date = rec.finish_date || "";
        f.approver_id = rec.approver_id ? String(rec.approver_id[0]) : "";
        f.approver_nama = rec.approver_id ? rec.approver_id[1] : "";
        f.approval_date = rec.approval_date || "";
        f.status = rec.status || "ongoing";
        f.image_data = ""; f.image_preview = ""; f.image_hapus = false;
        f.image_ada = !!rec.image_ada;
        this.tutupUserPicker();
        this.tutupFieldPicker();
        await Promise.all([this.muatUser(), this.muatJobType(), this.muatPerson(), this.muatBrand()]);
    }

    tutupForm() { this.state.form.buka = false; this.tutupUserPicker(); this.tutupFieldPicker(); }

    // ── Gambar ──
    onPilihGambar(ev) {
        const file = ev.target.files && ev.target.files[0];
        const f = this.state.form;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result || "";
            f.image_preview = dataUrl;
            const idx = String(dataUrl).indexOf("base64,");
            f.image_data = idx !== -1 ? String(dataUrl).slice(idx + 7) : "";
            f.image_hapus = false;
        };
        reader.readAsDataURL(file);
    }
    hapusGambar() {
        const f = this.state.form;
        f.image_data = ""; f.image_preview = ""; f.image_hapus = true; f.image_ada = false;
    }
    urlGambarForm() { return "/web/image/wom.work.order/" + this.state.form.id + "/image"; }

    async simpan() {
        const f = this.state.form;
        if (!f.name.trim()) {
            this.notification.add("Name is required!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            const vals = {
                name: f.name.trim(),
                code: f.code ? f.code.trim() : false,
                brand_id: f.brand_id ? parseInt(f.brand_id) : false,
                job_type_id: f.job_type_id ? parseInt(f.job_type_id) : false,
                details: f.details ? f.details.trim() : false,
                incharge_id: f.incharge_id ? parseInt(f.incharge_id) : false,
                incharge_custom: (!f.incharge_id && f.incharge_custom) ? f.incharge_custom.trim() : false,
                lokal_rrc: f.lokal_rrc || false,
                requestor_id: f.requestor_id ? parseInt(f.requestor_id) : false,
                request_date: f.request_date || false,
                target_date: f.target_date || false,
                finish_date: f.finish_date || false,
                approver_id: f.approver_id ? parseInt(f.approver_id) : false,
                approval_date: f.approval_date || false,
                status: f.status || "ongoing",
            };
            if (f.image_data) {
                vals.image = f.image_data;
            } else if (f.image_hapus) {
                vals.image = false;
            }
            if (f.mode === "edit") {
                await this.orm.write("wom.work.order", [f.id], vals);
                this.notification.add("Work Order updated.", { type: "success" });
            } else {
                await this.orm.create("wom.work.order", [vals]);
                this.notification.add("Work Order added.", { type: "success" });
            }
            this.tutupForm();
            await this.muatData();
        } catch (e) {
            console.error("Gagal simpan work order:", e);
            this.notification.add("Failed to save Work Order.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    // ─── BRAND (dropdown CRUD) ───────────────────────────────────────────────
    bukaBrandMgr() {
        const m = this.state.brandMgr;
        m.buka = true; m.baru = ""; m.editId = null; m.editNama = ""; m.proses = false;
    }
    tutupBrandMgr() { this.state.brandMgr.buka = false; }
    async tambahBrand() {
        const m = this.state.brandMgr;
        const nama = (m.baru || "").trim();
        if (!nama) { this.notification.add("Brand name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.create("wom.brand", [{ name: nama }]);
            m.baru = "";
            await this.muatBrand();
            this.notification.add("Brand added.", { type: "success" });
        } catch (e) {
            console.error("Gagal tambah Brand:", e);
            this.notification.add("Failed to add (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    mulaiEditBrand(b) {
        const m = this.state.brandMgr;
        m.editId = b.id; m.editNama = b.name;
    }
    batalEditBrand() {
        const m = this.state.brandMgr;
        m.editId = null; m.editNama = "";
    }
    async simpanEditBrand() {
        const m = this.state.brandMgr;
        const nama = (m.editNama || "").trim();
        if (!nama) { this.notification.add("Brand name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.write("wom.brand", [m.editId], { name: nama });
            m.editId = null; m.editNama = "";
            await Promise.all([this.muatBrand(), this.muatData()]);
            this.notification.add("Brand updated.", { type: "success" });
        } catch (e) {
            console.error("Gagal ubah Brand:", e);
            this.notification.add("Failed to update (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    konfirmasiHapusBrand(b) {
        this.tampilKonfirmasi({
            judul: "Delete Brand",
            pesan: `Delete Brand <b>${b.name}</b>?<br/>Work Order Mold using it will have their Brand field cleared.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusBrand(b),
        });
    }
    async lakukanHapusBrand(b) {
        try {
            await this.orm.unlink("wom.brand", [b.id]);
            const f = this.state.form;
            if (String(f.brand_id) === String(b.id)) { f.brand_id = ""; f.brand_nama = ""; }
            await Promise.all([this.muatBrand(), this.muatData()]);
            this.notification.add("Brand deleted.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus Brand:", e);
            this.notification.add("Failed to delete Brand.", { type: "danger" });
        }
    }

    // ─── JOB TYPE (dropdown CRUD) ────────────────────────────────────────────
    bukaJobTypeMgr() {
        const m = this.state.jobTypeMgr;
        m.buka = true; m.baru = ""; m.editId = null; m.editNama = ""; m.proses = false;
    }
    tutupJobTypeMgr() { this.state.jobTypeMgr.buka = false; }
    async tambahJobType() {
        const m = this.state.jobTypeMgr;
        const nama = (m.baru || "").trim();
        if (!nama) { this.notification.add("Job Type name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.create("wom.job.type", [{ name: nama }]);
            m.baru = "";
            await this.muatJobType();
            this.notification.add("Job Type added.", { type: "success" });
        } catch (e) {
            console.error("Gagal tambah Job Type:", e);
            this.notification.add("Failed to add (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    mulaiEditJobType(jt) {
        const m = this.state.jobTypeMgr;
        m.editId = jt.id; m.editNama = jt.name;
    }
    batalEditJobType() {
        const m = this.state.jobTypeMgr;
        m.editId = null; m.editNama = "";
    }
    async simpanEditJobType() {
        const m = this.state.jobTypeMgr;
        const nama = (m.editNama || "").trim();
        if (!nama) { this.notification.add("Job Type name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.write("wom.job.type", [m.editId], { name: nama });
            m.editId = null; m.editNama = "";
            await Promise.all([this.muatJobType(), this.muatData()]);
            this.notification.add("Job Type updated.", { type: "success" });
        } catch (e) {
            console.error("Gagal ubah Job Type:", e);
            this.notification.add("Failed to update (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    konfirmasiHapusJobType(jt) {
        this.tampilKonfirmasi({
            judul: "Delete Job Type",
            pesan: `Delete Job Type <b>${jt.name}</b>?<br/>Work Order Mold using it will have their Job Type field cleared.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusJobType(jt),
        });
    }
    async lakukanHapusJobType(jt) {
        try {
            await this.orm.unlink("wom.job.type", [jt.id]);
            const f = this.state.form;
            if (String(f.job_type_id) === String(jt.id)) { f.job_type_id = ""; f.job_type_nama = ""; }
            await Promise.all([this.muatJobType(), this.muatData()]);
            this.notification.add("Job Type deleted.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus Job Type:", e);
            this.notification.add("Failed to delete Job Type.", { type: "danger" });
        }
    }

    // ─── REQUESTOR / APPROVER (daftar wom.person, dropdown CRUD) ──────────────
    bukaPersonMgr() {
        const m = this.state.personMgr;
        m.buka = true; m.baru = ""; m.editId = null; m.editNama = ""; m.proses = false;
    }
    tutupPersonMgr() { this.state.personMgr.buka = false; }
    async tambahPerson() {
        const m = this.state.personMgr;
        const nama = (m.baru || "").trim();
        if (!nama) { this.notification.add("Name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.create("wom.person", [{ name: nama }]);
            m.baru = "";
            await this.muatPerson();
            this.notification.add("Name added.", { type: "success" });
        } catch (e) {
            console.error("Gagal tambah person:", e);
            this.notification.add("Failed to add (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    mulaiEditPerson(p) {
        const m = this.state.personMgr;
        m.editId = p.id; m.editNama = p.name;
    }
    batalEditPerson() {
        const m = this.state.personMgr;
        m.editId = null; m.editNama = "";
    }
    async simpanEditPerson() {
        const m = this.state.personMgr;
        const nama = (m.editNama || "").trim();
        if (!nama) { this.notification.add("Name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.write("wom.person", [m.editId], { name: nama });
            m.editId = null; m.editNama = "";
            await Promise.all([this.muatPerson(), this.muatData()]);
            this.notification.add("Name updated.", { type: "success" });
        } catch (e) {
            console.error("Gagal ubah person:", e);
            this.notification.add("Failed to update (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    konfirmasiHapusPerson(p) {
        this.tampilKonfirmasi({
            judul: "Delete Name",
            pesan: `Delete <b>${p.name}</b>?<br/>Work Order Mold using it (Requestor/Approver) will be cleared.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusPerson(p),
        });
    }
    async lakukanHapusPerson(p) {
        try {
            await this.orm.unlink("wom.person", [p.id]);
            const f = this.state.form;
            if (String(f.requestor_id) === String(p.id)) { f.requestor_id = ""; f.requestor_nama = ""; }
            if (String(f.approver_id) === String(p.id)) { f.approver_id = ""; f.approver_nama = ""; }
            await Promise.all([this.muatPerson(), this.muatData()]);
            this.notification.add("Name deleted.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus person:", e);
            this.notification.add("Failed to delete.", { type: "danger" });
        }
    }

    // ─── HAPUS ───────────────────────────────────────────────────────────────
    konfirmasiHapus(rec) {
        this.tampilKonfirmasi({
            judul: "Delete Work Order",
            pesan: `Delete work order <b>${rec.wo_number || rec.name}</b>?`,
            labelYa: "Yes, Delete",
            warnaYa: "merah",
            aksi: () => this.lakukanHapus(rec),
        });
    }
    async lakukanHapus(rec) {
        try {
            await this.orm.unlink("wom.work.order", [rec.id]);
            this.notification.add("Work Order deleted.", { type: "success" });
            await this.muatData();
        } catch (e) {
            console.error("Gagal hapus:", e);
            this.notification.add("Failed to delete.", { type: "danger" });
        }
    }

    // ─── IMPORT CSV ──────────────────────────────────────────────────────────
    async bukaImpor() {
        const im = this.state.impor;
        im.buka = true; im.file = null; im.namaFile = ""; im.proses = false;
        await this.muatBatch();
    }
    tutupImpor() { this.state.impor.buka = false; }
    onPilihFile(ev) {
        const file = ev.target.files && ev.target.files[0];
        this.state.impor.file = file || null;
        this.state.impor.namaFile = file ? file.name : "";
    }
    async muatBatch() {
        try {
            this.state.impor.batch = await this.orm.call("wom.work.order", "daftar_batch_impor", []);
        } catch (e) { console.error("Gagal memuat batch:", e); }
    }
    _deteksiDelimiter(text) {
        const baris1 = text.split(/\r?\n/)[0] || "";
        const koma = (baris1.match(/,/g) || []).length;
        const titikKoma = (baris1.match(/;/g) || []).length;
        return titikKoma > koma ? ";" : ",";
    }
    _parseCsv(text, delim) {
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const rows = [];
        let row = [], field = "", inQuotes = false, i = 0;
        while (i < text.length) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                    inQuotes = false; i++; continue;
                }
                field += c; i++; continue;
            }
            if (c === '"') { inQuotes = true; i++; continue; }
            if (c === delim) { row.push(field); field = ""; i++; continue; }
            if (c === '\r') { i++; continue; }
            if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
            field += c; i++;
        }
        if (field !== "" || row.length) { row.push(field); rows.push(row); }
        return rows;
    }
    async lakukanImpor() {
        const im = this.state.impor;
        if (!im.file) { this.notification.add("Please select a CSV file first.", { type: "warning" }); return; }
        im.proses = true;
        try {
            const text = await im.file.text();
            const delim = this._deteksiDelimiter(text);
            const matrix = this._parseCsv(text, delim);
            if (matrix.length < 2) {
                this.notification.add("CSV is empty or has no data rows.", { type: "warning" });
                im.proses = false; return;
            }
            const headers = matrix[0].map((h) => (h || "").trim());
            const rows = [];
            for (let r = 1; r < matrix.length; r++) {
                const arr = matrix[r];
                if (arr.every((x) => (x || "").trim() === "")) continue;
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = arr[idx] !== undefined ? arr[idx] : ""; });
                rows.push(obj);
            }
            const res = await this.orm.call("wom.work.order", "import_csv_rows", [rows]);
            this.notification.add(`Successfully imported ${res.created} rows. Existing data is safe.`, { type: "success" });
            im.file = null; im.namaFile = "";
            await Promise.all([this.muatData(), this.muatBatch()]);
        } catch (e) {
            console.error("Gagal impor CSV:", e);
            this.notification.add("Failed to read/import CSV. Make sure the column format is correct.", { type: "danger" });
        }
        im.proses = false;
    }
    konfirmasiHapusBatch(b) {
        this.tampilKonfirmasi({
            judul: "Delete Import Result",
            pesan: `Delete <b>${b.jumlah}</b> rows from import <b>${b.batch}</b>?<br/>Only data from this import will be deleted.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusBatch(b),
        });
    }
    async lakukanHapusBatch(b) {
        try {
            const n = await this.orm.call("wom.work.order", "hapus_batch_impor", [b.batch]);
            this.notification.add(`${n} imported rows deleted.`, { type: "success" });
            await Promise.all([this.muatData(), this.muatBatch()]);
        } catch (e) {
            console.error("Gagal hapus batch:", e);
            this.notification.add("Failed to delete import result.", { type: "danger" });
        }
    }
    unduhTemplate() {
        const headers = ["Name", "Code", "Brand", "Job Type", "Details", "Designer 2D/3D", "Lokal/RRC",
                         "Requestor", "Req Date", "Target", "Finish Date",
                         "Approver", "Approval Date", "Status"];
        const contoh = ["Sample WO", "WO-001", "BrandX", "Box", "Note line 1", "Administrator", "Local",
                        "Administrator", "2026-06-20", "2026-07-01", "",
                        "Administrator", "", "Ongoing"];
        const cell = (v) => {
            v = v == null ? "" : String(v);
            return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        const csv = headers.join(",") + "\n" + contoh.map(cell).join(",") + "\n";
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "template_work_orders.csv"; a.click();
        URL.revokeObjectURL(url);
    }

    // ─── KONFIRMASI ──────────────────────────────────────────────────────────
    tampilKonfirmasi({ judul, pesan, labelYa, warnaYa, aksi }) {
        this._aksiKonfirmasi = aksi;
        this._konfirmasiPesan = markup(pesan);
        this.state.konfirmasi.buka = true;
        this.state.konfirmasi.judul = judul;
        this.state.konfirmasi.labelYa = labelYa;
        this.state.konfirmasi.warnaYa = warnaYa;
    }
    get konfirmasiPesan() { return this._konfirmasiPesan; }
    tutupKonfirmasi() { this._aksiKonfirmasi = null; this.state.konfirmasi.buka = false; }
    async jalankanKonfirmasi() {
        const aksi = this._aksiKonfirmasi;
        this.tutupKonfirmasi();
        if (aksi) await aksi();
    }
}

registry.category("actions").add("wom_app", WomApp);
