import { Mail, MessageCircle, Phone } from "lucide-react";
import { waLink } from "@/modules/admin/application/engagement-format";

/** Telefone vira link do WhatsApp (com 55 quando falta); e-mail vira mailto. */
export function Contact({ phone, email }: { phone: string | null; email: string | null }) {
  const wa = waLink(phone);
  return (
    <div className="flex min-w-0 flex-col gap-0.5 text-xs">
      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-green-700 hover:underline"
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          {phone}
        </a>
      ) : phone ? (
        <span className="inline-flex items-center gap-1 text-[#737373]">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {phone}
        </span>
      ) : (
        <span className="text-[#a3a3a3]">sem telefone</span>
      )}
      {email && (
        <a href={`mailto:${email}`} className="inline-flex min-w-0 items-center gap-1 text-[#737373] hover:underline">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{email}</span>
        </a>
      )}
    </div>
  );
}
