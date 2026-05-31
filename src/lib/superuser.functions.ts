import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SUPERUSER_ID } from "./superuser.server";
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

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ password: z.string().min(6).max(128) }).parse(d))
  .handler(async ({ context, data }) => {
    assertSuper(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePatientBySuper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ patientId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    assertSuper(context.userId);
    // delete dependent rows then patient (no FK cascades defined)
    const { data: adms } = await supabaseAdmin
      .from("admissions").select("id").eq("patient_id", data.patientId);
    const admIds = (adms ?? []).map(a => a.id);
    if (admIds.length) {
      const childTables = [
        "evolutions", "medical_orders", "monitoring_entries", "lab_results",
        "interconsultations", "clinical_notes", "delivery_notes", "operative_notes",
      ] as const;
      // delete order_administrations via orders
      const { data: orders } = await supabaseAdmin
        .from("medical_orders").select("id").in("admission_id", admIds);
      const orderIds = (orders ?? []).map(o => o.id);
      if (orderIds.length) {
        await supabaseAdmin.from("order_administrations").delete().in("order_id", orderIds);
      }
      for (const t of childTables) {
        await supabaseAdmin.from(t).delete().in("admission_id", admIds);
      }
      await supabaseAdmin.from("admissions").delete().in("id", admIds);
    }
    await supabaseAdmin.from("patient_transfers").delete().eq("patient_id", data.patientId);
    const { error } = await supabaseAdmin.from("patients").delete().eq("id", data.patientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid().optional(),
      table: z.string().max(64).optional(),
      limit: z.number().int().min(1).max(500).default(200),
    }).parse(d ?? {}),
  )
  .handler(async ({ context, data }) => {
    assertSuper(context.userId);
    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, table_name, row_id, operation, user_id, performed_at")
      .order("performed_at", { ascending: false })
      .limit(data.limit);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.table) q = q.eq("table_name", data.table);
    const { data: logs, error } = await q;
    if (error) throw new Error(error.message);
    const userIds = Array.from(new Set((logs ?? []).map(l => l.user_id).filter(Boolean))) as string[];
    const { data: profs } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string }[] };
    return (logs ?? []).map(l => ({
      ...l,
      user_name: profs?.find(p => p.id === l.user_id)?.full_name ?? null,
    }));
  });
