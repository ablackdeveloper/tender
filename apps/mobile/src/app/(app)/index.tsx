import { useRouter } from "expo-router";

import { TodayScreen } from "@/features/today-journey/today-view";
import { useAuth } from "@/providers/auth-provider";
import { trackAnalytics } from "@/services/analytics/analytics";

export default function TodayRoute() {
  const { session } = useAuth();
  const router = useRouter();
  if (!session) return null;
  return (
    <TodayScreen
      onCheckIn={() => {
        trackAnalytics("product_action_selected", { action: "check_in" });
        router.push("/(app)/check-in");
      }}
      ownerId={session.user.id}
    />
  );
}
