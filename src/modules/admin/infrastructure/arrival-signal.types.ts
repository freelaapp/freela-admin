/**
 * "Cheguei" (09/11/2026; `ARRIVAL_SIGNAL_ENABLED` na API): o último sinal de chegada do titular da
 * vaga, só leitura. Presente em `GET /v1/admins/attendance`, `prestart-checks`, `closed-vacancies`
 * e `cancelled-vacancies`. **Ausente** com a chave desligada (e na API antiga); `null` = a pessoa
 * ainda não mandou sinal. A API já devolve o texto pronto (`text`), em português.
 */
export interface AdminArrivalSignal {
  /** "Chegou às 17h32, a 80 m (app)"; "Sem leitura às 17h32: permissão de localização negada (app)". */
  text: string;
  source?: string | null;
  status?: string | null;
  approx?: boolean | null;
  distanceMeters?: number | null;
  permissionState?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  capturedAt?: string | null;
}
