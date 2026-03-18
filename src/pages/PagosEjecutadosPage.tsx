import { useState, useMemo } from "react";
import {
  useProgramaciones, useLineasProgramacion, usePagosEjecutados,
  useHistorico, useFacturas, useAddPagoEjecutado, useUpdatePagoEjecutado,
  useAddHistorico, useUpdateProgramacion,
} from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentISOWeek, formatUSD, formatDate } from "@/lib/business-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Archive, AlertTriangle, CheckCircle2 } from "lucide-react";

const BANCOS_ORIGEN = ["Produbanco Empresa", "Banco Pichincha Empresa", "Banco Guayaquil Empresa", "Banco del Pacífico Empresa"];

export default function PagosEjecutadosPage() {
  const { canWrite, profile } = useAuth();
  const { data: programaciones = [] } = useProgramaciones();
  const { data: facturas = [] } = useFacturas();
  const { data: pagosEjecutados = [] } = usePagosEjecutados();
  const { data: historico = [] } = useHistorico();
  const updateProgramacion = useUpdateProgramacion();
  const addPagoEjecutado = useAddPagoEjecutado();
  const updatePagoEjecutado = useUpdatePagoEjecutado();
  const addHistorico = useAddHistorico();

  const semanaActual = getCurrentISOWeek();
  const programacion = programaciones.find((p) => p.semana === semanaActual);
  const { data: lineasAprobadas = [] } = useLineasProgramacion(programacion?.id);

  const lineasFiltradas = useMemo(() => {
    if (!programacion) return [];
    return lineasAprobadas.filter((l) => ["APROBADO", "EN_PROCESO", "PAGADO"].includes(l.estado_aprobacion));
  }, [lineasAprobadas, programacion]);

  const pagos = useMemo(() => {
    return lineasFiltradas.map((l, i) => {
      const existing = pagosEjecutados.find((p) => p.numero_factura === l.numero_factura);
      if (existing) return existing;
      return {
        id: `pago-${programacion?.id}-${l.numero_factura}`,
        numero_linea: i + 1,
        fecha_pago: new Date().toISOString().split("T")[0],
        codigo_proveedor: l.codigo_proveedor,
        razon_social: l.razon_social,
        numero_factura: l.numero_factura,
        monto_pagado: Number(l.monto_a_pagar),
        forma_pago: l.forma_pago,
        banco_origen: "",
        banco_destino: l.banco_destino,
        numero_transferencia: "",
        cuenta_destino: l.cuenta_destino,
        saldo_pendiente: Number(l.saldo_real_pendiente) - Number(l.monto_a_pagar),
        responsable: l.responsable_pago,
        aprobado_por: programacion?.aprobado_por || "",
        observaciones: l.observaciones,
        _isStub: true,
      };
    });
  }, [lineasFiltradas, pagosEjecutados, programacion]);

  const [edits, setEdits] = useState<Record<string, any>>({});
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveReport, setArchiveReport] = useState<any>(null);
  const [archiveStep, setArchiveStep] = useState(0);

  const getEditValue = (pagoId: string, field: string) => edits[pagoId]?.[field];
  const setEditValue = (pagoId: string, field: string, value: string) => {
    setEdits((prev) => ({ ...prev, [pagoId]: { ...prev[pagoId], [field]: value } }));
  };

  const handleSavePago = async (pago: any) => {
    const merged = { ...pago, ...edits[pago.id] };
    delete merged._isStub;
    try {
      if (pago._isStub) {
        const { _isStub, ...data } = merged;
        data.id = undefined;
        await addPagoEjecutado.mutateAsync(data);
      } else {
        await updatePagoEjecutado.mutateAsync({ id: pago.id, ...edits[pago.id] });
      }
      toast.success(`Pago ${pago.numero_factura} guardado`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleArchiveWeek = () => {
    if (!canWrite()) { toast.error("No tiene permisos para archivar"); return; }
    const mergedPagos = pagos.map((p) => ({ ...p, ...edits[p.id] }));
    const factNums = mergedPagos.map((p) => p.numero_factura);
    const internalDups = factNums.filter((n, i) => factNums.indexOf(n) !== i);
    if (internalDups.length > 0) {
      setArchiveReport({ toArchive: 0, duplicates: [], internalDups: [...new Set(internalDups)] });
      setArchiveStep(3); setShowArchiveDialog(true); return;
    }
    const alreadyArchived = historico.some((h) => h.semana === semanaActual);
    const duplicates = mergedPagos.filter((p) => historico.some((h) => h.numero_factura === p.numero_factura)).map((p) => p.numero_factura);
    const missingTransfer = mergedPagos.filter((p) => !p.numero_transferencia);
    if (missingTransfer.length > 0) {
      toast.error(`Falta número de transferencia en ${missingTransfer.length} pago(s).`); return;
    }
    const toArchive = mergedPagos.filter((p) => !duplicates.includes(p.numero_factura)).length;
    setArchiveReport({ toArchive, duplicates, internalDups: [] });
    setArchiveStep(alreadyArchived ? 1 : duplicates.length > 0 ? 2 : 0);
    setShowArchiveDialog(true);
  };

  const confirmArchive = async () => {
    const mergedPagos = pagos.map((p) => ({ ...p, ...edits[p.id] }));
    const duplicateNums = archiveReport?.duplicates || [];
    const toArchive = mergedPagos.filter((p) => !duplicateNums.includes(p.numero_factura));

    const records = toArchive.map((p) => {
      const f = facturas.find((f) => f.numero_factura === p.numero_factura);
      return {
        numero_linea: p.numero_linea, semana: semanaActual,
        periodo: semanaActual.substring(0, 4) + "-" + String(new Date().getMonth() + 1).padStart(2, "0"),
        fecha_archivo: new Date().toISOString().split("T")[0],
        fecha_pago: p.fecha_pago, codigo_proveedor: p.codigo_proveedor, razon_social: p.razon_social,
        numero_factura: p.numero_factura, monto_pagado: p.monto_pagado, forma_pago: p.forma_pago,
        banco_origen: p.banco_origen, banco_destino: p.banco_destino, numero_transferencia: p.numero_transferencia,
        cuenta_destino: p.cuenta_destino, saldo_pendiente: p.saldo_pendiente, responsable: p.responsable,
        aprobado_por: p.aprobado_por, observaciones: p.observaciones,
        prioridad: f ? "CRITICO" : "AL_DIA", dias_vencidos: 0, fecha_vencimiento: f?.fecha_vencimiento || null,
      };
    });

    try {
      await addHistorico.mutateAsync(records);
      if (programacion) {
        await updateProgramacion.mutateAsync({ id: programacion.id, estado_semana: "ARCHIVADO" });
      }
      setShowArchiveDialog(false); setEdits({});
      toast.success(`${records.length} pagos archivados exitosamente.`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[hsl(var(--teal))]">Pagos Ejecutados</h2>
          <p className="text-sm text-muted-foreground">Semana {semanaActual} — Confirme transferencias y datos bancarios</p>
        </div>
        {canWrite() && (
          <Button onClick={handleArchiveWeek} disabled={pagos.length === 0} className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/90">
            <Archive size={16} /> Archivar Semana
          </Button>
        )}
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
                  <TableCell className="text-right tabular-nums font-semibold text-sm">{formatUSD(Number(p.monto_pagado))}</TableCell>
                  <TableCell className="text-sm">{p.forma_pago}</TableCell>
                  <TableCell>
                    <select className="h-8 rounded border border-input bg-background px-2 text-sm w-full"
                      value={(getEditValue(p.id, "banco_origen") as string) ?? p.banco_origen}
                      onChange={(e) => setEditValue(p.id, "banco_origen", e.target.value)}
                      disabled={!canWrite()}
                    >
                      <option value="">Seleccione...</option>
                      {BANCOS_ORIGEN.map((b) => (<option key={b} value={b}>{b}</option>))}
                    </select>
                  </TableCell>
                  <TableCell className="text-sm">{p.banco_destino}</TableCell>
                  <TableCell>
                    <Input className="h-8 text-sm" placeholder="TRF-XXXXXXXX"
                      value={(getEditValue(p.id, "numero_transferencia") as string) ?? p.numero_transferencia}
                      onChange={(e) => setEditValue(p.id, "numero_transferencia", e.target.value)}
                      disabled={!canWrite()}
                    />
                  </TableCell>
                  <TableCell>
                    <Input type="date" className="h-8 text-sm"
                      value={(getEditValue(p.id, "fecha_pago") as string) ?? p.fecha_pago}
                      onChange={(e) => setEditValue(p.id, "fecha_pago", e.target.value)}
                      disabled={!canWrite()}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{formatUSD(Number(p.saldo_pendiente))}</TableCell>
                  <TableCell className="text-center">
                    {canWrite() && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSavePago(p)}>
                        <CheckCircle2 size={15} className="text-[hsl(var(--success))]" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-3 border-t flex justify-between text-sm">
            <span className="text-muted-foreground">{pagos.length} pagos</span>
            <span className="font-semibold">Total: {formatUSD(pagos.reduce((s, p) => s + Number(p.monto_pagado), 0))}</span>
          </div>
        </div>
      )}

      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {archiveStep === 3 ? (<><AlertTriangle className="text-[hsl(var(--danger))]" size={20} /> Error: Facturas Duplicadas</>) :
               archiveStep === 1 ? (<><AlertTriangle className="text-[hsl(var(--warning))]" size={20} /> Semana Ya Archivada</>) :
               (<><Archive size={20} /> Confirmar Archivo de Semana</>)}
            </DialogTitle>
            <DialogDescription>
              {archiveStep === 3 ? "Se encontraron facturas duplicadas dentro de la misma semana." :
               archiveStep === 1 ? "Esta semana ya tiene pagos archivados. ¿Desea continuar?" :
               "Revise el resumen antes de archivar."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {archiveStep === 3 && archiveReport?.internalDups && (
              <div className="bg-[hsl(var(--danger-light))] p-3 rounded-md text-sm">
                <p className="font-medium text-[hsl(var(--danger))]">Facturas duplicadas en esta semana:</p>
                <ul className="list-disc list-inside mt-1">
                  {archiveReport.internalDups.map((d: string) => <li key={d} className="font-mono">{d}</li>)}
                </ul>
                <p className="mt-2 text-[hsl(var(--danger))]">Elimine los duplicados antes de archivar.</p>
              </div>
            )}
            {archiveStep !== 3 && archiveReport && (
              <>
                <div className="bg-muted p-3 rounded-md text-sm space-y-1">
                  <p>✅ Pagos a archivar: <strong>{archiveReport.toArchive}</strong></p>
                  {archiveReport.duplicates.length > 0 && (
                    <p className="text-[hsl(var(--warning))]">⚠ {archiveReport.duplicates.length} factura(s) ya existen en histórico y serán excluidas</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">⚠ Esta acción es <strong>irreversible</strong>.</p>
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
