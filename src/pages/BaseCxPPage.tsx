import { useState, useMemo } from "react";
import { useFacturas, useHistorico, useDeleteFactura } from "@/hooks/useSupabaseData";
import { PrioridadBadge } from "@/components/PrioridadBadge";
import { formatUSD, formatDate, calcularDiasVencidos, calcularPrioridad } from "@/lib/business-rules";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Download, Upload, ChevronLeft, ChevronRight, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import ImportERPDialog from "@/components/ImportERPDialog";
import NuevaFacturaDialog from "@/components/NuevaFacturaDialog";
import EditFacturaDialog from "@/components/EditFacturaDialog";
import ConvertirProformaDialog from "@/components/ConvertirProformaDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 25;

export default function BaseCxPPage() {
  const { data: facturas = [] } = useFacturas();
  const { data: historico = [] } = useHistorico();
  const deleteFactura = useDeleteFactura();
  const { canWrite } = useAuth();
  const [search, setSearch] = useState("");
  const [prioridadFilter, setPrioridadFilter] = useState<string>("ALL");
  const [yearFilter, setYearFilter] = useState<string>("ALL");
  const [monthFilter, setMonthFilter] = useState<string>("ALL");
  const [showPagadas, setShowPagadas] = useState(false);
  const [page, setPage] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [nuevaFacturaOpen, setNuevaFacturaOpen] = useState(false);
  const [editFactura, setEditFactura] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [convertTarget, setConvertTarget] = useState<any>(null);

  // P1+P2 FIX: Pre-compute abonos map once in O(N) — avoids O(N*M) per render
  const abonosMap = useMemo(() => {
    const map = new Map<string, number>();
    historico.forEach((h) => {
      const key = `${h.codigo_proveedor}|${h.numero_factura}`;
      map.set(key, (map.get(key) || 0) + Number(h.monto_pagado));
    });
    return map;
  }, [historico]);

  const getReal = (nf: string, codigoProv: string) => {
    const f = facturas.find((x) => x.numero_factura === nf && x.codigo_proveedor === codigoProv);
    if (!f) return 0;
    return Number(f.saldo_total) - (abonosMap.get(`${codigoProv}|${nf}`) || 0);
  };

  const enriched = useMemo(() => {
    return facturas.map((f) => {
      const diasVencidos = calcularDiasVencidos(f.fecha_vencimiento);
      const saldo_real = Number(f.saldo_total) - (abonosMap.get(`${f.codigo_proveedor}|${f.numero_factura}`) || 0);
      return { ...f, dias_vencidos: diasVencidos, prioridad: calcularPrioridad(diasVencidos), saldo_real };
    });
  }, [facturas, abonosMap]);

  const years = useMemo(() => {
    const set = new Set<string>();
    enriched.forEach((f) => {
      if (f.periodo) {
        const y = f.periodo.substring(0, 4);
        if (y.length === 4) set.add(y);
      }
    });
    return [...set].sort().reverse();
  }, [enriched]);

  const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const filtered = useMemo(() => {
    return enriched
      .filter((f) => {
        if (!showPagadas) {
          if (f.saldo_real <= 0) return false;
        }
        if (prioridadFilter !== "ALL" && f.prioridad !== prioridadFilter) return false;
        if (yearFilter !== "ALL") {
          const y = f.periodo?.substring(0, 4) || "";
          if (y !== yearFilter) return false;
        }
        if (monthFilter !== "ALL") {
          const m = f.periodo?.substring(5, 7) || "";
          if (m !== monthFilter) return false;
        }
        if (search) {
          const q = search.toLowerCase();
          return f.razon_social.toLowerCase().includes(q) || f.numero_factura.toLowerCase().includes(q) || f.motivo.toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => b.dias_vencidos - a.dias_vencidos);
  }, [enriched, search, prioridadFilter, yearFilter, monthFilter, showPagadas]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalSaldo = filtered.reduce((s, f) => s + f.saldo_real, 0);

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map((f) => ({
      Proveedor: f.razon_social, Factura: f.numero_factura, Motivo: f.motivo,
      Emision: f.fecha_emision, Vencimiento: f.fecha_vencimiento,
      Dias_Vencidos: f.dias_vencidos, Saldo_Original: Number(f.saldo_total),
      Saldo_Real: getReal(f.numero_factura, f.codigo_proveedor), Prioridad: f.prioridad,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CxP");
    XLSX.writeFile(wb, `CxP_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Archivo exportado");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFactura.mutateAsync(deleteTarget.id);
      toast.success("Factura eliminada");
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-teal">Base de Cuentas por Pagar</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} facturas — Total: {formatUSD(totalSaldo)}</p>
        </div>
        <div className="flex gap-2">
          {canWrite() && (
            <>
              <Button size="sm" className="gap-1.5" onClick={() => setNuevaFacturaOpen(true)}>
                <Plus size={15} /> Nueva Factura
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
                <Upload size={15} /> Importar ERP
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download size={15} /> Exportar
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar proveedor, factura, motivo…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={prioridadFilter} onValueChange={(v) => { setPrioridadFilter(v); setPage(0); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="CRITICO">Crítico</SelectItem>
            <SelectItem value="URGENTE">Urgente</SelectItem>
            <SelectItem value="PROXIMO">Próximo</SelectItem>
            <SelectItem value="AL_DIA">Al día</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v); setPage(0); }}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Año" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={(v) => { setMonthFilter(v); setPage(0); }}>
          <SelectTrigger className="w-28"><SelectValue placeholder="Mes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {MONTHS.map((m, i) => (<SelectItem key={m} value={m}>{MONTH_LABELS[i]}</SelectItem>))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <Checkbox checked={showPagadas} onCheckedChange={(v) => { setShowPagadas(!!v); setPage(0); }} />
          Mostrar pagadas
        </label>
      </div>

      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Proveedor", "Factura", "Motivo", "Emisión", "Vencimiento", "Días Venc.", "Saldo Original", "Saldo Real", "Prioridad", "Acciones"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((f) => {
                const saldo = Number(f.saldo_total);
                const origen = (f as any).origen || "ERP";
                const tipo = (f as any).tipo || "FACTURA";
                const isManual = origen === "MANUAL";
                const isProforma = tipo === "PROFORMA";
                const isConvertida = tipo === "PROFORMA_CONVERTIDA";
                const rowClass = saldo === 0
                  ? "border-b last:border-0 bg-muted/40 text-muted-foreground"
                  : saldo < 0
                    ? "border-b last:border-0 bg-accent/30"
                    : "border-b last:border-0 hover:bg-muted/30 transition-colors duration-150";

                const getBadge = () => {
                  if (isConvertida) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">CONVERTIDA</Badge>;
                  if (isProforma) return <Badge className="text-[10px] px-1.5 py-0 bg-orange-500 hover:bg-orange-600 text-white border-0">PROFORMA</Badge>;
                  if (isManual) return <Badge variant="default" className="text-[10px] px-1.5 py-0">MANUAL</Badge>;
                  return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ERP</Badge>;
                };

                return (
                  <tr key={f.id} className={rowClass}>
                    <td className="px-4 py-3 font-medium max-w-[200px] truncate">{f.razon_social}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{f.numero_factura}</td>
                    <td className="px-4 py-3 max-w-[180px] truncate text-muted-foreground">{f.motivo}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDate(f.fecha_emision)}</td>
                    <td className="px-4 py-3 tabular-nums">{formatDate(f.fecha_vencimiento)}</td>
                    <td className="px-4 py-3 tabular-nums text-right font-semibold">{f.dias_vencidos}</td>
                    <td className="px-4 py-3 tabular-nums text-right">
                      <span className="mr-2">{formatUSD(saldo)}</span>
                      {saldo === 0 && <Badge variant="secondary" className="text-[10px]">PAGADA</Badge>}
                      {saldo < 0 && <Badge variant="secondary" className="bg-accent text-accent-foreground text-[10px]">CRÉDITO A FAVOR</Badge>}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-right font-semibold">{formatUSD(getReal(f.numero_factura, f.codigo_proveedor))}</td>
                    <td className="px-4 py-3"><PrioridadBadge prioridad={f.prioridad} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {getBadge()}
                        {canWrite() && !isConvertida && (
                          <>
                            {(isManual || isProforma) && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditFactura(f)} title="Editar">
                                <Pencil size={14} />
                              </Button>
                            )}
                            {isProforma && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700" onClick={() => setConvertTarget(f)} title="Convertir a Factura">
                                <RefreshCw size={14} />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(f)} title="Eliminar">
                              <Trash2 size={14} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginated.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No hay facturas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></Button>
            </div>
          </div>
        )}
      </div>

      <ImportERPDialog open={importOpen} onOpenChange={setImportOpen} />
      <NuevaFacturaDialog open={nuevaFacturaOpen} onOpenChange={setNuevaFacturaOpen} />
      <EditFacturaDialog open={!!editFactura} onOpenChange={(v) => { if (!v) setEditFactura(null); }} factura={editFactura} />
      <ConvertirProformaDialog open={!!convertTarget} onOpenChange={(v) => { if (!v) setConvertTarget(null); }} proforma={convertTarget} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar factura?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la factura <strong>{deleteTarget?.numero_factura}</strong> de <strong>{deleteTarget?.razon_social}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
