export type Prioridad = "CRITICO" | "URGENTE" | "PROXIMO" | "AL_DIA";
export type EstadoAprobacion = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "EN_PROCESO" | "PAGADO";
export type FormaPago = "TRANSFERENCIA" | "CHEQUE" | "EFECTIVO" | "ACH";
export type TipoCuenta = "CORRIENTE" | "AHORROS";
export type EstadoSemana = "BORRADOR" | "APROBADO" | "ARCHIVADO";
export type EstadoFactura = "PAGADA_COMPLETA" | "ABONO_PARCIAL" | "PENDIENTE";
export type Rol = "ADMIN" | "TESORERO" | "APROBADOR" | "CONSULTA";

export interface Proveedor {
  id: string;
  codigo: string;
  ruc_ci: string;
  razon_social: string;
  banco: string;
  numero_cuenta: string;
  tipo_cuenta: TipoCuenta;
  email_cobros: string;
  telefono: string;
  fecha_verificacion: string;
  activo: boolean;
}

export interface FacturaCxP {
  id: string;
  periodo: string;
  codigo_proveedor: string;
  razon_social: string;
  numero_factura: string;
  motivo: string;
  doc_interno: string;
  observaciones: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  dias_credito: number;
  dias_vencidos: number;
  saldo_total: number;
  saldo_vencido: number;
  saldo_por_vencer: number;
  prioridad: Prioridad;
}

export interface ProgramacionSemana {
  id: string;
  semana: string;
  aprobado_por: string;
  limite_disponible: number;
  fecha_aprobacion: string;
  estado_semana: EstadoSemana;
}

export interface ProgramacionLinea {
  id: string;
  semana_id: string;
  razon_social: string;
  codigo_proveedor: string;
  numero_factura: string;
  fecha_vencimiento: string;
  estado_aprobacion: EstadoAprobacion;
  dias_vencidos: number;
  prioridad: Prioridad;
  forma_pago: FormaPago;
  banco_destino: string;
  cuenta_destino: string;
  saldo_real_pendiente: number;
  monto_a_pagar: number;
  observaciones: string;
  responsable_pago: string;
  fecha_programada: string;
}

export interface PagoEjecutado {
  id: string;
  numero_linea: number;
  fecha_pago: string;
  codigo_proveedor: string;
  razon_social: string;
  numero_factura: string;
  monto_pagado: number;
  forma_pago: FormaPago;
  banco_origen: string;
  banco_destino: string;
  numero_transferencia: string;
  cuenta_destino: string;
  saldo_pendiente: number;
  responsable: string;
  aprobado_por: string;
  observaciones: string;
}

export interface HistoricoRegistro extends PagoEjecutado {
  semana: string;
  periodo: string;
  fecha_archivo: string;
  prioridad: Prioridad;
  dias_vencidos: number;
  fecha_vencimiento: string;
}

export interface SaldoFactura {
  numero_factura: string;
  proveedor: string;
  fecha_vencimiento: string;
  dias_vencidos: number;
  monto_original: number;
  total_abonado: number;
  saldo_real_pendiente: number;
  porcentaje_pagado: number;
  estado: EstadoFactura;
}
