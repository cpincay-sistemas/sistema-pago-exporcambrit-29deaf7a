import type { Prioridad } from "@/types";

export function calcularDiasVencidos(fechaVencimiento: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const venc = new Date(fechaVencimiento);
  venc.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - venc.getTime()) / 86400000);
}

export function calcularPrioridad(diasVencidos: number): Prioridad {
  if (diasVencidos >= 30) return "CRITICO";
  if (diasVencidos >= 15) return "URGENTE";
  if (diasVencidos >= 7) return "PROXIMO";
  return "AL_DIA";
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-EC", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function getCurrentISOWeek(): string {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const start = new Date(jan4);
  start.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const week = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function validarRUC(ruc: string): boolean {
  if (!/^\d{13}$/.test(ruc)) return false;
  if (!ruc.endsWith("001")) return false;
  const provincia = parseInt(ruc.substring(0, 2));
  if (provincia < 1 || provincia > 24) return false;
  return true;
}

export function getPrioridadClass(prioridad: Prioridad): string {
  const map: Record<Prioridad, string> = {
    CRITICO: "priority-critico",
    URGENTE: "priority-urgente",
    PROXIMO: "priority-proximo",
    AL_DIA: "priority-al-dia",
  };
  return map[prioridad];
}
