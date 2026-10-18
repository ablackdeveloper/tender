import { Linking, View } from "react-native";

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
import { getClientEnv } from "@/config/env";
import { useCareContext, useHelpResources } from "@/features/care/queries";
import { useNetworkStatus } from "@/providers/network-provider";
import { useTheme } from "@/theme/theme-provider";

function phoneUri(phone: string): string {
  return `tel:${phone.replace(/[^0-9+*#-]/gu, "")}`;
}

export function GetHelpScreen({
  ownerId,
  pregnancyId,
}: {
  ownerId: string;
  pregnancyId: string;
}) {
  const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
  const enabled = getClientEnv().EXPO_PUBLIC_REVIEWED_CONTENT_ENABLED;
  const resources = useHelpResources(locale, enabled);
  const care = useCareContext(ownerId, pregnancyId);
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();
  if (resources.isLoading || care.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading approved help resources" height={260} />
      </Screen>
    );
  if (resources.isError)
    return (
      <Screen>
        <ErrorState
          title="Approved help content unavailable"
          description="Flutterings will not substitute unreviewed guidance. Use official local emergency services or a number you already trust."
          actionLabel="Retry"
          onAction={() => void resources.refetch()}
        />
      </Screen>
    );
  const phoneProviders = care.data?.providers.filter((item) => item.phone) ?? [];
  const contacts = care.data?.contacts ?? [];
  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText accessibilityRole="header" variant="heading1">
          Get help
        </AppText>
        <AppText color="muted">
          Only currently published, localized content with an active approved clinical
          review can appear here.
        </AppText>
      </View>
      {!isOnline ? (
        <OfflineState description="Showing approved cached content and cached configured numbers where available." />
      ) : null}
      <SafetyCallout urgent>
        Flutterings cannot assess symptoms, diagnose a condition, rank urgency, or tell
        you that you are safe. If you may be in immediate danger, contact your local
        emergency service now.
      </SafetyCallout>
      {!enabled ? (
        <EmptyState
          title="Approved help content is disabled"
          description="No placeholder or unreviewed guidance will be shown. Use official local emergency services or a configured care contact."
        />
      ) : null}
      {enabled && resources.data?.length === 0 ? (
        <EmptyState
          title="No approved localized guidance available"
          description={`No current approved help content is configured for ${locale}. Flutterings will not fill this gap with generated advice.`}
        />
      ) : null}
      {resources.data?.map((resource) => (
        <Card key={resource.id} style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">{resource.title}</AppText>
          <AppText>{resource.body}</AppText>
          {resource.actions.map((action) => (
            <Button
              key={`${resource.id}:${action.uri}`}
              onPress={() => {
                void Linking.openURL(action.uri);
              }}
              variant="danger"
            >
              {action.label}
            </Button>
          ))}
        </Card>
      ))}
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Configured care numbers</AppText>
        {phoneProviders.length === 0 && contacts.length === 0 ? (
          <AppText color="muted">
            No care-team or personal emergency numbers are configured.
          </AppText>
        ) : null}
        {phoneProviders.map((provider) => (
          <Button
            key={provider.id}
            onPress={() => void Linking.openURL(phoneUri(provider.phone))}
            variant="secondary"
          >
            Call {provider.name}
          </Button>
        ))}
        {contacts.map((contact) => (
          <Button
            key={contact.id}
            onPress={() => void Linking.openURL(phoneUri(contact.phone))}
            variant="danger"
          >
            Call {contact.name}
          </Button>
        ))}
      </Card>
    </Screen>
  );
}
