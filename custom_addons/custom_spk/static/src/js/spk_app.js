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
        ];

        this.state = useState({
            // Navigasi halaman: 'daftar' | 'detail'
            halaman: 'daftar',
            spkDipilih: null,
            spkId: null,   // ID murni (number) — hindari proxy issue

            // Halaman detail — bahan baku
            daftarBahan: [],
            memuatBahan: false,
            formBahan: {
                buka: false,
                mode: 'tambah',   // 'tambah' | 'edit'
                bahanId: null,
                menyimpan: false,
                kode_barang: "",
                nama_bahan: "",
                qty: 1,
                harga: 0,
                pic_id: "",
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
                standard_price: 0,
                custom_number: "",
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
                standard_price: 0,
                custom_number: "",
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
                     "product_id", "qty", "unit", "standard_price", "custom_number"],
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
        f.standard_price = 0;
        f.custom_number = "";
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
                standard_price: parseFloat(f.standard_price),
                ...(f.custom_number ? { custom_number: f.custom_number } : {}),
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
        f.standard_price = spk.standard_price || 0;
        f.custom_number = spk.custom_number || "";
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
                standard_price: parseFloat(f.standard_price),
                custom_number: f.custom_number || false,
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
            standard_price: spk.standard_price,
        };
        this.state.halaman = 'detail';
        await this.muatMaster();
        await this.muatBahan(id);
    }

    kembaliKeDaftar() {
        this.state.halaman = 'daftar';
        this.state.spkDipilih = null;
        this.state.spkId = null;
        this.state.daftarBahan = [];
    }

    // ─── BAHAN BAKU ───────────────────────────────────────────────────────────

    async muatBahan(spkId) {
        this.state.memuatBahan = true;
        try {
            const bahan = await this.orm.searchRead(
                "spk.bahan.baku",
                [["spk_id", "=", spkId]],
                ["id", "kode_barang", "nama_bahan", "qty", "harga", "pic_id"],
                { order: "id asc" }
            );
            this.state.daftarBahan = bahan;
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
        f.qty = 1;
        f.harga = 0;
        f.pic_id = "";
    }

    bukaFormEditBahan(bahan) {
        const f = this.state.formBahan;
        f.buka = true;
        f.mode = 'edit';
        f.bahanId = bahan.id;
        f.menyimpan = false;
        f.kode_barang = bahan.kode_barang || "";
        f.nama_bahan = bahan.nama_bahan || "";
        f.qty = bahan.qty || 1;
        f.harga = bahan.harga || 0;
        f.pic_id = bahan.pic_id ? String(bahan.pic_id[0]) : "";
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
        if (parseFloat(f.qty) <= 0) {
            this.notification.add("Qty harus lebih dari 0!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            const vals = {
                nama_bahan: f.nama_bahan.trim(),
                qty: parseFloat(f.qty),
                harga: parseFloat(f.harga) || 0,
                ...(f.kode_barang ? { kode_barang: f.kode_barang.trim() } : { kode_barang: false }),
                ...(f.pic_id ? { pic_id: parseInt(f.pic_id) } : { pic_id: false }),
            };
            if (f.mode === 'tambah') {
                await this.orm.create("spk.bahan.baku", [{ spk_id: spkId, ...vals }]);
                this.notification.add("Bahan baku berhasil ditambahkan!", { type: "success" });
            } else {
                await this.orm.write("spk.bahan.baku", [f.bahanId], vals);
                this.notification.add("Bahan baku berhasil diperbarui!", { type: "success" });
            }
            this.tutupFormBahan();
            await this.muatBahan(spkId);
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

    get totalHargaBahan() {
        return this.state.daftarBahan.reduce((sum, b) => sum + (b.qty * b.harga), 0);
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

    formatTanggal(tgl) {
        if (!tgl) return "-";
        // Tambah waktu agar tidak terkena timezone shift
        return new Date(tgl + "T00:00:00").toLocaleDateString("id-ID", {
            day: "2-digit", month: "short", year: "numeric"
        });
    }

    labelUnit(unit) {
        const map = { karton: "Karton", layer: "Layer" };
        return map[unit] || unit;
    }
}

registry.category("actions").add("spk_app", SpkApp);
