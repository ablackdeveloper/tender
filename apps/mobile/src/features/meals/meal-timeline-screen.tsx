import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  OfflineState,
  Skeleton,
} from "@/components/ui";
import { buildMealObservations } from "@/features/meals/observations";
import { useMealDrafts, useMeals } from "@/features/meals/queries";
import type { MealFilter } from "@/schemas/meal";
import { useNetworkStatus } from "@/providers/network-provider";
import { useTheme } from "@/theme/theme-provider";

const emptyFilter: MealFilter = {
  appetiteResponse: null,
  mealType: null,
  wouldEatAgain: null,
};
const labels: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export function MealTimelineScreen({
  ownerId,
  pregnancyId,
}: {
  ownerId: string;
  pregnancyId: string;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const { isOnline } = useNetworkStatus();
  const [filter, setFilter] = useState<MealFilter>(emptyFilter);
  const meals = useMeals(pregnancyId, filter);
  const drafts = useMealDrafts(ownerId);
  const observations = useMemo(
    () => buildMealObservations(meals.data ?? []),
    [meals.data],
  );
  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="heading1">Meals</AppText>
        <AppText color="muted">
          A private timeline of what you logged—without scores, calorie judgments,
          causal claims, or food-safety advice.
        </AppText>
      </View>
      {!isOnline ? (
        <OfflineState description="Showing cached meals and protected device drafts." />
      ) : null}
      <Button onPress={() => router.push(`/(app)/meals/${Crypto.randomUUID()}`)}>
        Log a meal
      </Button>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">Filters</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => (
            <Chip
              key={type}
              selected={filter.mealType === type}
              onPress={() =>
                setFilter((current) => ({
                  ...current,
                  mealType: current.mealType === type ? null : type,
                }))
              }
            >
              {labels[type]}
            </Chip>
          ))}
          <Chip
            selected={filter.appetiteResponse === "craving"}
            onPress={() =>
              setFilter((current) => ({
                ...current,
                appetiteResponse:
                  current.appetiteResponse === "craving" ? null : "craving",
              }))
            }
          >
            Craving
          </Chip>
          <Chip
            selected={filter.appetiteResponse === "aversion"}
            onPress={() =>
              setFilter((current) => ({
                ...current,
                appetiteResponse:
                  current.appetiteResponse === "aversion" ? null : "aversion",
              }))
            }
          >
            Aversion
          </Chip>
          <Chip
            selected={filter.wouldEatAgain === true}
            onPress={() =>
              setFilter((current) => ({
                ...current,
                wouldEatAgain: current.wouldEatAgain === true ? null : true,
              }))
            }
          >
            Would eat again
          </Chip>
        </View>
      </Card>
      {observations.length ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">What you logged</AppText>
          <AppText color="muted" variant="bodySmall">
            These are literal counts, not explanations or recommendations.
          </AppText>
          {observations.map((item) => (
            <AppText key={item.ingredient}>{item.body}</AppText>
          ))}
        </Card>
      ) : null}
      {drafts.data
        ?.filter((draft) => draft.status !== "synced")
        .map((draft) => (
          <Pressable
            key={draft.mealId}
            accessibilityLabel="Open protected meal draft"
            accessibilityRole="button"
            onPress={() => router.push(`/(app)/meals/${draft.mealId}`)}
          >
            <Card>
              <AppText variant="heading3">Meal draft</AppText>
              <AppText color="muted" variant="caption">
                {draft.status} · protected on this device
              </AppText>
            </Card>
          </Pressable>
        ))}
      <AppText variant="heading2">Timeline</AppText>
      {meals.isLoading ? (
        <Skeleton accessibilityLabel="Loading meal timeline" height={180} />
      ) : null}
      {meals.isError ? (
        <ErrorState
          title="Meals could not load"
          description="Your protected drafts remain on this device."
          actionLabel="Retry"
          onAction={() => void meals.refetch()}
        />
      ) : null}
      {meals.data?.length === 0 ? (
        <EmptyState
          title="No meals match"
          description="Change the filters or log something when you want to."
        />
      ) : null}
      {meals.data?.map((meal) => (
        <Card key={meal.id} style={{ gap: theme.spacing.xs }}>
          <AppText variant="heading3">
            {meal.mealType ? labels[meal.mealType] : "Meal"}
          </AppText>
          <AppText color="muted" variant="caption">
            {meal.occurredAt
              ? new Date(meal.occurredAt).toLocaleString()
              : "Time not supplied"}
            {meal.media.length
              ? ` · ${meal.media.length} photo${meal.media.length === 1 ? "" : "s"}`
              : ""}
          </AppText>
          {meal.ingredients.length ? (
            <AppText>{meal.ingredients.join(", ")}</AppText>
          ) : null}
          {meal.freeText ? <AppText numberOfLines={3}>{meal.freeText}</AppText> : null}
          <AppText color="muted" variant="bodySmall">
            {[
              meal.appetiteResponse?.replace("_", " "),
              meal.wouldEatAgain === true
                ? "would eat again"
                : meal.wouldEatAgain === false
                  ? "would not eat again"
                  : null,
            ]
              .filter(Boolean)
              .join(" · ") || "No optional observations"}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}
