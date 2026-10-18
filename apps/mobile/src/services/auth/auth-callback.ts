import type { EmailOtpType } from "@supabase/supabase-js";
import * as QueryParams from "expo-auth-session/build/QueryParams";

import { supabase } from "@/services/supabase/client";

const emailOtpTypes = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

export type AuthCallbackPayload =
  | { code: string; kind: "pkce" }
  | { accessToken: string; kind: "session"; refreshToken: string }
  | { kind: "token_hash"; tokenHash: string; type: EmailOtpType };

export function parseAuthCallbackUrl(url: string): AuthCallbackPayload {
  const { errorCode, params } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error("The authentication link was rejected.");

  if (typeof params.code === "string" && params.code) {
    return { code: params.code, kind: "pkce" };
  }

  if (
    typeof params.token_hash === "string" &&
    typeof params.type === "string" &&
    emailOtpTypes.has(params.type as EmailOtpType)
  ) {
    return {
      kind: "token_hash",
      tokenHash: params.token_hash,
      type: params.type as EmailOtpType,
    };
  }

  if (
    typeof params.access_token === "string" &&
    typeof params.refresh_token === "string"
  ) {
    return {
      accessToken: params.access_token,
      kind: "session",
      refreshToken: params.refresh_token,
    };
  }

  throw new Error("The authentication link is incomplete or has expired.");
}

export async function createSessionFromUrl(url: string): Promise<void> {
  const payload = parseAuthCallbackUrl(url);
  const result =
    payload.kind === "pkce"
      ? await supabase.auth.exchangeCodeForSession(payload.code)
      : payload.kind === "token_hash"
        ? await supabase.auth.verifyOtp({
            token_hash: payload.tokenHash,
            type: payload.type,
          })
        : await supabase.auth.setSession({
            access_token: payload.accessToken,
            refresh_token: payload.refreshToken,
          });

  if (result.error) throw result.error;
}
