import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProveedores, useAddProveedor, useAddFacturas } from "@/hooks/useSupabaseData";
import { toast } from "sonner";
import { Plus, ChevronUp } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function NuevaFacturaDialog({ open, onOpenChange }: Props) {
  const { data: proveedores = [] } = useProveedores();
  const addProveedor = useAddProveedor();
  const addFacturas = useAddFacturas();

  const [proveedorId, setProveedorId] = useState("");
  const [searchProv, setSearchProv] = useState("");
  const [modoNuevo, setModoNuevo] = useState(false);

  // New provider fields
  const [newRazonSocial, setNewRazonSocial] = useState("");
  const [newRuc, setNewRuc] = useState("");
  const [newBanco, setNewBanco] = useState("");
  const [newCuenta, setNewCuenta] = useState("");
  const [newTipoCuenta, setNewTipoCuenta] = useState("CORRIENTE");
  const [newEmail, setNewEmail] = useState("");

  // Invoice fields
  const [numeroFactura, setNumeroFactura] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split("T")[0]);
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [saldoTotal, setSaldoTotal] = useState("");
  const [docInterno, setDocInterno] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [diasCredito, setDiasCredito] = useState("0");

  const [saving, setSaving] = useState(false);

  const selectedProv = useMemo(() => proveedores.find((p) => p.id === proveedorId), [proveedores, proveedorId]);

  const filteredProvs = useMemo(() => {
    if (!searchProv) return proveedores.filter((p) => p.activo);
    const q = searchProv.toLowerCase();
    return proveedores.filter((p) => p.activo && (p.razon_social.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)));
  }, [proveedores, searchProv]);

  const reset = () => {
    setProveedorId("");
    setSearchProv("");
    setModoNuevo(false);
    setNewRazonSocial("");
    setNewRuc("");
    setNewBanco("");
    setNewCuenta("");
    setNewTipoCuenta("CORRIENTE");
    setNewEmail("");
    setNumeroFactura("");
    setMotivo("");
    setFechaEmision(new Date().toISOString().split("T")[0]);
    setFechaVencimiento("");
    setSaldoTotal("");
    setDocInterno("");
    setObservaciones("");
    setPeriodo("");
    setDiasCredito("0");
    setSaving(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSave = async () => {
    // Validate invoice fields
    if (!numeroFactura.trim()) { toast.error("Número de factura requerido"); return; }
    if (!fechaEmision) { toast.error("Fecha de emisión requerida"); return; }
    if (!fechaVencimiento) { toast.error("Fecha de vencimiento requerida"); return; }

    const saldo = parseFloat(saldoTotal);
    if (isNaN(saldo)) { toast.error("Saldo total inválido"); return; }

    setSaving(true);

    try {
      let codigoProv: string;
      let razonSocial: string;

      if (modoNuevo) {
        // Validate new provider
        if (!newRazonSocial.trim()) { toast.error("Razón social del proveedor requerida"); setSaving(false); return; }

        // Check for duplicates
        const existByRuc = newRuc.trim() && proveedores.find((p) => p.ruc_ci === newRuc.trim());
        const existByName = proveedores.find((p) => p.razon_social.toLowerCase() === newRazonSocial.trim().toLowerCase());

        if (existByRuc) {
          toast.error(`Ya existe un proveedor con RUC ${newRuc}: ${existByRuc.razon_social}. Use el proveedor existente.`);
          setSaving(false);
          return;
        }
        if (existByName) {
          toast.error(`Ya existe un proveedor con esa razón social: ${existByName.codigo}. Use el proveedor existente.`);
          setSaving(false);
          return;
        }

        // Auto-generate code
        const maxNum = proveedores
          .filter((p) => p.codigo.startsWith("PROV-"))
          .map((p) => parseInt(p.codigo.replace("PROV-", "")) || 0)
          .reduce((m, n) => Math.max(m, n), 0);
        codigoProv = `PROV-${String(maxNum + 1).padStart(3, "0")}`;
        razonSocial = newRazonSocial.trim();

        await addProveedor.mutateAsync({
          codigo: codigoProv,
          razon_social: razonSocial,
          ruc_ci: newRuc.trim() || "0000000000001",
          banco: newBanco.trim(),
          numero_cuenta: newCuenta.trim(),
          tipo_cuenta: newTipoCuenta,
          email_cobros: newEmail.trim(),
          telefono: "",
        });
      } else {
        if (!selectedProv) { toast.error("Seleccione un proveedor"); setSaving(false); return; }
        codigoProv = selectedProv.codigo;
        razonSocial = selectedProv.razon_social;
      }

      await addFacturas.mutateAsync([{
        codigo_proveedor: codigoProv,
        razon_social: razonSocial,
        numero_factura: numeroFactura.trim(),
        motivo: motivo.trim(),
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        saldo_total: saldo,
        doc_interno: docInterno.trim(),
        observaciones: observaciones.trim(),
        periodo: periodo.trim(),
        dias_credito: parseInt(diasCredito) || 0,
        origen: 'MANUAL',
      }]);

      toast.success(modoNuevo ? "Proveedor creado y factura registrada" : "Factura registrada exitosamente");
      handleClose(false);
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Factura</DialogTitle>
          <DialogDescription>Registra una factura manualmente seleccionando o creando un proveedor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Provider section */}
          <div className="space-y-2">
            <Label className="font-semibold">Proveedor</Label>
            {!modoNuevo ? (
              <>
                <Input
                  placeholder="Buscar proveedor…"
                  value={searchProv}
                  onChange={(e) => setSearchProv(e.target.value)}
                />
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {filteredProvs.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">Sin resultados</p>
                  ) : (
                    filteredProvs.slice(0, 50).map((p) => (
                      <div
                        key={p.id}
                        className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50 transition-colors ${proveedorId === p.id ? "bg-primary/10 font-medium" : ""}`}
                        onClick={() => { setProveedorId(p.id); setSearchProv(""); }}
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
                <Button variant="link" size="sm" className="p-0 h-auto text-xs gap-1" onClick={() => { setModoNuevo(true); setProveedorId(""); }}>
                  <Plus size={12} /> Crear nuevo proveedor
                </Button>
              </>
            ) : (
              <div className="border rounded-md p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Nuevo proveedor</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setModoNuevo(false)}>
                    <ChevronUp size={12} /> Usar existente
                  </Button>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label className="text-xs">Razón Social *</Label>
                    <Input value={newRazonSocial} onChange={(e) => setNewRazonSocial(e.target.value)} placeholder="Nombre del proveedor" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">RUC / CI</Label>
                      <Input value={newRuc} onChange={(e) => setNewRuc(e.target.value)} placeholder="0000000000001" />
                    </div>
                    <div>
                      <Label className="text-xs">Email Cobros</Label>
                      <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="cobros@..." />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs">Banco</Label>
                      <Input value={newBanco} onChange={(e) => setNewBanco(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">N° Cuenta</Label>
                      <Input value={newCuenta} onChange={(e) => setNewCuenta(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Tipo Cuenta</Label>
                      <Select value={newTipoCuenta} onValueChange={setNewTipoCuenta}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CORRIENTE">Corriente</SelectItem>
                          <SelectItem value="AHORROS">Ahorros</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Invoice fields */}
          <div className="space-y-3 border-t pt-3">
            <Label className="font-semibold">Datos de la Factura</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">N° Factura *</Label>
                <Input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="001-001-000000001" />
              </div>
              <div>
                <Label className="text-xs">Saldo Total *</Label>
                <Input type="number" step="0.01" value={saldoTotal} onChange={(e) => setSaldoTotal(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Motivo</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descripción…" />
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
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando…" : "Guardar Factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
