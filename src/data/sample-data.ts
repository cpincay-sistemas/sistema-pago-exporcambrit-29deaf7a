import type { Proveedor, FacturaCxP, HistoricoRegistro } from "@/types";
import { calcularPrioridad, calcularDiasVencidos } from "@/lib/business-rules";

export const sampleProveedores: Proveedor[] = [
  { id: "p1", codigo: "PROV-001", ruc_ci: "0992345678001", razon_social: "ACUAVEL S.A.", banco: "Produbanco", numero_cuenta: "02100234567", tipo_cuenta: "CORRIENTE", email_cobros: "cobros@acuavel.com", telefono: "042345678", fecha_verificacion: "2026-01-15", activo: true },
  { id: "p2", codigo: "PROV-002", ruc_ci: "0991234567001", razon_social: "AGROREPUESTOS LOVATO S.A.", banco: "Banco Pichincha", numero_cuenta: "2200456789", tipo_cuenta: "CORRIENTE", email_cobros: "pagos@lovato.ec", telefono: "042567890", fecha_verificacion: "2026-02-01", activo: true },
  { id: "p3", codigo: "PROV-003", ruc_ci: "0990987654001", razon_social: "MARMOI", banco: "Banco Guayaquil", numero_cuenta: "0034567890", tipo_cuenta: "AHORROS", email_cobros: "cobranzas@marmoi.com", telefono: "042890123", fecha_verificacion: "2026-01-20", activo: true },
  { id: "p4", codigo: "PROV-004", ruc_ci: "0993456789001", razon_social: "PESCAEQUIPOS CIA.LTDA.", banco: "Banco del Pacífico", numero_cuenta: "7654321098", tipo_cuenta: "CORRIENTE", email_cobros: "facturas@pescaequipos.ec", telefono: "042678901", fecha_verificacion: "2026-02-10", activo: true },
  { id: "p5", codigo: "PROV-005", ruc_ci: "0921234567001", razon_social: "ORLANDO JOSELITO LARVA", banco: "Produbanco", numero_cuenta: "02100567890", tipo_cuenta: "AHORROS", email_cobros: "orlando.larva@gmail.com", telefono: "0991234567", fecha_verificacion: "2025-12-15", activo: true },
  { id: "p6", codigo: "PROV-006", ruc_ci: "0994567890001", razon_social: "AGILIDER S.A.", banco: "Banco Pichincha", numero_cuenta: "2200789012", tipo_cuenta: "CORRIENTE", email_cobros: "pagos@agilider.com", telefono: "042901234", fecha_verificacion: "2026-03-01", activo: true },
];

const today = new Date();
const d = (daysAgo: number) => {
  const date = new Date(today);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
};

const rawFacturas: Omit<FacturaCxP, "dias_vencidos" | "prioridad" | "dias_credito" | "saldo_vencido" | "saldo_por_vencer">[] = [
  { id: "f1", periodo: "2026-01", codigo_proveedor: "PROV-001", razon_social: "ACUAVEL S.A.", numero_factura: "001-001-000234", motivo: "Alimento balanceado camarón L35", doc_interno: "OC-2026-045", observaciones: "", fecha_emision: d(60), fecha_vencimiento: d(45), saldo_total: 18500.00 },
  { id: "f2", periodo: "2026-01", codigo_proveedor: "PROV-001", razon_social: "ACUAVEL S.A.", numero_factura: "001-001-000267", motivo: "Suplemento vitamínico lote 12", doc_interno: "OC-2026-052", observaciones: "Entrega parcial", fecha_emision: d(40), fecha_vencimiento: d(25), saldo_total: 7200.00 },
  { id: "f3", periodo: "2026-02", codigo_proveedor: "PROV-002", razon_social: "AGROREPUESTOS LOVATO S.A.", numero_factura: "002-001-000891", motivo: "Repuestos bomba sumergible", doc_interno: "OC-2026-078", observaciones: "", fecha_emision: d(35), fecha_vencimiento: d(20), saldo_total: 4350.00 },
  { id: "f4", periodo: "2026-02", codigo_proveedor: "PROV-003", razon_social: "MARMOI", numero_factura: "003-002-001456", motivo: "Servicio mantenimiento compuertas", doc_interno: "", observaciones: "Incluye materiales", fecha_emision: d(22), fecha_vencimiento: d(8), saldo_total: 3100.00 },
  { id: "f5", periodo: "2026-02", codigo_proveedor: "PROV-004", razon_social: "PESCAEQUIPOS CIA.LTDA.", numero_factura: "004-001-000123", motivo: "Redes de cosecha 20m", doc_interno: "OC-2026-091", observaciones: "", fecha_emision: d(50), fecha_vencimiento: d(35), saldo_total: 12800.00 },
  { id: "f6", periodo: "2026-03", codigo_proveedor: "PROV-005", razon_social: "ORLANDO JOSELITO LARVA", numero_factura: "005-001-000045", motivo: "Larva de camarón PLs 12", doc_interno: "OC-2026-099", observaciones: "Lote premium", fecha_emision: d(15), fecha_vencimiento: d(3), saldo_total: 22000.00 },
  { id: "f7", periodo: "2026-03", codigo_proveedor: "PROV-006", razon_social: "AGILIDER S.A.", numero_factura: "006-001-000789", motivo: "Diesel para generador", doc_interno: "OC-2026-103", observaciones: "", fecha_emision: d(10), fecha_vencimiento: d(-5), saldo_total: 5600.00 },
  { id: "f8", periodo: "2026-01", codigo_proveedor: "PROV-004", razon_social: "PESCAEQUIPOS CIA.LTDA.", numero_factura: "004-001-000098", motivo: "Aireadores de paleta 3HP", doc_interno: "OC-2026-034", observaciones: "Garantía 1 año", fecha_emision: d(75), fecha_vencimiento: d(60), saldo_total: 9400.00 },
  { id: "f9", periodo: "2026-02", codigo_proveedor: "PROV-002", razon_social: "AGROREPUESTOS LOVATO S.A.", numero_factura: "002-001-000923", motivo: "Válvulas compuerta 6 pulgadas", doc_interno: "OC-2026-085", observaciones: "", fecha_emision: d(28), fecha_vencimiento: d(13), saldo_total: 2780.00 },
  { id: "f10", periodo: "2026-03", codigo_proveedor: "PROV-003", razon_social: "MARMOI", numero_factura: "003-002-001502", motivo: "Impermeabilización muros piscina 4", doc_interno: "", observaciones: "Trabajo completado", fecha_emision: d(18), fecha_vencimiento: d(4), saldo_total: 6500.00 },
  { id: "f11", periodo: "2026-03", codigo_proveedor: "PROV-001", razon_social: "ACUAVEL S.A.", numero_factura: "001-001-000289", motivo: "Probióticos acuícolas", doc_interno: "OC-2026-112", observaciones: "", fecha_emision: d(5), fecha_vencimiento: d(-10), saldo_total: 3200.00 },
  { id: "f12", periodo: "2026-03", codigo_proveedor: "PROV-006", razon_social: "AGILIDER S.A.", numero_factura: "006-001-000812", motivo: "Transporte de cosecha", doc_interno: "OC-2026-118", observaciones: "", fecha_emision: d(7), fecha_vencimiento: d(-8), saldo_total: 4100.00 },
  { id: "f13", periodo: "2026-02", codigo_proveedor: "PROV-005", razon_social: "ORLANDO JOSELITO LARVA", numero_factura: "005-001-000051", motivo: "Larva de camarón PLs 15", doc_interno: "OC-2026-088", observaciones: "Segunda entrega", fecha_emision: d(30), fecha_vencimiento: d(16), saldo_total: 15000.00 },
];

export const sampleFacturas: FacturaCxP[] = rawFacturas.map((f) => {
  const diasVencidos = calcularDiasVencidos(f.fecha_vencimiento);
  const prioridad = calcularPrioridad(diasVencidos);
  const diasCredito = Math.round((new Date(f.fecha_vencimiento).getTime() - new Date(f.fecha_emision).getTime()) / 86400000);
  return {
    ...f,
    dias_vencidos: diasVencidos,
    prioridad,
    dias_credito: diasCredito,
    saldo_vencido: diasVencidos > 0 ? f.saldo_total : 0,
    saldo_por_vencer: diasVencidos <= 0 ? f.saldo_total : 0,
  };
});

export const sampleHistorico: HistoricoRegistro[] = [
  {
    id: "h1", numero_linea: 1, semana: "2026-W09", periodo: "2026-02", fecha_archivo: d(10),
    fecha_pago: d(12), codigo_proveedor: "PROV-001", razon_social: "ACUAVEL S.A.",
    numero_factura: "001-001-000234", monto_pagado: 5000.00, forma_pago: "TRANSFERENCIA",
    banco_origen: "Produbanco Empresa", banco_destino: "Produbanco", numero_transferencia: "TRF-20260305-001",
    cuenta_destino: "02100234567", saldo_pendiente: 13500.00, responsable: "María Torres",
    aprobado_por: "Carlos Méndez", observaciones: "Abono parcial", prioridad: "CRITICO",
    dias_vencidos: 45, fecha_vencimiento: d(45),
  },
  {
    id: "h2", numero_linea: 2, semana: "2026-W09", periodo: "2026-02", fecha_archivo: d(10),
    fecha_pago: d(12), codigo_proveedor: "PROV-004", razon_social: "PESCAEQUIPOS CIA.LTDA.",
    numero_factura: "004-001-000098", monto_pagado: 9400.00, forma_pago: "TRANSFERENCIA",
    banco_origen: "Banco Pichincha Empresa", banco_destino: "Banco del Pacífico", numero_transferencia: "TRF-20260305-002",
    cuenta_destino: "7654321098", saldo_pendiente: 0, responsable: "María Torres",
    aprobado_por: "Carlos Méndez", observaciones: "Pago completo", prioridad: "CRITICO",
    dias_vencidos: 60, fecha_vencimiento: d(60),
  },
];
