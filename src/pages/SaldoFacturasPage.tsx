import { useState, useMemo, useRef, useCallback } from "react";
import { useFacturas, useHistorico } from "@/hooks/useSupabaseData";
import { formatUSD, formatDate, calcularDiasVencidos, calcularPrioridad } from "@/lib/business-rules";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, X, FileText, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EstadoFactura, Prioridad } from "@/types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart, BarController, BarElement, CategoryScale, LinearScale, ArcElement, PieController, Tooltip, Legend } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, ArcElement, PieController, Tooltip, Legend);

interface SaldoRow {
  numero_factura: string;
  codigo_proveedor: string;
  proveedor: string;
  fecha_vencimiento: string;
  dias_vencidos: number;
  monto_original: number;
  total_abonado: number;
  saldo_real_pendiente: number;
  porcentaje_pagado: number;
  estado: EstadoFactura;
  prioridad: Prioridad;
}

export default function SaldoFacturasPage() {
  const { data: facturas = [] } = useFacturas();
  const { data: historico = [] } = useHistorico();

  // Filter state
  const [proveedorSearch, setProveedorSearch] = useState("");
  const [selectedProveedores, setSelectedProveedores] = useState<string[]>([]);
  const [estadoFilter, setEstadoFilter] = useState<Record<EstadoFactura, boolean>>({
    PENDIENTE: true,
    ABONO_PARCIAL: true,
    PAGADA_COMPLETA: false,
  });
  const [prioridadFilter, setPrioridadFilter] = useState<Record<Prioridad, boolean>>({
    CRITICO: true,
    URGENTE: true,
    PROXIMO: true,
    AL_DIA: true,
  });
  const [fechaDesde, setFechaDesde] = useState<Date | undefined>();
  const [fechaHasta, setFechaHasta] = useState<Date | undefined>();
  const [provDropdownOpen, setProvDropdownOpen] = useState(false);

  // Compute all saldos
  const saldos = useMemo<SaldoRow[]>(() => {
    const seen = new Set<string>();
    return facturas.filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    }).map((f) => {
      const totalAbonado = historico
        .filter((h) => h.numero_factura === f.numero_factura && h.codigo_proveedor === f.codigo_proveedor)
        .reduce((s, h) => s + Number(h.monto_pagado), 0);
      const saldoReal = Number(f.saldo_total) - totalAbonado;
      const estado: EstadoFactura = saldoReal <= 0 ? "PAGADA_COMPLETA" : totalAbonado > 0 ? "ABONO_PARCIAL" : "PENDIENTE";
      const diasVencidos = calcularDiasVencidos(f.fecha_vencimiento);
      return {
        numero_factura: f.numero_factura,
        codigo_proveedor: f.codigo_proveedor,
        proveedor: f.razon_social,
        fecha_vencimiento: f.fecha_vencimiento,
        dias_vencidos: diasVencidos,
        monto_original: Number(f.saldo_total),
        total_abonado: totalAbonado,
        saldo_real_pendiente: Math.max(0, saldoReal),
        porcentaje_pagado: Number(f.saldo_total) > 0 ? (totalAbonado / Number(f.saldo_total)) * 100 : 0,
        estado,
        prioridad: calcularPrioridad(diasVencidos),
      };
    });
  }, [facturas, historico]);

  // Unique providers list
  const allProveedores = useMemo(() => {
    const unique = Array.from(new Set(saldos.map((s) => s.proveedor))).sort();
    return unique;
  }, [saldos]);

  const filteredProvSearch = useMemo(() => {
    if (!proveedorSearch) return allProveedores;
    const q = proveedorSearch.toLowerCase();
    return allProveedores.filter((p) => p.toLowerCase().includes(q));
  }, [allProveedores, proveedorSearch]);

  // Apply all filters
  const filtered = useMemo(() => {
    return saldos.filter((s) => {
      if (selectedProveedores.length > 0 && !selectedProveedores.includes(s.proveedor)) return false;
      if (!estadoFilter[s.estado]) return false;
      if (!prioridadFilter[s.prioridad]) return false;
      if (fechaDesde) {
        const fv = new Date(s.fecha_vencimiento + "T00:00:00");
        if (fv < fechaDesde) return false;
      }
      if (fechaHasta) {
        const fv = new Date(s.fecha_vencimiento + "T00:00:00");
        if (fv > fechaHasta) return false;
      }
      return true;
    });
  }, [saldos, selectedProveedores, estadoFilter, prioridadFilter, fechaDesde, fechaHasta]);

  // Summary stats
  const totalPendiente = filtered.reduce((s, f) => s + f.saldo_real_pendiente, 0);
  const totalAbonado = filtered.reduce((s, f) => s + f.total_abonado, 0);
  const pagadas = filtered.filter((f) => f.estado === "PAGADA_COMPLETA").length;
  const parciales = filtered.filter((f) => f.estado === "ABONO_PARCIAL").length;
  const pendientes = filtered.filter((f) => f.estado === "PENDIENTE").length;

  const toggleProveedor = (p: string) => {
    setSelectedProveedores((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const statusClass = (e: EstadoFactura) => e === "PAGADA_COMPLETA" ? "status-pagada" : e === "ABONO_PARCIAL" ? "status-parcial" : "status-pendiente";

  // ============ PDF GENERATION ============
  const generatePDF = useCallback(async () => {
    if (filtered.length === 0) {
      toast.error("No hay datos para generar el informe");
      return;
    }

    toast.info("Generando informe PDF...");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - margin * 2;

    // Group by provider, sorted by saldo desc
    const byProvider = new Map<string, SaldoRow[]>();
    filtered.forEach((s) => {
      const arr = byProvider.get(s.proveedor) || [];
      arr.push(s);
      byProvider.set(s.proveedor, arr);
    });
    const providerOrder = Array.from(byProvider.entries()).sort((a, b) => {
      const sa = a[1].reduce((t, r) => t + r.saldo_real_pendiente, 0);
      const sb = b[1].reduce((t, r) => t + r.saldo_real_pendiente, 0);
      return sb - sa;
    });

    const today = format(new Date(), "dd/MM/yyyy");
    const provNames = selectedProveedores.length > 0 ? selectedProveedores : Array.from(byProvider.keys());
    const headerColor: [number, number, number] = [30, 58, 95];

    // Helper: estado display
    const estadoLabel = (e: EstadoFactura) => e === "PAGADA_COMPLETA" ? "PAGADA" : e === "ABONO_PARCIAL" ? "ABONO PARC." : "PENDIENTE";

    // Helper: estado cell colors
    const getEstadoCellStyle = (prioridad: Prioridad, estado: EstadoFactura) => {
      if (estado === "ABONO_PARCIAL") return { fillColor: [230, 240, 255] as [number, number, number], textColor: [0, 60, 160] as [number, number, number] };
      if (estado === "PAGADA_COMPLETA") return { fillColor: [235, 248, 235] as [number, number, number], textColor: [0, 120, 0] as [number, number, number] };
      const map: Record<Prioridad, { fillColor: [number, number, number]; textColor: [number, number, number] }> = {
        CRITICO: { fillColor: [255, 235, 235], textColor: [192, 0, 0] },
        URGENTE: { fillColor: [255, 243, 230], textColor: [180, 80, 0] },
        PROXIMO: { fillColor: [255, 252, 230], textColor: [160, 120, 0] },
        AL_DIA: { fillColor: [235, 248, 235], textColor: [0, 120, 0] },
      };
      return map[prioridad];
    };

    // ========== PAGE 1 — Cover ==========
    // Header band
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, pageW, 32, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("INFORME DE CUENTAS POR PAGAR — EXPORCAMBRIT", pageW / 2, 14, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const subtitle = provNames.length > 3
      ? `${provNames.length} proveedores seleccionados — Generado: ${today}`
      : `${provNames.join(", ")} — Generado: ${today}`;
    doc.text(subtitle, pageW / 2, 24, { align: "center", maxWidth: contentW });

    // KPIs
    const vencidoCritico = filtered.filter((f) => f.prioridad === "CRITICO").reduce((s, f) => s + f.saldo_real_pendiente, 0);
    const conAbono = filtered.filter((f) => f.estado === "ABONO_PARCIAL").reduce((s, f) => s + f.total_abonado, 0);
    const nProveedores = byProvider.size;
    const kpis = [
      { label: "Total Pendiente", value: formatUSD(totalPendiente) },
      { label: "Vencido Crítico", value: formatUSD(vencidoCritico) },
      { label: "Con Abono", value: formatUSD(conAbono) },
      { label: "N° Proveedores", value: String(nProveedores) },
    ];
    const kpiW = (contentW - 9) / 4;
    kpis.forEach((k, i) => {
      const x = margin + i * (kpiW + 3);
      doc.setFillColor(240, 243, 248);
      doc.roundedRect(x, 38, kpiW, 18, 2, 2, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(k.label.toUpperCase(), x + kpiW / 2, 44, { align: "center" });
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 95);
      doc.text(k.value, x + kpiW / 2, 52, { align: "center" });
    });

    // Charts side by side
    let chartsEndY = 60;
    try {
      const chartAreaW = contentW;
      const chartH = 65;

      // Chart 1 — Horizontal bars
      const canvas1 = document.createElement("canvas");
      canvas1.width = 600;
      canvas1.height = 500;
      const ctx1 = canvas1.getContext("2d")!;
      const barData = providerOrder.slice(0, 10).map(([name, rows]) => ({
        name: name.length > 25 ? name.substring(0, 23) + "…" : name,
        value: rows.reduce((t, r) => t + r.saldo_real_pendiente, 0),
      }));
      const chart1 = new Chart(ctx1, {
        type: "bar",
        data: {
          labels: barData.map((d) => d.name),
          datasets: [{ data: barData.map((d) => d.value), backgroundColor: "#1e3a5f", borderRadius: 3 }],
        },
        options: {
          indexAxis: "y",
          responsive: false,
          animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { ticks: { callback: (v) => "$" + Number(v).toLocaleString(), font: { size: 9 } } },
            y: { ticks: { font: { size: 9 } } },
          },
        },
      });
      chart1.draw();
      const img1 = canvas1.toDataURL("image/png");
      const leftChartW = chartAreaW * 0.58;
      doc.addImage(img1, "PNG", margin, 60, leftChartW, chartH);
      chart1.destroy();

      // Chart 2 — Pie
      const canvas2 = document.createElement("canvas");
      canvas2.width = 400;
      canvas2.height = 400;
      const ctx2 = canvas2.getContext("2d")!;
      const prioData = [
        { label: "CRÍTICO", value: filtered.filter((f) => f.prioridad === "CRITICO").length, color: "#dc2626" },
        { label: "URGENTE", value: filtered.filter((f) => f.prioridad === "URGENTE").length, color: "#f97316" },
        { label: "PRÓXIMO", value: filtered.filter((f) => f.prioridad === "PROXIMO").length, color: "#eab308" },
        { label: "AL DÍA", value: filtered.filter((f) => f.prioridad === "AL_DIA").length, color: "#16a34a" },
      ].filter((d) => d.value > 0);
      const chart2 = new Chart(ctx2, {
        type: "pie",
        data: {
          labels: prioData.map((d) => d.label),
          datasets: [{ data: prioData.map((d) => d.value), backgroundColor: prioData.map((d) => d.color) }],
        },
        options: {
          responsive: false,
          animation: false,
          plugins: { legend: { position: "right", labels: { font: { size: 11 } } } },
        },
      });
      chart2.draw();
      const img2 = canvas2.toDataURL("image/png");
      const pieX = margin + leftChartW + 5;
      const pieW = chartAreaW - leftChartW - 5;
      doc.addImage(img2, "PNG", pieX, 60, pieW, chartH);
      chart2.destroy();

      chartsEndY = 60 + chartH + 4;
    } catch {
      chartsEndY = 60;
    }

    // Top 5 critical invoices
    const top5 = [...filtered].sort((a, b) => b.dias_vencidos - a.dias_vencidos).slice(0, 5);
    if (top5.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 95);
      doc.text("TOP 5 FACTURAS CRÍTICAS", margin, chartsEndY + 4);

      autoTable(doc, {
        startY: chartsEndY + 6,
        head: [["Proveedor", "Factura", "Días Venc.", "Saldo Real", "Estado"]],
        body: top5.map((r) => [
          r.proveedor.length > 30 ? r.proveedor.substring(0, 28) + "…" : r.proveedor,
          r.numero_factura,
          String(r.dias_vencidos),
          formatUSD(r.saldo_real_pendiente),
          estadoLabel(r.estado),
        ]),
        headStyles: { fillColor: headerColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 4) {
            const row = top5[data.row.index];
            if (row) {
              const style = getEstadoCellStyle(row.prioridad, row.estado);
              data.cell.styles.fillColor = style.fillColor;
              data.cell.styles.textColor = style.textColor;
            }
          }
        },
      });
    }

    // ========== DETAIL PAGES — grouped by provider, compact ==========
    let currentY = 0;
    const needNewDetailPage = true;

    providerOrder.forEach(([provName, rows], idx) => {
      const provSaldo = rows.reduce((t, r) => t + r.saldo_real_pendiente, 0);
      const estimatedBlockH = 10 + rows.length * 6 + 8;

      // First provider block starts on a new page; subsequent ones continue if space
      if (idx === 0 || currentY + Math.min(estimatedBlockH, 40) > pageH - 20) {
        doc.addPage();
        currentY = margin;
      }

      // Provider header bar
      doc.setFillColor(...headerColor);
      doc.rect(margin, currentY, contentW, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`${provName}  |  ${rows.length} facturas  |  Saldo: ${formatUSD(provSaldo)}`, margin + 3, currentY + 5.5);

      // Detail table
      autoTable(doc, {
        startY: currentY + 9,
        head: [["Factura", "Vencimiento", "Días Venc.", "Saldo Real", "Estado"]],
        body: rows.map((r) => [
          r.numero_factura,
          formatDate(r.fecha_vencimiento),
          String(r.dias_vencidos),
          formatUSD(r.saldo_real_pendiente),
          estadoLabel(r.estado),
        ]),
        foot: [["", "", "", formatUSD(provSaldo), ""]],
        headStyles: { fillColor: headerColor, textColor: [255, 255, 255], fontSize: 7, fontStyle: "bold" },
        footStyles: { fillColor: [240, 243, 248], textColor: headerColor, fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 7, cellPadding: 1.5 },
        alternateRowStyles: { fillColor: [248, 249, 250] },
        margin: { left: margin, right: margin },
        showFoot: "lastPage",
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 4) {
            const row = rows[data.row.index];
            if (row) {
              const style = getEstadoCellStyle(row.prioridad, row.estado);
              data.cell.styles.fillColor = style.fillColor;
              data.cell.styles.textColor = style.textColor;
            }
          }
        },
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;
    });

    // ========== LAST PAGE — Executive summary ==========
    doc.addPage();
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, pageW, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RESUMEN EJECUTIVO", pageW / 2, 10, { align: "center" });

    const summaryRows = providerOrder.map(([name, rows]) => {
      const montoOrig = rows.reduce((t, r) => t + r.monto_original, 0);
      const abonado = rows.reduce((t, r) => t + r.total_abonado, 0);
      const pendiente = rows.reduce((t, r) => t + r.saldo_real_pendiente, 0);
      const pctPagado = montoOrig > 0 ? (abonado / montoOrig) * 100 : 0;
      return [name, String(rows.length), formatUSD(montoOrig), formatUSD(abonado), formatUSD(pendiente), pctPagado.toFixed(1) + "%"];
    });

    const totalOrig = filtered.reduce((t, r) => t + r.monto_original, 0);
    const totalAb = filtered.reduce((t, r) => t + r.total_abonado, 0);
    const totalPend = filtered.reduce((t, r) => t + r.saldo_real_pendiente, 0);
    const totalPct = totalOrig > 0 ? (totalAb / totalOrig) * 100 : 0;

    autoTable(doc, {
      startY: 18,
      head: [["Proveedor", "N° Facturas", "Monto Original", "Total Abonado", "Saldo Pendiente", "% Pagado"]],
      body: summaryRows,
      foot: [["TOTAL GENERAL", String(filtered.length), formatUSD(totalOrig), formatUSD(totalAb), formatUSD(totalPend), totalPct.toFixed(1) + "%"]],
      headStyles: { fillColor: headerColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
      footStyles: { fillColor: headerColor, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      margin: { left: margin, right: margin },
      showFoot: "lastPage",
    });

    // Page numbers on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.setFont("helvetica", "normal");
      doc.text(`Pág. ${i} de ${totalPages}`, pageW - margin, pageH - 6, { align: "right" });
    }

    // Save
    const dateStr = format(new Date(), "yyyy-MM-dd");
    doc.save(`informe_cxp_${dateStr}.pdf`);
    toast.success("Informe PDF generado exitosamente");
  }, [filtered, selectedProveedores, totalPendiente]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-teal">Saldo de Facturas</h2>
          <p className="text-sm text-muted-foreground">Control de abonos parciales y estado real de cada factura</p>
        </div>
        <Button onClick={generatePDF} className="gap-2">
          <FileText size={16} />
          Generar Informe PDF
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Facturas</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">{filtered.length}</p>
        </div>
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pagadas</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">{pagadas}</p>
        </div>
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Con Abono</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">{parciales}</p>
        </div>
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pendientes</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">{pendientes}</p>
        </div>
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total Abonado</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">{formatUSD(totalAbonado)}</p>
        </div>
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Saldo Pendiente</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">{formatUSD(totalPendiente)}</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-card rounded-lg p-4 card-shadow space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Provider multi-select */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Proveedores</label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar proveedor…"
                className="pl-8 h-9 text-sm"
                value={proveedorSearch}
                onChange={(e) => { setProveedorSearch(e.target.value); setProvDropdownOpen(true); }}
                onFocus={() => setProvDropdownOpen(true)}
              />
              {provDropdownOpen && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto bg-popover border rounded-md shadow-lg">
                  {filteredProvSearch.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors flex items-center gap-2",
                        selectedProveedores.includes(p) && "bg-accent font-medium"
                      )}
                      onClick={() => { toggleProveedor(p); }}
                    >
                      <Checkbox checked={selectedProveedores.includes(p)} className="pointer-events-none" />
                      {p}
                    </button>
                  ))}
                  {filteredProvSearch.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</p>
                  )}
                </div>
              )}
            </div>
            {selectedProveedores.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedProveedores.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-medium">
                    {p.length > 18 ? p.substring(0, 16) + "…" : p}
                    <button type="button" onClick={() => toggleProveedor(p)} className="hover:text-destructive">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={() => setSelectedProveedores([])} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Limpiar
                </button>
              </div>
            )}
          </div>

          {/* Estado checkboxes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Estado</label>
            <div className="space-y-1">
              {([
                { key: "PENDIENTE" as EstadoFactura, label: "Pendiente" },
                { key: "ABONO_PARCIAL" as EstadoFactura, label: "Abono Parcial" },
                { key: "PAGADA_COMPLETA" as EstadoFactura, label: "Pagada Completa" },
              ]).map((e) => (
                <label key={e.key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={estadoFilter[e.key]}
                    onCheckedChange={(v) => setEstadoFilter((prev) => ({ ...prev, [e.key]: !!v }))}
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </div>

          {/* Prioridad checkboxes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prioridad</label>
            <div className="space-y-1">
              {([
                { key: "CRITICO" as Prioridad, label: "Crítico" },
                { key: "URGENTE" as Prioridad, label: "Urgente" },
                { key: "PROXIMO" as Prioridad, label: "Próximo" },
                { key: "AL_DIA" as Prioridad, label: "Al Día" },
              ]).map((p) => (
                <label key={p.key} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={prioridadFilter[p.key]}
                    onCheckedChange={(v) => setPrioridadFilter((prev) => ({ ...prev, [p.key]: !!v }))}
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Vencimiento</label>
            <div className="space-y-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left h-9 text-sm font-normal", !fechaDesde && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaDesde ? format(fechaDesde, "dd/MM/yyyy") : "Desde"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fechaDesde} onSelect={setFechaDesde} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left h-9 text-sm font-normal", !fechaHasta && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaHasta ? format(fechaHasta, "dd/MM/yyyy") : "Hasta"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={fechaHasta} onSelect={setFechaHasta} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              {(fechaDesde || fechaHasta) && (
                <button type="button" onClick={() => { setFechaDesde(undefined); setFechaHasta(undefined); }} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Limpiar fechas
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Factura", "Proveedor", "Vencimiento", "Días Venc.", "Prioridad", "Monto Original", "Total Abonado", "Saldo Real", "% Pagado", "Estado"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={`${s.codigo_proveedor}-${s.numero_factura}-${i}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 tabular-nums text-xs font-medium">{s.numero_factura}</td>
                  <td className="px-4 py-3">{s.proveedor}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(s.fecha_vencimiento)}</td>
                  <td className="px-4 py-3 tabular-nums text-right">{s.dias_vencidos}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold priority-${s.prioridad.toLowerCase().replace("_", "-")}`}>
                      {s.prioridad.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-right">{formatUSD(s.monto_original)}</td>
                  <td className="px-4 py-3 tabular-nums text-right">{formatUSD(s.total_abonado)}</td>
                  <td className="px-4 py-3 tabular-nums text-right font-semibold">{formatUSD(s.saldo_real_pendiente)}</td>
                  <td className="px-4 py-3 tabular-nums text-right">{s.porcentaje_pagado.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${statusClass(s.estado)}`}>
                      {s.estado.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No hay facturas con los filtros seleccionados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Click-outside handler for provider dropdown */}
      {provDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setProvDropdownOpen(false)} />
      )}
    </div>
  );
}
