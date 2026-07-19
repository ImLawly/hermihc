import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, SERVICE_LABELS, type ServiceType } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime } from "@/lib/medical";
import { toast } from "sonner";
import { Plus, Send } from "lucide-react";
import { sendPush } from "@/lib/push.functions";
import { AuthorStamp } from "@/components/AuthorStamp";

export function Tab5Interconsultas({ admission }: { admission: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["interconsults", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("interconsultations").select("*").eq("admission_id", admission.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {auth.isMedical && <Button size="sm" onClick={() => setShowNew(v => !v)}><Plus className="w-3.5 h-3.5 mr-1" /> Nueva interconsulta</Button>}
      </div>
      {showNew && auth.isMedical && (
        <NewInterconsult admission={admission} onSaved={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["interconsults", admission.id] }); }} />
      )}
      {(items ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin interconsultas.</p>}
      {items?.map(it => <InterCard key={it.id} item={it} />)}
    </div>
  );
}

function NewInterconsult({ admission, onSaved }: { admission: any; onSaved: () => void }) {
  const auth = useAuth();
  const push = useServerFn(sendPush);
  const services: ServiceType[] = ["pediatria", "cirugia_general", "cirugia_pediatrica", "traumatologia", "anestesiologia", "obstetricia"];
  const [target_service, setTarget] = useState<ServiceType>(services.find(s => s !== admission.service) ?? "pediatria");
  const [diagnosticos, setDx] = useState("");
  const [comentario, setComent] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("interconsultations").insert({
        admission_id: admission.id, target_service, diagnosticos, comentario, created_by: auth.user!.id,
      } as any).select("id").single();
      if (error) throw error;
      // In-app notification is created by DB trigger. Send push tickle too:
      try {
        await push({
          data: {
            role: "especialista", service: target_service,
            title: `Interconsulta a ${SERVICE_LABELS[target_service]}`,
            body: comentario.slice(0, 120),
            url: `/pacientes/${admission.patient_id}`,
          }
        });
      } catch { /* push failures are non-fatal */ }
    },
    onSuccess: () => { toast.success("Interconsulta enviada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form className="bg-card border rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div>
        <Label className="text-xs">Servicio interconsultado</Label>
        <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          value={target_service} onChange={e => setTarget(e.target.value as ServiceType)}>
          {services.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
        </select>
      </div>
      <div><Label className="text-xs">Diagnósticos actuales</Label><Textarea rows={2} value={diagnosticos} onChange={e => setDx(e.target.value)} /></div>
      <div><Label className="text-xs">Motivo / Comentario</Label><Textarea rows={4} value={comentario} onChange={e => setComent(e.target.value)} required /></div>
      <div className="flex justify-end"><Button type="submit" disabled={save.isPending}><Send className="w-3.5 h-3.5 mr-1" /> Enviar interconsulta</Button></div>
    </form>
  );
}

function InterCard({ item }: { item: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const push = useServerFn(sendPush);
  const [respuesta, setResp] = useState(item.respuesta ?? "");
  const isTarget = auth.services.includes(item.target_service);

  const respond = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("interconsultations").update({
        respuesta, responded_by: auth.user!.id, responded_at: new Date().toISOString(),
      } as any).eq("id", item.id);
      if (error) throw error;
      try {
        await push({
          data: {
            user_id: item.created_by,
            title: "Interconsulta respondida",
            body: respuesta.slice(0, 120),
            url: `/pacientes/${item.admission_id}`,
          }
        });
      } catch { /* non-fatal */ }
    },
    onSuccess: () => { toast.success("Respuesta enviada"); qc.invalidateQueries({ queryKey: ["interconsults", item.admission_id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const discharge = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("interconsultations").update({
        discharged_at: new Date().toISOString(), discharged_by: auth.user!.id,
      } as any).eq("id", item.id).select("id").single();
      if (error) throw error;
      if (!data) throw new Error("No se pudo dar de alta. Verifica tus permisos.");
    },
    onSuccess: () => {
      toast.success("Alta por su servicio registrada");
      qc.invalidateQueries({ queryKey: ["interconsults", item.admission_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex justify-between flex-wrap gap-2 mb-2">
        <p className="text-xs text-muted-foreground">{fmtDateTime(item.created_at)} → <strong>{SERVICE_LABELS[item.target_service as ServiceType]}</strong></p>
        <AuthorStamp userId={item.created_by} date={item.created_at} label="Creado por" />
        {item.discharged_at
          ? <span className="status-pill" data-tone="pending">Alta por servicio</span>
          : item.responded_at && <span className="status-pill" data-tone="confirmed">Respondida</span>}
      </div>
      {item.diagnosticos && <p className="text-sm"><strong className="text-xs uppercase text-muted-foreground">Dx:</strong> {item.diagnosticos}</p>}
      <p className="text-sm mt-1">{item.comentario}</p>
      {item.respuesta ? (
        <div className="mt-3 border-t pt-2">
          <p className="text-xs text-muted-foreground">Respuesta · {fmtDateTime(item.responded_at)}</p>
          <p className="text-sm">{item.respuesta}</p>
          <AuthorStamp userId={item.responded_by} date={item.responded_at} label="Respondida por" />
          {item.discharged_at ? (
            <p className="text-xs text-muted-foreground mt-2">
              Dada de alta por su servicio · {fmtDateTime(item.discharged_at)}
              <AuthorStamp userId={item.discharged_by} date={item.discharged_at} label="Alta por" />
            </p>
          ) : isTarget && auth.isMedical && (
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="outline" onClick={() => discharge.mutate()} disabled={discharge.isPending}>
                Dar de alta por mi servicio
              </Button>
            </div>
          )}
        </div>
      ) : isTarget && auth.isMedical && (
        <div className="mt-3 border-t pt-2 space-y-2">
          <Label className="text-xs">Respuesta</Label>
          <Textarea rows={3} value={respuesta} onChange={e => setResp(e.target.value)} />
          <div className="flex justify-end"><Button size="sm" onClick={() => respond.mutate()} disabled={respond.isPending || !respuesta.trim()}>Enviar respuesta</Button></div>
        </div>
      )}
    </div>
  );
}
