import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { useSync } from "@/lib/offline/SyncProvider";

export function OnlineStatus() {
  const { online, pending, forceSync } = useSync();
  return (
    <div className="flex items-center gap-2">
      <span
        className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
        style={{
          background: online ? "oklch(0.93 0.10 150)" : "oklch(0.95 0.08 75)",
          color: online ? "oklch(0.32 0.12 150)" : "oklch(0.40 0.12 75)",
        }}
      >
        {online ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
        {online ? "En línea" : "Offline"}
      </span>
      {pending > 0 && (
        <button
          onClick={forceSync}
          title={`${pending} cambio(s) pendiente(s) de sincronizar`}
          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-[oklch(0.95_0.08_75)] text-[oklch(0.40_0.12_75)] hover:opacity-80"
        >
          <RefreshCw className="w-3 h-3" /> {pending} pendiente{pending === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
