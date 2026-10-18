import type { MealValues } from "@/schemas/meal";

export type MealMedia = {
  id: string;
  mimeType: string;
  status: "failed" | "pending" | "ready";
};

export type Meal = MealValues & {
  id: string;
  media: MealMedia[];
  pregnancyId: string;
  updatedAt: string;
};

export type MealObservation = {
  body: string;
  counts: { logged: number; nauseaAfterNone: number; wouldEatAgain: number };
  ingredient: string;
};
