import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getRegistration } from "@/lib/offline/registerSW";
import { useAuth } from "@/hooks/useAuth";
import { getVapidPublicKey } from "@/lib/push.functions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function abToB64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function PushToggle() {
  const auth = useAuth();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const fetchKey = useServerFn(getVapidPublicKey);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    fetchKey().then(({ key }) => {
      setVapidKey(key);
      setSupported(!!key);
    }).catch(() => setSupported(false));
  }, [fetchKey]);

  useEffect(() => {
    if (!vapidKey) return;
    (async () => {
      const reg = await getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    })();
  }, [vapidKey]);

  if (!supported || !auth.user) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      const reg = await getRegistration();
      if (!reg) {
        toast.error("Service Worker no disponible (requiere sitio publicado).");
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        setSubscribed(false);
        toast.success("Notificaciones push desactivadas en este dispositivo.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Permiso denegado.");
        return;
      }
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey!),
      });
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh ?? abToB64Url(sub.getKey("p256dh"));
      const auth_key = json.keys?.auth ?? abToB64Url(sub.getKey("auth"));
      const { error } = await supabase.from("push_subscriptions").insert({
        user_id: auth.user!.id,
        endpoint: sub.endpoint,
        p256dh,
        auth: auth_key,
        user_agent: navigator.userAgent.slice(0, 200),
      });
      if (error) throw error;
      setSubscribed(true);
      toast.success("Notificaciones push activadas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error activando push");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={subscribed ? "Desactivar notificaciones push" : "Activar notificaciones push"}
      className="p-2 rounded-md hover:bg-accent disabled:opacity-50"
      aria-label="Notificaciones push"
    >
      {subscribed ? (
        <BellRing className="w-4 h-4 text-[oklch(0.55_0.18_240)]" />
      ) : (
        <BellOff className="w-4 h-4 text-muted-foreground" />
      )}
    </button>
  );
}
