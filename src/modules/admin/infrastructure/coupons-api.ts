import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const couponsApi = axios.create({
  baseURL: `${API_BASE_URL}/v1/admin`,
  headers: {
    "Content-Type": "application/json",
  },
});

couponsApi.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("authUser");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        if (user.accessToken) {
          config.headers.Authorization = `Bearer ${user.accessToken}`;
        }
      } catch {
        // ignore
      }
    }
  }
  return config;
});

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
