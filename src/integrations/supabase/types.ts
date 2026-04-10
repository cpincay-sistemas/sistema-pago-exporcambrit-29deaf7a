export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      facturas: {
        Row: {
          codigo_proveedor: string
          created_at: string
          dias_credito: number
          doc_interno: string
          fecha_emision: string
          fecha_vencimiento: string
          id: string
          motivo: string
          numero_factura: string
          observaciones: string
          origen: string
          periodo: string
          razon_social: string
          saldo_total: number
          updated_at: string
        }
        Insert: {
          codigo_proveedor: string
          created_at?: string
          dias_credito?: number
          doc_interno?: string
          fecha_emision: string
          fecha_vencimiento: string
          id?: string
          motivo?: string
          numero_factura: string
          observaciones?: string
          origen?: string
          periodo?: string
          razon_social: string
          saldo_total?: number
          updated_at?: string
        }
        Update: {
          codigo_proveedor?: string
          created_at?: string
          dias_credito?: number
          doc_interno?: string
          fecha_emision?: string
          fecha_vencimiento?: string
          id?: string
          motivo?: string
          numero_factura?: string
          observaciones?: string
          origen?: string
          periodo?: string
          razon_social?: string
          saldo_total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facturas_codigo_proveedor_fkey"
            columns: ["codigo_proveedor"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["codigo"]
          },
        ]
      }
      historico: {
        Row: {
          aprobado_por: string
          banco_destino: string
          banco_origen: string
          codigo_proveedor: string
          created_at: string
          cuenta_destino: string
          dias_vencidos: number
          fecha_archivo: string
          fecha_pago: string
          fecha_vencimiento: string | null
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id: string
          monto_pagado: number
          numero_factura: string
          numero_linea: number
          numero_transferencia: string
          observaciones: string
          periodo: string
          prioridad: Database["public"]["Enums"]["prioridad"]
          razon_social: string
          responsable: string
          saldo_pendiente: number
          semana: string
        }
        Insert: {
          aprobado_por?: string
          banco_destino?: string
          banco_origen?: string
          codigo_proveedor: string
          created_at?: string
          cuenta_destino?: string
          dias_vencidos?: number
          fecha_archivo?: string
          fecha_pago: string
          fecha_vencimiento?: string | null
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          monto_pagado?: number
          numero_factura: string
          numero_linea?: number
          numero_transferencia?: string
          observaciones?: string
          periodo?: string
          prioridad?: Database["public"]["Enums"]["prioridad"]
          razon_social: string
          responsable?: string
          saldo_pendiente?: number
          semana: string
        }
        Update: {
          aprobado_por?: string
          banco_destino?: string
          banco_origen?: string
          codigo_proveedor?: string
          created_at?: string
          cuenta_destino?: string
          dias_vencidos?: number
          fecha_archivo?: string
          fecha_pago?: string
          fecha_vencimiento?: string | null
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          monto_pagado?: number
          numero_factura?: string
          numero_linea?: number
          numero_transferencia?: string
          observaciones?: string
          periodo?: string
          prioridad?: Database["public"]["Enums"]["prioridad"]
          razon_social?: string
          responsable?: string
          saldo_pendiente?: number
          semana?: string
        }
        Relationships: []
      }
      lineas_programacion: {
        Row: {
          banco_destino: string
          codigo_proveedor: string
          created_at: string
          cuenta_destino: string
          dias_vencidos: number
          estado_aprobacion: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_programada: string
          fecha_vencimiento: string
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id: string
          monto_a_pagar: number
          numero_factura: string
          observaciones: string
          prioridad: Database["public"]["Enums"]["prioridad"]
          razon_social: string
          responsable_pago: string
          saldo_real_pendiente: number
          semana_id: string
        }
        Insert: {
          banco_destino?: string
          codigo_proveedor: string
          created_at?: string
          cuenta_destino?: string
          dias_vencidos?: number
          estado_aprobacion?: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_programada?: string
          fecha_vencimiento: string
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          monto_a_pagar?: number
          numero_factura: string
          observaciones?: string
          prioridad?: Database["public"]["Enums"]["prioridad"]
          razon_social: string
          responsable_pago?: string
          saldo_real_pendiente?: number
          semana_id: string
        }
        Update: {
          banco_destino?: string
          codigo_proveedor?: string
          created_at?: string
          cuenta_destino?: string
          dias_vencidos?: number
          estado_aprobacion?: Database["public"]["Enums"]["estado_aprobacion"]
          fecha_programada?: string
          fecha_vencimiento?: string
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          monto_a_pagar?: number
          numero_factura?: string
          observaciones?: string
          prioridad?: Database["public"]["Enums"]["prioridad"]
          razon_social?: string
          responsable_pago?: string
          saldo_real_pendiente?: number
          semana_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineas_programacion_semana_id_fkey"
            columns: ["semana_id"]
            isOneToOne: false
            referencedRelation: "programaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_ejecutados: {
        Row: {
          aprobado_por: string
          banco_destino: string
          banco_origen: string
          codigo_proveedor: string
          created_at: string
          cuenta_destino: string
          fecha_pago: string
          forma_pago: Database["public"]["Enums"]["forma_pago"]
          id: string
          monto_pagado: number
          numero_factura: string
          numero_linea: number
          numero_transferencia: string
          observaciones: string
          razon_social: string
          responsable: string
          saldo_pendiente: number
          semana: string
        }
        Insert: {
          aprobado_por?: string
          banco_destino?: string
          banco_origen?: string
          codigo_proveedor: string
          created_at?: string
          cuenta_destino?: string
          fecha_pago?: string
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          monto_pagado?: number
          numero_factura: string
          numero_linea?: number
          numero_transferencia?: string
          observaciones?: string
          razon_social: string
          responsable?: string
          saldo_pendiente?: number
          semana?: string
        }
        Update: {
          aprobado_por?: string
          banco_destino?: string
          banco_origen?: string
          codigo_proveedor?: string
          created_at?: string
          cuenta_destino?: string
          fecha_pago?: string
          forma_pago?: Database["public"]["Enums"]["forma_pago"]
          id?: string
          monto_pagado?: number
          numero_factura?: string
          numero_linea?: number
          numero_transferencia?: string
          observaciones?: string
          razon_social?: string
          responsable?: string
          saldo_pendiente?: number
          semana?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activo: boolean
          created_at: string
          email: string
          id: string
          nombre: string
          ultimo_acceso: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          email?: string
          id: string
          nombre?: string
          ultimo_acceso?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          ultimo_acceso?: string | null
        }
        Relationships: []
      }
      programaciones: {
        Row: {
          aprobado_por: string
          created_at: string
          estado_semana: Database["public"]["Enums"]["estado_semana"]
          fecha_aprobacion: string | null
          id: string
          limite_disponible: number
          semana: string
          updated_at: string
        }
        Insert: {
          aprobado_por?: string
          created_at?: string
          estado_semana?: Database["public"]["Enums"]["estado_semana"]
          fecha_aprobacion?: string | null
          id?: string
          limite_disponible?: number
          semana: string
          updated_at?: string
        }
        Update: {
          aprobado_por?: string
          created_at?: string
          estado_semana?: Database["public"]["Enums"]["estado_semana"]
          fecha_aprobacion?: string | null
          id?: string
          limite_disponible?: number
          semana?: string
          updated_at?: string
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean
          banco: string
          codigo: string
          created_at: string
          email_cobros: string
          fecha_verificacion: string | null
          id: string
          numero_cuenta: string
          razon_social: string
          ruc_ci: string
          telefono: string
          tipo_cuenta: Database["public"]["Enums"]["tipo_cuenta"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          banco?: string
          codigo: string
          created_at?: string
          email_cobros?: string
          fecha_verificacion?: string | null
          id?: string
          numero_cuenta?: string
          razon_social: string
          ruc_ci: string
          telefono?: string
          tipo_cuenta?: Database["public"]["Enums"]["tipo_cuenta"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          banco?: string
          codigo?: string
          created_at?: string
          email_cobros?: string
          fecha_verificacion?: string | null
          id?: string
          numero_cuenta?: string
          razon_social?: string
          ruc_ci?: string
          telefono?: string
          tipo_cuenta?: Database["public"]["Enums"]["tipo_cuenta"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "ADMIN" | "TESORERO" | "APROBADOR" | "CONSULTA"
      estado_aprobacion:
        | "PENDIENTE"
        | "APROBADO"
        | "RECHAZADO"
        | "EN_PROCESO"
        | "PAGADO"
      estado_factura: "PAGADA_COMPLETA" | "ABONO_PARCIAL" | "PENDIENTE"
      estado_semana: "BORRADOR" | "APROBADO" | "ARCHIVADO"
      forma_pago: "TRANSFERENCIA" | "CHEQUE" | "EFECTIVO" | "ACH"
      prioridad: "CRITICO" | "URGENTE" | "PROXIMO" | "AL_DIA"
      tipo_cuenta: "CORRIENTE" | "AHORROS"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["ADMIN", "TESORERO", "APROBADOR", "CONSULTA"],
      estado_aprobacion: [
        "PENDIENTE",
        "APROBADO",
        "RECHAZADO",
        "EN_PROCESO",
        "PAGADO",
      ],
      estado_factura: ["PAGADA_COMPLETA", "ABONO_PARCIAL", "PENDIENTE"],
      estado_semana: ["BORRADOR", "APROBADO", "ARCHIVADO"],
      forma_pago: ["TRANSFERENCIA", "CHEQUE", "EFECTIVO", "ACH"],
      prioridad: ["CRITICO", "URGENTE", "PROXIMO", "AL_DIA"],
      tipo_cuenta: ["CORRIENTE", "AHORROS"],
    },
  },
} as const
