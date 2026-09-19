/**
 * Textos prontos que o atalho de WhatsApp abre já escritos.
 *
 * Existem para a ação não ser só um texto a ticar: o suporte clica, o WhatsApp
 * abre com a mensagem da etapa, ele revisa e manda. É o que torna a área de
 * trabalho mais rápida que o caderninho que ela substitui.
 *
 * Só DADOS (template com marcadores), nunca função: assim o texto se revisa
 * lendo este arquivo, se testa sem DOM e um dia sobe para o backend sem
 * reescrever nada.
 */

/** Contexto disponível nos marcadores `{...}`. Campo vazio some do texto. */
export interface MensagemContexto {
  cargo: string;
  empresa: string;
  data: string;
  turno: string;
  freelancer: string;
  contato: string;
}

/**
 * `actionId` → template. Ação sem template cai no texto genérico da etapa:
 * melhor abrir o WhatsApp com algo revisável do que abrir vazio.
 */
export const MENSAGENS: Record<string, string> = {
  saudacao:
    "Olá, {contato}! Aqui é o suporte da Freela 👋\n\n" +
    "Obrigado por abrir a vaga de {cargo} para {data}, {turno}. " +
    "Eu vou acompanhar essa contratação de perto para garantir que você tenha a melhor experiência com o freela.\n\n" +
    "Qualquer coisa, é só me chamar por aqui.",

  chamar_base_reputacao:
    "Olá! Tudo bem? Aqui é o suporte da Freela.\n\n" +
    "Apareceu uma vaga de {cargo} em {empresa} no dia {data}, {turno}. " +
    "Lembrei de você pelo seu histórico na plataforma — tem disponibilidade?\n\n" +
    "Se tiver, se candidata pelo app que eu já sigo com o contratante.",

  alinhar_contratante_alcance:
    "Olá, {contato}! Sobre a vaga de {cargo} de {data} ({turno}):\n\n" +
    "Já divulgamos nos grupos e chamamos os freelas da base, mas ainda não fechamos candidato. " +
    "Para aumentar o alcance, consegue avaliar um ajuste no valor ou no horário? " +
    "Assim eu reativo a divulgação agora.",

  sugerir_candidatos:
    "Olá, {contato}! Conferi a disponibilidade dos candidatos da vaga de {cargo} ({data}, {turno}).\n\n" +
    "Estes estão confirmados e com boa avaliação na plataforma:\n" +
    "• \n• \n\n" +
    "Pode escolher direto no app que eu sigo com o restante.",

  realinhar_horario:
    "Olá, {contato}! Sobre a vaga de {cargo} de {data}:\n\n" +
    "O pagamento ainda não caiu e o horário está apertando. " +
    "Confirma para mim o horário de entrada e de saída, para eu alinhar com o freela antes de ele sair?",

  alinhar_deslocamento:
    "Olá, {freelancer}! Aqui é o suporte da Freela.\n\n" +
    "Você foi escolhido para a vaga de {cargo} em {empresa}, {data}, {turno}. " +
    "O pagamento do contratante está em confirmação — já pode ir se deslocando para não atrasar. " +
    "Qualquer mudança eu te aviso por aqui na hora.",

  cobrar_confirmacao:
    "Olá, {freelancer}! Sua vaga de {cargo} em {empresa} está paga e agendada para {data}, {turno}.\n\n" +
    "Falta só você CONFIRMAR a presença no app. Sem a confirmação a vaga volta para o mural e você perde o serviço.\n\n" +
    "Já confirmou? Me avisa que eu checo por aqui.",

  passar_regras:
    "Olá, {freelancer}! Alinhando a vaga de {cargo} em {empresa} — {data}, {turno}:\n\n" +
    "• Chegue com 15 minutos de antecedência (atraso é o que mais reprova freela)\n" +
    "• Vestimenta/uniforme: \n" +
    "• Onde entrar e com quem falar ao chegar: \n" +
    "• Faça o check-in no app assim que chegar\n\n" +
    "Qualquer dúvida me chama antes do dia.",

  confirmar_deslocamento:
    "Olá, {freelancer}! Sua vaga de {cargo} em {empresa} é hoje, {turno}.\n\n" +
    "Você já está a caminho? Me confirma por aqui, por favor.",

  checar_chegada:
    "Olá, {freelancer}! Você já chegou em {empresa}?\n\n" +
    "Não esquece de fazer o CHECK-IN no app — sem ele o serviço não fecha e o seu pagamento não é liberado.",

  orientar_conduta:
    "Ótimo, {freelancer}! Boa sorte no serviço 💪\n\n" +
    "Três coisas que fazem a diferença na sua avaliação:\n" +
    "• Siga as orientações e as regras do contratante\n" +
    "• Evite o celular durante o turno\n" +
    "• No fim, o contratante te avalia — nota boa é o que te traz mais vagas",

  checar_contratante_turno:
    "Olá, {contato}! Passando para saber se está tudo certo com o {freelancer} aí em {empresa}.\n\n" +
    "Qualquer ajuste, me fala agora que eu resolvo ainda durante o turno.",

  pedir_avaliacao_contratante:
    "Olá, {contato}! O serviço de {cargo} de {data} foi concluído. 🙌\n\n" +
    "Pode avaliar o {freelancer} no app? A avaliação é o que libera o pagamento dele e o que nos ajuda a te mandar sempre os melhores freelas.\n\n" +
    "Leva menos de um minuto.",

  pedir_avaliacao_freela:
    "Olá, {freelancer}! Obrigado pelo serviço em {empresa} 🙌\n\n" +
    "Pode avaliar o contratante no app? É assim que a gente sabe quais locais valem a pena para os próximos freelas.",
};

/** Texto de última instância, quando a ação não tem template próprio. */
const GENERICO =
  "Olá! Aqui é o suporte da Freela, sobre a vaga de {cargo} em {empresa} — {data}, {turno}.";

/**
 * Preenche os marcadores.
 *
 * Marcador sem valor é trocado por vazio em vez de ficar `{freelancer}` na tela:
 * mensagem com chave aparecendo é a que o suporte manda sem revisar e o cliente
 * recebe torta.
 */
export function montarMensagem(actionId: string, ctx: Partial<MensagemContexto>): string {
  const template = MENSAGENS[actionId] ?? GENERICO;
  return template.replace(/\{(\w+)\}/g, (_, chave: string) => {
    const valor = ctx[chave as keyof MensagemContexto];
    return valor ? valor : "";
  });
}

/**
 * Link do WhatsApp com o texto pronto.
 *
 * `wa.me` e não `api.whatsapp.com`: é o que abre o app no desktop e no celular
 * sem passar por uma página intermediária.
 *
 * O país entra pelo TAMANHO, não por prefixo: DDD 55 existe (Santa Maria/RS), e
 * "55987654321" é um celular de 11 dígitos sem país — testar `startsWith("55")`
 * o mandaria para o número errado. 10-11 dígitos = nacional, 12-13 = já tem o 55.
 */
export function whatsappLink(telefone: string | null | undefined, texto: string): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const comPais =
    digitos.length === 10 || digitos.length === 11
      ? `55${digitos}`
      : digitos.length === 12 || digitos.length === 13
        ? digitos
        : null;
  if (comPais === null) return null;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}
