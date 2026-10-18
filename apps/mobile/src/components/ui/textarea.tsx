import { forwardRef } from "react";
import { TextInput } from "react-native";

import { Field, type FieldProps } from "@/components/ui/field";

export type TextareaProps = Omit<
  FieldProps,
  "multiline" | "numberOfLines" | "textAlignVertical"
> & {
  numberOfLines?: number;
};

export const Textarea = forwardRef<TextInput, TextareaProps>(function Textarea(
  { numberOfLines = 5, style, ...props },
  ref,
) {
  return (
    <Field
      {...props}
      ref={ref}
      multiline
      numberOfLines={numberOfLines}
      style={[{ minHeight: 120 }, style]}
      textAlignVertical="top"
    />
  );
});
