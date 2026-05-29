import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, SERVICE_LABELS } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/pacientes/nuevo")({
  head: () => ({ meta: [{ title: "Nuevo ingreso — Historias Clínicas" }] }),
  component: NuevoPaciente,
});

const schema = z.object({
  cedula_type: z.enum(["V", "E"]),
  cedula_number: z.string().regex(/^\d{6,9}$/, "Cédula inválida (6-9 dígitos)"),
  nombres: z.string().trim().min(2).max(80),
  apellidos: z.string().trim().min(2).max(80),
  fecha_nacimiento: z.string().min(1, "Requerido"),
  telefono: z.string().max(30).optional(),
  service: z.string(),
  current_location: z.enum(["emergencia", "hospitalizacion", "consulta_externa"]),
  current_bed: z.string().max(20).optional(),
});

function NuevoPaciente() {
  const navigate = useNavigate();
  const auth = useAuth();
  const defaultService = auth.services[0] ?? "obstetricia";
  const [form, setForm] = useState({
    cedula_type: "V" as "V" | "E",
    cedula_number: "",
    nombres: "",
    apellidos: "",
    fecha_nacimiento: "",
    telefono: "",
    service: defaultService,
    current_location: "emergencia" as "emergencia" | "hospitalizacion" | "consulta_externa",
    current_bed: "",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setLoading(true);
    const { data, error } = await supabase.from("patients").insert({
      ...parsed.data,
      service: parsed.data.service as any,
      created_by: auth.user!.id,
    }).select("id").single();
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Paciente registrado");
    navigate({ to: "/pacientes/$patientId", params: { patientId: data!.id } });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Nuevo ingreso</h1>
      <p className="text-sm text-muted-foreground mb-5">Registra los datos filiatorios. La hoja frontal se completa después.</p>

      <form onSubmit={submit} className="bg-card border rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[100px_1fr] gap-3">
          <div>
            <Label>Tipo</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={form.cedula_type} onChange={e => setForm({ ...form, cedula_type: e.target.value as "V" | "E" })}>
              <option value="V">V</option><option value="E">E</option>
            </select>
          </div>
          <div>
            <Label>Cédula</Label>
            <Input inputMode="numeric" value={form.cedula_number}
              onChange={e => setForm({ ...form, cedula_number: e.target.value.replace(/\D/g, "") })} required />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Nombres</Label><Input value={form.nombres} onChange={e => setForm({ ...form, nombres: e.target.value })} required /></div>
          <div><Label>Apellidos</Label><Input value={form.apellidos} onChange={e => setForm({ ...form, apellidos: e.target.value })} required /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Fecha de nacimiento</Label><Input type="date" value={form.fecha_nacimiento} onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })} required /></div>
          <div><Label>Teléfono</Label><Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Servicio</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={form.service} onChange={e => setForm({ ...form, service: e.target.value as typeof form.service })}>
              {auth.services.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
              {auth.services.length === 0 && <option value="obstetricia">Obstetricia</option>}
            </select>
          </div>
          <div>
            <Label>Ubicación</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={form.current_location}
              onChange={e => setForm({ ...form, current_location: e.target.value as any })}>
              <option value="emergencia">Emergencia</option>
              <option value="hospitalizacion">Hospitalización</option>
              <option value="consulta_externa">Consulta Externa</option>
            </select>
          </div>
          <div><Label>Cama</Label><Input value={form.current_bed} onChange={e => setForm({ ...form, current_bed: e.target.value })} placeholder="Ej. 12B" /></div>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/pacientes" })}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Registrar paciente"}</Button>
        </div>
      </form>
    </div>
  );
}
