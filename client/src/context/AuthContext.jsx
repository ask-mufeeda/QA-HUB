import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabase.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) throw sessionError;
        setSession(data.session);
        if (!data.session) setLoading(false);
      })
      .catch((sessionError) => {
        if (!active) return;
        console.error("Could not load the current session:", sessionError);
        setError(sessionError.message || "Could not load your session.");
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(Boolean(nextSession));
      setError("");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!session?.user?.id) {
      setRole(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error: profileError }) => {
        if (!active) return;
        if (profileError) throw profileError;
        if (!data) throw new Error("A profile could not be found for this account.");
        setRole(
          String(data.role ?? "")
            .trim()
            .toLowerCase(),
        );
        setError("");
        setLoading(false);
      })
      .catch((profileError) => {
        if (!active) return;
        console.error("Could not load the account role:", profileError);
        setRole(null);
        setError(profileError.message || "Could not load your account role.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      role,
      loading,
      error,
      async signOut() {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
      },
    }),
    [session, role, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider.");
  }
  return context;
}
