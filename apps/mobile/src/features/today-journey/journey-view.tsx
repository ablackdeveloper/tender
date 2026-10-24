import { useEffect, useMemo, useState } from "react";
import { type Href, useRouter } from "expo-router";
import { Linking, Pressable, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  OfflineState,
  SafetyCallout,
} from "@/components/ui";
import {
  formatCalendarDate,
  trimesterForWeek,
} from "@/features/today-journey/presentation";
import { useJourneyQuery } from "@/features/today-journey/queries";
import { OfflineCacheNotice, ProductSkeleton } from "@/features/today-journey/shared";
import type { JourneyData, ReviewedWeekContent } from "@/features/today-journey/types";
import { useNetworkStatus } from "@/providers/network-provider";
import { trackAnalytics } from "@/services/analytics/analytics";
import { useTheme } from "@/theme/theme-provider";

type Direction = "direct" | "next" | "previous";

function Provenance({ content }: { content: ReviewedWeekContent }) {
  const { theme } = useTheme();
  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText accessibilityRole="header" variant="heading3">
        About this content
      </AppText>
      <AppText color="muted" variant="bodySmall">
        Educational content — not your personal medical record. Reviewed by
        {` ${content.reviewerName}, ${content.reviewerCredentials}`} on{" "}
        {new Date(content.reviewedAt).toLocaleDateString()} · Version
        {` ${content.version}`}.
      </AppText>
      {content.sources.map((source) => (
        <Button
          key={source.url}
          accessibilityHint="Opens the publisher source in your browser"
          onPress={() => void Linking.openURL(source.url)}
          variant="ghost"
        >
          {source.publisher ?? source.title}
          {source.jurisdiction ? ` · ${source.jurisdiction}` : ""}
        </Button>
      ))}
      {content.sources.length === 0 ? (
        <AppText color="muted" variant="caption">
          No public source link was released with this version.
        </AppText>
      ) : null}
    </Card>
  );
}

export function JourneyView({
  data,
  isOffline = false,
}: {
  data: JourneyData;
  isOffline?: boolean;
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const initialWeek =
    data.weeks.find((item) => item.week === data.currentWeek)?.week ??
    data.weeks[0]?.week ??
    null;
  const [selectedWeek, setSelectedWeek] = useState<number | null>(initialWeek);

  const selectedIndex = data.weeks.findIndex((item) => item.week === selectedWeek);
  const selected = selectedIndex >= 0 ? data.weeks[selectedIndex] : undefined;
  const trimester = selected ? trimesterForWeek(selected.week) : null;
  const sourceNote =
    data.dueDateSource === "unknown"
      ? "You have not set a due date. Browse general reading at your own pace."
      : data.dueDateSource === "clinician" || data.dueDateSource === "ultrasound"
        ? "Your approximate current week uses a clinician-confirmed due date."
        : data.dueDateSource === "lmp"
          ? "Your approximate current week is estimated from the first day of your last menstrual period."
          : "Your approximate current week uses the due date saved during setup.";

  const select = (week: number, direction: Direction) => {
    setSelectedWeek(week);
    trackAnalytics("journey_week_selected", { direction });
  };

  const weekGroups = useMemo(
    () =>
      (["First trimester", "Second trimester", "Third trimester"] as const).map(
        (label) => ({
          label,
          weeks: data.weeks.filter((item) => trimesterForWeek(item.week) === label),
        }),
      ),
    [data.weeks],
  );

  if (!data.experience.showWeeklyContent) {
    return (
      <Screen contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}>
        {isOffline ? <OfflineCacheNotice /> : null}
        <AppText accessibilityRole="header" variant="displayL">
          Journey
        </AppText>
        <EmptyState
          title="Journey progression is hidden"
          description="Weekly reading is hidden by your content choices or pregnancy settings. Your saved records are unchanged."
          actionLabel="Open Today"
          onAction={() => router.push("/(app)")}
        />
        {data.experience.showMaternalRecovery ? (
          <Card>
            <AppText variant="heading2">Maternal recovery mode</AppText>
            <AppText color="muted">
              Flutterings remains centered on your recovery and existing records. It
              does not become a baby tracker.
            </AppText>
            <Button onPress={() => router.push("/(app)/recovery" as Href)}>
              Open my recovery space
            </Button>
          </Card>
        ) : null}
        <SafetyCallout>
          Flutterings is not a medical device and does not diagnose, predict outcomes,
          or replace your care team.
        </SafetyCallout>
      </Screen>
    );
  }

  return (
    <Screen contentContainerStyle={{ paddingBottom: theme.spacing.xxxl }}>
      {isOffline ? <OfflineCacheNotice /> : null}
      <View style={{ gap: theme.spacing.xxs }}>
        <AppText accessibilityRole="header" variant="displayL">
          Journey
        </AppText>
        <AppText color="muted" variant="bodySmall">
          Browse only current, published, clinically reviewed week content.
        </AppText>
        <AppText color="muted" variant="caption">
          {data.experience.showGestationalProgress
            ? sourceNote
            : "Browse reviewed reading at your own pace."}
          {data.experience.showCountdown && data.dating.activeDueDate
            ? ` Estimated due date: ${formatCalendarDate(data.dating.activeDueDate)}.`
            : ""}
        </AppText>
      </View>

      {data.weeks.length === 0 ? (
        <OfflineState
          description="The content gate found no published, current article with a valid approved clinical review. Draft and placeholder copy stays hidden."
          title="No reviewed Journey content"
        />
      ) : (
        <>
          {weekGroups.map((group) =>
            group.weeks.length ? (
              <View key={group.label} style={{ gap: theme.spacing.xs }}>
                {data.experience.showGestationalProgress ? (
                  <AppText color="muted" variant="label">
                    {group.label.toUpperCase()}
                  </AppText>
                ) : null}
                <View
                  style={{
                    gap: theme.spacing.xs,
                  }}
                >
                  {group.weeks.map((item) => {
                    const current =
                      data.experience.showGestationalProgress &&
                      item.week === data.currentWeek;
                    const selected = item.week === selectedWeek;
                    return (
                      <Pressable
                        key={item.articleId}
                        accessibilityHint={
                          current ? "Approximate current week" : undefined
                        }
                        accessibilityLabel={
                          data.experience.showGestationalProgress
                            ? `Week ${item.week}${current ? ", current approximate week" : ""}`
                            : item.title
                        }
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => select(item.week, "direct")}
                        style={({ pressed }) => ({
                          alignItems: "center",
                          backgroundColor: selected
                            ? theme.colors.surfaceMuted
                            : theme.colors.surface,
                          borderColor: selected
                            ? theme.colors.primary
                            : theme.colors.border,
                          borderRadius: theme.radii.default,
                          borderWidth: 1,
                          flexDirection: "row",
                          gap: theme.spacing.sm,
                          minHeight: theme.sizes.control,
                          opacity: pressed ? 0.78 : 1,
                          padding: theme.spacing.sm,
                        })}
                      >
                        <View
                          aria-hidden
                          style={{
                            alignItems: "center",
                            backgroundColor: current
                              ? theme.colors.primary
                              : theme.colors.surfaceMuted,
                            borderRadius: theme.radii.compact,
                            height: theme.sizes.control,
                            justifyContent: "center",
                            width: theme.sizes.control,
                          }}
                        >
                          <AppText
                            style={{
                              color: current
                                ? theme.colors.onPrimary
                                : theme.colors.textMuted,
                            }}
                            variant="label"
                          >
                            {data.experience.showGestationalProgress ? item.week : "·"}
                          </AppText>
                        </View>
                        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
                          <AppText variant="heading3">
                            {data.experience.showGestationalProgress
                              ? `Week ${item.week}`
                              : item.title}
                          </AppText>
                          <AppText color="muted" variant="caption">
                            {current ? "YOUR APPROXIMATE WEEK" : "REVIEWED CONTENT"}
                          </AppText>
                        </View>
                        <AppText aria-hidden color="muted" variant="heading3">
                          ›
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null,
          )}

          {selected ? (
            <>
              <Card style={{ gap: theme.spacing.md }}>
                <View style={{ gap: theme.spacing.xxs }}>
                  {data.experience.showGestationalProgress ? (
                    <AppText color="muted" variant="label">
                      WEEK {selected.week}
                      {trimester ? ` · ${trimester.toUpperCase()}` : ""}
                    </AppText>
                  ) : null}
                  <AppText accessibilityRole="header" variant="heading1">
                    {selected.title}
                  </AppText>
                </View>
                {selected.summary ? (
                  <AppText color="muted" variant="bodySmall">
                    {selected.summary}
                  </AppText>
                ) : null}
                <AppText>{selected.body}</AppText>
                <Button
                  onPress={() =>
                    router.push({
                      pathname: "/(app)/appointment-question",
                      params: { article: selected.articleId },
                    } as Href)
                  }
                >
                  Save a question for my visit
                </Button>
                <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                  <Button
                    disabled={selectedIndex <= 0}
                    onPress={() => {
                      const previous = data.weeks[selectedIndex - 1];
                      if (previous) select(previous.week, "previous");
                    }}
                    style={{ flex: 1 }}
                    variant="ghost"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={selectedIndex >= data.weeks.length - 1}
                    onPress={() => {
                      const next = data.weeks[selectedIndex + 1];
                      if (next) select(next.week, "next");
                    }}
                    style={{ flex: 1 }}
                    variant="ghost"
                  >
                    Next
                  </Button>
                </View>
              </Card>
              <Provenance content={selected} />
            </>
          ) : null}
        </>
      )}

      <SafetyCallout>
        Journey is educational and approximate. It does not diagnose, predict outcomes,
        or replace advice from a qualified clinician.
      </SafetyCallout>
    </Screen>
  );
}

export function JourneyScreen({ ownerId }: { ownerId: string }) {
  const query = useJourneyQuery(ownerId);
  const { isOnline } = useNetworkStatus();

  useEffect(() => trackAnalytics("product_screen_viewed", { screen: "journey" }), []);

  if (query.isPending) {
    return (
      <Screen>
        <ProductSkeleton label="Loading Journey" />
      </Screen>
    );
  }
  if (!query.data && !isOnline) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <EmptyState
          description="Connect once to load reviewed content. Flutterings does not persist this sensitive cache to disk."
          title="Journey is unavailable offline"
        />
      </Screen>
    );
  }
  if (query.isError && !query.data) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <ErrorState
          actionLabel="Retry"
          description="No local data was changed."
          onAction={() => {
            trackAnalytics("product_action_selected", { action: "retry" });
            void query.refetch();
          }}
          title="Journey could not load"
        />
      </Screen>
    );
  }
  if (!query.data) {
    return (
      <Screen contentContainerStyle={{ justifyContent: "center" }}>
        <EmptyState
          description="Complete pregnancy setup to browse Journey."
          title="No pregnancy timeline"
        />
      </Screen>
    );
  }
  return <JourneyView data={query.data} isOffline={!isOnline} />;
}
