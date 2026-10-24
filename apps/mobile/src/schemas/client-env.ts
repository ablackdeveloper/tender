import { z } from "zod";

const optionalHttpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), {
    message: "must use HTTPS",
  })
  .optional();

export const clientEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), {
      message: "must use HTTPS",
    }),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20)
    .refine((value) => !/service[_-]?role/i.test(value), {
      message: "must be a publishable client key, never a service-role key",
    }),
  EXPO_PUBLIC_PRIVACY_POLICY_URL: optionalHttpsUrl,
  EXPO_PUBLIC_SUPPORT_URL: optionalHttpsUrl,
  EXPO_PUBLIC_AUTH_APPLE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EXPO_PUBLIC_AUTH_GOOGLE_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EXPO_PUBLIC_HEALTH_DATA_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  EXPO_PUBLIC_VOICE_TRANSCRIPTION_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
