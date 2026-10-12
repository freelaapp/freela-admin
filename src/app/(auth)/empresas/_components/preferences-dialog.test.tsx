import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/modules/admin/infrastructure/contractor-settings-api", () => ({
  getContractorSettings: vi.fn(),
  getContractorSettingsHistory: vi.fn(),
  updateContractorSettings: vi.fn(),
}));

import { toast } from "sonner";
import {
  getContractorSettings,
  getContractorSettingsHistory,
  updateContractorSettings,
  type ContractorSettingsView,
  type PaperworkOption,
  type SettingsHistoryEntry,
} from "@/modules/admin/infrastructure/contractor-settings-api";
import { PreferencesDialog } from "./preferences-dialog";

const option = (key: PaperworkOption["key"], title: string, summary: string): PaperworkOption => ({
  key,
  title,
  summary,
  whatIs: "",
  whatFor: "",
  whenOn: "",
  whenOff: "",
  responsibility: "",
});

const OPTIONS: PaperworkOption[] = [
  option(
    "signedContractEnabled",
    "Contrato assinado",
    "Contrato entre a sua empresa e o freelancer em cada vaga; os dois assinam no app.",
  ),
  option(
    "rpaEnabled",
    "RPA (Recibo de Pagamento a Autônomo)",
    "Recibo de cada pagamento ao freelancer, com o INSS a recolher, emitido pela Freela em nome da sua empresa.",
  ),
  option(
    "inssRemindersEnabled",
    "Lembretes e relatório do INSS (eSocial)",
    "Avisos dos prazos do eSocial e da DCTFWeb e um relatório mensal pronto para o seu contador.",
  ),
];

const VIEW: ContractorSettingsView = {
  signedContractEnabled: true,
  rpaEnabled: true,
  inssRemindersEnabled: false,
  billingMode: "PREPAID",
  editable: true,
  readOnlyReason: null,
  updatedAt: "2026-10-10T17:32:00.000Z",
  updatedBy: "CONTRACTOR",
  options: OPTIONS,
};

/** 10/10 14:32 em Brasília: o dono desligou os lembretes do INSS pelo app. */
const INSS_OFF_BY_OWNER: SettingsHistoryEntry = {
  id: "h1",
  field: "inss_reminders_enabled",
  oldValue: "true",
  newValue: "false",
  actorKind: "CONTRACTOR",
  actorId: "u1",
  actorName: "João Dono",
  origin: "PROFILE",
  channel: "APP",
  reason: null,
  createdAt: "2026-10-10T17:32:00.000Z",
};

const REASON_ERROR = "Escreva o motivo (pelo menos 5 caracteres).";

function axiosError(status: number, code: string, message: string) {
  return { isAxiosError: true, response: { status, data: { error: { code, message } } } };
}

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <PreferencesDialog contractorUserId="u1" companyName="Bar do Zé" onClose={onClose} />
    </QueryClientProvider>,
  );
  return { onClose };
}

const contractSwitch = () => screen.findByRole("switch", { name: /Contrato assinado/ });
const saveButton = () => screen.getByRole("button", { name: "Salvar burocracias" });
const reasonInput = () => screen.getByLabelText("Motivo da mudança (obrigatório)");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getContractorSettings).mockResolvedValue(VIEW);
  vi.mocked(getContractorSettingsHistory).mockResolvedValue([INSS_OFF_BY_OWNER]);
});

describe("PreferencesDialog — aba Burocracias", () => {
  it("três chaves com o resumo de cada uma", async () => {
    renderDialog();

    expect(screen.getByText("Documentos e cobrança · Bar do Zé")).toBeInTheDocument();
    expect(await contractSwitch()).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /RPA/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: /Lembretes e relatório do INSS/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    for (const { summary } of OPTIONS) expect(screen.getByText(summary)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Valem para as vagas publicadas depois da mudança. Recibo, recibo do freelancer e nota fiscal da taxa sempre saem.",
      ),
    ).toBeInTheDocument();
  });

  it("'Salvar burocracias' desabilitado sem mudança ou com motivo < 5", async () => {
    renderDialog();
    const contract = await contractSwitch();

    expect(saveButton()).toBeDisabled();
    fireEvent.change(reasonInput(), { target: { value: "Cliente pediu por e-mail" } });
    // Motivo bom, mas nada mudou.
    expect(saveButton()).toBeDisabled();

    fireEvent.click(contract);
    expect(contract).toHaveAttribute("aria-checked", "false");
    expect(saveButton()).toBeEnabled();

    fireEvent.change(reasonInput(), { target: { value: "  abc   " } });
    expect(saveButton()).toBeDisabled();

    // Voltar a chave ao valor salvo = nada mudou de novo.
    fireEvent.change(reasonInput(), { target: { value: "Cliente pediu por e-mail" } });
    fireEvent.click(contract);
    expect(saveButton()).toBeDisabled();
  });

  it("ao sair do campo curto: 'Escreva o motivo (pelo menos 5 caracteres).'", async () => {
    renderDialog();
    await contractSwitch();

    fireEvent.change(reasonInput(), { target: { value: "abc" } });
    expect(screen.queryByText(REASON_ERROR)).not.toBeInTheDocument();
    fireEvent.blur(reasonInput());
    expect(screen.getByText(REASON_ERROR)).toBeInTheDocument();
    expect(reasonInput()).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(reasonInput(), { target: { value: "Cliente pediu" } });
    expect(screen.queryByText(REASON_ERROR)).not.toBeInTheDocument();
  });

  it("422 REASON_REQUIRED aparece no campo", async () => {
    vi.mocked(updateContractorSettings).mockRejectedValue(
      axiosError(422, "REASON_REQUIRED", REASON_ERROR),
    );
    renderDialog();

    fireEvent.click(await contractSwitch());
    fireEvent.change(reasonInput(), { target: { value: "Motivo ok" } });
    fireEvent.click(saveButton());

    expect(await screen.findByText(REASON_ERROR)).toBeInTheDocument();
    expect(reasonInput()).toHaveAttribute("aria-invalid", "true");
    expect(updateContractorSettings).toHaveBeenCalledWith("u1", {
      signedContractEnabled: false,
      reason: "Motivo ok",
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("linha 'Desligado pelo contratante em {dd/mm hh:mm} (app)' quando o updatedBy é o contratante", async () => {
    renderDialog();

    expect(
      await screen.findByText("Desligado pelo contratante em 10/10 14:32 (app)."),
    ).toBeInTheDocument();
  });

  it("salvar manda só o que mudou, com o motivo, e avisa o resumo", async () => {
    vi.mocked(updateContractorSettings).mockResolvedValue({ ...VIEW, signedContractEnabled: false });
    renderDialog();

    fireEvent.click(await contractSwitch());
    fireEvent.change(reasonInput(), { target: { value: "  Cliente pediu por e-mail  " } });
    fireEvent.click(saveButton());

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Salvo. Contrato assinado: desligado."),
    );
    expect(updateContractorSettings).toHaveBeenCalledWith("u1", {
      signedContractEnabled: false,
      reason: "Cliente pediu por e-mail",
    });
    expect(reasonInput()).toHaveValue("");
    expect(saveButton()).toBeDisabled();
  });
});
