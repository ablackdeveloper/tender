import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import { CalendarField, localCalendarDate } from "@/components/ui/calendar-field";
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  OfflineState,
  Sheet,
  Skeleton,
} from "@/components/ui";
import { useJournalContext, useJournalEntries } from "@/features/journal/queries";
import { useMeals } from "@/features/meals/queries";
import { useTodayQuery } from "@/features/today-journey/queries";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { useTheme } from "@/theme/theme-provider";
import { journalRepository } from "@/repositories/journal-repository";
import type { MealFilter } from "@/schemas/meal";

const allMeals: MealFilter = {
  appetiteResponse: null,
  mealType: null,
  wouldEatAgain: null,
};
const mealLabels: Record<string, string> = {
  breakfast: "Breakfast",
  dinner: "Dinner",
  lunch: "Lunch",
  snack: "Snack",
};

export function JournalListScreen() {
  const { session } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();
  const router = useRouter();
  const ownerId = session?.user.id ?? "";
  const [search, setSearch] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [recordType, setRecordType] = useState("all");
  const [privacy, setPrivacy] = useState("");
  const [tagId, setTagId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [newTag, setNewTag] = useState("");
  const [tagSheetVisible, setTagSheetVisible] = useState(false);
  const context = useJournalContext(ownerId);
  const today = useTodayQuery(ownerId);
  const pregnancy = today.data?.pregnancy;
  const canResurface =
    !today.isError &&
    Boolean(
      pregnancy &&
      !pregnancy.compassionateMode &&
      ["active", "paused"].includes(pregnancy.lifecycleStatus),
    );
  const pregnancyId = context.data?.pregnancyId ?? "";
  const entries = useJournalEntries(ownerId, pregnancyId, search, favorites, {
    start,
    end,
    privacy,
    tagId,
  });
  const meals = useMeals(pregnancyId, allMeals);

  if (context.isLoading) {
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading journal" height={120} />
      </Screen>
    );
  }
  if (context.isError) {
    return (
      <Screen>
        <ErrorState
          actionLabel="Retry"
          description="Your protected device drafts remain available."
          onAction={() => void context.refetch()}
          title="Memories could not load"
        />
      </Screen>
    );
  }
  if (!pregnancyId) {
    return (
      <Screen>
        <EmptyState
          title="Memories unavailable"
          description="Complete pregnancy setup before creating memories."
        />
      </Screen>
    );
  }

  const memoryMoments = canResurface
    ? (entries.data?.filter((entry) => entry.resurfaceAllowed).slice(0, 3) ?? [])
    : [];
  const timelineItems = [
    ...(entries.data ?? []).map((entry) => ({
      at: entry.entryAt,
      entry,
      id: entry.id,
      type: "entry" as const,
    })),
    ...(!favorites
      ? (meals.data ?? []).map((meal) => ({
          at: meal.occurredAt ?? meal.updatedAt,
          id: meal.id,
          meal,
          type: "meal" as const,
        }))
      : []),
  ]
    .filter((item) => {
      const date = localCalendarDate(new Date(item.at));
      if ((start && date < start) || (end && date > end)) return false;
      if (recordType === "memory" && item.type !== "entry") return false;
      if (recordType === "meal" && item.type !== "meal") return false;
      if (item.type === "meal" && (tagId || privacy === "shared")) return false;
      if (
        item.type === "meal" &&
        search.trim() &&
        ![item.meal.freeText, ...item.meal.ingredients]
          .join(" ")
          .toLowerCase()
          .includes(search.trim().toLowerCase())
      )
        return false;
      return true;
    })
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
  const hasFilters = Boolean(
    search || favorites || recordType !== "all" || privacy || tagId || start || end,
  );

  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="heading1">Memories</AppText>
        <AppText color="muted">
          Private notes, photos, and voice moments. You choose what returns and what is
          shared.
        </AppText>
      </View>
      {!isOnline ? (
        <OfflineState description="Showing cached memories and protected device drafts." />
      ) : null}
      {canResurface ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText color="muted" variant="label">
            THIS WEEK&apos;S MOMENTS
          </AppText>
          {memoryMoments.length ? (
            memoryMoments.map((entry) => (
              <Pressable
                key={entry.id}
                accessibilityLabel={`Open memory ${entry.title || "untitled"}`}
                accessibilityRole="button"
                onPress={() => router.push(`/(app)/journal/${entry.id}`)}
              >
                <View style={{ gap: theme.spacing.xxs }}>
                  <AppText variant="heading3">
                    {entry.title || "A private moment"}
                  </AppText>
                  <AppText color="muted" numberOfLines={2} variant="bodySmall">
                    {entry.body}
                  </AppText>
                </View>
              </Pressable>
            ))
          ) : (
            <AppText color="muted" variant="bodySmall">
              Nothing is selected for resurfacing. A memory stays private and does not
              return here unless you opt in.
            </AppText>
          )}
          {memoryMoments.length ? (
            <Button
              onPress={() => router.push("/(app)/memory-capsule" as Href)}
              variant="ghost"
            >
              Review this week&apos;s capsule
            </Button>
          ) : null}
        </Card>
      ) : null}
      <Button onPress={() => router.push("/(app)/journal/new")} variant="secondary">
        Add a memory
      </Button>
      <Button variant="ghost" onPress={() => setFiltersVisible(true)}>
        {hasFilters ? "Filters active" : "Filter memories"}
      </Button>
      <Sheet
        title="Filter memories"
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
      >
        <Field
          accessibilityLabel="Search memories"
          label="Search"
          onChangeText={setSearch}
          placeholder="Search titles and memories"
          returnKeyType="search"
          value={search}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <Chip onPress={() => setFavorites((value) => !value)} selected={favorites}>
            Favorites
          </Chip>
        </View>
        <AppText variant="label">Type</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {[
            ["all", "All types"],
            ["memory", "Memories only"],
            ["meal", "Meals only"],
          ].map(([value, label]) => (
            <Chip
              key={value}
              selected={recordType === value}
              onPress={() => setRecordType(value!)}
            >
              {label}
            </Chip>
          ))}
        </View>
        <AppText variant="label">Privacy</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {[
            ["", "Any privacy"],
            ["private", "Private only"],
            ["shared", "Shared by grant"],
          ].map(([value, label]) => (
            <Chip
              key={value}
              selected={privacy === value}
              onPress={() => setPrivacy(value!)}
            >
              {label}
            </Chip>
          ))}
        </View>
        <AppText variant="label">Tag</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          <Chip selected={!tagId} onPress={() => setTagId("")}>
            Any tag
          </Chip>
          {context.data?.tags.map((tag) => (
            <Chip
              key={tag.id}
              selected={tagId === tag.id}
              onPress={() => setTagId(tag.id)}
            >
              {tag.name}
            </Chip>
          ))}
        </View>
        <CalendarField label="From date" optional value={start} onChange={setStart} />
        <CalendarField label="Through date" optional value={end} onChange={setEnd} />
        {start && end && start > end ? (
          <AppText color="danger">
            Choose an end date on or after the start date.
          </AppText>
        ) : null}
        <Button
          disabled={Boolean(start && end && start > end)}
          onPress={() => setFiltersVisible(false)}
        >
          Show results
        </Button>
        <Button
          variant="ghost"
          onPress={() => {
            setSearch("");
            setFavorites(false);
            setRecordType("all");
            setPrivacy("");
            setTagId("");
            setStart("");
            setEnd("");
          }}
        >
          Clear filters
        </Button>
      </Sheet>
      <Button onPress={() => setTagSheetVisible(true)} variant="ghost">
        Manage tags
      </Button>
      {context.data?.drafts
        .filter((draft) => draft.status !== "saved")
        .map((draft) => (
          <Pressable
            key={draft.entryId}
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/journal/${draft.entryId}`)}
          >
            <Card>
              <AppText variant="heading3">{draft.title || "Untitled draft"}</AppText>
              <AppText color="muted" variant="bodySmall">
                Protected device draft · {draft.status}
              </AppText>
            </Card>
          </Pressable>
        ))}
      {entries.isLoading || meals.isLoading ? (
        <Skeleton accessibilityLabel="Loading memories" height={160} />
      ) : null}
      {entries.isError || meals.isError ? (
        <ErrorState
          actionLabel="Retry"
          description="Try again when your connection is available."
          onAction={() => void Promise.all([entries.refetch(), meals.refetch()])}
          title="Memories could not load"
        />
      ) : null}
      {timelineItems.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No matching memories" : "No memories yet"}
          description={
            favorites
              ? "No favorites match this search."
              : "Save a private memory when you are ready."
          }
        />
      ) : null}
      {timelineItems.map((item) =>
        item.type === "entry" ? (
          <Pressable
            key={`entry-${item.id}`}
            accessibilityLabel={`Open ${item.entry.title || "untitled entry"}`}
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/journal/${item.entry.id}`)}
          >
            <Card>
              <AppText variant="heading3">
                {item.entry.title || "Untitled entry"}
              </AppText>
              <AppText numberOfLines={2}>{item.entry.body}</AppText>
              <AppText color="muted" variant="caption">
                {item.entry.privacy === "private" ? "Private" : "Shared by grant"}
                {item.entry.isFavorite ? " · Favorite" : ""}
                {item.entry.resurfaceAllowed
                  ? canResurface
                    ? " · May resurface"
                    : " · Suggestions paused"
                  : ""}
              </AppText>
            </Card>
          </Pressable>
        ) : (
          <Pressable
            key={`meal-${item.id}`}
            accessibilityLabel="Open private meal memory"
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/meals/${item.meal.id}`)}
          >
            <Card>
              <AppText variant="heading3">
                {item.meal.mealType ? mealLabels[item.meal.mealType] : "Meal memory"}
              </AppText>
              <AppText numberOfLines={2}>
                {item.meal.ingredients.join(", ") ||
                  item.meal.freeText ||
                  "Private meal record"}
              </AppText>
              <AppText color="muted" variant="caption">
                Private · Meal
                {item.meal.media.length
                  ? ` · ${item.meal.media.length} photo${item.meal.media.length === 1 ? "" : "s"}`
                  : ""}
              </AppText>
            </Card>
          </Pressable>
        ),
      )}
      <Sheet
        onClose={() => setTagSheetVisible(false)}
        title="Manage journal tags"
        visible={tagSheetVisible}
      >
        <Field label="New tag" maxLength={60} onChangeText={setNewTag} value={newTag} />
        <Button
          disabled={!newTag.trim()}
          onPress={() =>
            void journalRepository.createTag(ownerId, newTag).then(() => {
              setNewTag("");
              setTagSheetVisible(false);
              return context.refetch();
            })
          }
          variant="secondary"
        >
          Add tag
        </Button>
      </Sheet>
    </Screen>
  );
}
