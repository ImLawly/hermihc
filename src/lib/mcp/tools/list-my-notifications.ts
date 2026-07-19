import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";

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
  name: "list_my_notifications",
  title: "Listar mis notificaciones",
  description:
    "Devuelve notificaciones recientes dirigidas al usuario (por rol, servicio o ID). Filtrado por RLS.",
  inputSchema: {
    only_unread: z.boolean().optional().describe("Si es true, solo devuelve las no leídas."),
    limit: z.number().int().min(1).max(50).optional().describe("Máximo de notificaciones (por defecto 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_unread, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const token = ctx.getToken();
    if (!token) {
      return { content: [{ type: "text", text: "Token no disponible" }], isError: true };
    }
    const supabase = supabaseForUser(token);
    let query = supabase
      .from("notifications")
      .select("id, kind, title, body, payload, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (only_unread) query = query.is("read_at", null);
    const { data, error } = await query;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { notifications: data ?? [] },
    };
  },
});
