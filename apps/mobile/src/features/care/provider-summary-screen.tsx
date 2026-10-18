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
  SafetyCallout,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { buildProviderSummary } from "@/features/care/provider-summary";
import { useProviderSummaryCandidates } from "@/features/care/queries";
import { useNetworkStatus } from "@/providers/network-provider";
import {
  printProviderSummary,
  shareProviderSummary,
} from "@/services/care/provider-summary-export";
import { useTheme } from "@/theme/theme-provider";

type ExportState =
  "idle" | "preparing" | "printing" | "sharing" | "shared" | "unavailable" | "error";

const initialEnd = new Date().toISOString().slice(0, 10);
const initialStart = new Date(
  Date.parse(`${initialEnd}T00:00:00.000Z`) - 30 * 86_400_000,
)
  .toISOString()
  .slice(0, 10);

export function ProviderSummaryScreen({
  ownerId,
  pregnancyId,
}: {
  ownerId: string;
  pregnancyId: string;
}) {
  const [end, setEnd] = useState(initialEnd);
  const [start, setStart] = useState(initialStart);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const rangeError =
    !datePattern.test(start) || !datePattern.test(end)
      ? "Use YYYY-MM-DD for both dates."
      : start > end
        ? "The start date must be on or before the end date."
        : undefined;
  const candidates = useProviderSummaryCandidates(ownerId, pregnancyId, start, end);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState("");
  const [exportState, setExportState] = useState<ExportState>("idle");
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();
  const selected = candidates.data?.filter((item) => !excludedIds.has(item.id)) ?? [];
  function generate() {
    if (rangeError) return;
    setSummary(buildProviderSummary({ dateRange: { end, start }, items: selected }));
    setExportState("idle");
  }
  async function print() {
    setExportState("printing");
    try {
      await printProviderSummary(summary);
      setExportState("idle");
    } catch {
      setExportState("error");
    }
  }
  async function share() {
    setExportState("preparing");
    try {
      setExportState("sharing");
      const result = await shareProviderSummary(summary);
      setExportState(result === "shared" ? "shared" : "unavailable");
    } catch {
      setExportState("error");
    }
  }

  if (candidates.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading provider summary options" height={260} />
      </Screen>
    );
  if (candidates.isError)
    return (
      <Screen>
        <ErrorState
          title="Summary inputs unavailable"
          description="Try again when your connection is available."
          actionLabel="Retry"
          onAction={() => void candidates.refetch()}
        />
      </Screen>
    );
  return (
    <Screen>
      <AppText variant="heading1">Provider summary</AppText>
      <AppText color="muted">
        Choose what to include in your summary. Review and edit every line before
        printing or sharing.
      </AppText>
      {!isOnline ? (
        <OfflineState description="Using cached records where available. Review the date range and content carefully." />
      ) : null}
      <SafetyCallout>
        This is user-reported information, not a diagnosis, clinical assessment,
        medication instruction, or complete medical record.
      </SafetyCallout>
      <Card>
        <AppText variant="heading3">Date range</AppText>
        <Field
          autoCapitalize="none"
          error={rangeError}
          label="Start date"
          onChangeText={(value) => {
            setStart(value);
            setSummary("");
          }}
          placeholder="YYYY-MM-DD"
          value={start}
        />
        <Field
          autoCapitalize="none"
          label="End date"
          onChangeText={(value) => {
            setEnd(value);
            setSummary("");
          }}
          placeholder="YYYY-MM-DD"
          value={end}
        />
      </Card>
      {candidates.data?.length === 0 ? (
        <EmptyState
          title="Nothing recorded in this range"
          description="Add questions, check-ins, observations, or medication-list history before preparing a summary."
        />
      ) : null}
      {(["symptom", "observation", "question", "medication"] as const).map(
        (category) => {
          const items =
            candidates.data?.filter((item) => item.category === category) ?? [];
          if (!items.length) return null;
          return (
            <Card key={category} style={{ gap: theme.spacing.sm }}>
              <AppText variant="heading2">
                {category === "medication"
                  ? "Medication list changes as recorded"
                  : `${category[0]?.toUpperCase()}${category.slice(1)}s`}
              </AppText>
              <View style={{ gap: theme.spacing.xs }}>
                {items.map((item) => (
                  <Chip
                    key={item.id}
                    selected={!excludedIds.has(item.id)}
                    onPress={() =>
                      setExcludedIds((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                  >
                    {item.date} · {item.label}
                  </Chip>
                ))}
              </View>
            </Card>
          );
        },
      )}
      <Button disabled={!selected.length || Boolean(rangeError)} onPress={generate}>
        Generate selected summary
      </Button>
      {summary ? (
        <>
          <Textarea
            label="Editable user-reported summary"
            numberOfLines={18}
            value={summary}
            onChangeText={setSummary}
          />
          <Card>
            <AppText color="muted">
              Printing or sharing leaves Flutterings and may expose sensitive
              information to the selected printer, app, recipient, or service. Continue
              only after review.
            </AppText>
          </Card>
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              disabled={
                exportState === "printing" ||
                exportState === "sharing" ||
                exportState === "preparing"
              }
              onPress={() => void print()}
              variant="secondary"
            >
              Print reviewed summary
            </Button>
            <Button
              disabled={
                exportState === "printing" ||
                exportState === "sharing" ||
                exportState === "preparing"
              }
              onPress={() => void share()}
            >
              Share reviewed PDF
            </Button>
          </View>
          {exportState === "preparing" || exportState === "sharing" ? (
            <AppText accessibilityLiveRegion="polite">
              Preparing private PDF and opening the system share sheet…
            </AppText>
          ) : null}
          {exportState === "shared" ? (
            <AppText color="success">The system share sheet closed.</AppText>
          ) : null}
          {exportState === "unavailable" ? (
            <EmptyState
              title="Sharing unavailable"
              description="This platform cannot share a local PDF. Printing may still be available."
            />
          ) : null}
          {exportState === "error" ? (
            <ErrorState
              title="Print or share did not complete"
              description="The editable summary remains on this screen."
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
