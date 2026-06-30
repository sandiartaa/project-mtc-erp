/** @odoo-module **/

import { Component, useState, onMounted, markup } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class MuApp extends Component {
    static template = "custom_master_user.MuApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        // Pesan konfirmasi di luar reactive state (markup tidak bisa di-proxy OWL)
        this._aksiKonfirmasi = null;
        this._konfirmasiPesan = markup("");

        // Pilihan divisi & subdivisi (cocok dengan Selection di model)
        this.divisiPilihan = [
            { value: "staf_repacking", label: "STAF REPACKING" },
            { value: "borongan_dalam", label: "BORONGAN DALAM" },
            { value: "borongan_luar", label: "BORONGAN LUAR" },
            { value: "helper", label: "HELPER" },
            { value: "stock_keeper", label: "STOCK KEEPER" },
            { value: "design", label: "DESIGN" },
        ];
        this.subdivisiPilihan = [
            { value: "borongan_dalam", label: "Borongan Dalam" },
            { value: "borongan_luar", label: "Borongan Luar" },
        ];

        this.state = useState({
            list: [],
            memuat: true,
            cari: "",
            daftarUser: [],
            modulTersedia: [],   // [{id, label}] grup akses modul

            // Form tambah/edit
            form: {
                buka: false,
                mode: "tambah",   // 'tambah' | 'edit'
                id: null,
                menyimpan: false,
                user_id: "",
                internal: true,   // tipe user: true=Internal, false=Portal
                divisi: "",
                subdivisi: "",
                kode: "",
            },

            // Popup Akses Modul (centang akses lewat tombol "Akses" di daftar)
            akses: { buka: false, userId: null, userName: "", internal: true, items: [], proses: false, memuat: false },

            // Modal history/riwayat
            riwayat: { buka: false, memuat: false, judul: "", daftar: [] },

            // Dialog konfirmasi
            konfirmasi: { buka: false, judul: "", labelYa: "Ya", warnaYa: "merah" },

            // Kartu mobile yang sedang dibuka (accordion). Key = id record → true.
            kartuTerbuka: {},
        });

        onMounted(async () => {
            await Promise.all([this.muatData(), this.muatUser(), this.muatModul()]);
        });
    }

    // Buka/tutup kartu (accordion mobile).
    toggleKartu(id) {
        if (this.state.kartuTerbuka[id]) {
            delete this.state.kartuTerbuka[id];
        } else {
            this.state.kartuTerbuka[id] = true;
        }
    }

    async muatModul() {
        try {
            this.state.modulTersedia = await this.orm.call(
                "cui.user.info", "modul_akses_tersedia", []
            );
        } catch (e) {
            console.error("Gagal memuat daftar modul:", e);
        }
    }

    // ─── DATA ────────────────────────────────────────────────────────────────
    async muatData() {
        this.state.memuat = true;
        try {
            const domain = [];
            const cari = (this.state.cari || "").trim();
            if (cari) {
                domain.push("|", ["kode", "ilike", cari], ["user_id.name", "ilike", cari]);
            }
            const list = await this.orm.searchRead(
                "cui.user.info",
                domain,
                ["id", "user_id", "kode", "divisi", "subdivisi"],
                { order: "kode asc" }
            );
            // Tempelkan label akses modul tiap user (untuk badge di tabel)
            const ids = list
                .map((r) => (r.user_id ? r.user_id[0] : null))
                .filter(Boolean);
            let map = {};
            if (ids.length) {
                map = await this.orm.call("cui.user.info", "akses_modul_map", [ids]);
            }
            list.forEach((r) => {
                const uid = r.user_id ? r.user_id[0] : null;
                r.akses = uid && map[uid] ? map[uid] : [];
            });
            this.state.list = list;
        } catch (e) {
            console.error("Gagal memuat data user:", e);
            this.notification.add("Gagal memuat data user.", { type: "danger" });
        }
        this.state.memuat = false;
    }

    async muatUser() {
        try {
            // Semua user aktif (Internal + Portal) supaya user Portal pun
            // bisa dipilih lalu dijadikan Internal dari sini.
            this.state.daftarUser = await this.orm.searchRead(
                "res.users",
                [],
                ["id", "name", "share"],
                { order: "name asc" }
            );
        } catch (e) {
            console.error("Gagal memuat user:", e);
        }
    }

    // Label tipe user untuk dropdown
    labelTipe(u) { return u && u.share ? "Portal" : "Internal"; }
    _shareUser(userId) {
        const u = this.state.daftarUser.find((x) => String(x.id) === String(userId));
        return u ? !!u.share : false;
    }

    cariData() { this.muatData(); }
    handleKeydown(ev) { if (ev.key === "Enter") this.muatData(); }
    resetCari() { this.state.cari = ""; this.muatData(); }

    labelDivisi(v) {
        const f = this.divisiPilihan.find((x) => x.value === v);
        return f ? f.label : "-";
    }
    labelSubdivisi(v) {
        const f = this.subdivisiPilihan.find((x) => x.value === v);
        return f ? f.label : "-";
    }
    labelAksi(a) { return a === "create" ? "Dibuat" : "Diedit"; }

    // User yang belum punya entri (untuk form tambah); saat edit, sertakan user terpilih
    get userTersedia() {
        const dipakai = new Set(
            this.state.list.map((r) => (r.user_id ? r.user_id[0] : null))
        );
        const f = this.state.form;
        const idEdit = f.mode === "edit" && f.user_id ? parseInt(f.user_id) : null;
        return this.state.daftarUser.filter(
            (u) => !dipakai.has(u.id) || u.id === idEdit
        );
    }

    // ─── FORM TAMBAH/EDIT ────────────────────────────────────────────────────
    async bukaFormTambah() {
        const f = this.state.form;
        f.buka = true; f.mode = "tambah"; f.id = null; f.menyimpan = false;
        f.user_id = ""; f.internal = true; f.divisi = ""; f.subdivisi = ""; f.kode = "";
        // Muat ulang daftar user agar user yang baru ditambah ikut muncul
        await this.muatUser();
    }

    async bukaFormEdit(rec) {
        const f = this.state.form;
        f.buka = true; f.mode = "edit"; f.id = rec.id; f.menyimpan = false;
        f.user_id = rec.user_id ? String(rec.user_id[0]) : "";
        f.internal = !this._shareUser(f.user_id);
        f.divisi = rec.divisi || "";
        f.subdivisi = rec.subdivisi || "";
        f.kode = rec.kode || "";
    }

    // Saat user dipilih di form, ikut set tipe (Internal/Portal)
    pilihUserForm(ev) {
        const f = this.state.form;
        f.user_id = ev.target.value;
        f.internal = !this._shareUser(f.user_id);
    }

    // Ubah tipe user di form
    setTipe(internal) { this.state.form.internal = internal; }

    tutupForm() { this.state.form.buka = false; }

    // ─── POPUP AKSES MODUL ───────────────────────────────────────────────────
    async bukaAkses(rec) {
        const a = this.state.akses;
        a.buka = true; a.memuat = true; a.proses = false; a.items = [];
        a.userId = rec.user_id ? rec.user_id[0] : null;
        a.userName = rec.user_id ? rec.user_id[1] : (rec.kode || "");
        a.internal = !this._shareUser(a.userId);
        try {
            const akses = await this.orm.call(
                "cui.user.info", "akses_modul_user", [parseInt(a.userId)]
            );
            a.items = (akses || []).map((x) => ({ id: x.id, label: x.label, granted: !!x.granted }));
        } catch (e) {
            console.error("Gagal memuat akses modul:", e);
            this.notification.add("Gagal memuat akses modul.", { type: "danger" });
        }
        a.memuat = false;
    }
    tutupAkses() { this.state.akses.buka = false; }
    toggleAkses(item) { item.granted = !item.granted; }
    async simpanAkses() {
        const a = this.state.akses;
        a.proses = true;
        try {
            const granted = a.items.filter((x) => x.granted).map((x) => x.id);
            await this.orm.call("cui.user.info", "set_akses_modul", [parseInt(a.userId), granted]);
            this.notification.add("Akses modul disimpan.", { type: "success" });
            a.buka = false;
            await Promise.all([this.muatData(), this.muatUser()]);
        } catch (e) {
            console.error("Gagal simpan akses:", e);
            this.notification.add("Gagal menyimpan akses modul.", { type: "danger" });
        }
        a.proses = false;
    }

    async simpan() {
        const f = this.state.form;
        if (!f.user_id) {
            this.notification.add("Pilih user terlebih dahulu!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            const vals = {
                user_id: parseInt(f.user_id),
                divisi: f.divisi || false,
                subdivisi: f.subdivisi || false,
            };
            // 1) Set tipe user dulu (Internal/Portal) — penting agar grup modul valid
            await this.orm.call("cui.user.info", "set_tipe_user", [
                parseInt(f.user_id), f.internal,
            ]);
            // 2) Simpan data master (kode/divisi/subdivisi).
            //    Akses modul kini diatur terpisah lewat tombol "Akses" (popup).
            if (f.mode === "edit") {
                await this.orm.write("cui.user.info", [f.id], vals);
            } else {
                await this.orm.create("cui.user.info", [vals]);
            }
            this.notification.add(
                f.mode === "edit" ? "Data user diperbarui." : "Data user ditambahkan.",
                { type: "success" }
            );
            this.tutupForm();
            await Promise.all([this.muatData(), this.muatUser()]);
        } catch (e) {
            console.error("Gagal simpan:", e);
            this.notification.add(
                "Gagal menyimpan. Pastikan user belum terdaftar.", { type: "danger" }
            );
        }
        f.menyimpan = false;
    }

    // ─── HAPUS ───────────────────────────────────────────────────────────────
    konfirmasiHapus(rec) {
        const nama = rec.user_id ? rec.user_id[1] : rec.kode;
        this.tampilKonfirmasi({
            judul: "Hapus Data User",
            pesan: `Hapus entri master untuk <b>${nama}</b>?<br/>Akun login Odoo tidak ikut terhapus.`,
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapus(rec),
        });
    }

    async lakukanHapus(rec) {
        try {
            await this.orm.unlink("cui.user.info", [rec.id]);
            this.notification.add("Data user dihapus.", { type: "success" });
            await this.muatData();
        } catch (e) {
            console.error("Gagal hapus:", e);
            this.notification.add("Gagal menghapus.", { type: "danger" });
        }
    }

    // ─── HISTORY ─────────────────────────────────────────────────────────────
    async bukaRiwayat(rec) {
        const r = this.state.riwayat;
        r.buka = true; r.memuat = true;
        r.judul = rec.user_id ? rec.user_id[1] : rec.kode;
        r.daftar = [];
        try {
            r.daftar = await this.orm.searchRead(
                "mu.user.riwayat",
                [["info_id", "=", rec.id]],
                ["aksi", "keterangan", "user_id", "waktu"],
                { order: "id desc" }
            );
        } catch (e) {
            console.error("Gagal memuat riwayat:", e);
            this.notification.add("Gagal memuat riwayat.", { type: "danger" });
        }
        r.memuat = false;
    }

    tutupRiwayat() {
        this.state.riwayat.buka = false;
        this.state.riwayat.daftar = [];
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

    // ─── UTIL ────────────────────────────────────────────────────────────────
    formatWaktu(dt) {
        if (!dt) return "-";
        const d = new Date(dt.replace(" ", "T") + "Z");
        if (isNaN(d)) return dt;
        return d.toLocaleString("id-ID", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    }
}

registry.category("actions").add("mu_app", MuApp);
