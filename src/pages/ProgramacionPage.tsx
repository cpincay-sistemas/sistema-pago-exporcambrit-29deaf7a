import { getCurrentISOWeek } from "@/lib/business-rules";

export default function ProgramacionPage() {
  const semana = getCurrentISOWeek();
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-teal">Programación Semanal de Pagos</h2>
        <p className="text-sm text-muted-foreground">Semana {semana} — Seleccione facturas a pagar esta semana</p>
      </div>
      <div className="bg-card rounded-lg card-shadow p-12 text-center">
        <p className="text-muted-foreground">Módulo de programación semanal — próximamente</p>
        <p className="text-sm text-muted-foreground mt-1">Aquí podrá seleccionar facturas, asignar montos y aprobar pagos semanales.</p>
      </div>
    </div>
  );
}
