"use client";

import { Briefcase, Building2, Mail, MapPin, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { formatPhoneBr } from "@/lib/utils";

/** Dados do autor da avaliação exibidos no modal de perfil. Tudo além do nome é opcional/null-safe. */
export interface AuthorProfile {
  name: string;
  /** Quem ESCREVEU a avaliação: PROVIDER = freelancer, CONTRACTOR = contratante. */
  role?: "PROVIDER" | "CONTRACTOR";
  avatarUrl?: string | null;
  companyName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  uf?: string | null;
  jobTitle?: string | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

/** Avatar redondo com fallback de iniciais num círculo âmbar (brand). */
export function AuthorAvatar({
  name,
  avatarUrl,
  className = "h-8 w-8 text-xs",
}: {
  name: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL S3 presignada (host dinâmico)
      <img
        src={avatarUrl}
        alt={name}
        className={`rounded-full object-cover bg-[#f1f1f1] shrink-0 ${className}`}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-[#eca826] text-white flex items-center justify-center font-semibold shrink-0 ${className}`}
      aria-hidden
    >
      {getInitials(name)}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-[#1d1d1b]">
      <Icon className="w-4 h-4 text-[#a3a3a3] shrink-0" />
      <span className="break-all">{children}</span>
    </div>
  );
}

interface AuthorProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  author: AuthorProfile | null;
}

/** Modal com o perfil de quem escreveu uma avaliação (aba Avaliações e histórico do freelancer). */
export function AuthorProfileDialog({ open, onOpenChange, author }: AuthorProfileDialogProps) {
  if (!author) return null;

  const location = [author.city, author.uf].filter(Boolean).join(" – ");
  const hasDetails = !!(
    author.companyName ||
    author.email ||
    author.phone ||
    location ||
    author.jobTitle
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Perfil</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4">
          <AuthorAvatar name={author.name} avatarUrl={author.avatarUrl} className="h-20 w-20 text-2xl" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#1d1d1b] truncate">{author.name}</p>
            {author.role && (
              <span
                className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  author.role === "PROVIDER"
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-purple-500/10 text-purple-500"
                }`}
              >
                {author.role === "PROVIDER" ? "Freelancer" : "Contratante"}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {author.companyName && <InfoRow icon={Building2}>{author.companyName}</InfoRow>}
          {author.email && <InfoRow icon={Mail}>{author.email}</InfoRow>}
          {author.phone && <InfoRow icon={Phone}>{formatPhoneBr(author.phone)}</InfoRow>}
          {location && <InfoRow icon={MapPin}>{location}</InfoRow>}
          {author.jobTitle && <InfoRow icon={Briefcase}>{author.jobTitle}</InfoRow>}
          {!hasDetails && (
            <p className="text-sm text-[#737373]">Sem informações adicionais de contato.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
