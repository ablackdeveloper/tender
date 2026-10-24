import { queryOptions, useQuery } from "@tanstack/react-query";

import { careRepository } from "@/repositories/care-repository";

export const careKeys = {
  all: ["care"] as const,
  context: (ownerId: string, pregnancyId: string) =>
    [...careKeys.all, "context", ownerId, pregnancyId] as const,
  help: (locale: string) => [...careKeys.all, "help", locale] as const,
  summary: (ownerId: string, pregnancyId: string, start: string, end: string) =>
    [...careKeys.all, "summary", ownerId, pregnancyId, start, end] as const,
};

export function useCareContext(ownerId: string, pregnancyId: string) {
  return useQuery(
    queryOptions({
      enabled: Boolean(ownerId && pregnancyId),
      networkMode: "offlineFirst",
      queryFn: () => careRepository.getContext(ownerId, pregnancyId),
      queryKey: careKeys.context(ownerId, pregnancyId),
    }),
  );
}

export function useProviderSummaryCandidates(
  ownerId: string,
  pregnancyId: string,
  start: string,
  end: string,
) {
  const validRange =
    /^\d{4}-\d{2}-\d{2}$/.test(start) &&
    /^\d{4}-\d{2}-\d{2}$/.test(end) &&
    start <= end;
  return useQuery(
    queryOptions({
      enabled: Boolean(ownerId && pregnancyId && validRange),
      networkMode: "offlineFirst",
      queryFn: () =>
        careRepository.getSummaryCandidates(ownerId, pregnancyId, start, end),
      queryKey: careKeys.summary(ownerId, pregnancyId, start, end),
    }),
  );
}

export function useHelpResources(locale: string, enabled: boolean) {
  return useQuery(
    queryOptions({
      enabled,
      networkMode: "offlineFirst",
      queryFn: () => careRepository.getHelpResources(locale),
      queryKey: careKeys.help(locale),
      staleTime: 5 * 60_000,
    }),
  );
}
