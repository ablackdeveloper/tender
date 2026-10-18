import { forwardRef, useId } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { AppText } from "@/components/ui/app-text";
import { useTheme } from "@/theme/theme-provider";

export type FieldProps = TextInputProps & {
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { allowFontScaling = true, editable = true, error, hint, label, style, ...props },
  ref,
) {
  const { theme } = useTheme();
  const generatedId = useId();
  const supportId = `${generatedId}-support`;

  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText nativeID={`${generatedId}-label`} variant="label">
        {label}
      </AppText>
      <TextInput
        {...props}
        ref={ref}
        allowFontScaling={allowFontScaling}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={{ disabled: !editable }}
        accessibilityHint={props.accessibilityHint ?? hint}
        aria-describedby={error || hint ? supportId : undefined}
        aria-invalid={Boolean(error)}
        editable={editable}
        placeholderTextColor={theme.colors.textMuted}
        selectionColor={theme.colors.focus}
        style={[
          theme.typography.body,
          {
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radii.default,
            borderWidth: 1,
            color: theme.colors.text,
            minHeight: theme.sizes.control,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
          },
          !editable && { opacity: 0.56 },
          style,
        ]}
      />
      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          color="danger"
          nativeID={supportId}
          variant="bodySmall"
        >
          {error}
        </AppText>
      ) : hint ? (
        <AppText color="muted" nativeID={supportId} variant="bodySmall">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});
