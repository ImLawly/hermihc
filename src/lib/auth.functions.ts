import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SUPERUSER_ID, SUPERUSER_USERNAME, SUPERUSER_EMAIL } from "./superuser.server";
import { z } from "zod";

/** Returns whether the currently authenticated user is the superuser. */
export const checkIsSuperuser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { isSuperuser: context.userId === SUPERUSER_ID };
  });

/**
 * Resolves a login identifier (username or email) to an email usable with
 * supabase.auth.signInWithPassword. Keeps the superuser alias on the server.
 */
export const resolveLoginEmail = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ identifier: z.string().min(1).max(254) }).parse(d),
  )
  .handler(async ({ data }) => {
    const id = data.identifier.trim();
    if (id.toLowerCase() === SUPERUSER_USERNAME.toLowerCase()) {
      return { email: SUPERUSER_EMAIL };
    }
    return { email: id };
  });
