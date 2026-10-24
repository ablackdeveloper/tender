import * as DocumentPicker from "expo-document-picker";
import { File, UploadType, type UploadTask } from "expo-file-system";

import { getClientEnv } from "@/config/env";
import { careRepository } from "@/repositories/care-repository";
import { documentUploadJobSchema, type DocumentUploadJob } from "@/schemas/care";
import { supabase } from "@/services/supabase/client";

const activeTasks = new Map<string, UploadTask>();
const allowedMime = new Set(["application/pdf", "image/jpeg", "image/png"]);
const extensionByMime = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;

function encoded(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export const documentService = {
  async pick(input: {
    appointmentId: string | null;
    documentDate: string | null;
    documentId: string;
    documentType: string;
    objectId: string;
    privacy: "private" | "shared";
    title: string;
  }): Promise<DocumentUploadJob | null> {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: [...allowedMime],
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) throw new Error("document_selection_empty");
    const mimeType = asset.mimeType ?? "";
    if (!allowedMime.has(mimeType)) throw new Error("document_type_not_allowed");
    const file = new File(asset.uri);
    const size = asset.size ?? file.info().size;
    if (!size || size > 52_428_800) throw new Error("document_too_large");
    const extension = extensionByMime[mimeType as keyof typeof extensionByMime];
    return documentUploadJobSchema.parse({
      ...input,
      byteSize: size,
      errorCode: null,
      localUri: asset.uri,
      mimeType,
      objectPath: `${input.documentId}/${input.objectId}.${extension}`,
      progress: 0,
      status: "queued",
    });
  },
  cancel(documentId: string): void {
    activeTasks.get(documentId)?.cancel();
  },
  async upload(input: {
    job: DocumentUploadJob;
    onProgress: (value: number) => void;
    ownerId: string;
    pregnancyId: string;
  }): Promise<void> {
    const job = documentUploadJobSchema.parse(input.job);
    const file = new File(job.localUri);
    if (!file.exists) throw new Error("local_file_missing");
    await careRepository.registerDocument(input.ownerId, input.pregnancyId, job);
    const session = await supabase.auth.getSession();
    if (session.error || !session.data.session) throw new Error("session_unavailable");
    const env = getClientEnv();
    const task = file.createUploadTask(
      `${env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/tender-documents/${encoded(job.objectPath)}`,
      {
        headers: {
          Authorization: `Bearer ${session.data.session.access_token}`,
          apikey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": job.mimeType,
          // Each selected document has a new object key. Pending objects remain
          // unreadable, so this must not request overwrite/SELECT permission.
          "x-upsert": "false",
        },
        httpMethod: "POST",
        mimeType: job.mimeType,
        onProgress: ({ bytesSent, totalBytes }) =>
          input.onProgress(totalBytes > 0 ? Math.min(bytesSent / totalBytes, 1) : 0),
        sessionType: "background",
        uploadType: UploadType.BINARY_CONTENT,
      },
    );
    activeTasks.set(job.documentId, task);
    try {
      const response = await task.uploadAsync();
      if (response.status < 200 || response.status >= 300)
        throw new Error("storage_upload_failed");
      await careRepository.updateDocumentStatus(
        input.ownerId,
        job.documentId,
        "ready",
        null,
      );
      input.onProgress(1);
      if (file.exists) file.delete();
    } catch (error) {
      await careRepository.updateDocumentStatus(
        input.ownerId,
        job.documentId,
        "failed",
        task.state === "cancelled" ? "upload_canceled" : "upload_failed",
      );
      throw error;
    } finally {
      activeTasks.delete(job.documentId);
      task.release();
    }
  },
};
