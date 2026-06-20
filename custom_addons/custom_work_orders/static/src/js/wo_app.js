/** @odoo-module **/

import { Component, useState, onMounted, markup } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class WoApp extends Component {
    static template = "custom_work_orders.WoApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        this._aksiKonfirmasi = null;
        this._konfirmasiPesan = markup("");

        this.statusPilihan = [
            { value: "ongoing", label: "Ongoing" },
            { value: "finished", label: "Finished" },
        ];
        this.lokalRrcPilihan = [
            { value: "lokal", label: "Lokal" },
            { value: "rrc", label: "RRC" },
        ];

        this.state = useState({
            list: [],
            memuat: true,
            cari: "",
            filterStatus: "",
            daftarUser: [],   // user (akses Work Orders) untuk Designer/Requestor/Approver

            // Picker user generik (target: incharge | requestor | approver)
            userPicker: { buka: false, target: "", cari: "", halaman: 1 },

            form: {
                buka: false,
                mode: "tambah",
                id: null,
                menyimpan: false,
                wo_number: "",
                // Product
                name: "",
                code: "",
                brand: "",
                details: "",
                // IN CHARGE
                incharge_id: "", incharge_nama: "",
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
        });

        onMounted(async () => {
            await Promise.all([this.muatData(), this.muatUser()]);
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
            this.state.list = await this.orm.searchRead(
                "wo.work.order",
                domain,
                ["id", "wo_number", "name", "code", "brand", "details", "image_ada",
                 "incharge_id", "lokal_rrc", "requestor_id",
                 "request_date", "target_date", "finish_date",
                 "approver_id", "approval_date", "status"],
                { order: "id desc" }
            );
        } catch (e) {
            console.error("Gagal memuat work order:", e);
            this.notification.add("Gagal memuat data Work Order.", { type: "danger" });
        }
        this.state.memuat = false;
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

    cariData() { this.muatData(); }
    handleKeydown(ev) { if (ev.key === "Enter") this.muatData(); }
    resetCari() { this.state.cari = ""; this.state.filterStatus = ""; this.muatData(); }
    setFilterStatus(v) { this.state.filterStatus = v; this.muatData(); }

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
    formatTanggal(d) {
        if (!d) return "—";
        const dt = new Date(d + "T00:00:00");
        if (isNaN(dt)) return d;
        return dt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    }

    // ─── PICKER USER GENERIK (Designer/Requestor/Approver) ───────────────────
    get userTerfilter() {
        const cari = (this.state.userPicker.cari || "").trim().toLowerCase();
        const src = this.state.daftarUser;
        return cari ? src.filter((u) => (u.name || "").toLowerCase().includes(cari)) : src;
    }
    get userTotalHalaman() { return Math.max(1, Math.ceil(this.userTerfilter.length / 10)); }
    get userHalaman() {
        const mulai = (this.state.userPicker.halaman - 1) * 10;
        return this.userTerfilter.slice(mulai, mulai + 10);
    }
    bukaUserPicker(target) {
        const p = this.state.userPicker;
        if (p.buka && p.target === target) { p.buka = false; return; }
        p.buka = true; p.target = target; p.cari = ""; p.halaman = 1;
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
        this.tutupUserPicker();
    }

    // ─── FORM ────────────────────────────────────────────────────────────────
    async bukaFormTambah() {
        const f = this.state.form;
        f.buka = true; f.mode = "tambah"; f.id = null; f.menyimpan = false;
        f.wo_number = "";
        f.name = ""; f.code = ""; f.brand = ""; f.details = "";
        f.incharge_id = ""; f.incharge_nama = ""; f.lokal_rrc = "";
        f.requestor_id = ""; f.requestor_nama = "";
        f.request_date = ""; f.target_date = ""; f.finish_date = "";
        f.approver_id = ""; f.approver_nama = ""; f.approval_date = "";
        f.status = "ongoing";
        f.image_data = ""; f.image_preview = ""; f.image_hapus = false; f.image_ada = false;
        this.tutupUserPicker();
        await this.muatUser();
    }

    async bukaFormEdit(rec) {
        const f = this.state.form;
        f.buka = true; f.mode = "edit"; f.id = rec.id; f.menyimpan = false;
        f.wo_number = rec.wo_number || "";
        f.name = rec.name || "";
        f.code = rec.code || "";
        f.brand = rec.brand || "";
        f.details = rec.details || "";
        f.incharge_id = rec.incharge_id ? String(rec.incharge_id[0]) : "";
        f.incharge_nama = rec.incharge_id ? rec.incharge_id[1] : "";
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
        await this.muatUser();
    }

    tutupForm() { this.state.form.buka = false; this.tutupUserPicker(); }

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
            this.notification.add("Name wajib diisi!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            const vals = {
                name: f.name.trim(),
                code: f.code ? f.code.trim() : false,
                brand: f.brand ? f.brand.trim() : false,
                details: f.details ? f.details.trim() : false,
                incharge_id: f.incharge_id ? parseInt(f.incharge_id) : false,
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
                await this.orm.write("wo.work.order", [f.id], vals);
                this.notification.add("Work Order diperbarui.", { type: "success" });
            } else {
                await this.orm.create("wo.work.order", [vals]);
                this.notification.add("Work Order ditambahkan.", { type: "success" });
            }
            this.tutupForm();
            await this.muatData();
        } catch (e) {
            console.error("Gagal simpan work order:", e);
            this.notification.add("Gagal menyimpan Work Order.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    // ─── HAPUS ───────────────────────────────────────────────────────────────
    konfirmasiHapus(rec) {
        this.tampilKonfirmasi({
            judul: "Hapus Work Order",
            pesan: `Hapus work order <b>${rec.wo_number || rec.name}</b>?`,
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapus(rec),
        });
    }
    async lakukanHapus(rec) {
        try {
            await this.orm.unlink("wo.work.order", [rec.id]);
            this.notification.add("Work Order dihapus.", { type: "success" });
            await this.muatData();
        } catch (e) {
            console.error("Gagal hapus:", e);
            this.notification.add("Gagal menghapus.", { type: "danger" });
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
        if (!im.file) { this.notification.add("Pilih file CSV dulu.", { type: "warning" }); return; }
        im.proses = true;
        try {
            const text = await im.file.text();
            const delim = this._deteksiDelimiter(text);
            const matrix = this._parseCsv(text, delim);
            if (matrix.length < 2) {
                this.notification.add("CSV kosong atau tidak ada baris data.", { type: "warning" });
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
            this.notification.add(`Berhasil impor ${res.created} baris. Data lama tetap aman.`, { type: "success" });
            im.file = null; im.namaFile = "";
            await Promise.all([this.muatData(), this.muatBatch()]);
        } catch (e) {
            console.error("Gagal impor CSV:", e);
            this.notification.add("Gagal membaca/impor CSV. Pastikan format kolom benar.", { type: "danger" });
        }
        im.proses = false;
    }
    konfirmasiHapusBatch(b) {
        this.tampilKonfirmasi({
            judul: "Hapus Hasil Impor",
            pesan: `Hapus <b>${b.jumlah}</b> baris dari impor <b>${b.batch}</b>?<br/>Hanya data dari impor ini yang dihapus.`,
            labelYa: "Ya, Hapus", warnaYa: "merah",
            aksi: () => this.lakukanHapusBatch(b),
        });
    }
    async lakukanHapusBatch(b) {
        try {
            const n = await this.orm.call("wo.work.order", "hapus_batch_impor", [b.batch]);
            this.notification.add(`${n} baris hasil impor dihapus.`, { type: "success" });
            await Promise.all([this.muatData(), this.muatBatch()]);
        } catch (e) {
            console.error("Gagal hapus batch:", e);
            this.notification.add("Gagal menghapus hasil impor.", { type: "danger" });
        }
    }
    unduhTemplate() {
        const headers = ["Name", "Code", "Brand", "Details", "Designer 2D/3D", "Lokal/RRC",
                         "Requestor", "Req Date", "Target", "Finish Date",
                         "Approver", "Approval Date", "Status", "Image"];
        const contoh = ["Contoh WO", "WO-001", "BrandX", "Catatan baris 1", "Administrator", "Lokal",
                        "Administrator", "2026-06-20", "2026-07-01", "",
                        "Administrator", "", "Ongoing", ""];
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

registry.category("actions").add("wo_app", WoApp);
