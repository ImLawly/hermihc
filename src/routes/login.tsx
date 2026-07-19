import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { resolveLoginEmail } from "@/lib/auth.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";

const NEXT_STORAGE_KEY = "post_login_next";

function safeRelative(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — Historias Clínicas" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const target = safeRelative(next) ?? "/pacientes";

  // If we return here already signed in (e.g. after Google OAuth), forward to the
  // preserved destination (sessionStorage takes precedence for social flows).
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      const stored = typeof window !== "undefined" ? sessionStorage.getItem(NEXT_STORAGE_KEY) : null;
      const dest = safeRelative(stored ?? undefined) ?? target;
      if (stored) sessionStorage.removeItem(NEXT_STORAGE_KEY);
      window.location.href = dest;
    });
    return () => { cancelled = true; };
  }, [target]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    let loginEmail = email.trim();
    try {
      const r = await resolveLoginEmail({ data: { identifier: loginEmail } });
      loginEmail = r.email;
    } catch {
      // fall back to typed value
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sesión iniciada");
    // Use full navigation for OAuth consent URL (dots in path aren't in the typed route tree).
    if (target.startsWith("/.lovable/")) {
      window.location.href = target;
    } else {
      navigate({ to: target });
    }
  };

  const handleGoogle = async () => {
    // Preserve the intended destination across the Google round-trip.
    if (typeof window !== "undefined") {
      sessionStorage.setItem(NEXT_STORAGE_KEY, target);
    }
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("No se pudo iniciar sesión con Google");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-xl bg-[color:var(--tab-active)] flex items-center justify-center">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Historias Clínicas</h1>
            <p className="text-xs text-muted-foreground">Servicio de Obstetricia</p>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-1">Iniciar sesión</h2>
          <p className="text-sm text-muted-foreground mb-5">Accede con tu cuenta institucional.</p>

          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="text" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" placeholder="correo o usuario" />
            </div>
            <div>
              <Label htmlFor="pwd">Contraseña</Label>
              <Input id="pwd" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Ingresando…" : "Entrar"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> o <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" onClick={handleGoogle} className="w-full">
            Continuar con Google
          </Button>

          <p className="text-xs text-center mt-5 text-muted-foreground">
            ¿No tienes cuenta? <Link to="/signup" search={next ? { next } as never : undefined}>Regístrate</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
