"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { useAuth } from "@/modules/auth/application/use-auth";
import { useOrientationHosts } from "@/modules/admin/application/use-orientation";

interface HostSelectProps {
  value: string;
  onChange: (hostAdminId: string) => void;
}

/** Quem dá a aula. Vazio = eu, quando eu estiver na lista. */
export function useDefaultHostId(): string {
  const { user } = useAuth();
  const hosts = useOrientationHosts();
  const me = user?.id ?? "";
  return hosts.data?.some((h) => h.id === me) ? me : "";
}

export function HostSelect({ value, onChange }: HostSelectProps) {
  const { user } = useAuth();
  const hosts = useOrientationHosts();
  const me = user?.id;
  const shown = value || (hosts.data?.some((h) => h.id === me) ? (me as string) : "");
  return (
    <div className="space-y-1">
      <Label htmlFor="session-host">Quem dá a aula</Label>
      <NativeSelect id="session-host" value={shown} onChange={(e) => onChange(e.target.value)}>
        {shown === "" && <option value="">Eu</option>}
        {(hosts.data ?? []).map((h) => (
          <option key={h.id} value={h.id}>
            {(h.name || h.email) + (h.id === me ? " (eu)" : "")}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}

export function NumberField({ id, label, value, onChange, hint }: NumberFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-[#737373]">{hint}</p>}
    </div>
  );
}

interface MeetFieldProps {
  value: string;
  onChange: (v: string) => void;
}

export function MeetField({ value, onChange }: MeetFieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor="session-meet">Link do Meet</Label>
      <Input
        id="session-meet"
        type="url"
        inputMode="url"
        placeholder="https://meet.google.com/…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-[#737373]">Crie a reunião no Google Meet e cole o link aqui.</p>
    </div>
  );
}
