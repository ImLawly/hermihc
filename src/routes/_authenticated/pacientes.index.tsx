import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LOCATION_LABELS } from "@/lib/medical";
import { calcAge } from "@/lib/medical";
import { useState, useMemo } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pacientes/")({
  head: () => ({ meta: [{ title: "Pacientes — Historias Clínicas" }] }),
  component: PacientesIndex,
});

type Tab = "activa" | "archivada";

function PacientesIndex() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("activa");
  const [loc, setLoc] = useState<"all" | "emergencia" | "hospitalizacion" | "consulta_externa">("all");
  const [q, setQ] = useState("");

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients", tab, loc],
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select("*, admissions(admission_date)")
        .eq("status", tab)
        .order("updated_at", { ascending: false });
      if (loc !== "all") query = query.eq("current_location", loc);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!auth.user,
  });

  const filtered = useMemo(() => {
    if (!patients) return [];
    if (!q.trim()) return patients;
    const s = q.toLowerCase().trim();
    const dateConstraint = parseDateQuery(s);
    return patients.filter((p: any) => {
      if (`${p.nombres} ${p.apellidos}`.toLowerCase().includes(s)) return true;
      if (p.cedula_number.includes(s)) return true;
      if (dateConstraint) {
        const dates: string[] = (p.admissions ?? []).map((a: any) => a.admission_date).filter(Boolean);
        if (dates.some(d => matchesDate(d, dateConstraint))) return true;
      }
      return false;
    });
  }, [patients, q]);


  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="text-xl font-semibold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">Historias activas y archivadas de tu servicio.</p>
        </div>
        {auth.isMedical && (
          <Button asChild>
            <Link to="/pacientes/nuevo">
              <Plus className="w-4 h-4 mr-1" /> Nuevo ingreso
            </Link>
          </Button>
        )}
      </div>

      {/* Pestañas activa / archivada (estilo pestaña activa azul oscuro) */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        <button className="med-tab" data-active={tab === "activa"} onClick={() => setTab("activa")}>Activas</button>
        <button className="med-tab" data-active={tab === "archivada"} onClick={() => setTab("archivada")}>Archivadas</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nombre o cédula" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={loc} onChange={e => setLoc(e.target.value as typeof loc)}>
          <option value="all">Todas las ubicaciones</option>
          <option value="emergencia">Emergencia</option>
          <option value="hospitalizacion">Hospitalización</option>
          <option value="consulta_externa">Consulta Externa</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando pacientes…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No hay pacientes para mostrar.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => (
            <Link key={p.id} to="/pacientes/$patientId" params={{ patientId: p.id }}
              className="block bg-card border rounded-xl p-4 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{p.apellidos}, {p.nombres}</p>
                  <p className="text-xs text-muted-foreground">{p.cedula_type}-{p.cedula_number} · {calcAge(p.fecha_nacimiento)} años</p>
                </div>
                <span className="status-pill" data-tone={p.status === "activa" ? "active" : "archived"}>
                  {p.status === "activa" ? "Activa" : "Archivada"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{LOCATION_LABELS[p.current_location as keyof typeof LOCATION_LABELS]}</span>
                {p.current_bed && <span className="font-medium">Cama {p.current_bed}</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
