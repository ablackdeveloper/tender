import { Screen } from "@/components/layout/screen";
import { ErrorState, Skeleton } from "@/components/ui";
import { GetHelpScreen } from "@/features/care/get-help-screen";
import { useJournalContext } from "@/features/journal/queries";
import { useAuth } from "@/providers/auth-provider";

export default function GetHelpRoute() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const context = useJournalContext(ownerId);
  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading help context" height={200} />
      </Screen>
    );
  if (!session)
    return (
      <Screen>
        <ErrorState
          title="Sign in required"
          description="Configured contacts and approved localized help content are available after sign-in."
        />
      </Screen>
    );
  return (
    <GetHelpScreen ownerId={ownerId} pregnancyId={context.data?.pregnancyId ?? ""} />
  );
}
