import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, "../..");
const mobile = path.join(root, "apps/mobile");
const repositories = [
  "home-preferences",
  "onboarding",
  "planning",
  "care",
  "today-journey",
  "pregnancy-lifecycle",
  "journal",
  "meal",
  "together",
  "check-in",
  "notification-preferences",
  "add-action-preference",
  "health-sync",
];
const platformModules = [
  "@/config/env",
  "@/providers/auth-provider",
  "@/providers/network-provider",
  "@/providers/app-lock-provider",
  "@/services/journal/journal-media-service",
  "@/services/care/document-service",
  "@/services/care/calendar-service",
  "@/services/care/provider-summary-export",
  "@/services/sharing/partner-sharing-service",
  "@/services/notifications/notification-service",
  "@/services/account/account-data-service",
  "@/services/health/health-data-repository",
  "expo-audio",
  "expo-crypto",
  "react-native-safe-area-context",
];
export async function startServer() {
  const server = await createServer({
    configFile: false,
    root: directory,
    cacheDir: path.join(directory, ".vite"),
    plugins: [
      {
        name: "block-production-client",
        resolveId(source) {
          if (
            source.includes("services/supabase/client") ||
            source === "@supabase/supabase-js"
          )
            throw new Error(
              "Production backend imports are forbidden in the isolated preview.",
            );
          return null;
        },
      },
    ],
    resolve: {
      extensions: [
        ".web.tsx",
        ".web.ts",
        ".web.jsx",
        ".web.js",
        ".mjs",
        ".js",
        ".ts",
        ".tsx",
        ".json",
      ],
      alias: [
        ...repositories.map((name) => ({
          find: `@/repositories/${name}-repository`,
          replacement: path.join(directory, "app-data.ts"),
        })),
        ...[
          "@/services/journal/journal-draft-storage",
          "@/services/meals/meal-draft-storage",
          "@/services/checkins/check-in-draft-storage",
          "@/services/care/question-draft-storage",
          "@/services/onboarding/onboarding-draft-storage",
          "@/services/sharing/partner-sharing-service",
        ].map((find) => ({
          find,
          replacement: path.join(directory, "app-data.ts"),
        })),
        ...platformModules
          .filter(
            (find) => find !== "@/services/sharing/partner-sharing-service",
          )
          .map((find) => ({
            find,
            replacement: path.join(directory, "platform.tsx"),
          })),
        {
          find: "expo-router",
          replacement: path.join(directory, "router.tsx"),
        },
        {
          find: "@tender/domain",
          replacement: path.join(root, "packages/domain/src/index.ts"),
        },
        {
          find: /^react-native$/,
          replacement: path.join(directory, "native-web.ts"),
        },
        ...[
          "react",
          "react-dom",
          "react-native-web",
          "@tanstack/react-query",
        ].map((name) => ({
          find: name,
          replacement: path.join(mobile, "node_modules", name),
        })),
        { find: "@", replacement: path.join(mobile, "src") },
      ],
      dedupe: ["react", "react-dom"],
    },
    server: {
      host: "127.0.0.1",
      port: process.argv.includes("--serve") ? 5173 : 0,
      strictPort: process.argv.includes("--serve"),
      fs: { allow: [root] },
      watch: null,
      headers: {
        "Content-Security-Policy":
          "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:*; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; form-action 'none'",
      },
    },
  });
  await server.listen();
  return { server, url: server.resolvedUrls.local[0] };
}
if (process.argv.includes("--serve")) {
  const { url } = await startServer();
  console.log(`Isolated UI fixture: ${url}`);
}
