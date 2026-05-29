import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDateTime } from "@/lib/medical";
import { Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/traslados")({
  head: () => ({ meta: [{ title: "Traslados — Notificaciones" }] }),
  component: TrasladosPage,
});

function TrasladosPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const { data: notes } = useQuery({
    queryKey: ["notifications", "transfer"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*")
        .eq("kind", "transfer").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read_at: new Date().toISOString() } as any).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", "transfer"] }),
  });

  return (
    <div>
      <h1 className="text-xl font-semibold mb-1 flex items-center gap-2"><Bell className="w-5 h-5" /> Alertas de traslado</h1>
      <p className="text-sm text-muted-foreground mb-4">Reubicaciones de pacientes en tiempo real.</p>

      {(notes ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin alertas pendientes.</p>}

      <div className="space-y-2">
        {notes?.map(n => {
          const p = n.payload as any;
          return (
            <div key={n.id} className="bg-card border rounded-xl p-4 flex items-start justify-between gap-3 flex-wrap"
              style={{ borderLeft: n.read_at ? undefined : "4px solid var(--color-primary)" }}>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(n.created_at)}</p>
                <p className="text-sm mt-1 flex items-center gap-1 flex-wrap">
                  <MapPin className="w-3 h-3 text-primary" />
                  {p?.from} → <strong>{p?.to}</strong> {p?.bed && <span>· Cama {p.bed}</span>}
                </p>
                <p className="text-sm">{n.body}</p>
              </div>
              {!n.read_at && (
                <Button size="sm" variant="outline" onClick={() => markRead.mutate(n.id)}>Marcar leída</Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
