import { formatAppointmentTime } from "@/features/care/appointment-time";
import { useQuery } from "@tanstack/react-query";
import { type Href, useRouter } from "expo-router";
import { Linking } from "react-native";
import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  OfflineState,
  SafetyCallout,
  Skeleton,
} from "@/components/ui";
import { useTodayQuery } from "@/features/today-journey/queries";
import {
  RecoveryView,
  type RecoveryAction,
} from "@/features/pregnancy-lifecycle/recovery-view";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { pregnancyLifecycleRepository } from "@/repositories/pregnancy-lifecycle-repository";

export function RecoveryScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const today = useTodayQuery(session?.user.id ?? "");
  const enabled = today.data?.experience.showMaternalRecovery === true;
  const locale = Intl.DateTimeFormat().resolvedOptions().locale;
  const resources = useQuery({
    queryKey: ["recovery-resources", session?.user.id, locale],
    enabled,
    queryFn: () =>
      pregnancyLifecycleRepository.supportResources(locale, ["postpartum"]),
  });
  const destinations: Record<RecoveryAction, Href> = {
    care: "/(app)/care",
    question: "/(app)/appointment-question" as Href,
    plan: { pathname: "/(app)/planning", params: { template: "after-birth" } } as Href,
    support: "/(app)/together",
    reflection: {
      pathname: "/(app)/journal/[entryId]",
      params: { entryId: "new", reflection: "recovery" },
    },
    memories: "/(app)/memories" as Href,
  };
  if (today.isPending)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading recovery space" height={240} />
      </Screen>
    );
  if (today.isError || !today.data)
    return (
      <Screen>
        <ErrorState
          title="Recovery space unavailable"
          description="Your records are unchanged. Try again when connected."
          actionLabel="Retry"
          onAction={() => void today.refetch()}
        />
      </Screen>
    );
  if (!enabled)
    return (
      <Screen>
        <EmptyState
          title="Recovery space is optional"
          description="You can enable support after birth in pregnancy settings. Your memories and care records stay available."
          actionLabel="Pregnancy settings"
          onAction={() => router.push("/(app)/pregnancy-settings")}
        />
      </Screen>
    );
  const appointment = today.data.appointment;
  return (
    <Screen>
      {!isOnline ? (
        <OfflineState description="Showing cached information. Saving plans and care questions needs a connection." />
      ) : null}
      <RecoveryView
        onAction={(action) => router.push(destinations[action])}
        appointmentLabel={
          appointment
            ? `${appointment.title} · ${formatAppointmentTime(appointment.startsAt, appointment.timezone)}`
            : undefined
        }
      />
      <Card>
        <AppText variant="heading2">Reviewed support resources</AppText>
        {resources.isPending ? (
          <AppText>Loading resources…</AppText>
        ) : resources.isError ? (
          <ErrorState
            title="Resources unavailable"
            description="Your personal records are still available."
            actionLabel="Retry resources"
            onAction={() => void resources.refetch()}
          />
        ) : resources.data?.length ? (
          resources.data.map((resource) => (
            <Card key={resource.id}>
              <AppText variant="heading3">{resource.title}</AppText>
              <AppText>{resource.description}</AppText>
              <Button
                variant="ghost"
                onPress={() => void Linking.openURL(resource.actionUri)}
              >
                {resource.actionLabel}
              </Button>
            </Card>
          ))
        ) : (
          <AppText color="muted">
            No reviewed resources are available for this setting yet.
          </AppText>
        )}
      </Card>
      <SafetyCallout>
        Flutterings does not assess recovery or replace your care team. Use Get Help
        when you need contact options.
      </SafetyCallout>
    </Screen>
  );
}
