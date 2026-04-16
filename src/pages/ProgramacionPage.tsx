import { useState, useMemo, useCallback } from "react";
import {
  useProveedores, useFacturas, useHistorico, useProgramaciones,
  useLineasProgramacion, useAllLineasProgramacion, useAddProgramacion, useUpdateProgramacion,
  useAddLineaProgramacion, useUpdateLineaProgramacion, useDeleteLineaProgramacion,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentISOWeek, formatUSD, formatDate, calcularDiasVencidos, calcularPrioridad } from "@/lib/business-rules";
import { PrioridadBadge } from "@/components/PrioridadBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, XCircle, Download, Undo2 } from "lucide-react";
import type { FormaPago, EstadoAprobacion } from "@/types";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

const FORMAS_PAGO: FormaPago[] = ["TRANSFERENCIA", "CHEQUE", "EFECTIVO", "ACH"];

const estadoColors: Record<EstadoAprobacion, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  APROBADO: "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]",
  RECHAZADO: "bg-[hsl(var(--danger-light))] text-[hsl(var(--danger))]",
  EN_PROCESO: "bg-blue-100 text-blue-800",
  PAGADO: "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]",
};

export default function ProgramacionPage() {
  const { data: proveedores = [] } = useProveedores();
  const { data: facturas = [] } = useFacturas();
  const { data: historico = [] } = useHistorico();
  const { data: allLineas = [] } = useAllLineasProgramacion();
  const { data: programaciones = [] } = useProgramaciones();
  const { canWrite, canApprove, profile } = useAuth();

  const addProgramacion = useAddProgramacion();
  const updateProgramacion = useUpdateProgramacion();
  const addLineaProgramacion = useAddLineaProgramacion();
  const updateLineaProgramacion = useUpdateLineaProgramacion();
  const deleteLineaProgramacion = useDeleteLineaProgramacion();

  const semanaActual = getCurrentISOWeek();
  const [selectedSemana, setSelectedSemana] = useState(semanaActual);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLimiteDialog, setShowLimiteDialog] = useState(false);
  const [limiteInput, setLimiteInput] = useState("50000");

  const programacion = useMemo(() => programaciones.find((p) => p.semana === selectedSemana), [programaciones, selectedSemana]);
  const { data: lineas = [] } = useLineasProgramacion(programacion?.id);

  const totalAprobado = useMemo(() => {
    return lineas.filter((l) => l.estado_aprobacion !== "RECHAZADO").reduce((sum, l) => sum + Number(l.monto_a_pagar), 0);
  }, [lineas]);

  const limite = programacion ? Number(programacion.limite_disponible) : 50000;

  const getSaldoRealPendiente = (nf: string, codigoProv?: string) => {
    const f = facturas.find((x) => x.numero_factura === nf && (!codigoProv || x.codigo_proveedor === codigoProv));
    if (!f) return 0;
    const abonado = historico.filter((h) => h.numero_factura === nf && h.codigo_proveedor === f.codigo_proveedor).reduce((s, h) => s + Number(h.monto_pagado), 0);
    return Number(f.saldo_total) - abonado;
  };

  const ensureProgramacion = useCallback(async () => {
    if (programacion) return programacion;
    const result = await addProgramacion.mutateAsync({
      semana: selectedSemana,
      limite_disponible: parseFloat(limiteInput) || 50000,
    });
    return result;
  }, [programacion, selectedSemana, limiteInput, addProgramacion]);

  const proveedoresActivos = useMemo(() => proveedores.filter((p) => p.activo).sort((a, b) => a.razon_social.localeCompare(b.razon_social)), [proveedores]);

  const [newProveedorId, setNewProveedorId] = useState("");
  const [selectedFacturaIds, setSelectedFacturaIds] = useState<string[]>([]);
  const [montosPorFactura, setMontosPorFactura] = useState<Record<string, number>>({});
  const [newFormaPago, setNewFormaPago] = useState<FormaPago>("TRANSFERENCIA");
  const [newObs, setNewObs] = useState("");
  const [newResponsable, setNewResponsable] = useState("");
  const [newFechaProg, setNewFechaProg] = useState(new Date().toISOString().split("T")[0]);

  const selectedProveedor = proveedoresActivos.find((p) => p.id === newProveedorId);
  const facturasProveedor = useMemo(() => {
    if (!selectedProveedor) return [];
    return facturas.filter((f) => f.codigo_proveedor === selectedProveedor.codigo);
  }, [facturas, selectedProveedor]);

  // Facturas disponibles: excluir solo las programadas en la semana activa
  // y las que tienen saldo_real <= 0 (ya pagadas completamente)
  const facturasConSaldo = useMemo(() => {
    if (!selectedProveedor) return [];

    // Keys programadas en la semana activa solamente
    const programmedThisWeek = new Set(
      allLineas
        .filter((l) => programacion && l.semana_id === programacion.id)
        .map((l) => `${l.codigo_proveedor}|${l.numero_factura}`)
    );

    // Abonos totales por factura+proveedor desde histórico
    const historicPaid = new Map<string, number>();
    historico.forEach((h) => {
      const key = `${h.codigo_proveedor}|${h.numero_factura}`;
      historicPaid.set(key, (historicPaid.get(key) || 0) + Number(h.monto_pagado));
    });

    return facturasProveedor
      .map((f) => {
        const key = `${f.codigo_proveedor}|${f.numero_factura}`;
        const paid = historicPaid.get(key) || 0;
        const saldoReal = Number(f.saldo_total) - paid;
        return { ...f, saldoReal, _key: key };
      })
      .filter((f) => {
        // Excluir si ya programada en esta semana
        if (programmedThisWeek.has(f._key)) return false;
        // Excluir si saldo_real <= 0 (totalmente pagada)
        if (f.saldoReal <= 0) return false;
        return true;
      })
      .sort((a, b) => {
        const dateA = a.fecha_emision ? new Date(a.fecha_emision).getTime() : 0;
        const dateB = b.fecha_emision ? new Date(b.fecha_emision).getTime() : 0;
        return dateA - dateB;
      });
  }, [facturasProveedor, allLineas, historico, selectedProveedor, programacion]);

  const selectedFacturas = useMemo(() => {
    return facturasConSaldo.filter((f) => selectedFacturaIds.includes(f.id));
  }, [facturasConSaldo, selectedFacturaIds]);

  const getMonto = (f: { id: string; saldoReal: number }) => {
    if (f.saldoReal < 0) return f.saldoReal; // credits are fixed
    return montosPorFactura[f.id] ?? f.saldoReal;
  };

  const selectedFacturasTotal = useMemo(() => {
    return selectedFacturas.reduce((sum, f) => sum + getMonto(f), 0);
  }, [selectedFacturas, montosPorFactura]);

  const selectedCreditos = useMemo(() => {
    return selectedFacturas.filter((f) => f.saldoReal < 0).reduce((sum, f) => sum + f.saldoReal, 0);
  }, [selectedFacturas]);

  const selectedSubtotal = useMemo(() => {
    return selectedFacturas.filter((f) => f.saldoReal > 0).reduce((sum, f) => sum + getMonto(f), 0);
  }, [selectedFacturas, montosPorFactura]);

  const hasCreditos = selectedCreditos < 0;

  const toggleFactura = (id: string) => {
    setSelectedFacturaIds((prev) => {
      if (prev.includes(id)) {
        setMontosPorFactura((m) => { const n = { ...m }; delete n[id]; return n; });
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  };

  const handleAddLine = async () => {
    if (!selectedProveedor || selectedFacturaIds.length === 0) { toast.error("Seleccione proveedor y al menos una factura"); return; }

    try {
      const prog = await ensureProgramacion();
      let added = 0;
      for (const fId of selectedFacturaIds) {
        const f = facturasConSaldo.find((x) => x.id === fId);
        if (!f) continue;
        const saldo = f.saldoReal;
        const monto = getMonto(f);
        if (saldo === 0) { toast.warning(`Factura ${f.numero_factura} sin saldo pendiente, omitida`); continue; }
        if (saldo > 0 && (monto <= 0 || monto > saldo)) { toast.error(`Factura ${f.numero_factura}: monto inválido`); continue; }
        const existing = lineas.find((l) => l.numero_factura === f.numero_factura);
        if (existing) { toast.warning(`Factura ${f.numero_factura} ya programada, omitida`); continue; }
        if (totalAprobado + monto > limite) toast.warning(`${f.numero_factura}: monto excede el límite`);

        const diasVencidos = calcularDiasVencidos(f.fecha_vencimiento);
        await addLineaProgramacion.mutateAsync({
          semana_id: prog.id,
          razon_social: selectedProveedor.razon_social,
          codigo_proveedor: selectedProveedor.codigo,
          numero_factura: f.numero_factura,
          fecha_vencimiento: f.fecha_vencimiento,
          estado_aprobacion: "PENDIENTE",
          dias_vencidos: diasVencidos,
          prioridad: calcularPrioridad(diasVencidos),
          forma_pago: newFormaPago,
          banco_destino: selectedProveedor.banco,
          cuenta_destino: selectedProveedor.numero_cuenta,
          saldo_real_pendiente: saldo,
          monto_a_pagar: monto,
          observaciones: newObs,
          responsable_pago: newResponsable || profile?.nombre || "",
          fecha_programada: newFechaProg,
        });
        added++;
      }
      toast.success(`${added} línea(s) agregada(s) a la programación`);
      setShowAddDialog(false);
      setNewProveedorId(""); setSelectedFacturaIds([]); setMontosPorFactura({}); setNewObs("");
    } catch (err: any) {
      toast.error(err.message || "Error al agregar línea");
    }
  };

  const handleApprove = async (id: string) => {
    await updateLineaProgramacion.mutateAsync({ id, estado_aprobacion: "APROBADO" });
    toast.success("Línea aprobada");
  };
  const handleReject = async (id: string) => {
    await updateLineaProgramacion.mutateAsync({ id, estado_aprobacion: "RECHAZADO" });
    toast.info("Línea rechazada");
  };
  const handleRevert = async (id: string) => {
    await updateLineaProgramacion.mutateAsync({ id, estado_aprobacion: "PENDIENTE" });
    toast.info("Línea revertida a pendiente");
  };
  const handleDelete = async (id: string) => {
    await deleteLineaProgramacion.mutateAsync(id);
    toast.info("Línea eliminada");
  };
  const handleApproveAll = async () => {
    const pendientes = lineas.filter((l) => l.estado_aprobacion === "PENDIENTE");
    for (const l of pendientes) {
      await updateLineaProgramacion.mutateAsync({ id: l.id, estado_aprobacion: "APROBADO" });
    }
    if (programacion) {
      await updateProgramacion.mutateAsync({
        id: programacion.id,
        estado_semana: "APROBADO",
        aprobado_por: profile?.nombre || "",
        fecha_aprobacion: new Date().toISOString().split("T")[0],
      });
    }
    toast.success("Todas las líneas pendientes aprobadas");
  };

  const handleUpdateLimite = async () => {
    const val = parseFloat(limiteInput);
    if (isNaN(val) || val <= 0) { toast.error("Ingrese un límite válido"); return; }
    if (programacion) {
      await updateProgramacion.mutateAsync({ id: programacion.id, limite_disponible: val });
    } else {
      await ensureProgramacion();
    }
    setShowLimiteDialog(false);
    toast.success("Límite actualizado");
  };

  const limiteUsado = (totalAprobado / limite) * 100;

  const [sortAZ, setSortAZ] = useState(false);

  const sortedLineas = useMemo(() => {
    if (!sortAZ) return lineas;
    return [...lineas].sort((a, b) => a.razon_social.localeCompare(b.razon_social));
  }, [lineas, sortAZ]);

  const handleExportExcel = () => {
    if (lineas.length === 0) { toast.error("No hay líneas para exportar"); return; }
    const rows = (sortAZ ? sortedLineas : lineas).map((l) => ({
      "Proveedor": l.razon_social,
      "Factura": l.numero_factura,
      "Vencimiento": formatDate(l.fecha_vencimiento),
      "Prioridad": l.prioridad,
      "Estado": l.estado_aprobacion,
      "Forma Pago": l.forma_pago,
      "Saldo Real": Number(l.saldo_real_pendiente),
      "Monto a Pagar": Number(l.monto_a_pagar),
      "Responsable": l.responsable_pago,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    // Summary sheet
    const byProv: Record<string, { total: number; count: number }> = {};
    lineas.forEach((l) => {
      const m = Number(l.monto_a_pagar);
      if (!byProv[l.razon_social]) byProv[l.razon_social] = { total: 0, count: 0 };
      byProv[l.razon_social].total += m;
      byProv[l.razon_social].count += 1;
    });
    const summaryRows = Object.entries(byProv).sort((a, b) => b[1].total - a[1].total).map(([name, { total, count }], i) => ({
      "N°": i + 1, "Proveedor": name, "Facturas": count, "Monto Total": total,
    }));
    const grandTotal = summaryRows.reduce((s, r) => s + r["Monto Total"], 0);
    const totalFacturas = summaryRows.reduce((s, r) => s + r["Facturas"], 0);
    summaryRows.push({ "N°": 0, "Proveedor": "TOTAL GENERAL", "Facturas": totalFacturas, "Monto Total": grandTotal } as any);
    const ws2 = XLSX.utils.json_to_sheet(summaryRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Programación");
    XLSX.utils.book_append_sheet(wb, ws2, "Resumen");
    XLSX.writeFile(wb, `programacion_${selectedSemana}.xlsx`);
    toast.success("Exportado como Excel");
  };

  const handleExportProgramacion = async (format: "pdf" | "jpg" | "xlsx") => {
    if (format === "xlsx") { handleExportExcel(); return; }
    if (lineas.length === 0) { toast.error("No hay líneas para exportar"); return; }
    try {
      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
      const exportLineas = sortAZ ? sortedLineas : lineas;

      // Group by provider for summary
      const byProv: Record<string, { total: number; count: number }> = {};
      let grandTotal = 0;
      exportLineas.forEach((l) => {
        const m = Number(l.monto_a_pagar);
        grandTotal += m;
        if (!byProv[l.razon_social]) byProv[l.razon_social] = { total: 0, count: 0 };
        byProv[l.razon_social].total += m;
        byProv[l.razon_social].count += 1;
      });

      if (format === "pdf") {
        // FIX 2: jsPDF autoTable paginated A4
        const doc = new jsPDF({ orientation: "landscape", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(16);
        doc.setTextColor(30, 58, 95);
        doc.text("EXPORCAMBRIT", 14, 18);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Programación ${selectedSemana} — ${dateStr}`, 14, 25);

        // Main table
        autoTable(doc, {
          startY: 32,
          head: [["Proveedor", "Factura", "Vencimiento", "Prioridad", "Estado", "Forma Pago", "Saldo Real", "Monto a Pagar", "Responsable"]],
          body: exportLineas.map((l) => [
            l.razon_social,
            l.numero_factura,
            formatDate(l.fecha_vencimiento),
            l.prioridad,
            l.estado_aprobacion,
            l.forma_pago,
            formatUSD(Number(l.saldo_real_pendiente)),
            formatUSD(Number(l.monto_a_pagar)),
            l.responsable_pago,
          ]),
          headStyles: { fillColor: [30, 58, 95], fontSize: 8 },
          bodyStyles: { fontSize: 7.5 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          styles: { cellPadding: 3 },
          didDrawPage: (data: any) => {
            // Page number footer
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
          },
        });

        // Summary table
        const sortedProvs = Object.entries(byProv).sort((a, b) => b[1].total - a[1].total);
        const totalFacturas = sortedProvs.reduce((s, [, v]) => s + v.count, 0);

        const summaryBody = sortedProvs.map(([name, { count, total }], i) => [
          String(i + 1), name, String(count), formatUSD(total),
        ]);
        summaryBody.push(["", "TOTAL GENERAL", String(totalFacturas), formatUSD(grandTotal)]);

        const finalY = (doc as any).lastAutoTable?.finalY || 40;
        // Add new page if not enough space
        if (finalY > doc.internal.pageSize.getHeight() - 60) {
          doc.addPage();
          autoTable(doc, { startY: 20, head: [["N°", "Proveedor", "Facturas", "Monto Total"]], body: summaryBody, headStyles: { fillColor: [30, 58, 95], fontSize: 8 }, bodyStyles: { fontSize: 7.5 }, didParseCell: (data: any) => { if (data.section === "body" && data.row.index === summaryBody.length - 1) { data.cell.styles.fillColor = [30, 58, 95]; data.cell.styles.textColor = [255, 255, 255]; data.cell.styles.fontStyle = "bold"; } }, didDrawPage: (data: any) => { doc.setFontSize(8); doc.setTextColor(150); doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10); }, });
        } else {
          autoTable(doc, { startY: finalY + 10, head: [["N°", "Proveedor", "Facturas", "Monto Total"]], body: summaryBody, headStyles: { fillColor: [30, 58, 95], fontSize: 8 }, bodyStyles: { fontSize: 7.5 }, didParseCell: (data: any) => { if (data.section === "body" && data.row.index === summaryBody.length - 1) { data.cell.styles.fillColor = [30, 58, 95]; data.cell.styles.textColor = [255, 255, 255]; data.cell.styles.fontStyle = "bold"; } }, didDrawPage: (data: any) => { doc.setFontSize(8); doc.setTextColor(150); doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10); }, });
        }

        const now = new Date();
        const timestamp = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const lastPage = doc.getNumberOfPages();
        doc.setPage(lastPage);
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(`Generado por EXPORCAMBRIT — ${timestamp}`, 14, doc.internal.pageSize.getHeight() - 10);

        doc.save(`programacion_${selectedSemana}.pdf`);
      } else {
        // JPG export using html2canvas
        const container = document.createElement("div");
        container.style.cssText = "position:absolute;left:-9999px;top:0;width:1200px;background:#fff;padding:32px;font-family:system-ui,sans-serif;color:#1a1a1a;";

        const header = document.createElement("div");
        header.style.cssText = "margin-bottom:20px;border-bottom:2px solid #0d9488;padding-bottom:12px;";
        header.innerHTML = `<div style="font-size:20px;font-weight:700;color:#0d9488;">EXPORCAMBRIT</div><div style="font-size:14px;color:#555;margin-top:4px;">Programación ${selectedSemana} — ${dateStr}</div>`;
        container.appendChild(header);

        const cols = ["Proveedor", "Factura", "Vencimiento", "Prioridad", "Estado", "Forma Pago", "Saldo Real", "Monto a Pagar", "Responsable"];
        const alignRight = [false, false, false, false, false, false, true, true, false];
        let tableHtml = `<table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr>`;
        cols.forEach((c, i) => {
          tableHtml += `<th style="text-align:${alignRight[i] ? "right" : "left"};padding:8px 10px;background:#f3f4f6;border-bottom:2px solid #d1d5db;font-weight:600;">${c}</th>`;
        });
        tableHtml += `</tr></thead><tbody>`;
        exportLineas.forEach((l, idx) => {
          const bg = idx % 2 === 0 ? "#fff" : "#f9fafb";
          tableHtml += `<tr style="background:${bg};">
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;"><div style="font-weight:500;">${l.razon_social}</div><div style="font-size:11px;color:#888;">${l.codigo_proveedor}</div></td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-family:monospace;">${l.numero_factura}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${formatDate(l.fecha_vencimiento)}<br/><span style="font-size:11px;color:#888;">${l.dias_vencidos}d vencidos</span></td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${l.prioridad}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${l.estado_aprobacion}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${l.forma_pago}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums;">${formatUSD(Number(l.saldo_real_pendiente))}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">${formatUSD(Number(l.monto_a_pagar))}</td>
            <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;">${l.responsable_pago}</td>
          </tr>`;
        });
        tableHtml += `</tbody></table>`;
        const tableDiv = document.createElement("div");
        tableDiv.innerHTML = tableHtml;
        container.appendChild(tableDiv);

        // Footer summary
        const footer = document.createElement("div");
        footer.style.cssText = "margin-top:20px;padding-top:16px;border-top:2px solid #0d9488;font-size:13px;";
        const sortedProvs = Object.entries(byProv).sort((a, b) => b[1].total - a[1].total);
        const totalFacturas = sortedProvs.reduce((s, [, v]) => s + v.count, 0);
        let summaryHtml = `<div style="font-weight:700;font-size:15px;margin-bottom:12px;">RESUMEN POR PROVEEDOR</div>`;
        summaryHtml += `<table style="width:100%;border-collapse:collapse;font-size:13px;border:1px solid #d1d5db;">`;
        summaryHtml += `<thead><tr style="background:#1f2937;color:#fff;">
          <th style="padding:8px 10px;text-align:center;border:1px solid #d1d5db;">N°</th>
          <th style="padding:8px 10px;text-align:left;border:1px solid #d1d5db;">Proveedor</th>
          <th style="padding:8px 10px;text-align:center;border:1px solid #d1d5db;">Facturas</th>
          <th style="padding:8px 10px;text-align:right;border:1px solid #d1d5db;">Monto Total</th>
        </tr></thead><tbody>`;
        sortedProvs.forEach(([name, { total, count }], idx) => {
          const bg = idx % 2 === 0 ? "#fff" : "#f3f4f6";
          summaryHtml += `<tr style="background:${bg};">
            <td style="padding:6px 10px;text-align:center;border:1px solid #e5e7eb;">${idx + 1}</td>
            <td style="padding:6px 10px;border:1px solid #e5e7eb;">${name}</td>
            <td style="padding:6px 10px;text-align:center;border:1px solid #e5e7eb;">${count}</td>
            <td style="padding:6px 10px;text-align:right;border:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${formatUSD(total)}</td>
          </tr>`;
        });
        summaryHtml += `<tr style="background:#1e3a5f;color:#fff;font-weight:700;">
          <td style="padding:8px 10px;text-align:center;border:1px solid #d1d5db;" colspan="2">TOTAL GENERAL</td>
          <td style="padding:8px 10px;text-align:center;border:1px solid #d1d5db;">${totalFacturas}</td>
          <td style="padding:8px 10px;text-align:right;border:1px solid #d1d5db;font-variant-numeric:tabular-nums;">${formatUSD(grandTotal)}</td>
        </tr>`;
        summaryHtml += `</tbody></table>`;
        const now = new Date();
        const timestamp = `${now.getDate().toString().padStart(2, "0")}/${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()} ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        summaryHtml += `<div style="margin-top:12px;font-size:11px;color:#888;text-align:right;">Generado por EXPORCAMBRIT — ${timestamp}</div>`;
        footer.innerHTML = summaryHtml;
        container.appendChild(footer);

        document.body.appendChild(container);
        // FIX 3: scale 3
        const canvas = await html2canvas(container, { scale: 3, useCORS: true, backgroundColor: "#ffffff" });
        document.body.removeChild(container);

        const link = document.createElement("a");
        link.download = `programacion_${selectedSemana}.jpg`;
        link.href = canvas.toDataURL("image/jpeg", 0.95);
        link.click();
      }
      toast.success(`Exportado como ${format.toUpperCase()}`);
    } catch {
      toast.error("Error al exportar");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[hsl(var(--teal))]">Programación Semanal de Pagos</h2>
          <p className="text-sm text-muted-foreground">Semana {selectedSemana} — {programacion?.estado_semana ?? "BORRADOR"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="week" value={selectedSemana} onChange={(e) => setSelectedSemana(e.target.value || semanaActual)} className="w-40" />
          <Select onValueChange={(v) => handleExportProgramacion(v as "pdf" | "jpg" | "xlsx")}>
            <SelectTrigger className="w-36">
              <div className="flex items-center gap-1.5"><Download size={15} /> Exportar</div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="jpg">JPG</SelectItem>
              <SelectItem value="xlsx">Excel</SelectItem>
            </SelectContent>
          </Select>
          {canWrite() && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowLimiteDialog(true)}>Límite: {formatUSD(limite)}</Button>
              <Button size="sm" onClick={() => setShowAddDialog(true)}><Plus size={16} /> Agregar Línea</Button>
            </>
          )}
        </div>
      </div>

      <div className="bg-card rounded-lg card-shadow p-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">Uso del límite semanal</span>
          <span className="font-medium tabular-nums">{formatUSD(totalAprobado)} / {formatUSD(limite)}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${limiteUsado > 100 ? "bg-[hsl(var(--danger))]" : limiteUsado > 80 ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]"}`} style={{ width: `${Math.min(limiteUsado, 100)}%` }} />
        </div>
        {limiteUsado > 100 && <p className="text-xs text-[hsl(var(--danger))] mt-1">⚠ Excede el límite por {formatUSD(totalAprobado - limite)}</p>}
      </div>

      {lineas.length === 0 ? (
        <div className="bg-card rounded-lg card-shadow p-12 text-center">
          <p className="text-muted-foreground">No hay líneas programadas para esta semana</p>
          <p className="text-sm text-muted-foreground mt-1">Haga clic en "Agregar Línea" para empezar</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setSortAZ(!sortAZ)}>
                {sortAZ ? "↩ Orden original" : "↕ Ordenar A-Z"}
              </Button>
              {canApprove() && (
                <Button variant="outline" size="sm" onClick={handleApproveAll}><CheckCircle2 size={16} /> Aprobar Todas</Button>
              )}
            </div>
          <div className="bg-card rounded-lg card-shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Factura</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Forma Pago</TableHead>
                  <TableHead className="text-right">Saldo Real</TableHead>
                  <TableHead className="text-right">Monto a Pagar</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLineas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{l.razon_social}</div>
                      <div className="text-xs text-muted-foreground">{l.codigo_proveedor}</div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{l.numero_factura}</TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(l.fecha_vencimiento)}</div>
                      <div className="text-xs text-muted-foreground">{l.dias_vencidos}d vencidos</div>
                    </TableCell>
                    <TableCell><PrioridadBadge prioridad={l.prioridad as any} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={estadoColors[l.estado_aprobacion as EstadoAprobacion]}>{l.estado_aprobacion}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{l.forma_pago}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatUSD(Number(l.saldo_real_pendiente))}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-sm">{formatUSD(Number(l.monto_a_pagar))}</TableCell>
                    <TableCell className="text-sm">{l.responsable_pago}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {l.estado_aprobacion === "PENDIENTE" && canApprove() && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-[hsl(var(--success))]" onClick={() => handleApprove(l.id)}><CheckCircle2 size={15} /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-[hsl(var(--danger))]" onClick={() => handleReject(l.id)}><XCircle size={15} /></Button>
                          </>
                        )}
                        {l.estado_aprobacion === "APROBADO" && canApprove() && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-yellow-700" onClick={() => handleRevert(l.id)}>
                            <Undo2 size={14} /> Desaprobar
                          </Button>
                        )}
                        {l.estado_aprobacion === "RECHAZADO" && canApprove() && (
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-700" onClick={() => handleRevert(l.id)}>
                            <Undo2 size={14} /> Reactivar
                          </Button>
                        )}
                        {canWrite() && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleDelete(l.id)}><Trash2 size={15} /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-4 text-sm">
            <span className="text-muted-foreground">{lineas.length} líneas — {lineas.filter((l) => l.estado_aprobacion === "APROBADO").length} aprobadas</span>
            <span className="font-semibold">Total: {formatUSD(totalAprobado)}</span>
          </div>
        </>
      )}

      {/* Add Line Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Agregar Línea de Programación</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Proveedor</label>
              <Select value={newProveedorId} onValueChange={(v) => { setNewProveedorId(v); setSelectedFacturaIds([]); }}>
                <SelectTrigger><SelectValue placeholder="Seleccione proveedor" /></SelectTrigger>
                <SelectContent>
                  {proveedoresActivos.map((p) => (<SelectItem key={p.id} value={p.id}>{p.razon_social}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {selectedProveedor && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-md text-xs">
                <div><span className="text-muted-foreground">Banco:</span> {selectedProveedor.banco}</div>
                <div><span className="text-muted-foreground">Cuenta:</span> {selectedProveedor.numero_cuenta}</div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Facturas</label>
              {facturasConSaldo.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {selectedProveedor ? "No hay facturas pendientes de programar para este proveedor" : "Seleccione un proveedor primero"}
                </p>
              ) : (
                <div className="border rounded-md max-h-48 overflow-y-auto">
              {facturasConSaldo.map((f) => {
                    const isZero = f.saldoReal === 0;
                    const isCredit = f.saldoReal < 0;
                    return (
                      <div key={f.id} className={`flex items-center gap-2 px-3 py-2 border-b last:border-b-0 ${isZero ? "opacity-50 cursor-not-allowed bg-gray-50" : "hover:bg-muted"}`}>
                        <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                          <Checkbox
                            checked={selectedFacturaIds.includes(f.id)}
                            onCheckedChange={() => toggleFactura(f.id)}
                            disabled={isZero}
                          />
                          <span className="text-sm font-mono truncate flex items-center gap-1">
                             {f.numero_factura}
                             {isCredit && <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">CRÉDITO</Badge>}
                           </span>
                         </label>
                         <span className="text-xs text-muted-foreground whitespace-nowrap">
                           {f.fecha_emision ? formatDate(f.fecha_emision) : "Sin fecha"}
                         </span>
                         <span className={`text-xs tabular-nums whitespace-nowrap ${isCredit ? "text-blue-600" : "text-muted-foreground"}`}>
                           Saldo: {formatUSD(f.saldoReal)}
                         </span>
                        {selectedFacturaIds.includes(f.id) && !isCredit && !isZero && (
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={f.saldoReal}
                            className="w-28 h-7 text-xs tabular-nums text-right"
                            value={montosPorFactura[f.id] ?? f.saldoReal}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setMontosPorFactura((prev) => ({ ...prev, [f.id]: isNaN(val) ? 0 : val }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedFacturaIds.length > 0 && (
                <div className="mt-2 p-2 bg-muted rounded-md text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{selectedFacturaIds.length} factura(s) seleccionada(s)</span>
                  </div>
                  {hasCreditos ? (
                    <>
                      <div className="flex justify-between tabular-nums">
                        <span className="text-muted-foreground">Subtotal facturas:</span>
                        <span>{formatUSD(selectedSubtotal)}</span>
                      </div>
                      <div className="flex justify-between tabular-nums text-blue-600">
                        <span>Créditos aplicados:</span>
                        <span>{formatUSD(selectedCreditos)}</span>
                      </div>
                      <div className="flex justify-between tabular-nums font-semibold border-t pt-1">
                        <span>Total neto a pagar:</span>
                        <span>{formatUSD(selectedFacturasTotal)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between tabular-nums font-semibold">
                      <span>Total:</span>
                      <span>{formatUSD(selectedFacturasTotal)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Forma de Pago</label>
                <Select value={newFormaPago} onValueChange={(v) => setNewFormaPago(v as FormaPago)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS_PAGO.map((fp) => (<SelectItem key={fp} value={fp}>{fp}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Fecha Programada</label>
                <Input type="date" value={newFechaProg} onChange={(e) => setNewFechaProg(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Responsable</label>
                <Input value={newResponsable || profile?.nombre || ""} onChange={(e) => setNewResponsable(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Observaciones</label>
                <Input value={newObs} onChange={(e) => setNewObs(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddLine} disabled={selectedFacturaIds.length === 0}>
              Agregar {selectedFacturaIds.length > 0 ? `${selectedFacturaIds.length} línea(s)` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Limite Dialog */}
      <Dialog open={showLimiteDialog} onOpenChange={setShowLimiteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Establecer Límite Semanal</DialogTitle></DialogHeader>
          <Input type="number" step="0.01" value={limiteInput} onChange={(e) => setLimiteInput(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimiteDialog(false)}>Cancelar</Button>
            <Button onClick={handleUpdateLimite}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
