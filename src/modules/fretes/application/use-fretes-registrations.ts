"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getCompanyRegistrations,
  getDriverRegistrations,
} from "../infrastructure/fretes-api";

export function useDriverRegistrations() {
  return useQuery({
    queryKey: ["fretes", "registrations", "drivers"],
    queryFn: () => getDriverRegistrations(),
    staleTime: 30_000,
  });
}

export function useCompanyRegistrations() {
  return useQuery({
    queryKey: ["fretes", "registrations", "companies"],
    queryFn: () => getCompanyRegistrations(),
    staleTime: 30_000,
  });
}
