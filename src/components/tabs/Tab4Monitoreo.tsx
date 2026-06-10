import React, { useState, useMemo, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calcTAM, parseTA, fmtDateTime, toLocalInputValue } from "@/lib/medical";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { AuthorStamp } from "@/components/AuthorStamp";

export function Tab4Monitoreo({ admission }: { admission: any }) {
  return (
    <div className="space-y-5">
      <MonitoringSection admission={admission} />
      <LabsSection admission={admission} />
    </div>
  );
}

function MonitoringSection({ admission }: { admission: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const { data: entries } = useQuery({
    queryKey: ["monitoring", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("monitoring_entries").select("*").eq("admission_id", admission.id).order("recorded_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <section className="bg-card border rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-[color:var(--tab-active)]">Tabla de monitoreo clínico</h2>
        {(auth.isMedical || auth.isNurse) && <Button size="sm" onClick={() => setShowNew(v => !v)}><Plus className="w-3.5 h-3.5 mr-1" /> Registro</Button>}
      </div>

      {showNew && <NewMonitoringForm admissionId={admission.id} onSaved={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["monitoring", admission.id] }); }} />}

      <div className="overflow-x-auto mt-3">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-2">Fecha/Hora</th>
              <th className="px-2">TA</th><th className="px-2">TAM</th>
              <th className="px-2">FC</th><th className="px-2">FR</th><th className="px-2">SatO₂</th>
              <th className="px-2">FCF</th><th className="px-2">DU</th><th className="px-2">MF</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map(m => (
              <Fragment key={m.id}>
                <tr className="border-b">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDateTime(m.recorded_at)}</td>
                  <td className="px-2">{m.ta ?? "—"}</td>
                  <td className="px-2">{m.tam ?? "—"}</td>
                  <td className="px-2">{m.fc ?? "—"}</td>
                  <td className="px-2">{m.fr ?? "—"}</td>
                  <td className="px-2">{m.sato2 ?? "—"}</td>
                  <td className="px-2">{m.fcf ?? "—"}</td>
                  <td className="px-2">{m.du ?? "—"}</td>
                  <td className="px-2">{m.mf ?? "—"}</td>
                </tr>
                <tr>
                  <td colSpan={9} className="pb-2">
                    <AuthorStamp userId={m.performed_by} date={m.recorded_at} label="Registro por" />
                  </td>
                </tr>
              </Fragment>
            ))}
            {(entries ?? []).length === 0 && <tr><td colSpan={9} className="py-3 text-center text-muted-foreground">Sin registros</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewMonitoringForm({ admissionId, onSaved }: { admissionId: string; onSaved: () => void }) {
  const auth = useAuth();
  const [f, setF] = useState({ recorded_at: toLocalInputValue(), ta: "", fc: "", fr: "", sato2: "", fcf: "", du: "", mf: "" });
  const { sys, dia } = parseTA(f.ta); const tam = calcTAM(sys, dia);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("monitoring_entries").insert({
        admission_id: admissionId,
        recorded_at: new Date(f.recorded_at).toISOString(),
        ta: f.ta || null, tam,
        fc: f.fc ? Number(f.fc) : null, fr: f.fr ? Number(f.fr) : null, sato2: f.sato2 ? Number(f.sato2) : null,
        fcf: f.fcf ? Number(f.fcf) : null, du: f.du || null, mf: f.mf || null,
        performed_by: auth.user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Registro añadido"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form className="grid grid-cols-2 sm:grid-cols-5 gap-2 border-t pt-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="col-span-2"><Label className="text-xs">Fecha/Hora</Label><Input type="datetime-local" value={f.recorded_at} onChange={e => setF({ ...f, recorded_at: e.target.value })} /></div>
      <div><Label className="text-xs">TA</Label><Input value={f.ta} onChange={e => setF({ ...f, ta: e.target.value })} placeholder="120/80" /></div>
      <div><Label className="text-xs">TAM</Label><Input disabled value={tam ?? ""} /></div>
      <div><Label className="text-xs">FC</Label><Input value={f.fc} onChange={e => setF({ ...f, fc: e.target.value })} /></div>
      <div><Label className="text-xs">FR</Label><Input value={f.fr} onChange={e => setF({ ...f, fr: e.target.value })} /></div>
      <div><Label className="text-xs">SatO₂</Label><Input value={f.sato2} onChange={e => setF({ ...f, sato2: e.target.value })} /></div>
      <div><Label className="text-xs">FCF</Label><Input value={f.fcf} onChange={e => setF({ ...f, fcf: e.target.value })} /></div>
      <div><Label className="text-xs">DU</Label><Input value={f.du} onChange={e => setF({ ...f, du: e.target.value })} /></div>
      <div><Label className="text-xs">MF</Label><Input value={f.mf} onChange={e => setF({ ...f, mf: e.target.value })} /></div>
      <div className="col-span-full flex justify-end"><Button size="sm" type="submit" disabled={save.isPending}>Añadir</Button></div>
    </form>
  );
}

function LabsSection({ admission }: { admission: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const { data: labs } = useQuery({
    queryKey: ["labs", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("lab_results").select("*").eq("admission_id", admission.id).order("sampled_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const pivot = useMemo(() => {
    const dates = Array.from(new Set((labs ?? []).map(l => new Date(l.sampled_at).toISOString().slice(0, 16)))).sort();
    const params = Array.from(new Set((labs ?? []).map(l => l.parametro))).sort();
    return { dates, params, get: (p: string, d: string) => (labs ?? []).find(l => l.parametro === p && new Date(l.sampled_at).toISOString().slice(0, 16) === d) };
  }, [labs]);

  return (
    <section className="bg-card border rounded-2xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-[color:var(--tab-active)]">Sábana de laboratorios</h2>
        {auth.isMedical && <Button size="sm" onClick={() => setShow(v => !v)}><Plus className="w-3.5 h-3.5 mr-1" /> Resultado</Button>}
      </div>
      {show && auth.isMedical && (
        <NewLabForm admissionId={admission.id} onSaved={() => { setShow(false); qc.invalidateQueries({ queryKey: ["labs", admission.id] }); }} />
      )}
      <div className="overflow-x-auto mt-3">
        <table className="min-w-full text-xs border">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-2 border-r">Parámetro</th>
              {pivot.dates.map(d => <th key={d} className="p-2 border-r whitespace-nowrap">{fmtDateTime(d)}</th>)}
              {pivot.dates.length === 0 && <th className="p-2 text-muted-foreground">Sin resultados</th>}
            </tr>
          </thead>
          <tbody>
            {pivot.params.map(p => (
              <tr key={p} className="border-t">
                <td className="p-2 font-medium border-r">{p}</td>
                {pivot.dates.map(d => {
                  const v = pivot.get(p, d);
                  return <td key={d} className="p-2 border-r">{v ? `${v.valor}${v.unidad ? " " + v.unidad : ""}` : ""}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function NewLabForm({ admissionId, onSaved }: { admissionId: string; onSaved: () => void }) {
  const auth = useAuth();
  const [f, setF] = useState({ sampled_at: toLocalInputValue(), parametro: "", valor: "", unidad: "" });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lab_results").insert({
        admission_id: admissionId,
        sampled_at: new Date(f.sampled_at).toISOString(),
        parametro: f.parametro, valor: f.valor, unidad: f.unidad || null,
        created_by: auth.user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Resultado añadido"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t pt-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div><Label className="text-xs">Fecha/Hora</Label><Input type="datetime-local" value={f.sampled_at} onChange={e => setF({ ...f, sampled_at: e.target.value })} /></div>
      <div><Label className="text-xs">Parámetro</Label><Input value={f.parametro} onChange={e => setF({ ...f, parametro: e.target.value })} placeholder="Hemoglobina" /></div>
      <div><Label className="text-xs">Valor</Label><Input value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} /></div>
      <div><Label className="text-xs">Unidad</Label><Input value={f.unidad} onChange={e => setF({ ...f, unidad: e.target.value })} placeholder="g/dL" /></div>
      <div className="col-span-full flex justify-end"><Button size="sm" type="submit" disabled={save.isPending}>Añadir</Button></div>
    </form>
  );
}
