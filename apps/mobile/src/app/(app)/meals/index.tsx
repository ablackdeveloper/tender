import { Screen } from "@/components/layout/screen";
import { ErrorState, Skeleton } from "@/components/ui";
import { MealTimelineScreen } from "@/features/meals/meal-timeline-screen";
import { useJournalContext } from "@/features/journal/queries";
import { useAuth } from "@/providers/auth-provider";

export default function MealsRoute() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const context = useJournalContext(ownerId);
  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading meal context" height={180} />
      </Screen>
    );
  if (context.isError || !context.data?.pregnancyId)
    return (
      <Screen>
        <ErrorState
          title="Meals unavailable"
          description="Complete pregnancy setup or retry when online."
        />
      </Screen>
    );
  return (
    <MealTimelineScreen ownerId={ownerId} pregnancyId={context.data.pregnancyId} />
  );
}
