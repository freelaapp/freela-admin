export const REFERRAL_SHARE_PREFIX = "Faça seu cadastro no Freela Serviços pelo meu link:";

export function buildReferralShareText(link: string): string {
  return `${REFERRAL_SHARE_PREFIX} ${link}`;
}

/** Abre o WhatsApp com o texto pronto; o link inteiro vai codificado no `text`. */
export function buildWhatsAppShareUrl(link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(buildReferralShareText(link))}`;
}
