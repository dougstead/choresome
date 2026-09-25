"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/client/fetcher";
import type { AreaDto, MemberDto, TaskDto } from "@/lib/api/types";
import type { HouseholdSettings } from "@/lib/services/settings-service";

export function useMembers(includeInactive = false) {
  const { data, error, isLoading } = useSWR<{ members: MemberDto[] }>(
    `/api/members${includeInactive ? "?includeInactive=true" : ""}`,
    fetcher
  );
  return { members: data?.members ?? [], error, isLoading };
}

export function useAreas(includeArchived = false) {
  const { data, error, isLoading } = useSWR<{ areas: AreaDto[] }>(
    `/api/areas${includeArchived ? "?includeArchived=true" : ""}`,
    fetcher
  );
  return { areas: data?.areas ?? [], error, isLoading };
}

export function useTasks(options: { areaId?: string; includeArchived?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.areaId) params.set("areaId", options.areaId);
  if (options.includeArchived) params.set("includeArchived", "true");
  const query = params.toString();
  const { data, error, isLoading } = useSWR<{ tasks: TaskDto[] }>(`/api/tasks${query ? `?${query}` : ""}`, fetcher);
  return { tasks: data?.tasks ?? [], error, isLoading };
}

export function useSettings() {
  const { data, error, isLoading } = useSWR<{ settings: HouseholdSettings }>("/api/settings", fetcher);
  return { settings: data?.settings, error, isLoading };
}
