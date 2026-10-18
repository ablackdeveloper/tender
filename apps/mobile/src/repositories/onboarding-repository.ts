import type { SupabaseClient } from "@supabase/supabase-js";

import type { OnboardingDraft } from "@/schemas/onboarding";
import { supabase } from "@/services/supabase/client";
import { homePreferencesRepository } from "@/repositories/home-preferences-repository";

type OnboardingDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      complete_onboarding: {
        Args: {
          p_appointment_reminders_enabled: boolean;
          p_clinician_confirmed_at: string | null;
          p_display_name: string;
          p_editorial_updates_enabled: boolean;
          p_estimated_due_date: string | null;
          p_lmp_date: string | null;
          p_measurement_system: string;
          p_planning_reminders_enabled: boolean;
          p_pregnancy_id: string;
          p_pregnancy_type: string;
          p_due_date_source: string | null;
          p_theme_preference: string;
          p_timezone: string;
        };
        Returns: string;
      };
    };
    Tables: {
      profiles: {
        Insert: Record<string, never>;
        Relationships: [];
        Row: { onboarding_completed_at: string | null };
        Update: Record<string, never>;
      };
    };
    Views: Record<string, never>;
  };
};

const client = supabase as unknown as SupabaseClient<OnboardingDatabase>;

export const onboardingRepository = {
  async isComplete(): Promise<boolean> {
    const { data, error } = await client
      .from("profiles")
      .select("onboarding_completed_at")
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.onboarding_completed_at);
  },

  async complete(draft: OnboardingDraft): Promise<void> {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("Sign in to finish setup.");
    // Save before marking setup complete so failures keep the setup draft available.
    await homePreferencesRepository.setInitialFocus(auth.user.id, draft.homeFocus);
    const { error } = await client.rpc("complete_onboarding", {
      p_appointment_reminders_enabled: draft.appointmentReminders,
      p_clinician_confirmed_at:
        draft.datingMethod === "clinician" ? new Date().toISOString() : null,
      p_display_name: draft.preferredName,
      p_due_date_source: draft.datingMethod,
      p_editorial_updates_enabled: draft.weeklyUpdates,
      p_estimated_due_date: draft.estimatedDueDate || null,
      p_lmp_date: draft.datingMethod === "lmp" ? draft.pregnancyDate || null : null,
      p_measurement_system: draft.measurementSystem,
      p_planning_reminders_enabled: draft.planningReminders,
      p_pregnancy_id: draft.pregnancyId,
      p_pregnancy_type: draft.pregnancyType,
      p_theme_preference: draft.themePreference,
      p_timezone: draft.timezone,
    });
    if (error) throw error;
  },
};
