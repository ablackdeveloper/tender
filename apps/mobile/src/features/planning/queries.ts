import { queryOptions, useQuery } from "@tanstack/react-query";

import { planningRepository } from "@/repositories/planning-repository";

export const planningKeys = {
  all: ["planning"] as const,
  context: (pregnancyId: string) => ["planning", pregnancyId] as const,
};

export function usePlanningContext(pregnancyId: string) {
  return useQuery(
    queryOptions({
      enabled: Boolean(pregnancyId),
      networkMode: "offlineFirst",
      queryFn: () => planningRepository.list(pregnancyId),
      queryKey: planningKeys.context(pregnancyId),
    }),
  );
}
