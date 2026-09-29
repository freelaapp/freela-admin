import { describe, expect, it } from "vitest";
import type { UserDeletionPreview } from "@/modules/admin/infrastructure/admin-api";
import { describeUserDeletion, historyLines } from "./user-deletion-copy";

const zero = {
  vacancies: 0,
  candidacies: 0,
  fixedJobs: 0,
  repasses: 0,
  walletEntries: 0,
  referralsMade: 0,
  referralRewards: 0,
  paidSubscriptionCharges: 0,
};

const preview = (overrides: Partial<UserDeletionPreview> = {}): UserDeletionPreview => ({
  userId: "u1",
  mode: "HARD",
  history: zero,
  historyTotal: 0,
  blockers: [],
  ...overrides,
});

describe("describeUserDeletion", () => {
  it("carregando: não deixa confirmar", () => {
    const d = describeUserDeletion(undefined, true);
    expect(d.canConfirm).toBe(false);
    expect(d.tone).toBe("neutral");
  });

  it("sem histórico: apaga de vez", () => {
    const d = describeUserDeletion(preview(), false);
    expect(d.tone).toBe("danger");
    expect(d.title).toBe("Sem histórico — a conta será apagada de vez");
    expect(d.confirmLabel).toBe("Excluir definitivamente");
    expect(d.canConfirm).toBe(true);
  });

  it("com histórico: desativa e anonimiza, lista o que tem", () => {
    const d = describeUserDeletion(
      preview({
        mode: "SOFT",
        history: { ...zero, vacancies: 3, candidacies: 1, walletEntries: 2 },
        historyTotal: 6,
      }),
      false,
    );
    expect(d.tone).toBe("warning");
    expect(d.title).toBe(
      "Esta conta tem histórico — será desativada e anonimizada, não apagada",
    );
    expect(d.lines.join(" ")).toMatch(/3 vagas/);
    expect(d.lines.join(" ")).toMatch(/1 candidatura/);
    expect(d.lines.join(" ")).toMatch(/2 movimentações na carteira/);
    expect(d.lines.join(" ")).toMatch(/não consegue mais entrar/);
    expect(d.confirmLabel).toBe("Desativar e anonimizar");
    expect(d.canConfirm).toBe(true);
  });

  it("bloqueado: mostra os motivos e não deixa confirmar", () => {
    const d = describeUserDeletion(
      preview({ mode: "BLOCKED", blockers: ["Tem serviço em andamento — conclua antes."] }),
      false,
    );
    expect(d.tone).toBe("blocked");
    expect(d.lines).toContain("Tem serviço em andamento — conclua antes.");
    expect(d.canConfirm).toBe(false);
  });

  it("já excluída: não deixa confirmar", () => {
    const d = describeUserDeletion(preview({ mode: "ALREADY_DELETED" }), false);
    expect(d.title).toBe("Esta conta já foi excluída.");
    expect(d.canConfirm).toBe(false);
  });

  it("prévia indisponível (API antiga/erro): não deixa confirmar", () => {
    const d = describeUserDeletion(undefined, false);
    expect(d.canConfirm).toBe(false);
  });
});

describe("historyLines", () => {
  it("só lista o que existe, no singular/plural certo", () => {
    expect(historyLines({ ...zero, fixedJobs: 1, referralsMade: 2, paidSubscriptionCharges: 1 })).toEqual([
      "1 vaga fixa ou candidatura a vaga fixa",
      "2 indicações feitas",
      "1 cobrança de plano paga",
    ]);
  });
});
