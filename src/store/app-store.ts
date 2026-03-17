import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Proveedor, FacturaCxP, HistoricoRegistro, ProgramacionSemana, ProgramacionLinea, PagoEjecutado } from "@/types";
import { sampleProveedores, sampleFacturas, sampleHistorico } from "@/data/sample-data";

interface AppState {
  proveedores: Proveedor[];
  facturas: FacturaCxP[];
  historico: HistoricoRegistro[];
  programaciones: ProgramacionSemana[];
  lineasProgramacion: ProgramacionLinea[];
  pagosEjecutados: PagoEjecutado[];

  // Proveedores
  addProveedor: (p: Proveedor) => void;
  updateProveedor: (id: string, p: Partial<Proveedor>) => void;
  deleteProveedor: (id: string) => void;

  // Facturas
  setFacturas: (f: FacturaCxP[]) => void;
  addFacturas: (f: FacturaCxP[]) => void;

  // Programacion
  addProgramacion: (p: ProgramacionSemana) => void;
  updateProgramacion: (id: string, p: Partial<ProgramacionSemana>) => void;
  addLineaProgramacion: (l: ProgramacionLinea) => void;
  updateLineaProgramacion: (id: string, l: Partial<ProgramacionLinea>) => void;
  deleteLineaProgramacion: (id: string) => void;

  // Pagos
  addPagoEjecutado: (p: PagoEjecutado) => void;
  updatePagoEjecutado: (id: string, p: Partial<PagoEjecutado>) => void;

  // Historico
  addHistorico: (records: HistoricoRegistro[]) => void;

  // Helpers
  getSaldoRealPendiente: (numeroFactura: string) => number;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      proveedores: sampleProveedores,
      facturas: sampleFacturas,
      historico: sampleHistorico,
      programaciones: [],
      lineasProgramacion: [],
      pagosEjecutados: [],

      addProveedor: (p) => set((s) => ({ proveedores: [...s.proveedores, p] })),
      updateProveedor: (id, p) => set((s) => ({
        proveedores: s.proveedores.map((x) => (x.id === id ? { ...x, ...p } : x)),
      })),
      deleteProveedor: (id) => set((s) => ({
        proveedores: s.proveedores.filter((x) => x.id !== id),
      })),

      setFacturas: (f) => set({ facturas: f }),
      addFacturas: (f) => set((s) => ({ facturas: [...s.facturas, ...f] })),

      addProgramacion: (p) => set((s) => ({ programaciones: [...s.programaciones, p] })),
      updateProgramacion: (id, p) => set((s) => ({
        programaciones: s.programaciones.map((x) => (x.id === id ? { ...x, ...p } : x)),
      })),
      addLineaProgramacion: (l) => set((s) => ({ lineasProgramacion: [...s.lineasProgramacion, l] })),
      updateLineaProgramacion: (id, l) => set((s) => ({
        lineasProgramacion: s.lineasProgramacion.map((x) => (x.id === id ? { ...x, ...l } : x)),
      })),
      deleteLineaProgramacion: (id) => set((s) => ({
        lineasProgramacion: s.lineasProgramacion.filter((x) => x.id !== id),
      })),

      addPagoEjecutado: (p) => set((s) => ({ pagosEjecutados: [...s.pagosEjecutados, p] })),
      updatePagoEjecutado: (id, p) => set((s) => ({
        pagosEjecutados: s.pagosEjecutados.map((x) => (x.id === id ? { ...x, ...p } : x)),
      })),

      addHistorico: (records) => set((s) => ({ historico: [...s.historico, ...records] })),

      getSaldoRealPendiente: (numeroFactura: string) => {
        const state = get();
        const factura = state.facturas.find((f) => f.numero_factura === numeroFactura);
        if (!factura) return 0;
        const totalAbonado = state.historico
          .filter((h) => h.numero_factura === numeroFactura)
          .reduce((sum, h) => sum + h.monto_pagado, 0);
        return factura.saldo_total - totalAbonado;
      },
    }),
    { name: "camaronera-pagos-v1" }
  )
);
