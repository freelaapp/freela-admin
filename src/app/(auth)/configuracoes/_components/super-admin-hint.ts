/**
 * Dica dos controles travados do card "WhatsApp oficial (Meta)": a API só
 * aceita mudança de super-admin em `/v1/admins/notification-events` (o GET
 * segue aberto, por isso o card continua visível em modo leitura).
 */
export const SUPER_ADMIN_ONLY_HINT = "Só super administradores podem mudar.";
