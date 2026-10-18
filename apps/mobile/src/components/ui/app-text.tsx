import type { ComponentProps } from "react";
import { Text } from "react-native";

import { useTheme } from "@/theme/theme-provider";
import type { TextVariant } from "@/theme/tokens";

export type AppTextProps = ComponentProps<typeof Text> & {
  color?: "default" | "muted" | "danger" | "success" | "warning";
  variant?: TextVariant;
};

export function AppText({
  allowFontScaling = true,
  color = "default",
  maxFontSizeMultiplier,
  style,
  variant = "body",
  ...props
}: AppTextProps) {
  const { theme } = useTheme();
  const textColor = {
    default: theme.colors.text,
    muted: theme.colors.textMuted,
    danger: theme.colors.danger,
    success: theme.colors.success,
    warning: theme.colors.warning,
  }[color];

  return (
    <Text
      {...props}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[theme.typography[variant], { color: textColor }, style]}
    />
  );
}
