import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  OfflineState,
  PrivacyBadge,
  SafetyCallout,
  SegmentedControl,
} from "@/components/ui";
import { permissionCopy, previewPartnerItems } from "@/features/together/access-model";
import { togetherKeys } from "@/features/together/queries";
import {
  togetherPermissions,
  type TogetherContext,
  type TogetherPermission,
} from "@/features/together/types";
import { useNetworkStatus } from "@/providers/network-provider";
import { planningRepository } from "@/repositories/planning-repository";
import { togetherRepository } from "@/repositories/together-repository";
import { partnerSharingService } from "@/services/sharing/partner-sharing-service";
import { useTheme } from "@/theme/theme-provider";

type Mode = "shared" | "access" | "history";
const supportChoices = [
  "Listen",
  "Practical help",
  "Food or water",
  "Quiet or space",
] as const;

function toggle(current: TogetherPermission[], value: TogetherPermission) {
  return current.includes(value)
    ? current.filter((permission) => permission !== value)
    : [...current, value];
}

export function TogetherScreen({ context }: { context: TogetherContext }) {
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("shared");
  const [email, setEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<TogetherPermission[]>([]);
  const partner = context.members.find(
    (member) => member.userId !== context.ownerId && member.status === "active",
  );
  const [supportChoice, setSupportChoice] = useState<string | null>(null);
  const [customSupport, setCustomSupport] = useState("");
  const currentPermissions = partner
    ? context.grants
        .filter((grant) => grant.granteeUserId === partner.userId)
        .flatMap((grant) =>
          togetherPermissions.includes(grant.permission as TogetherPermission)
            ? [grant.permission as TogetherPermission]
            : [],
        )
    : [];
  const [permissionDraft, setPermissionDraft] =
    useState<TogetherPermission[]>(currentPermissions);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = async () =>
    queryClient.invalidateQueries({ queryKey: togetherKeys.all });
  async function run(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch {
      setError(
        "The sharing change was not authorized or could not be saved. Existing database access is unchanged.",
      );
    } finally {
      setBusy(false);
    }
  }
  const preview = partner
    ? previewPartnerItems(context, partner.userId, permissionDraft)
    : context.items;

  return (
    <Screen>
      <AppText accessibilityRole="header" variant="heading1">
        Together
      </AppText>
      <AppText color="muted">
        Choose which records each person can view. An invitation alone does not give
        access to your private records.
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        <Button onPress={() => router.push("/(app)/planning")} variant="secondary">
          Open plans
        </Button>
        <Button
          onPress={() => router.push("/(app)/notification-settings")}
          variant="ghost"
        >
          Notification choices
        </Button>
      </View>
      {!isOnline ? (
        <OfflineState description="Showing cached access where available. Sharing changes require a connection." />
      ) : null}
      {error ? (
        <ErrorState title="Permission change not completed" description={error} />
      ) : null}
      {message ? (
        <AppText accessibilityLiveRegion="polite" color="success">
          {message}
        </AppText>
      ) : null}
      {context.isOwner && context.notifications.some((item) => !item.readAt) ? (
        <Card style={{ gap: theme.spacing.xs }}>
          <AppText accessibilityLiveRegion="polite" variant="heading3">
            Sensitive access update
          </AppText>
          <AppText>
            {context.notifications.filter((item) => !item.readAt).length} unread sharing
            notification
            {context.notifications.filter((item) => !item.readAt).length === 1
              ? ""
              : "s"}
            .
          </AppText>
          <Button onPress={() => setMode("history")} variant="secondary">
            Review access history
          </Button>
        </Card>
      ) : null}
      {context.isOwner ? (
        <Card elevated style={{ gap: theme.spacing.sm }}>
          <AppText color="muted" variant="label">
            ASK FOR SUPPORT
          </AppText>
          <AppText variant="heading2">What would help right now?</AppText>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}
          >
            {supportChoices.map((choice) => (
              <Chip
                key={choice}
                disabled={busy || !isOnline}
                onPress={() => setSupportChoice(choice)}
                selected={supportChoice === choice}
              >
                {choice}
              </Chip>
            ))}
            <Chip
              disabled={busy || !isOnline}
              onPress={() => setSupportChoice("Custom")}
              selected={supportChoice === "Custom"}
            >
              Custom request
            </Chip>
          </View>
          {supportChoice === "Custom" ? (
            <Field
              label="Short request"
              maxLength={240}
              onChangeText={setCustomSupport}
              value={customSupport}
            />
          ) : null}
          <Button
            disabled={
              busy ||
              !isOnline ||
              !partner ||
              !supportChoice ||
              (supportChoice === "Custom" && !customSupport.trim())
            }
            loading={busy}
            onPress={() => {
              const title =
                supportChoice === "Custom" ? customSupport.trim() : supportChoice;
              if (!title || !partner) return;
              void run(async () => {
                await planningRepository.addSupportRequest(
                  context.ownerId,
                  context.pregnancyId,
                  title,
                  partner.userId,
                );
                setSupportChoice(null);
                setCustomSupport("");
              }, "Support request sent without sharing other private records.");
            }}
          >
            Send request
          </Button>
          {!partner ? (
            <AppText color="muted" variant="bodySmall">
              Connect one support person in Access before sending a request.
            </AppText>
          ) : (
            <AppText color="muted" variant="caption">
              This shares only the request text and its status.
            </AppText>
          )}
        </Card>
      ) : null}
      <SegmentedControl
        accessibilityLabel="Together section"
        onChange={setMode}
        options={[
          { label: "Shared", value: "shared" },
          { label: "Access", value: "access" },
          { label: "History", value: "history" },
        ]}
        value={mode}
      />

      {mode === "shared" ? (
        <>
          {context.isOwner && partner ? (
            <SafetyCallout>
              Preview shows the selected category draft plus saved item exclusions. Save
              category changes before treating this as the partner’s current access.
            </SafetyCallout>
          ) : null}
          {preview.length === 0 ? (
            <EmptyState
              title="Nothing shared here"
              description={
                context.isOwner
                  ? "Connect a partner and choose categories. Journal entries must also be marked Shared."
                  : "The owner has not shared appointments, tasks, support requests, or journal items with you."
              }
            />
          ) : null}
          {togetherPermissions.map((permission) => {
            const items = preview.filter((item) => item.permission === permission);
            if (!items.length) return null;
            return (
              <Card key={permission} style={{ gap: theme.spacing.sm }}>
                <AppText variant="heading2">{permissionCopy[permission].label}</AppText>
                {items.map((item) => (
                  <View key={item.id} style={{ gap: theme.spacing.xxs }}>
                    <AppText variant="heading3">{item.title}</AppText>
                    {item.date ? <AppText color="muted">{item.date}</AppText> : null}
                    {item.subtitle ? <AppText>{item.subtitle}</AppText> : null}
                    <PrivacyBadge level="shared" />
                    {!context.isOwner && item.resourceType === "support_request" ? (
                      <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
                        {item.subtitle === "open" ? (
                          <>
                            <Button
                              onPress={() =>
                                void run(
                                  () =>
                                    togetherRepository.respondToSupportRequest(
                                      item.id,
                                      "accept",
                                    ),
                                  "Support request accepted.",
                                )
                              }
                              variant="secondary"
                            >
                              Accept
                            </Button>
                            <Button
                              onPress={() =>
                                void run(
                                  () =>
                                    togetherRepository.respondToSupportRequest(
                                      item.id,
                                      "decline",
                                    ),
                                  "Support request declined.",
                                )
                              }
                              variant="ghost"
                            >
                              Decline
                            </Button>
                          </>
                        ) : item.subtitle === "accepted" ? (
                          <Button
                            onPress={() =>
                              void run(
                                () =>
                                  togetherRepository.respondToSupportRequest(
                                    item.id,
                                    "resolve",
                                  ),
                                "Support request marked resolved.",
                              )
                            }
                            variant="secondary"
                          >
                            Mark resolved
                          </Button>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                ))}
              </Card>
            );
          })}
        </>
      ) : null}

      {mode === "access" && context.isOwner ? (
        <>
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading2">Invite someone</AppText>
            <Field
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              label="Email"
              onChangeText={setEmail}
              value={email}
            />
            {togetherPermissions.map((permission) => (
              <View key={permission} style={{ gap: theme.spacing.xxs }}>
                <Chip
                  disabled={busy || !isOnline}
                  onPress={() =>
                    setInvitePermissions((current) => toggle(current, permission))
                  }
                  selected={invitePermissions.includes(permission)}
                >
                  {permissionCopy[permission].label}
                </Chip>
                <AppText color="muted" variant="bodySmall">
                  {permissionCopy[permission].impact}
                </AppText>
              </View>
            ))}
            <AppText color="muted" variant="bodySmall">
              Basic pregnancy and membership context is shared while connected. No
              medication, document, check-in, meal, or private journal access is
              implied.
            </AppText>
            <Button
              disabled={busy || !isOnline || !email.trim()}
              onPress={() =>
                void run(
                  () =>
                    partnerSharingService.invite({
                      email,
                      permissions: invitePermissions,
                      pregnancyId: context.pregnancyId,
                      role: "partner",
                    }),
                  "If the invitation can be delivered, it will arrive with the same response whether or not the address has an account.",
                )
              }
            >
              Send private invitation
            </Button>
          </Card>
          {context.invitations
            .filter((invitation) => invitation.status === "pending")
            .map((invitation) => (
              <Card key={invitation.id} style={{ gap: theme.spacing.sm }}>
                <AppText variant="heading3">Pending invitation</AppText>
                <AppText>{invitation.email}</AppText>
                <AppText color="muted">Expires {invitation.expiresAt}</AppText>
                <Button
                  disabled={busy || !isOnline}
                  onPress={() =>
                    void run(
                      () => partnerSharingService.revokeInvitation(invitation.id),
                      "The pending invitation was revoked.",
                    )
                  }
                  variant="danger"
                >
                  Revoke invitation
                </Button>
              </Card>
            ))}
          {partner ? (
            <Card style={{ gap: theme.spacing.sm }}>
              <AppText variant="heading2">Partner category access</AppText>
              {togetherPermissions.map((permission) => (
                <View key={permission} style={{ gap: theme.spacing.xxs }}>
                  <Chip
                    disabled={busy || !isOnline}
                    onPress={() =>
                      setPermissionDraft((current) => toggle(current, permission))
                    }
                    selected={permissionDraft.includes(permission)}
                  >
                    {permissionCopy[permission].label}
                  </Chip>
                  <AppText color="muted" variant="bodySmall">
                    {permissionCopy[permission].impact}
                  </AppText>
                </View>
              ))}
              <Button
                disabled={busy || !isOnline}
                onPress={() =>
                  void run(
                    () =>
                      partnerSharingService.setPermissions(
                        partner.userId,
                        permissionDraft,
                        context.pregnancyId,
                      ),
                    "Category permissions were saved and apply on the partner's next database request.",
                  )
                }
              >
                Save category access
              </Button>
              <Button
                disabled={busy || !isOnline}
                onPress={() =>
                  void run(
                    () =>
                      partnerSharingService.revokePartner(
                        partner.userId,
                        context.pregnancyId,
                      ),
                    "Partner membership and all active grants were revoked.",
                  )
                }
                variant="danger"
              >
                Revoke all partner access
              </Button>
            </Card>
          ) : null}
          {partner && permissionDraft.length ? (
            <Card style={{ gap: theme.spacing.sm }}>
              <AppText variant="heading2">Item-level exclusions</AppText>
              <AppText color="muted">
                Category access is required first. Turning an item off adds a database
                denial and can never grant a broader category.
              </AppText>
              {context.items
                .filter((item) => permissionDraft.includes(item.permission))
                .map((item) => {
                  const visible = !context.overrides.some(
                    (override) =>
                      override.granteeUserId === partner.userId &&
                      override.resourceId === item.id &&
                      !override.allowed,
                  );
                  return (
                    <Chip
                      key={item.id}
                      disabled={busy || !isOnline}
                      onPress={() =>
                        void run(
                          () =>
                            partnerSharingService.setItemOverride({
                              allowed: !visible,
                              granteeUserId: partner.userId,
                              permission: item.permission,
                              pregnancyId: context.pregnancyId,
                              resourceId: item.id,
                              resourceType: item.resourceType,
                            }),
                          "Item-level access changed at the database.",
                        )
                      }
                      selected={visible}
                    >
                      {visible ? "Visible: " : "Hidden: "}
                      {item.title}
                    </Chip>
                  );
                })}
            </Card>
          ) : null}
        </>
      ) : null}

      {mode === "access" && !context.isOwner ? (
        <Card>
          <AppText variant="heading2">Your current access</AppText>
          <AppText color="muted">
            The owner controls category and item access. Revocation takes effect in RLS
            on your next request, including cached-query refreshes.
          </AppText>
        </Card>
      ) : null}

      {mode === "history" ? (
        context.isOwner ? (
          <>
            {context.notifications
              .filter((item) => !item.readAt)
              .map((item) => (
                <Card key={item.id} style={{ gap: theme.spacing.xs }}>
                  <AppText variant="heading3">{item.title}</AppText>
                  <AppText>{item.body}</AppText>
                  <Button
                    onPress={() =>
                      void run(
                        () => togetherRepository.markNotificationRead(item.id),
                        "Notification marked as read.",
                      )
                    }
                    variant="ghost"
                  >
                    Mark read
                  </Button>
                </Card>
              ))}
            {context.history.length === 0 ? (
              <EmptyState
                title="No access changes yet"
                description="Invitation, category, item, acceptance, and revocation events appear here without IP addresses or sensitive record values."
              />
            ) : null}
            {context.history.map((event) => (
              <Card key={event.id}>
                <AppText variant="heading3">
                  {event.eventType.replaceAll(".", " ")}
                </AppText>
                <AppText color="muted">{event.occurredAt}</AppText>
                <AppText>{event.resourceType.replaceAll("_", " ")}</AppText>
              </Card>
            ))}
          </>
        ) : (
          <EmptyState
            title="History belongs to the owner"
            description="Your current shared rows remain limited by active database grants."
          />
        )
      ) : null}
    </Screen>
  );
}
