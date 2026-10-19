import { Directory, File, Paths, UploadType, type UploadTask } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

import { getClientEnv } from "@/config/env";
import { journalRepository } from "@/repositories/journal-repository";
import { mediaUploadJobSchema, type MediaUploadJob } from "@/schemas/journal";
import { supabase } from "@/services/supabase/client";

const activeTasks = new Map<string, UploadTask>();
const activeCompletions = new Map<
  string,
  { promise: Promise<void>; resolve: () => void }
>();
const stagingDirectory =
  Platform.OS === "web" ? null : new Directory(Paths.document, "private-media");

function ensureStagingDirectory(): Directory {
  if (!stagingDirectory) throw new Error("native_media_staging_unavailable");
  stagingDirectory.create({ idempotent: true, intermediates: true });
  return stagingDirectory;
}

function encodedObjectPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function stageFile(sourceUri: string, filename: string): Promise<File> {
  const directory = ensureStagingDirectory();
  const destination = new File(directory, filename);
  await new File(sourceUri).copy(destination, { overwrite: true });
  return destination;
}

export const journalMediaService = {
  async cancel(assetId: string): Promise<void> {
    activeTasks.get(assetId)?.cancel();
    await activeCompletions.get(assetId)?.promise;
  },

  deleteLocal(localUri: string): void {
    const file = new File(localUri);
    if (file.exists) file.delete();
  },

  isActive(assetId: string): boolean {
    return activeTasks.has(assetId);
  },

  async prepareImage(input: {
    assetId: string;
    entryId?: string;
    mealId?: string;
    objectId: string;
    source: "camera" | "library";
  }): Promise<MediaUploadJob | null> {
    if (input.source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error("camera_permission_denied");
    }
    const picker =
      input.source === "camera"
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;
    const result = await picker({
      allowsEditing: false,
      exif: false,
      mediaTypes: ["images"],
      quality: 1,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) throw new Error("media_selection_empty");

    const context = ImageManipulator.manipulate(asset.uri);
    if (asset.width > 2048) context.resize({ width: 2048 });
    const rendered = await context.renderAsync();
    // Re-encoding to JPEG drops source EXIF/location metadata where the native
    // codec supports it and bounds size. No source filename enters storage.
    const encoded = await rendered.saveAsync({
      compress: 0.82,
      format: SaveFormat.JPEG,
    });
    const file = await stageFile(encoded.uri, `${input.assetId}.jpg`);
    const size = file.info().size;
    if (!size || size > 52_428_800) {
      if (file.exists) file.delete();
      throw new Error("media_too_large");
    }
    return mediaUploadJobSchema.parse({
      assetId: input.assetId,
      byteSize: size,
      errorCode: null,
      journalEntryId: input.entryId ?? null,
      mealId: input.mealId ?? null,
      kind: "image",
      localUri: file.uri,
      mimeType: "image/jpeg",
      objectPath: `${input.assetId}/${input.objectId}.jpg`,
      progress: 0,
      status: "queued",
    });
  },

  async stageVoice(input: {
    assetId: string;
    entryId: string;
    objectId: string;
    uri: string;
  }): Promise<MediaUploadJob> {
    const extension = Platform.OS === "web" ? "webm" : "m4a";
    const mimeType = Platform.OS === "web" ? "audio/webm" : "audio/mp4";
    const file = await stageFile(input.uri, `${input.assetId}.${extension}`);
    const size = file.info().size;
    if (!size || size > 52_428_800) {
      if (file.exists) file.delete();
      throw new Error("media_too_large");
    }
    return mediaUploadJobSchema.parse({
      assetId: input.assetId,
      byteSize: size,
      errorCode: null,
      journalEntryId: input.entryId,
      mealId: null,
      kind: "voice",
      localUri: file.uri,
      mimeType,
      objectPath: `${input.assetId}/${input.objectId}.${extension}`,
      progress: 0,
      status: "review",
    });
  },

  async upload(input: {
    job: MediaUploadJob;
    onProgress: (progress: number) => void;
    ownerId: string;
    pregnancyId: string;
  }): Promise<void> {
    const job = mediaUploadJobSchema.parse(input.job);
    const localFile = new File(job.localUri);
    if (!localFile.exists) {
      await journalRepository.updateMediaStatus(
        input.ownerId,
        job.assetId,
        "failed",
        "local_file_missing",
      );
      throw new Error("local_file_missing");
    }
    await journalRepository.registerMedia(input.ownerId, input.pregnancyId, job);
    const sessionResult = await supabase.auth.getSession();
    if (sessionResult.error || !sessionResult.data.session)
      throw new Error("session_unavailable");
    const env = getClientEnv();
    const url = `${env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/tender-media/${encodedObjectPath(job.objectPath)}`;
    const task = localFile.createUploadTask(url, {
      headers: {
        Authorization: `Bearer ${sessionResult.data.session.access_token}`,
        apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": job.mimeType,
        // New private assets use unique keys. Never require read access to a
        // pending object or overwrite bytes after an uncertain earlier attempt.
        "x-upsert": "false",
      },
      httpMethod: "POST",
      mimeType: job.mimeType,
      onProgress: ({ bytesSent, totalBytes }) =>
        input.onProgress(totalBytes > 0 ? Math.min(bytesSent / totalBytes, 1) : 0),
      sessionType: "background",
      uploadType: UploadType.BINARY_CONTENT,
    });
    let resolveCompletion: () => void = () => void 0;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });
    activeTasks.set(job.assetId, task);
    activeCompletions.set(job.assetId, {
      promise: completion,
      resolve: resolveCompletion,
    });
    try {
      const result = await task.uploadAsync();
      if (result.status < 200 || result.status >= 300)
        throw new Error("storage_upload_failed");
      await journalRepository.updateMediaStatus(
        input.ownerId,
        job.assetId,
        "ready",
        null,
      );
      input.onProgress(1);
      this.deleteLocal(job.localUri);
    } catch (error) {
      const canceled = task.state === "cancelled";
      await journalRepository.updateMediaStatus(
        input.ownerId,
        job.assetId,
        "failed",
        canceled ? "upload_canceled" : "upload_failed",
      );
      throw error;
    } finally {
      activeTasks.delete(job.assetId);
      activeCompletions.get(job.assetId)?.resolve();
      activeCompletions.delete(job.assetId);
      task.release();
    }
  },
};
