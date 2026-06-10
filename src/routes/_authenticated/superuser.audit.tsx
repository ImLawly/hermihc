import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { listAuditLogs, listAllUsers } from "@/lib/superuser.functions";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/superuser/audit")({
  head: () => ({ meta: [{ title: "Auditoría — Superusuario" }] }),
  component: AuditPage,
});

function AuditPage() {
  const auth = useAuth();
  const fetchLogs = useServerFn(listAuditLogs);
  const fetchUsers = useServerFn(listAllUsers);
  const [userId, setUserId] = useState<string>("");
  const [table, setTable] = useState<string>("");

  const { data: users } = useQuery({
    queryKey: ["super-users-mini"],
    queryFn: () => fetchUsers(),
    enabled: !!auth.isSuperuser,
  });

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", userId, table],
    queryFn: () => fetchLogs({ data: { userId: userId || undefined, table: table || undefined, limit: 300 } }),
    enabled: !!auth.isSuperuser,
  });

  if (auth.loading) return null;
  if (!auth.isSuperuser) return <p className="text-sm text-muted-foreground">Acceso restringido.</p>;

  return (
    <div>
      <Link to="/superuser" className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground mb-3">
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Volver al panel
      </Link>
      <h1 className="text-xl font-semibold mb-1">Registro de actividad</h1>
      <p className="text-sm text-muted-foreground mb-4">Todas las acciones realizadas por cada usuario en el sistema.</p>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Todos los usuarios</option>
          {(users ?? []).map(u => (
            <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
          ))}
        </select>
        <Input placeholder="Filtrar por tabla (ej. patients)" value={table} onChange={(e) => setTable(e.target.value)} className="max-w-xs" />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs">
            <tr>
              <th className="text-left p-2">Fecha</th>
              <th className="text-left p-2">Usuario</th>
              <th className="text-left p-2">Operación</th>
              <th className="text-left p-2">Tabla</th>
              <th className="text-left p-2">Registro</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map(l => (
              <AuditRow key={l.id} log={l} />
            ))}
            {(logs ?? []).length === 0 && !isLoading && (
              <tr><td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">Sin registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditRow({ log }: { log: any }) {
  const [open, setOpen] = useState(false);
  const diff = computeDiff(log.before_data, log.after_data);
  return (
    <>
      <tr className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setOpen(v => !v)}>
        <td className="p-2 text-xs whitespace-nowrap">{new Date(log.performed_at).toLocaleString()}</td>
        <td className="p-2 text-xs">{log.user_name ?? <span className="text-muted-foreground">{log.user_id?.slice(0, 8) ?? "—"}</span>}</td>
        <td className="p-2"><span className="text-[10px] rounded-full bg-accent px-2 py-0.5">{log.operation}</span></td>
        <td className="p-2 text-xs">{log.table_name}</td>
        <td className="p-2 text-[10px] text-muted-foreground font-mono">{log.row_id?.slice(0, 8) ?? "—"}</td>
      </tr>
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={5} className="p-3 text-[11px]">
            {diff.length === 0 ? (
              <pre className="overflow-x-auto">{JSON.stringify(log.after_data ?? log.before_data, null, 2)}</pre>
            ) : (
              <table className="w-full">
                <thead className="text-muted-foreground"><tr><th className="text-left">Campo</th><th className="text-left">Antes</th><th className="text-left">Después</th></tr></thead>
                <tbody>
                  {diff.map(d => (
                    <tr key={d.key} className="border-t border-border/40">
                      <td className="py-1 pr-2 font-mono">{d.key}</td>
                      <td className="py-1 pr-2 text-red-600 break-all">{fmt(d.before)}</td>
                      <td className="py-1 pr-2 text-green-600 break-all">{fmt(d.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function fmt(v: unknown) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function computeDiff(before: any, after: any) {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: { key: string; before: any; after: any }[] = [];
  for (const k of keys) {
    const b = before?.[k]; const a = after?.[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) out.push({ key: k, before: b, after: a });
  }
  return out;
}
