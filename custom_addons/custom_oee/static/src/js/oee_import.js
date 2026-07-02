/** @odoo-module **/
// Aplikasi menu Import OEE — upload file Excel + daftar riwayat import
// yang bisa dihapus per batch.
import { Component, useState, onMounted, useRef } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

export class OeeImportApp extends Component {
    static template = "custom_oee.ImportApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.fileInput = useRef("fileInput");
        this.state = useState({
            memuat: true,
            proses: false,
            daftar: [],
        });
        onMounted(() => this.muatDaftar());
    }

    async muatDaftar() {
        this.state.memuat = true;
        try {
            this.state.daftar = await this.orm.call("oee.import.batch", "oee_import_daftar", []);
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
        this.state.memuat = false;
    }

    pilihFile() {
        this.fileInput.el.click();
    }

    async onFile(ev) {
        const file = ev.target.files[0];
        ev.target.value = ""; // supaya file yang sama bisa dipilih lagi
        if (!file) {
            return;
        }
        if (!file.name.toLowerCase().endsWith(".xlsx")) {
            this.notification.add("File harus Excel (.xlsx).", { type: "warning" });
            return;
        }
        this.state.proses = true;
        try {
            const b64 = await this._bacaFile(file);
            const hasil = await this.orm.call(
                "oee.import.batch", "oee_import_excel", [file.name, b64]);
            await this.muatDaftar();
            this.notification.add(
                "Berhasil! " + hasil.jumlah + " baris data masuk dari file " + file.name + ".",
                { type: "success" });
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
        this.state.proses = false;
    }

    _bacaFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1] || "");
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async hapusBatch(batch) {
        const pesan = "Hapus hasil import '" + batch.name + "'?\n" +
            "Sebanyak " + batch.jumlah + " baris data dari file ini akan ikut terhapus.\n" +
            "Data input manual TIDAK ikut terhapus.";
        if (!window.confirm(pesan)) {
            return;
        }
        this.state.proses = true;
        try {
            await this.orm.call("oee.import.batch", "oee_import_hapus", [batch.id]);
            await this.muatDaftar();
            this.notification.add("Import terhapus.", { type: "success" });
        } catch (e) {
            this.notification.add(this._pesanError(e), { type: "danger" });
        }
        this.state.proses = false;
    }

    _pesanError(e) {
        const d = e && e.data ? e.data : null;
        if (d && d.message) {
            return d.message;
        }
        return (e && e.message) ? e.message : "Terjadi kesalahan.";
    }
}

registry.category("actions").add("custom_oee.import_app", OeeImportApp);
