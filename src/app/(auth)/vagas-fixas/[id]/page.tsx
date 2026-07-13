"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Check,
  Download,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  User,
  Users,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useAdminFixedJobs,
  useFixedJobApplications,
  useSetFixedJobApplicationStatus,
} from "@/modules/admin/application/use-admin-fixed-jobs";
import type {
  FixedJobAdminApplication,
  FixedJobApplicationStatus,
  FixedJobProfessionalCurriculum,
} from "@/modules/admin/infrastructure/fixed-jobs-api";
import { formatInstantDate } from "@/lib/date.utils";

// ---------------------------------------------------------------------------
// Currículo profissional (readonly) — portado do web `FreelancerCurriculumReadonly`
// ---------------------------------------------------------------------------

function parseCurriculum(raw: unknown): FixedJobProfessionalCurriculum | null {
  if (raw == null || typeof raw !== "object") return null;
  return raw as FixedJobProfessionalCurriculum;
}

function CurriculumReadonly({ curriculum }: { curriculum: unknown }) {
  const c = parseCurriculum(curriculum);
  const experiences = (c?.experiences ?? []).filter(
    (e) =>
      String(e?.workplace ?? "").trim() ||
      String(e?.role ?? "").trim() ||
      String(e?.durationLabel ?? "").trim(),
  );
  const courses = (c?.courses ?? []).filter((row) => {
    const y = row?.completionYear;
    const yearStr = y != null && String(y).trim() !== "" ? String(y).trim() : "";
    return (
      String(row?.title ?? "").trim() ||
      String(row?.durationLabel ?? "").trim() ||
      yearStr.length > 0
    );
  });
  const skills = c?.skills?.trim() ?? "";
  const edge = c?.competitiveEdge?.trim() ?? "";

  const isEmpty = experiences.length === 0 && courses.length === 0 && !skills && !edge;

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-4">
        <p className="text-[13px] font-bold text-[#1d1d1b]">Currículo profissional</p>
        <p className="mt-1 text-[12px] text-[#737373]">
          Este freelancer ainda não preencheu o currículo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] font-bold text-[#1d1d1b]">Currículo profissional</p>

      {experiences.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[12px] font-semibold text-[#737373]">Experiência profissional</p>
          <ul className="space-y-3">
            {experiences.map((e, i) => (
              <li
                key={`${e.workplace}-${e.role}-${i}`}
                className="rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2.5 text-[12px] text-[#4a4a48]"
              >
                <p className="font-semibold text-[#1d1d1b]">Experiência {i + 1}</p>
                <p className="mt-1">
                  <span className="text-[#a3a3a3]">Local: </span>
                  {e.workplace?.trim() || "—"}
                </p>
                <p>
                  <span className="text-[#a3a3a3]">Função: </span>
                  {e.role?.trim() || "—"}
                </p>
                <p>
                  <span className="text-[#a3a3a3]">Tempo de serviço: </span>
                  {e.durationLabel?.trim() || "—"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {courses.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[12px] font-semibold text-[#737373]">Cursos</p>
          <ul className="space-y-3">
            {courses.map((row, i) => (
              <li
                key={`${row.title}-${i}`}
                className="rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2.5 text-[12px] text-[#4a4a48]"
              >
                <p className="font-semibold text-[#1d1d1b]">Curso {i + 1}</p>
                <p className="mt-1">
                  <span className="text-[#a3a3a3]">Qual curso: </span>
                  {row.title?.trim() || "—"}
                </p>
                <p>
                  <span className="text-[#a3a3a3]">Tempo de curso: </span>
                  {row.durationLabel?.trim() || "—"}
                </p>
                <p>
                  <span className="text-[#a3a3a3]">Ano de conclusão: </span>
                  {row.completionYear != null && String(row.completionYear).trim() !== ""
                    ? String(row.completionYear)
                    : "—"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {skills ? (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-[#737373]">Habilidades</p>
          <p className="whitespace-pre-wrap rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2.5 text-[12px] leading-relaxed text-[#4a4a48]">
            {skills}
          </p>
        </div>
      ) : null}

      {edge ? (
        <div className="space-y-1.5">
          <p className="text-[12px] font-semibold text-[#737373]">Diferencial competitivo</p>
          <p className="whitespace-pre-wrap rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-3 py-2.5 text-[12px] leading-relaxed text-[#4a4a48]">
            {edge}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vídeo de apresentação (readonly) — HTML5 <video controls>
// ---------------------------------------------------------------------------

function PresentationVideo({ videoUrl }: { videoUrl: string | null | undefined }) {
  const url = videoUrl?.trim() ?? "";
  return (
    <div className="rounded-2xl border border-[#e5e5e5] bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-[#c97b0e]">
          <Video size={16} aria-hidden />
        </div>
        <h3 className="text-[15px] font-bold text-[#1d1d1b]">Vídeo de apresentação</h3>
      </div>
      {url ? (
        <video
          src={url}
          controls
          playsInline
          className="aspect-video max-h-[280px] w-full rounded-xl bg-black object-contain ring-1 ring-[#e5e5e5]"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#e5e5e5] bg-[#f7f7f7] py-10 text-center">
          <Video size={28} className="text-[#d4d4d4]" aria-hidden />
          <p className="text-[13px] text-[#737373]">
            Este freelancer ainda não enviou um vídeo de apresentação.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name, url, size = 64 }: { name: string; url: string | null; size?: number }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eca826] font-bold text-white"
      style={{ width: size, height: size, fontSize: size / 3 }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        initials || <User size={size / 2} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Perfil do candidato (dialog)
// ---------------------------------------------------------------------------

function ProfileDialog({
  application,
  open,
  onOpenChange,
  onChangeStatus,
  isPending,
}: {
  application: FixedJobAdminApplication | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChangeStatus: (application: FixedJobAdminApplication, status: FixedJobApplicationStatus) => void;
  isPending: boolean;
}) {
  if (!application) return null;
  // Prefere o currículo do perfil global; cai para o snapshot da candidatura
  // quando o provider não está anexado (providerGlobalId nulo).
  const curriculum = application.provider?.professionalCurriculum ?? application.curriculumSnapshot;
  const isRejected = application.status === "REJECTED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogClose onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Perfil do candidato</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar name={application.applicantName} url={application.provider?.avatarUrl ?? null} />
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-[#1d1d1b]">
                {application.applicantName || "—"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-[#737373]">
                <Mail size={13} className="shrink-0 text-[#a3a3a3]" />
                {application.applicantEmail || "Sem e-mail"}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-[#737373]">
                <Phone size={13} className="shrink-0 text-[#a3a3a3]" />
                {application.applicantPhone || "Sem telefone"}
              </p>
            </div>
          </div>

          {application.message ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-[#f7f7f7] px-4 py-3">
              <p className="text-[12px] font-semibold text-[#737373]">Mensagem</p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-[#1d1d1b]">
                {application.message}
              </p>
            </div>
          ) : null}

          <PresentationVideo videoUrl={application.provider?.presentationVideoUrl} />

          <CurriculumReadonly curriculum={curriculum} />

          <div className="flex flex-wrap gap-2 border-t border-[#e5e5e5] pt-4">
            {application.curriculumPdfUrl ? (
              <a
                href={application.curriculumPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e5e5e5] bg-white px-3 text-sm font-medium text-[#1d1d1b] transition-colors hover:bg-[#f7f7f7]"
              >
                <Download size={15} />
                Baixar PDF
              </a>
            ) : null}
            {isRejected ? (
              <Button
                variant="outline"
                onClick={() => onChangeStatus(application, "ACTIVE")}
                disabled={isPending}
              >
                <RotateCcw size={15} />
                Reativar
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => onChangeStatus(application, "REJECTED")}
                disabled={isPending}
                className="text-red-700 hover:text-red-800"
              >
                <X size={15} />
                Recusar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Card do candidato
// ---------------------------------------------------------------------------

function ApplicationCard({
  application,
  onOpenProfile,
  onChangeStatus,
  isPending,
}: {
  application: FixedJobAdminApplication;
  onOpenProfile: (application: FixedJobAdminApplication) => void;
  onChangeStatus: (application: FixedJobAdminApplication, status: FixedJobApplicationStatus) => void;
  isPending: boolean;
}) {
  const isRejected = application.status === "REJECTED";
  return (
    <div className="rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-start gap-3">
        <Avatar name={application.applicantName} url={application.provider?.avatarUrl ?? null} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <strong className="text-sm text-[#1d1d1b]">{application.applicantName}</strong>
              <Badge variant={isRejected ? "destructive" : "success"}>
                {isRejected ? "Negado" : "Ativo"}
              </Badge>
            </div>
            <span className="text-xs text-[#a3a3a3]">{formatInstantDate(application.createdAt)}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#737373]">
            <span className="inline-flex items-center gap-1">
              <Mail size={13} className="text-[#a3a3a3]" />
              {application.applicantEmail || "Sem e-mail"}
            </span>
            <span className="text-[#d4d4d4]">•</span>
            <span className="inline-flex items-center gap-1">
              <Phone size={13} className="text-[#a3a3a3]" />
              {application.applicantPhone || "Sem telefone"}
            </span>
          </p>
          {application.message ? (
            <p className="mt-2 line-clamp-3 text-sm text-[#4a4a48]">{application.message}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenProfile(application)}>
              <User size={15} />
              Ver perfil
            </Button>
            {application.curriculumPdfUrl ? (
              <a
                href={application.curriculumPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-md border border-[#e5e5e5] bg-white px-3 text-xs font-medium text-[#1d1d1b] transition-colors hover:bg-[#f7f7f7]"
              >
                <Download size={14} />
                Baixar PDF
              </a>
            ) : null}
            {isRejected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangeStatus(application, "ACTIVE")}
                disabled={isPending}
              >
                <RotateCcw size={15} />
                Reativar
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onChangeStatus(application, "REJECTED")}
                disabled={isPending}
                className="text-red-700 hover:text-red-800"
              >
                <X size={15} />
                Recusar
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function VagaFixaCandidatosPage() {
  const params = useParams<{ id: string }>();
  const postId = params?.id ?? "";

  // O cabeçalho (título/empresa/local) reaproveita a listagem admin já existente.
  const { data: posts } = useAdminFixedJobs();
  const post = useMemo(() => posts?.find((p) => p.id === postId) ?? null, [posts, postId]);

  const {
    data: applications,
    isLoading,
    isError,
  } = useFixedJobApplications(postId);
  const statusMutation = useSetFixedJobApplicationStatus(postId);

  const [profileApplication, setProfileApplication] = useState<FixedJobAdminApplication | null>(null);

  const activeApplications = (applications ?? []).filter((a) => a.status !== "REJECTED");
  const rejectedApplications = (applications ?? []).filter((a) => a.status === "REJECTED");

  function changeStatus(application: FixedJobAdminApplication, status: FixedJobApplicationStatus) {
    statusMutation.mutate(
      { applicationId: application.id, status },
      {
        onSuccess: () => {
          toast.success(status === "REJECTED" ? "Candidato recusado." : "Candidato reativado.");
          setProfileApplication((current) =>
            current && current.id === application.id ? { ...current, status } : current,
          );
        },
        onError: () => toast.error("Não foi possível atualizar o candidato."),
      },
    );
  }

  const headerTitle = post?.title ?? "Candidatos da vaga";
  const headerParts = post
    ? [post.companyName, post.role, post.location].filter(Boolean).join(" • ")
    : "Candidaturas recebidas nesta vaga fixa.";

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/vagas-fixas"
          className="inline-flex items-center gap-1.5 text-sm text-[#737373] transition-colors hover:text-[#1d1d1b]"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para vagas fixas
        </Link>
      </div>

      <PageHeader title={headerTitle} description={headerParts} />

      {post ? (
        <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-[#e5e5e5] bg-white p-4 text-sm text-[#1d1d1b]">
          <span className="inline-flex items-center gap-1.5">
            <Building2 size={15} className="text-[#a3a3a3]" />
            {post.companyName}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={15} className="text-[#a3a3a3]" />
            {post.location}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} className="text-[#a3a3a3]" />
            {post.applicationCount} candidatura(s)
          </span>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center h-[40vh]">
          <Loader2 className="h-10 w-10 animate-spin text-[#eca826]" />
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center h-[40vh]">
          <p className="text-red-500">Erro ao carregar as candidaturas.</p>
        </div>
      ) : (applications?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#e5e5e5] bg-white py-16 text-center">
          <Users className="h-10 w-10 text-[#d4d4d4]" />
          <p className="text-sm text-[#737373]">Nenhuma candidatura recebida nesta vaga.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {activeApplications.length > 0 ? (
              activeApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  onOpenProfile={setProfileApplication}
                  onChangeStatus={changeStatus}
                  isPending={statusMutation.isPending}
                />
              ))
            ) : (
              <p className="text-sm text-[#737373]">Nenhum candidato ativo nesta vaga.</p>
            )}
          </div>

          {rejectedApplications.length > 0 ? (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#737373]">
                <Check size={15} className="text-[#a3a3a3]" />
                Candidatos negados ({rejectedApplications.length})
              </h3>
              {rejectedApplications.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  onOpenProfile={setProfileApplication}
                  onChangeStatus={changeStatus}
                  isPending={statusMutation.isPending}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}

      <ProfileDialog
        application={profileApplication}
        open={Boolean(profileApplication)}
        onOpenChange={(next) => {
          if (!next) setProfileApplication(null);
        }}
        onChangeStatus={changeStatus}
        isPending={statusMutation.isPending}
      />
    </div>
  );
}
