import { describe, expect, it } from "vitest";
import {
  MARKETING_SAMPLE,
  MARKETING_STATUS_LABEL,
  codePointLength,
  fromApiButtons,
  imageFileNameForMime,
  insertAt,
  marketingImageErrors,
  previewButtons,
  renderMarketingText,
  statusInSentence,
  toApiButtons,
  toPositional,
  validateMarketingBody,
  validateMarketingButtons,
} from "./marketing-template-rules";

const REBECA = `Oi, {primeiro_nome}! Tudo bem? 👋

O Freela é uma plataforma de intermediação que conecta o seu negócio a freelancers na sua cidade.

Como contratar:
1️⃣ Cadastre seu negócio no site
2️⃣ Abra a vaga: função, dia, horário e valor
3️⃣ Escolha pelo perfil e pela avaliação
4️⃣ Confirme o serviço no app e pronto

💰 Valor médio de uma diária: R$ 140 (função não técnica, 7 horas de jornada com 1 hora de intervalo, refeição opcional). A taxa de serviço já está embutida nesse valor.

✅ Tudo documentado: contrato e recibo em cada contratação
✅ Você sabe quem contrata: perfil, nota e histórico
✅ Cadastrar e abrir a primeira vaga é de graça. Só paga se contratar

👉 www.freelaservicos.com.br

Quer saber mais? Me chama no WhatsApp que eu te apresento: (11) 95090-3219

Rebeca
Comercial do Freela App`;

const codes = (errors: Array<{ code: string }>) => errors.map((e) => e.code);

describe("espelho das regras do editor (mesmas da API)", () => {
  it("texto da Rebeca: válido, 784 caracteres com {{1}}", () => {
    expect(validateMarketingBody(REBECA)).toEqual([]);
    const { text, paramOrder } = toPositional(REBECA);
    expect(codePointLength(text)).toBe(784);
    expect(paramOrder).toEqual(["primeiro_nome"]);
  });

  it("variável desconhecida é erro e a mensagem cita a variável", () => {
    const errors = validateMarketingBody("Oi {apelido}, tudo bem?");
    expect(codes(errors)).toEqual(["UNKNOWN_VARIABLE"]);
    expect(errors[0].message).toBe(
      "Variável desconhecida: {apelido}. Use {nome}, {primeiro_nome} ou {cidade}.",
    );
  });

  it("chave dupla ou solta é erro; {nome} simples segue válido (API 33ce7cdd)", () => {
    expect(codes(validateMarketingBody("Oi {{nome}}, tudo bem?"))).toEqual([
      "INVALID_BRACES",
    ]);
    expect(codes(validateMarketingBody("Oi {nome, tudo"))).toEqual([
      "INVALID_BRACES",
    ]);
    expect(codes(validateMarketingBody("Oi nome}, tudo bem?"))).toEqual([
      "INVALID_BRACES",
    ]);
    expect(validateMarketingBody("Oi {nome}, tudo bem?")).toEqual([]);
  });

  it("não começa nem termina com variável (o 'Sextou' do banco)", () => {
    expect(validateMarketingBody("{primeiro_nome}, sextou!")).toEqual([
      {
        code: "STARTS_WITH_VARIABLE",
        message:
          'O texto não pode começar com uma variável. Escreva algo antes, como "Oi, {primeiro_nome}!".',
      },
    ]);
    expect(validateMarketingBody("Vagas abertas em {cidade}")).toEqual([
      {
        code: "ENDS_WITH_VARIABLE",
        message:
          "O texto não pode terminar com uma variável. Escreva algo depois dela.",
      },
    ]);
    expect(validateMarketingBody("Oi {nome}.")).toEqual([]);
  });

  it("duas variáveis seguidas é erro; com texto no meio, não", () => {
    expect(
      codes(validateMarketingBody("Oi {nome} {cidade}, tudo bem?")),
    ).toEqual(["ADJACENT_VARIABLES"]);
    expect(validateMarketingBody("Oi {nome}, de {cidade}, tudo bem?")).toEqual(
      [],
    );
  });

  it("até 1024 caracteres contados já com {{n}}; vazio é erro", () => {
    const ok = `Oi ${"a".repeat(1021)}`;
    expect(validateMarketingBody(ok)).toEqual([]);
    expect(validateMarketingBody(`${ok}b`)).toEqual([
      {
        code: "BODY_TOO_LONG",
        message: "O texto tem 1025 caracteres; o máximo é 1024.",
      },
    ]);
    expect(
      validateMarketingBody(`Oi {primeiro_nome}, ${"a".repeat(1014)}`),
    ).toEqual([]);
    expect(codes(validateMarketingBody("   "))).toEqual(["BODY_EMPTY"]);
  });

  it("prévia e e-mail: preenche com Maria/Campinas e troca vazio por '-'", () => {
    expect(MARKETING_SAMPLE).toEqual({
      nome: "Maria Souza",
      primeiro_nome: "Maria",
      cidade: "Campinas",
    });
    expect(renderMarketingText("Oi, {primeiro_nome}! Vagas em {cidade}.")).toBe(
      "Oi, Maria! Vagas em Campinas.",
    );
    expect(
      renderMarketingText("Oi, {primeiro_nome}! {cidade} ok", {
        primeiro_nome: "Ana",
      }),
    ).toBe("Oi, Ana! - ok");
  });

  describe("botões", () => {
    it("link https e telefone BR passam; vão para a API no formato dela", () => {
      const draft = [
        {
          type: "PHONE" as const,
          text: "Falar com a Rebeca",
          value: "(11) 95090-3219",
        },
        {
          type: "URL" as const,
          text: "Cadastrar meu negócio",
          value: " https://www.freelaservicos.com.br ",
        },
      ];
      expect(validateMarketingButtons(draft)).toEqual([]);
      expect(toApiButtons(draft)).toEqual([
        { type: "PHONE", text: "Falar com a Rebeca", phone: "(11) 95090-3219" },
        {
          type: "URL",
          text: "Cadastrar meu negócio",
          url: "https://www.freelaservicos.com.br",
        },
      ]);
    });

    it("no máximo 2 e um de cada tipo", () => {
      const errors = validateMarketingButtons([
        { type: "URL", text: "A", value: "https://a.com" },
        { type: "URL", text: "B", value: "https://b.com" },
        { type: "PHONE", text: "C", value: "11950903219" },
      ]);
      expect(codes(errors)).toEqual([
        "TOO_MANY_BUTTONS",
        "DUPLICATE_BUTTON_TYPE",
      ]);
      expect(errors[0].message).toBe(
        'No máximo 2 botões (um link e um telefone). O "Não quero receber" entra sozinho.',
      );
    });

    it("texto de 1 a 25 e diferente de 'Não quero receber'", () => {
      expect(
        codes(
          validateMarketingButtons([
            { type: "URL", text: "x".repeat(26), value: "https://a.com" },
          ]),
        ),
      ).toEqual(["BUTTON_TEXT"]);
      expect(
        validateMarketingButtons([
          { type: "URL", text: "não quero receber", value: "https://a.com" },
        ]),
      ).toEqual([
        {
          code: "BUTTON_TEXT_RESERVED",
          message:
            'Botão 1: "Não quero receber" já entra sozinho como último botão.',
        },
      ]);
    });

    it("link sem https, com variável ou longo demais; telefone inválido", () => {
      for (const value of [
        "http://a.com",
        "www.a.com",
        "https://a.com/{nome}",
        `https://a.com/${"x".repeat(2000)}`,
      ]) {
        expect(
          codes(
            validateMarketingButtons([{ type: "URL", text: "Abrir", value }]),
          ),
        ).toEqual(["BUTTON_URL"]);
      }
      expect(
        validateMarketingButtons([
          { type: "PHONE", text: "Ligar", value: "123" },
        ]),
      ).toEqual([
        {
          code: "BUTTON_PHONE",
          message:
            "Botão 1: telefone inválido. Use DDD + número, ex.: (11) 95090-3219.",
        },
      ]);
    });

    it("da API para a tela e prévia na ordem do WhatsApp (link, ligar, sair)", () => {
      expect(
        fromApiButtons([
          {
            type: "PHONE",
            text: "Falar com a Rebeca",
            phone: "+5511950903219",
          },
          {
            type: "URL",
            text: "Cadastrar",
            url: "https://www.freelaservicos.com.br",
          },
        ]),
      ).toEqual([
        { type: "PHONE", text: "Falar com a Rebeca", value: "+5511950903219" },
        {
          type: "URL",
          text: "Cadastrar",
          value: "https://www.freelaservicos.com.br",
        },
      ]);
      expect(
        previewButtons([
          { type: "PHONE", text: "Falar com a Rebeca" },
          { type: "URL", text: "Cadastrar" },
        ]),
      ).toEqual([
        { type: "URL", text: "Cadastrar" },
        { type: "PHONE", text: "Falar com a Rebeca" },
        { type: "QUICK_REPLY", text: "Não quero receber" },
      ]);
    });
  });

  it("chip insere a variável no lugar do cursor (ou da seleção)", () => {
    expect(insertAt("Oi, ! Tudo bem?", 4, 4, "{primeiro_nome}")).toEqual({
      body: "Oi, {primeiro_nome}! Tudo bem?",
      cursor: 19,
    });
    expect(insertAt("Oi, fulano!", 4, 10, "{nome}")).toEqual({
      body: "Oi, {nome}!",
      cursor: 10,
    });
  });

  it("rótulos de situação (tela e frase)", () => {
    expect(MARKETING_STATUS_LABEL).toEqual({
      DRAFT: "Rascunho",
      PENDING: "Em análise",
      APPROVED: "Aprovado",
      REJECTED: "Recusado",
      PAUSED: "Pausado pela Meta",
      DISABLED: "Desativado pela Meta",
      ARCHIVED: "Arquivado",
    });
    expect(statusInSentence("PAUSED")).toBe("pausado pela Meta");
    expect(statusInSentence("PENDING")).toBe("em análise");
  });

  it("imagem: só a pasta de campanhas e png/jpg/jpeg (espelho da API)", () => {
    expect(marketingImageErrors(null)).toEqual([]);
    expect(marketingImageErrors("freela/images/campaigns/a.png")).toEqual([]);
    expect(marketingImageErrors("freela/images/campaigns/a.JPEG")).toEqual([]);
    for (const key of [
      "freela/images/campaigns/a.webp",
      "freela/images/campaigns/a",
      "freela/images/ads/a.png",
      "freela/images/campaigns/../a.png",
      "freela/images/campaigns/",
    ]) {
      expect(codes(marketingImageErrors(key))).toEqual(["IMAGE_NOT_ALLOWED"]);
    }
    expect(marketingImageErrors("x.webp")[0].message).toBe(
      "A imagem precisa ser PNG ou JPEG enviada pelo admin (WebP a Meta não aceita).",
    );
  });

  it("nome do arquivo sai do tipo real; webp não tem nome", () => {
    expect(imageFileNameForMime("image/jpeg", 1)).toBe("modelo-1.jpg");
    expect(imageFileNameForMime("image/png", 1)).toBe("modelo-1.png");
    expect(imageFileNameForMime("image/webp", 1)).toBeNull();
  });
});
