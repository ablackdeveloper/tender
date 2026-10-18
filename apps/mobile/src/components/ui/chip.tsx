import type { ComponentProps, ReactNode } from "react";
import { Pressable } from "react-native";

import { AppText } from "@/components/ui/app-text";
import { useTheme } from "@/theme/theme-provider";

export type ChipProps = Omit<ComponentProps<typeof Pressable>, "children"> & {
  children: ReactNode;
  selected?: boolean;
};

export function Chip({
  children,
  disabled,
  selected = false,
  style,
  ...props
}: ChipProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      {...props}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      aria-checked={selected}
      aria-disabled={Boolean(disabled)}
      disabled={disabled}
      style={(state) => [
        {
          alignItems: "center",
          alignSelf: "flex-start",
          backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.full,
          borderWidth: 1,
          justifyContent: "center",
          minHeight: theme.sizes.minimumTarget,
          paddingHorizontal: theme.spacing.md,
        },
        state.pressed && { opacity: 0.78 },
        disabled && { opacity: 0.48 },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      <AppText
        style={{ color: selected ? theme.colors.onPrimary : theme.colors.text }}
        variant="bodySmall"
      >
        {children}
      </AppText>
    </Pressable>
  );
}
