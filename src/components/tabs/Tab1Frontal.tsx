import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { calcTAM, parseTA, fmtDateTime } from "@/lib/medical";
import { toast } from "sonner";
import { CheckCircle2, Lock, Pencil, X } from "lucide-react";

export function Tab1Frontal({ admission, patient }: { admission: any; patient: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    motivo_consulta: admission.motivo_consulta ?? "",
    historia_enfermedad_actual: admission.historia_enfermedad_actual ?? "",
    antecedentes_personales: admission.antecedentes_personales ?? "",
    antecedentes_familiares: admission.antecedentes_familiares ?? "",
    antecedentes_quirurgicos: admission.antecedentes_quirurgicos ?? "",
    habitos_psicobiologicos: admission.habitos_psicobiologicos ?? "",
    gineco: admission.antecedentes_ginecobstetricos ?? { gesta: "", para: "", abortos: "", cesareas: "", partos: "", detalles: "" },
    ef: admission.examen_fisico ?? { ta: "", fc: "", fr: "", temp: "", sato2: "", peso: "", talla: "", descripcion: "" },
    labs_ingreso: admission.labs_ingreso ?? "",
    impresion_diagnostica: admission.impresion_diagnostica ?? "",
    comentario_ingreso: admission.comentario_ingreso ?? "",
    diagnostico_egreso: admission.diagnostico_egreso ?? "",
  });

  const locked = admission.discharge_at != null;
  const [editing, setEditing] = useState(false);
  const readOnly = locked || !editing;
  const { sys, dia } = parseTA(form.ef.ta);
  const tam = calcTAM(sys, dia);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("admissions").update({
        motivo_consulta: form.motivo_consulta,
        historia_enfermedad_actual: form.historia_enfermedad_actual,
        antecedentes_personales: form.antecedentes_personales,
        antecedentes_familiares: form.antecedentes_familiares,
        antecedentes_quirurgicos: form.antecedentes_quirurgicos,
        habitos_psicobiologicos: form.habitos_psicobiologicos,
        antecedentes_ginecobstetricos: form.gineco,
        examen_fisico: { ...form.ef, tam },
        labs_ingreso: form.labs_ingreso,
        impresion_diagnostica: form.impresion_diagnostica,
        comentario_ingreso: form.comentario_ingreso,
      } as any).eq("id", admission.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admission", admission.patient_id] }); setEditing(false); toast.success("Hoja frontal guardada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("admissions").update({
        record_status: "confirmado",
        reviewed_by: auth.user!.id,
        reviewed_at: new Date().toISOString(),
      } as any).eq("id", admission.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admission", admission.patient_id] }); toast.success("Hoja confirmada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const discharge = useMutation({
    mutationFn: async (type: "alta_medica" | "contraopinion") => {
      const { error: e1 } = await supabase.from("admissions").update({
        discharge_type: type, discharge_at: new Date().toISOString(),
        diagnostico_egreso: form.diagnostico_egreso || form.impresion_diagnostica,
        status: "archivada",
      } as any).eq("id", admission.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("patients").update({ status: "archivada" } as any).eq("id", admission.patient_id);
      if (e2) throw e2;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Paciente dado de alta"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      {!locked && auth.isMedical && (
        <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            {editing ? <Pencil className="w-3.5 h-3.5 text-[color:var(--tab-active)]" /> : <Lock className="w-3.5 h-3.5" />}
            {editing ? "Modo edición — recuerda Guardar al terminar" : "Modo solo lectura"}
          </p>
          {editing ? (
            <Button size="sm" variant="outline" onClick={() => {
              // reset form to original admission data and exit edit mode
              setForm({
                motivo_consulta: admission.motivo_consulta ?? "",
                historia_enfermedad_actual: admission.historia_enfermedad_actual ?? "",
                antecedentes_personales: admission.antecedentes_personales ?? "",
                antecedentes_familiares: admission.antecedentes_familiares ?? "",
                antecedentes_quirurgicos: admission.antecedentes_quirurgicos ?? "",
                habitos_psicobiologicos: admission.habitos_psicobiologicos ?? "",
                gineco: admission.antecedentes_ginecobstetricos ?? { gesta: "", para: "", abortos: "", cesareas: "", partos: "", detalles: "" },
                ef: admission.examen_fisico ?? { ta: "", fc: "", fr: "", temp: "", sato2: "", peso: "", talla: "", descripcion: "" },
                labs_ingreso: admission.labs_ingreso ?? "",
                impresion_diagnostica: admission.impresion_diagnostica ?? "",
                comentario_ingreso: admission.comentario_ingreso ?? "",
                diagnostico_egreso: admission.diagnostico_egreso ?? "",
              });
              setEditing(false);
            }}>
              <X className="w-3.5 h-3.5 mr-1" /> Cancelar edición
            </Button>
          ) : (
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
            </Button>
          )}
        </div>
      )}
      <Section title="Datos de ingreso">
        <Field label="Fecha y hora de ingreso"><Input type="text" disabled value={fmtDateTime(admission.admission_date)} /></Field>
        <Field label="Motivo de consulta"><Textarea rows={2} value={form.motivo_consulta} onChange={e => setForm({ ...form, motivo_consulta: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Historia de la enfermedad actual" wide><Textarea rows={4} value={form.historia_enfermedad_actual} onChange={e => setForm({ ...form, historia_enfermedad_actual: e.target.value })} disabled={readOnly} /></Field>
      </Section>

      <Section title="Antecedentes">
        <Field label="Personales"><Textarea rows={2} value={form.antecedentes_personales} onChange={e => setForm({ ...form, antecedentes_personales: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Familiares"><Textarea rows={2} value={form.antecedentes_familiares} onChange={e => setForm({ ...form, antecedentes_familiares: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Quirúrgicos"><Textarea rows={2} value={form.antecedentes_quirurgicos} onChange={e => setForm({ ...form, antecedentes_quirurgicos: e.target.value })} disabled={readOnly} /></Field>
        <Field label="Hábitos psicobiológicos"><Textarea rows={2} value={form.habitos_psicobiologicos} onChange={e => setForm({ ...form, habitos_psicobiologicos: e.target.value })} disabled={readOnly} /></Field>
      </Section>

      <Section title="Antecedentes ginecobstétricos">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 col-span-full">
          {(["gesta", "para", "abortos", "cesareas", "partos"] as const).map(k => (
            <div key={k}><Label className="capitalize text-xs">{k}</Label>
              <Input inputMode="numeric" value={form.gineco[k]} disabled={readOnly}
                onChange={e => setForm({ ...form, gineco: { ...form.gineco, [k]: e.target.value } })} />
            </div>
          ))}
        </div>
        <Field label="Evolución de embarazos previos / patologías" wide>
          <Textarea rows={3} value={form.gineco.detalles} disabled={readOnly}
            onChange={e => setForm({ ...form, gineco: { ...form.gineco, detalles: e.target.value } })} />
        </Field>
      </Section>

      <Section title="Examen físico de ingreso">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 col-span-full">
          <div><Label className="text-xs">TA (mmHg)</Label><Input placeholder="120/80" value={form.ef.ta} disabled={readOnly} onChange={e => setForm({ ...form, ef: { ...form.ef, ta: e.target.value } })} /></div>
          <div><Label className="text-xs">TAM</Label><Input disabled value={tam ?? ""} /></div>
          <div><Label className="text-xs">FC</Label><Input inputMode="numeric" value={form.ef.fc} disabled={readOnly} onChange={e => setForm({ ...form, ef: { ...form.ef, fc: e.target.value } })} /></div>
          <div><Label className="text-xs">FR</Label><Input inputMode="numeric" value={form.ef.fr} disabled={readOnly} onChange={e => setForm({ ...form, ef: { ...form.ef, fr: e.target.value } })} /></div>
          <div><Label className="text-xs">T° (°C)</Label><Input value={form.ef.temp} disabled={readOnly} onChange={e => setForm({ ...form, ef: { ...form.ef, temp: e.target.value } })} /></div>
          <div><Label className="text-xs">SatO₂ (%)</Label><Input value={form.ef.sato2} disabled={readOnly} onChange={e => setForm({ ...form, ef: { ...form.ef, sato2: e.target.value } })} /></div>
          <div><Label className="text-xs">Peso (kg)</Label><Input value={form.ef.peso} disabled={readOnly} onChange={e => setForm({ ...form, ef: { ...form.ef, peso: e.target.value } })} /></div>
          <div><Label className="text-xs">Talla (cm)</Label><Input value={form.ef.talla} disabled={readOnly} onChange={e => setForm({ ...form, ef: { ...form.ef, talla: e.target.value } })} /></div>
        </div>
        <Field label="Descripción del examen físico" wide>
          <Textarea rows={3} value={form.ef.descripcion} disabled={readOnly} onChange={e => setForm({ ...form, ef: { ...form.ef, descripcion: e.target.value } })} />
        </Field>
      </Section>

      <Section title="Laboratorios e imagen al ingreso">
        <Field label="Hallazgos descriptivos" wide><Textarea rows={3} value={form.labs_ingreso} disabled={readOnly} onChange={e => setForm({ ...form, labs_ingreso: e.target.value })} /></Field>
      </Section>

      <Section title="Diagnósticos">
        <Field label="Impresión diagnóstica" wide><Textarea rows={3} value={form.impresion_diagnostica} disabled={readOnly} onChange={e => setForm({ ...form, impresion_diagnostica: e.target.value })} /></Field>
        <Field label="Comentario (conducta, justificación)" wide><Textarea rows={3} value={form.comentario_ingreso} disabled={readOnly} onChange={e => setForm({ ...form, comentario_ingreso: e.target.value })} /></Field>
      </Section>

      {!locked && (
        <div className="flex flex-wrap gap-2 justify-end sticky bottom-0 bg-background/95 backdrop-blur py-2 -mx-4 px-4 border-t">
          <Button variant="outline" onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          {auth.canReview && admission.record_status === "pendiente_revision" && (
            <Button onClick={() => review.mutate()} disabled={review.isPending}>
              <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar revisión
            </Button>
          )}
        </div>
      )}

      <Section title="Diagnósticos de egreso">
        <Field label="Diagnóstico de egreso" wide>
          <Textarea rows={2} value={form.diagnostico_egreso}
            disabled={readOnly}
            onChange={e => setForm({ ...form, diagnostico_egreso: e.target.value })} />
        </Field>
        {locked ? (
          <div className="col-span-full text-xs text-muted-foreground flex items-center gap-2">
            <Lock className="w-3 h-3" /> Paciente egresada el {fmtDateTime(admission.discharge_at)} ({admission.discharge_type})
          </div>
        ) : auth.isMedical && (
          <div className="col-span-full flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => discharge.mutate("contraopinion")} disabled={discharge.isPending}>Egreso por contraopinión</Button>
            <Button onClick={() => discharge.mutate("alta_medica")} disabled={discharge.isPending}>Dar de alta médica</Button>
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border rounded-2xl p-4">
      <h2 className="text-sm font-semibold mb-3 text-[color:var(--tab-active)]">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>
    </section>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
