import { useState } from "react";
import { useProfiles, useUserRoles, useUpdateUserRole, useUpdateProfile } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Shield, Users, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Rol } from "@/types";

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

const DANGER_ACTIONS = [
  { key: "facturas", label: "Limpiar Base CxP", desc: "Elimina todas las facturas de cuentas por pagar" },
  { key: "proveedores", label: "Limpiar Proveedores", desc: "Elimina todos los proveedores registrados" },
  { key: "historico", label: "Limpiar Histórico", desc: "Elimina todo el historial de pagos" },
  { key: "programacion", label: "Limpiar Programación + Pagos", desc: "Elimina programaciones, líneas y pagos ejecutados" },
] as const;

export default function ConfiguracionPage() {
  const { data: profiles = [] } = useProfiles();
  const { data: userRoles = [] } = useUserRoles();
  const updateUserRole = useUpdateUserRole();
  const updateProfile = useUpdateProfile();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: string; label: string } | null>(null);
  const [resetAllDialog, setResetAllDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isAdmin()) {
    return (
      <div className="p-12 text-center">
        <p className="text-muted-foreground">No tiene permisos para acceder a esta sección.</p>
      </div>
    );
  }

  const getUserRole = (userId: string): Rol => {
    const ur = userRoles.find((r) => r.user_id === userId);
    return (ur?.role as Rol) || "CONSULTA";
  };

  const handleRoleChange = async (userId: string, newRole: Rol) => {
    try {
      await updateUserRole.mutateAsync({ userId, role: newRole });
      toast.success("Rol actualizado");
    } catch (err: any) {
      toast.error(err.message || "Error al actualizar rol");
    }
  };

  const handleToggleActivo = async (userId: string, activo: boolean) => {
    try {
      await updateProfile.mutateAsync({ id: userId, activo: !activo });
      toast.success(activo ? "Usuario desactivado" : "Usuario activado");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const clearTable = async (action: string) => {
    setLoading(true);
    try {
      if (action === "facturas") {
        const { error } = await supabase.from("facturas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      } else if (action === "proveedores") {
        const { error } = await supabase.from("proveedores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      } else if (action === "historico") {
        const { error } = await supabase.from("historico").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      } else if (action === "programacion") {
        await supabase.from("pagos_ejecutados").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("lineas_programacion").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("programaciones").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      queryClient.invalidateQueries();
      toast.success("Datos eliminados correctamente");
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar datos");
    } finally {
      setLoading(false);
      setConfirmDialog(null);
    }
  };

  const handleResetAll = async () => {
    if (confirmText !== "CONFIRMAR") { toast.error("Escriba CONFIRMAR para continuar"); return; }
    setLoading(true);
    try {
      await supabase.from("pagos_ejecutados").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("lineas_programacion").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("programaciones").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("historico").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("facturas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("proveedores").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      queryClient.invalidateQueries();
      toast.success("Todos los datos han sido eliminados");
      setResetAllDialog(false);
      setConfirmText("");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Error al resetear datos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-[hsl(var(--teal))]">Configuración</h2>
        <p className="text-sm text-muted-foreground">Gestión de usuarios, roles y parámetros del sistema</p>
      </div>

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

      <div className="bg-card rounded-lg card-shadow overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Users size={18} className="text-[hsl(var(--teal))]" />
          <h3 className="font-semibold text-sm">Usuarios del Sistema</h3>
          <span className="text-xs text-muted-foreground ml-auto">{profiles.filter((u) => u.activo).length} activos</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Activo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((u) => (
              <TableRow key={u.id} className={!u.activo ? "opacity-50" : ""}>
                <TableCell className="font-medium text-sm">{u.nombre || "Sin nombre"}</TableCell>
                <TableCell className="text-sm">{u.email}</TableCell>
                <TableCell>
                  <Select value={getUserRole(u.id)} onValueChange={(v) => handleRoleChange(u.id, v as Rol)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["ADMIN", "TESORERO", "APROBADOR", "CONSULTA"] as Rol[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          <Badge variant="outline" className={`${rolColors[r]} text-xs`}>{r}</Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Switch checked={u.activo} onCheckedChange={() => handleToggleActivo(u.id, u.activo)} />
                </TableCell>
              </TableRow>
            ))}
            {profiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay usuarios registrados</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-600" />
          <h3 className="font-semibold text-sm text-red-800">Zona de Peligro</h3>
        </div>
        <p className="text-xs text-red-600">Estas acciones son irreversibles. Todos los datos eliminados no podrán recuperarse.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DANGER_ACTIONS.map((a) => (
            <div key={a.key} className="flex items-center justify-between border border-red-200 rounded-lg p-3 bg-white">
              <div>
                <p className="text-sm font-medium text-red-800">{a.label}</p>
                <p className="text-xs text-red-500">{a.desc}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
                onClick={() => setConfirmDialog({ open: true, action: a.key, label: a.label })}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t border-red-200">
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => { setResetAllDialog(true); setConfirmText(""); }}
          >
            <AlertTriangle size={16} /> Resetear TODO
          </Button>
        </div>
      </div>

      {/* Confirm single action */}
      <Dialog open={!!confirmDialog?.open} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿{confirmDialog?.label}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción es irreversible. ¿Desea continuar?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={loading} onClick={() => confirmDialog && clearTable(confirmDialog.action)}>
              {loading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset ALL dialog */}
      <Dialog open={resetAllDialog} onOpenChange={setResetAllDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-700">Resetear TODOS los datos</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminarán <strong>todas</strong> las facturas, proveedores, histórico, programaciones y pagos ejecutados. Escriba <strong>CONFIRMAR</strong> para continuar.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Escriba CONFIRMAR"
            className="border-red-300 focus:ring-red-500"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetAllDialog(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={loading || confirmText !== "CONFIRMAR"} onClick={handleResetAll}>
              {loading ? "Eliminando..." : "Resetear TODO"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
