import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SUPER = "783e43b7-b112-4aba-bef4-e3f3e224e306";

export const listChatableUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id, full_name").eq("approved", true);
    return (profs ?? []).filter(p => p.id !== context.userId);
  });

export const startConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      participantIds: z.array(z.string().uuid()).min(1).max(20),
      title: z.string().max(120).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1-on-1: reuse if one already exists between these two users
    if (data.participantIds.length === 1) {
      const other = data.participantIds[0];
      const { data: mine } = await supabaseAdmin
        .from("chat_participants").select("conversation_id").eq("user_id", context.userId);
      const myIds = (mine ?? []).map(r => r.conversation_id);
      if (myIds.length) {
        const { data: theirs } = await supabaseAdmin
          .from("chat_participants").select("conversation_id")
          .eq("user_id", other).in("conversation_id", myIds);
        const shared = theirs?.[0]?.conversation_id;
        if (shared) {
          // verify it's a 2-person conversation
          const { count } = await supabaseAdmin
            .from("chat_participants").select("*", { count: "exact", head: true })
            .eq("conversation_id", shared);
          if (count === 2) return { conversationId: shared };
        }
      }
    }

    const { data: conv, error } = await supabaseAdmin
      .from("chat_conversations")
      .insert({ created_by: context.userId, title: data.title ?? null, is_group: data.participantIds.length > 1 })
      .select("id").single();
    if (error) throw new Error(error.message);
    const rows = [context.userId, ...data.participantIds].map(uid => ({ conversation_id: conv.id, user_id: uid }));
    const { error: e2 } = await supabaseAdmin.from("chat_participants").insert(rows);
    if (e2) throw new Error(e2.message);
    return { conversationId: conv.id };
  });

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isSuper = context.userId === SUPER;
    let convs;
    if (isSuper) {
      const { data } = await supabaseAdmin
        .from("chat_conversations").select("id, title, is_group, created_by, created_at")
        .order("updated_at", { ascending: false }).limit(200);
      convs = data ?? [];
    } else {
      const { data: parts } = await supabaseAdmin
        .from("chat_participants").select("conversation_id").eq("user_id", context.userId);
      const ids = (parts ?? []).map(p => p.conversation_id);
      if (!ids.length) return [];
      const { data } = await supabaseAdmin
        .from("chat_conversations").select("id, title, is_group, created_by, created_at")
        .in("id", ids).order("updated_at", { ascending: false });
      convs = data ?? [];
    }
    const convIds = convs.map(c => c.id);
    const [{ data: parts }, { data: lastMsgs }] = await Promise.all([
      supabaseAdmin.from("chat_participants").select("conversation_id, user_id").in("conversation_id", convIds),
      supabaseAdmin.from("chat_messages").select("conversation_id, body, created_at, sender_id")
        .in("conversation_id", convIds).order("created_at", { ascending: false }),
    ]);
    const userIds = Array.from(new Set([
      ...(parts ?? []).map(p => p.user_id),
      ...convs.map(c => c.created_by),
    ]));
    const { data: profs } = await supabaseAdmin
      .from("profiles").select("id, full_name").in("id", userIds);
    const lastByConv = new Map<string, { body: string; created_at: string }>();
    for (const m of lastMsgs ?? []) {
      if (!lastByConv.has(m.conversation_id)) {
        lastByConv.set(m.conversation_id, { body: m.body, created_at: m.created_at });
      }
    }
    return convs.map(c => {
      const ids = (parts ?? []).filter(p => p.conversation_id === c.id).map(p => p.user_id);
      const names = ids.map(id => profs?.find(p => p.id === id)?.full_name ?? "—");
      return {
        ...c,
        participants: names,
        participant_ids: ids,
        last_message: lastByConv.get(c.id) ?? null,
      };
    });
  });
