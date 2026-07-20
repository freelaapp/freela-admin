import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

// Endpoints da carteira do contratante vivem sob /v1/admins (shared kernel),
// mesma base dos consultores.
const adminsRootApi = createAuthedClient("/v1/admins");

export type WalletEntryDirection = "CREDIT" | "DEBIT";
export type WalletEntryType =
  | "DEPOSIT"
  | "VACANCY_PAYMENT"
  | "REFUND"
  | "WITHDRAWAL"
  | "ADJUSTMENT";
export type WalletEntryStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface WalletSummary {
  totalHeldInCents: number;
  walletsCount: number;
  activeCount: number;
}

export interface WalletItem {
  userId: string;
  balanceInCents: number;
  status: string;
  name: string | null;
  email: string | null;
  createdAt: string;
}

export interface WalletListResult {
  summary: WalletSummary;
  items: WalletItem[];
  total: number;
  page: number;
  limit: number;
}

export interface WalletLedgerEntry {
  id: string;
  direction: WalletEntryDirection;
  type: WalletEntryType;
  amountInCents: number;
  balanceAfterInCents: number | null;
  status: WalletEntryStatus;
  description: string | null;
  vacancyId: string | null;
  createdAt: string;
}

export interface WalletLedger {
  balanceInCents: number;
  status: string;
  entries: WalletLedgerEntry[];
}

export interface WalletListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export interface AdjustWalletPayload {
  deltaInCents: number;
  reason: string;
}

export async function getAdminWallets(params: WalletListParams): Promise<WalletListResult> {
  const res = await adminsRootApi.get("/wallets", { params });
  return res.data.data;
}

export async function getAdminWalletLedger(userId: string): Promise<WalletLedger> {
  const res = await adminsRootApi.get(`/wallets/${userId}/ledger`);
  return res.data.data;
}

export async function adjustAdminWallet(
  userId: string,
  payload: AdjustWalletPayload,
): Promise<{ balanceInCents: number }> {
  const res = await adminsRootApi.post(`/wallets/${userId}/adjust`, payload);
  return res.data.data;
}

export default adminsRootApi;
