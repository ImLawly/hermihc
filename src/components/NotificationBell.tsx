import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fmtDateTime } from "@/lib/medical";

interface NotifRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}

export function NotificationBell() {
  const auth = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return (data ?? []) as NotifRow[];
    },
    enabled: !!auth.user,
    refetchInterval: 60_000,
  });

  // Realtime
  useEffect(() => {
    if (!auth.user) return;
    const channel = supabase
      .channel("notifications-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [auth.user, qc]);

  const unread = useMemo(() => notifs.filter((n) => !n.read_at).length, [notifs]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  const handleClick = async (n: NotifRow) => {
    setOpen(false);
    if (!n.read_at) await markRead(n.id);
    const p = n.payload || {};
    if (n.kind === "transfer") {
      nav({ to: "/traslados" });
    } else if (typeof p.admission_id === "string" && typeof p.patient_id !== "undefined") {
      // Fall through
    }
    if (typeof p.patient_id === "string") {
      nav({ to: "/pacientes/$patientId", params: { patientId: p.patient_id as string } });
    } else if (typeof p.admission_id === "string") {
      // Need patient id; fetch
      const { data } = await supabase
        .from("admissions")
        .select("patient_id")
        .eq("id", p.admission_id as string)
        .maybeSingle();
      if (data?.patient_id) {
        nav({ to: "/pacientes/$patientId", params: { patientId: data.patient_id as string } });
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-accent"
        aria-label="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 text-[9px] font-semibold leading-none rounded-full bg-[oklch(0.62_0.20_25)] text-white px-1.5 py-0.5 min-w-[16px] text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-[320px] max-h-[420px] overflow-auto z-50 bg-card border rounded-xl shadow-lg">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <span className="text-xs font-semibold">Notificaciones</span>
              {unread > 0 && (
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    const ids = notifs.filter((n) => !n.read_at).map((n) => n.id);
                    if (ids.length) {
                      await supabase
                        .from("notifications")
                        .update({ read_at: new Date().toISOString() })
                        .in("id", ids);
                      qc.invalidateQueries({ queryKey: ["notifications"] });
                    }
                  }}
                >
                  Marcar todas
                </button>
              )}
            </div>
            {notifs.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">Sin notificaciones</p>
            ) : (
              <ul className="divide-y">
                {notifs.map((n) => (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`w-full text-left px-3 py-2 hover:bg-accent transition ${
                        !n.read_at ? "bg-[oklch(0.97_0.04_240)]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.read_at && (
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[oklch(0.55_0.18_240)] shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold truncate">{n.title}</p>
                          {n.body && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {fmtDateTime(n.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
