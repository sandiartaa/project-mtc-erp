/** @odoo-module **/
// Dashboard OEE Graph: line chart per tanggal + pareto chart top 5 terburuk.
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { loadBundle } from "@web/core/assets";
import { Component, onWillStart, useState, useEffect, useRef } from "@odoo/owl";

// Pilihan periode — 7 hari terakhir jadi default karena paling sering dilihat
const PERIODE = [
    { value: "week", label: "7 Hari Terakhir" },
    { value: "month", label: "MTD (Month-to-Date)" },
    { value: "year", label: "YTD (Year-to-Date)" },
    { value: "custom", label: "Pilih Tanggal" },
];

function isoTanggal(d) {
    return d.toISOString().slice(0, 10);
}

export class OeeGraphDashboard extends Component {
    static template = "custom_oee.GraphDashboard";
    static props = { "*": true };

    setup() {
        this.orm = useService("orm");
        this.periodeList = PERIODE;
        const hariIni = new Date();
        const mingguLalu = new Date(hariIni.getTime() - 6 * 24 * 3600 * 1000);
        this.state = useState({
            loading: true,
            period: "week",
            customStart: isoTanggal(mingguLalu),
            customEnd: isoTanggal(hariIni),
            data: null,
            // kartu per hari yang sedang terbuka (tampilan HP kecil)
            terbuka: {},
        });
        this.charts = {};
        this.refDowntime = useRef("chartDowntime");
        this.refEffi = useRef("chartEffi");
        this.refParetoMachine = useRef("chartParetoMachine");
        this.refParetoMold = useRef("chartParetoMold");
        this.refParetoReason = useRef("chartParetoReason");

        onWillStart(async () => {
            // Chart.js dimuat dari bundle bawaan Odoo
            await loadBundle("web.chartjs_lib");
            await this.loadData();
        });

        // gambar ulang semua chart setiap data berubah
        useEffect(
            () => {
                if (this.state.data) {
                    this.renderCharts();
                }
                return () => this.destroyCharts();
            },
            () => [this.state.data]
        );
    }

    async loadData(period = "week") {
        this.state.loading = true;
        const args = period === "custom"
            ? [period, this.state.customStart, this.state.customEnd]
            : [period];
        const data = await this.orm.call("oee.entry", "get_graph_data", args);
        this.state.data = data;
        this.state.terbuka = {};
        this.state.loading = false;
    }

    // buka/tutup kartu satu hari (tampilan HP kecil)
    toggleHari(key) {
        if (this.state.terbuka[key]) {
            delete this.state.terbuka[key];
        } else {
            this.state.terbuka[key] = true;
        }
    }

    setPeriode(period) {
        if (this.state.period === period) {
            return;
        }
        this.state.period = period;
        this.loadData(period);
    }

    // tombol "Tampilkan" pada mode Pilih Tanggal
    terapkanTanggal() {
        if (!this.state.customStart || !this.state.customEnd) {
            return;
        }
        this.loadData("custom");
    }

    destroyCharts() {
        for (const key of Object.keys(this.charts)) {
            this.charts[key].destroy();
        }
        this.charts = {};
    }

    makeChart(key, ref, config) {
        if (!ref.el) {
            return;
        }
        this.charts[key] = new Chart(ref.el.getContext("2d"), config);
    }

    renderCharts() {
        const d = this.state.data;
        // label chart pakai nama hari + tanggal (mis. "Kam 02/07") atau nama bulan
        const labels = d.daily.map((r) => r.label);

        // 1) Line chart: Down Time per tanggal
        this.makeChart("downtime", this.refDowntime, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Down Time (Menit)",
                    data: d.daily.map((r) => r.downtime),
                    borderColor: "#dc2626",
                    backgroundColor: "rgba(220, 38, 38, 0.08)",
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3,
                }],
            },
            options: this._lineOptions("Menit"),
        });

        // 2) Line chart: Efficiency + Effectiveness (%) + Down Time (menit, sumbu kanan)
        this.makeChart("effi", this.refEffi, {
            type: "line",
            data: {
                labels,
                datasets: [
                    {
                        label: "Efficiency (%)",
                        data: d.daily.map((r) => r.efficiency),
                        borderColor: "#16a34a",
                        backgroundColor: "#16a34a",
                        tension: 0.3,
                        pointRadius: 3,
                        yAxisID: "y",
                    },
                    {
                        label: "Effectiveness (%)",
                        data: d.daily.map((r) => r.effectiveness),
                        borderColor: "#2563eb",
                        backgroundColor: "#2563eb",
                        tension: 0.3,
                        pointRadius: 3,
                        yAxisID: "y",
                    },
                    {
                        // Down Time dalam persen (menit downtime / total waktu tersedia)
                        // supaya satu sumbu % dengan Efficiency & Effectiveness;
                        // menitnya tetap ditampilkan di tooltip.
                        label: "Down Time (%)",
                        data: d.daily.map((r) => r.downtime_pct),
                        borderColor: "#dc2626",
                        backgroundColor: "#dc2626",
                        borderDash: [6, 4],
                        tension: 0.3,
                        pointRadius: 3,
                        yAxisID: "y",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.dataset.label.startsWith("Down Time")) {
                                    const menit = d.daily[ctx.dataIndex].downtime;
                                    return " Down Time: " + ctx.parsed.y + "% (" + menit + " menit)";
                                }
                                return " " + ctx.dataset.label + ": " + ctx.parsed.y;
                            },
                        },
                    },
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: "%" } },
                },
            },
        });

        // 3-5) Pareto chart
        this._pareto("paretoMachine", this.refParetoMachine, d.pareto_machine);
        this._pareto("paretoMold", this.refParetoMold, d.pareto_mold);
        this._pareto("paretoReason", this.refParetoReason, d.pareto_reason);
    }

    _lineOptions(unit) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: {
                y: { beginAtZero: true, title: { display: true, text: unit } },
            },
        };
    }

    _pareto(key, ref, rows) {
        // Pareto = bar (menit downtime, urut terbesar) + line kumulatif %
        this.makeChart(key, ref, {
            data: {
                labels: rows.map((r) => r.name),
                datasets: [
                    {
                        type: "line",
                        label: "Kumulatif (%)",
                        data: rows.map((r) => r.cum),
                        borderColor: "#dc2626",
                        backgroundColor: "#dc2626",
                        tension: 0.2,
                        pointRadius: 3,
                        yAxisID: "y1",
                    },
                    {
                        type: "bar",
                        label: "Down Time (Menit)",
                        data: rows.map((r) => r.value),
                        backgroundColor: "rgba(22, 163, 74, 0.8)",
                        borderRadius: 4,
                        yAxisID: "y",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: "bottom" } },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: "Menit" } },
                    y1: {
                        beginAtZero: true,
                        max: 100,
                        position: "right",
                        grid: { drawOnChartArea: false },
                        title: { display: true, text: "%" },
                    },
                },
            },
        });
    }
}

registry.category("actions").add("custom_oee.graph_dashboard", OeeGraphDashboard);
