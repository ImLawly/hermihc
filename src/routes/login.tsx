import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Iniciar sesión — Historias Clínicas" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sesión iniciada");
    navigate({ to: "/pacientes" });
  };

  const handleGoogle = async () => {
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
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
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
            ¿No tienes cuenta? <Link to="/signup" className="text-primary font-medium">Regístrate</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
