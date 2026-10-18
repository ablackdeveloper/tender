import { z } from "zod";

const eventSchemas = {
  auth_callback_completed: z.object({ method: z.enum(["email", "oauth"]) }).strict(),
  auth_email_requested: z
    .object({ mode: z.enum(["magic_link_or_otp", "recovery"]) })
    .strict(),
  auth_otp_verified: z.object({}).strict(),
  auth_provider_started: z.object({ provider: z.enum(["apple", "google"]) }).strict(),
  auth_signed_out: z.object({ scope: z.literal("local") }).strict(),
  onboarding_completed: z.object({}).strict(),
  onboarding_skipped_optional: z
    .object({
      step: z.enum(["app_lock", "dating", "notifications", "partner", "preferences"]),
    })
    .strict(),
  onboarding_step_viewed: z
    .object({
      step: z.enum([
        "dating",
        "date",
        "estimate",
        "pregnancy_type",
        "home_focus",
        "preferences",
        "notifications",
        "app_lock",
        "privacy",
        "partner",
        "complete",
      ]),
    })
    .strict(),
  journey_week_selected: z
    .object({ direction: z.enum(["next", "previous", "direct"]) })
    .strict(),
  product_action_selected: z.object({ action: z.enum(["check_in", "retry"]) }).strict(),
  product_screen_viewed: z.object({ screen: z.enum(["today", "journey"]) }).strict(),
  checkin_completed: z.object({ delivery: z.enum(["queued", "synced"]) }).strict(),
  checkin_opened: z.object({}).strict(),
  safety_screen_shown: z.object({}).strict(),
} as const;

export type AnalyticsEvent = keyof typeof eventSchemas;
type EventProperties<E extends AnalyticsEvent> = z.input<(typeof eventSchemas)[E]>;

export type AnalyticsAdapter = {
  track: (event: AnalyticsEvent, properties: Readonly<Record<string, unknown>>) => void;
};

let adapter: AnalyticsAdapter | undefined;

export function configureAnalytics(nextAdapter?: AnalyticsAdapter): void {
  adapter = nextAdapter;
}

export function trackAnalytics<E extends AnalyticsEvent>(
  event: E,
  properties: EventProperties<E>,
): void {
  const safeProperties = eventSchemas[event].parse(properties);
  adapter?.track(event, Object.freeze(safeProperties));
}
