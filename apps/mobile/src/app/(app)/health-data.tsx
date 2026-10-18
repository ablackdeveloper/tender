import { Screen } from "@/components/layout/screen";
import { AppText, SafetyCallout } from "@/components/ui";
import { getClientEnv } from "@/config/env";
import { HealthDataScreen } from "@/features/health/health-data-screen";

export default function HealthDataRoute() {
  if (!getClientEnv().EXPO_PUBLIC_HEALTH_DATA_ENABLED) {
    return (
      <Screen>
        <AppText accessibilityRole="header" variant="heading1">
          Health data
        </AppText>
        <SafetyCallout>
          Phone health connections are not enabled in this build. Flutterings has not
          asked for permission and has not read health data.
        </SafetyCallout>
      </Screen>
    );
  }
  return <HealthDataScreen />;
}
