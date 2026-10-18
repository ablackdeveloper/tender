import { queryOptions, useQuery } from "@tanstack/react-query";

import { checkInRepository } from "@/repositories/check-in-repository";

export const checkInKeys = {
  all: ["check-in"] as const,
  context: (ownerId: string, date: string) =>
    [...checkInKeys.all, "context", ownerId, date] as const,
  guidance: (flags: readonly string[]) =>
    [...checkInKeys.all, "guidance", [...flags].sort()] as const,
};

export const checkInQueries = {
  context: (ownerId: string, date: string) =>
    queryOptions({
      networkMode: "offlineFirst",
      queryFn: () => checkInRepository.getContext(ownerId, date),
      queryKey: checkInKeys.context(ownerId, date),
      staleTime: 30_000,
    }),
  guidance: (flags: readonly string[]) =>
    queryOptions({
      enabled: flags.length > 0,
      networkMode: "offlineFirst",
      queryFn: () => checkInRepository.getUrgentGuidance([...flags]),
      queryKey: checkInKeys.guidance(flags),
      staleTime: 5 * 60_000,
    }),
};

export function useCheckInContextQuery(ownerId: string, date: string) {
  return useQuery(checkInQueries.context(ownerId, date));
}

export function useUrgentGuidanceQuery(flags: readonly string[]) {
  return useQuery(checkInQueries.guidance(flags));
}
