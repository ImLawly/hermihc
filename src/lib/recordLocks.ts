import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type RecordType = "evolution" | "medical_order" | "clinical_note";

/**
 * Suscribe a un lock sobre un registro. Devuelve el lock activo (si existe)
 * y un nombre legible del usuario que lo posee.
 * - Útil para mostrar "En revisión por Dr. X — solo lectura" al autor R1.
 */
export function useRecordLock(recordType: RecordType, recordId: string | null | undefined) {
  const enabled = !!recordId;

  const { data: lock, refetch } = useQuery({
    queryKey: ["record-lock", recordType, recordId],
    enabled,
    refetchInterval: 8000,
    queryFn: async () => {
      // limpieza oportunista de expirados
      await supabase.rpc("cleanup_expired_locks");
      const { data } = await supabase
        .from("record_locks")
        .select("id, locked_by, locked_at, expires_at")
        .eq("record_type", recordType)
        .eq("record_id", recordId!)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: holder } = useQuery({
    queryKey: ["lock-holder", lock?.locked_by],
    enabled: !!lock?.locked_by,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles").select("full_name").eq("id", lock!.locked_by).maybeSingle();
      return data?.full_name ?? null;
    },
  });

  return { lock, holderName: holder ?? null, refetch };
}

/**
 * Adquiere un lock al montar el componente (cuando un revisor abre la historia)
 * y lo mantiene vivo con heartbeat. Lo libera al desmontar.
 * Solo debe usarse en vistas/formularios de revisión por R2/R3/especialista.
 */
export function useAcquireLock(
  recordType: RecordType,
  recordId: string | null | undefined,
  active: boolean,
) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || !recordId || !auth.user) return;
    let alive = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function acquire() {
      const expires = new Date(Date.now() + 10 * 60_000).toISOString();
      const { error } = await supabase.from("record_locks").upsert(
        { record_type: recordType, record_id: recordId!, locked_by: auth.user!.id, expires_at: expires },
        { onConflict: "record_type,record_id" },
      );
      if (error && alive) setError(error.message);
      qc.invalidateQueries({ queryKey: ["record-lock", recordType, recordId] });
    }

    async function release() {
      await supabase.from("record_locks")
        .delete()
        .eq("record_type", recordType).eq("record_id", recordId!)
        .eq("locked_by", auth.user!.id);
    }

    acquire();
    interval = setInterval(acquire, 4 * 60_000); // heartbeat cada 4 min

    return () => {
      alive = false;
      if (interval) clearInterval(interval);
      release();
    };
  }, [active, recordId, recordType, auth.user, qc]);

  return { error };
}
