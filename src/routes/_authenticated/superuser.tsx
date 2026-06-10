import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  listAllUsers,
  deleteUserBySuper,
  changeUserPassword,
  toggleApproveBySuper,
  changeMyPassword,
} from "@/lib/superuser.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Trash2, KeyRound, Check, X, ScrollText, ListChecks } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/superuser")({
  head: () => ({ meta: [{ title: "Superusuario" }] }),
  component: SuperPage,
});

function SuperPage() {
  const auth = useAuth();
  const router = useRouter();

  const fetchUsers = useServerFn(listAllUsers);
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["super-users"],
    queryFn: () => fetchUsers(),
    enabled: !!auth.isSuperuser,
  });

  const [search, setSearch] = useState("");
  const filtered = (users ?? []).filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  const delFn = useServerFn(deleteUserBySuper);
  const pwdFn = useServerFn(changeUserPassword);
  const apvFn = useServerFn(toggleApproveBySuper);

  const del = useMutation({
    mutationFn: (userId: string) => delFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuario eliminado");
      qc.invalidateQueries({ queryKey: ["super-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pwd = useMutation({
    mutationFn: (p: { userId: string; password: string }) => pwdFn({ data: p }),
    onSuccess: () => toast.success("Contraseña actualizada"),
    onError: (e: Error) => toast.error(e.message),
  });

  const apv = useMutation({
    mutationFn: (p: { userId: string; approved: boolean }) => apvFn({ data: p }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["super-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (auth.loading) return null;
  if (!auth.isSuperuser) {
    return <p className="text-sm text-muted-foreground">Acceso restringido.</p>;
  }



  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5" /> Panel de Superusuario
          </h1>
          <p className="text-sm text-muted-foreground">
            Control total. {users?.length ?? 0} usuarios en el sistema.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/superuser/audit"><ScrollText className="w-4 h-4 mr-1" /> Auditoría</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/superuser/estado-sistema"><ListChecks className="w-4 h-4 mr-1" /> Estado</Link>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await auth.signOut();
              router.navigate({ to: "/login" });
            }}
          >
            Cerrar sesión
          </Button>
        </div>
      </div>

      <MyPasswordCard />


      <Input
        placeholder="Buscar por nombre o correo…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 max-w-md"
      />

      {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

      <div className="space-y-3">
        {filtered.map((u) => (
          <UserRow
            key={u.id}
            u={u}
            onDelete={() => {
              if (confirm(`¿Eliminar a ${u.full_name || u.email}? Esta acción es irreversible.`))
                del.mutate(u.id);
            }}
            onPwd={(password) => pwd.mutate({ userId: u.id, password })}
            onApprove={(approved) => apv.mutate({ userId: u.id, approved })}
          />
        ))}
      </div>
    </div>
  );
}

function MyPasswordCard() {
  const fn = useServerFn(changeMyPassword);
  const [pwd, setPwd] = useState("");
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: (password: string) => fn({ data: { password } }),
    onSuccess: () => { toast.success("Tu contraseña fue actualizada"); setPwd(""); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="bg-card border rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-semibold text-sm flex items-center gap-2"><KeyRound className="w-4 h-4" /> Mi contraseña</p>
          <p className="text-xs text-muted-foreground">Cambia la clave del superusuario.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(v => !v)}>{open ? "Cancelar" : "Cambiar"}</Button>
      </div>
      {open && (
        <div className="mt-3 flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Nueva contraseña</label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <Button size="sm" disabled={m.isPending} onClick={() => {
            if (pwd.length < 6) return toast.error("Mínimo 6 caracteres");
            m.mutate(pwd);
          }}>Guardar</Button>
        </div>
      )}
    </div>
  );
}


function UserRow({
  u,
  onDelete,
  onPwd,
  onApprove,
}: {
  u: {
    id: string;
    email: string;
    full_name: string;
    approved: boolean;
    last_sign_in_at: string | null;
    roles: { role: string; service: string | null }[];
  };
  onDelete: () => void;
  onPwd: (password: string) => void;
  onApprove: (approved: boolean) => void;
}) {
  const [pwd, setPwd] = useState("");
  const [show, setShow] = useState(false);

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">{u.full_name || "(sin nombre)"}</p>
          <p className="text-xs text-muted-foreground">{u.email}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            ID: {u.id.slice(0, 8)}… ·{" "}
            {u.approved ? (
              <span className="text-green-600">Aprobado</span>
            ) : (
              <span className="text-amber-600">Pendiente</span>
            )}{" "}
            · Último login:{" "}
            {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "nunca"}
          </p>
          {u.roles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {u.roles.map((r, i) => (
                <span key={i} className="text-[10px] rounded-full bg-accent px-2 py-0.5">
                  {r.role}
                  {r.service ? ` · ${r.service}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 items-start">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onApprove(!u.approved)}
            title={u.approved ? "Desaprobar" : "Aprobar"}
          >
            {u.approved ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShow((v) => !v)}>
            <KeyRound className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {show && (
        <div className="mt-3 flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Nueva contraseña</label>
            <Input
              type="text"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              if (pwd.length < 6) return toast.error("Mínimo 6 caracteres");
              onPwd(pwd);
              setPwd("");
              setShow(false);
            }}
          >
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}
