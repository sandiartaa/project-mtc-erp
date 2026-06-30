/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class NpiApp extends Component {
    static template = "npi.NpiApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        this.statusPilihan = [
            { value: "ongoing", label: "Ongoing" },
            { value: "hold", label: "Hold" },
            { value: "finished", label: "Finished" },
        ];

        this.state = useState({
            list: [],
            memuat: true,
            cari: "",
            terbuka: {},        // {productId: true} baris yang sedang dibuka
            subData: {},        // {productId: [subitem,...]} cache sub item

            // Form product (tambah/edit)
            form: {
                buka: false, mode: "tambah", id: null,
                code: "", photo: "", photo_ada: false, ubahPhoto: false,
                name: "", brand: "",
                pack_type: "", pack_qty: "",
                prod_place: "", prod_batch1: "",
                status_custom: false, status_manual: "ongoing",
                proses: false,
            },

            // Popup tabel sub item (tabel baris + tombol Edit Status)
            popup: {
                buka: false, productId: null, id: null, name: "", jenis: "",
                is_matras: false, is_packing: false, is_sparepart: false,
                is_deco: false, is_karton: false,
                status: "ongoing", details: "", notes: "",
                rows: [], proses: false,
            },

            // Popup kecil edit Status / Details / Notes
            editStatus: {
                buka: false, status: "ongoing", details: "", notes: "", proses: false,
            },

            // Popup editor teks panjang (Description / Specification)
            descEdit: { buka: false, idx: null, field: "description", judul: "Description", value: "" },
        });

        // Snapshot untuk deteksi perubahan (dirty check)
        this._snapMatras = "[]";
        this._snapStatus = "";

        onMounted(() => this.muatData());
    }

    // ====================================================================
    // Data product
    // ====================================================================
    async muatData() {
        this.state.memuat = true;
        try {
            this.state.list = await this.orm.call("npi.product", "npi_daftar", []);
        } catch (e) {
            this.notification.add("Gagal memuat data.", { type: "danger" });
        }
        this.state.memuat = false;
    }

    get listTerfilter() {
        const q = (this.state.cari || "").trim().toLowerCase();
        if (!q) {
            return this.state.list;
        }
        return this.state.list.filter((r) =>
            (r.code + " " + r.name + " " + r.brand + " " + r.pack_type +
             " " + r.prod_place + " " + r.prod_batch1).toLowerCase().includes(q)
        );
    }

    urlPhoto(id) {
        return "/web/image/npi.product/" + id + "/photo";
    }

    resetCari() {
        this.state.cari = "";
    }

    // ── Expand / collapse baris ──
    async toggleBaris(id) {
        if (this.state.terbuka[id]) {
            delete this.state.terbuka[id];
            return;
        }
        this.state.terbuka[id] = true;
        await this.muatSub(id);
    }

    async muatSub(productId) {
        try {
            this.state.subData[productId] = await this.orm.call(
                "npi.subitem", "npi_sub_daftar", [productId]
            );
        } catch (e) {
            this.notification.add("Gagal memuat sub item.", { type: "danger" });
        }
    }

    // ====================================================================
    // Form product
    // ====================================================================
    bukaTambah() {
        Object.assign(this.state.form, {
            buka: true, mode: "tambah", id: null,
            code: "", photo: "", photo_ada: false, ubahPhoto: true,
            name: "", brand: "",
            pack_type: "", pack_qty: "",
            prod_place: "", prod_batch1: "",
            status_custom: false, status_manual: "ongoing", proses: false,
        });
    }

    bukaEdit(rec) {
        Object.assign(this.state.form, {
            buka: true, mode: "edit", id: rec.id,
            code: rec.code, photo: "", photo_ada: rec.photo_ada, ubahPhoto: false,
            name: rec.name, brand: rec.brand,
            pack_type: rec.pack_type, pack_qty: rec.pack_qty,
            prod_place: rec.prod_place, prod_batch1: rec.prod_batch1,
            status_custom: rec.status_custom, status_manual: rec.status_manual, proses: false,
        });
    }

    tutupForm() {
        this.state.form.buka = false;
    }

    onPhoto(ev) {
        const file = ev.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            this.state.form.photo = reader.result.split(",")[1] || "";
            this.state.form.ubahPhoto = true;
        };
        reader.readAsDataURL(file);
    }

    hapusPhoto() {
        this.state.form.photo = "";
        this.state.form.photo_ada = false;
        this.state.form.ubahPhoto = true;
    }

    async simpanForm() {
        const f = this.state.form;
        if (!(f.name || "").trim()) {
            this.notification.add("Name wajib diisi.", { type: "warning" });
            return;
        }
        f.proses = true;
        const vals = {
            code: f.code, name: f.name, brand: f.brand,
            pack_type: f.pack_type, pack_qty: f.pack_qty,
            prod_place: f.prod_place, prod_batch1: f.prod_batch1,
            status_custom: f.status_custom, status_manual: f.status_manual,
        };
        if (f.ubahPhoto) {
            vals.photo = f.photo || false;
        }
        try {
            await this.orm.call("npi.product", "npi_simpan", [vals, f.id]);
            this.state.form.buka = false;
            await this.muatData();
            this.notification.add("Tersimpan.", { type: "success" });
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
        f.proses = false;
    }

    async hapusProduct(rec) {
        if (!window.confirm("Hapus product '" + rec.name + "' beserta semua sub item-nya?")) {
            return;
        }
        try {
            await this.orm.call("npi.product", "npi_hapus", [rec.id]);
            delete this.state.terbuka[rec.id];
            await this.muatData();
            this.notification.add("Terhapus.", { type: "success" });
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
    }

    // ====================================================================
    // Popup tabel sub item (klik baris sub item)
    // ====================================================================
    async bukaPopup(productId, sub) {
        try {
            const data = await this.orm.call("npi.subitem", "npi_sub_buka", [sub.id]);
            Object.assign(this.state.popup, { buka: true, productId: productId, proses: false }, data);
            this._snapMatras = JSON.stringify(this.state.popup.rows);
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
    }

    async tutupPopup() {
        // Konfirmasi jika ada perubahan baris tabel yang belum disimpan
        if (JSON.stringify(this.state.popup.rows) !== this._snapMatras) {
            if (window.confirm("Ada perubahan pada tabel yang belum disimpan.\nSimpan perubahan?")) {
                await this.simpanPopup();
            }
        }
        this.state.popup.buka = false;
    }

    // Template baris kosong sesuai jenis sub item yang sedang dibuka.
    barisBaru() {
        const j = this.state.popup.jenis;
        if (j === "Matras") {
            return {
                id: null,
                mold_code: "", description: "", spec: "", maker: "", material: "", qty: "",
                req_date: "", prod_date: "", finished_date: "",
                number: "", stuffing_date: "", arr_date: "",
            };
        }
        if (j === "Packing") {
            return {
                id: null,
                code: "", item: "", packing: "", specification: "", qty: "", executor: "",
                po_date: "", po_qty: "",
                cont_no: "", stuffing_date: "", arrival_date: "",
            };
        }
        if (j === "Sparepart") {
            return {
                id: null,
                code: "", item: "", packing: "", specification: "", qty: "",
                supplier: "", po_date: "", po_qty: "",
                cont_no: "", stuffing_date: "", arrival_date: "",
            };
        }
        if (j === "Deco") {
            return {
                id: null,
                item: "", qty: "", executor: "",
                photo: "", photo_ada: false, photo_ubah: false,
            };
        }
        if (j === "Karton") {
            return {
                id: null,
                code: "", item: "", specification: "",
                po_date: "", po_qty: "", arrival_date: "",
            };
        }
        return { id: null };
    }

    // ── Photo per baris (mis. Deco) ──
    urlRowPhoto(model, id, field) {
        return "/web/image/" + model + "/" + id + "/" + (field || "photo");
    }

    onRowPhoto(idx, ev, field) {
        field = field || "photo";
        const file = ev.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const row = this.state.popup.rows[idx];
            row[field] = reader.result.split(",")[1] || "";
            row[field + "_ada"] = true;
            row[field + "_ubah"] = true;
        };
        reader.readAsDataURL(file);
    }

    hapusRowPhoto(idx, field) {
        field = field || "photo";
        const row = this.state.popup.rows[idx];
        row[field] = "";
        row[field + "_ada"] = false;
        row[field + "_ubah"] = true;
    }

    tambahBaris() {
        this.state.popup.rows.push(this.barisBaru());
    }

    hapusBaris(idx) {
        this.state.popup.rows.splice(idx, 1);
    }

    async simpanPopup() {
        // Hanya menyimpan baris tabel (Status/Details/Notes via Edit Status).
        const p = this.state.popup;
        p.proses = true;
        try {
            await this.orm.call("npi.subitem", "npi_sub_simpan_popup", [p.id, {}, p.rows]);
            this._snapMatras = JSON.stringify(p.rows);
            await this.muatSub(p.productId);
            this.state.popup.buka = false;   // tutup popup setelah tersimpan
            this.notification.add("Tabel " + (p.name || "") + " tersimpan.", { type: "success" });
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
        p.proses = false;
    }

    // ── Editor teks panjang (Description / Specification) ──
    bukaDesc(idx, field, judul) {
        field = field || "description";
        Object.assign(this.state.descEdit, {
            buka: true, idx: idx, field: field, judul: judul || "Description",
            value: this.state.popup.rows[idx][field] || "",
        });
    }

    tutupDesc() {
        this.state.descEdit.buka = false;
    }

    simpanDesc() {
        const d = this.state.descEdit;
        this.state.popup.rows[d.idx][d.field] = d.value;
        d.buka = false;
    }

    // ── Popup kecil: Edit Status / Details / Notes ──
    bukaEditStatus() {
        Object.assign(this.state.editStatus, {
            buka: true, proses: false,
            status: this.state.popup.status,
            details: this.state.popup.details,
            notes: this.state.popup.notes,
        });
        this._snapStatus = JSON.stringify({
            status: this.state.popup.status,
            details: this.state.popup.details,
            notes: this.state.popup.notes,
        });
    }

    async tutupEditStatus() {
        const e = this.state.editStatus;
        const cur = JSON.stringify({ status: e.status, details: e.details, notes: e.notes });
        if (cur !== this._snapStatus) {
            if (window.confirm("Ada perubahan yang belum disimpan.\nSimpan perubahan?")) {
                await this.simpanEditStatus();
                return;
            }
        }
        this.state.editStatus.buka = false;
    }

    async simpanEditStatus() {
        const e = this.state.editStatus;
        const p = this.state.popup;
        e.proses = true;
        const vals = { status: e.status, details: e.details, notes: e.notes };
        try {
            await this.orm.call("npi.subitem", "npi_sub_simpan_popup", [p.id, vals, null]);
            // sinkronkan ke popup utama + daftar
            p.status = e.status;
            p.details = e.details;
            p.notes = e.notes;
            await this.muatSub(p.productId);
            this.state.editStatus.buka = false;
            this.notification.add("Status tersimpan.", { type: "success" });
        } catch (err) {
            this.notification.add(this._pesanError(err), { type: "danger" });
        }
        e.proses = false;
    }

    labelStatus(s) {
        const p = this.statusPilihan.find((x) => x.value === s);
        return p ? p.label : s;
    }

    _pesanError(e) {
        const d = e && e.data ? e.data : null;
        if (d && d.message) {
            return d.message;
        }
        return (e && e.message) ? e.message : "Terjadi kesalahan.";
    }
}

registry.category("actions").add("npi_app", NpiApp);
