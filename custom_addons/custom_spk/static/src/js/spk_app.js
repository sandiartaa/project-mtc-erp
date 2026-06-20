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
            formBahan: {
                buka: false,
                langkah: 'pilih',  // 'pilih' = picker, 'isi' = form
                mode: 'tambah',    // 'tambah' | 'edit'
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
            pickerBahan: {
                cari: "",
                halaman: 1,
                perHalaman: 10,
                daftarSemua: [],
                memuat: false,
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
                gudang_penerima: "",
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
                barang_sisa: 0,
                gudang_penerima: "",
                kategori: "",
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

            // Master data (cabang, pic, barang/produk)
            daftarCabang: [],
            daftarPic: [],
            daftarBarang: [],
            daftarBarangMaster: [],
            daftarSatuan: [],
            daftarKategori: [],
            daftarGudang: [],
            masterDimuat: false,

            // Popup Master Barang (daftar + tambah/edit/hapus)
            popupBarang: {
                buka: false,
                cari: "",
            },

            // Popup Detail Barang (klik baris barang → tampil detail + tab formulasi)
            popupBarangDetail: {
                buka: false,
                barang: null,        // salinan plain record barang yang dipilih
                tab: 'info',         // 'info' | 'formulasi'
            },
            // Formulasi milik master barang yang sedang dibuka
            daftarBarangFormulasi: [],
            memuatBarangFormulasi: false,
            formBarangFormulasi: {
                buka: false,
                mode: 'tambah',      // 'tambah' | 'edit'
                formulasiId: null,
                menyimpan: false,
                nama_bahan: "",
                qty: 1,
                satuan_hitung: 'pcs',
                keterangan: "",
            },

            // Popup kelola master generik (satuan/kategori/gudang): tambah/edit/hapus
            popupMaster: {
                buka: false,
                target: "",       // 'satuan' | 'kategori' | 'gudang'
                judul: "",
                model: "",
                editId: null,
                editNama: "",
                menyimpan: false,
                tambahAktif: false,
                tambahNama: "",
                tambahMenyimpan: false,
            },

            // Picker generik untuk dropdown di form Tambah Barang
            // (search + maks 5 + next/prev). Satu picker terbuka pada satu waktu.
            pickerField: {
                buka: false,
                target: "",       // 'satuan' | 'pic' | 'kategori' | 'gudang'
                cari: "",
                halaman: 1,
            },

            // Picker produk (dropdown cari) untuk form tambah/edit SPK.
            // Menampilkan 5 barang berurut abjad; nama SPK diambil dari barang.
            pickerBarang: {
                buka: false,
                target: "",      // 'formTambah' | 'formEdit'
                cari: "",
            },

            // Form barang (tambah/edit) ke tabel spk.barang
            formBarang: {
                buka: false,
                menyimpan: false,
                mode: 'tambah',     // 'tambah' | 'edit'
                barangId: null,
                kode: "",
                nama: "",
                harga: 0,
                satuan_id: "",
                satuan_nama: "",
                pic_id: "",
                pic_nama: "",
                kategori_id: "",
                kategori_nama: "",
                gudang_id: "",
                gudang_nama: "",
                keterangan: "",
            },

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

            // Popup peringatan SBH belum selesai (blokir tab Gaji)
            popupSbhKurang: {
                buka: false,
                daftarBahan: [],  // [{nama_bahan, kode_barang}]
            },

            // Modal riwayat (history) perubahan per SPK
            riwayat: {
                buka: false,
                memuat: false,
                spkName: "",
                daftar: [],   // [{aksi, keterangan, user_id, create_date}]
            },

            // Form tambah SPK baru
            formTambah: {
                buka: false,
                menyimpan: false,
                spk_date: new Date().toISOString().slice(0, 10),
                branch_id: "",
                pic_id: "",
                barang_id: "",
                barang_nama: "",
                qty: 1,
                unit: "",
                layer_per_karton: 1,
                pcs_per_layer: 1,
                harga_satuan: 0,
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
                spk_date: "",
                branch_id: "",
                pic_id: "",
                barang_id: "",
                barang_nama: "",
                qty: 1,
                unit: "",
                layer_per_karton: 1,
                pcs_per_layer: 1,
                harga_satuan: 0,
                standard_price: 0,
                harga_standar_custom: false,
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
            const [cabang, pic, barang, satuan, kategori, gudang] = await Promise.all([
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
                    "spk.barang",
                    [["active", "=", true]],
                    ["id", "name", "satuan_id", "harga"],
                    { limit: 0, order: "name asc" }
                ),
                this.orm.searchRead(
                    "spk.satuan",
                    [["active", "=", true]],
                    ["id", "name"],
                    { order: "name asc" }
                ),
                this.orm.searchRead(
                    "spk.kategori",
                    [["active", "=", true]],
                    ["id", "name"],
                    { order: "name asc" }
                ),
                this.orm.searchRead(
                    "spk.gudang",
                    [["active", "=", true]],
                    ["id", "name"],
                    { order: "name asc" }
                ),
            ]);
            this.state.daftarCabang = cabang;
            this.state.daftarPic = pic;
            this.state.daftarBarang = barang;
            this.state.daftarSatuan = satuan;
            this.state.daftarKategori = kategori;
            this.state.daftarGudang = gudang;
            this.state.masterDimuat = true;
        } catch (e) {
            console.error("Gagal memuat master data:", e);
        }
    }

    // Muat ulang daftar barang (dipakai setelah menambah barang baru)
    async muatBarang() {
        try {
            this.state.daftarBarang = await this.orm.searchRead(
                "spk.barang",
                [["active", "=", true]],
                ["id", "name", "satuan_id", "harga"],
                { limit: 0, order: "name asc" }
            );
        } catch (e) {
            console.error("Gagal memuat barang:", e);
        }
    }

    // Info master per target (model + judul + nama state list)
    _masterInfo(target) {
        return {
            satuan: { model: "spk.satuan", judul: "Satuan", daftar: "daftarSatuan" },
            kategori: { model: "spk.kategori", judul: "Kategori", daftar: "daftarKategori" },
            gudang: { model: "spk.gudang", judul: "Gudang", daftar: "daftarGudang" },
        }[target];
    }

    // Muat ulang satu daftar master
    async muatMasterList(target) {
        const info = this._masterInfo(target);
        try {
            this.state[info.daftar] = await this.orm.searchRead(
                info.model, [["active", "=", true]], ["id", "name"], { order: "name asc" }
            );
        } catch (e) {
            console.error("Gagal memuat " + target + ":", e);
        }
    }

    // Daftar master yang sedang dikelola di popup
    get popupMasterDaftar() {
        const info = this._masterInfo(this.state.popupMaster.target);
        return info ? (this.state[info.daftar] || []) : [];
    }

    // ─── POPUP KELOLA MASTER GENERIK (satuan/kategori/gudang) ─────────────────
    async bukaPopupMaster(target) {
        const info = this._masterInfo(target);
        await this.muatMasterList(target);
        const p = this.state.popupMaster;
        p.buka = true;
        p.target = target;
        p.judul = info.judul;
        p.model = info.model;
        p.editId = null;
        p.editNama = "";
        p.tambahAktif = false;
        p.tambahNama = "";
    }

    tutupPopupMaster() {
        const p = this.state.popupMaster;
        p.buka = false;
        p.editId = null;
        p.editNama = "";
        p.tambahAktif = false;
        p.tambahNama = "";
    }

    async tambahMasterDariPopup() {
        const p = this.state.popupMaster;
        const nama = p.tambahNama.trim();
        if (!nama) {
            this.notification.add("Nama " + p.judul.toLowerCase() + " tidak boleh kosong!", { type: "warning" });
            return;
        }
        p.tambahMenyimpan = true;
        try {
            await this.orm.create(p.model, [{ name: nama }]);
            await this.muatMasterList(p.target);
            p.tambahAktif = false;
            p.tambahNama = "";
            this.notification.add(p.judul + " \"" + nama + "\" berhasil ditambahkan!", { type: "success" });
        } catch (e) {
            console.error("Gagal tambah master:", e);
            this.notification.add("Gagal menambahkan. Coba lagi.", { type: "danger" });
        }
        p.tambahMenyimpan = false;
    }

    mulaiEditMaster(item) {
        this.state.popupMaster.editId = item.id;
        this.state.popupMaster.editNama = item.name;
    }

    batalEditMaster() {
        this.state.popupMaster.editId = null;
        this.state.popupMaster.editNama = "";
    }

    async simpanEditMaster() {
        const p = this.state.popupMaster;
        const nama = p.editNama.trim();
        if (!nama) {
            this.notification.add("Nama " + p.judul.toLowerCase() + " tidak boleh kosong!", { type: "warning" });
            return;
        }
        p.menyimpan = true;
        try {
            await this.orm.write(p.model, [p.editId], { name: nama });
            await this.muatMasterList(p.target);
            this.batalEditMaster();
            this.notification.add("Nama " + p.judul.toLowerCase() + " berhasil diperbarui!", { type: "success" });
        } catch (e) {
            console.error("Gagal edit master:", e);
            this.notification.add("Gagal memperbarui. Coba lagi.", { type: "danger" });
        }
        p.menyimpan = false;
    }

    hapusMaster(item) {
        const p = this.state.popupMaster;
        this.tampilKonfirmasi({
            judul: "Hapus " + p.judul,
            pesan: "Apakah Anda yakin ingin menghapus " + p.judul.toLowerCase() + " <b>" + item.name + "</b>?",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusMaster(item),
        });
    }

    async lakukanHapusMaster(item) {
        const p = this.state.popupMaster;
        const target = p.target;
        try {
            await this.orm.unlink(p.model, [item.id]);
            await this.muatMasterList(target);
            // Bersihkan pilihan di form bila nilai yang dipakai dihapus
            if (this.state.formBarang[target + "_id"] === String(item.id)) {
                this.state.formBarang[target + "_id"] = "";
                this.state.formBarang[target + "_nama"] = "";
            }
            this.notification.add(p.judul + " berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus master:", e);
            this.notification.add("Gagal menghapus. Data mungkin masih digunakan.", { type: "danger" });
        }
    }

    // ─── PICKER FIELD GENERIK (form Tambah Barang) ───────────────────────────
    // Sumber data untuk picker yang sedang terbuka
    get _pickerFieldSource() {
        const map = {
            satuan: "daftarSatuan", pic: "daftarPic",
            kategori: "daftarKategori", gudang: "daftarGudang",
        };
        return this.state[map[this.state.pickerField.target]] || [];
    }

    // Hasil filter sesuai kata kunci (untuk hitung total halaman)
    get pickerFieldTersaring() {
        const cari = (this.state.pickerField.cari || "").trim().toLowerCase();
        const src = this._pickerFieldSource;
        return cari ? src.filter(x => (x.name || "").toLowerCase().includes(cari)) : src;
    }

    // Maksimal 5 item pada halaman aktif
    get pickerFieldHalaman() {
        const mulai = (this.state.pickerField.halaman - 1) * 5;
        return this.pickerFieldTersaring.slice(mulai, mulai + 5);
    }

    get pickerFieldTotalHalaman() {
        return Math.max(1, Math.ceil(this.pickerFieldTersaring.length / 5));
    }

    bukaPickerField(target) {
        const p = this.state.pickerField;
        if (p.buka && p.target === target) {
            p.buka = false;
            return;
        }
        p.buka = true;
        p.target = target;
        p.cari = "";
        p.halaman = 1;
    }

    tutupPickerField() {
        this.state.pickerField.buka = false;
    }

    pickerFieldInput(ev) {
        this.state.pickerField.cari = ev.target.value;
        this.state.pickerField.halaman = 1;
    }

    pickerFieldNext() {
        const p = this.state.pickerField;
        if (p.halaman < this.pickerFieldTotalHalaman) p.halaman++;
    }

    pickerFieldPrev() {
        const p = this.state.pickerField;
        if (p.halaman > 1) p.halaman--;
    }

    // Label terpilih untuk ditampilkan di input picker
    pickerNama(target) {
        return this.state.formBarang[target + "_nama"] || "";
    }

    pilihField(item) {
        const t = this.state.pickerField.target;
        this.state.formBarang[t + "_id"] = String(item.id);
        this.state.formBarang[t + "_nama"] = item.name || "";
        this.tutupPickerField();
    }

    // ─── PICKER PRODUK (NAMA SPK) ────────────────────────────────────────────
    // Buka/tutup dropdown pilih produk untuk form tertentu ('formTambah'|'formEdit')
    bukaPickerBarang(target) {
        const p = this.state.pickerBarang;
        if (p.buka && p.target === target) {
            p.buka = false;
            return;
        }
        p.buka = true;
        p.target = target;
        p.cari = "";
    }

    tutupPickerBarang() {
        this.state.pickerBarang.buka = false;
    }

    pickerBarangInput(ev) {
        this.state.pickerBarang.cari = ev.target.value;
    }

    // 5 barang teratas (berurut abjad) sesuai kata kunci pencarian
    get pickerBarangTerfilter() {
        const cari = (this.state.pickerBarang.cari || "").trim().toLowerCase();
        const hasil = cari
            ? this.state.daftarBarang.filter(b =>
                (b.name || "").toLowerCase().includes(cari))
            : this.state.daftarBarang;
        return hasil.slice(0, 5);
    }

    // Pilih barang dari picker → set ke form target sebagai nama SPK
    pilihBarang(item, target) {
        const f = this.state[target];
        f.barang_id = String(item.id);
        f.barang_nama = item.name || "";
        // Satuan SPK otomatis mengikuti satuan produk yang dipilih
        // (cocokkan nama satuan produk dengan pilihan unit karton/layer/pcs).
        const satuanNama = item.satuan_id ? (item.satuan_id[1] || "") : "";
        const cocok = this.unitPilihan.find(
            u => u.label.toLowerCase() === satuanNama.trim().toLowerCase()
        );
        if (cocok) {
            f.unit = cocok.value;
        }
        // Harga per satuan otomatis mengikuti harga produk yang dipilih
        f.harga_satuan = item.harga || 0;
        this.tutupPickerBarang();
    }

    // ─── MASTER BARANG (popup daftar + CRUD) ─────────────────────────────────
    async bukaPopupBarang() {
        await this.muatMaster();   // pastikan satuan/pic/kategori/gudang siap untuk form
        this.state.popupBarang.buka = true;
        this.state.popupBarang.cari = "";
        await this.muatBarangMaster();
    }

    tutupPopupBarang() {
        this.state.popupBarang.buka = false;
    }

    // Muat daftar barang lengkap (untuk tabel master)
    async muatBarangMaster() {
        try {
            this.state.daftarBarangMaster = await this.orm.searchRead(
                "spk.barang",
                [["active", "=", true]],
                ["id", "name", "kode", "harga", "satuan_id", "pic_id", "kategori_id", "gudang_id", "keterangan", "formulasi_count"],
                { order: "name asc", limit: 0 }
            );
        } catch (e) {
            console.error("Gagal memuat master barang:", e);
        }
    }

    get barangMasterTersaring() {
        const cari = (this.state.popupBarang.cari || "").trim().toLowerCase();
        const src = this.state.daftarBarangMaster;
        if (!cari) return src;
        return src.filter(b =>
            (b.name || "").toLowerCase().includes(cari) ||
            (b.kode || "").toLowerCase().includes(cari)
        );
    }

    // ─── FORM BARANG (tambah/edit) ───────────────────────────────────────────
    bukaFormBarang() {
        const f = this.state.formBarang;
        f.buka = true;
        f.menyimpan = false;
        f.mode = 'tambah';
        f.barangId = null;
        f.kode = "";
        f.nama = "";
        f.harga = 0;
        f.satuan_id = "";
        f.satuan_nama = "";
        f.pic_id = "";
        f.pic_nama = "";
        f.kategori_id = "";
        f.kategori_nama = "";
        f.gudang_id = "";
        f.gudang_nama = "";
        f.keterangan = "";
        this.tutupPickerField();
    }

    bukaFormEditBarang(b) {
        const f = this.state.formBarang;
        f.buka = true;
        f.menyimpan = false;
        f.mode = 'edit';
        f.barangId = b.id;
        f.kode = b.kode || "";
        f.nama = b.name || "";
        f.harga = b.harga || 0;
        f.satuan_id = b.satuan_id ? String(b.satuan_id[0]) : "";
        f.satuan_nama = b.satuan_id ? b.satuan_id[1] : "";
        f.pic_id = b.pic_id ? String(b.pic_id[0]) : "";
        f.pic_nama = b.pic_id ? b.pic_id[1] : "";
        f.kategori_id = b.kategori_id ? String(b.kategori_id[0]) : "";
        f.kategori_nama = b.kategori_id ? b.kategori_id[1] : "";
        f.gudang_id = b.gudang_id ? String(b.gudang_id[0]) : "";
        f.gudang_nama = b.gudang_id ? b.gudang_id[1] : "";
        f.keterangan = b.keterangan || "";
        this.tutupPickerField();
    }

    tutupFormBarang() {
        this.state.formBarang.buka = false;
        this.tutupPickerField();
    }

    // Enter di input nama barang = langsung simpan
    keydownBarang(ev) {
        if (ev.key === 'Enter') this.simpanBarang();
    }

    async simpanBarang() {
        const f = this.state.formBarang;
        const nama = f.nama.trim();
        if (!nama) {
            this.notification.add("Nama barang tidak boleh kosong!", { type: "warning" });
            return;
        }
        f.menyimpan = true;
        try {
            // Pakai false untuk mengosongkan nilai (penting saat edit menghapus pilihan)
            const vals = {
                name: nama,
                kode: f.kode ? f.kode.trim() : false,
                harga: parseFloat(f.harga) || 0,
                satuan_id: f.satuan_id ? parseInt(f.satuan_id) : false,
                pic_id: f.pic_id ? parseInt(f.pic_id) : false,
                kategori_id: f.kategori_id ? parseInt(f.kategori_id) : false,
                gudang_id: f.gudang_id ? parseInt(f.gudang_id) : false,
                keterangan: f.keterangan ? f.keterangan.trim() : false,
            };
            if (f.mode === 'edit') {
                await this.orm.write("spk.barang", [f.barangId], vals);
                this.notification.add("Barang \"" + nama + "\" berhasil diperbarui!", { type: "success" });
            } else {
                await this.orm.create("spk.barang", [vals]);
                this.notification.add("Barang \"" + nama + "\" berhasil ditambahkan!", { type: "success" });
            }
            await Promise.all([this.muatBarang(), this.muatBarangMaster()]);
            this.tutupFormBarang();
        } catch (e) {
            console.error("Gagal simpan barang:", e);
            this.notification.add("Gagal menyimpan barang. Coba lagi.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    konfirmasiDuplikatBarang(b) {
        this.tampilKonfirmasi({
            judul: "Duplikat Barang",
            pesan: "Duplikat barang <b>" + b.name + "</b> menjadi salinan baru?",
            labelYa: "Ya, Duplikat",
            warnaYa: "biru",
            aksi: () => this.lakukanDuplikatBarang(b),
        });
    }

    async lakukanDuplikatBarang(b) {
        try {
            await this.orm.call(
                "spk.barang", "copy", [[b.id]],
                { default: { name: (b.name || "") + " (copy)" } }
            );
            await Promise.all([this.muatBarang(), this.muatBarangMaster()]);
            this.notification.add("Barang berhasil diduplikat.", { type: "success" });
        } catch (e) {
            console.error("Gagal duplikat barang:", e);
            this.notification.add("Gagal menduplikat barang. Coba lagi.", { type: "danger" });
        }
    }

    konfirmasiHapusBarang(b) {
        this.tampilKonfirmasi({
            judul: "Hapus Barang",
            pesan: "Apakah Anda yakin ingin menghapus barang <b>" + b.name + "</b>?",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusBarang(b),
        });
    }

    async lakukanHapusBarang(b) {
        try {
            await this.orm.unlink("spk.barang", [b.id]);
            await Promise.all([this.muatBarang(), this.muatBarangMaster()]);
            this.notification.add("Barang berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus barang:", e);
            this.notification.add("Gagal menghapus. Barang mungkin masih dipakai SPK.", { type: "danger" });
        }
    }

    // ─── DETAIL BARANG + FORMULASI PER BARANG ────────────────────────────────
    // Klik satu baris barang di Master Barang → buka modal detail (info + formulasi)
    async bukaDetailBarang(b) {
        const d = this.state.popupBarangDetail;
        d.buka = true;
        d.tab = 'info';
        // Salinan plain (hindari proxy nested) — cukup untuk ditampilkan
        d.barang = {
            id: b.id,
            name: b.name,
            kode: b.kode,
            harga: b.harga,
            satuan_id: b.satuan_id,
            pic_id: b.pic_id,
            kategori_id: b.kategori_id,
            gudang_id: b.gudang_id,
            keterangan: b.keterangan,
        };
        await this.muatBarangFormulasi(b.id);
    }

    tutupDetailBarang() {
        const d = this.state.popupBarangDetail;
        d.buka = false;
        d.barang = null;
        this.state.daftarBarangFormulasi = [];
        this.tutupFormBarangFormulasi();
    }

    pindahTabBarang(tab) {
        this.state.popupBarangDetail.tab = tab;
    }

    async muatBarangFormulasi(barangId) {
        if (!barangId) return;
        this.state.memuatBarangFormulasi = true;
        try {
            this.state.daftarBarangFormulasi = await this.orm.searchRead(
                "spk.barang.formulasi",
                [["barang_id", "=", barangId]],
                ["id", "nama_bahan", "qty", "satuan_hitung", "keterangan"],
                { order: "id asc" }
            );
        } catch (e) {
            console.error("Gagal memuat formulasi barang:", e);
            this.notification.add("Gagal memuat formulasi barang.", { type: "danger" });
        }
        this.state.memuatBarangFormulasi = false;
    }

    bukaFormBarangFormulasi() {
        const f = this.state.formBarangFormulasi;
        f.buka = true;
        f.mode = 'tambah';
        f.formulasiId = null;
        f.menyimpan = false;
        f.nama_bahan = "";
        f.qty = 1;
        f.satuan_hitung = 'pcs';
        f.keterangan = "";
    }

    bukaFormEditBarangFormulasi(formula) {
        const f = this.state.formBarangFormulasi;
        f.buka = true;
        f.mode = 'edit';
        f.formulasiId = formula.id;
        f.menyimpan = false;
        f.nama_bahan = formula.nama_bahan || "";
        f.qty = formula.qty || 1;
        f.satuan_hitung = formula.satuan_hitung || 'pcs';
        f.keterangan = formula.keterangan || "";
    }

    tutupFormBarangFormulasi() {
        this.state.formBarangFormulasi.buka = false;
    }

    async simpanBarangFormulasi() {
        const f = this.state.formBarangFormulasi;
        const barangId = this.state.popupBarangDetail.barang
            ? this.state.popupBarangDetail.barang.id : null;
        if (!barangId) return;
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
                keterangan: f.keterangan ? f.keterangan.trim() : false,
            };
            if (f.mode === 'tambah') {
                await this.orm.create("spk.barang.formulasi", [{ barang_id: barangId, ...vals }]);
                this.notification.add("Formulasi berhasil ditambahkan!", { type: "success" });
            } else {
                await this.orm.write("spk.barang.formulasi", [f.formulasiId], vals);
                this.notification.add("Formulasi berhasil diperbarui!", { type: "success" });
            }
            this.tutupFormBarangFormulasi();
            // Muat ulang daftar formulasi + tabel master (agar badge jumlah ikut update)
            await Promise.all([
                this.muatBarangFormulasi(barangId),
                this.muatBarangMaster(),
            ]);
        } catch (e) {
            console.error("Gagal simpan formulasi barang:", e);
            this.notification.add("Gagal menyimpan formulasi. Pastikan nama bahan belum ada.", { type: "danger" });
        }
        f.menyimpan = false;
    }

    konfirmasiHapusBarangFormulasi(formula) {
        this.tampilKonfirmasi({
            judul: "Hapus Formulasi",
            pesan: "Hapus formulasi <b>" + formula.nama_bahan + "</b> dari barang ini?",
            labelYa: "Ya, Hapus",
            warnaYa: "merah",
            aksi: () => this.lakukanHapusBarangFormulasi(formula),
        });
    }

    async lakukanHapusBarangFormulasi(formula) {
        const barangId = this.state.popupBarangDetail.barang
            ? this.state.popupBarangDetail.barang.id : null;
        try {
            await this.orm.unlink("spk.barang.formulasi", [formula.id]);
            await Promise.all([
                this.muatBarangFormulasi(barangId),
                this.muatBarangMaster(),
            ]);
            this.notification.add("Formulasi berhasil dihapus.", { type: "success" });
        } catch (e) {
            console.error("Gagal hapus formulasi barang:", e);
            this.notification.add("Gagal menghapus formulasi.", { type: "danger" });
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
                ['barang_id.name', 'ilike', f.cari],
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
                    ["id", "name", "spk_date", "branch_id", "pic_id",
                     "barang_id", "qty", "unit", "layer_per_karton", "pcs_per_layer",
                     "harga_satuan", "harga_total",
                     "standard_price", "is_harga_standar_custom", "custom_number", "status", "tgl_selesai",
                     "create_uid", "create_date", "write_uid", "write_date"],
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
        f.barang_id = "";
        f.barang_nama = "";
        f.qty = 1;
        f.unit = "";
        f.layer_per_karton = 1;
        f.pcs_per_layer = 1;
        f.harga_satuan = 0;
        f.standard_price = 0;
        f.custom_number = "";
        f.status = "open";
        f.tgl_selesai = "";
        this.tutupPickerBarang();
    }

    tutupFormTambah() {
        this.state.formTambah.buka = false;
        this.tutupPickerBarang();
    }

    async simpanSpk() {
        const f = this.state.formTambah;
        if (!f.barang_id) { this.notification.add("Pilih Produk terlebih dahulu!", { type: "warning" }); return; }
        if (!f.pic_id)     { this.notification.add("Pilih PIC terlebih dahulu!", { type: "warning" }); return; }
        if (!f.unit)       { this.notification.add("Satuan otomatis dari produk. Produk yang dipilih belum punya satuan Karton/Layer/Pcs — atur satuan produk dulu di Master Barang.", { type: "warning" }); return; }
        if (parseFloat(f.qty) <= 0) {
            this.notification.add("Jumlah (Qty) harus lebih dari 0!", { type: "warning" }); return;
        }

        f.menyimpan = true;
        try {
            await this.orm.create("spk.spk", [{
                spk_date: f.spk_date,
                ...(f.branch_id ? { branch_id: parseInt(f.branch_id) } : {}),
                pic_id: parseInt(f.pic_id),
                barang_id: parseInt(f.barang_id),
                qty: parseFloat(f.qty),
                unit: f.unit,
                layer_per_karton: parseInt(f.layer_per_karton) || 1,
                pcs_per_layer: parseInt(f.pcs_per_layer) || 1,
                harga_satuan: parseFloat(f.harga_satuan) || 0,
                // Harga standar mulai 0 & otomatis (dihitung dari total bahan baku)
                standard_price: 0,
                is_harga_standar_custom: false,
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
        f.spk_date = spk.spk_date || new Date().toISOString().slice(0, 10);
        f.branch_id = spk.branch_id ? String(spk.branch_id[0]) : "";
        f.pic_id = spk.pic_id ? String(spk.pic_id[0]) : "";
        f.barang_id = spk.barang_id ? String(spk.barang_id[0]) : "";
        f.barang_nama = spk.barang_id ? spk.barang_id[1] : "";
        f.qty = spk.qty || 1;
        f.unit = spk.unit || "";
        f.layer_per_karton = spk.layer_per_karton || 1;
        f.pcs_per_layer = spk.pcs_per_layer || 1;
        f.harga_satuan = spk.harga_satuan || 0;
        f.standard_price = spk.standard_price || 0;
        f.harga_standar_custom = spk.is_harga_standar_custom || false;
        f.custom_number = spk.custom_number || "";
        f.status = spk.status || "open";
        f.tgl_selesai = spk.tgl_selesai || "";
    }

    tutupFormEdit() {
        this.state.formEdit.buka = false;
        this.tutupPickerBarang();
    }

    async simpanEdit() {
        const f = this.state.formEdit;
        if (!f.barang_id) { this.notification.add("Pilih Produk terlebih dahulu!", { type: "warning" }); return; }
        if (!f.pic_id)     { this.notification.add("Pilih PIC terlebih dahulu!", { type: "warning" }); return; }
        if (!f.unit)       { this.notification.add("Pilih Satuan terlebih dahulu!", { type: "warning" }); return; }
        if (parseFloat(f.qty) <= 0) {
            this.notification.add("Jumlah (Qty) harus lebih dari 0!", { type: "warning" }); return;
        }

        f.menyimpan = true;
        try {
            await this.orm.write("spk.spk", [f.spkId], {
                spk_date: f.spk_date,
                branch_id: f.branch_id ? parseInt(f.branch_id) : false,
                pic_id: parseInt(f.pic_id),
                barang_id: parseInt(f.barang_id),
                qty: parseFloat(f.qty),
                unit: f.unit,
                layer_per_karton: parseInt(f.layer_per_karton) || 1,
                pcs_per_layer: parseInt(f.pcs_per_layer) || 1,
                harga_satuan: parseFloat(f.harga_satuan) || 0,
                // Harga standar: tulis nilai manual hanya bila di-custom.
                // Bila tidak custom, harga standar disinkronkan otomatis dari total bahan.
                is_harga_standar_custom: f.harga_standar_custom,
                ...(f.harga_standar_custom
                    ? { standard_price: parseFloat(f.standard_price) || 0 }
                    : {}),
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
        this.state.daftarHpr = [];
        this.state.daftarSbh = [];
        this.state.spkDipilih = {
            id,
            name: spk.name,
            spk_date: spk.spk_date,
            custom_number: spk.custom_number,
            branch_id: spk.branch_id,
            pic_id: spk.pic_id,
            barang_id: spk.barang_id,
            qty: spk.qty,
            unit: spk.unit,
            layer_per_karton: spk.layer_per_karton || 1,
            pcs_per_layer: spk.pcs_per_layer || 1,
            harga_satuan: spk.harga_satuan || 0,
            harga_total: spk.harga_total || 0,
            standard_price: spk.standard_price,
            is_harga_standar_custom: spk.is_harga_standar_custom || false,
            status: spk.status,
            tgl_selesai: spk.tgl_selesai,
            create_uid: spk.create_uid,
            create_date: spk.create_date,
            write_uid: spk.write_uid,
            write_date: spk.write_date,
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
        this.state.daftarHpr = [];
        this.state.daftarSbh = [];
        this.state.tabDetail = 'bahan';
    }

    // ─── RIWAYAT (HISTORY) SPK ───────────────────────────────────────────────

    async bukaRiwayat(spk) {
        const r = this.state.riwayat;
        r.buka = true;
        r.memuat = true;
        r.spkName = spk.name;
        r.daftar = [];
        try {
            r.daftar = await this.orm.searchRead(
                "spk.riwayat",
                [["spk_id", "=", spk.id]],
                ["aksi", "keterangan", "user_id", "create_date"],
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

    // ─── BAHAN BAKU ───────────────────────────────────────────────────────────

    async muatBahan(spkId) {
        this.state.memuatBahan = true;
        try {
            const [bahan] = await Promise.all([
                this.orm.searchRead(
                    "spk.bahan.baku",
                    [["spk_id", "=", spkId]],
                    ["id", "kode_barang", "nama_bahan", "qty", "is_qty_custom", "harga", "pic_id", "gudang_asal", "keterangan"],
                    { order: "id asc" }
                ),
            ]);
            this.state.daftarBahan = bahan;
        } catch (e) {
            console.error("Gagal memuat bahan baku:", e);
            this.notification.add("Gagal memuat bahan baku.", { type: "danger" });
        }
        this.state.memuatBahan = false;
        // Harga standar otomatis menyesuaikan total bahan baku (kecuali di-custom)
        await this.syncHargaStandar();
    }

    async bukaFormBahan() {
        const f = this.state.formBahan;
        f.buka = true;
        f.langkah = 'pilih';
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
        // Reset picker
        const p = this.state.pickerBahan;
        p.cari = "";
        p.halaman = 1;
        await this.muatSemuaBahanPicker();
    }

    async muatSemuaBahanPicker() {
        const p = this.state.pickerBahan;
        p.memuat = true;
        try {
            const semua = await this.orm.searchRead(
                'spk.bahan.baku',
                [],
                ['kode_barang', 'nama_bahan', 'harga', 'pic_id', 'gudang_asal', 'keterangan'],
                { order: 'nama_bahan asc', limit: 0 }
            );
            // Deduplikasi berdasarkan nama_bahan (ambil data paling lengkap)
            const map = new Map();
            for (const b of semua) {
                const key = (b.nama_bahan || "").trim().toLowerCase();
                if (!key) continue;
                if (!map.has(key) || b.harga > 0) map.set(key, b);
            }
            p.daftarSemua = Array.from(map.values()).sort((a, b) =>
                (a.nama_bahan || "").localeCompare(b.nama_bahan || "")
            );
        } catch (e) {
            console.error("Gagal memuat daftar bahan:", e);
        } finally {
            p.memuat = false;
        }
    }

    get pickerBahanTerfilter() {
        const p = this.state.pickerBahan;
        const cari = (p.cari || "").trim().toLowerCase();
        const hasil = cari
            ? p.daftarSemua.filter(b =>
                (b.nama_bahan || "").toLowerCase().includes(cari) ||
                (b.kode_barang || "").toLowerCase().includes(cari)
              )
            : p.daftarSemua;
        const mulai = (p.halaman - 1) * p.perHalaman;
        return hasil.slice(mulai, mulai + p.perHalaman);
    }

    get pickerTotalHalaman() {
        const p = this.state.pickerBahan;
        const cari = (p.cari || "").trim().toLowerCase();
        const total = cari
            ? p.daftarSemua.filter(b =>
                (b.nama_bahan || "").toLowerCase().includes(cari) ||
                (b.kode_barang || "").toLowerCase().includes(cari)
              ).length
            : p.daftarSemua.length;
        return Math.max(1, Math.ceil(total / p.perHalaman));
    }

    pickerCariInput(ev) {
        this.state.pickerBahan.cari = ev.target.value;
        this.state.pickerBahan.halaman = 1;
    }

    pickerHalamanBerikut() {
        const p = this.state.pickerBahan;
        if (p.halaman < this.pickerTotalHalaman) p.halaman++;
    }

    pickerHalamanSebelum() {
        const p = this.state.pickerBahan;
        if (p.halaman > 1) p.halaman--;
    }

    pilihBahanDariPicker(item) {
        const f = this.state.formBahan;
        f.kode_barang = item.kode_barang || "";
        f.nama_bahan = item.nama_bahan || "";
        f.harga = item.harga || 0;
        f.pic_id = item.pic_id ? String(item.pic_id[0]) : "";
        f.gudang_asal = item.gudang_asal || "";
        f.keterangan = item.keterangan || "";
        f.langkah = 'isi';
    }

    buatBahanBaruPicker() {
        this.state.formBahan.langkah = 'isi';
    }

    bukaFormEditBahan(bahan) {
        const f = this.state.formBahan;
        f.buka = true;
        f.langkah = 'isi';
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

    get totalHargaBahan() {
        return this.state.daftarBahan.reduce((sum, b) => {
            const keb = this.qtyEfektifBahan(b);
            const qty = keb !== null ? keb : (b.qty || 0);
            return sum + (qty * (b.harga || 0));
        }, 0);
    }

    // Sinkronkan Harga Standar SPK = total harga bahan baku.
    // Tidak dilakukan bila user sudah meng-custom harga standarnya.
    async syncHargaStandar() {
        const s = this.state.spkDipilih;
        if (!s || s.is_harga_standar_custom) return;
        const total = Math.round(this.totalHargaBahan || 0);
        if (Math.round(s.standard_price || 0) === total) return;  // sudah sama
        s.standard_price = total;
        try {
            // skip_riwayat: perubahan otomatis tidak dicatat sebagai edit manual
            await this.orm.write(
                "spk.spk", [this.state.spkId], { standard_price: total },
                { context: { skip_riwayat: true } }
            );
        } catch (e) {
            console.error("Gagal sinkron harga standar:", e);
        }
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

    // Harga total = harga per satuan x qty (live, untuk preview di form)
    get formTambahHargaTotal() {
        const f = this.state.formTambah;
        return (parseFloat(f.harga_satuan) || 0) * (parseFloat(f.qty) || 0);
    }

    get formEditHargaTotal() {
        const f = this.state.formEdit;
        return (parseFloat(f.harga_satuan) || 0) * (parseFloat(f.qty) || 0);
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

    // True jika ada bahan yang belum punya entri SBH — dipakai untuk warna tab Gaji
    get adaSbhBelumLengkap() {
        return this.cekSbhBelumLengkap().length > 0;
    }

    // Kembalikan daftar bahan yang belum memiliki data SBH sama sekali
    cekSbhBelumLengkap() {
        return this.state.daftarBahan
            .filter(b => !this.getSbhForBahan(b.id))
            .map(b => ({ nama_bahan: b.nama_bahan, kode_barang: b.kode_barang || '-' }));
    }

    tutupPopupSbhKurang() {
        this.state.popupSbhKurang.buka = false;
        this.state.popupSbhKurang.daftarBahan = [];
    }

    pindahTab(tab) {
        if (tab === 'gaji') {
            const sbhKurang = this.cekSbhBelumLengkap();
            if (sbhKurang.length > 0) {
                this.state.popupSbhKurang.daftarBahan = sbhKurang;
                this.state.popupSbhKurang.buka = true;
                return;
            }
        }
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
        // Formulasi memengaruhi qty efektif → harga standar disinkronkan ulang
        await this.syncHargaStandar();
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
                ["id", "tanggal_kirim", "hasil_produksi", "gudang_penerima"],
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
        f.gudang_penerima = "";
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
        f.gudang_penerima = entry.gudang_penerima || "";
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
                gudang_penerima: f.gudang_penerima ? f.gudang_penerima.trim() : false,
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
                ["id", "bahan_id", "barang_sisa", "gudang_penerima", "kategori"],
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

    // Barang sisa = jumlah barang kembali (gabungan bagus + rusak) yang diinput user
    barangSisaSbh(bahan) {
        const sbh = this.getSbhForBahan(bahan.id);
        return sbh ? (sbh.barang_sisa || 0) : 0;
    }

    // Sisa = Qty SPK − Total Kembali (porsi yang seharusnya jadi barang sisa/hilang)
    sisaSbh(bahan) {
        const qtySpk = this.qtyEfektifBahan(bahan);
        const total = this.totalKembaliSbh(bahan);
        if (qtySpk === null || total === null) return null;
        return qtySpk - total;
    }

    // Barang hilang = sisa − barang sisa (otomatis)
    barangHilangSbh(bahan) {
        const sisa = this.sisaSbh(bahan);
        if (sisa === null) return null;
        return sisa - this.barangSisaSbh(bahan);
    }

    // Stock akhir = barang sisa + Total Kembali (HPR) − Qty SPK (PBH)
    stockAkhirSbh(bahan) {
        const qtySpk = this.qtyEfektifBahan(bahan);
        const totalKembali = this.totalKembaliSbh(bahan);
        if (qtySpk === null || totalKembali === null) return null;
        return this.barangSisaSbh(bahan) + totalKembali - qtySpk;
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

    // ─── KATEGORI & PENGGABUNGAN BAHAN SBH ───────────────────────────────────
    // Kategori bahan diambil dari entri SBH (text manual). "" jika belum diisi.
    kategoriBahan(bahan) {
        const sbh = this.getSbhForBahan(bahan.id);
        return (sbh && sbh.kategori) ? sbh.kategori.trim() : "";
    }

    // Anggota satu kategori = semua bahan dengan kategori (trim) yang sama
    anggotaKategori(kategori) {
        return this.state.daftarBahan.filter(b => this.kategoriBahan(b) === kategori);
    }

    // Penjumlahan nilai untuk sekumpulan bahan (baris gabungan kategori)
    qtySpkGabungan(anggota) {
        return anggota.reduce((s, b) => { const q = this.qtyEfektifBahan(b); return s + (q !== null ? q : 0); }, 0);
    }
    totalKembaliGabungan(anggota) {
        return anggota.reduce((s, b) => { const t = this.totalKembaliSbh(b); return s + (t !== null ? t : 0); }, 0);
    }
    barangSisaGabungan(anggota) {
        return anggota.reduce((s, b) => s + this.barangSisaSbh(b), 0);
    }
    // Hilang gabungan = (Qty SPK − Total Kembali) − Barang Sisa (semua dijumlah dulu)
    hilangGabungan(anggota) {
        return (this.qtySpkGabungan(anggota) - this.totalKembaliGabungan(anggota)) - this.barangSisaGabungan(anggota);
    }
    stockAkhirGabungan(anggota) {
        return this.barangSisaGabungan(anggota) + this.totalKembaliGabungan(anggota) - this.qtySpkGabungan(anggota);
    }
    // Harga+30% gabungan: pakai harga anggota pertama (beda warna dianggap sama harga)
    harga130Gabungan(anggota) {
        return anggota.length ? this.harga130Bahan(anggota[0]) : 0;
    }
    totalHargaGabungan(anggota) {
        return this.hilangGabungan(anggota) * this.harga130Gabungan(anggota);
    }

    // Baris yang dirender di tabel SBH: tiap bahan + 1 baris gabungan per kategori
    // (baris gabungan muncul tepat setelah anggota terakhir kategori tsb).
    get sbhRows() {
        const arr = this.state.daftarBahan;
        const lastIdx = {};
        arr.forEach((b, i) => {
            const k = this.kategoriBahan(b);
            if (k) lastIdx[k] = i;
        });
        const rows = [];
        arr.forEach((b, i) => {
            const k = this.kategoriBahan(b);
            rows.push({ tipe: 'bahan', bahan: b, kategori: k });
            if (k && lastIdx[k] === i) {
                rows.push({ tipe: 'gabungan', kategori: k, anggota: this.anggotaKategori(k) });
            }
        });
        return rows;
    }

    // "Unit" perhitungan untuk Ket & gaji: bahan ber-kategori digabung jadi 1 unit,
    // bahan tanpa kategori jadi unit sendiri. Hanya bahan yang sudah ada entri SBH.
    get unitSbhList() {
        const arr = this.state.daftarBahan;
        const units = [];
        const katSeen = {};
        for (const b of arr) {
            if (!this.getSbhForBahan(b.id)) continue;
            const k = this.kategoriBahan(b);
            if (k) {
                if (katSeen[k]) continue;
                katSeen[k] = true;
                const anggota = this.anggotaKategori(k);
                units.push({ label: k, gabungan: true, hilang: this.hilangGabungan(anggota), totalHarga: this.totalHargaGabungan(anggota) });
            } else {
                units.push({ label: b.nama_bahan, gabungan: false, hilang: this.barangHilangSbh(b), totalHarga: this.totalHargaSbh(b) || 0 });
            }
        }
        return units;
    }

    // Total harga seluruh unit yang Ket = "Kurang" (hilang > 0) → potongan gaji
    get totalHargaKurangSbh() {
        return this.unitSbhList.reduce((sum, u) => {
            if (u.hilang === null || u.hilang <= 0) return sum;
            return sum + (u.totalHarga || 0);
        }, 0);
    }

    // ─── GAJI ────────────────────────────────────────────────────────────────

    // Total satuan yang jadi (karton/layer/pcs) = total hasil produksi dari HPR
    get gajiTotalKarton() {
        return this.totalHasilProduksiHpr;
    }

    // Harga per satuan = harga standar SPK saat ini (otomatis, bukan input manual)
    get gajiNominal() {
        const s = this.state.spkDipilih;
        return s ? (s.standard_price || 0) : 0;
    }

    // Total kotor = total karton × harga standar SPK
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

    // Rincian item kurang & lebih untuk ditampilkan di tab Gaji (per unit/kategori)
    get gajiRincian() {
        const kurang = [];
        const lebih = [];
        for (const u of this.unitSbhList) {
            if (u.hilang === null) continue;
            if (u.hilang > 0) {
                kurang.push({ label: u.label, gabungan: u.gabungan, qty: u.hilang, totalHarga: u.totalHarga || 0 });
            } else if (u.hilang < 0) {
                lebih.push({ label: u.label, gabungan: u.gabungan, qty: Math.abs(u.hilang) });
            }
        }
        return { kurang, lebih };
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
            f.barang_sisa = sbh.barang_sisa || 0;
            f.gudang_penerima = sbh.gudang_penerima || "";
            f.kategori = sbh.kategori || "";
        } else {
            f.mode = 'tambah';
            f.sbhId = null;
            // Nilai default = sisa yang diharapkan (Qty SPK − Total Kembali),
            // user tinggal menyesuaikan bila ada yang hilang.
            const sisa = this.sisaSbh(bahan);
            f.barang_sisa = (sisa !== null && sisa > 0) ? sisa : 0;
            f.gudang_penerima = "";
            f.kategori = "";
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
        return sisa - (parseFloat(f.barang_sisa) || 0);
    }

    async simpanSbh() {
        const f = this.state.formSbh;
        f.menyimpan = true;
        try {
            const vals = {
                barang_sisa: parseFloat(f.barang_sisa) || 0,
                gudang_penerima: f.gudang_penerima ? f.gudang_penerima.trim() : false,
                kategori: f.kategori ? f.kategori.trim() : false,
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
        const map = { karton: "Karton", layer: "Layer", pcs: "Pcs" };
        return map[unit] || unit;
    }
}

registry.category("actions").add("spk_app", SpkApp);
