import { derivePregnancyDating, initialEstimatedDueDateFromLmp } from "@tender/domain";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Chip,
  Field,
  PrivacyBadge,
  SegmentedControl,
} from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { onboardingRepository } from "@/repositories/onboarding-repository";
import {
  createOnboardingDraft,
  type OnboardingDraft,
  type OnboardingStep,
} from "@/schemas/onboarding";
import { trackAnalytics } from "@/services/analytics/analytics";
import { onboardingDraftStorage } from "@/services/onboarding/onboarding-draft-storage";
import { useTheme } from "@/theme/theme-provider";
import { homeFocusOptions } from "@/features/today-journey/home-preferences";

const steps: readonly OnboardingStep[] = [
  "dating",
  "date",
  "estimate",
  "pregnancy_type",
  "home_focus",
  "privacy",
  "complete",
];
const firstUseSteps = new Set<OnboardingStep>(steps);

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

function OnboardingStepScreen({
  actions,
  children,
}: PropsWithChildren<{ actions: ReactNode }>) {
  const { theme } = useTheme();
  return (
    <Screen
      footer={<View style={{ gap: theme.spacing.xs }}>{actions}</View>}
      contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
    >
      <View style={{ gap: theme.spacing.lg }}>{children}</View>
    </Screen>
  );
}

function formatCalendarDate(value: string): string {
  if (!calendarDatePattern.test(value)) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function currentTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function Progress({ step }: { step: OnboardingStep }) {
  const { theme } = useTheme();
  const index = steps.indexOf(step);
  return (
    <View accessibilityRole="progressbar" style={{ gap: theme.spacing.xs }}>
      <AppText color="muted" variant="caption">
        STEP {Math.min(index + 1, steps.length)} OF {steps.length}
      </AppText>
      <View
        style={{
          backgroundColor: theme.colors.surfaceMuted,
          borderRadius: theme.radii.full,
          height: theme.spacing.xxs,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.accent,
            height: "100%",
            width: `${((index + 1) / steps.length) * 100}%`,
          }}
        />
      </View>
    </View>
  );
}

function EstimateCard({ draft }: { draft: OnboardingDraft }) {
  const { theme } = useTheme();
  const dating = derivePregnancyDating({
    clinicianDueDate:
      draft.datingMethod === "clinician" ? draft.estimatedDueDate : null,
    estimatedDueDate: draft.datingMethod === "lmp" ? draft.estimatedDueDate : null,
    lmpDate: draft.datingMethod === "lmp" ? draft.pregnancyDate : null,
    now: new Date(),
    timezone: draft.timezone,
  });

  return (
    <Card accessibilityRole="summary" style={{ gap: theme.spacing.sm }}>
      <AppText color="muted" variant="label">
        ESTIMATED DUE DATE
      </AppText>
      <AppText accessibilityRole="header" variant="heading1">
        {dating.activeDueDate ? formatCalendarDate(dating.activeDueDate) : "Not set"}
      </AppText>
      {dating.gestationalAge ? (
        <AppText color="muted">
          About {dating.gestationalAge.weeks} weeks + {dating.gestationalAge.days} days
        </AppText>
      ) : null}
      <AppText color="muted" variant="bodySmall">
        {draft.datingMethod === "lmp"
          ? "This adds 280 calendar days to the first day of your last period. It is an estimate and can be edited if your care team gives you a different date."
          : "This uses the due date you entered from your clinician or ultrasound. It overrides an earlier LMP estimate and can still be edited."}
      </AppText>
      <AppText variant="bodySmall">
        Week information is general context, not a diagnosis, fetal assessment, or
        prediction of when birth will happen.
      </AppText>
    </Card>
  );
}

export function OnboardingFlow() {
  const queryClient = useQueryClient();
  const { refreshOnboarding, session } = useAuth();
  const { setPreference, theme } = useTheme();
  const [draft, setDraft] = useState<OnboardingDraft | null>(null);
  const [dateError, setDateError] = useState<string>();
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void onboardingDraftStorage.load(userId).then((stored) => {
      if (!active) return;
      const restored = stored ?? createOnboardingDraft(currentTimezone());
      setDraft(
        firstUseSteps.has(restored.step) ? restored : { ...restored, step: "privacy" },
      );
    });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!draft || !userId) return;
    void onboardingDraftStorage.save(userId, draft);
    trackAnalytics("onboarding_step_viewed", { step: draft.step });
  }, [draft, userId]);

  const complete = useMutation({
    mutationFn: async (value: OnboardingDraft) => onboardingRepository.complete(value),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      await refreshOnboarding();
      if (userId) await onboardingDraftStorage.clear(userId);
      trackAnalytics("onboarding_completed", {});
    },
  });

  const patch = (value: Partial<OnboardingDraft>) => {
    setDraft((current) => (current ? { ...current, ...value } : current));
  };
  const go = (step: OnboardingStep) => patch({ step });
  const index = draft ? steps.indexOf(draft.step) : 0;
  const back = () => {
    const previous = steps[Math.max(0, index - 1)];
    if (previous) go(previous);
  };
  const skip = (
    step: "app_lock" | "dating" | "notifications" | "partner" | "preferences",
    next: OnboardingStep,
  ) => {
    trackAnalytics("onboarding_skipped_optional", { step });
    go(next);
  };

  const validDate = useMemo(() => {
    if (!draft?.pregnancyDate || !calendarDatePattern.test(draft.pregnancyDate))
      return false;
    try {
      if (draft.datingMethod === "lmp")
        initialEstimatedDueDateFromLmp(draft.pregnancyDate);
      else
        derivePregnancyDating({
          clinicianDueDate: draft.pregnancyDate,
          now: new Date(),
          timezone: draft.timezone,
        });
      return true;
    } catch {
      return false;
    }
  }, [draft]);

  if (!draft) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <AppText accessibilityLiveRegion="polite">
          Restoring your private setup draft…
        </AppText>
      </Screen>
    );
  }

  const header = (title: string, description: string) => (
    <>
      <Progress step={draft.step} />
      <AppText accessibilityRole="header" variant="heading1">
        {title}
      </AppText>
      <AppText color="muted">{description}</AppText>
    </>
  );

  if (draft.step === "dating") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button disabled={!draft.datingMethod} onPress={() => go("date")}>
              Continue
            </Button>
            <Button onPress={() => skip("dating", "pregnancy_type")} variant="ghost">
              Not sure yet — skip
            </Button>
          </>
        }
      >
        {header(
          "Setting your due date",
          "This helps show week-appropriate general information. You can edit it later.",
        )}
        <SegmentedControl
          accessibilityLabel="Pregnancy dating method"
          onChange={(datingMethod) =>
            patch({ datingMethod, pregnancyDate: "", estimatedDueDate: "" })
          }
          options={[
            { label: "Last period", value: "lmp" },
            { label: "Clinician date", value: "clinician" },
          ]}
          value={draft.datingMethod ?? "lmp"}
        />
        <AppText color="muted" variant="bodySmall">
          If your last period date is unknown, choose a clinician due date or skip this
          optional step. Flutterings never diagnoses from these dates.
        </AppText>
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "date") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button
              disabled={!validDate}
              onPress={() => {
                if (!validDate) setDateError("Enter a valid calendar date.");
                else go("estimate");
              }}
            >
              Continue
            </Button>
            <Button onPress={back} variant="ghost">
              Back
            </Button>
          </>
        }
      >
        {header(
          draft.datingMethod === "lmp"
            ? "When did your last period start?"
            : "What due date were you given?",
          "Enter a calendar date as YYYY-MM-DD. Date selection uses no device permission.",
        )}
        <Field
          error={dateError}
          hint="Example: 2026-08-14"
          inputMode="numeric"
          label={
            draft.datingMethod === "lmp"
              ? "First day of last period"
              : "Clinician due date"
          }
          onChangeText={(pregnancyDate) => {
            setDateError(undefined);
            let estimatedDueDate = pregnancyDate;
            if (
              draft.datingMethod === "lmp" &&
              calendarDatePattern.test(pregnancyDate)
            ) {
              try {
                estimatedDueDate = initialEstimatedDueDateFromLmp(pregnancyDate);
              } catch {
                estimatedDueDate = "";
              }
            }
            patch({ estimatedDueDate, pregnancyDate });
          }}
          placeholder="YYYY-MM-DD"
          value={draft.pregnancyDate}
        />
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "estimate") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button onPress={() => go("pregnancy_type")}>This looks right</Button>
            <Button onPress={() => go("date")} variant="ghost">
              Edit date
            </Button>
          </>
        }
      >
        {header(
          "Your estimated dates",
          "Review the date and how Flutterings calculated it.",
        )}
        <EstimateCard draft={draft} />
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "pregnancy_type") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button onPress={() => go("home_focus")}>Continue</Button>
            <Button onPress={back} variant="ghost">
              Back
            </Button>
          </>
        }
      >
        {header(
          "Pregnancy information",
          "Optional. This may tailor educational content; it is never used for a health assessment.",
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {(["singleton", "multiple", "unspecified"] as const).map((value) => (
            <Chip
              key={value}
              onPress={() => patch({ pregnancyType: value })}
              selected={draft.pregnancyType === value}
            >
              {value === "singleton"
                ? "One baby"
                : value === "multiple"
                  ? "Multiples"
                  : "Unspecified"}
            </Chip>
          ))}
        </View>
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "home_focus") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button onPress={() => go("privacy")}>Continue</Button>
            <Button onPress={back} variant="ghost">
              Back
            </Button>
          </>
        }
      >
        {header(
          "Choose your home focus",
          "Choose a starting point for Today. You can change it later. Upcoming visits and active support requests still come first.",
        )}
        <View style={{ gap: theme.spacing.sm }}>
          {homeFocusOptions.map((option) => (
            <Chip
              key={option.value}
              selected={draft.homeFocus === option.value}
              onPress={() => patch({ homeFocus: option.value })}
            >
              {option.label}
            </Chip>
          ))}
        </View>
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "preferences") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button onPress={() => go("notifications")}>Continue</Button>
            <Button
              onPress={() => skip("preferences", "notifications")}
              variant="ghost"
            >
              Skip
            </Button>
          </>
        }
      >
        {header("Display preferences", "These optional choices can be changed later.")}
        <Field
          label="What should we call you? (optional)"
          maxLength={120}
          onChangeText={(preferredName) => patch({ preferredName })}
          value={draft.preferredName}
        />
        <SegmentedControl
          accessibilityLabel="Measurement system"
          onChange={(measurementSystem) => patch({ measurementSystem })}
          options={[
            { label: "Metric", value: "metric" },
            { label: "Imperial", value: "imperial" },
          ]}
          value={draft.measurementSystem}
        />
        <SegmentedControl
          accessibilityLabel="Appearance"
          onChange={(themePreference) => {
            patch({ themePreference });
            setPreference(themePreference);
          }}
          options={[
            { label: "Auto", value: "system" },
            { label: "Light", value: "light" },
            { label: "Dark", value: "dark" },
          ]}
          value={draft.themePreference}
        />
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "notifications") {
    const choices = [
      ["weeklyUpdates", "Weekly pregnancy update"],
      ["appointmentReminders", "Appointment reminders"],
      ["planningReminders", "Planning reminders"],
    ] as const;
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button onPress={() => go("app_lock")}>Continue</Button>
            <Button
              onPress={() => {
                patch({
                  appointmentReminders: false,
                  planningReminders: false,
                  weeklyUpdates: false,
                });
                skip("notifications", "app_lock");
              }}
              variant="ghost"
            >
              Skip all
            </Button>
          </>
        }
      >
        {header(
          "Notification preferences",
          "Choose categories now; no system permission is requested here.",
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          {choices.map(([key, label]) => (
            <Chip
              key={key}
              onPress={() => patch({ [key]: !draft[key] })}
              selected={draft[key]}
            >
              {label}
            </Chip>
          ))}
        </View>
        <AppText color="muted" variant="bodySmall">
          Flutterings will request notification permission only when you explicitly
          enable a notification feature that is ready to schedule.
        </AppText>
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "app_lock") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button
              disabled={draft.protectAppLater === null}
              onPress={() => go("privacy")}
            >
              Continue
            </Button>
            <Button
              onPress={() => {
                patch({ protectAppLater: false });
                skip("app_lock", "privacy");
              }}
              variant="ghost"
            >
              Skip
            </Button>
          </>
        }
      >
        {header(
          "Lock Flutterings on this device?",
          "Optional. You can choose a device app lock later when that feature is available.",
        )}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <Chip
            onPress={() => patch({ protectAppLater: true })}
            selected={draft.protectAppLater === true}
          >
            Set up later
          </Chip>
          <Chip
            onPress={() => patch({ protectAppLater: false })}
            selected={draft.protectAppLater === false}
          >
            Not now
          </Chip>
        </View>
        <AppText color="muted" variant="bodySmall">
          No Face ID, fingerprint, or device credential permission is requested during
          onboarding. Biometric data is handled by the device and is never available to
          Flutterings.
        </AppText>
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "privacy") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button onPress={() => go("complete")}>Got it</Button>
            <Button onPress={back} variant="ghost">
              Back
            </Button>
          </>
        }
      >
        {header("How we handle your information", "A clear summary before you begin.")}
        <Card style={{ gap: theme.spacing.md }}>
          <PrivacyBadge />
          <AppText variant="heading3">Private by default</AppText>
          <AppText color="muted" variant="bodySmall">
            Account data and records you choose to sync are stored in your private
            account. Row-level and storage policies enforce ownership. Invited people
            receive only explicit, revocable grants—not broad partner access.
          </AppText>
          <AppText color="muted" variant="bodySmall">
            Auth sessions and this temporary setup draft use device-protected storage.
            The draft is cleared after completion or sign-out. Sensitive values are
            excluded from analytics.
          </AppText>
        </Card>
      </OnboardingStepScreen>
    );
  }

  if (draft.step === "partner") {
    return (
      <OnboardingStepScreen
        actions={
          <>
            <Button onPress={() => go("complete")}>Continue without inviting</Button>
            <Button onPress={() => skip("partner", "complete")} variant="ghost">
              Skip
            </Button>
          </>
        }
      >
        {header(
          "Invite someone later?",
          "Completely optional, with limited access you control.",
        )}
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading3">Nothing is shared automatically</AppText>
          <AppText color="muted" variant="bodySmall">
            Invitation delivery and grant management will be enabled only after the
            audited, rate-limited invitation service is available. Flutterings does not
            collect an email here yet.
          </AppText>
        </Card>
      </OnboardingStepScreen>
    );
  }

  return (
    <OnboardingStepScreen
      actions={
        <>
          <Button loading={complete.isPending} onPress={() => complete.mutate(draft)}>
            Finish setup
          </Button>
          <Button onPress={back} variant="ghost">
            Back
          </Button>
        </>
      }
    >
      {header(
        "Flutterings is ready",
        "Your setup choices are ready to save privately.",
      )}
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">A calm place to remember and plan</AppText>
        <AppText color="muted">
          Dates and weekly information remain estimates. Update them whenever your care
          team gives you new information.
        </AppText>
      </Card>
      {complete.error ? (
        <AppText accessibilityRole="alert" color="danger" variant="bodySmall">
          Setup could not be saved. Your device-protected draft is still available; try
          again.
        </AppText>
      ) : null}
    </OnboardingStepScreen>
  );
}
