import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { viewTempLink } from "@/lib/tempLinks.functions";
import { ShieldCheck, AlertTriangle, FileText } from "lucide-react";

export const Route = createFileRoute("/v/$token")({
  head: () => ({ meta: [{ title: "Vista temporal — Historia clínica" }] }),
  component: TempView,
});

function TempView() {
  const { token } = Route.useParams();
  const fn = useServerFn(viewTempLink);
  const { data, error, isLoading } = useQuery({
    queryKey: ["temp-view", token],
    queryFn: () => fn({ data: { token } }),
    retry: false,
  });

  if (isLoading) return <p className="p-8 text-center text-sm text-muted-foreground">Cargando…</p>;
  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center bg-card border rounded-2xl p-8">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
          <h1 className="text-lg font-semibold">Acceso no disponible</h1>
          <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
        </div>
      </main>
    );
  }
  if (!data) return null;
  const { patient, admissions, evolutions, orders, notes, meta } = data;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Vista de solo lectura</p>
            <p className="text-[11px] text-muted-foreground">
              Expira: {new Date(meta.expires_at).toLocaleString()} · Accesos: {meta.access_count}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <section className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Datos del paciente</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Field label="Nombres" value={patient?.nombres} />
            <Field label="Apellidos" value={patient?.apellidos} />
            <Field label="Cédula" value={patient?.cedula} />
            <Field label="Fecha de nacimiento" value={patient?.fecha_nacimiento} />
            <Field label="Sexo" value={patient?.sexo} />
            <Field label="Tipo de sangre" value={patient?.tipo_sangre} />
          </div>
        </section>

        {admissions.map((a) => {
          const evs = evolutions.filter((e) => e.admission_id === a.id);
          const ords = orders.filter((o) => o.admission_id === a.id);
          const nts = notes.filter((n) => n.admission_id === a.id);
          return (
            <section key={a.id} className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Admisión {new Date(a.admission_date).toLocaleDateString()}
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <Field label="Servicio" value={a.service} />
                <Field label="Diagnóstico" value={a.diagnostico_ingreso} />
                <Field label="Motivo de consulta" value={a.motivo_consulta} />
                <Field label="Estado" value={a.discharged_at ? "Alta" : "Activa"} />
              </div>

              {evs.length > 0 && (
                <Block title={`Evoluciones (${evs.length})`}>
                  {evs.map((e) => (
                    <div key={e.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                      <p className="whitespace-pre-wrap">{e.descripcion || e.subjetivo || ""}</p>
                    </div>
                  ))}
                </Block>
              )}
              {ords.length > 0 && (
                <Block title={`Órdenes (${ords.length})`}>
                  {ords.map((o) => (
                    <div key={o.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                      <p className="whitespace-pre-wrap">{o.descripcion || o.medicamento || ""}</p>
                    </div>
                  ))}
                </Block>
              )}
              {nts.length > 0 && (
                <Block title={`Notas (${nts.length})`}>
                  {nts.map((n) => (
                    <div key={n.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                      <p className="whitespace-pre-wrap">{n.contenido || ""}</p>
                    </div>
                  ))}
                </Block>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value ? String(value) : "—"}</p>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold mb-1">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
