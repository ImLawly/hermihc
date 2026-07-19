import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function randomToken(len = 24) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Create a temporary read-only link to a patient's clinical history. */
export const createTempLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      patientId: z.string().uuid(),
      admissionId: z.string().uuid().optional().nullable(),
      hours: z.number().min(0.25).max(48),
      note: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const token = randomToken(28);
    const expires_at = new Date(Date.now() + data.hours * 3600_000).toISOString();
    const { error } = await supabaseAdmin.from("temporary_access_tokens").insert({
      token,
      patient_id: data.patientId,
      admission_id: data.admissionId ?? null,
      created_by: context.userId,
      expires_at,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { token, expires_at };
  });

export const listMyTempLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ patientId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("temporary_access_tokens")
      .select("id, token, patient_id, admission_id, expires_at, revoked_at, access_count, last_accessed_at, note, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(100);
    const SUPER = "783e43b7-b112-4aba-bef4-e3f3e224e306";
    if (context.userId !== SUPER) q = q.eq("created_by", context.userId);
    if (data.patientId) q = q.eq("patient_id", data.patientId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const revokeTempLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const SUPER = "783e43b7-b112-4aba-bef4-e3f3e224e306";
    let q = supabaseAdmin.from("temporary_access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (context.userId !== SUPER) q = q.eq("created_by", context.userId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Public: validate a token and return read-only patient + admissions snapshot. */
export const viewTempLink = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(8).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("temporary_access_tokens")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Enlace no válido");
    if (row.revoked_at) throw new Error("Este enlace fue revocado");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("Este enlace ha expirado");

    // Increment access counter (best-effort)
    await supabaseAdmin.from("temporary_access_tokens").update({
      access_count: (row.access_count ?? 0) + 1,
      last_accessed_at: new Date().toISOString(),
    }).eq("id", row.id);

    const [{ data: patient }, admRes] = await Promise.all([
      supabaseAdmin.from("patients").select("*").eq("id", row.patient_id).maybeSingle(),
      row.admission_id
        ? supabaseAdmin.from("admissions").select("*").eq("id", row.admission_id)
        : supabaseAdmin.from("admissions").select("*").eq("patient_id", row.patient_id).order("admission_date", { ascending: false }),
    ]);
    const admissions = admRes.data ?? [];
    const admIds = admissions.map((a: { id: string }) => a.id);
    const [evol, ord, notas, mon, labs, inter, deliv, oper] = admIds.length ? await Promise.all([
      supabaseAdmin.from("evolutions").select("*").in("admission_id", admIds).order("created_at", { ascending: false }),
      supabaseAdmin.from("medical_orders").select("*").in("admission_id", admIds).order("created_at", { ascending: false }),
      supabaseAdmin.from("clinical_notes").select("*").in("admission_id", admIds).order("created_at", { ascending: false }),
      supabaseAdmin.from("monitoring_entries").select("*").in("admission_id", admIds).order("recorded_at", { ascending: false }),
      supabaseAdmin.from("lab_results").select("*").in("admission_id", admIds).order("taken_at", { ascending: false }),
      supabaseAdmin.from("interconsultations").select("*").in("admission_id", admIds).order("created_at", { ascending: false }),
      supabaseAdmin.from("delivery_notes").select("*").in("admission_id", admIds).order("created_at", { ascending: false }),
      supabaseAdmin.from("operative_notes").select("*").in("admission_id", admIds).order("created_at", { ascending: false }),
    ]) : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }] as const;

    return {
      meta: {
        expires_at: row.expires_at,
        note: row.note,
        access_count: (row.access_count ?? 0) + 1,
        token_short: data.token.slice(-6),
      },
      patient,
      admissions,
      evolutions: evol.data ?? [],
      orders: ord.data ?? [],
      notes: notas.data ?? [],
      monitoring: mon.data ?? [],
      labs: labs.data ?? [],
      interconsults: inter.data ?? [],
      deliveryNotes: deliv.data ?? [],
      operativeNotes: oper.data ?? [],
    };
  });

