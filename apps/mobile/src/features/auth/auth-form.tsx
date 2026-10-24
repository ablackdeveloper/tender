import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import { View } from "react-native";
import { z } from "zod";

import {
  AppText,
  Button,
  Card,
  Field,
  PrivacyBadge,
  SafetyCallout,
} from "@/components/ui";
import {
  getConfiguredAuthProviders,
  requestEmailAuthentication,
  signInWithProvider,
  verifyEmailOtp,
} from "@/services/auth/auth-service";
import { useTheme } from "@/theme/theme-provider";

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});
const otpSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6,8}$/u, "Enter the code from your email."),
});
type EmailValues = z.infer<typeof emailSchema>;
type OtpValues = z.infer<typeof otpSchema>;

export function AuthForm({ onRecovery }: { onRecovery: () => void }) {
  const { theme } = useTheme();
  const providers = getConfiguredAuthProviders();
  const [submittedEmail, setSubmittedEmail] = useState<string>();
  const emailForm = useForm<EmailValues>({
    defaultValues: { email: "" },
    resolver: zodResolver(emailSchema),
  });
  const otpForm = useForm<OtpValues>({
    defaultValues: { token: "" },
    resolver: zodResolver(otpSchema),
  });
  const sendEmail = emailForm.handleSubmit(async ({ email: value }) => {
    try {
      await requestEmailAuthentication(value);
      setSubmittedEmail(value);
    } catch {
      emailForm.setError("root", {
        message:
          "We could not send the sign-in email. Check your connection and try again.",
      });
    }
  });

  const verifyCode = otpForm.handleSubmit(async ({ token }) => {
    try {
      if (!submittedEmail) return;
      await verifyEmailOtp(submittedEmail, token);
    } catch {
      otpForm.setError("root", {
        message: "That code could not be verified. It may be expired or already used.",
      });
    }
  });

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card style={{ gap: theme.spacing.md }}>
        <PrivacyBadge />
        <AppText accessibilityRole="header" variant="displayL">
          Welcome to Flutterings
        </AppText>
        <AppText color="muted">
          A private journal and planning companion for pregnancy.
        </AppText>
        <Controller
          control={emailForm.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field
              autoCapitalize="none"
              autoComplete="email"
              error={fieldState.error?.message}
              inputMode="email"
              label="Email address"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="you@example.com"
              value={field.value}
            />
          )}
        />
        {emailForm.formState.errors.root?.message ? (
          <AppText accessibilityRole="alert" color="danger" variant="bodySmall">
            {emailForm.formState.errors.root.message}
          </AppText>
        ) : null}
        <Button loading={emailForm.formState.isSubmitting} onPress={sendEmail}>
          Email me a sign-in link or code
        </Button>
        {submittedEmail ? (
          <Card accessibilityRole="summary" style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading3">Check your email</AppText>
            <AppText color="muted" variant="bodySmall">
              Open the single-use link on this device, or enter the one-time code. We do
              not reveal whether an account already exists.
            </AppText>
            <Controller
              control={otpForm.control}
              name="token"
              render={({ field, fieldState }) => (
                <Field
                  error={fieldState.error?.message}
                  inputMode="numeric"
                  label="One-time code"
                  maxLength={8}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  textContentType="oneTimeCode"
                  value={field.value}
                />
              )}
            />
            {otpForm.formState.errors.root?.message ? (
              <AppText accessibilityRole="alert" color="danger" variant="bodySmall">
                {otpForm.formState.errors.root.message}
              </AppText>
            ) : null}
            <Button
              loading={otpForm.formState.isSubmitting}
              onPress={verifyCode}
              variant="secondary"
            >
              Verify code
            </Button>
          </Card>
        ) : null}
        {providers.map((provider) => (
          <Button
            key={provider}
            onPress={() => void signInWithProvider(provider)}
            variant="ghost"
          >
            Continue with {provider === "apple" ? "Apple" : "Google"}
          </Button>
        ))}
        <Button onPress={onRecovery} variant="ghost">
          Recover account access
        </Button>
      </Card>
      <SafetyCallout title="Information only">
        Flutterings is not a medical device, does not diagnose, and does not replace
        your care team or urgent care.
      </SafetyCallout>
    </View>
  );
}
