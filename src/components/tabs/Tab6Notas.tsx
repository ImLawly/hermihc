import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime, toLocalInputValue, NOTE_TYPE_LABELS } from "@/lib/medical";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AuthorStamp } from "@/components/AuthorStamp";

export function Tab6Notas({ admission }: { admission: any }) {
  const [section, setSection] = useState<"parto" | "operatoria" | "notas">("parto");
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className="med-tab" data-active={section === "parto"} onClick={() => setSection("parto")}>Nota de parto</button>
        <button className="med-tab" data-active={section === "operatoria"} onClick={() => setSection("operatoria")}>Nota operatoria</button>
        <button className="med-tab" data-active={section === "notas"} onClick={() => setSection("notas")}>Notas médicas / Enfermería</button>
      </div>
      {section === "parto" && <DeliverySection admission={admission} />}
      {section === "operatoria" && <OperativeSection admission={admission} />}
      {section === "notas" && <NotesSection admission={admission} />}
    </div>
  );
}

function DeliverySection({ admission }: { admission: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const { data: items } = useQuery({
    queryKey: ["delivery", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("delivery_notes").select("*").eq("admission_id", admission.id).order("expulsion_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <section className="bg-card border rounded-2xl p-4">
      <div className="flex justify-between mb-3">
        <h2 className="text-sm font-semibold text-[color:var(--tab-active)] text-center w-full">NOTA DE PARTO</h2>
        {auth.isMedical && <Button size="sm" onClick={() => setShowNew(v => !v)}><Plus className="w-3.5 h-3.5 mr-1" /></Button>}
      </div>
      {showNew && auth.isMedical && <NewDelivery admissionId={admission.id} onSaved={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["delivery", admission.id] }); }} />}
      {items?.map(n => (
        <div key={n.id} className="border-t pt-3 mt-3">
          <p className="text-xs text-muted-foreground">Fecha/hora de expulsión: {fmtDateTime(n.expulsion_at)}</p>
          <p className="text-sm mt-2 whitespace-pre-wrap">{n.descripcion}</p>
          {n.diagnostico_egreso_mesa && <p className="text-xs mt-2"><strong>Dx egreso de mesa:</strong> {n.diagnostico_egreso_mesa}</p>}
        </div>
      ))}
    </section>
  );
}

function NewDelivery({ admissionId, onSaved }: { admissionId: string; onSaved: () => void }) {
  const auth = useAuth();
  const [f, setF] = useState({ expulsion_at: toLocalInputValue(), descripcion: "", diagnostico_egreso_mesa: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("delivery_notes").insert({
        admission_id: admissionId,
        expulsion_at: new Date(f.expulsion_at).toISOString(),
        descripcion: f.descripcion, diagnostico_egreso_mesa: f.diagnostico_egreso_mesa,
        created_by: auth.user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nota de parto guardada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="space-y-2 border-t pt-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div><Label className="text-xs">Fecha y hora de expulsión</Label><Input type="datetime-local" value={f.expulsion_at} onChange={e => setF({ ...f, expulsion_at: e.target.value })} /></div>
      <div><Label className="text-xs">Descripción del parto</Label><Textarea rows={5} value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} required /></div>
      <div><Label className="text-xs">Diagnóstico de egreso de mesa ginecológica</Label><Textarea rows={2} value={f.diagnostico_egreso_mesa} onChange={e => setF({ ...f, diagnostico_egreso_mesa: e.target.value })} /></div>
      <div className="flex justify-end"><Button size="sm" type="submit" disabled={save.isPending}>Guardar</Button></div>
    </form>
  );
}

function OperativeSection({ admission }: { admission: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const { data: items } = useQuery({
    queryKey: ["operative", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("operative_notes").select("*").eq("admission_id", admission.id).order("surgery_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <section className="bg-card border rounded-2xl p-4">
      <div className="flex justify-between mb-3">
        <h2 className="text-sm font-semibold text-[color:var(--tab-active)] text-center w-full">NOTA OPERATORIA</h2>
        {auth.isMedical && <Button size="sm" onClick={() => setShowNew(v => !v)}><Plus className="w-3.5 h-3.5 mr-1" /></Button>}
      </div>
      {showNew && auth.isMedical && <NewOperative admissionId={admission.id} onSaved={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["operative", admission.id] }); }} />}
      {items?.map(op => (
        <div key={op.id} className="border-t pt-3 mt-3 text-sm">
          <p className="text-xs text-muted-foreground">{fmtDateTime(op.surgery_at)}</p>
          {op.diagnosticos_preoperatorios && <p><strong>Dx pre-op:</strong> {op.diagnosticos_preoperatorios}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 text-xs mt-2">
            {[
              ["Cirujano", op.cirujano], ["1er ayudante", op.primer_ayudante],
              ["2do ayudante", op.segundo_ayudante], ["3er ayudante", op.tercer_ayudante],
              ["Instrumentista", op.instrumentista], ["Circulante", op.circulante],
              ["Anestesiólogo", op.anestesiologo], ["Monitor anest.", op.monitor_anestesiologo],
              ["Monitor cir.", op.monitor_cirujano],
            ].map(([l, v]) => v && <p key={l}><strong>{l}:</strong> {v}</p>)}
          </div>
          <p className="mt-2"><strong>Descripción:</strong> {op.descripcion}</p>
          {op.hallazgos && <p><strong>Hallazgos:</strong> {op.hallazgos}</p>}
          {(op.rn_peso || op.rn_talla) && <p className="text-xs"><strong>RN:</strong> Peso {op.rn_peso ?? "—"} g · Talla {op.rn_talla ?? "—"} cm</p>}
          {op.diagnostico_postoperatorio && <p className="mt-1"><strong>Dx post-op:</strong> {op.diagnostico_postoperatorio}</p>}
        </div>
      ))}
    </section>
  );
}

function NewOperative({ admissionId, onSaved }: { admissionId: string; onSaved: () => void }) {
  const auth = useAuth();
  const [f, setF] = useState({
    surgery_at: toLocalInputValue(),
    diagnosticos_preoperatorios: "", cirujano: "", primer_ayudante: "", segundo_ayudante: "", tercer_ayudante: "",
    instrumentista: "", circulante: "", anestesiologo: "", monitor_anestesiologo: "", monitor_cirujano: "",
    descripcion: "", hallazgos: "", rn_peso: "", rn_talla: "", diagnostico_postoperatorio: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const { surgery_at, rn_peso, rn_talla, ...rest } = f;
      const { error } = await supabase.from("operative_notes").insert({
        admission_id: admissionId,
        surgery_at: new Date(surgery_at).toISOString(),
        ...rest,
        rn_peso: rn_peso ? Number(rn_peso) : null,
        rn_talla: rn_talla ? Number(rn_talla) : null,
        created_by: auth.user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nota operatoria guardada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-3 border-t pt-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label className="text-xs">Fecha y hora</Label><Input type="datetime-local" value={f.surgery_at} onChange={set("surgery_at")} /></div>
        <div><Label className="text-xs">Dx preoperatorios</Label><Input value={f.diagnosticos_preoperatorios} onChange={set("diagnosticos_preoperatorios")} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {(["cirujano", "primer_ayudante", "segundo_ayudante", "tercer_ayudante", "instrumentista", "circulante", "anestesiologo", "monitor_anestesiologo", "monitor_cirujano"] as const).map(k => (
          <div key={k}><Label className="text-xs capitalize">{k.replace(/_/g, " ")}</Label><Input value={f[k]} onChange={set(k)} /></div>
        ))}
      </div>
      <div><Label className="text-xs">Descripción de la intervención</Label><Textarea rows={4} value={f.descripcion} onChange={set("descripcion")} required /></div>
      <div><Label className="text-xs">Hallazgos</Label><Textarea rows={2} value={f.hallazgos} onChange={set("hallazgos")} /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Peso RN (g)</Label><Input value={f.rn_peso} onChange={set("rn_peso")} inputMode="numeric" /></div>
        <div><Label className="text-xs">Talla RN (cm)</Label><Input value={f.rn_talla} onChange={set("rn_talla")} inputMode="numeric" /></div>
      </div>
      <div><Label className="text-xs">Diagnóstico postoperatorio</Label><Textarea rows={2} value={f.diagnostico_postoperatorio} onChange={set("diagnostico_postoperatorio")} /></div>
      <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>Guardar nota</Button></div>
    </form>
  );
}

function NotesSection({ admission }: { admission: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"medica" | "aclaratoria" | "enfermeria">("medica");
  const [contenido, setContenido] = useState("");
  const [note_at, setAt] = useState(toLocalInputValue());

  const { data: notes } = useQuery({
    queryKey: ["notes", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinical_notes").select("*").eq("admission_id", admission.id).order("note_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clinical_notes").insert({
        admission_id: admission.id,
        tipo, note_at: new Date(note_at).toISOString(), contenido,
        created_by: auth.user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Nota guardada"); setContenido(""); qc.invalidateQueries({ queryKey: ["notes", admission.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const canWrite = (tipo === "enfermeria" ? auth.isNurse || auth.isMedical : auth.isMedical);

  return (
    <section className="bg-card border rounded-2xl p-4 space-y-3">
      <h2 className="text-sm font-semibold text-[color:var(--tab-active)]">Notas</h2>
      {canWrite && (
        <form className="space-y-2 border-b pb-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><Label className="text-xs">Tipo</Label>
              <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={tipo} onChange={e => setTipo(e.target.value as typeof tipo)}>
                {auth.isMedical && <option value="medica">Nota médica</option>}
                {auth.isMedical && <option value="aclaratoria">Nota aclaratoria</option>}
                <option value="enfermeria">Nota de enfermería</option>
              </select>
            </div>
            <div><Label className="text-xs">Fecha y hora</Label><Input type="datetime-local" value={note_at} onChange={e => setAt(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Contenido</Label><Textarea rows={3} value={contenido} onChange={e => setContenido(e.target.value)} required /></div>
          <div className="flex justify-end"><Button size="sm" type="submit" disabled={save.isPending}>Añadir nota</Button></div>
        </form>
      )}
      <div className="space-y-2">
        {notes?.map(n => (
          <div key={n.id} className="border rounded-lg p-3">
            <p className="text-xs text-muted-foreground">{NOTE_TYPE_LABELS[n.tipo as keyof typeof NOTE_TYPE_LABELS]} · {fmtDateTime(n.note_at)}</p>
            <p className="text-sm mt-1 whitespace-pre-wrap">{n.contenido}</p>
            <AuthorStamp userId={n.created_by} date={n.created_at} label="Nota por" />
          </div>
        ))}
        {(notes ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin notas.</p>}
      </div>
    </section>
  );
}
