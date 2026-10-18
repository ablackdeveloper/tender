import type { z } from "zod";
import {
  appetiteResponseSchema,
  enjoymentSchema,
  mealTypeSchema,
  nauseaLevelSchema,
} from "@/schemas/meal";
export type AppetiteResponse = z.infer<typeof appetiteResponseSchema>;
export type Enjoyment = z.infer<typeof enjoymentSchema>;
export type MealType = z.infer<typeof mealTypeSchema>;
export type NauseaLevel = z.infer<typeof nauseaLevelSchema>;
