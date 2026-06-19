import { createAuthedClient } from "@/modules/shared/infrastructure/authed-client";

const couponsApi = createAuthedClient("/v1/admin");

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type CouponDiscountType = "PERCENT" | "FIXED";

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  percentOff: number | null;
  amountOffInCents: number | null;
  contractorUserId: string;
  singleUse: boolean;
  active: boolean;
  expiresAt: string | null;
  redeemedAt: string | null;
  redeemedVacancyId: string | null;
  createdAt: string;
}

export interface CreateCouponInput {
  code: string;
  discountType: CouponDiscountType;
  percentOff?: number;
  amountOffInCents?: number;
  contractorUserId: string;
  singleUse?: boolean;
  expiresAt?: string | null;
}

// ─── Funções ────────────────────────────────────────────────────────────────

export async function getCoupons(): Promise<Coupon[]> {
  const res = await couponsApi.get("/coupons");
  return res.data.data;
}

export async function createCoupon(dto: CreateCouponInput): Promise<Coupon> {
  const res = await couponsApi.post("/coupons", dto);
  return res.data.data;
}

export async function deactivateCoupon(id: string): Promise<Coupon> {
  const res = await couponsApi.delete(`/coupons/${id}`);
  return res.data.data;
}
