import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function supabaseForUser(token: string) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export default defineTool({
  name: "get_my_profile",
  title: "Obtener mi perfil",
  description:
    "Devuelve el perfil, los roles y los servicios clínicos asignados al usuario autenticado.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx.getToken());
    const userId = ctx.getUserId();
    const [{ data: profile, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, cedula, approved").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role, service").eq("user_id", userId),
    ]);
    if (pErr || rErr) {
      return {
        content: [{ type: "text", text: (pErr ?? rErr)!.message }],
        isError: true,
      };
    }
    const payload = {
      user_id: userId,
      email: ctx.getUserEmail(),
      profile,
      roles: roles ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
