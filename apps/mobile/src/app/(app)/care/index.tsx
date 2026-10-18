import { Screen } from "@/components/layout/screen";
import { ErrorState, Skeleton } from "@/components/ui";
import { CareScreen } from "@/features/care/care-screen";
import { useJournalContext } from "@/features/journal/queries";
import { useAuth } from "@/providers/auth-provider";

export default function CareRoute() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const context = useJournalContext(ownerId);
  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading care context" height={200} />
      </Screen>
    );
  if (context.isError || !context.data?.pregnancyId)
    return (
      <Screen>
        <ErrorState
          title="Care records unavailable"
          description="Complete pregnancy setup or retry when connected."
        />
      </Screen>
    );
  return <CareScreen ownerId={ownerId} pregnancyId={context.data.pregnancyId} />;
}
