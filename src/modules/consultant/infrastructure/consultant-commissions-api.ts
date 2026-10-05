import consultantApi from "./consultant-api";
import type { CommissionBalances, CommissionDashboard, StatementFilter, StatementPage } from "@/lib/commissions/types";

export async function getMyCommissionDashboard(range: { from?: string; to?: string }): Promise<CommissionDashboard> {
  const res = await consultantApi.get("/me/dashboard", { params: range });
  return res.data.data;
}

export async function getMyWallet(): Promise<CommissionBalances> {
  const res = await consultantApi.get("/me/wallet");
  return res.data.data;
}

export async function getMyStatement(filter: StatementFilter): Promise<StatementPage> {
  const res = await consultantApi.get("/me/wallet/statement", { params: filter });
  return res.data.data;
}
