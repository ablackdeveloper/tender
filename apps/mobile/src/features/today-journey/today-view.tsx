import { formatAppointmentTime as formatAppointment } from "@/features/care/appointment-time";
import { lifecycleStatusLabel } from "@tender/domain";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/layout/screen";
import { getClientEnv } from "@/config/env";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  OfflineState,
  PrivacyBadge,
  SafetyCallout,
} from "@/components/ui";
import {
  contentWeek,
  estimatedDueDateWording,
  trimesterForWeek,
} from "@/features/today-journey/presentation";
import { OfflineCacheNotice, ProductSkeleton } from "@/features/today-journey/shared";
import type { HomeModuleKey, TodayData } from "@/features/today-journey/types";
import { useTodayQuery } from "@/features/today-journey/queries";
import { useNetworkStatus } from "@/providers/network-provider";
import { todayJourneyRepository } from "@/repositories/today-journey-repository";
import { trackAnalytics } from "@/services/analytics/analytics";
import { useTheme } from "@/theme/theme-provider";
import { defaultHomePreferences, type HomePreferences } from "./home-preferences";
import { HomePreferencesSheet } from "./home-preferences-sheet";
import { homePreferencesRepository } from "@/repositories/home-preferences-repository";
import { useQueryClient } from "@tanstack/react-query";

type TodayViewProps = {
  data: TodayData;
  isOffline?: boolean;
  onCheckIn: () => void;
  onDismissModule?: (moduleKey: HomeModuleKey) => Promise<void>;
  onSavePreferences?: (value: HomePreferences) => Promise<void>;
};

type TodayFocus = {
  action: string;
  body: string;
  module: HomeModuleKey | null;
  title: string;
  type: "care" | "check_in" | "journey" | "memories" | "together" | "recovery";
};

export function TodayView({
  data,
  isOffline = false,
  onCheckIn,
  onDismissModule,
  onSavePreferences,
}: TodayViewProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const [currentTime] = useState(Date.now);
  const [dismissing, setDismissing] = useState(false);
  const [dismissFailed, setDismissFailed] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [preferencesSaved, setPreferencesSaved] = useState(false);
  const preferences = data.homePreferences ?? defaultHomePreferences;
  const healthEnabled = getClientEnv().EXPO_PUBLIC_HEALTH_DATA_ENABLED;
  const age = data.dating.gestationalAge;
  const week = contentWeek(data.dating);
  const trimester = age ? trimesterForWeek(age.weeks) : null;
  const showProgress = data.experience.showGestationalProgress;
  const canCheckIn =
    data.pregnancy.lifecycleStatus === "active" ||
    data.pregnancy.lifecycleStatus === "paused";
  const appointmentTime = data.appointment
    ? Date.parse(data.appointment.startsAt)
    : Number.NaN;
  const appointmentIsSoon =
    Number.isFinite(appointmentTime) &&
    appointmentTime >= currentTime - 6 * 60 * 60 * 1000 &&
    appointmentTime <= currentTime + 48 * 60 * 60 * 1000;
  const hidden = new Set(data.hiddenModules);
  let focus: TodayFocus;
  if (data.experience.showMaternalRecovery && !hidden.has("appointment")) {
    focus = {
      action: "Open my recovery space",
      body: "Keep one private note or question ready for your next care conversation.",
      module: "appointment",
      title: "Make space for your recovery",
      type: "recovery",
    };
  } else if (appointmentIsSoon && !hidden.has("appointment")) {
    focus = {
      action: "Prepare for visit",
      body: data.appointment
        ? `${data.appointment.title} is coming up. Add one question before you go.`
        : "Add one question before your next visit.",
      module: "appointment",
      title: "Your next visit is close",
      type: "care",
    };
  } else if (data.supportRequest && !hidden.has("plans")) {
    focus = {
      action: "Open Together",
      body:
        data.supportRequest.status === "accepted"
          ? `${data.supportRequest.title} was accepted. Keep the next step visible without sending another reminder.`
          : `${data.supportRequest.title} is still open. You can review or cancel it.`,
      module: "plans",
      title:
        data.supportRequest.status === "accepted"
          ? "Support is on the way"
          : "A support request is open",
      type: "together",
    };
  } else if (canCheckIn && preferences.focus === "memories" && !hidden.has("memory")) {
    focus = {
      action: "Open Memories",
      body: "Open your private records or add something you want to remember.",
      module: "memory",
      title: "Make room for a memory",
      type: "memories",
    };
  } else if (canCheckIn && preferences.focus === "care" && !hidden.has("appointment")) {
    focus = {
      action: "Open Care",
      body: "Keep a question or visit detail ready for your next care conversation.",
      module: "appointment",
      title: "Prepare at your own pace",
      type: "care",
    };
  } else if (canCheckIn && preferences.focus === "support" && !hidden.has("plans")) {
    focus = {
      action: "Open Together",
      body: "Ask for one kind of help when you need it.",
      module: "plans",
      title: "Choose the support you need",
      type: "together",
    };
  } else if (
    data.content &&
    data.experience.showWeeklyContent &&
    !hidden.has("weekly_content")
  ) {
    focus = {
      action: "Read this week",
      body: data.content.summary ?? data.content.title,
      module: "weekly_content",
      title: data.content.title,
      type: "journey",
    };
  } else if (canCheckIn && !hidden.has("check_in")) {
    focus = {
      action: "Add a check-in",
      body: "Add something only when it is useful. There is no score, streak, or required answer.",
      module: "check_in",
      title: "Nothing is required today",
      type: "check_in",
    };
  } else if (canCheckIn) {
    focus = {
      action: "Open Memories",
      body: "Your dismissed items will return tomorrow. Your private records stay available.",
      module: null,
      title: "A quiet Today",
      type: "memories",
    };
  } else {
    focus = {
      action: "Open Care",
      body: "Your records are preserved. Use Care when you need them.",
      module: null,
      title: "Your records are here",
      type: "care",
    };
  }

  const openFocus = () => {
    if (focus.type === "recovery") {
      router.push("/(app)/recovery" as Href);
      return;
    }
    if (focus.type === "check_in") {
      onCheckIn();
      return;
    }
    if (focus.type === "together") {
      router.push("/(app)/together");
      return;
    }
    if (focus.type === "journey") {
      router.push("/(app)/journey");
      return;
    }
    if (focus.type === "memories") {
      router.push("/(app)/memories" as Href);
      return;
    }
    router.push("/(app)/care");
  };

  const dismissFocus = async () => {
    if (!focus.module || !onDismissModule) return;
    setDismissing(true);
    setDismissFailed(false);
    try {
      await onDismissModule(focus.module);
    } catch {
      setDismissFailed(true);
    } finally {
      setDismissing(false);
    }
  };

  return (
    <Screen>
      {isOffline ? <OfflineCacheNotice /> : null}
      <View style={{ gap: theme.spacing.xxs }}>
        <AppText color="muted" variant="bodySmall">
          Today
        </AppText>
        <AppText accessibilityRole="header" variant="displayXL">
          {showProgress && age
            ? `Week ${age.weeks}`
            : canCheckIn
              ? "Your day"
              : lifecycleStatusLabel(data.pregnancy.lifecycleStatus)}
        </AppText>
        <AppText color="muted" variant="label">
          {showProgress && age ? `Day ${age.days + 1}` : "Your private space"}
          {showProgress && trimester ? ` · ${trimester}` : ""}
        </AppText>
        {data.experience.showCountdown ? (
          <AppText color="muted" variant="caption">
            {estimatedDueDateWording(data.dating)}
          </AppText>
        ) : null}
      </View>

      <Card elevated style={{ gap: theme.spacing.sm }}>
        <AppText color="muted" variant="label">
          ONE THING FOR TODAY
        </AppText>
        <AppText accessibilityRole="header" variant="heading2">
          {focus.title}
        </AppText>
        <AppText>{focus.body}</AppText>
        <Button onPress={openFocus}>{focus.action}</Button>
        {focus.module && onDismissModule ? (
          <Button
            disabled={isOffline}
            loading={dismissing}
            onPress={() => void dismissFocus()}
            variant="ghost"
          >
            Not today
          </Button>
        ) : null}
        {dismissFailed ? (
          <AppText color="danger" variant="caption">
            This item could not be hidden. Try again when connected.
          </AppText>
        ) : null}
      </Card>

      <AppText accessibilityRole="header" variant="heading2">
        Later
      </AppText>

      <Card style={{ gap: theme.spacing.xs }}>
        <AppText color="muted" variant="label">
          NEXT APPOINTMENT
        </AppText>
        {data.appointment ? (
          <>
            <AppText accessibilityRole="header" variant="heading3">
              {data.appointment.title}
              {data.appointment.providerName
                ? ` · ${data.appointment.providerName}`
                : ""}
            </AppText>
            <AppText color="muted" variant="bodySmall">
              {formatAppointment(data.appointment.startsAt, data.appointment.timezone)}
            </AppText>
            {data.appointment.location ? (
              <AppText color="muted" variant="caption">
                {data.appointment.location}
              </AppText>
            ) : null}
          </>
        ) : (
          <AppText color="muted" variant="bodySmall">
            No upcoming appointment is scheduled.
          </AppText>
        )}
      </Card>

      {data.experience.showWeeklyContent ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText color="muted" variant="label">
            THIS WEEK
          </AppText>
          {data.content ? (
            <>
              <AppText accessibilityRole="header" variant="heading3">
                {data.content.title}
              </AppText>
              <AppText numberOfLines={3}>{data.content.body}</AppText>
              <AppText color="muted" variant="caption">
                Clinically reviewed{" "}
                {new Date(data.content.reviewedAt).toLocaleDateString()}
                {` · Version ${data.content.version}`}
              </AppText>
            </>
          ) : (
            <EmptyState
              description={
                week
                  ? "No published, current, clinically approved article is available for this week."
                  : "A week must be available before weekly content can be shown."
              }
              title="Reviewed weekly content unavailable"
            />
          )}
          <Button onPress={() => router.push("/(app)/journey")} variant="ghost">
            Browse Journey
          </Button>
        </Card>
      ) : (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading3">A quieter Today</AppText>
          <AppText color="muted">
            Weekly reading is hidden. Your private records remain available.
          </AppText>
        </Card>
      )}

      {!data.pregnancy.compassionateMode &&
      ["active", "paused"].includes(data.pregnancy.lifecycleStatus) &&
      !data.hiddenModules.includes("memory") ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <AppText color="muted" variant="label">
              RECENT PRIVATE NOTE
            </AppText>
            <PrivacyBadge level="private" />
          </View>
          {data.memory ? (
            <>
              {data.memory.title ? (
                <AppText accessibilityRole="header" variant="heading3">
                  {data.memory.title}
                </AppText>
              ) : null}
              <AppText numberOfLines={4}>{data.memory.body}</AppText>
            </>
          ) : (
            <AppText color="muted" variant="bodySmall">
              No private notes yet.
            </AppText>
          )}
        </Card>
      ) : null}

      <SafetyCallout>
        Flutterings offers estimates and reviewed education. It is not a medical device,
        does not diagnose, and does not replace your care team.
      </SafetyCallout>
      <View style={{ gap: theme.spacing.sm }}>
        {onSavePreferences ? (
          <Button
            variant="ghost"
            onPress={() => {
              setPreferencesSaved(false);
              setPreferencesOpen(true);
            }}
          >
            Today preferences
          </Button>
        ) : null}
        {preferencesSaved ? (
          <AppText accessibilityLiveRegion="polite">Today preferences saved.</AppText>
        ) : null}
        <Button
          variant="ghost"
          onPress={() => router.push("/(app)/privacy-data" as Href)}
        >
          Privacy and data
        </Button>
        {healthEnabled ? (
          <Button
            variant="ghost"
            onPress={() => router.push("/(app)/health-data" as Href)}
          >
            Optional health data
          </Button>
        ) : null}
        <Button
          variant="ghost"
          onPress={() => router.push("/(app)/pregnancy-settings")}
        >
          Pregnancy settings
        </Button>
      </View>
      {preferencesOpen && onSavePreferences ? (
        <HomePreferencesSheet
          initial={preferences}
          isOffline={isOffline}
          onClose={() => setPreferencesOpen(false)}
          onSave={async (value) => {
            await onSavePreferences(value);
            setPreferencesSaved(true);
          }}
        />
      ) : null}
    </Screen>
  );
}

export function TodayScreen({
  ownerId,
  onCheckIn,
}: {
  ownerId: string;
  onCheckIn: () => void;
}) {
  const query = useTodayQuery(ownerId);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isOnline } = useNetworkStatus();

  useEffect(() => trackAnalytics("product_screen_viewed", { screen: "today" }), []);

  if (query.isPending) {
    return (
      <Screen>
        <ProductSkeleton label="Loading Today" />
      </Screen>
    );
  }
  if (!query.data && !isOnline) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <OfflineState
          description="Connect once to load Today. Flutterings does not persist this sensitive cache to disk."
          title="Today is unavailable offline"
        />
      </Screen>
    );
  }
  if (query.isError && !query.data) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <ErrorState
          actionLabel="Retry"
          description="Your data was not changed."
          onAction={() => {
            trackAnalytics("product_action_selected", { action: "retry" });
            void query.refetch();
          }}
          title="Today could not load"
        />
      </Screen>
    );
  }
  if (!query.data) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <EmptyState
          description="A due date is optional. Start your private record to save memories and care details."
          title="Your private record"
          actionLabel="Start my record"
          onAction={() => router.push("/(app)/pregnancy-settings")}
        />
      </Screen>
    );
  }
  return (
    <TodayView
      data={query.data}
      isOffline={!isOnline}
      onCheckIn={onCheckIn}
      onSavePreferences={async (value) => {
        await homePreferencesRepository.save(ownerId, value);
        await queryClient.invalidateQueries({ queryKey: ["today-journey"] });
      }}
      onDismissModule={async (moduleKey) => {
        await todayJourneyRepository.dismissModuleForToday(
          ownerId,
          moduleKey,
          query.data?.pregnancy.timezone ?? "UTC",
        );
        await query.refetch();
      }}
    />
  );
}
