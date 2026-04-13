import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFacturas, useAddFacturas, useUpdateFactura, useHistorico } from "@/hooks/useSupabaseData";
import { toast } from "sonner";
import { formatUSD } from "@/lib/business-rules";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proforma: any;
}

export default function ConvertirProformaDialog({ open, onOpenChange, proforma }: Props) {
  const { data: facturas = [] } = useFacturas();
  const { data: historico = [] } = useHistorico();
  const addFacturas = useAddFacturas();
  const updateFactura = useUpdateFactura();

  const [numeroFactura, setNumeroFactura] = useState("");
  const [montoFactura, setMontoFactura] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  const anticipos = proforma
    ? historico
        .filter((h) => h.numero_factura === proforma.numero_factura && h.codigo_proveedor === proforma.codigo_proveedor)
        .reduce((s, h) => s + Number(h.monto_pagado), 0)
    : 0;

  const monto = parseFloat(montoFactura) || 0;
  const saldoResultante = monto - anticipos;

  const reset = () => {
    setNumeroFactura("");
    setMontoFactura("");
    setObservaciones("");
    setSaving(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleConvert = async () => {
    if (!numeroFactura.trim()) {
      toast.error("N° Factura oficial es requerido");
      return;
    }
    if (!montoFactura || isNaN(parseFloat(montoFactura))) {
      toast.error("Monto de la factura es requerido");
      return;
    }

    // Check duplicate
    const exists = facturas.find(
      (f) => f.numero_factura === numeroFactura.trim() && f.codigo_proveedor === proforma.codigo_proveedor && f.id !== proforma.id
    );
    if (exists) {
      toast.error(`Ya existe la factura ${numeroFactura} para este proveedor`);
      return;
    }

    setSaving(true);
    try {
      const saldoFinal = Math.max(0, saldoResultante);

      await addFacturas.mutateAsync([{
        origen: "MANUAL",
        tipo: "FACTURA",
        codigo_proveedor: proforma.codigo_proveedor,
        razon_social: proforma.razon_social,
        numero_factura: numeroFactura.trim(),
        saldo_total: saldoFinal,
        periodo: proforma.periodo || "",
        fecha_emision: new Date().toISOString().split("T")[0],
        fecha_vencimiento: proforma.fecha_vencimiento,
        observaciones: `Convertida desde proforma ${proforma.numero_factura}${observaciones ? ". " + observaciones : ""}`,
        referencia_proforma_id: proforma.id,
        dias_credito: proforma.dias_credito || 0,
        motivo: proforma.motivo || "",
        doc_interno: proforma.doc_interno || "",
      }]);

      await updateFactura.mutateAsync({ id: proforma.id, tipo: "PROFORMA_CONVERTIDA" });

      const antMsg = anticipos > 0 ? ` (descontados ${formatUSD(anticipos)} de anticipos pagados)` : "";
      toast.success(`Factura ${numeroFactura} creada con saldo ${formatUSD(saldoFinal)}${antMsg}`);
      handleClose(false);
    } catch (err: any) {
      toast.error(err.message || "Error al convertir");
    } finally {
      setSaving(false);
    }
  };

  if (!proforma) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Convertir Proforma a Factura</DialogTitle>
          <DialogDescription>
            Proforma: <strong>{proforma.numero_factura}</strong> — {proforma.razon_social}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">N° Factura Oficial (SRI) *</Label>
            <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="001-001-000000001" />
          </div>
          <div>
            <Label className="text-xs">Monto de la Factura Oficial *</Label>
            <Input type="number" step="0.01" value={montoFactura} onChange={(e) => setMontoFactura(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <Label className="text-xs">Observaciones</Label>
            <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
          </div>

          {anticipos > 0 && (
            <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/30">
              <p>Anticipos pagados: <strong>{formatUSD(anticipos)}</strong></p>
              <p>Monto factura: <strong>{formatUSD(monto)}</strong></p>
              <p>Saldo resultante: <strong>{formatUSD(Math.max(0, saldoResultante))}</strong></p>
            </div>
          )}

          {anticipos > 0 && anticipos >= monto && monto > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Los anticipos pagados ({formatUSD(anticipos)}) cubren el total de la factura ({formatUSD(monto)}). El saldo resultante será $0.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleConvert} disabled={saving}>
            {saving ? "Convirtiendo…" : "Convertir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
