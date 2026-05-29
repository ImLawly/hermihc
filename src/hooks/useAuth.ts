import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "especialista" | "r3" | "r2" | "r1" | "enfermeria" | "traslado";
export type ServiceType =
  | "obstetricia" | "pediatria" | "cirugia_general"
  | "cirugia_pediatrica" | "traumatologia" | "anestesiologia";

export interface UserRoleRow {
  role: AppRole;
  service: ServiceType | null;
}

export interface ProfileRow {
  id: string;
  full_name: string;
  cedula: string | null;
  approved: boolean;
}

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: ProfileRow | null;
  roles: UserRoleRow[];
  services: ServiceType[];
  isAdmin: boolean;
  isMedical: boolean;
  isNurse: boolean;
  isTransport: boolean;
  canReview: boolean;
  highestRole: AppRole | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const RANK: Record<AppRole, number> = {
  admin: 100, especialista: 90, r3: 80, r2: 70, r1: 60, enfermeria: 50, traslado: 40,
};

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [roles, setRoles] = useState<UserRoleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async (u: User | null) => {
    if (!u) { setProfile(null); setRoles([]); return; }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", u.id).maybeSingle(),
      supabase.from("user_roles").select("role,service").eq("user_id", u.id),
    ]);
    setProfile((p as ProfileRow) ?? null);
    setRoles((r as UserRoleRow[]) ?? []);
  };

  useEffect(() => {
    // 1. Subscribe FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      // defer Supabase calls to avoid deadlock
      setTimeout(() => { loadAll(s?.user ?? null); }, 0);
    });
    // 2. THEN load existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      loadAll(s?.user ?? null).finally(() => setLoading(false));
    });
    return () => subscription.unsubscribe();
  }, []);

  const services = Array.from(new Set(roles.map(r => r.service).filter(Boolean))) as ServiceType[];
  const has = (r: AppRole) => roles.some(x => x.role === r);
  const isAdmin = has("admin");
  const isMedical = isAdmin || has("especialista") || has("r3") || has("r2") || has("r1");
  const isNurse = has("enfermeria");
  const isTransport = has("traslado");
  const canReview = isAdmin || has("especialista") || has("r3") || has("r2");
  const highestRole = roles.length
    ? roles.reduce((a, b) => (RANK[b.role] > RANK[a.role] ? b : a)).role
    : null;

  return {
    loading, session, user, profile, roles, services,
    isAdmin, isMedical, isNurse, isTransport, canReview, highestRole,
    refresh: async () => { await loadAll(user); },
    signOut: async () => { await supabase.auth.signOut(); },
  };
}

export const SERVICE_LABELS: Record<ServiceType, string> = {
  obstetricia: "Obstetricia",
  pediatria: "Pediatría",
  cirugia_general: "Cirugía General",
  cirugia_pediatrica: "Cirugía Pediátrica",
  traumatologia: "Traumatología",
  anestesiologia: "Anestesiología",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  especialista: "Especialista",
  r3: "Residente R3",
  r2: "Residente R2",
  r1: "Residente R1",
  enfermeria: "Enfermería",
  traslado: "Personal de Traslado",
};
