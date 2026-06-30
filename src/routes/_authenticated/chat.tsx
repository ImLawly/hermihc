import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { listConversations, startConversation, listChatableUsers } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MessageSquare, Plus, Send, Check, ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat interno" }] }),
  component: ChatPage,
});

function ChatPage() {
  const auth = useAuth();
  const qc = useQueryClient();
  const fetchConvs = useServerFn(listConversations);
  const fetchUsers = useServerFn(listChatableUsers);
  const startConvFn = useServerFn(startConversation);

  const { data: convs } = useQuery({
    queryKey: ["chat-convs"],
    queryFn: () => fetchConvs(),
    refetchInterval: 10000,
    enabled: !!auth.user && !auth.loading,
  });
  const [active, setActive] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Realtime invalidation
  useEffect(() => {
    const ch = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" },
        () => qc.invalidateQueries({ queryKey: ["chat-convs"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: users } = useQuery({
    queryKey: ["chat-users"],
    queryFn: () => fetchUsers(),
    enabled: showNew,
  });

  const startConv = useMutation({
    mutationFn: (participantIds: string[]) => startConvFn({ data: { participantIds } }),
    onSuccess: (r) => {
      setActive(r.conversationId);
      setShowNew(false);
      qc.invalidateQueries({ queryKey: ["chat-convs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (auth.loading) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-160px)]">
      <aside className="bg-card border rounded-xl p-3 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Conversaciones
            {auth.isSuperuser && <span title="Vista superusuario: ves todo"><Shield className="w-3.5 h-3.5 text-amber-600" /></span>}
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowNew(v => !v)}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {showNew && (
          <div className="border rounded-lg p-2 mb-2 max-h-60 overflow-auto">
            <p className="text-xs text-muted-foreground mb-2">Iniciar conversación con…</p>
            {users?.map(u => (
              <button key={u.id}
                className="w-full text-left text-xs p-2 hover:bg-accent rounded"
                onClick={() => startConv.mutate([u.id])}>
                {u.full_name}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1">
          {convs?.length === 0 && (
            <p className="text-xs text-muted-foreground p-3 text-center">Aún no tienes conversaciones.</p>
          )}
          {convs?.map(c => (
            <button key={c.id}
              onClick={() => setActive(c.id)}
              className={`w-full text-left p-2 rounded-lg text-xs ${active === c.id ? "bg-accent" : "hover:bg-accent/50"}`}>
              <p className="font-medium truncate">
                {c.title || c.participants.filter(n => n !== auth.profile?.full_name).join(", ") || "(conversación)"}
              </p>
              {c.last_message && (
                <p className="text-muted-foreground truncate">{c.last_message.body}</p>
              )}
            </button>
          ))}
        </div>
      </aside>
      <section className="bg-card border rounded-xl flex flex-col min-h-0">
        {active ? (
          <ConversationView conversationId={active} onBack={() => setActive(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Selecciona una conversación
          </div>
        )}
      </section>
    </div>
  );
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  delivered_at: string;
  created_at: string;
}

function ConversationView({ conversationId, onBack }: { conversationId: string; onBack: () => void }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["chat-msgs", conversationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages").select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChatMessage[];
    },
  });

  const { data: senders } = useQuery({
    queryKey: ["chat-senders", conversationId, messages?.length],
    queryFn: async () => {
      const ids = Array.from(new Set((messages ?? []).map(m => m.sender_id)));
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: { id: string; full_name: string }) => { m[p.id] = p.full_name; });
      return m;
    },
    enabled: !!messages?.length,
  });

  useEffect(() => {
    const ch = supabase.channel(`chat-${conversationId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        () => qc.invalidateQueries({ queryKey: ["chat-msgs", conversationId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages?.length]);

  const send = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        sender_id: auth.user!.id,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["chat-msgs", conversationId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="border-b p-3 flex items-center gap-2">
        <button className="md:hidden" onClick={onBack}><ArrowLeft className="w-4 h-4" /></button>
        <p className="text-sm font-medium">Conversación</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages?.map(m => {
          const mine = m.sender_id === auth.user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {!mine && <p className="text-[10px] opacity-70 mb-0.5">{senders?.[m.sender_id] ?? "—"}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="text-[10px] opacity-70 mt-1 flex items-center gap-1 justify-end">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {mine && <Check className="w-3 h-3" aria-label="Entregado" />}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="border-t p-2 flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (text.trim()) send.mutate(text.trim()); } }}
          placeholder="Escribe un mensaje…"
          className="resize-none min-h-[40px] max-h-32"
          rows={1}
        />
        <Button size="sm" disabled={!text.trim() || send.isPending}
          onClick={() => send.mutate(text.trim())}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </>
  );
}
