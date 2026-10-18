import { Linking, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import { AppText, Button, SafetyCallout, useToast } from "@/components/ui";
import type { UrgentGuidance } from "@/features/check-in/types";
import { useTheme } from "@/theme/theme-provider";

export function SafetyGuidance({
  careTeamPhone,
  guidances,
  onDismiss,
}: {
  careTeamPhone: string | null;
  guidances: UrgentGuidance[];
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const toast = useToast();
  return (
    <Screen contentContainerStyle={{ gap: theme.spacing.lg }}>
      <AppText accessibilityRole="header" variant="heading1">
        Contact a qualified care professional now
      </AppText>
      {guidances.map((guidance) => (
        <View key={guidance.id} style={{ gap: theme.spacing.sm }}>
          <AppText accessibilityRole="header" variant="heading2">
            {guidance.title}
          </AppText>
          <AppText>{guidance.body}</AppText>
          <Button
            onPress={() => void Linking.openURL(guidance.emergencyActionUri)}
            variant="danger"
          >
            {guidance.emergencyActionLabel}
          </Button>
          <Button
            onPress={() => {
              if (careTeamPhone) {
                void Linking.openURL(
                  `tel:${careTeamPhone.replace(/[^0-9+*#-]/gu, "")}`,
                );
              } else {
                toast.show({
                  message:
                    "Your care-team number is not saved. Use your clinic's official contact information.",
                });
              }
            }}
            variant="secondary"
          >
            {guidance.careTeamActionLabel}
          </Button>
        </View>
      ))}
      <SafetyCallout urgent>
        Flutterings cannot assess what is happening, diagnose a condition, rank urgency,
        or tell you that you are safe. A qualified care professional or emergency
        service must make that assessment.
      </SafetyCallout>
      <Button onPress={onDismiss} variant="ghost">
        Return to check-in
      </Button>
    </Screen>
  );
}
