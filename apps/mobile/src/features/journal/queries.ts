import { queryOptions, useQuery } from "@tanstack/react-query";

import { journalRepository } from "@/repositories/journal-repository";
import { journalDraftStorage } from "@/services/journal/journal-draft-storage";
export type MemoryFilters = {
  start?: string;
  end?: string;
  privacy?: string;
  tagId?: string;
};

export const journalKeys = {
  all: ["journal"] as const,
  context: (ownerId: string) => [...journalKeys.all, "context", ownerId] as const,
  entry: (ownerId: string, entryId: string) =>
    [...journalKeys.all, "entry", ownerId, entryId] as const,
  list: (ownerId: string, pregnancyId: string, search: string, favorites: boolean) =>
    [...journalKeys.all, "list", ownerId, pregnancyId, search, favorites] as const,
};

export const journalQueries = {
  context: (ownerId: string) =>
    queryOptions({
      networkMode: "offlineFirst",
      queryFn: async () => ({
        drafts: await journalDraftStorage.list(ownerId),
        pregnancyId: await journalRepository.getActivePregnancy(ownerId),
        tags: await journalRepository.listTags(ownerId),
      }),
      queryKey: journalKeys.context(ownerId),
    }),
  entry: (ownerId: string, entryId: string) =>
    queryOptions({
      enabled: entryId !== "new",
      networkMode: "offlineFirst",
      queryFn: () => journalRepository.getEntry(ownerId, entryId),
      queryKey: journalKeys.entry(ownerId, entryId),
    }),
  list: (
    ownerId: string,
    pregnancyId: string,
    search: string,
    favorites: boolean,
    filters?: MemoryFilters,
  ) =>
    queryOptions({
      enabled: Boolean(pregnancyId),
      networkMode: "offlineFirst",
      queryFn: () =>
        journalRepository.listEntries(ownerId, pregnancyId, {
          favoritesOnly: favorites,
          query: search,
          ...filters,
        }),
      queryKey: [...journalKeys.list(ownerId, pregnancyId, search, favorites), filters],
    }),
};

export function useJournalContext(ownerId: string) {
  return useQuery(journalQueries.context(ownerId));
}

export function useJournalEntries(
  ownerId: string,
  pregnancyId: string,
  search: string,
  favorites: boolean,
  filters?: MemoryFilters,
) {
  return useQuery(
    journalQueries.list(ownerId, pregnancyId, search, favorites, filters),
  );
}
