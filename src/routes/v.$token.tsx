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
  const { patient, admissions, evolutions, orders, notes, monitoring, labs, interconsults, deliveryNotes, operativeNotes, meta } = data;
  const wmText = `CONFIDENCIAL · ${patient?.nombres ?? ""} ${patient?.apellidos ?? ""} · #${meta.token_short} · ${new Date().toLocaleString()}`;

  return (
    <main className="min-h-screen bg-background relative">
      {/* Marca de agua diagonal repetida */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30 select-none overflow-hidden opacity-[0.08]"
        style={{
          backgroundImage:
            `repeating-linear-gradient(-30deg, transparent 0 120px, rgba(0,0,0,0.001) 120px 121px)`,
        }}
      >
        <div className="absolute inset-0 flex flex-wrap gap-8 p-8 -rotate-[30deg] origin-center text-[10px] font-semibold tracking-widest uppercase text-foreground">
          {Array.from({ length: 120 }).map((_, i) => (
            <span key={i} className="whitespace-nowrap">{wmText}</span>
          ))}
        </div>
      </div>

      <header className="border-b bg-card sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Vista de solo lectura · Documento confidencial</p>
            <p className="text-[11px] text-muted-foreground">
              Expira: {new Date(meta.expires_at).toLocaleString()} · Accesos: {meta.access_count} · Token #{meta.token_short}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4 relative z-10">
        <section className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Datos del paciente</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Field label="Nombres" value={patient?.nombres} />
            <Field label="Apellidos" value={patient?.apellidos} />
            <Field label="Cédula" value={patient ? `${patient.cedula_type}-${patient.cedula_number}` : ""} />
            <Field label="Fecha de nacimiento" value={patient?.fecha_nacimiento} />
          </div>
        </section>

        {admissions.map((a) => {
          const evs = evolutions.filter((e) => e.admission_id === a.id);
          const ords = orders.filter((o) => o.admission_id === a.id);
          const nts = notes.filter((n) => n.admission_id === a.id);
          const mon = monitoring.filter((m) => m.admission_id === a.id);
          const lb = labs.filter((l) => l.admission_id === a.id);
          const ic = interconsults.filter((i) => i.admission_id === a.id);
          const dn = deliveryNotes.filter((d) => d.admission_id === a.id);
          const on = operativeNotes.filter((o) => o.admission_id === a.id);
          return (
            <section key={a.id} className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Admisión {new Date(a.admission_date).toLocaleDateString()}
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <Field label="Servicio" value={a.service} />
                <Field label="Diagnóstico egreso" value={a.diagnostico_egreso} />
                <Field label="Estado" value={a.discharge_at ? "Alta" : "Activa"} />
              </div>

              {evs.length > 0 && (
                <Block title={`Evoluciones (${evs.length})`}>
                  {evs.map((e) => (
                    <div key={e.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                      {e.subjetivo && <p className="whitespace-pre-wrap"><b>S:</b> {e.subjetivo}</p>}
                      {e.plan && <p className="whitespace-pre-wrap"><b>Plan:</b> {e.plan}</p>}
                      {e.diagnostico_actual && <p className="whitespace-pre-wrap"><b>Dx:</b> {e.diagnostico_actual}</p>}
                    </div>
                  ))}
                </Block>
              )}
              {ords.length > 0 && (
                <Block title={`Órdenes médicas (${ords.length})`}>
                  {ords.map((o) => (
                    <div key={o.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                      <pre className="whitespace-pre-wrap font-sans">{JSON.stringify(o.items, null, 2)}</pre>
                    </div>
                  ))}
                </Block>
              )}
              {mon.length > 0 && (
                <Block title={`Monitoreo (${mon.length})`}>
                  {mon.map((m) => (
                    <div key={m.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs grid grid-cols-2 sm:grid-cols-4 gap-1">
                      <span className="text-muted-foreground col-span-2 sm:col-span-4">{new Date(m.recorded_at).toLocaleString()}</span>
                      {m.ta && <span>TA {m.ta}</span>}
                      {m.fc != null && <span>FC {m.fc}</span>}
                      {m.fr != null && <span>FR {m.fr}</span>}
                      {m.tam != null && <span>TAM {m.tam}</span>}
                      {m.sato2 != null && <span>SatO₂ {m.sato2}%</span>}
                      {m.fcf != null && <span>FCF {m.fcf}</span>}
                      {m.du && <span>DU {m.du}</span>}
                      {m.mf && <span>MF {m.mf}</span>}
                    </div>
                  ))}
                </Block>
              )}
              {lb.length > 0 && (
                <Block title={`Laboratorios (${lb.length})`}>
                  {lb.map((l) => (
                    <div key={l.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(l.sampled_at).toLocaleString()} · {l.parametro}</p>
                      <p><b>{l.valor}</b> {l.unidad ?? ""}</p>
                    </div>
                  ))}
                </Block>
              )}

              {ic.length > 0 && (
                <Block title={`Interconsultas (${ic.length})`}>
                  {ic.map((i) => (
                    <div key={i.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(i.created_at).toLocaleString()} → {i.target_service}</p>
                      {i.comentario && <p className="whitespace-pre-wrap"><b>Solicita:</b> {i.comentario}</p>}
                      {i.respuesta && <p className="whitespace-pre-wrap"><b>Respuesta:</b> {i.respuesta}</p>}
                    </div>
                  ))}
                </Block>
              )}
              {dn.length > 0 && (
                <Block title={`Notas de parto (${dn.length})`}>
                  {dn.map((d) => (
                    <div key={d.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(d.created_at).toLocaleString()}</p>
                      <pre className="whitespace-pre-wrap font-sans">{JSON.stringify(d, null, 2)}</pre>
                    </div>
                  ))}
                </Block>
              )}
              {on.length > 0 && (
                <Block title={`Notas operatorias (${on.length})`}>
                  {on.map((o) => (
                    <div key={o.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                      <pre className="whitespace-pre-wrap font-sans">{JSON.stringify(o, null, 2)}</pre>
                    </div>
                  ))}
                </Block>
              )}
              {nts.length > 0 && (
                <Block title={`Notas clínicas (${nts.length})`}>
                  {nts.map((n) => (
                    <div key={n.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{new Date(n.created_at).toLocaleString()} · {n.tipo}</p>
                      <p className="whitespace-pre-wrap">{n.contenido}</p>
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
