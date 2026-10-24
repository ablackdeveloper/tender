import { clientEnvSchema, type ClientEnv } from "@/schemas/client-env";

let cachedEnv: Readonly<ClientEnv> | undefined;

export function parseClientEnv(input: Record<string, unknown>): Readonly<ClientEnv> {
  const result = clientEnvSchema.safeParse(input);

  if (!result.success) {
    const fields = Object.keys(result.error.flatten().fieldErrors).join(", ");
    throw new Error(
      `Invalid public application configuration: ${fields || "unknown field"}. ` +
        "Only variable names are reported; values are intentionally omitted.",
    );
  }

  return Object.freeze(result.data);
}

export function getClientEnv(): Readonly<ClientEnv> {
  cachedEnv ??= parseClientEnv({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    EXPO_PUBLIC_PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
    EXPO_PUBLIC_SUPPORT_URL: process.env.EXPO_PUBLIC_SUPPORT_URL,
    EXPO_PUBLIC_AUTH_APPLE_ENABLED: process.env.EXPO_PUBLIC_AUTH_APPLE_ENABLED,
    EXPO_PUBLIC_AUTH_GOOGLE_ENABLED: process.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED,
    EXPO_PUBLIC_HEALTH_DATA_ENABLED: process.env.EXPO_PUBLIC_HEALTH_DATA_ENABLED,
    EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED:
      process.env.EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED,
    EXPO_PUBLIC_VOICE_TRANSCRIPTION_ENABLED:
      process.env.EXPO_PUBLIC_VOICE_TRANSCRIPTION_ENABLED,
  });

  return cachedEnv;
}

export function resetClientEnvForTests(): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Environment cache can only be reset during tests.");
  }
  cachedEnv = undefined;
}
