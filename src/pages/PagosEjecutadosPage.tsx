export default function PagosEjecutadosPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-semibold text-teal">Pagos Ejecutados</h2>
        <p className="text-sm text-muted-foreground">Confirme transferencias y números de referencia bancaria</p>
      </div>
      <div className="bg-card rounded-lg card-shadow p-12 text-center">
        <p className="text-muted-foreground">Módulo de pagos ejecutados — próximamente</p>
        <p className="text-sm text-muted-foreground mt-1">Aquí registrará las confirmaciones de pago del banco.</p>
      </div>
    </div>
  );
}
