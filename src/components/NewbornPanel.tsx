import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Baby, Lock, Plus, Stethoscope, Archive, ArrowRight } from "lucide-react";
import { fmtDateTime } from "@/lib/medical";
import { Link } from "@tanstack/react-router";

type Sex = "masculino" | "femenino" | "indeterminado";
type Resp = "espontaneo" | "estimulacion";
type Status = "en_sala_partos" | "cerrado_enfermeria" | "ingresado_neonato" | "constancia_historica";

const STATUS_LABEL: Record<Status, string> = {
  en_sala_partos: "En sala de partos",
  cerrado_enfermeria: "Cerrado — pendiente pediatría",
  ingresado_neonato: "Ingresado a Neonatología",
  constancia_historica: "Constancia histórica archivada",
};

export function NewbornPanel({ admission, patient }: { admission: any; patient: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const canInitNursing =
    auth.isSuperuser ||
    auth.isAdmin ||
    auth.roles.some(r => r.service === "obstetricia" || r.service === "pediatria");

  const { data: items, isLoading } = useQuery({
    queryKey: ["newborn", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newborn_records")
        .select("*")
        .eq("mother_admission_id", admission.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (vals: { nombres: string; apellidos: string; sexo: Sex | null }) => {
      const { error } = await supabase.from("newborn_records").insert({
        mother_admission_id: admission.id,
        mother_patient_id: patient.id,
        nombres: vals.nombres || null,
        apellidos: vals.apellidos || patient.apellidos,
        sexo: vals.sexo,
        created_by: auth.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { setShowNew(false); qc.invalidateQueries({ queryKey: ["newborn", admission.id] }); toast.success("Registro de recién nacido iniciado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="bg-card border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[color:var(--tab-active)] flex items-center gap-2">
          <Baby className="w-4 h-4" /> RECIÉN NACIDO
        </h2>
        {canInitNursing && (
          <Button size="sm" onClick={() => setShowNew(v => !v)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nuevo
          </Button>
        )}
      </div>

      {!canInitNursing && (
        <p className="text-xs text-muted-foreground">Solo el personal de enfermería o pediatría puede iniciar el registro del recién nacido.</p>
      )}

      {showNew && canInitNursing && (
        <NewbornCreateForm motherApellidos={patient.apellidos} onCancel={() => setShowNew(false)} onSubmit={(v) => create.mutate(v)} pending={create.isPending} />
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground mt-3">Cargando…</p>
      ) : (items?.length ?? 0) === 0 ? (
        !showNew && <p className="text-xs text-muted-foreground mt-3">Sin registros. Enfermería puede iniciar la hoja del recién nacido antes o después del parto.</p>
      ) : (
        <div className="space-y-3 mt-3">
          {items!.map((r: any) => (
            <NewbornCard key={r.id} record={r} motherPatient={patient} />
          ))}
        </div>
      )}
    </section>
  );
}

function NewbornCreateForm({ motherApellidos, onCancel, onSubmit, pending }:
  { motherApellidos: string; onCancel: () => void; onSubmit: (v: { nombres: string; apellidos: string; sexo: Sex | null }) => void; pending: boolean }) {
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState(motherApellidos ?? "");
  const [sexo, setSexo] = useState<Sex | "">("");
  return (
    <div className="border rounded-xl p-3 space-y-3 bg-background/50">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Nombre(s) del recién nacido</Label>
          <Input value={nombres} onChange={e => setNombres(e.target.value)} placeholder="Ej: RN de María / José Antonio" />
        </div>
        <div>
          <Label>Apellidos</Label>
          <Input value={apellidos} onChange={e => setApellidos(e.target.value)} />
        </div>
        <div>
          <Label>Sexo</Label>
          <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={sexo} onChange={e => setSexo(e.target.value as Sex | "")}>
            <option value="">—</option>
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
            <option value="indeterminado">Indeterminado</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" disabled={pending} onClick={() => onSubmit({ nombres: nombres.trim(), apellidos: apellidos.trim(), sexo: sexo || null })}>Guardar</Button>
      </div>
    </div>
  );
}

function NewbornCard({ record, motherPatient }: { record: any; motherPatient: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const status: Status = record.status;

  const canNursingEdit =
    status === "en_sala_partos" &&
    (auth.isSuperuser || auth.isAdmin ||
      auth.roles.some(r => r.service === "obstetricia" || r.service === "pediatria"));

  const isPediatric =
    auth.isSuperuser || auth.isAdmin ||
    auth.roles.some(r => r.service === "pediatria");

  const canPediatricEdit = status !== "en_sala_partos" && isPediatric;

  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    nombres: record.nombres ?? "",
    apellidos: record.apellidos ?? "",
    sexo: (record.sexo ?? "") as Sex | "",
    fecha_nacimiento: record.fecha_nacimiento ? toLocalDT(record.fecha_nacimiento) : "",
    peso_gr: record.peso_gr ?? "",
    talla_cm: record.talla_cm ?? "",
    apgar_1: record.apgar_1 ?? "",
    apgar_5: record.apgar_5 ?? "",
    esfuerzo_respiratorio: (record.esfuerzo_respiratorio ?? "") as Resp | "",
    notas_enfermeria: record.notas_enfermeria ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nombres: form.nombres || null,
        apellidos: form.apellidos || null,
        sexo: form.sexo || null,
        fecha_nacimiento: form.fecha_nacimiento ? new Date(form.fecha_nacimiento).toISOString() : null,
        peso_gr: form.peso_gr === "" ? null : Number(form.peso_gr),
        talla_cm: form.talla_cm === "" ? null : Number(form.talla_cm),
        apgar_1: form.apgar_1 === "" ? null : Number(form.apgar_1),
        apgar_5: form.apgar_5 === "" ? null : Number(form.apgar_5),
        esfuerzo_respiratorio: form.esfuerzo_respiratorio || null,
        notas_enfermeria: form.notas_enfermeria || null,
      };
      const { error } = await supabase.from("newborn_records").update(payload).eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => { setEdit(false); qc.invalidateQueries({ queryKey: ["newborn", record.mother_admission_id] }); toast.success("Datos guardados"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeNursing = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("newborn_records").update({
        status: "cerrado_enfermeria" as Status,
        closed_by: auth.user!.id,
        closed_at: new Date().toISOString(),
      }).eq("id", record.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["newborn", record.mother_admission_id] }); toast.success("Hoja cerrada — pediatría toma el control"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const admitNeonato = useMutation({
    mutationFn: async () => {
      // Create neonate patient (synthetic cedula) + admission in pediatria + link
      const cedulaNum = String(Date.now()).slice(-9);
      const displayName = [record.nombres, record.apellidos].filter(Boolean).join(" ") || `RN de ${motherPatient.apellidos}`;
      const fullApellidos = record.apellidos || motherPatient.apellidos;
      const fullNombres = record.nombres || `RN de ${motherPatient.nombres}`;

      const { data: p, error: pe } = await supabase.from("patients").insert({
        cedula_type: "V",
        cedula_number: cedulaNum,
        nombres: fullNombres,
        apellidos: fullApellidos,
        fecha_nacimiento: (record.fecha_nacimiento ?? new Date().toISOString()).substring(0, 10),
        telefono: motherPatient.telefono ?? null,
        service: "pediatria",
        current_location: "hospitalizacion",
        current_bed: null,
        status: "activa",
        created_by: auth.user!.id,
      }).select("id").single();
      if (pe) throw pe;

      const { data: a, error: ae } = await supabase.from("admissions").insert({
        patient_id: p!.id,
        service: "pediatria",
        location: "hospitalizacion",
        bed: null,
        admission_date: new Date().toISOString(),
        impresion_diagnostica: `Neonato — hijo/a de ${motherPatient.apellidos}, ${motherPatient.nombres}. APGAR ${record.apgar_1 ?? "?"}/${record.apgar_5 ?? "?"}`,
        created_by: auth.user!.id,
      }).select("id").single();
      if (ae) throw ae;

      const { error: le } = await supabase.from("newborn_records").update({
        status: "ingresado_neonato" as Status,
        pediatric_patient_id: p!.id,
        pediatric_admission_id: a!.id,
      }).eq("id", record.id);
      if (le) throw le;

      return { patientId: p!.id, displayName };
    },
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ["newborn", record.mother_admission_id] }); toast.success(`${r.displayName} ingresado a Neonatología`); },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveConstancia = useMutation({
    mutationFn: async () => {
      // Create archived patient record for historical lookup
      const cedulaNum = String(Date.now()).slice(-9);
      const fullApellidos = record.apellidos || motherPatient.apellidos;
      const fullNombres = record.nombres || `RN de ${motherPatient.nombres}`;

      const { data: p, error: pe } = await supabase.from("patients").insert({
        cedula_type: "V",
        cedula_number: cedulaNum,
        nombres: fullNombres,
        apellidos: fullApellidos,
        fecha_nacimiento: (record.fecha_nacimiento ?? new Date().toISOString()).substring(0, 10),
        telefono: motherPatient.telefono ?? null,
        service: "pediatria",
        current_location: "consulta_externa",
        current_bed: null,
        status: "archivada",
        created_by: auth.user!.id,
      }).select("id").single();
      if (pe) throw pe;

      const { error: le } = await supabase.from("newborn_records").update({
        status: "constancia_historica" as Status,
        pediatric_patient_id: p!.id,
      }).eq("id", record.id);
      if (le) throw le;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["newborn", record.mother_admission_id] }); toast.success("Constancia histórica archivada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border rounded-xl p-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-semibold flex items-center gap-2">
            <Baby className="w-4 h-4" />
            {record.apellidos || motherPatient.apellidos}, {record.nombres || "RN sin nombre"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {record.sexo ? `${record.sexo.charAt(0).toUpperCase()}${record.sexo.slice(1)} · ` : ""}
            {record.fecha_nacimiento ? `Nac.: ${fmtDateTime(record.fecha_nacimiento)}` : "Sin fecha de nacimiento"}
          </p>
        </div>
        <span className="status-pill" data-tone={status === "en_sala_partos" ? "pending" : status === "cerrado_enfermeria" ? "pending" : "confirmed"}>
          {STATUS_LABEL[status]}
        </span>
      </div>

      {!edit ? (
        <div className="grid gap-2 sm:grid-cols-4 text-xs mt-3">
          <Metric label="Peso" value={record.peso_gr ? `${record.peso_gr} g` : "—"} />
          <Metric label="Talla" value={record.talla_cm ? `${record.talla_cm} cm` : "—"} />
          <Metric label="APGAR 1'" value={record.apgar_1 ?? "—"} />
          <Metric label="APGAR 5'" value={record.apgar_5 ?? "—"} />
          <div className="sm:col-span-4">
            <p className="text-[10px] uppercase text-muted-foreground">Esfuerzo respiratorio</p>
            <p className="text-xs">
              {record.esfuerzo_respiratorio === "espontaneo" && "Respiró y lloró de forma espontánea"}
              {record.esfuerzo_respiratorio === "estimulacion" && "Ameritó estimulación"}
              {!record.esfuerzo_respiratorio && "—"}
            </p>
          </div>
          {record.notas_enfermeria && (
            <div className="sm:col-span-4">
              <p className="text-[10px] uppercase text-muted-foreground">Notas de enfermería</p>
              <p className="text-xs whitespace-pre-wrap">{record.notas_enfermeria}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 mt-3">
          <div><Label>Nombres</Label><Input value={form.nombres} onChange={e => setForm({ ...form, nombres: e.target.value })} /></div>
          <div><Label>Apellidos</Label><Input value={form.apellidos} onChange={e => setForm({ ...form, apellidos: e.target.value })} /></div>
          <div><Label>Sexo</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={form.sexo} onChange={e => setForm({ ...form, sexo: e.target.value as Sex | "" })}>
              <option value="">—</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="indeterminado">Indeterminado</option>
            </select>
          </div>
          <div><Label>Fecha y hora de nacimiento</Label>
            <Input type="datetime-local" value={form.fecha_nacimiento} onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })} />
          </div>
          <div><Label>Peso (g)</Label><Input inputMode="numeric" value={form.peso_gr} onChange={e => setForm({ ...form, peso_gr: e.target.value.replace(/\D/g, "") })} /></div>
          <div><Label>Talla (cm)</Label><Input inputMode="decimal" value={form.talla_cm} onChange={e => setForm({ ...form, talla_cm: e.target.value })} /></div>
          <div><Label>APGAR 1 min</Label><Input inputMode="numeric" value={form.apgar_1} onChange={e => setForm({ ...form, apgar_1: e.target.value.replace(/\D/g, "") })} /></div>
          <div><Label>APGAR 5 min</Label><Input inputMode="numeric" value={form.apgar_5} onChange={e => setForm({ ...form, apgar_5: e.target.value.replace(/\D/g, "") })} /></div>
          <div className="sm:col-span-2">
            <Label>Esfuerzo respiratorio inicial</Label>
            <div className="flex gap-4 mt-2 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name={`resp-${record.id}`} checked={form.esfuerzo_respiratorio === "espontaneo"} onChange={() => setForm({ ...form, esfuerzo_respiratorio: "espontaneo" })} /> Respiró y lloró espontáneo</label>
              <label className="flex items-center gap-2"><input type="radio" name={`resp-${record.id}`} checked={form.esfuerzo_respiratorio === "estimulacion"} onChange={() => setForm({ ...form, esfuerzo_respiratorio: "estimulacion" })} /> Ameritó estimulación</label>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Notas de enfermería</Label>
            <Textarea rows={3} value={form.notas_enfermeria} onChange={e => setForm({ ...form, notas_enfermeria: e.target.value })} />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2 justify-end">
        {canNursingEdit && !edit && <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Editar</Button>}
        {canNursingEdit && edit && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </>
        )}
        {canNursingEdit && !edit && (
          <Button size="sm" variant="secondary" onClick={() => {
            if (confirm("Cerrar la hoja del recién nacido y traspasar el control a Pediatría. ¿Continuar?")) closeNursing.mutate();
          }} disabled={closeNursing.isPending}>
            <Lock className="w-3.5 h-3.5 mr-1" /> Cerrar y traspasar a Pediatría
          </Button>
        )}

        {canPediatricEdit && status === "cerrado_enfermeria" && (
          <>
            <Button size="sm" onClick={() => {
              if (confirm("Ingresar formalmente a Neonatología/UCIN. Se creará el expediente pediátrico. ¿Continuar?")) admitNeonato.mutate();
            }} disabled={admitNeonato.isPending}>
              <Stethoscope className="w-3.5 h-3.5 mr-1" /> Ingresar a Neonatología
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              if (confirm("Archivar como constancia histórica de nacimiento (neonato sano). ¿Continuar?")) archiveConstancia.mutate();
            }} disabled={archiveConstancia.isPending}>
              <Archive className="w-3.5 h-3.5 mr-1" /> Archivar constancia
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(v => !v)}>{edit ? "Cerrar" : "Editar datos"}</Button>
          </>
        )}

        {canPediatricEdit && status !== "cerrado_enfermeria" && !edit && (
          <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Editar</Button>
        )}
        {canPediatricEdit && edit && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancelar</Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </>
        )}

        {record.pediatric_patient_id && (
          <Button asChild size="sm" variant="outline">
            <Link to="/pacientes/$patientId" params={{ patientId: record.pediatric_patient_id }}>
              Abrir expediente pediátrico <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function toLocalDT(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
