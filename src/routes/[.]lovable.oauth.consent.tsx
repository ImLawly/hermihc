import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface AuthDetails {
  client?: { name?: string; client_name?: string; redirect_uris?: string[] } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
  scopes?: string[];
}

interface OAuthWrapper {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthDetails | null; error: { message: string } | null }>;
}

function oauthApi(): OAuthWrapper {
  // Beta namespace — types may not be published yet.
  return (supabase.auth as unknown as { oauth: OAuthWrapper }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Falta authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) {
      window.location.href = immediate;
      return null;
    }
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">No se pudo cargar la autorización</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as AuthDetails | null;
  const { authorization_id } = Route.useSearch();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  if (!details) return null;

  const clientName = details.client?.name ?? details.client?.client_name ?? "una aplicación externa";
  const redirectUri = details.client?.redirect_uris?.[0];
  const scopes = details.scopes ?? (details.scope ? details.scope.split(/\s+/) : []);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("El servidor no devolvió una URL de retorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md bg-card border rounded-2xl p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Conectar {clientName} a tu cuenta</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} podrá usar las herramientas habilitadas de Historias Clínicas
          mientras estés autenticado como <b>{email ?? "tu usuario"}</b>.
        </p>

        {redirectUri && (
          <p className="mt-3 text-xs text-muted-foreground break-all">
            Redirección: <code>{redirectUri}</code>
          </p>
        )}

        {scopes.length > 0 && (
          <ul className="mt-4 text-sm space-y-1">
            {scopes.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          Esto no elude las políticas de acceso: cada herramienta seguirá aplicando RLS
          por servicio y rol.
        </p>

        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            Aprobar
          </Button>
          <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>
            Denegar
          </Button>
        </div>
      </div>
    </main>
  );
}
