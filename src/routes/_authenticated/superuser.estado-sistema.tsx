import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, CheckCircle2, Circle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/superuser/estado-sistema")({
  head: () => ({ meta: [{ title: "Estado del sistema — Superusuario" }] }),
  component: SystemStatus,
});

type Status = "done" | "partial" | "pending";

interface FeatureCheck {
  id: string;
  title: string;
  description: string;
  status: Status;
  notes?: string;
}

const FEATURES: FeatureCheck[] = [
  { id: "1", title: "Superusuario con control total", status: "done",
    description: "Login con usuario y clave, lista de usuarios, eliminación, cambio de clave forzado, panel propio." },
  { id: "1b", title: "Ver contraseñas en claro de usuarios", status: "pending",
    description: "Imposible por diseño: Supabase guarda hash bcrypt irreversible. Alternativa entregada: reset forzado.",
    notes: "No se implementará por riesgo legal (HIPAA/GDPR) y restricción técnica." },
  { id: "2", title: "Trazabilidad clínica visible (quién/cuándo)", status: "partial",
    description: "Estampa de autor visible en evoluciones, órdenes y notas. Falta wirearlo en monitoreo, interconsultas y labs." },
  { id: "3", title: "Chat interno con vigilancia del superusuario", status: "pending",
    description: "Tablas chat_conversations + chat_messages, realtime, check de entrega sin lectura. Fase 2." },
  { id: "4", title: "Bloqueo y publicación de historias por rangos", status: "partial",
    description: "Flujo R1 borrador → R2/R3 confirma ya funciona (record_status). Falta bloqueo concurrente con record_locks + inmutabilidad post-publicación." },
  { id: "5", title: "Links temporales alfanuméricos (15min - 48h)", status: "pending",
    description: "Tabla temporary_access_tokens + ruta pública /v/$token. Fase 2." },
  { id: "6", title: "Panel de control con checklist dinámico", status: "done",
    description: "Esta misma página." },
  { id: "7", title: "Carga, compresión y marca de agua en cliente", status: "pending",
    description: "browser-image-compression + canvas con marca diagonal abstracta. Fase 3." },
  { id: "8", title: "Almacenamiento masivo en Google Drive", status: "pending",
    description: "Connector google_drive de Lovable + tabla evidence_photos (solo guarda fileId). Fase 3." },
  { id: "9", title: "Visualización de evidencia desde Drive", status: "pending",
    description: "Server fn que streamea con auth. Fase 3." },
  { id: "audit", title: "Panel de auditoría con diff", status: "done",
    description: "Ruta /superuser/audit muestra antes/después de cada cambio en cada tabla." },
  { id: "reingreso", title: "Reingreso de paciente con historial", status: "done",
    description: "Selector de admisiones múltiples por paciente." },
];

function StatusIcon({ s }: { s: Status }) {
  if (s === "done") return <CheckCircle2 className="w-5 h-5 text-green-600" />;
  if (s === "partial") return <Clock className="w-5 h-5 text-amber-500" />;
  return <Circle className="w-5 h-5 text-muted-foreground" />;
}

function SystemStatus() {
  const auth = useAuth();

  // Conteo en vivo desde la BD
  const { data: counts } = useQuery({
    queryKey: ["system-status-counts"],
    queryFn: async () => {
      const [pacientes, admisiones, evol, ordenes, audit] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }),
        supabase.from("admissions").select("*", { count: "exact", head: true }),
        supabase.from("evolutions").select("*", { count: "exact", head: true }),
        supabase.from("medical_orders").select("*", { count: "exact", head: true }),
        supabase.from("audit_logs").select("*", { count: "exact", head: true }),
      ]);
      return {
        pacientes: pacientes.count ?? 0,
        admisiones: admisiones.count ?? 0,
        evol: evol.count ?? 0,
        ordenes: ordenes.count ?? 0,
        audit: audit.count ?? 0,
      };
    },
    enabled: !!auth.isSuperuser,
  });

  if (auth.loading) return null;
  if (!auth.isSuperuser) return <p className="text-sm text-muted-foreground">Acceso restringido.</p>;

  const done = FEATURES.filter((f) => f.status === "done").length;
  const partial = FEATURES.filter((f) => f.status === "partial").length;
  const pending = FEATURES.filter((f) => f.status === "pending").length;
  const pct = Math.round(((done + partial * 0.5) / FEATURES.length) * 100);

  return (
    <div>
      <Link to="/superuser" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver al panel
      </Link>
      <h1 className="text-xl font-semibold mb-1">Estado del sistema</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Checklist dinámico del progreso de desarrollo.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Completas" value={done} tone="green" />
        <Stat label="Parciales" value={partial} tone="amber" />
        <Stat label="Pendientes" value={pending} tone="muted" />
        <Stat label="Progreso total" value={`${pct}%`} tone="blue" />
      </div>

      {counts && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6 text-xs">
          <Mini label="Pacientes" v={counts.pacientes} />
          <Mini label="Admisiones" v={counts.admisiones} />
          <Mini label="Evoluciones" v={counts.evol} />
          <Mini label="Órdenes" v={counts.ordenes} />
          <Mini label="Eventos auditados" v={counts.audit} />
        </div>
      )}

      <div className="space-y-2">
        {FEATURES.map((f) => (
          <div key={f.id} className="bg-card border rounded-xl p-3 flex gap-3">
            <StatusIcon s={f.status} />
            <div className="flex-1">
              <p className="font-medium text-sm">{f.id}. {f.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
              {f.notes && <p className="text-[11px] text-amber-700 mt-1">{f.notes}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  const toneClass = tone === "green" ? "text-green-600" : tone === "amber" ? "text-amber-600" : tone === "blue" ? "text-primary" : "text-muted-foreground";
  return (
    <div className="bg-card border rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Mini({ label, v }: { label: string; v: number }) {
  return (
    <div className="bg-muted/40 rounded-lg p-2">
      <p className="text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground text-sm">{v}</p>
    </div>
  );
}
