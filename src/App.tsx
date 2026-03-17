import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/DashboardPage";
import BaseCxPPage from "@/pages/BaseCxPPage";
import ProgramacionPage from "@/pages/ProgramacionPage";
import PagosEjecutadosPage from "@/pages/PagosEjecutadosPage";
import HistoricoPage from "@/pages/HistoricoPage";
import SaldoFacturasPage from "@/pages/SaldoFacturasPage";
import ProveedoresPage from "@/pages/ProveedoresPage";
import ConfiguracionPage from "@/pages/ConfiguracionPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/base-cxp" element={<BaseCxPPage />} />
            <Route path="/programacion" element={<ProgramacionPage />} />
            <Route path="/pagos-ejecutados" element={<PagosEjecutadosPage />} />
            <Route path="/historico" element={<HistoricoPage />} />
            <Route path="/saldo-facturas" element={<SaldoFacturasPage />} />
            <Route path="/proveedores" element={<ProveedoresPage />} />
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
