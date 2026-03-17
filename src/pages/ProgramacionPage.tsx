import { useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/store/app-store";
import { getCurrentISOWeek, formatUSD, formatDate, calcularDiasVencidos, calcularPrioridad } from "@/lib/business-rules";
import { PrioridadBadge } from "@/components/PrioridadBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, XCircle, Save, Send } from "lucide-react";
import type { ProgramacionSemana, ProgramacionLinea, FormaPago, EstadoAprobacion } from "@/types";

const FORMAS_PAGO: FormaPago[] = ["TRANSFERENCIA", "CHEQUE", "EFECTIVO", "ACH"];

const estadoColors: Record<EstadoAprobacion, string> = {
  PENDIENTE: "bg-yellow-100 text-yellow-800",
  APROBADO: "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]",
  RECHAZADO: "bg-[hsl(var(--danger-light))] text-[hsl(var(--danger))]",
  EN_PROCESO: "bg-blue-100 text-blue-800",
  PAGADO: "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]",
};

export default function ProgramacionPage() {
  const {
    proveedores, facturas, historico, programaciones, lineasProgramacion,
    addProgramacion, updateProgramacion, addLineaProgramacion,
    updateLineaProgramacion, deleteLineaProgramacion, getSaldoRealPendiente,
  } = useAppStore();

  const semanaActual = getCurrentISOWeek();
  const [selectedSemana, setSelectedSemana] = useState(semanaActual);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLimiteDialog, setShowLimiteDialog] = useState(false);
  const [limiteInput, setLimiteInput] = useState("50000");

  // Get or create programacion for selected week
  const programacion = useMemo(() => {
    return programaciones.find((p) => p.semana === selectedSemana);
  }, [programaciones, selectedSemana]);

  const lineas = useMemo(() => {
    if (!programacion) return [];
    return lineasProgramacion.filter((l) => l.semana_id === programacion.id);
  }, [lineasProgramacion, programacion]);

  const totalAprobado = useMemo(() => {
    return lineas
      .filter((l) => l.estado_aprobacion !== "RECHAZADO")
      .reduce((sum, l) => sum + l.monto_a_pagar, 0);
  }, [lineas]);

  const limite = programacion?.limite_disponible ?? 50000;

  const ensureProgramacion = useCallback(() => {
    if (programacion) return programacion;
    const newProg: ProgramacionSemana = {
      id: `prog-${selectedSemana}`,
      semana: selectedSemana,
      aprobado_por: "",
      limite_disponible: parseFloat(limiteInput) || 50000,
      fecha_aprobacion: "",
      estado_semana: "BORRADOR",
    };
    addProgramacion(newProg);
    return newProg;
  }, [programacion, selectedSemana, limiteInput, addProgramacion]);

  // Unique active providers
  const proveedoresActivos = useMemo(() => {
    return proveedores.filter((p) => p.activo).sort((a, b) => a.razon_social.localeCompare(b.razon_social));
  }, [proveedores]);

  // Add line form state
  const [newProveedorId, setNewProveedorId] = useState("");
  const [newFacturaId, setNewFacturaId] = useState("");
  const [newFormaPago, setNewFormaPago] = useState<FormaPago>("TRANSFERENCIA");
  const [newMonto, setNewMonto] = useState("");
  const [newObs, setNewObs] = useState("");
  const [newResponsable, setNewResponsable] = useState("María Torres");
  const [newFechaProg, setNewFechaProg] = useState(new Date().toISOString().split("T")[0]);

  const selectedProveedor = proveedoresActivos.find((p) => p.id === newProveedorId);
  const facturasProveedor = useMemo(() => {
    if (!selectedProveedor) return [];
    return facturas.filter((f) => f.codigo_proveedor === selectedProveedor.codigo);
  }, [facturas, selectedProveedor]);

  const selectedFactura = facturas.find((f) => f.id === newFacturaId);
  const saldoReal = selectedFactura ? getSaldoRealPendiente(selectedFactura.numero_factura) : 0;

  const handleAddLine = () => {
    if (!selectedProveedor || !selectedFactura) {
      toast.error("Seleccione proveedor y factura");
      return;
    }
    const monto = parseFloat(newMonto) || saldoReal;
    if (monto <= 0) {
      toast.error("El monto debe ser mayor a 0");
      return;
    }
    if (monto > saldoReal) {
      toast.error(`El monto no puede exceder el saldo real pendiente (${formatUSD(saldoReal)})`);
      return;
    }
    // Check duplicate in current week
    const prog = ensureProgramacion();
    const existing = lineasProgramacion.find(
      (l) => l.semana_id === prog.id && l.numero_factura === selectedFactura.numero_factura
    );
    if (existing) {
      toast.error("Esta factura ya está programada en esta semana");
      return;
    }
    // Check limit
    if (totalAprobado + monto > limite) {
      toast.warning("El monto excede el límite disponible de la semana");
    }

    const diasVencidos = calcularDiasVencidos(selectedFactura.fecha_vencimiento);
    const newLine: ProgramacionLinea = {
      id: `pl-${Date.now()}`,
      semana_id: prog.id,
      razon_social: selectedProveedor.razon_social,
      codigo_proveedor: selectedProveedor.codigo,
      numero_factura: selectedFactura.numero_factura,
      fecha_vencimiento: selectedFactura.fecha_vencimiento,
      estado_aprobacion: "PENDIENTE",
      dias_vencidos: diasVencidos,
      prioridad: calcularPrioridad(diasVencidos),
      forma_pago: newFormaPago,
      banco_destino: selectedProveedor.banco,
      cuenta_destino: selectedProveedor.numero_cuenta,
      saldo_real_pendiente: saldoReal,
      monto_a_pagar: monto,
      observaciones: newObs,
      responsable_pago: newResponsable,
      fecha_programada: newFechaProg,
    };
    addLineaProgramacion(newLine);
    toast.success("Línea agregada a la programación");
    setShowAddDialog(false);
    resetForm();
  };

  const resetForm = () => {
    setNewProveedorId("");
    setNewFacturaId("");
    setNewMonto("");
    setNewObs("");
  };

  const handleApprove = (id: string) => {
    updateLineaProgramacion(id, { estado_aprobacion: "APROBADO" });
    toast.success("Línea aprobada");
  };
  const handleReject = (id: string) => {
    updateLineaProgramacion(id, { estado_aprobacion: "RECHAZADO" });
    toast.info("Línea rechazada");
  };
  const handleDelete = (id: string) => {
    deleteLineaProgramacion(id);
    toast.info("Línea eliminada");
  };

  const handleApproveAll = () => {
    lineas.filter((l) => l.estado_aprobacion === "PENDIENTE").forEach((l) => {
      updateLineaProgramacion(l.id, { estado_aprobacion: "APROBADO" });
    });
    if (programacion) {
      updateProgramacion(programacion.id, {
        estado_semana: "APROBADO",
        aprobado_por: "Carlos Méndez",
        fecha_aprobacion: new Date().toISOString().split("T")[0],
      });
    }
    toast.success("Todas las líneas pendientes aprobadas");
  };

  const handleUpdateLimite = () => {
    const val = parseFloat(limiteInput);
    if (isNaN(val) || val <= 0) {
      toast.error("Ingrese un límite válido");
      return;
    }
    if (programacion) {
      updateProgramacion(programacion.id, { limite_disponible: val });
    } else {
      ensureProgramacion();
    }
    setShowLimiteDialog(false);
    toast.success("Límite actualizado");
  };

  const limiteUsado = (totalAprobado / limite) * 100;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[hsl(var(--teal))]">Programación Semanal de Pagos</h2>
          <p className="text-sm text-muted-foreground">
            Semana {selectedSemana} — {programacion?.estado_semana ?? "BORRADOR"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            type="week"
            value={selectedSemana}
            onChange={(e) => setSelectedSemana(e.target.value || semanaActual)}
            className="w-40"
          />
          <Button variant="outline" size="sm" onClick={() => setShowLimiteDialog(true)}>
            Límite: {formatUSD(limite)}
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)}>
            <Plus size={16} /> Agregar Línea
          </Button>
        </div>
      </div>

      {/* Limit bar */}
      <div className="bg-card rounded-lg card-shadow p-4">
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">Uso del límite semanal</span>
          <span className="font-medium tabular-nums">
            {formatUSD(totalAprobado)} / {formatUSD(limite)}
          </span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              limiteUsado > 100 ? "bg-[hsl(var(--danger))]" : limiteUsado > 80 ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]"
            }`}
            style={{ width: `${Math.min(limiteUsado, 100)}%` }}
          />
        </div>
        {limiteUsado > 100 && (
          <p className="text-xs text-[hsl(var(--danger))] mt-1">⚠ Excede el límite por {formatUSD(totalAprobado - limite)}</p>
        )}
      </div>

      {/* Table */}
      {lineas.length === 0 ? (
        <div className="bg-card rounded-lg card-shadow p-12 text-center">
          <p className="text-muted-foreground">No hay líneas programadas para esta semana</p>
          <p className="text-sm text-muted-foreground mt-1">Haga clic en "Agregar Línea" para empezar</p>
        </div>
      ) : (
        <>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleApproveAll}>
              <CheckCircle2 size={16} /> Aprobar Todas
            </Button>
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
                {lineas.map((l) => (
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
                    <TableCell><PrioridadBadge prioridad={l.prioridad} /></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={estadoColors[l.estado_aprobacion]}>
                        {l.estado_aprobacion}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{l.forma_pago}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatUSD(l.saldo_real_pendiente)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-sm">{formatUSD(l.monto_a_pagar)}</TableCell>
                    <TableCell className="text-sm">{l.responsable_pago}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {l.estado_aprobacion === "PENDIENTE" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-[hsl(var(--success))]" onClick={() => handleApprove(l.id)}>
                              <CheckCircle2 size={15} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-[hsl(var(--danger))]" onClick={() => handleReject(l.id)}>
                              <XCircle size={15} />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleDelete(l.id)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-4 text-sm">
            <span className="text-muted-foreground">
              {lineas.length} líneas — {lineas.filter((l) => l.estado_aprobacion === "APROBADO").length} aprobadas
            </span>
            <span className="font-semibold">Total: {formatUSD(totalAprobado)}</span>
          </div>
        </>
      )}

      {/* Add Line Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar Línea de Programación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Proveedor</label>
              <Select value={newProveedorId} onValueChange={(v) => { setNewProveedorId(v); setNewFacturaId(""); setNewMonto(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccione proveedor" /></SelectTrigger>
                <SelectContent>
                  {proveedoresActivos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.razon_social}</SelectItem>
                  ))}
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
              <label className="text-sm font-medium mb-1 block">Factura</label>
              <Select value={newFacturaId} onValueChange={(v) => { setNewFacturaId(v); setNewMonto(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccione factura" /></SelectTrigger>
                <SelectContent>
                  {facturasProveedor.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.numero_factura} — {formatUSD(f.saldo_total)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFactura && (
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted rounded-md text-xs">
                <div><span className="text-muted-foreground">Motivo:</span> {selectedFactura.motivo}</div>
                <div><span className="text-muted-foreground">Vencimiento:</span> {formatDate(selectedFactura.fecha_vencimiento)}</div>
                <div><span className="text-muted-foreground">Saldo Real Pendiente:</span> <strong>{formatUSD(saldoReal)}</strong></div>
                <div><span className="text-muted-foreground">Prioridad:</span> <PrioridadBadge prioridad={calcularPrioridad(calcularDiasVencidos(selectedFactura.fecha_vencimiento))} /></div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Monto a Pagar</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={saldoReal > 0 ? saldoReal.toFixed(2) : "0.00"}
                  value={newMonto}
                  onChange={(e) => setNewMonto(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-0.5">Máx: {formatUSD(saldoReal)}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Forma de Pago</label>
                <Select value={newFormaPago} onValueChange={(v) => setNewFormaPago(v as FormaPago)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMAS_PAGO.map((fp) => (
                      <SelectItem key={fp} value={fp}>{fp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Responsable</label>
                <Input value={newResponsable} onChange={(e) => setNewResponsable(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Fecha Programada</label>
                <Input type="date" value={newFechaProg} onChange={(e) => setNewFechaProg(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Observaciones</label>
              <Input value={newObs} onChange={(e) => setNewObs(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddLine}><Plus size={16} /> Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Limite Dialog */}
      <Dialog open={showLimiteDialog} onOpenChange={setShowLimiteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Configurar Límite Semanal</DialogTitle></DialogHeader>
          <div>
            <label className="text-sm font-medium mb-1 block">Límite Disponible (USD)</label>
            <Input type="number" step="0.01" value={limiteInput} onChange={(e) => setLimiteInput(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimiteDialog(false)}>Cancelar</Button>
            <Button onClick={handleUpdateLimite}><Save size={16} /> Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
