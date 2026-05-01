import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "ADMIN" | "TESORERO" | "APROBADOR" | "CONSULTA";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: { full_name: string | null; avatar_url: string | null; email: string; activo: boolean } | null;
  role: AppRole | null;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  canWrite: () => boolean;
  canApprove: () => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string | null; avatar_url: string | null; email: string; activo: boolean } | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);

  const fetchUserData = async (userId: string, userObj?: User) => {
    try {
      // Fallback inmediato desde user_metadata mientras llega la DB
      if (userObj?.user_metadata?.full_name) {
        setProfile((prev) => prev ?? {
          full_name: userObj.user_metadata.full_name,
          avatar_url: userObj.user_metadata.avatar_url ?? null,
          email: userObj.email ?? "",
          activo: true,
        });
      }

      const [profileRes, roleRes] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, email, activo").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (roleRes.data) setRole(roleRes.data.role as AppRole);
    } catch (e) {
      console.error("Error fetching user data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED"
      ) {
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id, session.user), 0);
        } else {
          setLoading(false);
        }
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const hasRole = (r: AppRole) => role === r;
  const canWrite = () => role === "ADMIN" || role === "TESORERO";
  const canApprove = () => role === "ADMIN" || role === "APROBADOR";
  const isAdmin = () => role === "ADMIN";

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, role, signOut, hasRole, canWrite, canApprove, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
