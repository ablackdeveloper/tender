import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { resumeJournalUploads } from "@/services/journal/journal-upload-resume";

export function JournalUploadResume() {
  const { session } = useAuth();
  const { isOnline } = useNetworkStatus();
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !isOnline) return;
    void resumeJournalUploads(userId);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void resumeJournalUploads(userId);
    });
    return () => subscription.remove();
  }, [isOnline, session?.user.id]);
  return null;
}
