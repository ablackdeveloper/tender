import { Screen } from "@/components/layout/screen";
import { ErrorState, Skeleton } from "@/components/ui";
import { ProviderSummaryScreen } from "@/features/care/provider-summary-screen";
import { useJournalContext } from "@/features/journal/queries";
import { useAuth } from "@/providers/auth-provider";

export default function ProviderSummaryRoute() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const context = useJournalContext(ownerId);
  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading provider summary context" height={200} />
      </Screen>
    );
  if (context.isError || !context.data?.pregnancyId)
    return (
      <Screen>
        <ErrorState
          title="Provider summary unavailable"
          description="Complete pregnancy setup or retry when connected."
        />
      </Screen>
    );
  return (
    <ProviderSummaryScreen ownerId={ownerId} pregnancyId={context.data.pregnancyId} />
  );
}
