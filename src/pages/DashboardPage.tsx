import { useState, useMemo } from "react";
import { useFacturas, useHistorico } from "@/hooks/useSupabaseData";
import { KPICard } from "@/components/KPICard";
import { PrioridadBadge } from "@/components/PrioridadBadge";
import { formatUSD, formatDate, getCurrentISOWeek, calcularDiasVencidos, calcularPrioridad } from "@/lib/business-rules";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { Prioridad } from "@/types";

const CHART_COLORS = ["hsl(0,100%,38%)", "hsl(27,92%,47%)", "hsl(45,100%,37%)", "hsl(100,41%,24%)"];

type PeriodFilter = "week" | "month" | "year" | "all" | "specific";

function getISOWeekBounds(): [Date, Date] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return [monday, sunday];
}

function getMonthBounds(): [Date, Date] {
  const now = new Date();
  return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)];
}

function getYearBounds(): [Date, Date] {
  const now = new Date();
  return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)];
}

function getSpecificWeekBounds(weekStr: string): [Date, Date] | null {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return [monday, sunday];
}

function inRange(dateStr: string, bounds: [Date, Date] | null): boolean {
  if (!bounds) return true;
  const d = new Date(dateStr + "T00:00:00");
  return d >= bounds[0] && d <= bounds[1];
}

export default function DashboardPage() {
  const { data: facturas = [] } = useFacturas();
  const { data: historico = [] } = useHistorico();
  const currentWeek = getCurrentISOWeek();
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [specificWeek, setSpecificWeek] = useState(currentWeek);

  const bounds = useMemo((): [Date, Date] | null => {
    if (period === "week") return getISOWeekBounds();
    if (period === "month") return getMonthBounds();
    if (period === "year") return getYearBounds();
    if (period === "specific") return getSpecificWeekBounds(specificWeek);
    return null;
  }, [period, specificWeek]);

  const periodLabel = period === "week" ? "Esta semana" : period === "month" ? "Este mes" : period === "year" ? "Este año" : period === "specific" ? `Semana ${specificWeek}` : "Todo";

  const getReal = (nf: string) => {
    const f = facturas.find((x) => x.numero_factura === nf);
    if (!f) return 0;
    const abonado = historico.filter((h) => h.numero_factura === nf).reduce((s, h) => s + Number(h.monto_pagado), 0);
    return Number(f.saldo_total) - abonado;
  };

  const enriched = facturas.map((f) => ({
    ...f,
    dias_vencidos: calcularDiasVencidos(f.fecha_vencimiento),
    prioridad: calcularPrioridad(calcularDiasVencidos(f.fecha_vencimiento)) as Prioridad,
  }));

  const filteredFacturas = useMemo(() => enriched.filter((f) => inRange(f.fecha_vencimiento, bounds)), [enriched, bounds]);
  const filteredHistorico = useMemo(() => historico.filter((h) => inRange(h.fecha_pago, bounds)), [historico, bounds]);

  const activasConSaldo = filteredFacturas.filter((f) => getReal(f.numero_factura) > 0);
  const totalPendiente = activasConSaldo.reduce((s, f) => s + getReal(f.numero_factura), 0);
  const vencidoCritico = activasConSaldo.filter((f) => f.prioridad === "CRITICO").reduce((s, f) => s + getReal(f.numero_factura), 0);
  const pagadoPeriodo = filteredHistorico.reduce((s, h) => s + Number(h.monto_pagado), 0);
  const facturasOver30 = activasConSaldo.filter((f) => f.dias_vencidos >= 30).length;

  const prioridadData = (["CRITICO", "URGENTE", "PROXIMO", "AL_DIA"] as const).map((p) => ({
    name: p.replace("_", " "),
    value: activasConSaldo.filter((f) => f.prioridad === p).length,
    amount: activasConSaldo.filter((f) => f.prioridad === p).reduce((s, f) => s + getReal(f.numero_factura), 0),
  }));

  const provMap = new Map<string, number>();
  activasConSaldo.forEach((f) => {
    provMap.set(f.razon_social, (provMap.get(f.razon_social) || 0) + getReal(f.numero_factura));
  });
  const pieData = [...provMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, value]) => ({ name: name.length > 15 ? name.substring(0, 15) + "…" : name, value }));
  const PIE_COLORS = ["#2E75B6", "#1F3864", "#E36B0A", "#375623", "#BF8F00"];

  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const w = `W${String(parseInt(currentWeek.split("W")[1]) - 7 + i).padStart(2, "0")}`;
    const total = historico.filter((h) => h.semana.endsWith(w)).reduce((s, h) => s + Number(h.monto_pagado), 0);
    return { semana: w, total };
  });

  const alertas = activasConSaldo.filter((f) => f.prioridad === "CRITICO").sort((a, b) => b.dias_vencidos - a.dias_vencidos).slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-teal">Dashboard Ejecutivo</h2>
          <p className="text-sm text-muted-foreground">Semana {currentWeek} — Visión general de cuentas por pagar</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="year">Este año</SelectItem>
              <SelectItem value="all">Todo</SelectItem>
              <SelectItem value="specific">Semana específica</SelectItem>
            </SelectContent>
          </Select>
          {period === "specific" && (
            <Input
              type="week"
              value={specificWeek}
              onChange={(e) => setSpecificWeek(e.target.value || currentWeek)}
              className="w-44"
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="CxP Total Pendiente" value={totalPendiente} variant="default" />
        <KPICard title="Vencido Crítico" value={vencidoCritico} variant="danger" subtitle={`${alertas.length} facturas`} />
        <KPICard title={`Pagado — ${periodLabel}`} value={pagadoPeriodo} variant="success" />
        <KPICard title="Facturas > 30 días" value={String(facturasOver30)} variant="warning" subtitle="requieren atención" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg p-5 card-shadow">
          <h3 className="text-sm font-semibold mb-4">Distribución por Prioridad</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={prioridadData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatUSD(v)} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {prioridadData.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i]} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-lg p-5 card-shadow">
          <h3 className="text-sm font-semibold mb-4">Pagos por Semana</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,32%,91%)" />
              <XAxis dataKey="semana" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatUSD(v)} />
              <Line type="monotone" dataKey="total" stroke="#2E75B6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-lg p-5 card-shadow">
          <h3 className="text-sm font-semibold mb-4">CxP por Proveedor (Top 5)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name }) => name}>
                {pieData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
              </Pie>
              <Tooltip formatter={(v: number) => formatUSD(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-lg p-5 card-shadow">
          <h3 className="text-sm font-semibold mb-4">Resumen Ejecutivo</h3>
          <div className="space-y-3">
            {prioridadData.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i] }} />
                  <span className="text-sm">{p.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium tabular-nums">{formatUSD(p.amount)}</span>
                  <span className="text-xs text-muted-foreground ml-2">({p.value})</span>
                </div>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between font-semibold text-sm">
              <span>Total</span>
              <span className="tabular-nums">{formatUSD(totalPendiente)}</span>
            </div>
          </div>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="bg-card rounded-lg card-shadow overflow-hidden">
          <div className="px-5 py-3 border-b bg-danger-light">
            <h3 className="text-sm font-semibold text-danger">⚠ Alertas — Facturas Críticas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Proveedor</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Factura</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Saldo</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Días Vencidos</th>
                  <th className="text-center px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Prioridad</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground font-medium">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {alertas.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{f.razon_social}</td>
                    <td className="px-4 py-3 tabular-nums">{f.numero_factura}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">{formatUSD(getReal(f.numero_factura))}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-danger">{f.dias_vencidos}</td>
                    <td className="px-4 py-3 text-center"><PrioridadBadge prioridad={f.prioridad} /></td>
                    <td className="px-4 py-3">{formatDate(f.fecha_vencimiento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
