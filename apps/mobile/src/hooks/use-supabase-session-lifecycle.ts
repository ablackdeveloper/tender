import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import { supabase } from "@/services/supabase/client";

export function useSupabaseSessionLifecycle(): void {
  useEffect(() => {
    if (Platform.OS === "web") return undefined;

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
      } else {
        supabase.auth.stopAutoRefresh();
      }
    });

    if (AppState.currentState === "active") {
      supabase.auth.startAutoRefresh();
    }

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
}
