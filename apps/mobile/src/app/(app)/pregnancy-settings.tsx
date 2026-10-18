import { Screen } from "@/components/layout/screen";
import { AppText, Button, ErrorState, Skeleton } from "@/components/ui";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pregnancyLifecycleRepository } from "@/repositories/pregnancy-lifecycle-repository";
import { PregnancyLifecycleScreen } from "@/features/pregnancy-lifecycle/pregnancy-lifecycle-screen";
import { useTodayQuery } from "@/features/today-journey/queries";
import { useAuth } from "@/providers/auth-provider";

export default function PregnancySettingsRoute() {
  const { session } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const query = useTodayQuery(session?.user.id ?? "");
  if (query.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading pregnancy settings" height={260} />
      </Screen>
    );
  if (query.isError)
    return (
      <Screen>
        <ErrorState
          title="Pregnancy settings unavailable"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      </Screen>
    );
  if (!query.data)
    return (
      <Screen>
        <AppText variant="heading1">Start your private record</AppText>
        <AppText>
          A due date is optional. Start here to save memories and care details.
        </AppText>
        {error ? (
          <ErrorState
            title="Record not created"
            description="Check your connection and try again."
          />
        ) : null}
        <Button
          loading={busy}
          onPress={() => {
            setBusy(true);
            setError(false);
            void pregnancyLifecycleRepository
              .createUndated(session?.user.id ?? "")
              .then(() => client.invalidateQueries())
              .catch(() => setError(true))
              .finally(() => setBusy(false));
          }}
        >
          Start without a due date
        </Button>
      </Screen>
    );
  return <PregnancyLifecycleScreen pregnancy={query.data.pregnancy} />;
}
