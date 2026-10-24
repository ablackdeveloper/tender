import Today from "@/app/(app)/index";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import Planning from "@/app/(app)/planning";
import Journey from "@/app/(app)/journey";
import Care from "@/app/(app)/care/index";
import Questions from "@/app/(app)/appointment-question";
import Recovery from "@/app/(app)/recovery";
import Together from "@/app/(app)/together/index";
import Reflection from "@/app/(app)/journal/[entryId]";
import Memories from "@/app/(app)/memories";
import Settings from "@/app/(app)/pregnancy-settings";
import Summary from "@/app/(app)/care/summary";
import Notifications from "@/app/(app)/notification-settings";
import Privacy from "@/app/(app)/privacy-data";
import Health from "@/app/(app)/health-data";
import CheckIn from "@/app/(app)/check-in";
import Meals from "@/app/(app)/meals/index";
import Meal from "@/app/(app)/meals/[mealId]";
import Capsule from "@/app/(app)/memory-capsule";
import Help from "@/app/get-help";
import { Screen } from "@/components/layout/screen";
import { EmptyState } from "@/components/ui";
import { navigate } from "./navigation";
export const appScreens = {
  onboarding: OnboardingFlow,
  today: Today,
  planning: Planning,
  journey: Journey,
  care: Care,
  questions: Questions,
  recovery: Recovery,
  together: Together,
  reflection: Reflection,
  memories: Memories,
  settings: Settings,
  summary: Summary,
  notifications: Notifications,
  privacy: Privacy,
  health: Health,
  checkin: CheckIn,
  meals: Meals,
  meal: Meal,
  capsule: Capsule,
  help: Help,
};
export function AppScreen({ screen }: { screen: string }) {
  const Component = appScreens[screen as keyof typeof appScreens];
  return Component ? (
    <Component />
  ) : (
    <Screen>
      <EmptyState
        title="Unknown preview link"
        description="Return to Today to continue."
        actionLabel="Open Today"
        onAction={() => navigate("/(app)")}
      />
    </Screen>
  );
}
