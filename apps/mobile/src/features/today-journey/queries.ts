import { queryOptions, useQuery } from "@tanstack/react-query";

import { todayJourneyRepository } from "@/repositories/today-journey-repository";

export const todayJourneyKeys = {
  all: ["today-journey"] as const,
  journey: (ownerId: string) => [...todayJourneyKeys.all, "journey", ownerId] as const,
  today: (ownerId: string) => [...todayJourneyKeys.all, "today", ownerId] as const,
};

export const todayJourneyQueries = {
  journey: (ownerId: string) =>
    queryOptions({
      networkMode: "offlineFirst",
      queryFn: () => todayJourneyRepository.getJourney(ownerId),
      queryKey: todayJourneyKeys.journey(ownerId),
      staleTime: 5 * 60_000,
    }),
  today: (ownerId: string) =>
    queryOptions({
      networkMode: "offlineFirst",
      queryFn: () => todayJourneyRepository.getToday(ownerId),
      queryKey: todayJourneyKeys.today(ownerId),
      staleTime: 60_000,
    }),
};

export function useTodayQuery(ownerId: string) {
  return useQuery(todayJourneyQueries.today(ownerId));
}

export function useJourneyQuery(ownerId: string) {
  return useQuery(todayJourneyQueries.journey(ownerId));
}
