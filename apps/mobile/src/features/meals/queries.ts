import { queryOptions, useQuery } from "@tanstack/react-query";

import { mealRepository } from "@/repositories/meal-repository";
import type { MealFilter } from "@/schemas/meal";
import { mealDraftStorage } from "@/services/meals/meal-draft-storage";

export const mealKeys = {
  all: ["meals"] as const,
  drafts: (ownerId: string) => [...mealKeys.all, "drafts", ownerId] as const,
  list: (pregnancyId: string, filter: MealFilter) =>
    [...mealKeys.all, "list", pregnancyId, filter] as const,
};

export function useMeals(pregnancyId: string, filter: MealFilter) {
  return useQuery(
    queryOptions({
      enabled: Boolean(pregnancyId),
      networkMode: "offlineFirst",
      queryFn: () => mealRepository.list(pregnancyId, filter),
      queryKey: mealKeys.list(pregnancyId, filter),
    }),
  );
}

export function useMealDrafts(ownerId: string) {
  return useQuery(
    queryOptions({
      enabled: Boolean(ownerId),
      networkMode: "always",
      queryFn: () => mealDraftStorage.list(ownerId),
      queryKey: mealKeys.drafts(ownerId),
    }),
  );
}
