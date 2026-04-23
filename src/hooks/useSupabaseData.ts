import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============ PROVEEDORES ============

export function useProveedores() {
  return useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proveedores").select("*").order("razon_social");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      codigo: string; ruc_ci: string; razon_social: string; banco: string;
      numero_cuenta: string; tipo_cuenta: string; email_cobros: string; telefono: string;
    }) => {
      const { error } = await supabase.from("proveedores").insert({
        ...p,
        tipo_cuenta: p.tipo_cuenta as any,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proveedores"] }); },
  });
}

export function useUpdateProveedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("proveedores").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["proveedores"] }); },
  });
}

// ============ FACTURAS ============

export function useFacturas() {
  return useQuery({
    queryKey: ["facturas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("facturas").select("*").order("fecha_vencimiento");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddFacturas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (facturas: any[]) => {
      const { error } = await supabase.from("facturas").insert(facturas);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["facturas"] }); },
  });
}

export function useUpdateFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("facturas").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["facturas"] }); },
  });
}

export function useDeleteFactura() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("facturas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["facturas"] }); },
  });
}

// ============ PROGRAMACIONES ============

export function useProgramaciones() {
  return useQuery({
    queryKey: ["programaciones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("programaciones").select("*").order("semana", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddProgramacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { semana: string; limite_disponible: number }) => {
      const { data, error } = await supabase.from("programaciones").insert(p).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["programaciones"] }); },
  });
}

export function useUpdateProgramacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("programaciones").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["programaciones"] }); },
  });
}

// ============ LINEAS PROGRAMACION ============

export function useLineasProgramacion(semanaId?: string) {
  return useQuery({
    queryKey: ["lineas_programacion", semanaId],
    queryFn: async () => {
      let q = supabase.from("lineas_programacion").select("*");
      if (semanaId) q = q.eq("semana_id", semanaId);
      const { data, error } = await q.order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!semanaId,
  });
}

export function useAllLineasProgramacion() {
  return useQuery({
    queryKey: ["lineas_programacion_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lineas_programacion").select("codigo_proveedor, numero_factura, semana_id, estado_aprobacion").order("created_at");
      if (error) throw error;
      return data;
    },
    staleTime: 0,       // Always refetch to ensure freshness
    refetchOnMount: true,
  });
}

export function useAddLineaProgramacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (l: any) => {
      const { error } = await supabase.from("lineas_programacion").insert(l);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lineas_programacion"] });
      qc.invalidateQueries({ queryKey: ["lineas_programacion_all"] });
    },
  });
}

export function useUpdateLineaProgramacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("lineas_programacion").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lineas_programacion"] });
      qc.invalidateQueries({ queryKey: ["lineas_programacion_all"] });
    },
  });
}

export function useDeleteLineaProgramacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lineas_programacion").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lineas_programacion"] });
      qc.invalidateQueries({ queryKey: ["lineas_programacion_all"] });
    },
  });
}

export function useBatchUpdateLineasProgramacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, data }: { ids: string[]; data: Record<string, any> }) => {
      const { error } = await supabase.from("lineas_programacion").update(data as any).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lineas_programacion"] });
      qc.invalidateQueries({ queryKey: ["lineas_programacion_all"] });
    },
  });
}

// ============ PAGOS EJECUTADOS ============

export function usePagosEjecutados() {
  return useQuery({
    queryKey: ["pagos_ejecutados"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pagos_ejecutados").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useAddPagoEjecutado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("pagos_ejecutados").insert(p);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pagos_ejecutados"] }); },
  });
}

export function useUpdatePagoEjecutado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("pagos_ejecutados").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pagos_ejecutados"] }); },
  });
}

// ============ HISTORICO ============

export function useHistorico() {
  return useQuery({
    queryKey: ["historico"],
    queryFn: async () => {
      const { data, error } = await supabase.from("historico").select("*").order("fecha_archivo", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useAddHistorico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (records: any[]) => {
      const { error } = await supabase.from("historico").insert(records);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["historico"] }); },
  });
}

// ============ PROFILES & ROLES (Admin) ============

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("nombre");
      if (error) throw error;
      return data;
    },
  });
}

export function useUserRoles() {
  return useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: role as any })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["user_roles"] }); },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from("profiles").update(data as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profiles"] }); },
  });
}
