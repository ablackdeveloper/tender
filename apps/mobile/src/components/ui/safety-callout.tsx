import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { AppText } from "@/components/ui/app-text";
import { useTheme } from "@/theme/theme-provider";

export type SafetyCalloutProps = PropsWithChildren<{
  title?: string;
  urgent?: boolean;
}>;

export function SafetyCallout({
  children,
  title = "Health and safety",
  urgent = false,
}: SafetyCalloutProps) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityRole={urgent ? "alert" : "summary"}
      style={{
        backgroundColor: urgent
          ? theme.colors.dangerSurface
          : theme.colors.warningSurface,
        borderColor: urgent ? theme.colors.danger : theme.colors.warning,
        borderLeftWidth: 4,
        borderRadius: theme.radii.compact,
        gap: theme.spacing.xs,
        padding: theme.spacing.md,
      }}
    >
      <AppText color={urgent ? "danger" : "warning"} variant="heading3">
        {title}
      </AppText>
      <AppText variant="bodySmall">{children}</AppText>
    </View>
  );
}
