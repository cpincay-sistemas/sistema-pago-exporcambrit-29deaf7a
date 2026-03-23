import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Sesión iniciada");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nombre },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast.success("Cuenta creada. Revise su email para confirmar.");
      }
    } catch (err: any) {
      toast.error(err.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error("Ingrese su email"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Email de recuperación enviado");
      setShowForgot(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="h-12 w-12 rounded-lg bg-primary mx-auto flex items-center justify-center mb-3">
            <span className="text-primary-foreground font-bold text-lg">CP</span>
          </div>
          <h1 className="text-xl font-bold">EXPORCAMBRIT</h1>
          <p className="text-sm text-muted-foreground">Sistema de Pagos CP1</p>
        </div>

        <div className="bg-card rounded-lg card-shadow p-6">
          {showForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <h2 className="text-lg font-semibold text-center">Recuperar Contraseña</h2>
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin mr-2" size={16} />}
                Enviar enlace
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setShowForgot(false)}>
                Volver al login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-center">
                {isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
              </h2>
              {!isLogin && (
                <Input placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
              )}
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin mr-2" size={16} />}
                {isLogin ? "Entrar" : "Registrarse"}
              </Button>
              {isLogin && (
                <Button type="button" variant="link" className="w-full text-xs" onClick={() => setShowForgot(true)}>
                  ¿Olvidó su contraseña?
                </Button>
              )}
              <div className="text-center">
                <Button type="button" variant="link" className="text-sm" onClick={() => setIsLogin(!isLogin)}>
                  {isLogin ? "¿No tiene cuenta? Registrarse" : "¿Ya tiene cuenta? Iniciar sesión"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
