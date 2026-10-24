import { useRouter } from "expo-router";

import { Screen } from "@/components/layout/screen";
import { ErrorState, Skeleton } from "@/components/ui";
import { CheckInForm } from "@/features/check-in/check-in-screen";
import { useTodayQuery } from "@/features/today-journey/queries";
import { useAuth } from "@/providers/auth-provider";

export default function CheckInRoute() {
  const router = useRouter();
  const { session } = useAuth();
  const today = useTodayQuery(session?.user.id ?? "");
  if (!session) return null;
  if (today.isPending) {
    return (
      <Screen>
        <Skeleton height={48} width="60%" />
        <Skeleton height={180} />
      </Screen>
    );
  }
  if (!today.data) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <ErrorState
          actionLabel="Go back"
          description="Flutterings could not resolve today in your pregnancy timezone."
          onAction={() => router.back()}
          title="Check-in unavailable"
        />
      </Screen>
    );
  }
  return (
    <CheckInForm
      checkinDate={today.data.dating.asOfDate}
      onDone={() => router.back()}
      ownerId={session.user.id}
    />
  );
}
