import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Stethoscope } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  fullName: z.string().trim().min(3, "Nombre demasiado corto").max(120),
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(128),
});

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Crear cuenta — Historias Clínicas" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ fullName, email, password });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cuenta creada. Esperando aprobación del administrador.");
    navigate({ to: "/pacientes" });
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
            <p className="text-xs text-muted-foreground">Crear nueva cuenta</p>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" required value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Correo institucional</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pwd">Contraseña</Label>
              <Input id="pwd" type="password" required value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">
              Tu cuenta quedará pendiente de aprobación. Un administrador asignará tu rol y servicio.
            </p>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creando…" : "Crear cuenta"}
            </Button>
          </form>
          <p className="text-xs text-center mt-5 text-muted-foreground">
            ¿Ya tienes cuenta? <Link to="/login" className="text-primary font-medium">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
