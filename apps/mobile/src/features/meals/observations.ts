import type { Meal, MealObservation } from "@/features/meals/types";

function normalizedIngredient(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** Deterministic, descriptive counts only. This function makes no health inference. */
export function buildMealObservations(meals: readonly Meal[]): MealObservation[] {
  const counts = new Map<string, MealObservation["counts"]>();
  for (const meal of meals) {
    const unique = new Set(meal.ingredients.map(normalizedIngredient).filter(Boolean));
    for (const ingredient of unique) {
      const current = counts.get(ingredient) ?? {
        logged: 0,
        nauseaAfterNone: 0,
        wouldEatAgain: 0,
      };
      current.logged += 1;
      if (meal.nauseaAfter === "none") current.nauseaAfterNone += 1;
      if (meal.wouldEatAgain === true) current.wouldEatAgain += 1;
      counts.set(ingredient, current);
    }
  }

  return [...counts.entries()]
    .filter(([, value]) => value.logged >= 2)
    .sort(
      (left, right) =>
        right[1].logged - left[1].logged || left[0].localeCompare(right[0]),
    )
    .slice(0, 5)
    .map(([ingredient, value]) => ({
      body: `${ingredient} appeared in ${value.logged} logged meals. ${value.wouldEatAgain} were marked “would eat again”; ${value.nauseaAfterNone} had nausea after marked “none.”`,
      counts: value,
      ingredient,
    }));
}

export interface MealInsightProvider {
  readonly enabled: boolean;
  getInsights(meals: readonly Meal[]): Promise<readonly never[]>;
}

export const disabledMealInsightProvider: MealInsightProvider = {
  enabled: false,
  async getInsights() {
    return [];
  },
};
