import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calcAge, LOCATION_LABELS, fmtDateTime } from "@/lib/medical";
import { ArrowLeft, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sendPush } from "@/lib/push.functions";
import { deletePatientBySuper } from "@/lib/superuser.functions";

import { Tab1Frontal } from "@/components/tabs/Tab1Frontal";
import { Tab2Evoluciones } from "@/components/tabs/Tab2Evoluciones";
import { Tab3Ordenes } from "@/components/tabs/Tab3Ordenes";
import { Tab4Monitoreo } from "@/components/tabs/Tab4Monitoreo";
import { Tab5Interconsultas } from "@/components/tabs/Tab5Interconsultas";
import { Tab6Notas } from "@/components/tabs/Tab6Notas";

export const Route = createFileRoute("/_authenticated/pacientes/$patientId")({
  head: () => ({ meta: [{ title: "Historia clínica" }] }),
  component: PatientDetail,
});

const TABS = [
  { id: "frontal", label: "1. Hoja Frontal" },
  { id: "evoluciones", label: "2. Evoluciones" },
  { id: "ordenes", label: "3. Órdenes" },
  { id: "monitoreo", label: "4. Monitoreo / Labs" },
  { id: "interconsultas", label: "5. Interconsultas" },
  { id: "notas", label: "6. Parto / Operatoria" },
] as const;

type TabId = typeof TABS[number]["id"];

function PatientDetail() {
  const { patientId } = Route.useParams();
  const auth = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("frontal");
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string | null>(null);

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", patientId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: admissions } = useQuery({
    queryKey: ["admissions", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissions").select("*")
        .eq("patient_id", patientId)
        .order("admission_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // auto-select latest admission whenever the list changes
  useEffect(() => {
    if (!admissions || admissions.length === 0) { setSelectedAdmissionId(null); return; }
    if (!selectedAdmissionId || !admissions.find(a => a.id === selectedAdmissionId)) {
      setSelectedAdmissionId(admissions[0].id);
    }
  }, [admissions, selectedAdmissionId]);

  const admission = admissions?.find(a => a.id === selectedAdmissionId) ?? null;

  const invalidateAdmissions = () => {
    qc.invalidateQueries({ queryKey: ["admissions", patientId] });
    qc.invalidateQueries({ queryKey: ["admission", patientId] });
  };

  const createAdmission = useMutation({
    mutationFn: async () => {
      // If patient was archived, reactivate first
      if (patient!.status !== "activa") {
        await supabase.from("patients").update({ status: "activa" }).eq("id", patientId);
      }
      const { data, error } = await supabase.from("admissions").insert({
        patient_id: patientId,
        service: patient!.service,
        location: patient!.current_location,
        bed: patient!.current_bed,
        admission_date: new Date().toISOString(),
        created_by: auth.user!.id,
      }).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      invalidateAdmissions();
      qc.invalidateQueries({ queryKey: ["patient", patientId] });
      setSelectedAdmissionId(data.id);
      setTab("frontal");
      toast.success("Nuevo ingreso iniciado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pushFn = useServerFn(sendPush);
  const updateLocation = useMutation({
    mutationFn: async (vals: { current_location: "emergencia" | "hospitalizacion" | "consulta_externa"; current_bed: string | null }) => {
      const { error } = await supabase.from("patients").update(vals).eq("id", patientId);
      if (error) throw error;
      try {
        await pushFn({ data: {
          role: "traslado",
          title: "Reubicación de paciente",
          body: `${patient!.apellidos}, ${patient!.nombres} → ${LOCATION_LABELS[vals.current_location]}${vals.current_bed ? ` · Cama ${vals.current_bed}` : ""}`,
          url: `/traslados`,
          urgent: true,
        }});
      } catch { /* non-fatal */ }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["patient", patientId] }); toast.success("Ubicación actualizada — notificación enviada a Traslado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delPatientFn = useServerFn(deletePatientBySuper);
  const delPatient = useMutation({
    mutationFn: () => delPatientFn({ data: { patientId } }),
    onSuccess: () => {
      toast.success("Paciente eliminado");
      qc.invalidateQueries({ queryKey: ["patients"] });
      navigate({ to: "/pacientes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!patient) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const hasOpenAdmission = !!admissions?.find(a => !a.discharge_at);

  return (
    <div>
      <Link to="/pacientes" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver a pacientes
      </Link>

      {/* Encabezado paciente */}
      <div className="bg-card border rounded-2xl p-4 mb-4 flex flex-wrap items-start gap-4 justify-between">
        <div>
          <h1 className="text-lg font-semibold">{patient.apellidos}, {patient.nombres}</h1>
          <p className="text-xs text-muted-foreground">
            {patient.cedula_type}-{patient.cedula_number} · {calcAge(patient.fecha_nacimiento)} años · Servicio: {patient.service}
          </p>
          <p className="text-xs mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-primary" />
            {LOCATION_LABELS[patient.current_location as keyof typeof LOCATION_LABELS]}{patient.current_bed ? ` · Cama ${patient.current_bed}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="status-pill" data-tone={patient.status === "activa" ? "active" : "archived"}>
            {patient.status === "activa" ? "Activa" : "Archivada"}
          </span>
          {admission && (
            <span className="status-pill" data-tone={admission.record_status === "confirmado" ? "confirmed" : "pending"}>
              {admission.record_status === "confirmado" ? "Confirmado" : "Pendiente revisión"}
            </span>
          )}
          {auth.isMedical && (
            <Button size="sm" variant="outline" onClick={() => {
              const newLoc = prompt("Nueva ubicación (emergencia / hospitalizacion / consulta_externa):", patient.current_location);
              if (!newLoc || !["emergencia", "hospitalizacion", "consulta_externa"].includes(newLoc)) return;
              const newBed = prompt("Nueva cama (opcional):", patient.current_bed ?? "");
              updateLocation.mutate({ current_location: newLoc as "emergencia" | "hospitalizacion" | "consulta_externa", current_bed: newBed || null });
            }}>Reubicar</Button>
          )}
          {auth.isSuperuser && (
            <Button size="sm" variant="destructive" onClick={() => {
              if (confirm(`¿Eliminar definitivamente a ${patient.apellidos}, ${patient.nombres}? Se borrarán TODOS sus ingresos, evoluciones, órdenes, notas y registros. Esta acción es irreversible.`)) {
                delPatient.mutate();
              }
            }} disabled={delPatient.isPending}>
              <Trash2 className="w-4 h-4 mr-1" /> Eliminar paciente
            </Button>
          )}
        </div>
      </div>

      {/* Selector de ingresos / reingreso */}
      {admissions && admissions.length > 0 && (
        <div className="bg-card border rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ingreso</label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={selectedAdmissionId ?? ""}
              onChange={(e) => { setSelectedAdmissionId(e.target.value); setTab("frontal"); }}
            >
              {admissions.map((a, i) => (
                <option key={a.id} value={a.id}>
                  #{admissions.length - i} · {fmtDateTime(a.admission_date)}
                  {a.discharge_at ? ` — Egreso ${fmtDateTime(a.discharge_at)}` : " — Abierto"}
                  {a.impresion_diagnostica ? ` · ${a.impresion_diagnostica.slice(0, 40)}` : ""}
                </option>
              ))}
            </select>
          </div>
          {auth.isMedical && !hasOpenAdmission && (
            <Button onClick={() => {
              if (confirm("¿Iniciar un nuevo ingreso (reingreso) para esta paciente?")) createAdmission.mutate();
            }} disabled={createAdmission.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Nuevo reingreso
            </Button>
          )}
        </div>
      )}

      {(!admissions || admissions.length === 0) && auth.isMedical && (
        <div className="bg-card border border-dashed rounded-xl p-5 text-center mb-4">
          <p className="text-sm text-muted-foreground mb-3">Este paciente aún no tiene una hoja de ingreso.</p>
          <Button onClick={() => createAdmission.mutate()} disabled={createAdmission.isPending}>Iniciar hoja de ingreso</Button>
        </div>
      )}

      {admission && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-1 px-1">
            {TABS.map(t => (
              <button key={t.id} className="med-tab" data-active={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </div>
          <div>
            {tab === "frontal" && <Tab1Frontal admission={admission} patient={patient} />}
            {tab === "evoluciones" && <Tab2Evoluciones admission={admission} />}
            {tab === "ordenes" && <Tab3Ordenes admission={admission} />}
            {tab === "monitoreo" && <Tab4Monitoreo admission={admission} />}
            {tab === "interconsultas" && <Tab5Interconsultas admission={admission} />}
            {tab === "notas" && <Tab6Notas admission={admission} />}
          </div>
        </>
      )}
    </div>
  );
}
