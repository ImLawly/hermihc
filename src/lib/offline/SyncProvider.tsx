import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { startSyncEngine, subscribePending, drain } from "./sync";
import { registerServiceWorker } from "./registerSW";

interface SyncCtx {
  pending: number;
  online: boolean;
  forceSync: () => void;
}
const Ctx = createContext<SyncCtx>({ pending: 0, online: true, forceSync: () => {} });

export function SyncProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  useEffect(() => {
    registerServiceWorker();
    startSyncEngine(qc);
    const unsub = subscribePending(setPending);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      unsub();
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [qc]);

  return (
    <Ctx.Provider value={{ pending, online, forceSync: () => drain(qc) }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSync() {
  return useContext(Ctx);
}
