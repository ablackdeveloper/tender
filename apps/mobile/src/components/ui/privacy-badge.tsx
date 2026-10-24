import { View } from "react-native";

import { AppText } from "@/components/ui/app-text";
import { useTheme } from "@/theme/theme-provider";

export type PrivacyLevel = "private" | "shared" | "care-team";

export type PrivacyBadgeProps = {
  level?: PrivacyLevel;
};

const labels: Record<PrivacyLevel, string> = {
  private: "Private",
  shared: "Shared",
  "care-team": "Care team",
};

export function PrivacyBadge({ level = "private" }: PrivacyBadgeProps) {
  const { theme } = useTheme();
  const palette = {
    private: [theme.colors.primary, theme.colors.onPrimary],
    shared: [theme.colors.secondary, theme.colors.onSecondary],
    "care-team": [theme.colors.accent, theme.colors.onAccent],
  }[level];
  const label = labels[level];

  return (
    <View
      accessibilityLabel={`Privacy: ${label}`}
      accessibilityRole="text"
      style={{
        alignSelf: "flex-start",
        backgroundColor: palette[0],
        borderRadius: theme.radii.full,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
      }}
    >
      <AppText aria-hidden style={{ color: palette[1] }} variant="caption">
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}
