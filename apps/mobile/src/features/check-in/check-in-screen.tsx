import { DisclosureCard } from "@/components/ui/disclosure-card";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  OfflineState,
  SegmentedControl,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { useUrgentGuidanceQuery } from "@/features/check-in/queries";
import { SafetyGuidance } from "@/features/check-in/safety-guidance";
import { useCheckInController } from "@/features/check-in/use-check-in-controller";
import type { SelectionOption } from "@/features/check-in/types";
import {
  checkInValuesSchema,
  emptyCheckInValues,
  type CheckInValues,
  type SymptomDuration,
  type SymptomInterference,
  type SymptomSeverity,
} from "@/schemas/check-in";
import { trackAnalytics } from "@/services/analytics/analytics";
import { useTheme } from "@/theme/theme-provider";

const feelingOptions = [
  { label: "Feeling good", value: "good" },
  { label: "Getting through it", value: "okay" },
  { label: "Today is hard", value: "hard" },
  { label: "Mixed", value: "mixed" },
  { label: "Not sure", value: "unsure" },
] as const;
const severityOptions = [
  { label: "Mild", value: "mild" },
  { label: "Moderate", value: "moderate" },
  { label: "Severe", value: "severe" },
] as const;
const durationOptions = [
  { label: "Today", value: "today" },
  { label: "A few days", value: "few_days" },
  { label: "A week+", value: "week_or_more" },
] as const;
const interferenceOptions = [
  { label: "Not interfering", value: "not_interfering" },
  { label: "Somewhat", value: "somewhat" },
  { label: "Significant", value: "significant" },
] as const;

function Chips({
  options,
  selected,
  toggle,
}: {
  options: SelectionOption[];
  selected: string[];
  toggle: (slug: string) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
      {options.map((option) => (
        <Chip
          key={option.id}
          onPress={() => toggle(option.slug)}
          selected={selected.includes(option.slug)}
        >
          {option.displayName}
        </Chip>
      ))}
    </View>
  );
}

export function CheckInForm({
  checkinDate,
  onDone,
  ownerId,
}: {
  checkinDate: string;
  onDone: () => void;
  ownerId: string;
}) {
  const controller = useCheckInController(ownerId, checkinDate);
  const { theme } = useTheme();
  const toast = useToast();
  const form = useForm<CheckInValues>({
    defaultValues: emptyCheckInValues,
    resolver: zodResolver(checkInValuesSchema),
  });
  const watched = useWatch({ control: form.control });
  const lastValues = useRef("");
  const shownGuidance = useRef(new Set<string>());
  const [dismissedGuidance, setDismissedGuidance] = useState<string | null>(null);
  const symptomFlags =
    watched.symptoms?.flatMap((item) => (item?.slug ? [item.slug] : [])) ?? [];
  const guidanceQuery = useUrgentGuidanceQuery(symptomFlags);

  useEffect(() => trackAnalytics("checkin_opened", {}), []);
  useEffect(() => {
    if (!controller.draft) return;
    const serialized = JSON.stringify(controller.draft.values);
    if (serialized === lastValues.current) return;
    lastValues.current = serialized;
    form.reset(controller.draft.values);
  }, [controller.draft, form]);
  useEffect(() => {
    const parsed = checkInValuesSchema.safeParse(watched);
    if (!parsed.success) return;
    const serialized = JSON.stringify(parsed.data);
    if (!lastValues.current || serialized === lastValues.current) return;
    lastValues.current = serialized;
    controller.updateValues(parsed.data);
  }, [controller, watched]);
  useEffect(() => {
    const key = guidanceQuery.data?.map((item) => item.id).join(":");
    if (!key || shownGuidance.current.has(key)) return;
    shownGuidance.current.add(key);
    trackAnalytics("safety_screen_shown", {});
  }, [guidanceQuery.data]);

  if (controller.contextQuery.isPending || !controller.storageReady) {
    return (
      <Screen>
        <Skeleton height={42} width="65%" />
        <Skeleton height={160} />
        <Skeleton height={160} />
      </Screen>
    );
  }
  if (!controller.context && !controller.isOnline) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <OfflineState description="Open check-in once while connected before continuing a protected draft offline." />
      </Screen>
    );
  }
  if (controller.contextQuery.isError || !controller.context) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <ErrorState
          actionLabel="Retry"
          description="Your protected local draft was not removed."
          onAction={() => void controller.contextQuery.refetch()}
          title="Check-in could not load"
        />
      </Screen>
    );
  }
  if (!controller.draft) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <EmptyState
          description="A protected draft could not be prepared."
          title="Check-in unavailable"
        />
      </Screen>
    );
  }
  const guidanceKey = guidanceQuery.data?.map((item) => item.id).join(":") ?? null;
  if (guidanceQuery.data?.length && dismissedGuidance !== guidanceKey) {
    const guidances = guidanceQuery.data;
    return (
      <SafetyGuidance
        careTeamPhone={controller.context.careTeamPhone}
        guidances={guidances}
        onDismiss={() => setDismissedGuidance(guidanceKey)}
      />
    );
  }

  const values = form.getValues();
  const toggleEmotion = (slug: string) => {
    const current = form.getValues("emotionSlugs");
    form.setValue(
      "emotionSlugs",
      current.includes(slug)
        ? current.filter((item) => item !== slug)
        : [...current, slug],
      { shouldDirty: true },
    );
  };
  const toggleSymptom = (slug: string) => {
    const current = form.getValues("symptoms");
    form.setValue(
      "symptoms",
      current.some((item) => item.slug === slug)
        ? current.filter((item) => item.slug !== slug)
        : [...current, { duration: null, interference: null, severity: null, slug }],
      { shouldDirty: true },
    );
    setDismissedGuidance(null);
  };
  const updateSymptom = (
    slug: string,
    field: "duration" | "interference" | "severity",
    value: SymptomDuration | SymptomInterference | SymptomSeverity,
  ) => {
    form.setValue(
      "symptoms",
      form
        .getValues("symptoms")
        .map((item) => (item.slug === slug ? { ...item, [field]: value } : item)),
      { shouldDirty: true },
    );
  };
  const completeCheckIn = () => {
    void controller
      .complete()
      .then((result) => {
        if (!result || result.status === "conflict") return;
        trackAnalytics("checkin_completed", {
          delivery: result.status === "synced" ? "synced" : "queued",
        });
        onDone();
      })
      .catch(() =>
        toast.show({
          message: "Your protected draft is saved. Flutterings will retry syncing.",
          tone: "danger",
        }),
      );
  };

  return (
    <Screen
      footer={
        <View style={{ gap: theme.spacing.xs }}>
          <Button
            disabled={controller.draft.status === "conflict"}
            onPress={completeCheckIn}
          >
            Complete check-in
          </Button>
          <Button onPress={onDone} variant="ghost">
            Continue later
          </Button>
        </View>
      }
    >
      <View style={{ gap: theme.spacing.xxs }}>
        <AppText accessibilityRole="header" variant="displayL">
          Daily check-in
        </AppText>
        <AppText color="muted" variant="bodySmall">
          Everything is optional. Mixed feelings are valid. There are no scores or
          streaks.
        </AppText>
        <AppText color="muted" variant="caption">
          {controller.draft.status === "synced"
            ? "Saved"
            : controller.draft.status === "conflict"
              ? "Needs your choice"
              : controller.isOnline
                ? "Autosaving"
                : "Protected on this device · will sync when online"}
        </AppText>
      </View>

      {controller.draft.status === "conflict" ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText accessibilityRole="header" variant="heading3">
            This check-in changed on another device
          </AppText>
          <AppText color="muted" variant="bodySmall">
            Choose which complete version to keep. Flutterings will not merge health
            notes automatically.
          </AppText>
          <Button
            onPress={() => void controller.useServerVersion()}
            variant="secondary"
          >
            Use saved version
          </Button>
          <Button onPress={() => void controller.keepDeviceVersion()} variant="ghost">
            Keep this device’s version
          </Button>
        </Card>
      ) : null}

      <Card style={{ gap: theme.spacing.sm }}>
        <AppText accessibilityRole="header" variant="heading2">
          How is today feeling overall?
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {feelingOptions.map((option) => (
            <Chip
              key={option.value}
              onPress={() =>
                form.setValue(
                  "overallFeeling",
                  values.overallFeeling === option.value ? null : option.value,
                  { shouldDirty: true },
                )
              }
              selected={values.overallFeeling === option.value}
            >
              {option.label}
            </Chip>
          ))}
        </View>
      </Card>

      <DisclosureCard
        title="Emotions"
        summary={`${values.emotionSlugs.length} selected`}
      >
        <AppText color="muted" variant="bodySmall">
          Select any combination that feels true.
        </AppText>
        <Chips
          options={controller.context.emotionOptions}
          selected={values.emotionSlugs}
          toggle={toggleEmotion}
        />
      </DisclosureCard>

      <DisclosureCard
        title="Symptoms or observations"
        summary={`${values.symptoms.length} selected`}
      >
        <AppText color="muted" variant="bodySmall">
          Flutterings records what you choose; it does not interpret the selection.
        </AppText>
        <Chips
          options={controller.context.symptomOptions}
          selected={values.symptoms.map((item) => item.slug)}
          toggle={toggleSymptom}
        />
        {values.symptoms.map((symptom) => {
          const label =
            controller.context?.symptomOptions.find(
              (item) => item.slug === symptom.slug,
            )?.displayName ?? symptom.slug;
          return (
            <Card key={symptom.slug} style={{ gap: theme.spacing.sm }}>
              <AppText accessibilityRole="header" variant="heading3">
                {label}
              </AppText>
              <SegmentedControl<SymptomSeverity>
                accessibilityLabel={`${label} severity`}
                onChange={(value) => updateSymptom(symptom.slug, "severity", value)}
                options={severityOptions}
                value={symptom.severity}
              />
              <SegmentedControl<SymptomDuration>
                accessibilityLabel={`${label} duration`}
                onChange={(value) => updateSymptom(symptom.slug, "duration", value)}
                options={durationOptions}
                value={symptom.duration}
              />
              <SegmentedControl<SymptomInterference>
                accessibilityLabel={`${label} interference`}
                onChange={(value) => updateSymptom(symptom.slug, "interference", value)}
                options={interferenceOptions}
                value={symptom.interference}
              />
            </Card>
          );
        })}
      </DisclosureCard>

      <DisclosureCard
        title="Wellness"
        summary={`${Object.values(values.wellness).filter(Boolean).length} recorded`}
      >
        <AppText color="muted" variant="bodySmall">
          Optional observations only—no targets or scores.
        </AppText>
        <SegmentedControl
          accessibilityLabel="Sleep"
          onChange={(value: "poor" | "okay" | "good") =>
            form.setValue("wellness.sleep", value, { shouldDirty: true })
          }
          options={[
            { label: "Poor", value: "poor" },
            { label: "Okay", value: "okay" },
            { label: "Good", value: "good" },
          ]}
          value={values.wellness.sleep}
        />
        <SegmentedControl
          accessibilityLabel="Movement"
          onChange={(value: "none" | "little" | "felt_good") =>
            form.setValue("wellness.movement", value, { shouldDirty: true })
          }
          options={[
            { label: "None", value: "none" },
            { label: "A little", value: "little" },
            { label: "Felt good", value: "felt_good" },
          ]}
          value={values.wellness.movement}
        />
        <SegmentedControl
          accessibilityLabel="Eating"
          onChange={(value: "difficult" | "managing" | "well") =>
            form.setValue("wellness.eating", value, { shouldDirty: true })
          }
          options={[
            { label: "Difficult", value: "difficult" },
            { label: "Managing", value: "managing" },
            { label: "Well", value: "well" },
          ]}
          value={values.wellness.eating}
        />
        <SegmentedControl
          accessibilityLabel="Hydration"
          onChange={(value: "low" | "okay" | "yes") =>
            form.setValue("wellness.hydration", value, { shouldDirty: true })
          }
          options={[
            { label: "Not great", value: "low" },
            { label: "Okay", value: "okay" },
            { label: "Yes", value: "yes" },
          ]}
          value={values.wellness.hydration}
        />
      </DisclosureCard>

      <Controller
        control={form.control}
        name="note"
        render={({ field: { onBlur, onChange, value } }) => (
          <Textarea
            hint="Optional and private unless you explicitly share it later."
            label="Private note"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />
    </Screen>
  );
}
