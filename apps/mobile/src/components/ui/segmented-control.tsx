import { Pressable, View } from "react-native";

import { AppText } from "@/components/ui/app-text";
import { useTheme } from "@/theme/theme-provider";

export type SegmentOption<T extends string> = {
  label: string;
  value: T;
};

export type SegmentedControlProps<T extends string> = {
  accessibilityLabel: string;
  disabled?: boolean;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  value: T | null;
};

export function SegmentedControl<T extends string>({
  accessibilityLabel,
  disabled = false,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="tablist"
      style={{
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radii.default,
        flexDirection: "row",
        gap: theme.spacing.xxs,
        padding: theme.spacing.xxs,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: selected ? theme.colors.surface : "transparent",
              borderRadius: theme.radii.compact,
              flex: 1,
              justifyContent: "center",
              minHeight: theme.sizes.minimumTarget,
              opacity: pressed ? 0.75 : disabled ? 0.48 : 1,
              paddingHorizontal: theme.spacing.xs,
            })}
          >
            <AppText variant="bodySmall">{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
