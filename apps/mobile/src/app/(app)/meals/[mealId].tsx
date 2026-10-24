import { useLocalSearchParams } from "expo-router";
import { z } from "zod";
import { Screen } from "@/components/layout/screen";
import { ErrorState, Skeleton } from "@/components/ui";
import { MealEditorScreen } from "@/features/meals/meal-editor-screen";
import { useJournalContext } from "@/features/journal/queries";
import { useAuth } from "@/providers/auth-provider";

export default function MealEditorRoute() {
  const { mealId } = useLocalSearchParams<{ mealId: string }>();
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const context = useJournalContext(ownerId);
  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading meal context" height={180} />
      </Screen>
    );
  if (
    !z.uuid().safeParse(mealId).success ||
    context.isError ||
    !context.data?.pregnancyId
  )
    return (
      <Screen>
        <ErrorState
          title="Meal unavailable"
          description="The meal draft could not be opened."
        />
      </Screen>
    );
  return (
    <MealEditorScreen
      mealId={mealId}
      ownerId={ownerId}
      pregnancyId={context.data.pregnancyId}
    />
  );
}
