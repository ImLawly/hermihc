import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, SERVICE_LABELS, ROLE_LABELS } from "@/hooks/useAuth";
import { Stethoscope, LogOut, Users, ShieldAlert, Bell, Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { OnlineStatus } from "@/components/OnlineStatus";
import { NotificationBell } from "@/components/NotificationBell";
import { PushToggle } from "@/components/PushToggle";
import { SyncProvider } from "@/lib/offline/SyncProvider";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const auth = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (auth.loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Cargando…</div>;
  }

  // Not approved yet
  if (auth.profile && !auth.profile.approved && !auth.isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="max-w-md text-center bg-card border rounded-2xl p-8 shadow-sm">
          <ShieldAlert className="w-10 h-10 mx-auto text-[color:var(--warning)]" />
          <h1 className="mt-3 text-lg font-semibold">Cuenta pendiente de aprobación</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hola {auth.profile.full_name}. Un administrador debe asignarte un rol y servicio antes de que puedas acceder al sistema.
          </p>
          <Button variant="outline" className="mt-5" onClick={async () => {
            await auth.signOut(); router.navigate({ to: "/login" });
          }}>Cerrar sesión</Button>
        </div>
      </main>
    );
  }

  const nav = [
    { to: "/pacientes", label: "Pacientes", icon: Users, show: auth.isMedical || auth.isNurse },
    { to: "/traslados", label: "Traslados", icon: Bell, show: auth.isTransport || auth.isAdmin },
    { to: "/admin", label: "Administración", icon: ShieldAlert, show: auth.isAdmin && !auth.isSuperuser },
    { to: "/superuser", label: "Superusuario", icon: ShieldAlert, show: auth.isSuperuser },
  ].filter(n => n.show);


  return (
    <SyncProvider>
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button className="md:hidden p-2 -ml-2" onClick={() => setMenuOpen(v => !v)} aria-label="Menú">
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/pacientes" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[color:var(--tab-active)] flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm hidden sm:block">Historias Clínicas</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            {nav.map(n => (
              <Link key={n.to} to={n.to}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
                activeProps={{ className: "px-3 py-1.5 rounded-md text-sm font-medium bg-[color:var(--tab-active)] text-white" }}>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <OnlineStatus />
            <NotificationBell />
            <PushToggle />
            <div className="hidden sm:flex flex-col items-end text-right leading-tight">
              <span className="text-xs font-semibold">{auth.profile?.full_name}</span>
              <span className="text-[10px] text-muted-foreground">
                {auth.highestRole ? ROLE_LABELS[auth.highestRole] : "Sin rol"} · {auth.services.map(s => SERVICE_LABELS[s]).join(", ") || "—"}
              </span>
            </div>
            <button onClick={async () => { await auth.signOut(); router.navigate({ to: "/login" }); }}
              className="p-2 rounded-md hover:bg-accent" aria-label="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t bg-background">
            <nav className="px-2 py-2 flex flex-col">
              {nav.map(n => (
                <Link key={n.to} to={n.to} onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 rounded-md text-sm font-medium hover:bg-accent flex items-center gap-2"
                  activeProps={{ className: "px-3 py-2 rounded-md text-sm font-medium bg-[color:var(--tab-active)] text-white flex items-center gap-2" }}>
                  <n.icon className="w-4 h-4" />{n.label}
                </Link>
              ))}
              <div className="border-t mt-1 pt-2 px-3 pb-2">
                <p className="text-xs font-semibold">{auth.profile?.full_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {auth.highestRole ? ROLE_LABELS[auth.highestRole] : "Sin rol"}
                </p>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5">
        <Outlet />
      </main>
    </div>
    </SyncProvider>
  );
}
