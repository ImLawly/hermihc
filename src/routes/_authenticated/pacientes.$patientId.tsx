import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { calcAge, LOCATION_LABELS, fmtDateTime } from "@/lib/medical";
import { ArrowLeft, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { sendPush } from "@/lib/push.functions";

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
  const [tab, setTab] = useState<TabId>("frontal");

  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("patients").select("*").eq("id", patientId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: admission } = useQuery({
    queryKey: ["admission", patientId],
    queryFn: async () => {
      const { data, error } = await supabase.from("admissions").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const createAdmission = useMutation({
    mutationFn: async () => {
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admission", patientId] }); toast.success("Ingreso iniciado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLocation = useMutation({
    mutationFn: async (vals: { current_location: "emergencia" | "hospitalizacion" | "consulta_externa"; current_bed: string | null }) => {
      const { error } = await supabase.from("patients").update(vals).eq("id", patientId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["patient", patientId] }); toast.success("Ubicación actualizada — notificación enviada a Traslado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!patient) return <p className="text-sm text-muted-foreground">Cargando…</p>;

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
        </div>
      </div>

      {!admission && auth.isMedical && (
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
