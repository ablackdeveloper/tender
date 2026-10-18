import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Screen } from "@/components/layout/screen";
import { AppText, Button, Card, ErrorState, Field } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { updateRecoveredPassword } from "@/services/auth/auth-service";
import { useTheme } from "@/theme/theme-provider";

const schema = z
  .object({
    confirmPassword: z.string(),
    password: z.string().min(12, "Use at least 12 characters."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export default function UpdatePasswordScreen() {
  const { isRecovery, session } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const form = useForm<z.infer<typeof schema>>({
    defaultValues: { confirmPassword: "", password: "" },
    resolver: zodResolver(schema),
  });
  const submit = form.handleSubmit(async ({ password }) => {
    try {
      await updateRecoveredPassword(password);
      router.replace("/");
    } catch {
      form.setError("root", { message: "The password could not be updated." });
    }
  });

  if (!session || !isRecovery) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <ErrorState
          actionLabel="Request a new recovery link"
          description="Open this screen from a current, single-use recovery email."
          onAction={() => router.replace("/auth/recover")}
          title="Recovery session required"
        />
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ justifyContent: "center" }}>
      <Card style={{ gap: theme.spacing.md }}>
        <AppText accessibilityRole="header" variant="heading1">
          Choose a new password
        </AppText>
        {(["password", "confirmPassword"] as const).map((name) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field, fieldState }) => (
              <Field
                error={fieldState.error?.message}
                label={name === "password" ? "New password" : "Confirm password"}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                secureTextEntry
                value={field.value}
              />
            )}
          />
        ))}
        {form.formState.errors.root?.message ? (
          <AppText accessibilityRole="alert" color="danger" variant="bodySmall">
            {form.formState.errors.root.message}
          </AppText>
        ) : null}
        <Button loading={form.formState.isSubmitting} onPress={submit}>
          Update password
        </Button>
      </Card>
    </Screen>
  );
}
