import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtDateTime, toLocalInputValue } from "@/lib/medical";
import { toast } from "sonner";
import { Plus, CheckCircle2, Check, X } from "lucide-react";

interface OrderItem { n: number; text: string; medication?: string; dose?: string; route?: string; times?: string[]; }

export function Tab3Ordenes({ admission }: { admission: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ["orders", admission.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("medical_orders").select("*").eq("admission_id", admission.id).order("order_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {auth.isMedical && <Button size="sm" onClick={() => setShowNew(v => !v)}><Plus className="w-3.5 h-3.5 mr-1" /> Nuevas órdenes</Button>}
      </div>

      {showNew && auth.isMedical && (
        <NewOrdersForm admissionId={admission.id} onSaved={() => { setShowNew(false); qc.invalidateQueries({ queryKey: ["orders", admission.id] }); }} />
      )}

      {(orders ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin órdenes médicas.</p>}

      {orders?.map(o => <OrderBlock key={o.id} order={o} />)}
    </div>
  );
}

function NewOrdersForm({ admissionId, onSaved }: { admissionId: string; onSaved: () => void }) {
  const auth = useAuth();
  const [order_at, setAt] = useState(toLocalInputValue());
  const [items, setItems] = useState<OrderItem[]>([{ n: 1, text: "" }]);

  const addItem = () => setItems([...items, { n: items.length + 1, text: "" }]);
  const updateItem = (i: number, patch: Partial<OrderItem>) => setItems(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, n: idx + 1 })));

  const save = useMutation({
    mutationFn: async () => {
      const finalItems = [...items.filter(i => i.text.trim()), { n: items.length + 1, text: "Control de signos vitales y avisar eventualidad" }];
      const { data: order, error } = await supabase.from("medical_orders").insert({
        admission_id: admissionId,
        order_at: new Date(order_at).toISOString(),
        items: finalItems,
        created_by: auth.user!.id,
      } as any).select("id").single();
      if (error) throw error;

      // Generar programaciones para items con horarios
      const admins: any[] = [];
      const baseDate = new Date(order_at);
      finalItems.forEach((it, idx) => {
        (it.times ?? []).forEach(t => {
          const [hh, mm] = t.split(":").map(Number);
          if (isNaN(hh)) return;
          const sched = new Date(baseDate); sched.setHours(hh, mm || 0, 0, 0);
          if (sched < baseDate) sched.setDate(sched.getDate() + 1);
          admins.push({ order_id: order!.id, item_index: idx, scheduled_at: sched.toISOString() });
        });
      });
      if (admins.length) {
        const { error: e2 } = await supabase.from("order_administrations").insert(admins as any);
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success("Órdenes guardadas"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form className="bg-card border rounded-xl p-4 space-y-3" onSubmit={e => { e.preventDefault(); save.mutate(); }}>
      <div className="text-center font-semibold text-sm">ÓRDENES MÉDICAS</div>
      <div><Label className="text-xs">Fecha y hora</Label><Input type="datetime-local" value={order_at} onChange={e => setAt(e.target.value)} /></div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="font-semibold w-5 text-xs mt-2">{it.n}.</span>
              <Textarea rows={2} className="flex-1" value={it.text} onChange={e => updateItem(i, { text: e.target.value })} placeholder="Indicación (ej. Azitromicina 500mg VO c/24h)" />
              <button type="button" onClick={() => removeItem(i)} className="text-muted-foreground hover:text-destructive p-1"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-7">
              <Input placeholder="Medicamento" value={it.medication ?? ""} onChange={e => updateItem(i, { medication: e.target.value })} />
              <Input placeholder="Dosis" value={it.dose ?? ""} onChange={e => updateItem(i, { dose: e.target.value })} />
              <Input placeholder="Vía" value={it.route ?? ""} onChange={e => updateItem(i, { route: e.target.value })} />
              <Input placeholder="Horarios 08:00,14:00,20:00" value={(it.times ?? []).join(",")} onChange={e => updateItem(i, { times: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Añadir indicación</Button>
      </div>
      <p className="text-xs text-muted-foreground italic">Se añade automáticamente: "Control de signos vitales y avisar eventualidad".</p>
      <div className="flex justify-end"><Button type="submit" disabled={save.isPending}>Guardar órdenes</Button></div>
    </form>
  );
}

function OrderBlock({ order }: { order: any }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const { data: admins } = useQuery({
    queryKey: ["administrations", order.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("order_administrations").select("*").eq("order_id", order.id).order("scheduled_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const checkAdmin = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("order_administrations").update({
        administered_at: new Date().toISOString(), administered_by: auth.user!.id,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["administrations", order.id] }),
  });

  const review = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("medical_orders").update({
        record_status: "confirmado", reviewed_by: auth.user!.id, reviewed_at: new Date().toISOString(),
      } as any).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders", order.admission_id] }),
  });

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">{fmtDateTime(order.order_at)}</p>
        <span className="status-pill" data-tone={order.record_status === "confirmado" ? "confirmed" : "pending"}>
          {order.record_status === "confirmado" ? "Confirmado" : "Pendiente"}
        </span>
      </div>
      <ol className="space-y-2 text-sm">
        {(order.items as OrderItem[]).map((it, idx) => {
          const itemAdmins = (admins ?? []).filter(a => a.item_index === idx);
          return (
            <li key={idx} className="flex gap-2">
              <span className="font-semibold w-5">{it.n}.</span>
              <div className="flex-1">
                <p>{it.text}</p>
                {itemAdmins.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {itemAdmins.map(a => (
                      <button key={a.id} disabled={!!a.administered_at || !(auth.isNurse || auth.isMedical)}
                        onClick={() => checkAdmin.mutate(a.id)}
                        className="text-[11px] inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                        style={{ background: a.administered_at ? "oklch(0.93 0.10 150)" : "oklch(0.95 0.04 240)" }}>
                        {a.administered_at ? <Check className="w-3 h-3" /> : null}
                        {new Date(a.scheduled_at).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" })}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {auth.canReview && order.record_status === "pendiente_revision" && (
        <div className="mt-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => review.mutate()}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar
          </Button>
        </div>
      )}
    </div>
  );
}
