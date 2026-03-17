import { useState, useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { formatUSD, formatDate } from "@/lib/business-rules";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 25;

export default function HistoricoPage() {
  const { historico } = useAppStore();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    return historico
      .filter((h) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return h.razon_social.toLowerCase().includes(q) || h.numero_factura.toLowerCase().includes(q) || h.semana.includes(q);
      })
      .sort((a, b) => b.fecha_archivo.localeCompare(a.fecha_archivo));
  }, [historico, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPagado = filtered.reduce((s, h) => s + h.monto_pagado, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-teal">Histórico de Pagos</h2>
        <p className="text-sm text-muted-foreground">{filtered.length} registros — Total: {formatUSD(totalPagado)}</p>
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
                  <td className="px-4 py-3 tabular-nums text-right font-semibold">{formatUSD(h.monto_pagado)}</td>
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
