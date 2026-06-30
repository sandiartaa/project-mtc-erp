/** @odoo-module **/

import { Component, useState, onMounted, onWillUnmount, markup } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { user } from "@web/core/user";

class WoApp extends Component {
    static template = "custom_work_orders.WoApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.bus = useService("bus_service");

        // Channel & handler real-time: tiap ada perubahan Work Order dari user mana pun,
        // server menyiarkan sinyal lewat bus → daftar dimuat ulang otomatis tanpa refresh.
        this._WO_CHANNEL = "wo_work_order";
        this._WO_TYPE = "wo_work_order/changed";
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
            divisiUser: "",         // divisi user (dari master) — mis. 'design'
            gifPos: { set: false, left: 0, top: 0 }, // posisi GIF floating (bila digeser)
            cari: "",
            filterStatus: "",
            filterDesigner: "",     // key 'u:<id>' / 'c:<nama>' untuk filter designer
            filterTglField: "request_date", // field tanggal yang difilter
            filterTglDari: "",
            filterTglSampai: "",
            daftarDesignerFilter: [], // pilihan designer untuk dropdown filter
            daftarUser: [],   // user (akses Work Orders) untuk Executor
            daftarTeknisiMold: [], // Teknisi (kredensial mold) untuk Executor di tab Mold
            daftarJobType: [], // pilihan Job Type (model wo.job.type, bisa di-CRUD)
            daftarPerson: [],  // pilihan Requestor/Approver (model wo.person, bisa di-CRUD)
            daftarBrand: [],   // pilihan Brand (model wo.brand, bisa di-CRUD)
            daftarProduction: [], // pilihan Production (model wo.production, bisa di-CRUD)
            daftarSection: [],    // pilihan Section (model wo.section, bisa di-CRUD)

            // Tab jenis Work Order
            tabTersedia: [],   // [{value,label}] tab yang boleh dilihat user
            tabAktif: "",      // jenis WO yang sedang ditampilkan

            // Pengelola Job Type (CRUD daftar dropdown)
            jobTypeMgr: { buka: false, baru: "", editId: null, editNama: "", proses: false },
            // Pengelola Person/Requestor-Approver (CRUD daftar dropdown)
            personMgr: { buka: false, baru: "", editId: null, editNama: "", proses: false },
            // Pengelola Brand (CRUD daftar dropdown)
            brandMgr: { buka: false, baru: "", editId: null, editNama: "", proses: false },
            // Pengelola Production (CRUD daftar dropdown)
            productionMgr: { buka: false, baru: "", editId: null, editNama: "", proses: false },
            // Pengelola Section (CRUD daftar dropdown)
            sectionMgr: { buka: false, baru: "", editId: null, editNama: "", proses: false },

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
                // Jenis WO (tab)
                wo_type: "design",
                // Product
                name: "",
                code: "",
                brand_id: "", brand_nama: "",
                job_type_id: "", job_type_nama: "",
                production_id: "", production_nama: "",
                qty: "",
                details: "",
                // IN CHARGE (incharge_id = user sistem; incharge_custom = nama ketik bebas)
                incharge_id: "", incharge_nama: "", incharge_custom: "",
                section_id: "", section_nama: "",
                lokal_rrc: "",
                // Requestor
                requestor_id: "", requestor_nama: "",
                // Timeline
                request_date: "",
                lead_time: "",
                finish_date: "",
                ready_date: "",   // mold: "Finish Repair" (tanggal Ready for Approval)
                // Approval
                approver_id: "", approver_nama: "",
                approval_date: "",
                // Status
                status: "ongoing",
                // Gambar
                image_data: "", image_preview: "", image_hapus: false, image_ada: false,
            },

            impor: { buka: false, file: null, namaFile: "", proses: false, batch: [] },
            // Dropdown tombol "Action" (Merge / History / Download)
            aksiMenuBuka: false,
            // Popup Merge: gabungkan Executor (custom → user) atau Requestor (person → person). Akses Full.
            gabung: {
                buka: false, jenis: "executor", proses: false,
                // Executor: nama custom → user sistem
                daftar: [], nama: "", userId: "",
                // Requestor: person sumber → person target
                reqDaftar: [], reqSource: "", reqTarget: "",
            },
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
            // (t* = form tambah Image Approval manual oleh akses Full)
            designList: {
                buka: false, judul: "", items: [], memuat: false, woId: null,
                tImage: "", tPreview: "", tNama: "", tDesc: "", tProses: false, tSeret: false,
            },
            // Popup Designer isi Lead Time (Hour) + Target Finish (Date)
            jadwalForm: { buka: false, rec: null, lead_time: "", finish_date: "", proses: false },
            // Popup detail approve (klik badge "Approved" di kolom Ready Approval).
            // items = riwayat approve (approver, waktu, detail/note) — termasuk dari Mold.
            approveDetail: { buka: false, rec: null, items: [], memuat: false },
            // Popup saat menekan Approve: isi Approve Detail (opsional) lalu setujui.
            approveForm: { buka: false, rec: null, note: "", proses: false },
            // Popup Filter (gabungan: status + period + designer)
            filterPopup: { buka: false },
            // Popup History (audit) — khusus akses Full
            history: { buka: false, items: [], memuat: false },
        });

        onMounted(async () => {
            // Daftarkan diri ke channel bus & mulai dengarkan sinyal perubahan.
            this.bus.addChannel(this._WO_CHANNEL);
            this.bus.subscribe(this._WO_TYPE, this._onWoChanged);
            await Promise.all([this.muatHakAkses(), this.muatTab()]);
            await Promise.all([
                this.muatData(), this.muatUser(), this.muatTeknisiMold(),
                this.muatJobType(), this.muatPerson(), this.muatBrand(),
                this.muatProduction(), this.muatSection(),
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
            // Filter berdasarkan tab jenis WO yang aktif.
            if (this.state.tabAktif) {
                domain.push(["wo_type", "=", this.state.tabAktif]);
            }
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
            const list = await this.orm.searchRead(
                "wo.work.order",
                domain,
                ["id", "wo_number", "wo_type", "name", "code", "brand_id", "job_type_id",
                 "production_id", "qty", "details", "image_ada",
                 "design_image_ada", "last_design_image_id", "design_count",
                 "incharge_id", "incharge_custom", "section_id", "lokal_rrc", "requestor_id", "create_uid",
                 "request_date", "lead_time", "finish_date", "ready_date",
                 "approver_id", "approval_date", "status", "approval_state", "revisi_count"],
                { order: "request_date desc, id desc" }
            );
            // Urutkan: Req Date terbaru di atas → terlama di bawah.
            // WO tanpa Req Date diletakkan paling bawah (tiebreak: id terbaru dulu).
            this.state.list = list.sort((a, b) => {
                const da = a.request_date || "", db = b.request_date || "";
                if (da && db) return da < db ? 1 : da > db ? -1 : b.id - a.id;
                if (da && !db) return -1;
                if (!da && db) return 1;
                return b.id - a.id;
            });
        } catch (e) {
            console.error("Gagal memuat work order:", e);
            this.notification.add("Failed to load Work Order data.", { type: "danger" });
        }
        this.state.memuat = false;
    }

    async muatTeknisiMold() {
        // Daftar Teknisi dari modul Work Order Mold (untuk Executor di tab Mold).
        // Modul mold mungkin tidak terpasang → fallback daftar kosong.
        try {
            this.state.daftarTeknisiMold = await this.orm.call(
                "wo.work.order", "daftar_teknisi_mold", []);
        } catch (e) {
            this.state.daftarTeknisiMold = [];
        }
    }

    async muatUser() {
        try {
            this.state.daftarUser = await this.orm.call(
                "wo.work.order", "users_incharge", []
            );
        } catch (e) {
            console.error("Gagal memuat user:", e);
        }
    }

    async muatTab() {
        try {
            const tabs = await this.orm.call("wo.work.order", "tab_tersedia", []);
            this.state.tabTersedia = tabs || [];
            // Set tab aktif ke tab pertama yang tersedia bila belum valid.
            const adaAktif = this.state.tabTersedia.some((t) => t.value === this.state.tabAktif);
            if (!adaAktif) {
                this.state.tabAktif = this.state.tabTersedia.length ? this.state.tabTersedia[0].value : "design";
            }
        } catch (e) {
            console.error("Gagal memuat tab:", e);
            this.state.tabTersedia = [];
            this.state.tabAktif = "design";
        }
    }

    async muatProduction() {
        try {
            this.state.daftarProduction = await this.orm.call("wo.production", "daftar_production", []);
        } catch (e) {
            console.error("Gagal memuat Production:", e);
        }
    }

    async muatSection() {
        try {
            this.state.daftarSection = await this.orm.call("wo.section", "daftar_section", []);
        } catch (e) {
            console.error("Gagal memuat Section:", e);
        }
    }

    setTab(value) {
        if (this.state.tabAktif === value) return;
        this.state.tabAktif = value;
        this.muatData();
    }
    labelTab(value) {
        const t = this.state.tabTersedia.find((x) => x.value === value);
        return t ? t.label : value;
    }

    // Geser GIF floating (Divisi DESIGN): drag via handle, kiri↔kanan/atas↔bawah.
    mulaiGeserGif(ev) {
        ev.preventDefault();
        const box = ev.currentTarget.closest(".cwo-gif-float");
        if (!box) return;
        const rect = box.getBoundingClientRect();
        const dx = ev.clientX - rect.left;
        const dy = ev.clientY - rect.top;
        // mulai dari posisi sekarang supaya tidak meloncat
        this.state.gifPos.set = true;
        this.state.gifPos.left = rect.left;
        this.state.gifPos.top = rect.top;
        const onMove = (e) => {
            const w = box.offsetWidth;
            const h = box.offsetHeight;
            this.state.gifPos.left = Math.max(0, Math.min(e.clientX - dx, window.innerWidth - w));
            this.state.gifPos.top = Math.max(0, Math.min(e.clientY - dy, window.innerHeight - h));
        };
        const onUp = () => {
            document.removeEventListener("pointermove", onMove);
            document.removeEventListener("pointerup", onUp);
        };
        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
    }

    // Style inline posisi GIF floating (bila sudah pernah digeser).
    get gayaGif() {
        const g = this.state.gifPos;
        if (!g.set) return "";
        return `left:${g.left}px; top:${g.top}px; right:auto; bottom:auto;`;
    }

    async muatHakAkses() {
        try {
            const p = await this.orm.call("wo.work.order", "peran_akses", []);
            this.state.bisaUbah = !!p.full;
            this.state.adalahDesigner = !!p.designer;
            // Filter per designer hanya untuk Full & Read-only (Designer cuma lihat WO sendiri).
            this.state.bolehFilterDesigner = !!(p.full || p.readonly);
            this.state.divisiUser = p.divisi || "";
        } catch (e) {
            console.error("Gagal cek hak akses:", e);
            this.state.bisaUbah = false;
            this.state.adalahDesigner = false;
            this.state.bolehFilterDesigner = false;
            this.state.divisiUser = "";
        }
    }

    async muatDesignerFilter() {
        if (!this.state.bolehFilterDesigner) return;
        try {
            this.state.daftarDesignerFilter = await this.orm.call(
                "wo.work.order", "daftar_designer_filter", []
            );
        } catch (e) {
            console.error("Gagal memuat daftar designer filter:", e);
        }
    }

    async muatJobType() {
        try {
            this.state.daftarJobType = await this.orm.call(
                "wo.job.type", "daftar_job_type", []
            );
        } catch (e) {
            console.error("Gagal memuat Job Type:", e);
        }
    }

    async muatPerson() {
        try {
            this.state.daftarPerson = await this.orm.call(
                "wo.person", "daftar_person", []
            );
        } catch (e) {
            console.error("Gagal memuat Requestor/Approver:", e);
        }
    }

    async muatBrand() {
        try {
            this.state.daftarBrand = await this.orm.call(
                "wo.brand", "daftar_brand", []
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
        return { request_date: "Req Date",
                 finish_date: "Target Finish", approval_date: "Approval Date" }[this.state.filterTglField] || "Date";
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
            h.items = await this.orm.call("wo.audit", "daftar_audit", []);
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
        return { create: "cwo-aud-create", edit: "cwo-aud-edit", delete: "cwo-aud-delete" }[a] || "";
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
        return { ongoing: "cwo-st-ongoing", finished: "cwo-st-finished" }[v] || "";
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
        return { draft: "cwo-apr-draft", ready: "cwo-apr-ready", approved: "cwo-apr-approved" }[s] || "";
    }
    // Detail approve hanya bisa dilihat setelah WO disetujui (Approved).
    adaDetailApprove(rec) { return rec.approval_state === "approved"; }
    async bukaApproveDetail(rec) {
        const ad = this.state.approveDetail;
        ad.buka = true; ad.rec = rec; ad.items = []; ad.memuat = true;
        // Muat riwayat approve (approver, waktu, detail) — termasuk approve dari Mold.
        try {
            ad.items = await this.orm.call("wo.approval", "riwayat_wo", [rec.id]);
        } catch (e) {
            console.error("Gagal memuat riwayat approve:", e);
            this.notification.add("Failed to load approval history.", { type: "danger" });
        }
        ad.memuat = false;
    }
    tutupApproveDetail() {
        this.state.approveDetail.buka = false;
        this.state.approveDetail.rec = null;
        this.state.approveDetail.items = [];
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
            await this.orm.call("wo.work.order", method, [[rec.id]]);
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
                "wo.work.order", "action_set_ready",
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

    // ── Designer isi Lead Time (Hour) + Target Finish (Date) untuk WO-nya ──
    showJadwal(rec) { return this.state.adalahDesigner && this.isDesigner(rec); }
    bukaJadwal(rec) {
        const jf = this.state.jadwalForm;
        jf.buka = true; jf.rec = rec; jf.proses = false;
        jf.lead_time = rec.lead_time || "";
        jf.finish_date = rec.finish_date || "";
    }
    tutupJadwal() { this.state.jadwalForm.buka = false; this.state.jadwalForm.rec = null; }
    async simpanJadwal() {
        const jf = this.state.jadwalForm;
        jf.proses = true;
        try {
            await this.orm.call(
                "wo.work.order", "simpan_jadwal",
                [[jf.rec.id], (jf.lead_time || "").trim(), jf.finish_date || false]
            );
            this.notification.add("Lead Time / Target Finish saved.", { type: "success" });
            this.tutupJadwal();
            await this.muatData();
        } catch (e) {
            console.error("Gagal simpan jadwal:", e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        jf.proses = false;
    }
    // Approve membuka form Approve Detail (note opsional) sebelum menyetujui.
    approve(rec) {
        const af = this.state.approveForm;
        af.buka = true; af.rec = rec; af.note = ""; af.proses = false;
    }
    tutupApproveForm() {
        const af = this.state.approveForm;
        af.buka = false; af.rec = null; af.note = "";
    }
    async kirimApprove() {
        const af = this.state.approveForm;
        af.proses = true;
        try {
            await this.orm.call("wo.work.order", "action_approve",
                [[af.rec.id], (af.note || "").trim() || false]);
            this.notification.add("Work Order approved.", { type: "success" });
            af.buka = false; af.rec = null; af.note = "";
            await this.muatData();
        } catch (e) {
            console.error("Gagal approve:", e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        af.proses = false;
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
            await this.orm.call("wo.work.order", "action_reject", [[rf.rec.id], detail, rf.image_data || false]);
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
            rl.items = await this.orm.call("wo.revision", "revisi_wo", [rec.id]);
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
            await this.orm.unlink("wo.revision", [rv.id]);
            this.notification.add("Revision deleted.", { type: "success" });
            const rl = this.state.revisiList;
            if (rl.woId) rl.items = await this.orm.call("wo.revision", "revisi_wo", [rl.woId]);
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
    urlRef(rec) { return "/web/image/wo.work.order/" + rec.id + "/image"; }
    // URL image designer terbaru (yang ditampilkan utama).
    urlDesign(rec) {
        const d = rec.last_design_image_id;
        return d ? "/web/image/wo.design.image/" + d[0] + "/image" : "";
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
        // reset form tambah image (akses Full)
        dl.tImage = ""; dl.tPreview = ""; dl.tNama = ""; dl.tDesc = ""; dl.tProses = false; dl.tSeret = false;
        try {
            dl.items = await this.orm.call("wo.design.image", "riwayat_wo", [rec.id]);
        } catch (e) {
            console.error("Gagal memuat image designer:", e);
            this.notification.add("Failed to load designer images.", { type: "danger" });
        }
        dl.memuat = false;
    }
    tutupDesignList() { this.state.designList.buka = false; }

    // ── Tambah Image Approval manual (akses Full) — untuk data impor tanpa gambar ──
    _bacaGambarTambahDesign(file) {
        if (!file) return;
        const dl = this.state.designList;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result || "";
            dl.tPreview = dataUrl;
            const idx = String(dataUrl).indexOf("base64,");
            dl.tImage = idx !== -1 ? String(dataUrl).slice(idx + 7) : "";
            dl.tNama = file.name || "image";
        };
        reader.readAsDataURL(file);
    }
    onPilihGambarTambahDesign(ev) { this._bacaGambarTambahDesign(ev.target.files && ev.target.files[0]); }
    onSeretMasukTambahDesign(ev) { ev.preventDefault(); this.state.designList.tSeret = true; }
    onSeretKeluarTambahDesign(ev) { ev.preventDefault(); this.state.designList.tSeret = false; }
    onJatuhkanGambarTambahDesign(ev) {
        ev.preventDefault();
        this.state.designList.tSeret = false;
        const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
        if (file && /^image\//.test(file.type)) this._bacaGambarTambahDesign(file);
        else this.notification.add("Drop an image file.", { type: "warning" });
    }
    hapusGambarTambahDesign() {
        const dl = this.state.designList;
        dl.tImage = ""; dl.tPreview = ""; dl.tNama = "";
    }
    async kirimTambahDesign() {
        const dl = this.state.designList;
        if (!dl.tImage) { this.notification.add("Please choose an image first.", { type: "warning" }); return; }
        dl.tProses = true;
        try {
            await this.orm.call("wo.work.order", "tambah_design_image",
                [[dl.woId], dl.tImage, (dl.tDesc || "").trim()]);
            this.notification.add("Approval image added.", { type: "success" });
            dl.tImage = ""; dl.tPreview = ""; dl.tNama = ""; dl.tDesc = "";
            dl.items = await this.orm.call("wo.design.image", "riwayat_wo", [dl.woId]);
            await this.muatData();
        } catch (e) {
            console.error("Gagal tambah image approval:", e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        dl.tProses = false;
    }
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
            await this.orm.unlink("wo.design.image", [di.id]);
            this.notification.add("Designer image deleted.", { type: "success" });
            const dl = this.state.designList;
            if (dl.woId) dl.items = await this.orm.call("wo.design.image", "riwayat_wo", [dl.woId]);
            await this.muatData();
        } catch (e) {
            console.error("Gagal hapus image designer:", e);
            this.notification.add("Failed to delete designer image.", { type: "danger" });
        }
    }
    urlDesignItem(id) { return "/web/image/wo.design.image/" + id + "/image"; }
    urlRevisiItem(id) { return "/web/image/wo.revision/" + id + "/image"; }

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
    // Khusus Executor di tab Mold: daftar diambil dari Teknisi (kredensial mold).
    get isExecutorMold() {
        return this.state.userPicker.target === "incharge" && this.state.form.wo_type === "mold";
    }
    get userTerfilter() {
        const cari = (this.state.userPicker.cari || "").trim().toLowerCase();
        const src = this.isExecutorMold ? this.state.daftarTeknisiMold : this.state.daftarUser;
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
        // Tab Mold: Executor = Teknisi (bukan user sistem) → simpan ke incharge_custom.
        if (t === "incharge" && f.wo_type === "mold") {
            f.incharge_id = ""; f.incharge_nama = "";
            f.incharge_custom = u ? u.name : "";
            this.tutupUserPicker();
            return;
        }
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
            production: {
                sumber: () => this.state.daftarProduction.map(x => ({ key: x.id, label: x.name })),
                nama: () => f.production_nama,
                set: (it) => { f.production_id = it ? String(it.key) : ""; f.production_nama = it ? it.label : ""; },
            },
            section: {
                sumber: () => this.state.daftarSection.map(x => ({ key: x.id, label: x.name })),
                nama: () => f.section_nama,
                set: (it) => { f.section_id = it ? String(it.key) : ""; f.section_nama = it ? it.label : ""; },
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
        // Default jenis = tab yang sedang aktif.
        f.wo_type = this.state.tabAktif || "design";
        f.name = ""; f.code = "";
        f.brand_id = ""; f.brand_nama = "";
        f.job_type_id = ""; f.job_type_nama = "";
        f.production_id = ""; f.production_nama = ""; f.qty = ""; f.details = "";
        f.incharge_id = ""; f.incharge_nama = ""; f.incharge_custom = "";
        f.section_id = ""; f.section_nama = ""; f.lokal_rrc = "";
        f.requestor_id = ""; f.requestor_nama = "";
        f.request_date = ""; f.lead_time = ""; f.finish_date = ""; f.ready_date = "";
        f.approver_id = ""; f.approver_nama = ""; f.approval_date = "";
        f.status = "ongoing";
        f.image_data = ""; f.image_preview = ""; f.image_hapus = false; f.image_ada = false;
        this.tutupUserPicker();
        this.tutupFieldPicker();
        await Promise.all([this.muatUser(), this.muatTeknisiMold(), this.muatJobType(), this.muatPerson(), this.muatBrand(),
            this.muatProduction(), this.muatSection()]);
    }

    async bukaFormEdit(rec) {
        const f = this.state.form;
        f.buka = true; f.mode = "edit"; f.id = rec.id; f.menyimpan = false;
        f.wo_number = rec.wo_number || "";
        f.wo_type = rec.wo_type || "design";
        f.name = rec.name || "";
        f.code = rec.code || "";
        f.brand_id = rec.brand_id ? String(rec.brand_id[0]) : "";
        f.brand_nama = rec.brand_id ? rec.brand_id[1] : "";
        f.job_type_id = rec.job_type_id ? String(rec.job_type_id[0]) : "";
        f.job_type_nama = rec.job_type_id ? rec.job_type_id[1] : "";
        f.production_id = rec.production_id ? String(rec.production_id[0]) : "";
        f.production_nama = rec.production_id ? rec.production_id[1] : "";
        f.qty = rec.qty || "";
        f.details = rec.details || "";
        f.incharge_id = rec.incharge_id ? String(rec.incharge_id[0]) : "";
        f.incharge_nama = rec.incharge_id ? rec.incharge_id[1] : "";
        f.incharge_custom = rec.incharge_custom || "";
        f.section_id = rec.section_id ? String(rec.section_id[0]) : "";
        f.section_nama = rec.section_id ? rec.section_id[1] : "";
        f.lokal_rrc = rec.lokal_rrc || "";
        f.requestor_id = rec.requestor_id ? String(rec.requestor_id[0]) : "";
        f.requestor_nama = rec.requestor_id ? rec.requestor_id[1] : "";
        f.request_date = rec.request_date || "";
        f.lead_time = rec.lead_time || "";
        f.finish_date = rec.finish_date || "";
        f.ready_date = rec.ready_date || "";
        f.approver_id = rec.approver_id ? String(rec.approver_id[0]) : "";
        f.approver_nama = rec.approver_id ? rec.approver_id[1] : "";
        f.approval_date = rec.approval_date || "";
        f.status = rec.status || "ongoing";
        f.image_data = ""; f.image_preview = ""; f.image_hapus = false;
        f.image_ada = !!rec.image_ada;
        this.tutupUserPicker();
        this.tutupFieldPicker();
        await Promise.all([this.muatUser(), this.muatTeknisiMold(), this.muatJobType(), this.muatPerson(), this.muatBrand(),
            this.muatProduction(), this.muatSection()]);
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
    urlGambarForm() { return "/web/image/wo.work.order/" + this.state.form.id + "/image"; }

    async simpan() {
        const f = this.state.form;
        if (!f.name.trim()) {
            this.notification.add("Name is required!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            const vals = {
                wo_type: f.wo_type || "design",
                name: f.name.trim(),
                code: f.code ? f.code.trim() : false,
                brand_id: f.brand_id ? parseInt(f.brand_id) : false,
                job_type_id: f.job_type_id ? parseInt(f.job_type_id) : false,
                production_id: f.production_id ? parseInt(f.production_id) : false,
                qty: f.qty ? f.qty.trim() : false,
                details: f.details ? f.details.trim() : false,
                incharge_id: f.incharge_id ? parseInt(f.incharge_id) : false,
                incharge_custom: (!f.incharge_id && f.incharge_custom) ? f.incharge_custom.trim() : false,
                section_id: f.section_id ? parseInt(f.section_id) : false,
                lokal_rrc: f.lokal_rrc || false,
                requestor_id: f.requestor_id ? parseInt(f.requestor_id) : false,
                request_date: f.request_date || false,
                lead_time: f.lead_time ? f.lead_time.trim() : false,
                finish_date: f.finish_date || false,
                ready_date: f.ready_date || false,
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
                await this.orm.write("wo.work.order", [f.id], vals);
                this.notification.add("Work Order updated.", { type: "success" });
            } else {
                await this.orm.create("wo.work.order", [vals]);
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
            await this.orm.create("wo.brand", [{ name: nama }]);
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
            await this.orm.write("wo.brand", [m.editId], { name: nama });
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
            pesan: `Delete Brand <b>${b.name}</b>?<br/>Work Orders using it will have their Brand field cleared.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusBrand(b),
        });
    }
    async lakukanHapusBrand(b) {
        try {
            await this.orm.unlink("wo.brand", [b.id]);
            const f = this.state.form;
            if (String(f.brand_id) === String(b.id)) { f.brand_id = ""; f.brand_nama = ""; }
            await Promise.all([this.muatBrand(), this.muatData()]);
            this.notification.add("Brand deleted.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus Brand:", e);
            this.notification.add("Failed to delete Brand.", { type: "danger" });
        }
    }

    // ─── PRODUCTION (dropdown CRUD) ──────────────────────────────────────────
    bukaProductionMgr() {
        const m = this.state.productionMgr;
        m.buka = true; m.baru = ""; m.editId = null; m.editNama = ""; m.proses = false;
    }
    tutupProductionMgr() { this.state.productionMgr.buka = false; }
    async tambahProduction() {
        const m = this.state.productionMgr;
        const nama = (m.baru || "").trim();
        if (!nama) { this.notification.add("Production name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.create("wo.production", [{ name: nama }]);
            m.baru = "";
            await this.muatProduction();
            this.notification.add("Production added.", { type: "success" });
        } catch (e) {
            console.error("Gagal tambah Production:", e);
            this.notification.add("Failed to add (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    mulaiEditProduction(p) { const m = this.state.productionMgr; m.editId = p.id; m.editNama = p.name; }
    batalEditProduction() { const m = this.state.productionMgr; m.editId = null; m.editNama = ""; }
    async simpanEditProduction() {
        const m = this.state.productionMgr;
        const nama = (m.editNama || "").trim();
        if (!nama) { this.notification.add("Production name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.write("wo.production", [m.editId], { name: nama });
            m.editId = null; m.editNama = "";
            await Promise.all([this.muatProduction(), this.muatData()]);
            this.notification.add("Production updated.", { type: "success" });
        } catch (e) {
            console.error("Gagal ubah Production:", e);
            this.notification.add("Failed to update (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    konfirmasiHapusProduction(p) {
        this.tampilKonfirmasi({
            judul: "Delete Production",
            pesan: `Delete Production <b>${p.name}</b>?<br/>Work Orders using it will have their Production field cleared.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusProduction(p),
        });
    }
    async lakukanHapusProduction(p) {
        try {
            await this.orm.unlink("wo.production", [p.id]);
            const f = this.state.form;
            if (String(f.production_id) === String(p.id)) { f.production_id = ""; f.production_nama = ""; }
            await Promise.all([this.muatProduction(), this.muatData()]);
            this.notification.add("Production deleted.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus Production:", e);
            this.notification.add("Failed to delete Production.", { type: "danger" });
        }
    }

    // ─── SECTION (dropdown CRUD) ─────────────────────────────────────────────
    bukaSectionMgr() {
        const m = this.state.sectionMgr;
        m.buka = true; m.baru = ""; m.editId = null; m.editNama = ""; m.proses = false;
    }
    tutupSectionMgr() { this.state.sectionMgr.buka = false; }
    async tambahSection() {
        const m = this.state.sectionMgr;
        const nama = (m.baru || "").trim();
        if (!nama) { this.notification.add("Section name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.create("wo.section", [{ name: nama }]);
            m.baru = "";
            await this.muatSection();
            this.notification.add("Section added.", { type: "success" });
        } catch (e) {
            console.error("Gagal tambah Section:", e);
            this.notification.add("Failed to add (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    mulaiEditSection(s) { const m = this.state.sectionMgr; m.editId = s.id; m.editNama = s.name; }
    batalEditSection() { const m = this.state.sectionMgr; m.editId = null; m.editNama = ""; }
    async simpanEditSection() {
        const m = this.state.sectionMgr;
        const nama = (m.editNama || "").trim();
        if (!nama) { this.notification.add("Section name is empty.", { type: "warning" }); return; }
        m.proses = true;
        try {
            await this.orm.write("wo.section", [m.editId], { name: nama });
            m.editId = null; m.editNama = "";
            await Promise.all([this.muatSection(), this.muatData()]);
            this.notification.add("Section updated.", { type: "success" });
        } catch (e) {
            console.error("Gagal ubah Section:", e);
            this.notification.add("Failed to update (name may already exist).", { type: "danger" });
        }
        m.proses = false;
    }
    konfirmasiHapusSection(s) {
        this.tampilKonfirmasi({
            judul: "Delete Section",
            pesan: `Delete Section <b>${s.name}</b>?<br/>Work Orders using it will have their Section field cleared.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusSection(s),
        });
    }
    async lakukanHapusSection(s) {
        try {
            await this.orm.unlink("wo.section", [s.id]);
            const f = this.state.form;
            if (String(f.section_id) === String(s.id)) { f.section_id = ""; f.section_nama = ""; }
            await Promise.all([this.muatSection(), this.muatData()]);
            this.notification.add("Section deleted.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus Section:", e);
            this.notification.add("Failed to delete Section.", { type: "danger" });
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
            await this.orm.create("wo.job.type", [{ name: nama }]);
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
            await this.orm.write("wo.job.type", [m.editId], { name: nama });
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
            pesan: `Delete Job Type <b>${jt.name}</b>?<br/>Work Orders using it will have their Job Type field cleared.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusJobType(jt),
        });
    }
    async lakukanHapusJobType(jt) {
        try {
            await this.orm.unlink("wo.job.type", [jt.id]);
            const f = this.state.form;
            if (String(f.job_type_id) === String(jt.id)) { f.job_type_id = ""; f.job_type_nama = ""; }
            await Promise.all([this.muatJobType(), this.muatData()]);
            this.notification.add("Job Type deleted.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus Job Type:", e);
            this.notification.add("Failed to delete Job Type.", { type: "danger" });
        }
    }

    // ─── REQUESTOR / APPROVER (daftar wo.person, dropdown CRUD) ──────────────
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
            await this.orm.create("wo.person", [{ name: nama }]);
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
            await this.orm.write("wo.person", [m.editId], { name: nama });
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
            pesan: `Delete <b>${p.name}</b>?<br/>Work Orders using it (Requestor/Approver) will be cleared.`,
            labelYa: "Yes, Delete", warnaYa: "merah",
            aksi: () => this.lakukanHapusPerson(p),
        });
    }
    async lakukanHapusPerson(p) {
        try {
            await this.orm.unlink("wo.person", [p.id]);
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
            await this.orm.unlink("wo.work.order", [rec.id]);
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
            this.state.impor.batch = await this.orm.call("wo.work.order", "daftar_batch_impor", []);
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
            const res = await this.orm.call("wo.work.order", "import_csv_rows", [rows]);
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
            const n = await this.orm.call("wo.work.order", "hapus_batch_impor", [b.batch]);
            this.notification.add(`${n} imported rows deleted.`, { type: "success" });
            await Promise.all([this.muatData(), this.muatBatch()]);
        } catch (e) {
            console.error("Gagal hapus batch:", e);
            this.notification.add("Failed to delete import result.", { type: "danger" });
        }
    }
    // Header kolom CSV (dipakai template impor & unduh daftar).
    get _csvHeaders() {
        return ["Type", "Name", "Code", "Brand", "Job Type", "Production", "Qty", "Details",
                "Executor", "Section", "Lokal/RRC",
                "Requestor", "Req Date", "Lead Time (Hour)", "Target Finish (Date)",
                "Approver", "Approval Date", "Status"];
    }
    _csvCell(v) {
        v = v == null ? "" : String(v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    _unduhCsv(namaFile, headers, baris) {
        const csv = headers.map((h) => this._csvCell(h)).join(",") + "\n"
            + baris.map((r) => r.map((c) => this._csvCell(c)).join(",")).join("\n") + "\n";
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = namaFile; a.click();
        URL.revokeObjectURL(url);
    }
    unduhTemplate() {
        // Template + 2 contoh baris yang benar & lengkap (semua kolom terisi).
        const contoh = [
            ["Design", "Front Cover Box", "WO-001", "STAR RIDER", "Box", "Line A", "100", "Full color, matte laminate",
             "Izza", "2D", "Local",
             "P. Apin", "2026-06-20", "48", "2026-07-01",
             "P. Setiadi", "2026-07-02", "Ongoing"],
            ["Mold", "Cavity Insert A3", "WO-002", "DAYTONA", "Insert", "Line B", "4", "Hardened steel, polish #3",
             "Bu Tina", "INJ", "RRC",
             "P. Apin", "2026-06-22", "120", "2026-07-10",
             "P. Setiadi", "", "Finished"],
        ];
        this._unduhCsv("template_work_orders.csv", this._csvHeaders, contoh);
    }
    // Unduh daftar Work Order yang sedang tampil (sudah urut Req Date terbaru → terlama).
    unduhDaftar() {
        const list = this.state.list || [];
        if (!list.length) {
            this.notification.add("No data to download.", { type: "warning" });
            return;
        }
        const lblType = { design: "Design", mold: "Mold", maintenance: "Maintenance", utility: "Utility" };
        // "No." ditaruh di depan sebagai referensi (diabaikan bila di-impor kembali).
        const headers = ["No.", ...this._csvHeaders];
        const baris = list.map((rec) => [
            rec.wo_number || "",
            lblType[rec.wo_type] || rec.wo_type || "",
            rec.name || "",
            rec.code || "",
            rec.brand_id ? rec.brand_id[1] : "",
            rec.job_type_id ? rec.job_type_id[1] : "",
            rec.production_id ? rec.production_id[1] : "",
            rec.qty || "",
            rec.details || "",
            this.namaDesigner(rec) || "",
            rec.section_id ? rec.section_id[1] : "",
            rec.lokal_rrc ? this.labelLokalRrc(rec.lokal_rrc) : "",
            rec.requestor_id ? rec.requestor_id[1] : "",
            rec.request_date || "",
            rec.lead_time || "",
            rec.finish_date || "",
            rec.approver_id ? rec.approver_id[1] : "",
            rec.approval_date || "",
            this.labelStatus(rec.status),
        ]);
        const tgl = new Date().toISOString().slice(0, 10);
        this._unduhCsv(`work_orders_${tgl}.csv`, headers, baris);
        this.notification.add(`Downloaded ${baris.length} Work Order(s).`, { type: "success" });
    }

    // ─── TOMBOL ACTION (dropdown: Merge / History / Download) ────────────────
    toggleAksiMenu() { this.state.aksiMenuBuka = !this.state.aksiMenuBuka; }
    tutupAksiMenu() { this.state.aksiMenuBuka = false; }
    aksiMerge() { this.tutupAksiMenu(); this.bukaGabung(); }
    aksiHistory() { this.tutupAksiMenu(); this.bukaHistory(); }
    aksiDownload() { this.tutupAksiMenu(); this.unduhDaftar(); }

    // ─── MERGE (Executor: custom → user; Requestor: person → person) — Full ───
    async bukaGabung() {
        const g = this.state.gabung;
        g.buka = true; g.proses = false;
        g.nama = ""; g.userId = ""; g.reqSource = ""; g.reqTarget = "";
        await Promise.all([
            this.muatExecutorCustom(), this.muatRequestorMerge(),
            this.muatUser(), this.muatPerson(),
        ]);
    }
    tutupGabung() { this.state.gabung.buka = false; }
    setJenisGabung(j) { this.state.gabung.jenis = j; }
    async muatExecutorCustom() {
        try {
            this.state.gabung.daftar = await this.orm.call(
                "wo.work.order", "daftar_executor_custom", []
            );
        } catch (e) { console.error("Gagal memuat executor custom:", e); }
    }
    async muatRequestorMerge() {
        try {
            this.state.gabung.reqDaftar = await this.orm.call(
                "wo.work.order", "daftar_requestor_merge", []
            );
        } catch (e) { console.error("Gagal memuat requestor merge:", e); }
    }
    async lakukanGabung() {
        const g = this.state.gabung;
        if (g.jenis === "executor") {
            if (!g.nama) { this.notification.add("Select a custom Executor name.", { type: "warning" }); return; }
            if (!g.userId) { this.notification.add("Select the registered user to merge into.", { type: "warning" }); return; }
        } else {
            if (!g.reqSource) { this.notification.add("Select the Requestor to merge.", { type: "warning" }); return; }
            if (!g.reqTarget) { this.notification.add("Select the target Requestor.", { type: "warning" }); return; }
            if (g.reqSource === g.reqTarget) { this.notification.add("Source and target must differ.", { type: "warning" }); return; }
        }
        g.proses = true;
        try {
            let n;
            if (g.jenis === "executor") {
                n = await this.orm.call("wo.work.order", "gabung_executor", [g.nama, parseInt(g.userId)]);
                g.nama = ""; g.userId = "";
                await Promise.all([this.muatExecutorCustom(), this.muatData(), this.muatDesignerFilter()]);
            } else {
                n = await this.orm.call("wo.work.order", "gabung_requestor", [parseInt(g.reqSource), parseInt(g.reqTarget)]);
                g.reqSource = ""; g.reqTarget = "";
                await Promise.all([this.muatRequestorMerge(), this.muatPerson(), this.muatData()]);
            }
            this.notification.add(`${n} Work Order(s) merged.`, { type: "success" });
        } catch (e) {
            console.error("Gagal merge:", e);
            const msg = e && e.data && e.data.message ? e.data.message : "Please try again.";
            this.notification.add("Failed. " + msg, { type: "danger" });
        }
        g.proses = false;
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

registry.category("actions").add("wo_app", WoApp);
