import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Screen } from "@/components/layout/screen";
import { AppText, Button, Card, Field } from "@/components/ui";
import { requestAccountRecovery } from "@/services/auth/auth-service";
import { useTheme } from "@/theme/theme-provider";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export default function RecoverScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const form = useForm<z.infer<typeof schema>>({
    defaultValues: { email: "" },
    resolver: zodResolver(schema),
  });
  const submit = form.handleSubmit(async ({ email }) => {
    try {
      await requestAccountRecovery(email);
    } catch {
      form.setError("root", { message: "We could not send the recovery email." });
    }
  });

  return (
    <Screen contentContainerStyle={{ justifyContent: "center" }}>
      <Card style={{ gap: theme.spacing.md }}>
        <AppText accessibilityRole="header" variant="heading1">
          Recover account access
        </AppText>
        <AppText color="muted">
          We will send a generic response and, when eligible, a single-use recovery
          link.
        </AppText>
        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              autoCapitalize="none"
              error={fieldState.error?.message}
              inputMode="email"
              label="Email address"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              value={field.value}
            />
          )}
        />
        {form.formState.errors.root?.message ? (
          <AppText accessibilityRole="alert" color="danger" variant="bodySmall">
            {form.formState.errors.root.message}
          </AppText>
        ) : null}
        {form.formState.isSubmitSuccessful ? (
          <AppText accessibilityLiveRegion="polite" color="success" variant="bodySmall">
            If recovery is available, an email is on its way.
          </AppText>
        ) : null}
        <Button loading={form.formState.isSubmitting} onPress={submit}>
          Send recovery email
        </Button>
        <Button onPress={() => router.back()} variant="ghost">
          Back
        </Button>
      </Card>
    </Screen>
  );
}
