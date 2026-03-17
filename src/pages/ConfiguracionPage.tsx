import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Shield, Users } from "lucide-react";
import type { Rol } from "@/types";

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  ultimo_acceso: string;
}

const rolColors: Record<Rol, string> = {
  ADMIN: "bg-purple-100 text-purple-800",
  TESORERO: "bg-blue-100 text-blue-800",
  APROBADOR: "bg-[hsl(var(--success-light))] text-[hsl(var(--success))]",
  CONSULTA: "bg-muted text-muted-foreground",
};

const rolPermisos: Record<Rol, string> = {
  ADMIN: "Todo — configuración, usuarios, todas las operaciones",
  TESORERO: "Programar, ejecutar pagos, archivar, exportar",
  APROBADOR: "Ver programación, aprobar/rechazar líneas, ver histórico",
  CONSULTA: "Solo lectura en todos los módulos",
};

const initialUsers: Usuario[] = [
  { id: "u1", nombre: "Carlos Méndez", email: "carlos.mendez@camaronera.ec", rol: "ADMIN", activo: true, ultimo_acceso: "2026-03-17" },
  { id: "u2", nombre: "María Torres", email: "maria.torres@camaronera.ec", rol: "TESORERO", activo: true, ultimo_acceso: "2026-03-17" },
  { id: "u3", nombre: "Roberto Aguirre", email: "roberto.aguirre@camaronera.ec", rol: "APROBADOR", activo: true, ultimo_acceso: "2026-03-16" },
  { id: "u4", nombre: "Ana Villacís", email: "ana.villacis@camaronera.ec", rol: "CONSULTA", activo: true, ultimo_acceso: "2026-03-15" },
  { id: "u5", nombre: "Pedro Salazar", email: "pedro.salazar@camaronera.ec", rol: "CONSULTA", activo: false, ultimo_acceso: "2026-02-20" },
];

export default function ConfiguracionPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(initialUsers);
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRol, setFormRol] = useState<Rol>("CONSULTA");

  const openAdd = () => {
    setEditingUser(null);
    setFormNombre("");
    setFormEmail("");
    setFormRol("CONSULTA");
    setShowDialog(true);
  };

  const openEdit = (u: Usuario) => {
    setEditingUser(u);
    setFormNombre(u.nombre);
    setFormEmail(u.email);
    setFormRol(u.rol);
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!formNombre.trim() || !formEmail.trim()) {
      toast.error("Nombre y email son requeridos");
      return;
    }
    if (editingUser) {
      setUsuarios((prev) =>
        prev.map((u) => u.id === editingUser.id ? { ...u, nombre: formNombre, email: formEmail, rol: formRol } : u)
      );
      toast.success("Usuario actualizado");
    } else {
      const newUser: Usuario = {
        id: `u-${Date.now()}`,
        nombre: formNombre,
        email: formEmail,
        rol: formRol,
        activo: true,
        ultimo_acceso: "",
      };
      setUsuarios((prev) => [...prev, newUser]);
      toast.success("Usuario creado");
    }
    setShowDialog(false);
  };

  const toggleActivo = (id: string) => {
    setUsuarios((prev) => prev.map((u) => u.id === id ? { ...u, activo: !u.activo } : u));
  };

  const handleDelete = (id: string) => {
    setUsuarios((prev) => prev.filter((u) => u.id !== id));
    toast.info("Usuario eliminado");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[hsl(var(--teal))]">Configuración</h2>
          <p className="text-sm text-muted-foreground">Gestión de usuarios, roles y parámetros del sistema</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus size={16} /> Nuevo Usuario</Button>
      </div>

      {/* Roles Reference */}
      <div className="bg-card rounded-lg card-shadow p-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={18} className="text-[hsl(var(--teal))]" />
          <h3 className="font-semibold text-sm">Matriz de Roles y Permisos</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(Object.keys(rolPermisos) as Rol[]).map((rol) => (
            <div key={rol} className="border rounded-lg p-3">
              <Badge variant="outline" className={`${rolColors[rol]} mb-2`}>{rol}</Badge>
              <p className="text-xs text-muted-foreground">{rolPermisos[rol]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Users size={18} className="text-[hsl(var(--teal))]" />
          <h3 className="font-semibold text-sm">Usuarios del Sistema</h3>
          <span className="text-xs text-muted-foreground ml-auto">{usuarios.filter((u) => u.activo).length} activos</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead>Último Acceso</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((u) => (
              <TableRow key={u.id} className={!u.activo ? "opacity-50" : ""}>
                <TableCell className="font-medium text-sm">{u.nombre}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={rolColors[u.rol]}>{u.rol}</Badge>
                </TableCell>
                <TableCell>
                  <Switch checked={u.activo} onCheckedChange={() => toggleActivo(u.id)} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.ultimo_acceso || "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}>
                      <Pencil size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[hsl(var(--danger))]" onClick={() => handleDelete(u.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre</label>
              <Input value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="usuario@empresa.ec" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Rol</label>
              <Select value={formRol} onValueChange={(v) => setFormRol(v as Rol)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["ADMIN", "TESORERO", "APROBADOR", "CONSULTA"] as Rol[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${rolColors[r]} text-xs`}>{r}</Badge>
                        <span className="text-xs text-muted-foreground">{rolPermisos[r]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingUser ? "Guardar Cambios" : "Crear Usuario"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
