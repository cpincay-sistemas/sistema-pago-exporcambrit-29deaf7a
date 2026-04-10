import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProveedores, useFacturas, useUpdateFactura } from "@/hooks/useSupabaseData";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  factura: any | null;
}

export default function EditFacturaDialog({ open, onOpenChange, factura }: Props) {
  const { data: proveedores = [] } = useProveedores();
  const { data: facturas = [] } = useFacturas();
  const updateFactura = useUpdateFactura();

  const [proveedorCodigo, setProveedorCodigo] = useState("");
  const [searchProv, setSearchProv] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fechaEmision, setFechaEmision] = useState("");
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [saldoTotal, setSaldoTotal] = useState("");
  const [docInterno, setDocInterno] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [diasCredito, setDiasCredito] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (factura && open) {
      setProveedorCodigo(factura.codigo_proveedor || "");
      setNumeroFactura(factura.numero_factura || "");
      setMotivo(factura.motivo || "");
      setFechaEmision(factura.fecha_emision || "");
      setFechaVencimiento(factura.fecha_vencimiento || "");
      setSaldoTotal(String(factura.saldo_total ?? ""));
      setDocInterno(factura.doc_interno || "");
      setObservaciones(factura.observaciones || "");
      setPeriodo(factura.periodo || "");
      setDiasCredito(String(factura.dias_credito ?? "0"));
      setSearchProv("");
    }
  }, [factura, open]);

  const filteredProvs = useMemo(() => {
    const active = proveedores.filter((p) => p.activo);
    if (!searchProv) return active;
    const q = searchProv.toLowerCase();
    return active.filter((p) => p.razon_social.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q));
  }, [proveedores, searchProv]);

  const selectedProv = useMemo(() => proveedores.find((p) => p.codigo === proveedorCodigo), [proveedores, proveedorCodigo]);

  const handleSave = async () => {
    if (!factura) return;
    if (!numeroFactura.trim()) { toast.error("Número de factura requerido"); return; }
    if (!fechaEmision) { toast.error("Fecha de emisión requerida"); return; }
    if (!fechaVencimiento) { toast.error("Fecha de vencimiento requerida"); return; }
    if (!proveedorCodigo) { toast.error("Seleccione un proveedor"); return; }

    const saldo = parseFloat(saldoTotal);
    if (isNaN(saldo)) { toast.error("Saldo total inválido"); return; }

    // Validate unique constraint: codigo_proveedor + numero_factura (excluding self)
    const duplicate = facturas.find(
      (f) => f.id !== factura.id && f.codigo_proveedor === proveedorCodigo && f.numero_factura === numeroFactura.trim()
    );
    if (duplicate) {
      toast.error(`Ya existe una factura ${numeroFactura.trim()} para ese proveedor`);
      return;
    }

    setSaving(true);
    try {
      const prov = proveedores.find((p) => p.codigo === proveedorCodigo);
      await updateFactura.mutateAsync({
        id: factura.id,
        codigo_proveedor: proveedorCodigo,
        razon_social: prov?.razon_social || factura.razon_social,
        numero_factura: numeroFactura.trim(),
        motivo: motivo.trim(),
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        saldo_total: saldo,
        doc_interno: docInterno.trim(),
        observaciones: observaciones.trim(),
        periodo: periodo.trim(),
        dias_credito: parseInt(diasCredito) || 0,
      });
      toast.success("Factura actualizada");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Factura</DialogTitle>
          <DialogDescription>Modifica los datos de esta factura manual.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-semibold">Proveedor</Label>
            <Input placeholder="Buscar proveedor…" value={searchProv} onChange={(e) => setSearchProv(e.target.value)} />
            <div className="border rounded-md max-h-32 overflow-y-auto">
              {filteredProvs.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2 text-center">Sin resultados</p>
              ) : (
                filteredProvs.slice(0, 50).map((p) => (
                  <div
                    key={p.id}
                    className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${proveedorCodigo === p.codigo ? "bg-primary/10 font-medium" : ""}`}
                    onClick={() => { setProveedorCodigo(p.codigo); setSearchProv(""); }}
                  >
                    <span className="font-mono text-xs text-muted-foreground mr-2">{p.codigo}</span>
                    {p.razon_social}
                  </div>
                ))
              )}
            </div>
            {selectedProv && (
              <p className="text-xs text-muted-foreground">
                Seleccionado: <strong>{selectedProv.codigo}</strong> — {selectedProv.razon_social}
              </p>
            )}
          </div>

          <div className="space-y-3 border-t pt-3">
            <Label className="font-semibold">Datos de la Factura</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">N° Factura *</Label>
                <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Saldo Total *</Label>
                <Input type="number" step="0.01" value={saldoTotal} onChange={(e) => setSaldoTotal(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Fecha Emisión *</Label>
                <Input type="date" value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fecha Vencimiento *</Label>
                <Input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Periodo</Label>
                <Input value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="2026-01" />
              </div>
              <div>
                <Label className="text-xs">Doc. Interno</Label>
                <Input value={docInterno} onChange={(e) => setDocInterno(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Días Crédito</Label>
                <Input type="number" value={diasCredito} onChange={(e) => setDiasCredito(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observaciones</Label>
              <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar Cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
