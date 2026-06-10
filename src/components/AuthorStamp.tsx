import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User, Clock } from "lucide-react";

/**
 * Trazabilidad visible: muestra quién y cuándo registró/modificó un dato clínico.
 * Todos los usuarios que vean la historia ven esta estampa.
 */
export function AuthorStamp({
  userId,
  date,
  label = "Registrado por",
  reviewerId,
  reviewedAt,
}: {
  userId: string | null | undefined;
  date: string | null | undefined;
  label?: string;
  reviewerId?: string | null;
  reviewedAt?: string | null;
}) {
  const ids = [userId, reviewerId].filter(Boolean) as string[];
  const { data: profiles } = useQuery({
    queryKey: ["profiles-stamp", ...ids],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return data ?? [];
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });

  const nameOf = (id?: string | null) =>
    !id ? "—" : profiles?.find((p) => p.id === id)?.full_name || id.slice(0, 8);

  return (
    <div className="text-[10px] text-muted-foreground border-t mt-2 pt-2 flex flex-wrap gap-x-3 gap-y-1">
      <span className="inline-flex items-center gap-1">
        <User className="w-3 h-3" /> {label}: <strong className="text-foreground">{nameOf(userId)}</strong>
      </span>
      {date && (
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" /> {new Date(date).toLocaleString()}
        </span>
      )}
      {reviewerId && (
        <span className="inline-flex items-center gap-1">
          ✓ Confirmado por <strong className="text-foreground">{nameOf(reviewerId)}</strong>
          {reviewedAt && ` · ${new Date(reviewedAt).toLocaleString()}`}
        </span>
      )}
    </div>
  );
}
