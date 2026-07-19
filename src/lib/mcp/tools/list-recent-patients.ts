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
  name: "list_recent_patients",
  title: "Listar pacientes recientes",
  description:
    "Lista pacientes recientes visibles para el usuario (según sus servicios asignados y RLS). Devuelve identificación básica, ubicación actual y estado.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Número máximo de pacientes a devolver (por defecto 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "No autenticado" }], isError: true };
    }
    const token = ctx.getToken();
    if (!token) {
      return { content: [{ type: "text", text: "Token no disponible" }], isError: true };
    }
    const supabase = supabaseForUser(token);
    const { data, error } = await supabase
      .from("patients")
      .select("id, nombres, apellidos, cedula, current_location, current_bed, status, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});
