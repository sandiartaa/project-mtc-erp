/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class PenjualanDashboard extends Component {
    static template = "custom_penjualan.Dashboard";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.actionService = useService("action");
        this.notification = useService("notification");

        // Fungsi konfirmasi disimpan di luar reactive state agar tidak di-proxy OWL
        this._aksiKonfirmasi = null;

        this.state = useState({
            pesanan: [],
            statistik: { total: 0, pendapatan: 0, baru: 0, selesai: 0 },
            pesananDipilih: null,
            detailBarang: [],
            memuat: true,
            filter: "semua",

            // Dialog konfirmasi (hapus / simpan-edit)
            konfirmasi: {
                buka: false,
                judul: "",
                pesan: "",
                labelYa: "Ya, Lanjutkan",
                warnaYa: "merah",
            },

            // Form tambah pesanan baru
            formTambah: {
                buka: false,
                menyimpan: false,
                partner_id: "",
                tanggal: new Date().toISOString().slice(0, 10),
                baris: [],
            },

            // Form edit pesanan
            formEdit: {
                buka: false,
                memuat: false,
                menyimpan: false,
                orderId: null,
                orderName: "",
                partner_id: "",
                tanggal: "",
                baris: [],
                barisAsli: [],
            },

            daftarPelanggan: [],
            daftarProduk: [],
        });

        onMounted(() => this.muatData());
    }

    // ─── DATA UTAMA ───────────────────────────────────────────────────────────

    async muatData() {
        this.state.memuat = true;
        try {
            const pesanan = await this.orm.searchRead(
                "sale.order",
                this.getDomain(),
                ["name", "partner_id", "date_order", "amount_total", "state", "user_id"],
                { limit: 60, order: "date_order desc" }
            );
            this.state.pesanan = pesanan;

            const semuaPesanan = await this.orm.searchRead(
                "sale.order", [],
                ["state", "amount_total"],
                { limit: 0 }
            );
            this.state.statistik.total = semuaPesanan.length;
            this.state.statistik.pendapatan = semuaPesanan.reduce((s, o) => s + o.amount_total, 0);
            this.state.statistik.baru = semuaPesanan.filter(o => ["draft", "sent"].includes(o.state)).length;
            this.state.statistik.selesai = semuaPesanan.filter(o => o.state === "done").length;
        } catch (e) {
            console.error("Gagal memuat data:", e);
        }
        this.state.memuat = false;
    }

    getDomain() {
        const f = this.state.filter;
        if (f === "baru")    return [["state", "in", ["draft", "sent"]]];
        if (f === "proses")  return [["state", "=", "sale"]];
        if (f === "selesai") return [["state", "=", "done"]];
        if (f === "batal")   return [["state", "=", "cancel"]];
        return [];
    }

    async gantiFilter(filter) {
        this.state.filter = filter;
        await this.muatData();
    }

    // ─── HELPER: MUAT PELANGGAN & PRODUK ─────────────────────────────────────

    async pastikanDataForm() {
        if (this.state.daftarPelanggan.length === 0) {
            const pelanggan = await this.orm.searchRead(
                "res.partner",
                [["active", "=", true]],
                ["id", "name"],
                { limit: 200, order: "name asc" }
            );
            this.state.daftarPelanggan = pelanggan;
        }
        if (this.state.daftarProduk.length === 0) {
            const produk = await this.orm.searchRead(
                "product.product",
                [["sale_ok", "=", true], ["active", "=", true]],
                ["id", "name", "list_price", "uom_id"],
                { limit: 300, order: "name asc" }
            );
            this.state.daftarProduk = produk;
        }
    }

    // ─── POPUP DETAIL ─────────────────────────────────────────────────────────

    async bukaDetail(pesanan) {
        this.state.pesananDipilih = pesanan;
        this.state.detailBarang = [];
        const barang = await this.orm.searchRead(
            "sale.order.line",
            [["order_id", "=", pesanan.id]],
            ["product_id", "product_uom_qty", "price_unit", "price_subtotal", "name"]
        );
        this.state.detailBarang = barang;
    }

    tutupDetail() {
        this.state.pesananDipilih = null;
        this.state.detailBarang = [];
    }

    async bukaOdoo(id) {
        await this.actionService.doAction({
            type: "ir.actions.act_window",
            res_model: "sale.order",
            res_id: id,
            views: [[false, "form"]],
            target: "current",
        });
    }

    // ─── KONFIRMASI DIALOG ────────────────────────────────────────────────────

    tampilKonfirmasi({ judul, pesan, labelYa, warnaYa, aksi }) {
        this._aksiKonfirmasi = aksi;
        this.state.konfirmasi.buka = true;
        this.state.konfirmasi.judul = judul;
        this.state.konfirmasi.pesan = pesan;
        this.state.konfirmasi.labelYa = labelYa;
        this.state.konfirmasi.warnaYa = warnaYa;
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

    // ─── HAPUS PESANAN ────────────────────────────────────────────────────────

    konfirmasiHapus(pesanan) {
        this.tampilKonfirmasi({
            judul: "🗑️ Hapus Pesanan",
            pesan: `Yakin mau hapus pesanan <b>${pesanan.name}</b>?<br/>Tindakan ini tidak bisa dibatalkan.`,
            labelYa: "Ya, Hapus Sekarang",
            warnaYa: "merah",
            aksi: () => this.lakukanHapus(pesanan),
        });
    }

    async lakukanHapus(pesanan) {
        try {
            await this.orm.unlink("sale.order", [pesanan.id]);
            this.notification.add(`Pesanan ${pesanan.name} berhasil dihapus.`, { type: "success" });
            this.tutupDetail();
            await this.muatData();
        } catch (e) {
            console.error("Gagal hapus:", e);
            this.notification.add(
                "Gagal menghapus pesanan. Mungkin sudah terkait dengan transaksi lain.",
                { type: "danger" }
            );
        }
    }

    // ─── EDIT PESANAN ─────────────────────────────────────────────────────────

    async bukaFormEdit(pesanan) {
        // Tutup detail popup, buka form edit
        this.tutupDetail();
        await this.pastikanDataForm();

        this.state.formEdit.buka = true;
        this.state.formEdit.memuat = true;
        this.state.formEdit.menyimpan = false;
        this.state.formEdit.orderId = pesanan.id;
        this.state.formEdit.orderName = pesanan.name;
        this.state.formEdit.partner_id = String(pesanan.partner_id[0]);
        this.state.formEdit.tanggal = pesanan.date_order
            ? pesanan.date_order.slice(0, 10)
            : new Date().toISOString().slice(0, 10);
        this.state.formEdit.baris = [];
        this.state.formEdit.barisAsli = [];

        // Muat baris yang sudah ada
        const lines = await this.orm.searchRead(
            "sale.order.line",
            [["order_id", "=", pesanan.id]],
            ["id", "product_id", "product_uom_qty", "price_unit", "name", "product_uom"]
        );
        this.state.formEdit.barisAsli = lines.map(l => l.id);
        this.state.formEdit.baris = lines.map(l => ({
            _id: l.id,
            product_id: l.product_id ? l.product_id[0] : null,
            namaProduk: l.product_id ? l.product_id[1] : l.name,
            harga: l.price_unit,
            qty: l.product_uom_qty,
            uom_id: l.product_uom ? l.product_uom[0] : null,
        }));
        this.state.formEdit.memuat = false;
    }

    tutupFormEdit() {
        this.state.formEdit.buka = false;
    }

    // Baris untuk form edit (reuse logika sama dengan tambah)
    tambahBarisEdit() {
        this.state.formEdit.baris.push({
            _id: Date.now() + Math.random(),
            product_id: null,
            namaProduk: "",
            harga: 0,
            qty: 1,
            uom_id: null,
        });
    }

    hapusBarisEdit(idx) {
        this.state.formEdit.baris.splice(idx, 1);
    }

    pilihProdukEdit(idx, val) {
        const pid = parseInt(val);
        if (!pid) {
            this.state.formEdit.baris[idx].product_id = null;
            this.state.formEdit.baris[idx].namaProduk = "";
            this.state.formEdit.baris[idx].harga = 0;
            this.state.formEdit.baris[idx].uom_id = null;
            return;
        }
        const produk = this.state.daftarProduk.find(p => p.id === pid);
        if (produk) {
            this.state.formEdit.baris[idx].product_id = pid;
            this.state.formEdit.baris[idx].namaProduk = produk.name;
            this.state.formEdit.baris[idx].harga = produk.list_price || 0;
            this.state.formEdit.baris[idx].uom_id = produk.uom_id ? produk.uom_id[0] : null;
        }
    }

    ubahQtyEdit(idx, val) {
        this.state.formEdit.baris[idx].qty = parseFloat(val) || 1;
    }

    ubahHargaEdit(idx, val) {
        this.state.formEdit.baris[idx].harga = parseFloat(val) || 0;
    }

    get totalEdit() {
        return this.state.formEdit.baris.reduce((sum, b) => sum + (b.harga * b.qty), 0);
    }

    // Validasi dulu, baru tampilkan konfirmasi sebelum simpan
    validasiDanKonfirmasiEdit() {
        if (!this.state.formEdit.partner_id) {
            this.notification.add("Pilih pelanggan dulu!", { type: "warning" });
            return;
        }
        if (!this.state.formEdit.baris.some(b => b.product_id)) {
            this.notification.add("Tambahkan minimal satu produk!", { type: "warning" });
            return;
        }
        this.tampilKonfirmasi({
            judul: "✏️ Simpan Perubahan",
            pesan: `Yakin mau menyimpan perubahan pesanan <b>${this.state.formEdit.orderName}</b>?`,
            labelYa: "Ya, Simpan Perubahan",
            warnaYa: "biru",
            aksi: () => this.lakukanSimpanEdit(),
        });
    }

    async lakukanSimpanEdit() {
        this.state.formEdit.menyimpan = true;
        try {
            const barisTerisi = this.state.formEdit.baris.filter(b => b.product_id);
            const linesCmd = [
                // Hapus semua baris asli
                ...this.state.formEdit.barisAsli.map(id => [2, id, 0]),
                // Buat ulang dari form
                ...barisTerisi.map(b => [0, 0, {
                    product_id: b.product_id,
                    name: b.namaProduk,
                    product_uom_qty: b.qty,
                    price_unit: b.harga,
                    ...(b.uom_id && { product_uom: b.uom_id }),
                }]),
            ];

            await this.orm.write("sale.order", [this.state.formEdit.orderId], {
                partner_id: parseInt(this.state.formEdit.partner_id),
                date_order: this.state.formEdit.tanggal + " 00:00:00",
                order_line: linesCmd,
            });

            this.notification.add("Pesanan berhasil diperbarui!", { type: "success" });
            this.tutupFormEdit();
            this.state.filter = "semua";
            await this.muatData();
        } catch (e) {
            console.error("Gagal edit pesanan:", e);
            this.notification.add(
                "Gagal menyimpan. Pesanan mungkin sudah dikunci atau terkait faktur.",
                { type: "danger" }
            );
        }
        this.state.formEdit.menyimpan = false;
    }

    // ─── FORM TAMBAH ──────────────────────────────────────────────────────────

    async bukaFormTambah() {
        await this.pastikanDataForm();
        this.state.formTambah.buka = true;
        this.state.formTambah.menyimpan = false;
        this.state.formTambah.partner_id = "";
        this.state.formTambah.tanggal = new Date().toISOString().slice(0, 10);
        this.state.formTambah.baris = [];
        this.tambahBaris();
    }

    tutupFormTambah() {
        this.state.formTambah.buka = false;
    }

    tambahBaris() {
        this.state.formTambah.baris.push({
            _id: Date.now() + Math.random(),
            product_id: null,
            namaProduk: "",
            harga: 0,
            qty: 1,
            uom_id: null,
        });
    }

    hapusBaris(idx) {
        this.state.formTambah.baris.splice(idx, 1);
    }

    pilihProduk(idx, val) {
        const pid = parseInt(val);
        if (!pid) {
            this.state.formTambah.baris[idx].product_id = null;
            this.state.formTambah.baris[idx].namaProduk = "";
            this.state.formTambah.baris[idx].harga = 0;
            this.state.formTambah.baris[idx].uom_id = null;
            return;
        }
        const produk = this.state.daftarProduk.find(p => p.id === pid);
        if (produk) {
            this.state.formTambah.baris[idx].product_id = pid;
            this.state.formTambah.baris[idx].namaProduk = produk.name;
            this.state.formTambah.baris[idx].harga = produk.list_price || 0;
            this.state.formTambah.baris[idx].uom_id = produk.uom_id ? produk.uom_id[0] : null;
        }
    }

    ubahQty(idx, val) {
        this.state.formTambah.baris[idx].qty = parseFloat(val) || 1;
    }

    ubahHarga(idx, val) {
        this.state.formTambah.baris[idx].harga = parseFloat(val) || 0;
    }

    hitungSubtotal(b) {
        return b.harga * b.qty;
    }

    get totalForm() {
        return this.state.formTambah.baris.reduce((sum, b) => sum + (b.harga * b.qty), 0);
    }

    async simpanPesanan() {
        if (!this.state.formTambah.partner_id) {
            this.notification.add("Pilih pelanggan dulu!", { type: "warning" });
            return;
        }
        const barisTerisi = this.state.formTambah.baris.filter(b => b.product_id);
        if (barisTerisi.length === 0) {
            this.notification.add("Tambahkan minimal satu produk!", { type: "warning" });
            return;
        }
        this.state.formTambah.menyimpan = true;
        try {
            await this.orm.create("sale.order", {
                partner_id: parseInt(this.state.formTambah.partner_id),
                date_order: this.state.formTambah.tanggal + " 00:00:00",
                order_line: barisTerisi.map(b => [0, 0, {
                    product_id: b.product_id,
                    name: b.namaProduk,
                    product_uom_qty: b.qty,
                    price_unit: b.harga,
                    ...(b.uom_id && { product_uom: b.uom_id }),
                }]),
            });
            this.notification.add("Pesanan berhasil dibuat!", { type: "success" });
            this.tutupFormTambah();
            this.state.filter = "semua";
            await this.muatData();
        } catch (e) {
            console.error("Gagal buat pesanan:", e);
            this.notification.add("Gagal membuat pesanan. Coba lagi.", { type: "danger" });
        }
        this.state.formTambah.menyimpan = false;
    }

    // ─── HELPER DISPLAY ───────────────────────────────────────────────────────

    labelStatus(state) {
        return { draft: "Rancangan", sent: "Ditawarkan", sale: "Dikonfirmasi", done: "Selesai", cancel: "Dibatalkan" }[state] || state;
    }

    kelasStatus(state) {
        return { draft: "cpj-badge-abu", sent: "cpj-badge-biru", sale: "cpj-badge-hijau", done: "cpj-badge-ungu", cancel: "cpj-badge-merah" }[state] || "cpj-badge-abu";
    }

    formatRupiah(jumlah) {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(jumlah);
    }

    formatTanggal(tglStr) {
        if (!tglStr) return "-";
        return new Date(tglStr).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
    }
}

registry.category("actions").add("penjualan_dashboard", PenjualanDashboard);
