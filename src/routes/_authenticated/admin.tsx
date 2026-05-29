import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, SERVICE_LABELS, type AppRole, type ServiceType } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administración" }] }),
  component: AdminPage,
});

function AdminPage() {
  const auth = useAuth();
  if (!auth.isAdmin) return <p className="text-sm text-muted-foreground">Acceso restringido.</p>;
  return (
    <div>
      <h1 className="text-xl font-semibold mb-1 flex items-center gap-2"><Shield className="w-5 h-5" /> Administración</h1>
      <p className="text-sm text-muted-foreground mb-4">Gestión de usuarios, roles y aprobaciones.</p>
      <UsersTable />
    </div>
  );
}

const ROLES: AppRole[] = ["especialista", "r3", "r2", "r1", "enfermeria", "traslado", "admin"];
const SERVICES: ServiceType[] = ["obstetricia", "pediatria", "cirugia_general", "cirugia_pediatrica", "traumatologia", "anestesiologia"];

function UsersTable() {
  const qc = useQueryClient();
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
      ]);
      return (p ?? []).map(profile => ({
        ...profile,
        roles: (r ?? []).filter(rl => rl.user_id === profile.id),
      }));
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").update({ approved: true } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-profiles"] }); toast.success("Usuario aprobado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {profiles?.map(p => (
        <div key={p.id} className="bg-card border rounded-xl p-4">
          <div className="flex justify-between flex-wrap gap-2">
            <div>
              <p className="font-semibold text-sm">{p.full_name}</p>
              <p className="text-xs text-muted-foreground">ID: {p.id.slice(0, 8)}… · {p.approved ? "Aprobado" : "Pendiente"}</p>
            </div>
            {!p.approved && <Button size="sm" onClick={() => approve.mutate(p.id)}>Aprobar</Button>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {p.roles.map(r => (
              <RoleChip key={r.id} role={r as any} onRemove={() => qc.invalidateQueries({ queryKey: ["admin-profiles"] })} />
            ))}
          </div>
          <AssignRole userId={p.id} onAdded={() => qc.invalidateQueries({ queryKey: ["admin-profiles"] })} />
        </div>
      ))}
    </div>
  );
}

function RoleChip({ role, onRemove }: { role: any; onRemove: () => void }) {
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_roles").delete().eq("id", role.id);
      if (error) throw error;
    },
    onSuccess: () => { onRemove(); toast.success("Rol removido"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <button onClick={() => remove.mutate()} className="text-xs rounded-full bg-accent px-2 py-1 hover:bg-destructive hover:text-destructive-foreground transition">
      {ROLE_LABELS[role.role as AppRole]}{role.service ? ` · ${SERVICE_LABELS[role.service as ServiceType]}` : ""} ×
    </button>
  );
}

function AssignRole({ userId, onAdded }: { userId: string; onAdded: () => void }) {
  const [role, setRole] = useState<AppRole>("r1");
  const [service, setService] = useState<ServiceType>("obstetricia");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_roles").insert({
        user_id: userId, role, service: (role === "admin" || role === "traslado") ? null : service,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { onAdded(); toast.success("Rol asignado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex gap-2 mt-2 flex-wrap items-end">
      <select value={role} onChange={e => setRole(e.target.value as AppRole)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
      </select>
      {role !== "admin" && role !== "traslado" && (
        <select value={service} onChange={e => setService(e.target.value as ServiceType)} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
          {SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
        </select>
      )}
      <Button size="sm" variant="outline" onClick={() => add.mutate()} disabled={add.isPending}>Añadir</Button>
    </div>
  );
}
