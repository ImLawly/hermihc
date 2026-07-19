import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMyProfile from "./tools/get-my-profile";
import listRecentPatients from "./tools/list-recent-patients";
import listMyNotifications from "./tools/list-my-notifications";

// The OAuth issuer MUST be the direct Supabase host — the proxy form rejects
// tokens with issuer mismatch. Use the project ref (inlined at build time by Vite).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "historias-clinicas-mcp",
  title: "Historias Clínicas — MCP",
  version: "0.1.0",
  instructions:
    "Herramientas para consultar el sistema de historias clínicas. Todas las llamadas actúan como el usuario autenticado y respetan RLS por servicio y rol.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listRecentPatients, listMyNotifications],
});
