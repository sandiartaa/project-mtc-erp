/** @odoo-module **/

import { Component, useState, onMounted } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class BackupApp extends Component {
    static template = "custom_backup_monitor.BackupApp";
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");

        this.state = useState({
            memuat: true,
            data: {},          // hasil get_dashboard
            ujiProses: false,
            speed: null,       // {write_mbps, read_mbps, size_mb}
            logBuka: false,
        });

        onMounted(() => this.muat());
    }

    async muat() {
        this.state.memuat = true;
        try {
            this.state.data = await this.orm.call("backup.monitor", "get_dashboard", []);
        } catch (e) {
            console.error("Gagal memuat dashboard backup:", e);
            this.notification.add("Gagal memuat data. Pastikan Anda Administrator.", { type: "danger" });
        }
        this.state.memuat = false;
    }

    async ujiKecepatan() {
        this.state.ujiProses = true;
        try {
            this.state.speed = await this.orm.call("backup.monitor", "disk_speed_test", []);
            this.notification.add("Uji kecepatan disk selesai.", { type: "success" });
        } catch (e) {
            console.error("Gagal uji kecepatan:", e);
            this.notification.add("Gagal menjalankan uji kecepatan disk.", { type: "danger" });
        }
        this.state.ujiProses = false;
    }

    urlUnduh(name) {
        return "/backup_monitor/download?name=" + encodeURIComponent(name);
    }

    // ── Helper status ──
    labelStatus(s) {
        return {
            ok: "Sehat — backup terbaru segar",
            warn: "Perlu dicek — backup agak lama",
            stale: "Bahaya — backup sudah usang",
            none: "Belum ada backup",
        }[s] || "—";
    }
    kelasStatus(s) {
        return {
            ok: "cbm-st-ok", warn: "cbm-st-warn", stale: "cbm-st-stale", none: "cbm-st-none",
        }[s] || "cbm-st-none";
    }
    ikonStatus(s) {
        return { ok: "✅", warn: "⚠️", stale: "⛔", none: "📭" }[s] || "•";
    }
    // Warna bar sesuai persen pemakaian (hijau<70, kuning<90, merah>=90)
    kelasBar(percent) {
        if (percent >= 90) return "cbm-bar-merah";
        if (percent >= 70) return "cbm-bar-kuning";
        return "cbm-bar-hijau";
    }
    toggleLog() { this.state.logBuka = !this.state.logBuka; }
}

registry.category("actions").add("backup_monitor_app", BackupApp);
