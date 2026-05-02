"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminFeedbacks } from "../infrastructure/admin-api";

export function useAdminFeedbacks() {
  return useQuery({
    queryKey: ["admin", "feedbacks"],
    queryFn: getAdminFeedbacks,
    staleTime: 30000,
  });
}
