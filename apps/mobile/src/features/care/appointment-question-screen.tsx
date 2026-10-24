import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
  Skeleton,
  Textarea,
} from "@/components/ui";
import { careKeys, useCareContext } from "@/features/care/queries";
import { QuestionPromptPicker } from "@/features/care/question-prompt-picker";
import { todayJourneyQueries } from "@/features/today-journey/queries";
import { useJournalContext } from "@/features/journal/queries";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { careRepository } from "@/repositories/care-repository";
import {
  questionDraftStorage,
  type QuestionDraft,
} from "@/services/care/question-draft-storage";
import { useTheme } from "@/theme/theme-provider";

export function AppointmentQuestionScreen() {
  const { session } = useAuth();
  const ownerId = session?.user.id ?? "";
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();
  const router = useRouter();
  const { article } = useLocalSearchParams<{ article?: string }>();
  const journey = useQuery({
    ...todayJourneyQueries.journey(ownerId),
    enabled: Boolean(article && ownerId),
  });
  const sourceArticle = journey.data?.experience.showWeeklyContent
    ? journey.data.weeks.find((item) => item.articleId === article)
    : undefined;
  const queryClient = useQueryClient();
  const journalContext = useJournalContext(ownerId);
  const [recoveredPregnancyId, setRecoveredPregnancyId] = useState("");
  const pregnancyId = journalContext.data?.pregnancyId ?? recoveredPregnancyId;
  const care = useCareContext(ownerId, pregnancyId);
  const [currentTime] = useState(Date.now);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promptNotice, setPromptNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftError, setDraftError] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    if (!ownerId || journalContext.data?.pregnancyId || isOnline) return;
    let active = true;
    void questionDraftStorage
      .load(ownerId)
      .then((stored) => {
        if (active && stored) setRecoveredPregnancyId(stored.pregnancyId);
      })
      .catch(() => {
        if (active) setDraftError(true);
      });
    return () => {
      active = false;
    };
  }, [ownerId, journalContext.data?.pregnancyId, isOnline, loadAttempt]);
  const draftRef = useRef<QuestionDraft>({
    pregnancyId,
    appointmentId: null,
    question: "",
    priority: 1,
  });
  useEffect(() => {
    if (!ownerId || !pregnancyId) return;
    let active = true;
    void questionDraftStorage
      .load(ownerId, pregnancyId)
      .then((stored) => {
        if (!active) return;
        const value = stored ?? {
          pregnancyId,
          appointmentId: null,
          question: "",
          priority: 1 as const,
        };
        draftRef.current = value;
        setAppointmentId(value.appointmentId);
        setQuestion(value.question);
        setPriority(value.priority);
        setDraftReady(true);
        setDraftSaved(Boolean(stored));
        setDraftError(false);
      })
      .catch(() => {
        if (active) setDraftError(true);
      });
    return () => {
      active = false;
    };
  }, [ownerId, pregnancyId, loadAttempt]);
  function changeDraft(patch: Partial<QuestionDraft>) {
    const value = { ...draftRef.current, ...patch, pregnancyId };
    draftRef.current = value;
    setAppointmentId(value.appointmentId);
    setQuestion(value.question);
    setPriority(value.priority);
    setDraftSaved(false);
    setDraftError(false);
    void questionDraftStorage
      .save(ownerId, value)
      .then(() => setDraftSaved(true))
      .catch(() => setDraftError(true));
  }
  function choosePrompt(prompt: string) {
    const combined = question.trim() ? `${question.trim()}\n\n${prompt}` : prompt;
    if (combined.length > 2000) {
      setPromptNotice(
        "There is not enough space. Shorten your question before adding this prompt.",
      );
      return;
    }
    changeDraft({ question: combined });
    setPromptNotice(
      "Prompt added. Your existing words were kept. Review the question before saving.",
    );
  }

  if ((journalContext.isLoading || care.isLoading) && !draftReady) {
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading appointments" height={220} />
      </Screen>
    );
  }
  if ((journalContext.isError || care.isError || !care.data) && !draftReady) {
    return (
      <Screen>
        <ErrorState
          actionLabel="Retry"
          description="Your question was not changed."
          onAction={() => {
            setLoadAttempt((value) => value + 1);
            void care.refetch();
            void journalContext.refetch();
          }}
          title="Appointments unavailable"
        />
      </Screen>
    );
  }

  const upcoming = (care.data?.appointments ?? []).filter(
    (item) =>
      item.status !== "cancelled" &&
      Date.parse(item.startsAt) >= currentTime - 86_400_000,
  );

  async function save() {
    if (saving || !isOnline || !appointmentId || !question.trim()) return;
    setSaving(true);
    setError(false);
    try {
      const appointment = upcoming.find((item) => item.id === appointmentId);
      await careRepository.addQuestion(
        ownerId,
        appointmentId,
        question,
        appointment?.questions.length ?? 0,
        priority,
      );
      await questionDraftStorage.clear(ownerId, pregnancyId);
      await queryClient.invalidateQueries({ queryKey: careKeys.all });
      router.replace("/(app)/care");
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          disabled={
            !draftReady ||
            !isOnline ||
            !upcoming.some((item) => item.id === appointmentId) ||
            !question.trim()
          }
          loading={saving}
          onPress={() => void save()}
        >
          Save question
        </Button>
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <AppText accessibilityRole="header" variant="heading1">
          Appointment question
        </AppText>
        <AppText color="muted">
          Save one thought for your next visit. Flutterings does not answer it or give
          medical advice.
        </AppText>
      </View>
      {!isOnline ? (
        <OfflineState description="You can keep writing. Your device draft will remain here. Connect to save it to your care record." />
      ) : null}
      {draftSaved ? (
        <AppText accessibilityLiveRegion="polite" color="muted">
          Question draft saved on this device.
        </AppText>
      ) : null}
      {draftError ? (
        <ErrorState
          title="Question draft unavailable"
          description="Keep this screen open. Check device storage and try again."
          actionLabel="Retry draft"
          onAction={() => {
            if (draftReady) changeDraft({});
            else setLoadAttempt((value) => value + 1);
          }}
        />
      ) : null}
      {error ? (
        <ErrorState
          description="The question is still on this screen. Try again when connected."
          title="Question not saved"
        />
      ) : null}
      {upcoming.length === 0 ? (
        <EmptyState
          description="Add an appointment in Care before saving a question."
          title="No upcoming appointment"
          actionLabel="Open Care"
          onAction={() => router.push("/(app)/care")}
        />
      ) : (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">Choose the visit</AppText>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}
          >
            {upcoming.map((item) => (
              <Chip
                key={item.id}
                disabled={!draftReady || saving}
                onPress={() => changeDraft({ appointmentId: item.id })}
                selected={appointmentId === item.id}
              >
                {item.title}
              </Chip>
            ))}
          </View>
        </Card>
      )}
      {sourceArticle ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">From your weekly reading</AppText>
          <AppText>
            {sourceArticle.title} · Version {sourceArticle.version}
          </AppText>
          <Button
            variant="secondary"
            disabled={saving}
            onPress={() =>
              choosePrompt(
                `I read "${sourceArticle.title}" (version ${sourceArticle.version}). What would be useful to discuss about this at my visit?`,
              )
            }
          >
            Use this reading as a starting point
          </Button>
        </Card>
      ) : null}
      <QuestionPromptPicker onChoose={choosePrompt} disabled={saving || !draftReady} />
      {promptNotice ? (
        <AppText accessibilityLiveRegion="polite" color="muted">
          {promptNotice}
        </AppText>
      ) : null}
      <Textarea
        label="Question"
        maxLength={2000}
        editable={!saving && draftReady}
        onChangeText={(question) => changeDraft({ question })}
        placeholder="What do you want to ask?"
        value={question}
      />
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Priority</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {(
            [
              { label: "Must ask", value: 1 },
              { label: "If time", value: 2 },
              { label: "Optional", value: 3 },
            ] as const
          ).map((option) => (
            <Chip
              key={option.value}
              disabled={!draftReady || saving}
              onPress={() => changeDraft({ priority: option.value })}
              selected={priority === option.value}
            >
              {option.label}
            </Chip>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
