import { useState, useMemo, useRef } from "react";
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
import { Archive, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Upload, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import * as XLSX from "xlsx";

const BANCOS_ORIGEN = ["Produbanco Empresa", "Banco Pichincha Empresa", "Banco Guayaquil Empresa", "Banco del Pacífico Empresa"];

function navigateWeek(weekStr: string, delta: number): string {
  const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekStr;
  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week - 1) * 7 + delta * 7);
  const newYear = monday.getFullYear();
  const newJan4 = new Date(newYear, 0, 4);
  const newStart = new Date(newJan4);
  newStart.setDate(newJan4.getDate() - ((newJan4.getDay() + 6) % 7));
  const newWeek = Math.floor((monday.getTime() - newStart.getTime()) / (7 * 86400000)) + 1;
  return `${newYear}-W${String(newWeek).padStart(2, "0")}`;
}

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
  const [selectedSemana, setSelectedSemana] = useState(semanaActual);

  const programacion = programaciones.find((p) => p.semana === selectedSemana);
  const { data: lineasAprobadas = [] } = useLineasProgramacion(programacion?.id);

  const lineasFiltradas = useMemo(() => {
    if (!programacion) return [];
    return lineasAprobadas.filter((l) => ["APROBADO", "EN_PROCESO", "PAGADO"].includes(l.estado_aprobacion));
  }, [lineasAprobadas, programacion]);

  const pagos = useMemo(() => {
    return lineasFiltradas.map((l, i) => {
      const existing = pagosEjecutados.find((p) => p.numero_factura === l.numero_factura && (p as any).semana === selectedSemana);
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
        semana: selectedSemana,
        _isStub: true,
      };
    });
  }, [lineasFiltradas, pagosEjecutados, programacion, selectedSemana]);

  const [edits, setEdits] = useState<Record<string, any>>({});
  const [sortCol, setSortCol] = useState<string>("proveedor");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [sortClicks, setSortClicks] = useState(0);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveReport, setArchiveReport] = useState<any>(null);
  const [archiveStep, setArchiveStep] = useState(0);

  // Import comprobantes state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importPreview, setImportPreview] = useState<any[] | null>(null);
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ updated: number; notFound: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        data.semana = selectedSemana;
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
    const alreadyArchived = historico.some((h) => h.semana === selectedSemana);
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
        numero_linea: p.numero_linea, semana: selectedSemana,
        periodo: selectedSemana.substring(0, 4) + "-" + String(new Date().getMonth() + 1).padStart(2, "0"),
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

  // Import comprobantes logic
  const findCol = (headers: string[], ...patterns: string[]) => {
    return headers.findIndex((h) => {
      const norm = h.toUpperCase().replace(/[^A-Z0-9]/g, "");
      return patterns.some((p) => norm.includes(p));
    });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
        if (json.length < 2) { toast.error("Archivo vacío o sin datos"); return; }
        const headers = (json[0] as string[]).map((h) => String(h || "").trim());
        const rows = json.slice(1, 6).map((r: any) => headers.map((_, i) => r[i] ?? ""));
        setImportHeaders(headers);
        setImportPreview(rows);
        setImportResult(null);
        setShowImportDialog(true);
      } catch {
        toast.error("Error al leer el archivo");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview) return;
    try {
      const fileInput = fileInputRef.current;
      // Re-read full file
      const file = fileInput?.files?.[0];
      // We already parsed, let's use stored data. Re-parse from the preview state isn't ideal.
      // Actually we need the full data. Let's re-trigger. Instead, store full rows.
    } catch { /* */ }
  };

  // Better approach: store all rows on parse
  const [importAllRows, setImportAllRows] = useState<any[]>([]);

  const handleImportFileFull = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });
        if (json.length < 2) { toast.error("Archivo vacío o sin datos"); return; }
        const headers = (json[0] as string[]).map((h) => String(h || "").trim());
        const allRows = json.slice(1).filter((r: any) => r.some((c: any) => c !== undefined && c !== ""));
        setImportHeaders(headers);
        setImportPreview(allRows.slice(0, 5).map((r: any) => headers.map((_, i) => r[i] ?? "")));
        setImportAllRows(allRows);
        setImportResult(null);
        setShowImportDialog(true);
      } catch {
        toast.error("Error al leer el archivo");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const processImport = async () => {
    const colFactura = findCol(importHeaders, "FACTURA", "NUMEROFACTURA", "NFACTURA");
    const colTransf = findCol(importHeaders, "TRANSFERENCIA", "COMPROBANTE", "NTRANSFERENCIA");
    const colFecha = findCol(importHeaders, "FECHAPAGO", "FECHA");
    const colBanco = findCol(importHeaders, "BANCOORIGEN", "BANCO");
    const colObs = findCol(importHeaders, "OBSERVACIONES", "OBSERV");

    if (colFactura < 0) { toast.error("No se encontró columna de factura"); return; }
    if (colTransf < 0) { toast.error("No se encontró columna de transferencia/comprobante"); return; }

    let updated = 0;
    const notFound: string[] = [];

    for (const row of importAllRows) {
      const numFactura = String(row[colFactura] ?? "").trim();
      if (!numFactura) continue;

      const pago = pagos.find((p) => p.numero_factura === numFactura);
      if (!pago) { notFound.push(numFactura); continue; }

      const updates: Record<string, any> = {};
      if (colTransf >= 0 && row[colTransf]) updates.numero_transferencia = String(row[colTransf]).trim();
      if (colFecha >= 0 && row[colFecha]) {
        const raw = row[colFecha];
        if (typeof raw === "number") {
          const d = XLSX.SSF.parse_date_code(raw);
          updates.fecha_pago = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        } else {
          updates.fecha_pago = String(raw).trim();
        }
      }
      if (colBanco >= 0 && row[colBanco]) updates.banco_origen = String(row[colBanco]).trim();
      if (colObs >= 0 && row[colObs]) updates.observaciones = String(row[colObs]).trim();

      if (Object.keys(updates).length === 0) continue;

      try {
        if ((pago as any)._isStub) {
          // Save stub first then update
          const { _isStub, id, ...data } = pago as any;
          data.semana = selectedSemana;
          Object.assign(data, updates);
          data.id = undefined;
          await addPagoEjecutado.mutateAsync(data);
        } else {
          await updatePagoEjecutado.mutateAsync({ id: pago.id, ...updates });
        }
        updated++;
      } catch {
        notFound.push(numFactura + " (error)");
      }
    }

    setImportResult({ updated, notFound });
    toast.success(`${updated} pago(s) actualizados`);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[hsl(var(--teal))]">Pagos Ejecutados</h2>
          <p className="text-sm text-muted-foreground">Semana {selectedSemana} — Confirme transferencias y datos bancarios</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedSemana(navigateWeek(selectedSemana, -1))}>
              <ChevronLeft size={16} />
            </Button>
            <Input type="week" value={selectedSemana} onChange={(e) => setSelectedSemana(e.target.value || semanaActual)} className="w-40" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedSemana(navigateWeek(selectedSemana, 1))}>
              <ChevronRight size={16} />
            </Button>
          </div>
          {canWrite() && (
            <>
              <input type="file" accept=".xlsx,.csv" ref={fileInputRef} className="hidden" onChange={handleImportFileFull} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} /> Importar Comprobantes
              </Button>
              <Button onClick={handleArchiveWeek} disabled={pagos.length === 0} className="bg-[hsl(var(--navy))] hover:bg-[hsl(var(--navy))]/90">
                <Archive size={16} /> Archivar Semana
              </Button>
            </>
          )}
        </div>
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

      {/* Archive Dialog */}
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

      {/* Import Comprobantes Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar Comprobantes — Semana {selectedSemana}</DialogTitle>
            <DialogDescription>
              Actualiza N° Transferencia, Fecha Pago, Banco Origen y Observaciones de pagos existentes.
            </DialogDescription>
          </DialogHeader>
          {importResult ? (
            <div className="space-y-3">
              <div className="bg-muted p-4 rounded-md text-sm space-y-2">
                <p className="font-semibold">✅ {importResult.updated} pago(s) actualizados</p>
                {importResult.notFound.length > 0 && (
                  <div>
                    <p className="text-[hsl(var(--warning))] font-medium">⚠ {importResult.notFound.length} factura(s) no encontradas:</p>
                    <ul className="list-disc list-inside mt-1 text-xs max-h-32 overflow-y-auto">
                      {importResult.notFound.map((nf) => <li key={nf} className="font-mono">{nf}</li>)}
                    </ul>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={() => { setShowImportDialog(false); setImportResult(null); }}>Cerrar</Button>
              </DialogFooter>
            </div>
          ) : importPreview ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Columnas detectadas: <strong>{importHeaders.join(", ")}</strong></p>
              <p className="text-xs text-muted-foreground">Mostrando primeras {importPreview.length} filas:</p>
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted">
                      {importHeaders.map((h, i) => <th key={i} className="px-2 py-1.5 text-left font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((row, ri) => (
                      <tr key={ri} className="border-t">
                        {row.map((cell: any, ci: number) => <td key={ci} className="px-2 py-1 truncate max-w-[150px]">{String(cell ?? "")}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">{importAllRows.length} fila(s) totales en el archivo</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancelar</Button>
                <Button onClick={processImport}>Importar {importAllRows.length} fila(s)</Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
