import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "@/providers/auth-provider";
import { useNetworkStatus } from "@/providers/network-provider";
import { resumeMealSync } from "@/services/meals/meal-sync-resume";

export function MealSyncResume() {
  const { session } = useAuth();
  const { isOnline } = useNetworkStatus();
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !isOnline) return;
    void resumeMealSync(userId);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void resumeMealSync(userId);
    });
    return () => subscription.remove();
  }, [isOnline, session?.user.id]);
  return null;
}
