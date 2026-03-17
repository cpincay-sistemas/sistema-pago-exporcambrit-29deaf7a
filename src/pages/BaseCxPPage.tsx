import { useState, useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { PrioridadBadge } from "@/components/PrioridadBadge";
import { formatUSD, formatDate } from "@/lib/business-rules";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Download, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import type { Prioridad } from "@/types";

const PAGE_SIZE = 25;

export default function BaseCxPPage() {
  const { facturas, historico } = useAppStore();
  const [search, setSearch] = useState("");
  const [prioridadFilter, setPrioridadFilter] = useState<string>("ALL");
  const [page, setPage] = useState(0);

  const getReal = (nf: string) => {
    const f = facturas.find((x) => x.numero_factura === nf);
    if (!f) return 0;
    const abonado = historico.filter((h) => h.numero_factura === nf).reduce((s, h) => s + h.monto_pagado, 0);
    return f.saldo_total - abonado;
  };

  const filtered = useMemo(() => {
    return facturas
      .filter((f) => {
        if (prioridadFilter !== "ALL" && f.prioridad !== prioridadFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            f.razon_social.toLowerCase().includes(q) ||
            f.numero_factura.toLowerCase().includes(q) ||
            f.motivo.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.dias_vencidos - a.dias_vencidos);
  }, [facturas, search, prioridadFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalSaldo = filtered.reduce((s, f) => s + getReal(f.numero_factura), 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-teal">Base de Cuentas por Pagar</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} facturas — Total: {formatUSD(totalSaldo)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload size={15} /> Importar ERP
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download size={15} /> Exportar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar proveedor, factura, motivo…" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={prioridadFilter} onValueChange={(v) => { setPrioridadFilter(v); setPage(0); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="CRITICO">Crítico</SelectItem>
            <SelectItem value="URGENTE">Urgente</SelectItem>
            <SelectItem value="PROXIMO">Próximo</SelectItem>
            <SelectItem value="AL_DIA">Al día</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Proveedor", "Factura", "Motivo", "Emisión", "Vencimiento", "Días Venc.", "Saldo Original", "Saldo Real", "Prioridad"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate">{f.razon_social}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{f.numero_factura}</td>
                  <td className="px-4 py-3 max-w-[180px] truncate text-muted-foreground">{f.motivo}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(f.fecha_emision)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(f.fecha_vencimiento)}</td>
                  <td className="px-4 py-3 tabular-nums text-right font-semibold">{f.dias_vencidos}</td>
                  <td className="px-4 py-3 tabular-nums text-right">{formatUSD(f.saldo_total)}</td>
                  <td className="px-4 py-3 tabular-nums text-right font-semibold">{formatUSD(getReal(f.numero_factura))}</td>
                  <td className="px-4 py-3"><PrioridadBadge prioridad={f.prioridad} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft size={16} />
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
