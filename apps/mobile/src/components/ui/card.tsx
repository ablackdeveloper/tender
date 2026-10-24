import type { ComponentProps } from "react";
import { View } from "react-native";

import { useTheme } from "@/theme/theme-provider";

export type CardProps = ComponentProps<typeof View> & {
  elevated?: boolean;
};

export function Card({ elevated = false, style, ...props }: CardProps) {
  const { theme } = useTheme();

  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.large,
          borderWidth: elevated ? 0 : 1,
          padding: theme.spacing.lg,
        },
        elevated && theme.elevation.raised,
        style,
      ]}
    />
  );
}
