import { useProfiles, useUserRoles, useUpdateUserRole, useUpdateProfile } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users } from "lucide-react";
import { toast } from "sonner";
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

export default function ConfiguracionPage() {
  const { data: profiles = [] } = useProfiles();
  const { data: userRoles = [] } = useUserRoles();
  const updateUserRole = useUpdateUserRole();
  const updateProfile = useUpdateProfile();
  const { isAdmin } = useAuth();

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
    </div>
  );
}
