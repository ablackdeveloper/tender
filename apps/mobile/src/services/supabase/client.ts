import "react-native-url-polyfill/auto";

import { createClient, processLock } from "@supabase/supabase-js";

import { getClientEnv } from "@/config/env";
import { secureAuthStorage } from "@/services/auth/secure-auth-storage";
import type { Database } from "@/services/supabase/database.types";

const env = getClientEnv();

export const supabase = createClient<Database>(
  env.EXPO_PUBLIC_SUPABASE_URL,
  env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: secureAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);
