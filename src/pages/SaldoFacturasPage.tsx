import { useState, useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { formatUSD, formatDate, calcularDiasVencidos } from "@/lib/business-rules";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { EstadoFactura } from "@/types";

export default function SaldoFacturasPage() {
  const { facturas, historico } = useAppStore();
  const [search, setSearch] = useState("");

  const saldos = useMemo(() => {
    return facturas.map((f) => {
      const totalAbonado = historico.filter((h) => h.numero_factura === f.numero_factura).reduce((s, h) => s + h.monto_pagado, 0);
      const saldoReal = f.saldo_total - totalAbonado;
      const estado: EstadoFactura = saldoReal <= 0 ? "PAGADA_COMPLETA" : totalAbonado > 0 ? "ABONO_PARCIAL" : "PENDIENTE";
      return {
        numero_factura: f.numero_factura,
        proveedor: f.razon_social,
        fecha_vencimiento: f.fecha_vencimiento,
        dias_vencidos: calcularDiasVencidos(f.fecha_vencimiento),
        monto_original: f.saldo_total,
        total_abonado: totalAbonado,
        saldo_real_pendiente: Math.max(0, saldoReal),
        porcentaje_pagado: f.saldo_total > 0 ? (totalAbonado / f.saldo_total) * 100 : 0,
        estado,
      };
    });
  }, [facturas, historico]);

  const filtered = saldos.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return s.numero_factura.toLowerCase().includes(q) || s.proveedor.toLowerCase().includes(q);
  });

  const totalOriginal = filtered.reduce((s, f) => s + f.monto_original, 0);
  const totalAbonado = filtered.reduce((s, f) => s + f.total_abonado, 0);
  const totalPendiente = filtered.reduce((s, f) => s + f.saldo_real_pendiente, 0);
  const pagadas = filtered.filter((f) => f.estado === "PAGADA_COMPLETA").length;
  const parciales = filtered.filter((f) => f.estado === "ABONO_PARCIAL").length;
  const pendientes = filtered.filter((f) => f.estado === "PENDIENTE").length;

  const statusClass = (e: EstadoFactura) => e === "PAGADA_COMPLETA" ? "status-pagada" : e === "ABONO_PARCIAL" ? "status-parcial" : "status-pendiente";

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-teal">Saldo de Facturas</h2>
        <p className="text-sm text-muted-foreground">Control de abonos parciales y estado real de cada factura</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Facturas", value: String(filtered.length) },
          { label: "Pagadas", value: String(pagadas) },
          { label: "Con Abono", value: String(parciales) },
          { label: "Pendientes", value: String(pendientes) },
          { label: "Total Abonado", value: formatUSD(totalAbonado) },
          { label: "Saldo Pendiente", value: formatUSD(totalPendiente) },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-lg p-3 card-shadow text-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
            <p className="text-lg font-semibold tabular-nums mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar factura o proveedor…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Factura", "Proveedor", "Vencimiento", "Días Venc.", "Monto Original", "Total Abonado", "Saldo Real", "% Pagado", "Estado"].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.numero_factura} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 tabular-nums text-xs font-medium">{s.numero_factura}</td>
                  <td className="px-4 py-3">{s.proveedor}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(s.fecha_vencimiento)}</td>
                  <td className="px-4 py-3 tabular-nums text-right">{s.dias_vencidos}</td>
                  <td className="px-4 py-3 tabular-nums text-right">{formatUSD(s.monto_original)}</td>
                  <td className="px-4 py-3 tabular-nums text-right">{formatUSD(s.total_abonado)}</td>
                  <td className="px-4 py-3 tabular-nums text-right font-semibold">{formatUSD(s.saldo_real_pendiente)}</td>
                  <td className="px-4 py-3 tabular-nums text-right">{s.porcentaje_pagado.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${statusClass(s.estado)}`}>
                      {s.estado.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
