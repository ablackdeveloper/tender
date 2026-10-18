import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/services/supabase/client";

type ConnectionRow = {
  id: string;
  owner_id: string;
  platform: "apple_health" | "health_connect";
  status: "active" | "disconnected" | "unavailable";
  storage_opt_in: boolean;
};
type SummaryRow = { id: string; owner_id: string };
type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};
type HealthDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      disconnect_and_delete_health_data: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Tables: {
      health_connections: Table<ConnectionRow>;
      health_daily_summaries: Table<SummaryRow>;
    };
    Views: Record<string, never>;
  };
};

const client = supabase as unknown as SupabaseClient<HealthDatabase>;

export type HealthSyncState = {
  activePlatform: ConnectionRow["platform"] | null;
  storedSummaryCount: number;
  storageOptIn: boolean;
};

export const healthSyncRepository = {
  async disconnectAndDelete(): Promise<number> {
    const { data, error } = await client.rpc("disconnect_and_delete_health_data");
    if (error) throw error;
    return data ?? 0;
  },

  async getState(ownerId: string): Promise<HealthSyncState> {
    const [connectionResult, summaryResult] = await Promise.all([
      client
        .from("health_connections")
        .select("id,owner_id,platform,status,storage_opt_in")
        .eq("owner_id", ownerId)
        .eq("status", "active")
        .maybeSingle(),
      client
        .from("health_daily_summaries")
        .select("id,owner_id", { count: "exact", head: true })
        .eq("owner_id", ownerId),
    ]);
    if (connectionResult.error) throw connectionResult.error;
    if (summaryResult.error) throw summaryResult.error;
    return {
      activePlatform: connectionResult.data?.platform ?? null,
      storedSummaryCount: summaryResult.count ?? 0,
      storageOptIn: connectionResult.data?.storage_opt_in ?? false,
    };
  },
};
