import { Redirect } from "expo-router";

import { AppText } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";

export default function EntryRoute() {
  const { initialized, onboardingComplete, onboardingError, session } = useAuth();
  if (!initialized || (session && onboardingComplete === null)) {
    if (onboardingError) return null;
    return <AppText accessibilityLiveRegion="polite">Restoring your session…</AppText>;
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!onboardingComplete) return <Redirect href="/onboarding" />;
  return <Redirect href="/(app)" />;
}
