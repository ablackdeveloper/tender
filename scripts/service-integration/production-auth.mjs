import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { workspace } from "./harness.mjs";

// Native browser launch/redirect generation are platform boundaries. All auth
// requests, callback parsing, Supabase SDK behavior, and sessions are real.
export function productionAuth(client, redirect) {
  const mobileRequire = createRequire(
    path.join(workspace, "apps/mobile/package.json"),
  );
  const ts = mobileRequire("typescript");
  const cache = new Map();
  const load = (file) => {
    if (!path.extname(file)) file += ".ts";
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const customRequire = (name) => {
      if (name === "@/services/supabase/client") return { supabase: client };
      if (name === "@/config/env")
        return {
          getClientEnv: () => ({
            EXPO_PUBLIC_AUTH_APPLE_ENABLED: false,
            EXPO_PUBLIC_AUTH_GOOGLE_ENABLED: false,
          }),
        };
      if (name === "@/services/analytics/analytics")
        return { trackAnalytics() {} };
      if (name === "expo-auth-session")
        return { makeRedirectUri: () => redirect };
      if (name === "expo-web-browser")
        return {
          maybeCompleteAuthSession() {},
          openAuthSessionAsync() {
            throw new Error("Native browser launch is not available");
          },
        };
      if (name === "expo-auth-session/build/QueryParams")
        return load(mobileRequire.resolve(name));
      if (name.startsWith("@/"))
        return load(path.join(workspace, "apps/mobile/src", name.slice(2)));
      return mobileRequire(name);
    };
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        allowJs: true,
      },
      fileName: file,
    });
    new vm.Script(`(function(require,module,exports){${outputText}\n})`, {
      filename: file,
    }).runInThisContext()(customRequire, module, module.exports);
    return module.exports;
  };
  return {
    ...load(
      path.join(workspace, "apps/mobile/src/services/auth/auth-service.ts"),
    ),
    ...load(
      path.join(workspace, "apps/mobile/src/services/auth/auth-callback.ts"),
    ),
  };
}
