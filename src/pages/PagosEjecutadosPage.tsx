import { useState, useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { getCurrentISOWeek, formatUSD, formatDate } from "@/lib/business-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Archive, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { PagoEjecutado, HistoricoRegistro } from "@/types";

const BANCOS_ORIGEN = ["Produbanco Empresa", "Banco Pichincha Empresa", "Banco Guayaquil Empresa", "Banco del Pacífico Empresa"];

export default function PagosEjecutadosPage() {
  const {
    programaciones, lineasProgramacion, pagosEjecutados, historico,
    addPagoEjecutado, updatePagoEjecutado, addHistorico,
    updateProgramacion, getSaldoRealPendiente,
  } = useAppStore();

  const semanaActual = getCurrentISOWeek();
  const programacion = programaciones.find((p) => p.semana === semanaActual);

  // Lines approved for this week
  const lineasAprobadas = useMemo(() => {
    if (!programacion) return [];
    return lineasProgramacion.filter(
      (l) => l.semana_id === programacion.id && (l.estado_aprobacion === "APROBADO" || l.estado_aprobacion === "EN_PROCESO" || l.estado_aprobacion === "PAGADO")
    );
  }, [lineasProgramacion, programacion]);

  // Auto-generate pagos from approved lines
  const pagos = useMemo(() => {
    return lineasAprobadas.map((l, i) => {
      const existing = pagosEjecutados.find((p) => p.numero_factura === l.numero_factura && p.id.includes(l.semana_id));
      if (existing) return existing;
      // Create pago stub
      const pago: PagoEjecutado = {
        id: `pago-${l.semana_id}-${l.numero_factura}`,
        numero_linea: i + 1,
        fecha_pago: new Date().toISOString().split("T")[0],
        codigo_proveedor: l.codigo_proveedor,
        razon_social: l.razon_social,
        numero_factura: l.numero_factura,
        monto_pagado: l.monto_a_pagar,
        forma_pago: l.forma_pago,
        banco_origen: "",
        banco_destino: l.banco_destino,
        numero_transferencia: "",
        cuenta_destino: l.cuenta_destino,
        saldo_pendiente: l.saldo_real_pendiente - l.monto_a_pagar,
        responsable: l.responsable_pago,
        aprobado_por: programacion?.aprobado_por || "",
        observaciones: l.observaciones,
      };
      return pago;
    });
  }, [lineasAprobadas, pagosEjecutados, programacion]);

  // Editable state
  const [edits, setEdits] = useState<Record<string, Partial<PagoEjecutado>>>({});
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveReport, setArchiveReport] = useState<{ toArchive: number; duplicates: string[]; internalDups: string[] } | null>(null);
  const [archiveStep, setArchiveStep] = useState(0);

  const getEditValue = (pagoId: string, field: keyof PagoEjecutado) => {
    return edits[pagoId]?.[field];
  };

  const setEditValue = (pagoId: string, field: keyof PagoEjecutado, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [pagoId]: { ...prev[pagoId], [field]: value },
    }));
  };

  const handleSavePago = (pago: PagoEjecutado) => {
    const merged = { ...pago, ...edits[pago.id] };
    const existing = pagosEjecutados.find((p) => p.id === pago.id);
    if (existing) {
      updatePagoEjecutado(pago.id, edits[pago.id] || {});
    } else {
      addPagoEjecutado(merged);
    }
    toast.success(`Pago ${pago.numero_factura} guardado`);
  };

  const handleArchiveWeek = () => {
    // Merge edits into pagos
    const mergedPagos = pagos.map((p) => ({ ...p, ...edits[p.id] }));

    // Level 3: internal duplicates
    const factNums = mergedPagos.map((p) => p.numero_factura);
    const internalDups = factNums.filter((n, i) => factNums.indexOf(n) !== i);
    if (internalDups.length > 0) {
      setArchiveReport({ toArchive: 0, duplicates: [], internalDups: [...new Set(internalDups)] });
      setArchiveStep(3);
      setShowArchiveDialog(true);
      return;
    }

    // Level 1: week already archived?
    const alreadyArchived = historico.some((h) => h.semana === semanaActual);

    // Level 2: duplicate invoices in historico
    const duplicates = mergedPagos
      .filter((p) => historico.some((h) => h.numero_factura === p.numero_factura))
      .map((p) => p.numero_factura);

    // Check required fields
    const missingTransfer = mergedPagos.filter((p) => !p.numero_transferencia);
    if (missingTransfer.length > 0) {
      toast.error(`Falta número de transferencia en ${missingTransfer.length} pago(s). Complete antes de archivar.`);
      return;
    }

    const toArchive = mergedPagos.filter((p) => !duplicates.includes(p.numero_factura)).length;
    setArchiveReport({ toArchive, duplicates, internalDups: [] });
    setArchiveStep(alreadyArchived ? 1 : duplicates.length > 0 ? 2 : 0);
    setShowArchiveDialog(true);
  };

  const confirmArchive = () => {
    const mergedPagos = pagos.map((p) => ({ ...p, ...edits[p.id] }));
    const duplicateNums = archiveReport?.duplicates || [];
    const toArchive = mergedPagos.filter((p) => !duplicateNums.includes(p.numero_factura));

    const records: HistoricoRegistro[] = toArchive.map((p) => ({
      ...p,
      id: `hist-${Date.now()}-${p.numero_factura}`,
      semana: semanaActual,
      periodo: semanaActual.substring(0, 4) + "-" + String(new Date().getMonth() + 1).padStart(2, "0"),
      fecha_archivo: new Date().toISOString().split("T")[0],
      prioridad: "CRITICO" as const, // will be recalculated
      dias_vencidos: 0,
      fecha_vencimiento: "",
    }));

    // Enrich with factura data
    const { facturas } = useAppStore.getState();
    records.forEach((r) => {
      const f = facturas.find((f) => f.numero_factura === r.numero_factura);
      if (f) {
        r.fecha_vencimiento = f.fecha_vencimiento;
        r.dias_vencidos = f.dias_vencidos;
        r.prioridad = f.prioridad;
      }
    });

    addHistorico(records);

    if (programacion) {
      updateProgramacion(programacion.id, { estado_semana: "ARCHIVADO" });
    }

    setShowArchiveDialog(false);
    setEdits({});
    toast.success(`${records.length} pagos archivados exitosamente. ${duplicateNums.length} duplicados excluidos.`);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[hsl(var(--teal))]">Pagos Ejecutados</h2>
          <p className="text-sm text-muted-foreground">
            Semana {semanaActual} — Confirme transferencias y datos bancarios
          </p>
        </div>
        <Button
          onClick={handleArchiveWeek}
          disabled={pagos.length === 0}
          className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/90"
        >
          <Archive size={16} /> Archivar Semana
        </Button>
      </div>

      {pagos.length === 0 ? (
        <div className="bg-card rounded-lg card-shadow p-12 text-center">
          <p className="text-muted-foreground">No hay pagos aprobados para esta semana</p>
          <p className="text-sm text-muted-foreground mt-1">Primero apruebe líneas en el módulo de Programación</p>
        </div>
      ) : (
        <div className="bg-card rounded-lg card-shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Forma Pago</TableHead>
                <TableHead>Banco Origen ✏️</TableHead>
                <TableHead>Banco Destino</TableHead>
                <TableHead>N° Transferencia ✏️</TableHead>
                <TableHead>Fecha Pago ✏️</TableHead>
                <TableHead className="text-right">Saldo Post-Pago</TableHead>
                <TableHead className="text-center">Guardar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagos.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-sm font-mono">{i + 1}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{p.razon_social}</div>
                    <div className="text-xs text-muted-foreground">{p.codigo_proveedor}</div>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{p.numero_factura}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-sm">{formatUSD(p.monto_pagado)}</TableCell>
                  <TableCell className="text-sm">{p.forma_pago}</TableCell>
                  <TableCell>
                    <select
                      className="h-8 rounded border border-input bg-background px-2 text-sm w-full field-manual"
                      value={(getEditValue(p.id, "banco_origen") as string) ?? p.banco_origen}
                      onChange={(e) => setEditValue(p.id, "banco_origen", e.target.value)}
                    >
                      <option value="">Seleccione...</option>
                      {BANCOS_ORIGEN.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </TableCell>
                  <TableCell className="text-sm">{p.banco_destino}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-sm field-manual"
                      placeholder="TRF-XXXXXXXX"
                      value={(getEditValue(p.id, "numero_transferencia") as string) ?? p.numero_transferencia}
                      onChange={(e) => setEditValue(p.id, "numero_transferencia", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      className="h-8 text-sm field-manual"
                      value={(getEditValue(p.id, "fecha_pago") as string) ?? p.fecha_pago}
                      onChange={(e) => setEditValue(p.id, "fecha_pago", e.target.value)}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatUSD(p.saldo_pendiente)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSavePago(p)}>
                      <CheckCircle2 size={15} className="text-[hsl(var(--success))]" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-3 border-t flex justify-between text-sm">
            <span className="text-muted-foreground">{pagos.length} pagos</span>
            <span className="font-semibold">Total: {formatUSD(pagos.reduce((s, p) => s + p.monto_pagado, 0))}</span>
          </div>
        </div>
      )}

      {/* Archive Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {archiveStep === 3 ? (
                <><AlertTriangle className="text-[hsl(var(--danger))]" size={20} /> Error: Facturas Duplicadas</>
              ) : archiveStep === 1 ? (
                <><AlertTriangle className="text-[hsl(var(--warning))]" size={20} /> Semana Ya Archivada</>
              ) : (
                <><Archive size={20} /> Confirmar Archivo de Semana</>
              )}
            </DialogTitle>
            <DialogDescription>
              {archiveStep === 3
                ? "Se encontraron facturas duplicadas dentro de la misma semana."
                : archiveStep === 1
                ? "Esta semana ya tiene pagos archivados. ¿Desea continuar?"
                : "Revise el resumen antes de archivar."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {archiveStep === 3 && archiveReport?.internalDups && (
              <div className="bg-[hsl(var(--danger-light))] p-3 rounded-md text-sm">
                <p className="font-medium text-[hsl(var(--danger))]">Facturas duplicadas en esta semana:</p>
                <ul className="list-disc list-inside mt-1">
                  {archiveReport.internalDups.map((d) => <li key={d} className="font-mono">{d}</li>)}
                </ul>
                <p className="mt-2 text-[hsl(var(--danger))]">Elimine los duplicados antes de archivar.</p>
              </div>
            )}

            {archiveStep !== 3 && archiveReport && (
              <>
                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                  <p>✅ Pagos a archivar: <strong>{archiveReport.toArchive}</strong></p>
                  {archiveReport.duplicates.length > 0 && (
                    <p className="text-[hsl(var(--warning))]">
                      ⚠ {archiveReport.duplicates.length} factura(s) ya existen en histórico y serán excluidas:
                      {archiveReport.duplicates.map((d) => <span key={d} className="font-mono ml-1">{d}</span>)}
                    </p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  ⚠ Esta acción es <strong>irreversible</strong>. Los pagos se moverán al histórico permanente.
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveDialog(false)}>Cancelar</Button>
            {archiveStep !== 3 && (
              <Button onClick={confirmArchive} className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/90">
                <Archive size={16} /> Confirmar Archivo
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
