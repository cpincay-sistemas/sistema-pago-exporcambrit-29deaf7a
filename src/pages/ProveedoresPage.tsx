import { useState, useMemo } from "react";
import { useProveedores, useAddProveedor, useUpdateProveedor } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Search, Upload } from "lucide-react";
import { validarRUC, formatDate } from "@/lib/business-rules";
import { toast } from "sonner";
import ImportProveedoresDialog from "@/components/ImportProveedoresDialog";

export default function ProveedoresPage() {
  const { data: proveedores = [] } = useProveedores();
  const addProveedor = useAddProveedor();
  const updateProveedor = useUpdateProveedor();
  const { canWrite } = useAuth();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const filtered = useMemo(() => {
    if (!search) return proveedores;
    const q = search.toLowerCase();
    return proveedores.filter((p) =>
      p.razon_social.toLowerCase().includes(q) || p.ruc_ci.includes(q) || p.codigo.toLowerCase().includes(q)
    );
  }, [proveedores, search]);

  const handleSave = async (data: any) => {
    if (!data.ruc_ci || !validarRUC(data.ruc_ci)) {
      toast.error("RUC inválido. Debe tener 13 dígitos y terminar en 001.");
      return;
    }
    try {
      if (editing) {
        await updateProveedor.mutateAsync({ id: editing.id, ...data });
        toast.success("Proveedor actualizado");
      } else {
        const codigo = `PROV-${String(proveedores.length + 1).padStart(3, "0")}`;
        await addProveedor.mutateAsync({ codigo, ...data });
        toast.success("Proveedor creado");
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-teal">Proveedores</h2>
          <p className="text-sm text-muted-foreground">{proveedores.filter((p) => p.activo).length} activos de {proveedores.length} registrados</p>
        </div>
        {canWrite() && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus size={15} /> Nuevo Proveedor</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editing ? "Editar" : "Nuevo"} Proveedor</DialogTitle>
              </DialogHeader>
              <ProveedorForm initial={editing} onSave={handleSave} onCancel={() => { setDialogOpen(false); setEditing(null); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nombre, RUC o código…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {["Código", "RUC", "Razón Social", "Banco", "Cuenta", "Tipo", "Email", "Verificación", "Estado", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs uppercase tracking-wider text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.codigo}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{p.ruc_ci}</td>
                  <td className="px-4 py-3 font-medium">{p.razon_social}</td>
                  <td className="px-4 py-3">{p.banco}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{p.numero_cuenta}</td>
                  <td className="px-4 py-3 text-xs">{p.tipo_cuenta}</td>
                  <td className="px-4 py-3 text-xs">{p.email_cobros}</td>
                  <td className="px-4 py-3 tabular-nums">{p.fecha_verificacion ? formatDate(p.fecha_verificacion) : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${p.activo ? "status-pagada" : "status-pendiente"}`}>
                      {p.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canWrite() && (
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                        <Pencil size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">No hay proveedores registrados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProveedorForm({ initial, onSave, onCancel }: { initial: any; onSave: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    ruc_ci: initial?.ruc_ci || "",
    razon_social: initial?.razon_social || "",
    banco: initial?.banco || "",
    numero_cuenta: initial?.numero_cuenta || "",
    tipo_cuenta: initial?.tipo_cuenta || "CORRIENTE",
    email_cobros: initial?.email_cobros || "",
    telefono: initial?.telefono || "",
  });

  const update = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><Label>RUC / CI</Label><Input value={form.ruc_ci} onChange={(e) => update("ruc_ci", e.target.value)} placeholder="0990000000001" /></div>
        <div><Label>Razón Social</Label><Input value={form.razon_social} onChange={(e) => update("razon_social", e.target.value)} /></div>
        <div><Label>Banco</Label>
          <Select value={form.banco} onValueChange={(v) => update("banco", v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {["Produbanco", "Banco Pichincha", "Banco Guayaquil", "Banco del Pacífico"].map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Nro. Cuenta</Label><Input value={form.numero_cuenta} onChange={(e) => update("numero_cuenta", e.target.value)} /></div>
        <div><Label>Tipo Cuenta</Label>
          <Select value={form.tipo_cuenta} onValueChange={(v) => update("tipo_cuenta", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CORRIENTE">Corriente</SelectItem>
              <SelectItem value="AHORROS">Ahorros</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Email Cobros</Label><Input type="email" value={form.email_cobros} onChange={(e) => update("email_cobros", e.target.value)} /></div>
        <div><Label>Teléfono</Label><Input value={form.telefono} onChange={(e) => update("telefono", e.target.value)} /></div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)}>Guardar</Button>
      </div>
    </div>
  );
}
