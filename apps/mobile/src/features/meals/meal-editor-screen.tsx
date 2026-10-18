import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Chip,
  SegmentedControl,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { useMealEditor } from "@/features/meals/use-meal-editor";
import type {
  AppetiteResponse,
  Enjoyment,
  MealType,
  NauseaLevel,
} from "@/features/meals/view-types";
import { useNetworkStatus } from "@/providers/network-provider";
import { journalRepository } from "@/repositories/journal-repository";
import type { MediaUploadJob } from "@/schemas/journal";
import { useTheme } from "@/theme/theme-provider";

const mealTypes = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
  { label: "Snack", value: "snack" },
] as const;
const appetite = [
  { label: "Craving", value: "craving" },
  { label: "Aversion", value: "aversion" },
  { label: "Neither", value: "neutral" },
] as const;
const nausea = [
  { label: "None", value: "none" },
  { label: "A little", value: "a_little" },
  { label: "Moderate", value: "moderate" },
  { label: "A lot", value: "a_lot" },
] as const;
const enjoyment = [
  { label: "Not much", value: "not_enjoyed" },
  { label: "Somewhat", value: "somewhat" },
  { label: "Enjoyed", value: "enjoyed" },
] as const;

function MealPhoto({ job }: { job: MediaUploadJob }) {
  const [remoteUri, setRemoteUri] = useState<string | null>(null);
  const { theme } = useTheme();
  useEffect(() => {
    if (job.status !== "ready") return;
    let active = true;
    void journalRepository
      .getSignedMediaUrl(job.assetId)
      .then((uri) => {
        if (active) setRemoteUri(uri);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [job.assetId, job.status]);
  const uri = job.status === "ready" ? remoteUri : job.localUri;
  return uri ? (
    <Image
      accessibilityLabel="Meal photo preview"
      source={{ uri }}
      style={{ borderRadius: theme.radii.default, height: 180, width: "100%" }}
    />
  ) : null;
}

export function MealEditorScreen({
  mealId,
  ownerId,
  pregnancyId,
}: {
  mealId: string;
  ownerId: string;
  pregnancyId: string;
}) {
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();
  const router = useRouter();
  const editor = useMealEditor({ isOnline, mealId, ownerId, pregnancyId });
  const draft = editor.draft;
  if (!draft)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading meal draft" height={240} />
      </Screen>
    );
  const values = draft.values;
  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="heading1">Log a meal</AppText>
        <AppText color="muted">
          Everything is optional. Notes describe what you observed; they are not medical
          or food-safety advice.
        </AppText>
      </View>
      {!isOnline ? (
        <Card>
          <AppText>Offline · this protected device draft will sync later.</AppText>
        </Card>
      ) : null}
      {editor.error ? (
        <Card>
          <AppText color="danger">{editor.error}</AppText>
        </Card>
      ) : null}
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">Meal type</AppText>
        <SegmentedControl
          accessibilityLabel="Meal type"
          onChange={(mealType: MealType) => editor.update({ mealType })}
          options={mealTypes}
          value={values.mealType}
        />
        <Button onPress={() => editor.update({ mealType: null })} variant="ghost">
          Clear meal type
        </Button>
      </Card>
      <Textarea
        label="Ingredients"
        hint="One per line or separated by commas."
        value={values.ingredients.join("\n")}
        onChangeText={(text) =>
          editor.update({
            ingredients: text
              .split(/[\n,]/)
              .map((item) => item.trim())
              .filter(Boolean),
          })
        }
      />
      <Textarea
        label="Notes"
        hint="Optional free text."
        value={values.freeText}
        onChangeText={(freeText) => editor.update({ freeText })}
      />
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">Craving or aversion</AppText>
        <SegmentedControl
          accessibilityLabel="Craving or aversion"
          onChange={(appetiteResponse: AppetiteResponse) =>
            editor.update({ appetiteResponse })
          }
          options={appetite}
          value={values.appetiteResponse}
        />
        <Button
          onPress={() => editor.update({ appetiteResponse: null })}
          variant="ghost"
        >
          Clear craving or aversion
        </Button>
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">Nausea before</AppText>
        <SegmentedControl
          accessibilityLabel="Nausea before eating"
          onChange={(nauseaBefore: NauseaLevel) => editor.update({ nauseaBefore })}
          options={nausea}
          value={values.nauseaBefore}
        />
        <Button onPress={() => editor.update({ nauseaBefore: null })} variant="ghost">
          Clear nausea before
        </Button>
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">Nausea after</AppText>
        <SegmentedControl
          accessibilityLabel="Nausea after eating"
          onChange={(nauseaAfter: NauseaLevel) => editor.update({ nauseaAfter })}
          options={nausea}
          value={values.nauseaAfter}
        />
        <Button onPress={() => editor.update({ nauseaAfter: null })} variant="ghost">
          Clear nausea after
        </Button>
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">Enjoyment</AppText>
        <SegmentedControl
          accessibilityLabel="Meal enjoyment"
          onChange={(value: Enjoyment) => editor.update({ enjoyment: value })}
          options={enjoyment}
          value={values.enjoyment}
        />
        <Button onPress={() => editor.update({ enjoyment: null })} variant="ghost">
          Clear enjoyment
        </Button>
      </Card>
      <View style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">Would eat again?</AppText>
        <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
          <Chip
            selected={values.wouldEatAgain === true}
            onPress={() => editor.update({ wouldEatAgain: true })}
          >
            Yes
          </Chip>
          <Chip
            selected={values.wouldEatAgain === false}
            onPress={() => editor.update({ wouldEatAgain: false })}
          >
            No
          </Chip>
          <Chip
            selected={values.wouldEatAgain === null}
            onPress={() => editor.update({ wouldEatAgain: null })}
          >
            Not answered
          </Chip>
        </View>
      </View>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading3">Photo</AppText>
        <AppText color="muted" variant="bodySmall">
          Photos use the same private, opaque-path media pipeline as journal images.
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
          <Button onPress={() => void editor.addImage("camera")} variant="secondary">
            Take photo
          </Button>
          <Button onPress={() => void editor.addImage("library")} variant="ghost">
            Choose photo
          </Button>
        </View>
        {draft.media.map((job) => (
          <View key={job.assetId} style={{ gap: theme.spacing.xs }}>
            <MealPhoto job={job} />
            <AppText color="muted" variant="caption">
              Photo {job.status} · {Math.round(job.progress * 100)}%
            </AppText>
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}
            >
              {job.status === "failed" ? (
                <Button onPress={() => void editor.retryMedia(job.assetId)}>
                  Retry photo
                </Button>
              ) : null}
              <Button
                onPress={() => void editor.removeMedia(job.assetId)}
                variant="danger"
              >
                {job.status === "uploading" ? "Cancel and delete" : "Delete photo"}
              </Button>
            </View>
          </View>
        ))}
      </Card>
      <AppText color="muted" variant="caption">
        {draft.status === "synced"
          ? "Saved"
          : draft.status === "conflict"
            ? "Needs conflict review"
            : "Protected draft"}
      </AppText>
      <Button
        onPress={() => {
          void editor.sync();
          router.back();
        }}
      >
        Done
      </Button>
    </Screen>
  );
}
