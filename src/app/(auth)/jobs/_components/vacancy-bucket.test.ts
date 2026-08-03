import { describe, expect, it } from "vitest";

import { resolveVacancyBucket } from "./vacancy-bucket";
import type { VacancyItem } from "@/modules/admin/infrastructure/admin-api";

const AGORA = new Date("2026-08-03T12:00:00.000Z");
const FUTURO = "2026-08-10T21:00:00.000Z";
const PASSADO = "2026-07-20T21:00:00.000Z";

function vaga(over: Partial<VacancyItem>): VacancyItem {
  return {
    id: "v1",
    status: "OPEN",
    endTime: FUTURO,
    startTime: FUTURO,
    ...over,
  } as VacancyItem;
}

describe("resolveVacancyBucket", () => {
  describe("vaga aberta", () => {
    it("sem candidato fica em 'open'", () => {
      expect(resolveVacancyBucket(vaga({ candidacyCount: 0 }), AGORA)).toBe("open");
    });

    // Sem candidato o problema é de alcance; com candidato é o contratante que
    // não escolheu. Antes as duas caíam na mesma coluna e a fila de "só falta
    // alguém clicar em aceitar" sumia no meio das que ninguém viu.
    it("com candidato vai para 'awaitingSelection'", () => {
      expect(resolveVacancyBucket(vaga({ candidacyCount: 3 }), AGORA)).toBe("awaitingSelection");
    });

    it("sem candidacyCount trata como zero", () => {
      expect(resolveVacancyBucket(vaga({}), AGORA)).toBe("open");
    });

    it("passou do horário sem aceite vira 'lost', mesmo com candidato", () => {
      const expirada = vaga({ candidacyCount: 4, startTime: PASSADO, endTime: PASSADO });
      expect(resolveVacancyBucket(expirada, AGORA)).toBe("lost");
    });
  });

  describe("vaga fechada (freelancer escolhido)", () => {
    // O job só é criado depois do pagamento — a ausência dele É o "falta pagar".
    it("sem job é 'awaitingPayment'", () => {
      expect(resolveVacancyBucket(vaga({ status: "CLOSED", job: null }), AGORA)).toBe(
        "awaitingPayment",
      );
    });

    it("com job agendado é 'confirmed'", () => {
      const paga = vaga({ status: "CLOSED", job: { id: "j1", status: "SCHEDULED" } });
      expect(resolveVacancyBucket(paga, AGORA)).toBe("confirmed");
    });
  });

  describe("job em curso e concluído", () => {
    it("IN_PROGRESS é 'inProgress'", () => {
      const v = vaga({ status: "CLOSED", job: { id: "j1", status: "IN_PROGRESS" } });
      expect(resolveVacancyBucket(v, AGORA)).toBe("inProgress");
    });

    it("concluído sem as duas avaliações fica 'completedAwaitingReview'", () => {
      const v = vaga({
        status: "CLOSED",
        job: { id: "j1", status: "COMPLETED", hasContractorFeedback: true },
      });
      expect(resolveVacancyBucket(v, AGORA)).toBe("completedAwaitingReview");
    });

    it("concluído e avaliado dos dois lados fica 'completedReviewed'", () => {
      const v = vaga({
        status: "CLOSED",
        job: {
          id: "j1",
          status: "COMPLETED",
          hasContractorFeedback: true,
          hasProviderFeedback: true,
        },
      });
      expect(resolveVacancyBucket(v, AGORA)).toBe("completedReviewed");
    });
  });

  describe("cancelamentos", () => {
    it.each(["CANCELLED", "CANCELLED_BY_CONTRACTOR"])("status %s é 'cancelled'", (status) => {
      expect(resolveVacancyBucket(vaga({ status }), AGORA)).toBe("cancelled");
    });

    it("job cancelado é 'cancelled', não 'confirmed'", () => {
      const v = vaga({ status: "CLOSED", job: { id: "j1", status: "CANCELLED" } });
      expect(resolveVacancyBucket(v, AGORA)).toBe("cancelled");
    });
  });
});
