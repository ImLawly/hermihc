export const LOCATION_LABELS = {
  consulta_externa: "Consulta Externa",
  emergencia: "Emergencia",
  hospitalizacion: "Hospitalización",
} as const;

export const NOTE_TYPE_LABELS = {
  medica: "Nota Médica",
  aclaratoria: "Nota Aclaratoria",
  enfermeria: "Nota de Enfermería",
} as const;

export function calcAge(birthIso: string | null | undefined): number | null {
  if (!birthIso) return null;
  const b = new Date(birthIso);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function calcTAM(systolic?: number | null, diastolic?: number | null): number | null {
  if (!systolic || !diastolic) return null;
  return Math.round((systolic + 2 * diastolic) / 3);
}

export function parseTA(ta?: string | null): { sys: number | null; dia: number | null } {
  if (!ta) return { sys: null, dia: null };
  const m = ta.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return { sys: null, dia: null };
  return { sys: Number(m[1]), dia: Number(m[2]) };
}

export function timeSinceAdmission(admissionIso: string, nowDate = new Date()): string {
  const ad = new Date(admissionIso);
  const ms = nowDate.getTime() - ad.getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 72) return `${hours} h`;
  const days = Math.floor(hours / 24);
  const remH = hours - days * 24;
  if (days < 7) return `${hours} h / ${days} d ${remH} h`;
  return `${days} días`;
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function toLocalInputValue(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
