import { useEffect, useState } from "react";
import { Cloud, CloudOff } from "lucide-react";

export function OnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return (
    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
      style={{ background: online ? "oklch(0.93 0.10 150)" : "oklch(0.95 0.08 75)", color: online ? "oklch(0.32 0.12 150)" : "oklch(0.40 0.12 75)" }}>
      {online ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
      {online ? "En línea" : "Offline — los cambios se sincronizarán al reconectar"}
    </span>
  );
}
