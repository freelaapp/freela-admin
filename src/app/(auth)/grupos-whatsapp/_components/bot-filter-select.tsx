import { NativeSelect } from "@/components/ui/native-select";
import { BOT_FILTER_OPTIONS, type BotFilter } from "@/modules/admin/application/whatsapp-groups-presentation";

export function BotFilterSelect({ value, onChange }: { value: BotFilter; onChange: (value: BotFilter) => void }) {
  return (
    <NativeSelect aria-label="Status do bot" value={value} onChange={(e) => onChange(e.target.value as BotFilter)}>
      {BOT_FILTER_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}
