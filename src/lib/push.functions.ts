// Server functions for Web Push (VAPID, no-payload "tickle" model).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function bytesToB64url(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidKey(publicB64: string, privateB64: string) {
  const pub = b64urlToBytes(publicB64);
  // Uncompressed point: 0x04 || X(32) || Y(32)
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("VAPID_PUBLIC_KEY inválido");
  const x = bytesToB64url(pub.subarray(1, 33));
  const y = bytesToB64url(pub.subarray(33, 65));
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d: privateB64,
    ext: true,
  };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function signVapidJWT(audience: string, publicKey: string, privateKey: string, subject: string) {
  const key = await importVapidKey(publicKey, privateKey);
  const header = bytesToB64url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesToB64url(
    new TextEncoder().encode(
      JSON.stringify({
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
        sub: subject,
      })
    )
  );
  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${bytesToB64url(sig)}`;
}

async function sendToSubscription(endpoint: string, vapidPublic: string, vapidPrivate: string, subject: string) {
  const u = new URL(endpoint);
  const audience = `${u.protocol}//${u.host}`;
  const jwt = await signVapidJWT(audience, vapidPublic, vapidPrivate, subject);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      TTL: "60",
      "Content-Length": "0",
      Authorization: `vapid t=${jwt},k=${vapidPublic}`,
    },
  });
  return { status: res.status, ok: res.ok || res.status === 201 };
}

const TargetSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    role: z.enum(["admin", "especialista", "r3", "r2", "r1", "enfermeria", "traslado"]).optional(),
    service: z
      .enum(["obstetricia", "pediatria", "cirugia_general", "cirugia_pediatrica", "traumatologia", "anestesiologia"])
      .optional(),
    title: z.string().min(1).max(120),
    body: z.string().max(300).optional(),
    url: z.string().max(500).optional(),
    urgent: z.boolean().optional(),
  })
  .refine((d) => d.user_id || d.role, { message: "user_id o role requerido" });

/**
 * Sends a push tickle to all subscriptions matching the target.
 * - target by user_id: just that user's devices
 * - target by role + optional service: every user with that role (and service if set)
 *
 * Payload is informational only because no-payload push doesn't carry it;
 * the SW shows a generic notification but uses the url to deep-link on click.
 * Returns the count of successful sends.
 */
export const sendPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TargetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const sub = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
    if (!pub || !priv) {
      return { sent: 0, skipped: true, reason: "VAPID keys not configured" };
    }

    // Resolve target user ids
    let userIds: string[] = [];
    if (data.user_id) {
      userIds = [data.user_id];
    } else if (data.role) {
      let q = supabase.from("user_roles").select("user_id").eq("role", data.role);
      if (data.service) q = q.eq("service", data.service);
      const { data: rows, error } = await q;
      if (error) throw new Error(error.message);
      userIds = Array.from(new Set((rows ?? []).map((r) => r.user_id as string)));
    }
    if (userIds.length === 0) return { sent: 0 };

    const { data: subs, error: e2 } = await supabase
      .from("push_subscriptions")
      .select("endpoint")
      .in("user_id", userIds);
    if (e2) throw new Error(e2.message);
    if (!subs || subs.length === 0) return { sent: 0 };

    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          const r = await sendToSubscription(s.endpoint as string, pub, priv, sub);
          if (r.ok) sent++;
        } catch {
          /* ignore individual failures */
        }
      })
    );
    return { sent };
  });

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? null };
});
