import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { listMyTempLinks, revokeTempLink } from "@/lib/tempLinks.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Copy, Link as LinkIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/superuser/links")({
  head: () => ({ meta: [{ title: "Links temporales — Superusuario" }] }),
  component: TempLinksPage,
});

function TempLinksPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const fetchFn = useServerFn(listMyTempLinks);
  const revokeFn = useServerFn(revokeTempLink);

  const { data: links } = useQuery({
    queryKey: ["temp-links-all"],
    queryFn: () => fetchFn({ data: {} }),
    enabled: !!auth.user,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { id } }),
    onSuccess: () => { toast.success("Enlace revocado"); qc.invalidateQueries({ queryKey: ["temp-links-all"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div>
      <Link to="/superuser" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver
      </Link>
      <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <LinkIcon className="w-5 h-5" /> Links temporales activos
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        {auth.isSuperuser ? "Ves todos los enlaces del sistema." : "Tus enlaces compartidos."}
      </p>

      <div className="space-y-2">
        {links?.length === 0 && <p className="text-sm text-muted-foreground">No hay enlaces.</p>}
        {links?.map((l) => {
          const url = `${origin}/v/${l.token}`;
          const expired = new Date(l.expires_at).getTime() < Date.now();
          const status = l.revoked_at ? "revocado" : expired ? "expirado" : "activo";
          return (
            <div key={l.id} className="bg-card border rounded-xl p-3">
              <div className="flex justify-between flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs truncate">{url}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Expira: {new Date(l.expires_at).toLocaleString()} ·
                    Accesos: {l.access_count}
                    {l.last_accessed_at && <> · Último: {new Date(l.last_accessed_at).toLocaleString()}</>}
                  </p>
                  {l.note && <p className="text-[11px] text-muted-foreground italic">"{l.note}"</p>}
                </div>
                <div className="flex gap-2 items-start">
                  <span className={`text-[10px] px-2 py-1 rounded-full ${
                    status === "activo" ? "bg-green-100 text-green-700" :
                    status === "expirado" ? "bg-muted text-muted-foreground" :
                    "bg-red-100 text-red-700"}`}>
                    {status}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(url); toast.success("Copiado");
                  }}><Copy className="w-3.5 h-3.5" /></Button>
                  {!l.revoked_at && (
                    <Button size="sm" variant="destructive"
                      onClick={() => { if (confirm("¿Revocar este enlace?")) revoke.mutate(l.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
