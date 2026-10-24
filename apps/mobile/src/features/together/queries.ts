import { queryOptions, useQuery } from "@tanstack/react-query";

import { togetherRepository } from "@/repositories/together-repository";

export const togetherKeys = {
  all: ["together"] as const,
  context: (userId: string) => ["together", "context", userId] as const,
};

export function useTogetherContext(userId: string) {
  return useQuery(
    queryOptions({
      enabled: Boolean(userId),
      networkMode: "offlineFirst",
      queryFn: () => togetherRepository.getContext(userId),
      queryKey: togetherKeys.context(userId),
    }),
  );
}
