import {
  canTransitionPregnancyStatus,
  lifecycleStatusLabel,
  pregnancyLifecycleStatuses,
} from "@tender/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Linking, Switch, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import { CalendarField } from "@/components/ui/calendar-field";
import { useAuth } from "@/providers/auth-provider";
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  SafetyCallout,
} from "@/components/ui";
import type { PregnancyRecord } from "@/features/today-journey/types";
import type { SupportResource } from "@/features/pregnancy-lifecycle/types";
import { todayJourneyKeys } from "@/features/today-journey/queries";
import { pregnancyLifecycleRepository } from "@/repositories/pregnancy-lifecycle-repository";
import { togetherKeys } from "@/features/together/queries";
import { useTheme } from "@/theme/theme-provider";

export function PregnancyLifecycleScreen({
  pregnancy,
}: {
  pregnancy: PregnancyRecord;
}) {
  const { theme } = useTheme();
  const { session } = useAuth();
  const [dueDate, setDueDate] = useState(pregnancy.estimatedDueDate ?? "");
  const [dateBusy, setDateBusy] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [dateSaved, setDateSaved] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(pregnancy.lifecycleStatus);
  const [compassionateMode, setCompassionateMode] = useState(
    pregnancy.compassionateMode,
  );
  const [postpartumMode, setPostpartumMode] = useState(pregnancy.postpartumMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const resourceKinds = useMemo<SupportResource["kind"][]>(
    () => [
      "general",
      ...(status === "loss" ? ["loss" as const] : []),
      ...(status === "birth" ? ["postpartum" as const] : []),
    ],
    [status],
  );
  const resources = useQuery({
    queryKey: ["support-resources", resourceKinds],
    queryFn: () =>
      pregnancyLifecycleRepository.supportResources(
        Intl.DateTimeFormat().resolvedOptions().locale,
        resourceKinds,
      ),
    networkMode: "offlineFirst",
  });
  async function save() {
    setBusy(true);
    setError(false);
    try {
      await pregnancyLifecycleRepository.transition({
        compassionateMode: status === "loss" ? true : compassionateMode,
        postpartumMode: status === "birth" && postpartumMode,
        pregnancyId: pregnancy.id,
        status,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: todayJourneyKeys.all }),
        queryClient.invalidateQueries({ queryKey: togetherKeys.all }),
      ]);
      router.back();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <AppText accessibilityRole="header" variant="heading1">
        Pregnancy settings
      </AppText>
      <AppText color="muted">
        Choose the state that makes Flutterings useful now. A reason, memorial,
        disclosure, or partner notification is never required.
      </AppText>
      {error ? (
        <ErrorState
          title="Change not saved"
          description="Your prior setting and records remain unchanged."
        />
      ) : null}
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Due date</AppText>
        <AppText color="muted">
          You can leave this unset. Memories and Care still work. A date entered here is
          your own record.
        </AppText>
        <CalendarField
          label="Estimated due date"
          value={dueDate}
          optional
          onChange={(value) => {
            setDueDate(value);
            setDateSaved(false);
          }}
        />
        <Button
          variant="secondary"
          loading={dateBusy}
          disabled={dueDate === (pregnancy.estimatedDueDate ?? "")}
          onPress={() => {
            setDateBusy(true);
            setDateError(false);
            setDateSaved(false);
            void pregnancyLifecycleRepository
              .updateDueDate(session?.user.id ?? "", pregnancy.id, dueDate || null)
              .then(async () => {
                await queryClient.invalidateQueries({ queryKey: todayJourneyKeys.all });
                setDateSaved(true);
              })
              .catch(() => setDateError(true))
              .finally(() => setDateBusy(false));
          }}
        >
          Save due date
        </Button>
        {dateSaved ? (
          <AppText accessibilityLiveRegion="polite">Due date saved.</AppText>
        ) : null}
        {dateError ? (
          <ErrorState
            title="Due date not saved"
            description="Check your connection and try again."
          />
        ) : null}
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Status</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {pregnancyLifecycleStatuses.map((option) => {
            const enabled = canTransitionPregnancyStatus(
              pregnancy.lifecycleStatus,
              option,
              pregnancy.statusBeforeArchive,
            );
            return (
              <Chip
                key={option}
                disabled={!enabled}
                selected={status === option}
                onPress={() => {
                  setStatus(option);
                  if (option === "loss") setCompassionateMode(true);
                  if (option !== "birth") setPostpartumMode(false);
                }}
              >
                {lifecycleStatusLabel(option)}
              </Chip>
            );
          })}
        </View>
        <AppText color="muted" variant="bodySmall">
          Paused stops progressive pregnancy presentation without ending the record.
          Archived hides it from the active view without deleting anything. End states
          can be corrected back to Active; an archive restores only its immediately
          previous state.
        </AppText>
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Compassionate setting</AppText>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: theme.sizes.minimumTarget,
          }}
        >
          <AppText style={{ flex: 1 }}>
            Suppress celebratory content, weekly/photo notifications, countdowns, and
            size comparisons
          </AppText>
          <Switch
            accessibilityLabel="Compassionate setting"
            accessibilityRole="switch"
            accessibilityState={{ checked: status === "loss" || compassionateMode }}
            disabled={status === "loss"}
            value={status === "loss" || compassionateMode}
            onValueChange={setCompassionateMode}
          />
        </View>
        <AppText color="muted" variant="bodySmall">
          Your journal, care records, media, plans, and sharing choices are preserved.
          Flutterings does not tell a partner when this changes.
        </AppText>
      </Card>
      {status === "birth" ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">Maternal recovery mode</AppText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: theme.sizes.minimumTarget,
            }}
          >
            <AppText style={{ flex: 1 }}>
              Show a recovery-centered postpartum view
            </AppText>
            <Switch
              accessibilityLabel="Maternal recovery mode"
              accessibilityRole="switch"
              accessibilityState={{ checked: postpartumMode }}
              value={postpartumMode}
              onValueChange={setPostpartumMode}
            />
          </View>
          <AppText color="muted" variant="bodySmall">
            This is additive. It does not replace your pregnancy records or create a
            baby tracker.
          </AppText>
        </Card>
      ) : null}
      <SafetyCallout title="Sharing stays unchanged">
        This status change does not grant, revoke, or notify partner access. Review
        sharing separately if you choose.
      </SafetyCallout>
      <Button variant="ghost" onPress={() => router.push("/(app)/together")}>
        Review sharing
      </Button>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Support resources</AppText>
        {resources.isError ? (
          <ErrorState
            title="Support resources unavailable"
            description="Try again when you have a connection. Your settings can still be saved."
          />
        ) : null}
        {resources.data?.map((resource) => (
          <View key={resource.id} style={{ gap: theme.spacing.xs }}>
            <AppText variant="heading3">{resource.title}</AppText>
            <AppText>{resource.description}</AppText>
            <Button
              variant="secondary"
              onPress={() => void Linking.openURL(resource.actionUri)}
            >
              {resource.actionLabel}
            </Button>
          </View>
        ))}
        {!resources.isLoading && !resources.data?.length ? (
          <EmptyState
            title="No configured resources"
            description="Flutterings will only show published, currently reviewed resources configured for this locale."
          />
        ) : null}
      </Card>
      <Button loading={busy} onPress={() => void save()}>
        Save pregnancy settings
      </Button>
    </Screen>
  );
}
