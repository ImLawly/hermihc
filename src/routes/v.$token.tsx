import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { viewTempLink } from "@/lib/tempLinks.functions";
import { ShieldCheck, AlertTriangle, FileText } from "lucide-react";

export const Route = createFileRoute("/v/$token")({
  head: () => ({ meta: [{ title: "Vista temporal — Historia clínica" }] }),
  component: TempView,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md text-center bg-card border rounded-2xl p-8">
        <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
        <h1 className="text-lg font-semibold">Acceso no disponible</h1>
        <p className="text-sm text-muted-foreground mt-2">{(error as Error).message}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <p className="text-sm text-muted-foreground">Enlace no encontrado.</p>
    </main>
  ),
});

const LOC: Record<string, string> = {
  consulta_externa: "Consulta externa",
  emergencia: "Emergencia",
  hospitalizacion: "Hospitalización",
};
const SVC: Record<string, string> = {
  obstetricia: "Obstetricia",
  pediatria: "Pediatría",
  cirugia_general: "Cirugía general",
  cirugia_pediatrica: "Cirugía pediátrica",
  traumatologia: "Traumatología",
  anestesiologia: "Anestesiología",
};
const DISCH: Record<string, string> = {
  alta_medica: "Alta médica",
  contraopinion: "Contra opinión",
};

const fmtDT = (v?: string | null) => (v ? new Date(v).toLocaleString() : "—");
const fmtD = (v?: string | null) => (v ? new Date(v).toLocaleDateString() : "—");

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
  const { patient, admissions, evolutions, orders, notes, monitoring, labs, interconsults, deliveryNotes, operativeNotes, meta } = data as any;
  const wmText = `CONFIDENCIAL · ${patient?.nombres ?? ""} ${patient?.apellidos ?? ""} · #${meta.token_short} · ${new Date().toLocaleString()}`;

  return (
    <main className="min-h-screen bg-background relative">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30 select-none overflow-hidden opacity-[0.08]"
        style={{ backgroundImage: `repeating-linear-gradient(-30deg, transparent 0 120px, rgba(0,0,0,0.001) 120px 121px)` }}
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
              Expira: {fmtDT(meta.expires_at)} · Accesos: {meta.access_count} · Token #{meta.token_short}
              {meta.note ? ` · ${meta.note}` : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4 relative z-10">
        {/* PACIENTE */}
        <section className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Datos del paciente</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <Field label="Nombres" value={patient?.nombres} />
            <Field label="Apellidos" value={patient?.apellidos} />
            <Field label="Cédula" value={patient ? `${patient.cedula_type}-${patient.cedula_number}` : ""} />
            <Field label="Fecha de nacimiento" value={fmtD(patient?.fecha_nacimiento)} />
            <Field label="Teléfono" value={patient?.telefono} />
            <Field label="Dirección" value={patient?.direccion} />
            <Field label="Servicio asignado" value={SVC[patient?.service] ?? patient?.service} />
            <Field label="Ubicación actual" value={LOC[patient?.current_location] ?? patient?.current_location} />
            <Field label="Cama actual" value={patient?.current_bed} />
            <Field label="Estado" value={patient?.status} />
            <Field label="Registrado" value={fmtDT(patient?.created_at)} />
          </div>
        </section>

        {admissions.map((a: any) => {
          const evs = evolutions.filter((e: any) => e.admission_id === a.id);
          const ords = orders.filter((o: any) => o.admission_id === a.id);
          const nts = notes.filter((n: any) => n.admission_id === a.id);
          const mon = monitoring.filter((m: any) => m.admission_id === a.id);
          const lb = labs.filter((l: any) => l.admission_id === a.id);
          const ic = interconsults.filter((i: any) => i.admission_id === a.id);
          const dn = deliveryNotes.filter((d: any) => d.admission_id === a.id);
          const on = operativeNotes.filter((o: any) => o.admission_id === a.id);
          return (
            <section key={a.id} className="bg-card border rounded-xl p-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4" /> Admisión {fmtD(a.admission_date)}
              </h3>

              {/* HOJA FRONTAL */}
              <Block title="Hoja frontal / Admisión">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <Field label="Fecha de ingreso" value={fmtDT(a.admission_date)} />
                  <Field label="Servicio" value={SVC[a.service] ?? a.service} />
                  <Field label="Ubicación" value={LOC[a.location] ?? a.location} />
                  <Field label="Cama" value={a.bed} />
                  <Field label="Estado" value={a.status} />
                  <Field label="Estado del registro" value={a.record_status} />
                  <Field label="Egreso" value={a.discharge_at ? fmtDT(a.discharge_at) : "—"} />
                  <Field label="Tipo de egreso" value={a.discharge_type ? (DISCH[a.discharge_type] ?? a.discharge_type) : "—"} />
                  <Field label="Revisado" value={a.reviewed_at ? fmtDT(a.reviewed_at) : "—"} />
                </div>
                <LongField label="Motivo de consulta" value={a.motivo_consulta} />
                <LongField label="Historia de enfermedad actual" value={a.historia_enfermedad_actual} />
                <LongField label="Antecedentes personales" value={a.antecedentes_personales} />
                <LongField label="Antecedentes familiares" value={a.antecedentes_familiares} />
                <LongField label="Antecedentes quirúrgicos" value={a.antecedentes_quirurgicos} />
                <LongField label="Hábitos psicobiológicos" value={a.habitos_psicobiologicos} />
                <JsonField label="Antecedentes ginecoobstétricos" value={a.antecedentes_ginecobstetricos} />
                <JsonField label="Examen físico" value={a.examen_fisico} />
                <LongField label="Laboratorios de ingreso" value={a.labs_ingreso} />
                <LongField label="Impresión diagnóstica" value={a.impresion_diagnostica} />
                <LongField label="Comentario de ingreso" value={a.comentario_ingreso} />
                <LongField label="Diagnóstico de egreso" value={a.diagnostico_egreso} />
              </Block>

              {/* EVOLUCIONES */}
              {evs.length > 0 && (
                <Block title={`Evoluciones (${evs.length})`}>
                  {evs.map((e: any) => (
                    <div key={e.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs space-y-1">
                      <p className="text-muted-foreground">{fmtDT(e.evolution_at)} · Estado: {e.record_status}{e.reviewed_at ? ` · Revisado ${fmtDT(e.reviewed_at)}` : ""}</p>
                      {e.subjetivo && <p className="whitespace-pre-wrap"><b>Subjetivo:</b> {e.subjetivo}</p>}
                      <JsonField label="Objetivo" value={e.objetivo} inline />
                      {e.diagnostico_actual && <p className="whitespace-pre-wrap"><b>Diagnóstico actual:</b> {e.diagnostico_actual}</p>}
                      {e.plan && <p className="whitespace-pre-wrap"><b>Plan:</b> {e.plan}</p>}
                    </div>
                  ))}
                </Block>
              )}

              {/* ÓRDENES */}
              {ords.length > 0 && (
                <Block title={`Órdenes médicas (${ords.length})`}>
                  {ords.map((o: any) => (
                    <div key={o.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs space-y-1">
                      <p className="text-muted-foreground">{fmtDT(o.order_at)} · Estado: {o.record_status}{o.reviewed_at ? ` · Revisado ${fmtDT(o.reviewed_at)}` : ""}</p>
                      <OrderItems items={o.items} />
                    </div>
                  ))}
                </Block>
              )}

              {/* MONITOREO */}
              {mon.length > 0 && (
                <Block title={`Monitoreo (${mon.length})`}>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="text-muted-foreground">
                        <tr className="text-left">
                          <th className="py-1 pr-2">Fecha/hora</th>
                          <th className="pr-2">TA</th><th className="pr-2">FC</th><th className="pr-2">FR</th>
                          <th className="pr-2">TAM</th><th className="pr-2">SatO₂</th>
                          <th className="pr-2">FCF</th><th className="pr-2">DU</th><th>MF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mon.map((m: any) => (
                          <tr key={m.id} className="border-t">
                            <td className="py-1 pr-2 whitespace-nowrap">{fmtDT(m.recorded_at)}</td>
                            <td className="pr-2">{m.ta ?? "—"}</td>
                            <td className="pr-2">{m.fc ?? "—"}</td>
                            <td className="pr-2">{m.fr ?? "—"}</td>
                            <td className="pr-2">{m.tam ?? "—"}</td>
                            <td className="pr-2">{m.sato2 ?? "—"}</td>
                            <td className="pr-2">{m.fcf ?? "—"}</td>
                            <td className="pr-2">{m.du ?? "—"}</td>
                            <td>{m.mf ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Block>
              )}

              {/* LABORATORIOS */}
              {lb.length > 0 && (
                <Block title={`Laboratorios (${lb.length})`}>
                  <div className="overflow-x-auto">
                    <table className="text-xs w-full">
                      <thead className="text-muted-foreground">
                        <tr className="text-left"><th className="py-1 pr-2">Fecha</th><th className="pr-2">Parámetro</th><th className="pr-2">Valor</th><th>Unidad</th></tr>
                      </thead>
                      <tbody>
                        {lb.map((l: any) => (
                          <tr key={l.id} className="border-t">
                            <td className="py-1 pr-2 whitespace-nowrap">{fmtDT(l.sampled_at)}</td>
                            <td className="pr-2">{l.parametro}</td>
                            <td className="pr-2"><b>{l.valor}</b></td>
                            <td>{l.unidad ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Block>
              )}

              {/* INTERCONSULTAS */}
              {ic.length > 0 && (
                <Block title={`Interconsultas (${ic.length})`}>
                  {ic.map((i: any) => (
                    <div key={i.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs space-y-1">
                      <p className="text-muted-foreground">{fmtDT(i.created_at)} → {SVC[i.target_service] ?? i.target_service}</p>
                      {i.diagnosticos && <p className="whitespace-pre-wrap"><b>Diagnósticos:</b> {i.diagnosticos}</p>}
                      {i.comentario && <p className="whitespace-pre-wrap"><b>Solicita:</b> {i.comentario}</p>}
                      {i.respuesta && (
                        <div className="mt-1 border-t pt-1">
                          <p className="text-muted-foreground">Respondida {fmtDT(i.responded_at)}</p>
                          <p className="whitespace-pre-wrap"><b>Respuesta:</b> {i.respuesta}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </Block>
              )}

              {/* NOTAS DE PARTO */}
              {dn.length > 0 && (
                <Block title={`Notas de parto (${dn.length})`}>
                  {dn.map((d: any) => (
                    <div key={d.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs space-y-1">
                      <p className="text-muted-foreground">Registrada {fmtDT(d.created_at)} · Expulsión {fmtDT(d.expulsion_at)}</p>
                      {d.diagnostico_egreso_mesa && <p className="whitespace-pre-wrap"><b>Dx egreso de mesa:</b> {d.diagnostico_egreso_mesa}</p>}
                      {d.descripcion && <p className="whitespace-pre-wrap"><b>Descripción:</b> {d.descripcion}</p>}
                    </div>
                  ))}
                </Block>
              )}

              {/* NOTAS OPERATORIAS */}
              {on.length > 0 && (
                <Block title={`Notas operatorias (${on.length})`}>
                  {on.map((o: any) => (
                    <div key={o.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs space-y-1">
                      <p className="text-muted-foreground">Cirugía {fmtDT(o.surgery_at)} · Registrada {fmtDT(o.created_at)}</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                        <Field label="Cirujano" value={o.cirujano} />
                        <Field label="1er ayudante" value={o.primer_ayudante} />
                        <Field label="2do ayudante" value={o.segundo_ayudante} />
                        <Field label="3er ayudante" value={o.tercer_ayudante} />
                        <Field label="Instrumentista" value={o.instrumentista} />
                        <Field label="Circulante" value={o.circulante} />
                        <Field label="Anestesiólogo" value={o.anestesiologo} />
                        <Field label="Monitor cirujano" value={o.monitor_cirujano} />
                        <Field label="Monitor anestesiólogo" value={o.monitor_anestesiologo} />
                        <Field label="RN peso (g)" value={o.rn_peso} />
                        <Field label="RN talla (cm)" value={o.rn_talla} />
                      </div>
                      {o.diagnosticos_preoperatorios && <p className="whitespace-pre-wrap"><b>Dx preoperatorios:</b> {o.diagnosticos_preoperatorios}</p>}
                      {o.diagnostico_postoperatorio && <p className="whitespace-pre-wrap"><b>Dx postoperatorio:</b> {o.diagnostico_postoperatorio}</p>}
                      {o.hallazgos && <p className="whitespace-pre-wrap"><b>Hallazgos:</b> {o.hallazgos}</p>}
                      {o.descripcion && <p className="whitespace-pre-wrap"><b>Descripción:</b> {o.descripcion}</p>}
                    </div>
                  ))}
                </Block>
              )}

              {/* NOTAS CLÍNICAS */}
              {nts.length > 0 && (
                <Block title={`Notas clínicas (${nts.length})`}>
                  {nts.map((n: any) => (
                    <div key={n.id} className="border-l-2 border-primary/30 pl-2 py-1 text-xs">
                      <p className="text-muted-foreground">{fmtDT(n.note_at)} · {n.tipo}</p>
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
  const v = value === null || value === undefined || value === "" ? "—" : String(value);
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{v}</p>
    </div>
  );
}

function LongField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="mt-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function JsonField({ label, value, inline }: { label: string; value: any; inline?: boolean }) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && Object.keys(value).length === 0) return null;
  const entries = typeof value === "object" && !Array.isArray(value) ? Object.entries(value) : null;
  return (
    <div className={inline ? "" : "mt-2"}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      {entries ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs">
          {entries.map(([k, v]) => (
            <div key={k}>
              <span className="text-muted-foreground">{k}: </span>
              <span className="font-medium">{v === null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
        </div>
      ) : (
        <pre className="text-xs whitespace-pre-wrap font-sans">{JSON.stringify(value, null, 2)}</pre>
      )}
    </div>
  );
}

function OrderItems({ items }: { items: any }) {
  if (!items) return <p className="text-muted-foreground">—</p>;
  const arr = Array.isArray(items) ? items : [items];
  return (
    <ol className="list-decimal ml-4 space-y-1">
      {arr.map((it: any, i: number) => (
        <li key={i}>
          {typeof it === "string" ? it : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2">
              {Object.entries(it).map(([k, v]) => (
                <div key={k}>
                  <span className="text-muted-foreground">{k}: </span>
                  <span className="font-medium">{v === null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
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
