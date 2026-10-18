import type { Provider } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

import { getClientEnv } from "@/config/env";
import { trackAnalytics } from "@/services/analytics/analytics";
import { createSessionFromUrl } from "@/services/auth/auth-callback";
import { supabase } from "@/services/supabase/client";

WebBrowser.maybeCompleteAuthSession();

export type ConfiguredAuthProvider = "apple" | "google";

export function getAuthRedirectUrl(): string {
  return makeRedirectUri({ path: "auth/callback", scheme: "tender" });
}

export function getConfiguredAuthProviders(): readonly ConfiguredAuthProvider[] {
  const env = getClientEnv();
  return [
    ...(env.EXPO_PUBLIC_AUTH_APPLE_ENABLED ? (["apple"] as const) : []),
    ...(env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED ? (["google"] as const) : []),
  ];
}

export async function requestEmailAuthentication(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: getAuthRedirectUrl() },
  });
  if (error) throw error;
  trackAnalytics("auth_email_requested", { mode: "magic_link_or_otp" });
}

export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: token.trim(),
    type: "email",
  });
  if (error) throw error;
  trackAnalytics("auth_otp_verified", {});
}

export async function requestAccountRecovery(email: string): Promise<void> {
  const redirectTo = `${getAuthRedirectUrl()}?mode=recovery`;
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo },
  );
  if (error) throw error;
  trackAnalytics("auth_email_requested", { mode: "recovery" });
}

export async function updateRecoveredPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signInWithProvider(
  provider: ConfiguredAuthProvider,
): Promise<void> {
  if (!getConfiguredAuthProviders().includes(provider)) {
    throw new Error(`${provider} authentication is not configured.`);
  }

  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("The authentication provider did not return a URL.");

  trackAnalytics("auth_provider_started", { provider });
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "success") await createSessionFromUrl(result.url);
}

export async function signOutCurrentSession(): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
  trackAnalytics("auth_signed_out", { scope: "local" });
}
