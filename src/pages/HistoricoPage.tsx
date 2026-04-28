import { useState, useMemo } from "react";
import { useHistorico } from "@/hooks/useSupabaseData";
import { formatUSD, formatDate } from "@/lib/business-rules";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const PAGE_SIZE = 25;

export default function HistoricoPage() {
  const { data: historico = [] } = useHistorico();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return historico
      .filter((h) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return h.razon_social.toLowerCase().includes(q) || h.numero_factura.toLowerCase().includes(q) || (h.semana || "").includes(q);
      })
      .sort((a, b) => (b.fecha_archivo || "").localeCompare(a.fecha_archivo || ""));
  }, [historico, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPagado = filtered.reduce((s, h) => s + Number(h.monto_pagado), 0);



  const handleExport = (format: "csv" | "xlsx") => {
    const data = filtered.map((h) => ({
      Semana: h.semana,
      Fecha_Pago: h.fecha_pago,
      Proveedor: h.razon_social,
      Factura: h.numero_factura,
      Monto_Pagado: Number(h.monto_pagado),
      Forma_Pago: h.forma_pago,
      Banco_Origen: h.banco_origen,
      Nro_Transferencia: h.numero_transferencia,
      Responsable: h.responsable,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historico");
    const today = new Date().toISOString().split("T")[0];
    if (format === "csv") {
      XLSX.writeFile(wb, `historico_pagos_${today}.csv`, { bookType: "csv" });
    } else {
      XLSX.writeFile(wb, `historico_pagos_${today}.xlsx`);
    }
    toast.success("Archivo exportado");
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-teal">Histórico de Pagos</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} registros — Total: {formatUSD(totalPagado)}</p>
        </div>
        <div className="flex gap-2">
          <Select onValueChange={(v) => handleExport(v as "csv" | "xlsx")}>
            <SelectTrigger className="w-36">
              <div className="flex items-center gap-1.5"><Download size={15} /> Exportar</div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por proveedor, factura, semana…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      </div>
      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Semana", "Fecha Pago", "Proveedor", "Factura", "Monto", "Forma", "Banco Origen", "Nro. Transferencia", "Responsable"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((h) => (
                <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{h.semana}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(h.fecha_pago)}</td>
                  <td className="px-4 py-3">{h.razon_social}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{h.numero_factura}</td>
                  <td className="px-4 py-3 tabular-nums text-right font-semibold">{formatUSD(Number(h.monto_pagado))}</td>
                  <td className="px-4 py-3 text-xs">{h.forma_pago}</td>
                  <td className="px-4 py-3 text-xs">{h.banco_origen}</td>
                  <td className="px-4 py-3 tabular-nums text-xs font-medium">{h.numero_transferencia}</td>
                  <td className="px-4 py-3">{h.responsable}</td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No hay registros en el histórico</td></tr>
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

    </div>
  );
}
