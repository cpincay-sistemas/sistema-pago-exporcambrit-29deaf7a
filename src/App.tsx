import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import AuthPage from "@/pages/AuthPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (user) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
