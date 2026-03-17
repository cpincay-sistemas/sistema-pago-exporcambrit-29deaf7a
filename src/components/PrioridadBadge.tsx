import type { Prioridad } from "@/types";
import { getPrioridadClass } from "@/lib/business-rules";

export function PrioridadBadge({ prioridad }: { prioridad: Prioridad }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getPrioridadClass(prioridad)}`}>
      {prioridad.replace("_", " ")}
    </span>
  );
}
