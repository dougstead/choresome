"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/client/fetcher";

export interface MeResponse {
  user: { id: string; email: string; name: string };
  householdId: number | null;
  role: "OWNER" | "MEMBER" | null;
  households: { id: number; name: string; role: "OWNER" | "MEMBER" }[];
}

export function useMe() {
  const { data, error, isLoading, mutate } = useSWR<MeResponse>("/api/me", fetcher);
  return { me: data, error, isLoading, mutate };
}
