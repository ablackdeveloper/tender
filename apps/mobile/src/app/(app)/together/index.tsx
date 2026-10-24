import { Screen } from "@/components/layout/screen";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useTogetherContext } from "@/features/together/queries";
import { TogetherScreen } from "@/features/together/together-screen";
import { useAuth } from "@/providers/auth-provider";

export default function TogetherRoute() {
  const { session } = useAuth();
  const context = useTogetherContext(session?.user.id ?? "");
  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading shared access" height={260} />
      </Screen>
    );
  if (context.isError)
    return (
      <Screen>
        <ErrorState
          actionLabel="Retry"
          description="Sharing records could not be authorized or loaded."
          onAction={() => void context.refetch()}
          title="Together unavailable"
        />
      </Screen>
    );
  if (!context.data)
    return (
      <Screen>
        <EmptyState
          title="No connected pregnancy"
          description="Complete pregnancy setup or accept a valid partner invitation."
        />
      </Screen>
    );
  return <TogetherScreen context={context.data} />;
}
