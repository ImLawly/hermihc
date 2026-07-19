import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createTempLink } from "@/lib/tempLinks.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Share2, Copy } from "lucide-react";

const PRESETS = [
  { label: "15 min", value: 0.25 },
  { label: "1 hora", value: 1 },
  { label: "6 horas", value: 6 },
  { label: "24 horas", value: 24 },
  { label: "48 horas", value: 48 },
];

export function ShareTempLink({ patientId, admissionId }: { patientId: string; admissionId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(6);
  const [note, setNote] = useState("");
  const [generated, setGenerated] = useState<string | null>(null);
  const fn = useServerFn(createTempLink);

  const m = useMutation({
    mutationFn: () => fn({ data: { patientId, admissionId: admissionId ?? null, hours, note: note || undefined } }),
    onSuccess: (r) => {
      const origin = window.location.hostname.endsWith("lovable.app")
        ? window.location.origin
        : "https://hermihc.lovable.app";
      const url = `${origin}/v/${r.token}`;
      setGenerated(url);
      navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Link generado y copiado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { setOpen(v => !v); setGenerated(null); }}>
        <Share2 className="w-4 h-4 mr-1" /> Link temporal
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-popover border rounded-xl p-3 shadow-lg z-20">
          <p className="font-semibold text-sm mb-2">Compartir historia (solo lectura)</p>
          <div className="flex flex-wrap gap-1 mb-2">
            {PRESETS.map(p => (
              <button key={p.label}
                onClick={() => setHours(p.value)}
                className={`text-[11px] px-2 py-1 rounded-full border ${hours === p.value ? "bg-primary text-primary-foreground" : ""}`}>
                {p.label}
              </button>
            ))}
          </div>
          <Input className="mb-2 h-8 text-xs" placeholder="Nota (opcional)"
            value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          <Button size="sm" className="w-full" disabled={m.isPending} onClick={() => m.mutate()}>
            Generar
          </Button>
          {generated && (
            <div className="mt-3 p-2 bg-muted rounded text-[10px] flex items-center gap-1">
              <span className="font-mono truncate flex-1">{generated}</span>
              <button onClick={() => { navigator.clipboard.writeText(generated); toast.success("Copiado"); }}>
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">
            El enlace caducará automáticamente. Puedes revocarlo desde el panel de superusuario.
          </p>
        </div>
      )}
    </>
  );
}
