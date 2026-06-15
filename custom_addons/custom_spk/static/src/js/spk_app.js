/** @odoo-module **/

import { Component, useState, onMounted, markup } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class SpkApp extends Component {
    static template = "custom_spk.SpkApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        // Aksi & pesan konfirmasi disimpan di luar reactive state (markup tidak bisa di-proxy OWL)
        this._aksiKonfirmasi = null;
        this._konfirmasiPesan = markup("");

        // Daftar pilihan satuan (statis)
        this.unitPilihan = [
            { value: "karton", label: "Karton" },
            { value: "layer", label: "Layer" },
            { value: "pcs", label: "Pcs" },
        ];

        this.state = useState({
            // Navigasi halaman: 'daftar' | 'detail'
            halaman: 'daftar',
            spkDipilih: null,
            spkId: null,   // ID murni (number) — hindari proxy issue

            // Halaman detail
            tabDetail: 'bahan',   // 'bahan' | 'formulasi'

            // Bahan baku
            daftarBahan: [],
            memuatBahan: false,
            daftarDetail: [],   // semua detail untuk SPK aktif
            formBahan: {
                buka: false,
                mode: 'tambah',   // 'tambah' | 'edit'
                bahanId: null,
                menyimpan: false,
                kode_barang: "",
                nama_bahan: "",
                is_qty_custom: false,
                qty: 0,
                harga: 0,
                pic_id: "",
                gudang_asal: "",
                keterangan: "",
            },

            // Rincian varian bahan
            formDetail: {
                buka: false,
                mode: 'tambah',
                detailId: null,
                bahanId: null,
                menyimpan: false,
                keterangan: "",
                qty: 0,
            },

            // HPR (Hasil Produksi & Retur) per bahan baku
            daftarHpr: [],   // semua entri HPR untuk SPK aktif
            memuatHpr: false,
            formHpr: {
                buka: false,
                mode: 'tambah',   // 'tambah' | 'edit'
                hprId: null,
                menyimpan: false,
                tanggal_kirim: "",
                hasil_produksi: 0,
            },

            // SBH (Status Barang Kembali) per bahan baku
            daftarSbh: [],
            memuatSbh: false,
            formSbh: {
                buka: false,
                mode: 'tambah',   // 'tambah' | 'edit'
                sbhId: null,
                bahanId: null,
                kodeBarang: "",
                namaBahan: "",
                menyimpan: false,
                barang_bagus: 0,
                barang_rusak: 0,
            },

            // Formulasi produk
            daftarFormulasi: [],
            memuatFormulasi: false,
            formFormulasi: {
                buka: false,
                mode: 'tambah',
                formulasiId: null,
                menyimpan: false,
                nama_bahan: "",
                qty: 1,
                satuan_hitung: 'pcs',
                is_pengganti: false,
                boleh_ubah_qty: true,
                boleh_hapus: true,
            },

            spkList: [],
            memuat: true,
            totalData: 0,
            halamanAktif: 1,
            perHalaman: 20,

            // Filter
            filter: {
                cari: "",
                branch_id: "",
                tanggalMulai: "",
                tanggalAkhir: "",
            },

            // Master data (cabang, pic, produk)
            daftarCabang: [],
            daftarPic: [],
            daftarProduk: [],
            masterDimuat: false,

            // Popup kelola cabang (edit nama / hapus / tambah)
            popupCabang: {
                buka: false,
                editId: null,
                editNama: "",
                menyimpan: false,
                tambahAktif: false,
                tambahNama: "",
                tambahMenyimpan: false,
            },

            // Input tambah cabang baru (inline di form)
            cabangBaru: {
                aktif: false,
                nama: "",
                menyimpan: false,
                targetForm: "",
            },

            // Dialog konfirmasi
            konfirmasi: {
                buka: false,
                judul: "",
                labelYa: "Ya, Lanjutkan",
                warnaYa: "merah",
            },

            // Form tambah SPK baru
            formTambah: {
                buka: false,
                menyimpan: false,
                nama_pekerjaan: "",
                spk_date: new Date().toISOString().slice(0, 10),
                branch_id: "",
                pic_id: "",
                product_id: "",
                qty: 1,
                unit: "",
                layer_per_karton: 1,
                pcs_per_layer: 1,
                standard_price: 0,
                custom_number: "",
                status: "open",
                tgl_selesai: "",
            },

            // Form edit SPK
            formEdit: {
                buka: false,
                menyimpan: false,
                spkId: null,
                spkName: "",
                nama_pekerjaan: "",
                spk_date: "",
                branch_id: "",
                pic_id: "",
                product_id: "",
                qty: 1,
                unit: "",
                layer_per_karton: 1,
                pcs_per_layer: 1,
                standard_price: 0,
                custom_number: "",
                status: "open",
                tgl_selesai: "",
            },
        });

        onMounted(async () => {
            // Muat master data dan daftar SPK secara paralel
            await Promise.all([this.muatMaster(), this.muatData()]);
        });
    }

    // ─── MASTER DATA ─────────────────────────────────────────────────────────

    async muatMaster() {
        if (this.state.masterDimuat) return;
        try {
            const [cabang, pic, produk] = await Promise.all([
                this.orm.searchRead(
                    "spk.cabang",
                    [["active", "=", true]],
                    ["id", "name"],
                    { order: "name asc" }
                ),
                this.orm.searchRead(
                    "res.users",
                    [["active", "=", true]],
                    ["id", "name"],
                    { limit: 200, order: "name asc" }
                ),
                this.orm.searchRead(
                    "product.product",
                    [["active", "=", true]],
                    ["id", "name"],
                    { limit: 300, order: "name asc" }
                ),
            ]);
            this.state.daftarCabang = cabang;
            this.state.daftarPic = pic;
            this.state.daftarProduk = produk;
            this.state.masterDimuat = true;
        } catch (e) {
            console.error("Gagal memuat master data:", e);
        }
    }

    // ─── DATA SPK UTAMA ───────────────────────────────────────────────────────

    getDomain() {
        const f = this.state.filter;
        const domain = [];
        if (f.cari) {
            domain.push('|', '|', '|',
                ['name', 'ilike', f.cari],
                ['custom_number', 'ilike', f.cari],
                ['nama_pekerjaan', 'ilike', f.cari],
                ['pic_id.name', 'ilike', f.cari]
            );
        }
        if (f.branch_id) {
            domain.push(['branch_id', '=', parseInt(f.branch_id)]);
        }
        if (f.tanggalMulai) {
            domain.push(['spk_date', '>=', f.tanggalMulai]);
        }
        if (f.tanggalAkhir) {
            domain.push(['spk_date', '<=', f.tanggalAkhir]);
        }
        return domain;
    }

    async muatData() {
        this.state.memuat = true;
        try {
            const domain = this.getDomain();
            const offset = (this.state.halamanAktif - 1) * this.state.perHalaman;
            const [spkList, totalData] = await Promise.all([
                this.orm.searchRead(
                    "spk.spk",
                    domain,
                    ["id", "name", "nama_pekerjaan", "spk_date", "branch_id", "pic_id",
                     "product_id", "qty", "unit", "layer_per_karton", "pcs_per_layer",
                     "standard_price", "nominal_gaji", "custom_number", "status", "tgl_selesai"],
                    { limit: this.state.perHalaman, offset, order: "spk_date desc, id desc" }
                ),
                this.orm.searchCount("spk.spk", domain),
            ]);
            this.state.spkList = spkList;
            this.state.totalData = totalData;
        } catch (e) {
            console.error("Gagal memuat data SPK:", e);
            this.notification.add("Gagal memuat data SPK.", { type: "danger" });
        }
        this.state.memuat = false;
    }

    // ─── FILTER & PAGINATION ──────────────────────────────────────────────────

    async cariData() {
        this.state.halamanAktif = 1;
        await this.muatData();
    }

    handleKeydown(ev) {
        if (ev.key === 'Enter') this.cariData();
    }

    // ─── TAMBAH CABANG BARU (inline) ─────────────────────────────────────────

    bukaInputCabang(targetForm) {
        this.state.cabangBaru.aktif = true;
        this.state.cabangBaru.nama = "";
        this.state.cabangBaru.targetForm = targetForm;
    }

    tutupInputCabang() {
        this.state.cabangBaru.aktif = false;
        this.state.cabangBaru.nama = "";
    }

    async tambahCabangBaru() {
        const cb = this.state.cabangBaru;
        const nama = cb.nama.trim();
        if (!nama) {
            this.notification.add("Nama cabang tidak boleh kosong!", { type: "warning" });
            return;
        }
        cb.menyimpan = true;
        try {
            const [idBaru] = await this.orm.create("spk.cabang", [{ name: nama }]);
            const cabang = await this.orm.searchRead(
                "spk.cabang",
                [["active", "=", true]],
                ["id", "name"],
                { order: "name asc" }
            );
            this.state.daftarCabang = cabang;
            // Auto-select hanya jika dipanggil dari form (bukan filter bar)
            if (cb.targetForm === "formTambah" || cb.targetForm === "formEdit") {
                this.state[cb.targetForm].branch_id = String(idBaru);
            }
            this.tutupInputCabang();
            this.notification.add("Cabang \"" + nama + "\" berhasil ditambahkan!", { type: "success" });
        } catch (e) {
            console.error("Gagal tambah cabang:", e);
            this.notification.add("Gagal menambahkan cabang. Coba lagi.", { type: "danger" });
        }
        cb.menyimpan = false;
    }

    // ─── POPUP KELOLA CABANG ──────────────────────────────────────────────────

    async bukaPopupCabang() {
        const cabang = await this.orm.searchRead(
            "spk.cabang",
            [["active", "=", true]],
            ["id", "name"],
            { order: "name asc" }
        );
        this.state.daftarCabang = cabang;
        this.state.popupCabang.buka = true;
        this.state.popupCabang.editId = null;
        this.state.popupCabang.editNama = "";
    }

    tutupPopupCabang() {
        this.state.popupCabang.buka = false;
        this.state.popupCabang.editId = null;
        this.state.popupCabang.editNama = "";
        this.state.popupCabang.tambahAktif = false;
        this.state.popupCabang.tambahNama = "";
    }

    async tambahCabangDariPopup() {
        const p = this.state.popupCabang;
        const nama = p.tambahNama.trim();
        if (!nama) {
            this.notification.add("Nama cabang tidak boleh kosong!", { type: "warning" });
            return;
        }
        p.tambahMenyimpan = true;
        try {
            await this.orm.create("spk.cabang", [{ name: nama }]);
            const cabang = await this.orm.searchRead(
                "spk.cabang", [["active", "=", true]], ["id", "name"], { order: "name asc" }
            );
            this.state.daftarCabang = cabang;
            p.tambahAktif = false;
            p.tambahNama = "";
            this.notification.add("Cabang \"" + nama + "\" berhasil ditambahkan!", { type: "success" });
        } catch (e) {
            console.error("Gagal tambah cabang:", e);
            this.notification.add("Gagal menambahkan cabang. Coba lagi.", { type: "danger" });
        }
        p.tambahMenyimpan = false;
    }

    mulaiEditCabang(cab) {
        this.state.popupCabang.editId = cab.id;
        this.state.popupCabang.editNama = cab.name;
    }

    batalEditCabang() {
        this.state.popupCabang.editId = null;
        this.state.popupCabang.editNama = "";
    }

    async simpanEditCabang() {
        const p = this.state.popupCabang;
        const nama = p.editNama.trim();
        if (!nama) {
            this.notification.add("Nama cabang tidak boleh kosong!", { type: "warning" });
            return;
        }
        p.menyimpan = true;
        try {
            await this.orm.write("spk.cabang", [p.editId], { name: nama });
            const cabang = await this.orm.searchRead(
                "spk.cabang",
                [["active", "=", true]],
                ["id", "name"],
                { order: "name asc" }
            );
            this.state.daftarCabang = cabang;
            this.batalEditCabang();
            this.notification.add("Nama cabang berhasil diperbarui!", { type: "success" });
        } catch (e) {
            console.error("Gagal edit cabang:", e);
            this.notification.add("Gagal memperbarui cabang. Coba lagi.", { type: "danger" });
        }
        p.menyimpan = false;
    }

    hapusCabang(cab) {
        this.tutupPopupCabang();
        this.tampilKonfirmasi({
            judul: "Hapus Cabang",
            pesan: "Apakah Anda yakin ingin menghapus cabang <b>" + cab.name + "</b>?<br/>SPK yang terhubung akan kehilangan data cabang.",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusCabang(cab),
        });
    }

    async lakukanHapusCabang(cab) {
        try {
            await this.orm.unlink("spk.cabang", [cab.id]);
            const cabang = await this.orm.searchRead(
                "spk.cabang",
                [["active", "=", true]],
                ["id", "name"],
                { order: "name asc" }
            );
            this.state.daftarCabang = cabang;
            this.notification.add("Cabang berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus cabang:", e);
            this.notification.add("Gagal menghapus. Cabang mungkin masih digunakan oleh SPK.", { type: "danger" });
        }
    }

    async ubahFilter(key, val) {
        this.state.filter[key] = val;
        this.state.halamanAktif = 1;
        await this.muatData();
    }

    async resetFilter() {
        this.state.filter.cari = "";
        this.state.filter.branch_id = "";
        this.state.filter.tanggalMulai = "";
        this.state.filter.tanggalAkhir = "";
        this.state.halamanAktif = 1;
        await this.muatData();
    }

    get totalHalaman() {
        return Math.max(1, Math.ceil(this.state.totalData / this.state.perHalaman));
    }

    get infoHalaman() {
        if (this.state.totalData === 0) return "Tidak ada data";
        const mulai = (this.state.halamanAktif - 1) * this.state.perHalaman + 1;
        const akhir = Math.min(
            this.state.halamanAktif * this.state.perHalaman,
            this.state.totalData
        );
        return `${mulai}–${akhir} dari ${this.state.totalData} SPK`;
    }

    async halamanSebelumnya() {
        if (this.state.halamanAktif > 1) {
            this.state.halamanAktif--;
            await this.muatData();
        }
    }

    async halamanBerikutnya() {
        if (this.state.halamanAktif < this.totalHalaman) {
            this.state.halamanAktif++;
            await this.muatData();
        }
    }

    // ─── KONFIRMASI DIALOG ────────────────────────────────────────────────────

    tampilKonfirmasi({ judul, pesan, labelYa, warnaYa, aksi }) {
        this._aksiKonfirmasi = aksi;
        this._konfirmasiPesan = markup(pesan);
        this.state.konfirmasi.buka = true;
        this.state.konfirmasi.judul = judul;
        this.state.konfirmasi.labelYa = labelYa;
        this.state.konfirmasi.warnaYa = warnaYa;
    }

    get konfirmasiPesan() {
        return this._konfirmasiPesan;
    }

    tutupKonfirmasi() {
        this._aksiKonfirmasi = null;
        this.state.konfirmasi.buka = false;
    }

    async jalankanKonfirmasi() {
        const aksi = this._aksiKonfirmasi;
        this.tutupKonfirmasi();
        if (aksi) await aksi();
    }

    // ─── HAPUS SPK ────────────────────────────────────────────────────────────

    konfirmasiHapus(spk) {
        this.tampilKonfirmasi({
            judul: "Hapus SPK",
            pesan: `Apakah Anda yakin ingin menghapus SPK <b>${spk.name}</b>?<br/>Tindakan ini tidak dapat dibatalkan.`,
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapus(spk),
        });
    }

    async lakukanHapus(spk) {
        try {
            await this.orm.unlink("spk.spk", [spk.id]);
            this.notification.add(`SPK ${spk.name} berhasil dihapus.`, { type: "success" });
            await this.muatData();
        } catch (e) {
            console.error("Gagal hapus SPK:", e);
            this.notification.add("Gagal menghapus SPK. Coba lagi.", { type: "danger" });
        }
    }

    // ─── FORM TAMBAH SPK ──────────────────────────────────────────────────────

    async bukaFormTambah() {
        await this.muatMaster();
        this.tutupInputCabang();
        const f = this.state.formTambah;
        f.buka = true;
        f.menyimpan = false;
        f.spk_date = new Date().toISOString().slice(0, 10);
        f.branch_id = "";
        f.pic_id = "";
        f.product_id = "";
        f.qty = 1;
        f.unit = "";
        f.layer_per_karton = 1;
        f.pcs_per_layer = 1;
        f.standard_price = 0;
        f.custom_number = "";
        f.status = "open";
        f.tgl_selesai = "";
    }

    tutupFormTambah() {
        this.state.formTambah.buka = false;
    }

    async simpanSpk() {
        const f = this.state.formTambah;
        if (!f.nama_pekerjaan.trim()) { this.notification.add("Nama Pekerjaan wajib diisi!", { type: "warning" }); return; }
        if (!f.pic_id)     { this.notification.add("Pilih PIC terlebih dahulu!", { type: "warning" }); return; }
        if (!f.product_id) { this.notification.add("Pilih Produk terlebih dahulu!", { type: "warning" }); return; }
        if (!f.unit)       { this.notification.add("Pilih Satuan terlebih dahulu!", { type: "warning" }); return; }
        if (parseFloat(f.qty) <= 0) {
            this.notification.add("Jumlah (Qty) harus lebih dari 0!", { type: "warning" }); return;
        }
        if (parseFloat(f.standard_price) < 0) {
            this.notification.add("Harga Standar tidak boleh negatif!", { type: "warning" }); return;
        }

        f.menyimpan = true;
        try {
            await this.orm.create("spk.spk", [{
                nama_pekerjaan: f.nama_pekerjaan.trim(),
                spk_date: f.spk_date,
                ...(f.branch_id ? { branch_id: parseInt(f.branch_id) } : {}),
                pic_id: parseInt(f.pic_id),
                product_id: parseInt(f.product_id),
                qty: parseFloat(f.qty),
                unit: f.unit,
                layer_per_karton: parseInt(f.layer_per_karton) || 1,
                pcs_per_layer: parseInt(f.pcs_per_layer) || 1,
                standard_price: parseFloat(f.standard_price),
                ...(f.custom_number ? { custom_number: f.custom_number } : {}),
                status: f.status || "open",
                ...(f.tgl_selesai ? { tgl_selesai: f.tgl_selesai } : {}),
            }]);
            this.notification.add("SPK berhasil dibuat!", { type: "success" });
            this.tutupFormTambah();
            await this.muatData();
        } catch (e) {
            console.error("Gagal buat SPK:", e);
            this.notification.add("Gagal membuat SPK. Coba lagi.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    // ─── FORM EDIT SPK ────────────────────────────────────────────────────────

    async bukaFormEdit(spk) {
        await this.muatMaster();
        this.tutupInputCabang();
        const f = this.state.formEdit;
        f.buka = true;
        f.menyimpan = false;
        f.spkId = spk.id;
        f.spkName = spk.name;
        f.nama_pekerjaan = spk.nama_pekerjaan || "";
        f.spk_date = spk.spk_date || new Date().toISOString().slice(0, 10);
        f.branch_id = spk.branch_id ? String(spk.branch_id[0]) : "";
        f.pic_id = spk.pic_id ? String(spk.pic_id[0]) : "";
        f.product_id = spk.product_id ? String(spk.product_id[0]) : "";
        f.qty = spk.qty || 1;
        f.unit = spk.unit || "";
        f.layer_per_karton = spk.layer_per_karton || 1;
        f.pcs_per_layer = spk.pcs_per_layer || 1;
        f.standard_price = spk.standard_price || 0;
        f.custom_number = spk.custom_number || "";
        f.status = spk.status || "open";
        f.tgl_selesai = spk.tgl_selesai || "";
    }

    tutupFormEdit() {
        this.state.formEdit.buka = false;
    }

    async simpanEdit() {
        const f = this.state.formEdit;
        if (!f.nama_pekerjaan.trim()) { this.notification.add("Nama Pekerjaan wajib diisi!", { type: "warning" }); return; }
        if (!f.pic_id)     { this.notification.add("Pilih PIC terlebih dahulu!", { type: "warning" }); return; }
        if (!f.product_id) { this.notification.add("Pilih Produk terlebih dahulu!", { type: "warning" }); return; }
        if (!f.unit)       { this.notification.add("Pilih Satuan terlebih dahulu!", { type: "warning" }); return; }
        if (parseFloat(f.qty) <= 0) {
            this.notification.add("Jumlah (Qty) harus lebih dari 0!", { type: "warning" }); return;
        }

        f.menyimpan = true;
        try {
            await this.orm.write("spk.spk", [f.spkId], {
                nama_pekerjaan: f.nama_pekerjaan.trim(),
                spk_date: f.spk_date,
                branch_id: f.branch_id ? parseInt(f.branch_id) : false,
                pic_id: parseInt(f.pic_id),
                product_id: parseInt(f.product_id),
                qty: parseFloat(f.qty),
                unit: f.unit,
                layer_per_karton: parseInt(f.layer_per_karton) || 1,
                pcs_per_layer: parseInt(f.pcs_per_layer) || 1,
                standard_price: parseFloat(f.standard_price),
                custom_number: f.custom_number || false,
                status: f.status || "open",
                tgl_selesai: f.tgl_selesai || false,
            });
            this.notification.add("SPK berhasil diperbarui!", { type: "success" });
            this.tutupFormEdit();
            await this.muatData();
        } catch (e) {
            console.error("Gagal edit SPK:", e);
            this.notification.add("Gagal memperbarui SPK. Coba lagi.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    // ─── NAVIGASI DETAIL SPK ─────────────────────────────────────────────────

    async bukaDetail(spk) {
        // Simpan plain copy agar tidak ada nested reactive proxy
        const id = Number(spk.id);
        this.state.spkId = id;
        this.state.tabDetail = 'bahan';
        this.state.daftarFormulasi = [];
        this.state.daftarDetail = [];
        this.state.daftarHpr = [];
        this.state.daftarSbh = [];
        this.state.spkDipilih = {
            id,
            name: spk.name,
            nama_pekerjaan: spk.nama_pekerjaan,
            spk_date: spk.spk_date,
            custom_number: spk.custom_number,
            branch_id: spk.branch_id,
            pic_id: spk.pic_id,
            product_id: spk.product_id,
            qty: spk.qty,
            unit: spk.unit,
            layer_per_karton: spk.layer_per_karton || 1,
            pcs_per_layer: spk.pcs_per_layer || 1,
            standard_price: spk.standard_price,
            nominal_gaji: spk.nominal_gaji || 0,
        };
        this.state.halaman = 'detail';
        await this.muatMaster();
        await Promise.all([
            this.muatBahan(id),
            this.muatFormulasi(id),
            this.muatHpr(id),
            this.muatSbh(id),
        ]);
    }

    kembaliKeDaftar() {
        this.state.halaman = 'daftar';
        this.state.spkDipilih = null;
        this.state.spkId = null;
        this.state.daftarBahan = [];
        this.state.daftarFormulasi = [];
        this.state.daftarDetail = [];
        this.state.daftarHpr = [];
        this.state.daftarSbh = [];
        this.state.tabDetail = 'bahan';
    }

    // ─── BAHAN BAKU ───────────────────────────────────────────────────────────

    async muatBahan(spkId) {
        this.state.memuatBahan = true;
        try {
            const [bahan] = await Promise.all([
                this.orm.searchRead(
                    "spk.bahan.baku",
                    [["spk_id", "=", spkId]],
                    ["id", "kode_barang", "nama_bahan", "qty", "is_qty_custom", "harga", "pic_id", "gudang_asal", "keterangan", "has_rincian"],
                    { order: "id asc" }
                ),
            ]);
            this.state.daftarBahan = bahan;
            await this.muatDetail(spkId);
        } catch (e) {
            console.error("Gagal memuat bahan baku:", e);
            this.notification.add("Gagal memuat bahan baku.", { type: "danger" });
        }
        this.state.memuatBahan = false;
    }

    bukaFormBahan() {
        const f = this.state.formBahan;
        f.buka = true;
        f.mode = 'tambah';
        f.bahanId = null;
        f.menyimpan = false;
        f.kode_barang = "";
        f.nama_bahan = "";
        f.is_qty_custom = false;
        f.qty = 0;
        f.harga = 0;
        f.pic_id = "";
        f.gudang_asal = "";
        f.keterangan = "";
    }

    bukaFormEditBahan(bahan) {
        const f = this.state.formBahan;
        f.buka = true;
        f.mode = 'edit';
        f.bahanId = bahan.id;
        f.menyimpan = false;
        f.kode_barang = bahan.kode_barang || "";
        f.nama_bahan = bahan.nama_bahan || "";
        f.is_qty_custom = !!bahan.is_qty_custom;
        f.qty = bahan.qty || 0;
        f.harga = bahan.harga || 0;
        f.pic_id = bahan.pic_id ? String(bahan.pic_id[0]) : "";
        f.gudang_asal = bahan.gudang_asal || "";
        f.keterangan = bahan.keterangan || "";
    }

    tutupFormBahan() {
        this.state.formBahan.buka = false;
    }

    async simpanBahan() {
        const f = this.state.formBahan;
        const spkId = this.state.spkId;
        if (!f.nama_bahan.trim()) {
            this.notification.add("Nama Bahan Baku wajib diisi!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            // Qty: pakai input custom bila dicentang, selain itu otomatis dari formulasi
            let qtyVal;
            if (f.is_qty_custom) {
                qtyVal = parseFloat(f.qty) || 0;
            } else {
                const keb = this.hitungKebutuhanBahan({ nama_bahan: f.nama_bahan.trim() });
                qtyVal = keb !== null ? keb : 0;
            }
            const vals = {
                nama_bahan: f.nama_bahan.trim(),
                qty: qtyVal,
                is_qty_custom: f.is_qty_custom,
                harga: parseFloat(f.harga) || 0,
                ...(f.kode_barang ? { kode_barang: f.kode_barang.trim() } : { kode_barang: false }),
                ...(f.pic_id ? { pic_id: parseInt(f.pic_id) } : { pic_id: false }),
                ...(f.gudang_asal ? { gudang_asal: f.gudang_asal.trim() } : { gudang_asal: false }),
                ...(f.keterangan ? { keterangan: f.keterangan.trim() } : { keterangan: false }),
            };
            if (f.mode === 'tambah') {
                await this.orm.create("spk.bahan.baku", [{ spk_id: spkId, ...vals }]);
                this.notification.add("Bahan baku berhasil ditambahkan!", { type: "success" });
            } else {
                await this.orm.write("spk.bahan.baku", [f.bahanId], vals);
                this.notification.add("Bahan baku berhasil diperbarui!", { type: "success" });
            }
            this.tutupFormBahan();
            await Promise.all([
                this.muatBahan(spkId),
                f.mode === 'edit' ? this.muatFormulasi(spkId) : Promise.resolve(),
            ]);
        } catch (e) {
            console.error("Gagal simpan bahan:", e);
            this.notification.add("Gagal menyimpan bahan baku.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    konfirmasiHapusBahan(bahan) {
        this.tampilKonfirmasi({
            judul: "Hapus Bahan Baku",
            pesan: "Hapus bahan <b>" + bahan.nama_bahan + "</b> dari SPK ini?",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusBahan(bahan),
        });
    }

    async lakukanHapusBahan(bahan) {
        try {
            await this.orm.unlink("spk.bahan.baku", [bahan.id]);
            await this.muatBahan(this.state.spkId);
            this.notification.add("Bahan baku berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus bahan:", e);
            this.notification.add("Gagal menghapus bahan baku.", { type: "danger" });
        }
    }

    // ─── RINCIAN VARIAN BAHAN ────────────────────────────────────────────────

    async toggleRincianBahan(bahan) {
        const newVal = !bahan.has_rincian;
        await this.orm.write("spk.bahan.baku", [bahan.id], { has_rincian: newVal });
        await this.muatBahan(this.state.spkId);
    }

    async muatDetail(spkId) {
        try {
            const detail = await this.orm.searchRead(
                "spk.bahan.detail",
                [["bahan_id.spk_id", "=", spkId]],
                ["id", "keterangan", "qty", "bahan_id"],
                { order: "id asc" }
            );
            this.state.daftarDetail = detail;
        } catch (e) {
            console.error("Gagal memuat detail:", e);
        }
    }

    getDetailForBahan(bahanId) {
        return this.state.daftarDetail.filter(d => d.bahan_id[0] === bahanId);
    }

    totalDetailForBahan(bahanId) {
        return this.getDetailForBahan(bahanId).reduce((sum, d) => sum + (d.qty || 0), 0);
    }

    bukaFormDetail(bahan) {
        const f = this.state.formDetail;
        f.buka = true;
        f.mode = 'tambah';
        f.detailId = null;
        f.bahanId = bahan.id;
        f.menyimpan = false;
        f.keterangan = "";
        f.qty = 0;
    }

    bukaFormEditDetail(detail) {
        const f = this.state.formDetail;
        f.buka = true;
        f.mode = 'edit';
        f.detailId = detail.id;
        f.bahanId = this.state.expandedBahanId;
        f.menyimpan = false;
        f.keterangan = detail.keterangan || "";
        f.qty = detail.qty || 0;
    }

    tutupFormDetail() {
        this.state.formDetail.buka = false;
    }

    async simpanDetail() {
        const f = this.state.formDetail;
        if (!f.keterangan.trim()) {
            this.notification.add("Keterangan wajib diisi!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            const vals = {
                keterangan: f.keterangan.trim(),
                qty: parseFloat(f.qty) || 0,
            };
            if (f.mode === 'tambah') {
                await this.orm.create("spk.bahan.detail", [{ bahan_id: f.bahanId, ...vals }]);
                this.notification.add("Rincian berhasil ditambahkan!", { type: "success" });
            } else {
                await this.orm.write("spk.bahan.detail", [f.detailId], vals);
                this.notification.add("Rincian berhasil diperbarui!", { type: "success" });
            }
            this.tutupFormDetail();
            await this.muatDetail(this.state.spkId);
        } catch (e) {
            console.error("Gagal simpan detail:", e);
            this.notification.add("Gagal menyimpan rincian.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    konfirmasiHapusDetail(detail) {
        this.tampilKonfirmasi({
            judul: "Hapus Rincian",
            pesan: "Hapus rincian <b>" + detail.keterangan + "</b>?",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusDetail(detail),
        });
    }

    async lakukanHapusDetail(detail) {
        try {
            await this.orm.unlink("spk.bahan.detail", [detail.id]);
            await this.muatDetail(this.state.spkId);
            this.notification.add("Rincian berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus detail:", e);
            this.notification.add("Gagal menghapus rincian.", { type: "danger" });
        }
    }

    get totalHargaBahan() {
        return this.state.daftarBahan.reduce((sum, b) => {
            let qty;
            if (b.has_rincian) {
                qty = this.totalDetailForBahan(b.id);
            } else {
                const keb = this.qtyEfektifBahan(b);
                qty = keb !== null ? keb : (b.qty || 0);
            }
            return sum + (qty * (b.harga || 0));
        }, 0);
    }

    // ─── KALKULASI PRODUKSI ───────────────────────────────────────────────────

    get totalKarton() {
        const s = this.state.spkDipilih;
        if (!s) return 0;
        return s.unit === 'karton' ? (s.qty || 0) : 0;
    }

    get totalLayer() {
        const s = this.state.spkDipilih;
        if (!s) return 0;
        if (s.unit === 'karton') return (s.qty || 0) * (s.layer_per_karton || 1);
        if (s.unit === 'layer') return s.qty || 0;
        return 0;
    }

    get totalPcs() {
        const s = this.state.spkDipilih;
        if (!s) return 0;
        if (s.unit === 'karton') return (s.qty || 0) * (s.layer_per_karton || 1) * (s.pcs_per_layer || 1);
        if (s.unit === 'layer') return (s.qty || 0) * (s.pcs_per_layer || 1);
        if (s.unit === 'pcs') return s.qty || 0;
        return 0;
    }

    get formTambahTotalPcs() {
        const f = this.state.formTambah;
        const qty = parseFloat(f.qty) || 0;
        if (f.unit === 'karton') return qty * (parseInt(f.layer_per_karton) || 1) * (parseInt(f.pcs_per_layer) || 1);
        if (f.unit === 'layer') return qty * (parseInt(f.pcs_per_layer) || 1);
        return qty;
    }

    get formEditTotalPcs() {
        const f = this.state.formEdit;
        const qty = parseFloat(f.qty) || 0;
        if (f.unit === 'karton') return qty * (parseInt(f.layer_per_karton) || 1) * (parseInt(f.pcs_per_layer) || 1);
        if (f.unit === 'layer') return qty * (parseInt(f.pcs_per_layer) || 1);
        return qty;
    }

    hitungKebutuhanFormulasi(formula) {
        const satuan = formula.satuan_hitung || 'pcs';
        const qty = formula.qty || 0;
        if (satuan === 'pcs') return qty * this.totalPcs;
        if (satuan === 'layer') return qty * this.totalLayer;
        if (satuan === 'karton') return qty * this.totalKarton;
        return 0;
    }

    hitungKebutuhanBahan(bahan) {
        const formula = this.state.daftarFormulasi.find(f => f.nama_bahan === bahan.nama_bahan);
        if (!formula) return null;
        return Math.ceil(this.hitungKebutuhanFormulasi(formula));
    }

    // Qty efektif bahan: pakai nilai custom bila di-override, selain itu dari formulasi (boleh null)
    qtyEfektifBahan(bahan) {
        if (bahan.is_qty_custom) return bahan.qty || 0;
        return this.hitungKebutuhanBahan(bahan);
    }

    // Nilai default qty dari formulasi untuk nama bahan yang sedang diisi di form (boleh null)
    get formBahanKebutuhan() {
        const nama = (this.state.formBahan.nama_bahan || "").trim();
        if (!nama) return null;
        return this.hitungKebutuhanBahan({ nama_bahan: nama });
    }

    hitungPreviewFormulasi() {
        const f = this.state.formFormulasi;
        const qty = parseFloat(f.qty) || 0;
        const satuan = f.satuan_hitung || 'pcs';
        if (satuan === 'pcs') return qty * this.totalPcs;
        if (satuan === 'layer') return qty * this.totalLayer;
        if (satuan === 'karton') return qty * this.totalKarton;
        return 0;
    }

    get bahanTersediaUntukFormulasi() {
        const f = this.state.formFormulasi;
        const digunakanNama = new Set(
            this.state.daftarFormulasi
                .filter(item => f.mode === 'edit' ? item.id !== f.formulasiId : true)
                .map(item => item.nama_bahan)
        );
        const tersedia = this.state.daftarBahan.filter(b => !digunakanNama.has(b.nama_bahan));
        // Saat edit, pastikan bahan saat ini selalu ada di dropdown
        if (f.mode === 'edit' && f.nama_bahan && !tersedia.find(b => b.nama_bahan === f.nama_bahan)) {
            return [{ id: '_current', nama_bahan: f.nama_bahan }, ...tersedia];
        }
        return tersedia;
    }

    // ─── TAB & FORMULASI ──────────────────────────────────────────────────────

    pindahTab(tab) {
        this.state.tabDetail = tab;
    }

    async muatFormulasi(spkId) {
        if (!spkId) return;
        this.state.memuatFormulasi = true;
        try {
            const formulasi = await this.orm.searchRead(
                "spk.formulasi",
                [["spk_id", "=", spkId]],
                ["id", "nama_bahan", "qty", "satuan_hitung", "is_pengganti", "boleh_ubah_qty", "boleh_hapus", "write_date"],
                { order: "id asc" }
            );
            this.state.daftarFormulasi = formulasi;
        } catch (e) {
            console.error("Gagal memuat formulasi:", e);
            this.notification.add("Gagal memuat formulasi.", { type: "danger" });
        }
        this.state.memuatFormulasi = false;
    }

    bukaFormFormulasi() {
        const f = this.state.formFormulasi;
        f.buka = true;
        f.mode = 'tambah';
        f.formulasiId = null;
        f.menyimpan = false;
        f.nama_bahan = "";
        f.qty = 1;
        f.satuan_hitung = 'pcs';
        f.is_pengganti = false;
        f.boleh_ubah_qty = true;
        f.boleh_hapus = true;
    }

    bukaFormEditFormulasi(formula) {
        const f = this.state.formFormulasi;
        f.buka = true;
        f.mode = 'edit';
        f.formulasiId = formula.id;
        f.menyimpan = false;
        f.nama_bahan = formula.nama_bahan || "";
        f.qty = formula.qty || 1;
        f.satuan_hitung = formula.satuan_hitung || 'pcs';
        f.is_pengganti = !!formula.is_pengganti;
        f.boleh_ubah_qty = formula.boleh_ubah_qty !== false;
        f.boleh_hapus = formula.boleh_hapus !== false;
    }

    tutupFormFormulasi() {
        this.state.formFormulasi.buka = false;
    }

    async simpanFormulasi() {
        const f = this.state.formFormulasi;
        const spkId = this.state.spkId;
        if (!f.nama_bahan.trim()) {
            this.notification.add("Nama Bahan wajib diisi!", { type: "warning" });
            return;
        }
        if (parseFloat(f.qty) <= 0) {
            this.notification.add("Qty harus lebih dari 0!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            const vals = {
                nama_bahan: f.nama_bahan.trim(),
                qty: parseFloat(f.qty),
                satuan_hitung: f.satuan_hitung,
                is_pengganti: f.is_pengganti,
                boleh_ubah_qty: f.boleh_ubah_qty,
                boleh_hapus: f.boleh_hapus,
            };
            if (f.mode === 'tambah') {
                await this.orm.create("spk.formulasi", [{ spk_id: spkId, ...vals }]);
                this.notification.add("Formulasi berhasil ditambahkan!", { type: "success" });
            } else {
                await this.orm.write("spk.formulasi", [f.formulasiId], vals);
                this.notification.add("Formulasi berhasil diperbarui!", { type: "success" });
            }
            this.tutupFormFormulasi();
            await this.muatFormulasi(spkId);
        } catch (e) {
            console.error("Gagal simpan formulasi:", e);
            this.notification.add("Gagal menyimpan formulasi.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    konfirmasiHapusFormulasi(formula) {
        this.tampilKonfirmasi({
            judul: "Hapus Formulasi",
            pesan: "Hapus formulasi <b>" + formula.nama_bahan + "</b>?",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusFormulasi(formula),
        });
    }

    async lakukanHapusFormulasi(formula) {
        try {
            await this.orm.unlink("spk.formulasi", [formula.id]);
            await this.muatFormulasi(this.state.spkId);
            this.notification.add("Formulasi berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus formulasi:", e);
            this.notification.add("Gagal menghapus formulasi.", { type: "danger" });
        }
    }

    // ─── HPR (HASIL PRODUKSI & RETUR) ────────────────────────────────────────

    async muatHpr(spkId) {
        if (!spkId) return;
        this.state.memuatHpr = true;
        try {
            const hpr = await this.orm.searchRead(
                "spk.hpr",
                [["spk_id", "=", spkId]],
                ["id", "tanggal_kirim", "hasil_produksi"],
                { order: "tanggal_kirim asc, id asc" }
            );
            this.state.daftarHpr = hpr;
        } catch (e) {
            console.error("Gagal memuat HPR:", e);
            this.notification.add("Gagal memuat data HPR.", { type: "danger" });
        }
        this.state.memuatHpr = false;
    }

    // Konversi qty (dalam satuan SPK) ke jumlah pada satuan tertentu (pcs/layer/karton)
    konversiSatuanSpk(qty, satuanTarget) {
        const s = this.state.spkDipilih;
        if (!s) return 0;
        const lpk = s.layer_per_karton || 1;
        const ppl = s.pcs_per_layer || 1;
        let karton = 0, layer = 0, pcs = 0;
        if (s.unit === 'karton') { karton = qty; layer = qty * lpk; pcs = qty * lpk * ppl; }
        else if (s.unit === 'layer') { layer = qty; pcs = qty * ppl; }
        else { pcs = qty; }
        if (satuanTarget === 'karton') return karton;
        if (satuanTarget === 'layer') return layer;
        return pcs;
    }

    // Bahan terpakai = formulasi.qty × (TOTAL hasil produksi semua catatan, dikonversi ke satuan formulasi)
    // Akumulatif: tiap catatan produksi mengurangi kebutuhan bahan sesuai porsi & formulasinya
    konsumsiBahanHpr(bahan) {
        const formula = this.state.daftarFormulasi.find(f => f.nama_bahan === bahan.nama_bahan);
        if (!formula) return null;
        const totalHp = this.totalHasilProduksiHpr;
        if (totalHp <= 0) return 0;
        const basis = this.konversiSatuanSpk(totalHp, formula.satuan_hitung || 'pcs');
        return Math.ceil((formula.qty || 0) * basis);
    }

    // Sisa qty kebutuhan = qty kebutuhan total − bahan terpakai (berkurang sesuai hasil produksi)
    sisaKebutuhanHpr(bahan) {
        const keb = this.qtyEfektifBahan(bahan);
        if (keb === null) return null;
        const kons = this.konsumsiBahanHpr(bahan);
        const terpakai = (kons === null) ? 0 : kons;
        return keb - terpakai;
    }

    // Status dari persentase (dibulatkan): 100% = SEMUA, <100% = SEBAGIAN, >100% = LEBIH
    statusDariPersen(p) {
        if (p === null) return null;
        const persen = Math.round(p);
        if (persen === 100) return { label: 'DIPROSES SEMUA', kelas: 'semua' };
        if (persen > 100) return { label: 'DIPROSES LEBIH', kelas: 'lebih' };
        return { label: 'DIPROSES SEBAGIAN', kelas: 'sebagian' };
    }

    // Status agregat = berdasarkan total hasil produksi terhadap target SPK
    get statusHasilProduksi() {
        return this.statusDariPersen(this.persenHasilProduksi);
    }

    // Lebar & warna bar progress agregat (total hasil produksi vs target SPK)
    get persenHasilProduksiBarWidth() {
        const p = this.persenHasilProduksi;
        if (p === null) return 0;
        return Math.min(100, Math.max(0, p));
    }

    get persenHasilProduksiWarna() {
        const p = this.persenHasilProduksi;
        if (p === null) return 'abu';
        if (p >= 100) return 'hijau';
        if (p >= 50) return 'kuning';
        return 'merah';
    }

    // Buka form tambah catatan produksi baru (level SPK, bukan per bahan)
    bukaFormHpr() {
        const f = this.state.formHpr;
        f.buka = true;
        f.mode = 'tambah';
        f.hprId = null;
        f.menyimpan = false;
        f.tanggal_kirim = new Date().toISOString().slice(0, 10);
        f.hasil_produksi = 0;
    }

    // Buka form edit catatan produksi
    bukaFormEditHpr(entry) {
        const f = this.state.formHpr;
        f.buka = true;
        f.mode = 'edit';
        f.hprId = entry.id;
        f.menyimpan = false;
        f.tanggal_kirim = entry.tanggal_kirim || "";
        f.hasil_produksi = entry.hasil_produksi || 0;
    }

    tutupFormHpr() {
        this.state.formHpr.buka = false;
    }

    async simpanHpr() {
        const f = this.state.formHpr;
        if (parseFloat(f.hasil_produksi) <= 0) {
            this.notification.add("Hasil Produksi harus lebih dari 0!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            const vals = {
                hasil_produksi: parseFloat(f.hasil_produksi) || 0,
                tanggal_kirim: f.tanggal_kirim || false,
            };
            if (f.mode === 'tambah') {
                await this.orm.create("spk.hpr", [{ spk_id: this.state.spkId, ...vals }]);
                this.notification.add("Catatan produksi berhasil ditambahkan!", { type: "success" });
            } else {
                await this.orm.write("spk.hpr", [f.hprId], vals);
                this.notification.add("Catatan produksi berhasil diperbarui!", { type: "success" });
            }
            this.tutupFormHpr();
            await this.muatHpr(this.state.spkId);
        } catch (e) {
            console.error("Gagal simpan HPR:", e);
            this.notification.add("Gagal menyimpan catatan produksi.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    konfirmasiHapusHpr(entry) {
        const tgl = entry.tanggal_kirim ? " (" + this.formatTanggal(entry.tanggal_kirim) + ")" : "";
        this.tampilKonfirmasi({
            judul: "Hapus Catatan Produksi",
            pesan: "Hapus catatan produksi <b>" + this.formatAngka(entry.hasil_produksi)
                + " " + this.labelUnitSpk(this.state.spkDipilih.unit) + "</b>" + tgl + "?",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusHpr(entry),
        });
    }

    async lakukanHapusHpr(entry) {
        try {
            await this.orm.unlink("spk.hpr", [entry.id]);
            await this.muatHpr(this.state.spkId);
            this.notification.add("Catatan produksi berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus HPR:", e);
            this.notification.add("Gagal menghapus catatan produksi.", { type: "danger" });
        }
    }

    // Total hasil produksi (satuan SPK) dari seluruh entri HPR
    get totalHasilProduksiHpr() {
        return this.state.daftarHpr.reduce((s, h) => s + (h.hasil_produksi || 0), 0);
    }

    // Target SPK = qty SPK dalam satuannya (karton/layer/pcs)
    get targetSpk() {
        const s = this.state.spkDipilih;
        return s ? (s.qty || 0) : 0;
    }

    // Persentase total hasil produksi terhadap target SPK
    get persenHasilProduksi() {
        const t = this.targetSpk;
        if (t <= 0) return null;
        return (this.totalHasilProduksiHpr / t) * 100;
    }

    // Label satuan SPK untuk hasil produksi (Karton/Layer/Pcs)
    labelUnitSpk(unit) {
        const m = { karton: 'Karton', layer: 'Layer', pcs: 'Pcs' };
        return m[unit] || unit || '';
    }

    // ─── SBH (STATUS BARANG KEMBALI) ─────────────────────────────────────────

    async muatSbh(spkId) {
        if (!spkId) return;
        this.state.memuatSbh = true;
        try {
            const sbh = await this.orm.searchRead(
                "spk.sbh",
                [["bahan_id.spk_id", "=", spkId]],
                ["id", "bahan_id", "barang_bagus", "barang_rusak"],
                { order: "id asc" }
            );
            this.state.daftarSbh = sbh;
        } catch (e) {
            console.error("Gagal memuat SBH:", e);
            this.notification.add("Gagal memuat data SBH.", { type: "danger" });
        }
        this.state.memuatSbh = false;
    }

    getSbhForBahan(bahanId) {
        return this.state.daftarSbh.find(s => s.bahan_id[0] === bahanId) || null;
    }

    // Total kembali = bahan terpakai dari total produksi (diambil dari perhitungan HPR)
    totalKembaliSbh(bahan) {
        return this.konsumsiBahanHpr(bahan);
    }

    barangBagusSbh(bahan) {
        const sbh = this.getSbhForBahan(bahan.id);
        return sbh ? (sbh.barang_bagus || 0) : 0;
    }

    barangRusakSbh(bahan) {
        const sbh = this.getSbhForBahan(bahan.id);
        return sbh ? (sbh.barang_rusak || 0) : 0;
    }

    // Sisa = Qty SPK − Total Kembali (porsi yang dibagi jadi bagus/rusak/hilang)
    sisaSbh(bahan) {
        const qtySpk = this.qtyEfektifBahan(bahan);
        const total = this.totalKembaliSbh(bahan);
        if (qtySpk === null || total === null) return null;
        return qtySpk - total;
    }

    // Barang hilang = sisa − bagus − rusak (otomatis)
    barangHilangSbh(bahan) {
        const sisa = this.sisaSbh(bahan);
        if (sisa === null) return null;
        return sisa - this.barangBagusSbh(bahan) - this.barangRusakSbh(bahan);
    }

    // Stock akhir = barang rusak + barang hilang
    stockAkhirSbh(bahan) {
        const hilang = this.barangHilangSbh(bahan);
        if (hilang === null) return null;
        return this.barangRusakSbh(bahan) + hilang;
    }

    // Harga bahan + 30%
    harga130Bahan(bahan) {
        return (bahan.harga || 0) * 1.3;
    }

    // Total harga = barang hilang (OPNAME) × harga+30%
    totalHargaSbh(bahan) {
        const hilang = this.barangHilangSbh(bahan);
        if (hilang === null) return null;
        return hilang * this.harga130Bahan(bahan);
    }

    // Total harga seluruh bahan yang Ket = "Kurang" (barang hilang > 0)
    get totalHargaKurangSbh() {
        return this.state.daftarBahan.reduce((sum, b) => {
            if (!this.getSbhForBahan(b.id)) return sum;
            const hilang = this.barangHilangSbh(b);
            if (hilang === null || hilang <= 0) return sum;
            return sum + (this.totalHargaSbh(b) || 0);
        }, 0);
    }

    // ─── GAJI ────────────────────────────────────────────────────────────────

    // Total satuan yang jadi (karton/layer/pcs) = total hasil produksi dari HPR
    get gajiTotalKarton() {
        return this.totalHasilProduksiHpr;
    }

    get gajiNominal() {
        const s = this.state.spkDipilih;
        return s ? (s.nominal_gaji || 0) : 0;
    }

    // Total kotor = total karton × nominal gaji
    get gajiTotal() {
        return this.gajiTotalKarton * this.gajiNominal;
    }

    // Potongan = total harga barang yang Ket = "Kurang" (dari SBH)
    get gajiPotongan() {
        return this.totalHargaKurangSbh;
    }

    // Total gaji final = total kotor − potongan
    get gajiFinal() {
        return this.gajiTotal - this.gajiPotongan;
    }

    async ubahNominalGaji(val) {
        const nominal = parseFloat(val) || 0;
        if (this.state.spkDipilih) this.state.spkDipilih.nominal_gaji = nominal;
        try {
            await this.orm.write("spk.spk", [this.state.spkId], { nominal_gaji: nominal });
        } catch (e) {
            console.error("Gagal simpan nominal gaji:", e);
            this.notification.add("Gagal menyimpan nominal gaji.", { type: "danger" });
        }
    }

    bukaFormSbh(bahan) {
        const f = this.state.formSbh;
        const sbh = this.getSbhForBahan(bahan.id);
        f.buka = true;
        f.bahanId = bahan.id;
        f.kodeBarang = bahan.kode_barang || "";
        f.namaBahan = bahan.nama_bahan || "";
        f.menyimpan = false;
        if (sbh) {
            f.mode = 'edit';
            f.sbhId = sbh.id;
            f.barang_bagus = sbh.barang_bagus || 0;
            f.barang_rusak = sbh.barang_rusak || 0;
        } else {
            f.mode = 'tambah';
            f.sbhId = null;
            f.barang_bagus = 0;
            f.barang_rusak = 0;
        }
    }

    tutupFormSbh() {
        this.state.formSbh.buka = false;
    }

    // Bahan yang sedang diedit di form SBH (untuk preview total kembali & hilang)
    get formSbhBahan() {
        return this.state.daftarBahan.find(b => b.id === this.state.formSbh.bahanId) || null;
    }

    get formSbhTotalKembali() {
        const b = this.formSbhBahan;
        return b ? this.totalKembaliSbh(b) : null;
    }

    get formSbhQtySpk() {
        const b = this.formSbhBahan;
        return b ? this.qtyEfektifBahan(b) : null;
    }

    get formSbhSisa() {
        const b = this.formSbhBahan;
        return b ? this.sisaSbh(b) : null;
    }

    get formSbhHilang() {
        const sisa = this.formSbhSisa;
        if (sisa === null) return null;
        const f = this.state.formSbh;
        return sisa - (parseFloat(f.barang_bagus) || 0) - (parseFloat(f.barang_rusak) || 0);
    }

    async simpanSbh() {
        const f = this.state.formSbh;
        f.menyimpan = true;
        try {
            const vals = {
                barang_bagus: parseFloat(f.barang_bagus) || 0,
                barang_rusak: parseFloat(f.barang_rusak) || 0,
            };
            if (f.mode === 'tambah') {
                await this.orm.create("spk.sbh", [{ bahan_id: f.bahanId, ...vals }]);
                this.notification.add("Data SBH berhasil disimpan!", { type: "success" });
            } else {
                await this.orm.write("spk.sbh", [f.sbhId], vals);
                this.notification.add("Data SBH berhasil diperbarui!", { type: "success" });
            }
            this.tutupFormSbh();
            await this.muatSbh(this.state.spkId);
        } catch (e) {
            console.error("Gagal simpan SBH:", e);
            this.notification.add("Gagal menyimpan data SBH.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    konfirmasiHapusSbh(bahan) {
        const sbh = this.getSbhForBahan(bahan.id);
        if (!sbh) return;
        this.tampilKonfirmasi({
            judul: "Hapus Data SBH",
            pesan: "Hapus data SBH untuk bahan <b>" + bahan.nama_bahan + "</b>?",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusSbh(sbh),
        });
    }

    async lakukanHapusSbh(sbh) {
        try {
            await this.orm.unlink("spk.sbh", [sbh.id]);
            await this.muatSbh(this.state.spkId);
            this.notification.add("Data SBH berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus SBH:", e);
            this.notification.add("Gagal menghapus data SBH.", { type: "danger" });
        }
    }

    // ─── HELPER DISPLAY ───────────────────────────────────────────────────────

    formatRupiah(jumlah) {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(jumlah);
    }

    formatAngka(n) {
        return new Intl.NumberFormat("id-ID").format(Math.round(n));
    }

    labelSatuan(satuan) {
        const m = { pcs: 'Per Pcs', layer: 'Per Layer', karton: 'Per Karton' };
        return m[satuan] || satuan || '-';
    }

    formatTanggal(tgl) {
        if (!tgl) return "-";
        // Tambah waktu agar tidak terkena timezone shift
        return new Date(tgl + "T00:00:00").toLocaleDateString("id-ID", {
            day: "2-digit", month: "short", year: "numeric"
        });
    }

    formatTanggalWaktu(dt) {
        if (!dt) return "-";
        return new Date(dt.replace(" ", "T")).toLocaleDateString("id-ID", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    }

    labelUnit(unit) {
        const map = { karton: "Karton", layer: "Layer" };
        return map[unit] || unit;
    }
}

registry.category("actions").add("spk_app", SpkApp);
