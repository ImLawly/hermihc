import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Baby, Search, ArrowRight } from "lucide-react";
import { fmtDateTime } from "@/lib/medical";

export const Route = createFileRoute("/_authenticated/neonatos")({
  head: () => ({ meta: [{ title: "Recién nacidos — Historial" }] }),
  component: NeonatosIndex,
});

const STATUS_LABEL: Record<string, string> = {
  en_sala_partos: "En sala de partos",
  cerrado_enfermeria: "Cerrado — pendiente pediatría",
  ingresado_neonato: "Ingresado a Neonatología",
  constancia_historica: "Constancia histórica",
};

function NeonatosIndex() {
  const auth = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const canView = auth.isSuperuser || auth.isAdmin ||
    auth.roles.some(r => r.service === "pediatria" || r.service === "obstetricia");

  const { data: records, isLoading } = useQuery({
    queryKey: ["newborn-index", status],
    queryFn: async () => {
      let query = supabase
        .from("newborn_records")
        .select("*, mother:mother_patient_id(nombres,apellidos,cedula_type,cedula_number)")
        .order("fecha_nacimiento", { ascending: false, nullsFirst: false })
        .limit(200);
      if (status !== "all") query = query.eq("status", status as any);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView && !!auth.user,
  });

  const filtered = useMemo(() => {
    if (!records) return [];
    if (!q.trim()) return records;
    const s = q.toLowerCase();
    return records.filter((r: any) =>
      `${r.nombres ?? ""} ${r.apellidos ?? ""}`.toLowerCase().includes(s) ||
      `${r.mother?.nombres ?? ""} ${r.mother?.apellidos ?? ""}`.toLowerCase().includes(s) ||
      (r.mother?.cedula_number ?? "").includes(s)
    );
  }, [records, q]);

  if (!canView) {
    return <p className="text-sm text-muted-foreground">No tienes permisos para ver el historial de recién nacidos.</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold flex items-center gap-2"><Baby className="w-5 h-5" /> Recién nacidos</h1>
        <p className="text-sm text-muted-foreground">Historial completo. Búsqueda por nombre del neonato, madre o cédula de la madre.</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar por nombre del niño, madre o cédula" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="all">Todos los estados</option>
          <option value="en_sala_partos">En sala de partos</option>
          <option value="cerrado_enfermeria">Pendiente pediatría</option>
          <option value="ingresado_neonato">Ingresados a Neonatología</option>
          <option value="constancia_historica">Constancia histórica</option>
        </select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">Sin resultados.</p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r: any) => (
            <div key={r.id} className="bg-card border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate flex items-center gap-1"><Baby className="w-3.5 h-3.5" /> {r.apellidos ?? "—"}, {r.nombres ?? "RN sin nombre"}</p>
                  <p className="text-[11px] text-muted-foreground">Madre: {r.mother?.apellidos ?? "?"}, {r.mother?.nombres ?? "?"} · {r.mother?.cedula_type}-{r.mother?.cedula_number}</p>
                </div>
                <span className="status-pill" data-tone={r.status === "ingresado_neonato" || r.status === "constancia_historica" ? "confirmed" : "pending"}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-[11px]">
                <div><p className="text-muted-foreground">Peso</p><p className="font-medium">{r.peso_gr ? `${r.peso_gr}g` : "—"}</p></div>
                <div><p className="text-muted-foreground">Talla</p><p className="font-medium">{r.talla_cm ? `${r.talla_cm}cm` : "—"}</p></div>
                <div><p className="text-muted-foreground">APGAR</p><p className="font-medium">{r.apgar_1 ?? "?"}/{r.apgar_5 ?? "?"}</p></div>
                <div><p className="text-muted-foreground">Nac.</p><p className="font-medium">{r.fecha_nacimiento ? fmtDateTime(r.fecha_nacimiento).split(",")[0] : "—"}</p></div>
              </div>
              <div className="mt-3 flex gap-2 flex-wrap">
                {r.pediatric_patient_id && (
                  <Link to="/pacientes/$patientId" params={{ patientId: r.pediatric_patient_id }} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    Expediente pediátrico <ArrowRight className="w-3 h-3" />
                  </Link>
                )}
                <Link to="/pacientes/$patientId" params={{ patientId: r.mother_patient_id }} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  Ver madre <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
