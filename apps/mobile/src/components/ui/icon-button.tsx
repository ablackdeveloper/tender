import type { ComponentProps, ReactNode } from "react";
import { Pressable } from "react-native";

import { useTheme } from "@/theme/theme-provider";

export type IconButtonProps = Omit<
  ComponentProps<typeof Pressable>,
  "accessibilityLabel" | "children"
> & {
  accessibilityLabel: string;
  children: ReactNode;
  selected?: boolean;
};

export function IconButton({
  accessibilityLabel,
  children,
  disabled,
  selected = false,
  style,
  ...props
}: IconButtonProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={disabled}
      hitSlop={4}
      style={(state) => [
        {
          alignItems: "center",
          backgroundColor: selected ? theme.colors.surfaceMuted : "transparent",
          borderRadius: theme.radii.full,
          justifyContent: "center",
          minHeight: theme.sizes.minimumTarget,
          minWidth: theme.sizes.minimumTarget,
        },
        state.pressed && { opacity: 0.72 },
        disabled && { opacity: 0.48 },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {children}
    </Pressable>
  );
}
