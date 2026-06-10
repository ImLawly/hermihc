import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calcTAM, parseTA, fmtDateTime, timeSinceAdmission, toLocalInputValue } from "@/lib/medical";
import { toast } from "sonner";
import { CheckCircle2, Plus } from "lucide-react";
import { AuthorStamp } from "@/components/AuthorStamp";

export function Tab2Evoluciones({ admission }: { admission: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: evolutions, refetch } = useQuery({
    queryKey: ["evolutions", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("evolutions").select("*").eq("admission_id", admission.id).order("evolution_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">Tiempo de hospitalización: <span className="font-medium text-foreground">{timeSinceAdmission(admission.admission_date)}</span></p>
        {auth.isMedical && <Button size="sm" onClick={() => setShowNew(v => !v)}><Plus className="w-3.5 h-3.5 mr-1" /> Nueva evolución</Button>}
      </div>

      {showNew && auth.isMedical && (
        <NewEvolutionForm admissionId={admission.id} onSaved={() => { setShowNew(false); refetch(); }} />
      )}

      {(evolutions ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin evoluciones registradas.</p>}

      {evolutions?.map(ev => (
        <EvolutionCard key={ev.id} ev={ev} admissionDate={admission.admission_date} onChanged={() => qc.invalidateQueries({ queryKey: ["evolutions", admission.id] })} />
      ))}
    </div>
  );
}

function NewEvolutionForm({ admissionId, onSaved }: { admissionId: string; onSaved: () => void }) {
  const auth = useAuth();
  const [evolution_at, setAt] = useState(toLocalInputValue());
  const [diagnostico_actual, setDx] = useState("");
  const [subjetivo, setSubj] = useState("");
  const [plan, setPlan] = useState("");
  const [ta, setTa] = useState(""); const [fc, setFc] = useState(""); const [fr, setFr] = useState(""); const [sato2, setSat] = useState("");
  const [examen_fisico, setEf] = useState("");

  const { sys, dia } = parseTA(ta); const tam = calcTAM(sys, dia);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("evolutions").insert({
        admission_id: admissionId,
        evolution_at: new Date(evolution_at).toISOString(),
        diagnostico_actual, subjetivo, plan,
        objetivo: { ta, tam, fc, fr, sato2, examen_fisico },
        created_by: auth.user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evolución guardada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form className="bg-card border rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label className="text-xs">Fecha y hora</Label><Input type="datetime-local" value={evolution_at} onChange={e => setAt(e.target.value)} /></div>
        <div><Label className="text-xs">Diagnóstico actual</Label><Input value={diagnostico_actual} onChange={e => setDx(e.target.value)} /></div>
      </div>
      <div><Label className="text-xs">Subjetivo</Label><Textarea rows={2} value={subjetivo} onChange={e => setSubj(e.target.value)} /></div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div><Label className="text-xs">TA</Label><Input value={ta} onChange={e => setTa(e.target.value)} placeholder="120/80" /></div>
        <div><Label className="text-xs">TAM</Label><Input disabled value={tam ?? ""} /></div>
        <div><Label className="text-xs">FC</Label><Input value={fc} onChange={e => setFc(e.target.value)} /></div>
        <div><Label className="text-xs">FR</Label><Input value={fr} onChange={e => setFr(e.target.value)} /></div>
        <div><Label className="text-xs">SatO₂</Label><Input value={sato2} onChange={e => setSat(e.target.value)} /></div>
      </div>
      <div><Label className="text-xs">Examen físico segmentado</Label><Textarea rows={3} value={examen_fisico} onChange={e => setEf(e.target.value)} /></div>
      <div><Label className="text-xs">Plan</Label><Textarea rows={2} value={plan} onChange={e => setPlan(e.target.value)} /></div>
      <div className="flex justify-end gap-2"><Button type="submit" disabled={save.isPending}>Guardar evolución</Button></div>
    </form>
  );
}

function EvolutionCard({ ev, admissionDate, onChanged }: { ev: any; admissionDate: string; onChanged: () => void }) {
  const auth = useAuth();
  const review = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("evolutions").update({
        record_status: "confirmado", reviewed_by: auth.user!.id, reviewed_at: new Date().toISOString(),
      } as any).eq("id", ev.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Evolución confirmada"); onChanged(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{fmtDateTime(ev.evolution_at)} · {timeSinceAdmission(admissionDate, new Date(ev.evolution_at))} desde el ingreso</p>
          <p className="font-medium text-sm">{ev.diagnostico_actual || "Sin diagnóstico"}</p>
        </div>
        <span className="status-pill" data-tone={ev.record_status === "confirmado" ? "confirmed" : "pending"}>
          {ev.record_status === "confirmado" ? "Confirmado" : "Pendiente"}
        </span>
      </div>
      {ev.subjetivo && <p className="text-sm mt-2"><strong className="text-xs uppercase text-muted-foreground">Subjetivo:</strong> {ev.subjetivo}</p>}
      {ev.objetivo && (
        <p className="text-xs mt-1 text-muted-foreground">
          TA {ev.objetivo.ta ?? "—"} · TAM {ev.objetivo.tam ?? "—"} · FC {ev.objetivo.fc ?? "—"} · FR {ev.objetivo.fr ?? "—"} · SatO₂ {ev.objetivo.sato2 ?? "—"}
        </p>
      )}
      {ev.objetivo?.examen_fisico && <p className="text-sm mt-1">{ev.objetivo.examen_fisico}</p>}
      {ev.plan && <p className="text-sm mt-2"><strong className="text-xs uppercase text-muted-foreground">Plan:</strong> {ev.plan}</p>}
      {auth.canReview && ev.record_status === "pendiente_revision" && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => review.mutate()}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar
          </Button>
        </div>
      )}
      <AuthorStamp
        userId={ev.created_by}
        date={ev.created_at}
        reviewerId={ev.reviewed_by}
        reviewedAt={ev.reviewed_at}
      />
    </div>
  );
}
