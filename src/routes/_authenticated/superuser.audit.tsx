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
              <tr key={l.id} className="border-t">
                <td className="p-2 text-xs whitespace-nowrap">{new Date(l.performed_at).toLocaleString()}</td>
                <td className="p-2 text-xs">{l.user_name ?? <span className="text-muted-foreground">{l.user_id?.slice(0, 8) ?? "—"}</span>}</td>
                <td className="p-2"><span className="text-[10px] rounded-full bg-accent px-2 py-0.5">{l.operation}</span></td>
                <td className="p-2 text-xs">{l.table_name}</td>
                <td className="p-2 text-[10px] text-muted-foreground font-mono">{l.row_id?.slice(0, 8) ?? "—"}</td>
              </tr>
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
