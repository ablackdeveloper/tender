import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, type ViewStyle } from "react-native";

import { AppText } from "@/components/ui/app-text";
import { useTheme } from "@/theme/theme-provider";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export type ButtonProps = Omit<ComponentProps<typeof Pressable>, "children"> & {
  children: ReactNode;
  loading?: boolean;
  variant?: ButtonVariant;
};

export function Button({
  accessibilityLabel,
  accessibilityState,
  children,
  disabled,
  loading = false,
  style,
  variant = "primary",
  ...props
}: ButtonProps) {
  const { theme } = useTheme();
  const blocked = Boolean(disabled || loading);
  const palette = {
    primary: [theme.colors.primary, theme.colors.onPrimary],
    secondary: [theme.colors.secondary, theme.colors.onSecondary],
    ghost: ["transparent", theme.colors.primary],
    danger: [theme.colors.danger, theme.colors.onDanger],
  }[variant];
  const borderStyle: ViewStyle =
    variant === "ghost"
      ? { borderColor: theme.colors.border, borderWidth: 1 }
      : { borderWidth: 0 };

  return (
    <Pressable
      {...props}
      accessibilityLabel={
        accessibilityLabel ?? (typeof children === "string" ? children : undefined)
      }
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, busy: loading, disabled: blocked }}
      disabled={blocked}
      style={(state) => [
        {
          alignItems: "center",
          backgroundColor: palette[0],
          borderRadius: theme.radii.default,
          justifyContent: "center",
          minHeight: theme.sizes.control,
          minWidth: theme.sizes.minimumTarget,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.xs,
        },
        borderStyle,
        state.pressed && { opacity: 0.82 },
        blocked && { opacity: 0.48 },
        typeof style === "function" ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading" color={palette[1]} />
      ) : (
        <AppText style={{ color: palette[1] }} variant="heading3">
          {children}
        </AppText>
      )}
    </Pressable>
  );
}
