import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SUPERUSER_ID } from "./superuser";
import { z } from "zod";

function assertSuper(userId: string) {
  if (userId !== SUPERUSER_ID) throw new Error("Acceso denegado");
}

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertSuper(context.userId);
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (error) throw new Error(error.message);
    const ids = data.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, approved").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role, service").in("user_id", ids),
    ]);
    return data.users
      .filter((u) => u.id !== SUPERUSER_ID)
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        full_name: profiles?.find((p) => p.id === u.id)?.full_name ?? "",
        approved: profiles?.find((p) => p.id === u.id)?.approved ?? false,
        roles: (roles ?? []).filter((r) => r.user_id === u.id),
      }));
  });

export const deleteUserBySuper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    assertSuper(context.userId);
    if (data.userId === SUPERUSER_ID) throw new Error("No se puede eliminar al superusuario");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).max(128) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    assertSuper(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleApproveBySuper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), approved: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    assertSuper(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ approved: data.approved })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
