import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { type Href, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Chip,
  Dialog,
  Field,
  PrivacyBadge,
  SegmentedControl,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { useJournalEditor } from "@/features/journal/use-journal-editor";
import type { JournalTag } from "@/features/journal/types";
import { getClientEnv } from "@/config/env";
import { journalRepository } from "@/repositories/journal-repository";
import type { MediaUploadJob } from "@/schemas/journal";
import { useTheme } from "@/theme/theme-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { recoveryReflectionPrompts } from "@/features/pregnancy-lifecycle/recovery-view";

function VoiceReview({
  job,
  onDelete,
  onKeep,
}: {
  job: MediaUploadJob;
  onDelete: () => void;
  onKeep: () => void;
}) {
  const [remoteUri, setRemoteUri] = useState<string | null>(null);
  useEffect(() => {
    if (job.status !== "ready") return;
    let active = true;
    void journalRepository.getSignedMediaUrl(job.assetId).then((uri) => {
      if (active) setRemoteUri(uri);
    });
    return () => {
      active = false;
    };
  }, [job.assetId, job.status]);
  const player = useAudioPlayer(
    remoteUri ?? (job.status === "ready" ? null : job.localUri),
  );
  const { theme } = useTheme();
  return (
    <Card style={{ gap: theme.spacing.sm }}>
      <AppText variant="heading3">Voice note review</AppText>
      <AppText color="muted" variant="bodySmall">
        Listen before keeping it. No transcription is requested.
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
        <Button onPress={() => player.play()} variant="secondary">
          Play
        </Button>
        <Button onPress={() => player.pause()} variant="ghost">
          Pause
        </Button>
        {job.status === "review" ? (
          <Button onPress={onKeep}>Keep voice note</Button>
        ) : null}
        <Button onPress={onDelete} variant="danger">
          {job.status === "uploading"
            ? "Cancel upload and delete voice note"
            : "Delete voice note"}
        </Button>
      </View>
    </Card>
  );
}

function ImageReview({ job }: { job: MediaUploadJob }) {
  const [remoteUri, setRemoteUri] = useState<string | null>(null);
  useEffect(() => {
    if (job.status !== "ready") return;
    let active = true;
    void journalRepository.getSignedMediaUrl(job.assetId).then((uri) => {
      if (active) setRemoteUri(uri);
    });
    return () => {
      active = false;
    };
  }, [job.assetId, job.status]);
  const uri = remoteUri ?? (job.status === "ready" ? null : job.localUri);
  return uri ? (
    <Image
      accessibilityLabel="Journal photo preview"
      source={{ uri }}
      style={{ borderRadius: 12, height: 180, width: "100%" }}
    />
  ) : null;
}

function VoiceRecorder({ onRecorded }: { onRecorded: (uri: string) => Promise<void> }) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [permissionError, setPermissionError] = useState(false);

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPermissionError(true);
      return;
    }
    setPermissionError(false);
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stop() {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    if (recorder.uri) await onRecorded(recorder.uri);
  }

  return (
    <View>
      <Button
        onPress={() => void (state.isRecording ? stop() : start())}
        variant="secondary"
      >
        {state.isRecording
          ? `Stop recording (${Math.round(state.durationMillis / 1000)}s)`
          : "Record voice note"}
      </Button>
      {permissionError ? (
        <AppText color="danger" variant="bodySmall">
          Microphone permission was not granted.
        </AppText>
      ) : null}
    </View>
  );
}

export function JournalEditorScreen({
  entryId,
  ownerId,
  pregnancyId,
  tags,
  reflectionMode = false,
}: {
  entryId: string;
  ownerId: string;
  pregnancyId: string;
  tags: JournalTag[];
  reflectionMode?: boolean;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const { isOnline } = useNetworkStatus();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const editor = useJournalEditor({ entryId, isOnline, ownerId, pregnancyId });
  const draft = editor.draft;
  if (!draft)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading journal entry" height={280} />
      </Screen>
    );
  const currentEntryId = draft.entryId;

  async function permanentlyDelete() {
    await journalRepository.deleteEntry(ownerId, currentEntryId);
    setDeleteVisible(false);
    router.replace("/(app)/memories" as Href);
  }

  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="heading1">Journal entry</AppText>
        <PrivacyBadge level={draft.privacy} />
        <AppText color="muted" variant="bodySmall">
          {draft.status === "saved"
            ? "Saved"
            : draft.status === "conflict"
              ? "Needs conflict review"
              : "Autosaved on this device"}
        </AppText>
      </View>
      {editor.error ? (
        <Card>
          <AppText color="danger">{editor.error}</AppText>
        </Card>
      ) : null}
      {reflectionMode ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading2">Optional reflection prompts</AppText>
          <AppText color="muted">
            Choose a prompt or write freely. A prompt is added after your existing
            words.
          </AppText>
          {recoveryReflectionPrompts.map((prompt) => (
            <Button
              key={prompt}
              variant="ghost"
              onPress={() =>
                editor.update({
                  body: draft.body.trim()
                    ? `${draft.body}\n\n${prompt}\n`
                    : `${prompt}\n`,
                })
              }
            >
              {prompt}
            </Button>
          ))}
        </Card>
      ) : null}
      {draft.status === "conflict" ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <AppText variant="heading3">This entry changed elsewhere</AppText>
          <AppText>
            Your device draft was preserved. Copy anything needed before reopening the
            saved version.
          </AppText>
          <Button onPress={() => void editor.useSavedVersion()} variant="secondary">
            Use saved version
          </Button>
          <Button onPress={() => void editor.keepDeviceVersion()}>
            Keep device version
          </Button>
        </Card>
      ) : null}
      <Field
        label="Title (optional)"
        maxLength={240}
        onChangeText={(title) => editor.update({ title })}
        value={draft.title}
      />
      <Textarea
        label="Entry"
        maxLength={100000}
        onChangeText={(body) => editor.update({ body })}
        value={draft.body}
      />
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">Privacy for this entry</AppText>
        <SegmentedControl
          accessibilityLabel="Entry privacy"
          onChange={(privacy) => editor.update({ privacy })}
          options={
            [
              { label: "Private", value: "private" },
              { label: "Shared", value: "shared" },
            ] as const
          }
          value={draft.privacy}
        />
        <AppText color="muted" variant="caption">
          Shared is visible only to people with an active journal grant. Revoking the
          grant removes access.
        </AppText>
      </View>
      <Chip
        onPress={() => editor.update({ isFavorite: !draft.isFavorite })}
        selected={draft.isFavorite}
      >
        Favorite
      </Chip>
      <Card style={{ gap: theme.spacing.xs }}>
        <Chip
          onPress={() => editor.update({ resurfaceAllowed: !draft.resurfaceAllowed })}
          selected={draft.resurfaceAllowed}
        >
          Include in gentle memory moments
        </Chip>
        <AppText color="muted" variant="caption">
          Off by default. This does not change sharing. Flutterings will not infer mood
          or meaning from your words.
        </AppText>
      </Card>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="label">Tags</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs }}>
          {tags.map((tag) => (
            <Chip
              key={tag.id}
              onPress={() =>
                editor.update({
                  tagIds: draft.tagIds.includes(tag.id)
                    ? draft.tagIds.filter((id) => id !== tag.id)
                    : [...draft.tagIds, tag.id],
                })
              }
              selected={draft.tagIds.includes(tag.id)}
            >
              {tag.name}
            </Chip>
          ))}
        </View>
      </View>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Photos</AppText>
        <AppText color="muted" variant="bodySmall">
          Images are resized and re-encoded to reduce size and strip metadata where the
          device codec supports it.
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <Button onPress={() => void editor.addImage("camera")} variant="secondary">
            Take photo
          </Button>
          <Button onPress={() => void editor.addImage("library")} variant="secondary">
            Choose photo
          </Button>
        </View>
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Voice notes</AppText>
        <VoiceRecorder onRecorded={editor.addVoice} />
        {!getClientEnv().EXPO_PUBLIC_VOICE_TRANSCRIPTION_ENABLED ? (
          <AppText color="muted" variant="caption">
            Transcription is off until a privacy-reviewed server workflow is available.
          </AppText>
        ) : null}
      </Card>
      {draft.media.map((job) =>
        job.kind === "voice" ? (
          <VoiceReview
            key={job.assetId}
            job={job}
            onDelete={() => void editor.removeMedia(job.assetId)}
            onKeep={() => void editor.keepVoice(job.assetId)}
          />
        ) : (
          <Card key={job.assetId} style={{ gap: theme.spacing.xs }}>
            <AppText variant="heading3">Photo</AppText>
            <ImageReview job={job} />
            <AppText
              color={job.status === "failed" ? "danger" : "muted"}
              variant="bodySmall"
            >
              {job.status === "uploading"
                ? `Uploading ${Math.round(job.progress * 100)}%`
                : job.status}
            </AppText>
            {job.status === "failed" ? (
              <Button
                onPress={() => editor.retryMedia(job.assetId)}
                variant="secondary"
              >
                Retry upload
              </Button>
            ) : null}
            <Button
              onPress={() => void editor.removeMedia(job.assetId)}
              variant="danger"
            >
              {job.status === "uploading"
                ? "Cancel upload and delete photo"
                : "Delete photo"}
            </Button>
          </Card>
        ),
      )}
      <Button disabled={!draft.body.trim()} onPress={() => void editor.sync()}>
        Save now
      </Button>
      {entryId !== "new" ? (
        <Button onPress={() => setDeleteVisible(true)} variant="danger">
          Permanently delete entry
        </Button>
      ) : null}
      <Dialog
        actions={
          <>
            <Button onPress={() => void permanentlyDelete()} variant="danger">
              Delete permanently
            </Button>
            <Button onPress={() => setDeleteVisible(false)} variant="ghost">
              Cancel
            </Button>
          </>
        }
        onClose={() => setDeleteVisible(false)}
        title="Delete journal entry?"
        visible={deleteVisible}
      >
        <AppText>
          This removes the entry and its private media. This action cannot be undone.
        </AppText>
      </Dialog>
    </Screen>
  );
}
