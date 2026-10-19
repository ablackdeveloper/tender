// Every application route needs an explicit evidence boundary here.
export const screens = [
  ["today", "(app)/index.tsx", "button", "Today preferences"],
  ["planning", "(app)/planning.tsx", "checkbox", "Hospital bag"],
  ["journey", "(app)/journey.tsx", "heading", "Journey"],
  ["care", "(app)/care/index.tsx", "button", "Add appointment record"],
  ["questions", "(app)/appointment-question.tsx", "textbox", "Question"],
  ["recovery", "(app)/recovery.tsx", "button", "Build my support plan"],
  ["together", "(app)/together/index.tsx", "heading", "Together"],
  [
    "reflection",
    "(app)/journal/[entryId].tsx",
    "textbox",
    "Entry",
    "entryId=new",
  ],
  ["memories", "(app)/memories.tsx", "button", "Add a memory"],
  [
    "settings",
    "(app)/pregnancy-settings.tsx",
    "button",
    "Save pregnancy settings",
  ],
  ["summary", "(app)/care/summary.tsx", "button", "Generate selected summary"],
  [
    "notifications",
    "(app)/notification-settings.tsx",
    "button",
    "Save choices",
  ],
  ["privacy", "(app)/privacy-data.tsx", "button", "Create and share export"],
  ["health", "(app)/health-data.tsx", "heading", "Health data"],
  ["checkin", "(app)/check-in.tsx", "button", "Complete check-in"],
  ["meals", "(app)/meals/index.tsx", "button", "Log a meal"],
  [
    "meal",
    "(app)/meals/[mealId].tsx",
    "textbox",
    "Ingredients",
    "mealId=b2000000-0000-4000-8000-000000000001",
  ],
  ["capsule", "(app)/memory-capsule.tsx", "heading", "This week's moments"],
  ["help", "get-help.tsx", "heading", "Get help"],
  [
    "onboarding",
    "onboarding.tsx",
    "button",
    "Not sure yet — skip",
    "noPregnancy=1",
  ],
];
export const otherRoutes = {
  "(app)/add.tsx": {
    status: "browser-flow",
    evidence: "core: actual-add-checkin-and-meal, actual-memory-tags-capsule",
  },
  "(app)/journal/index.tsx": {
    status: "redirect",
    evidence:
      "Native Expo redirect needs device acceptance; Memories screen tested in browser",
  },
  "index.tsx": {
    status: "separate-native-suite",
    evidence:
      "phone-integration: first-use-onboarding and native-session-persists-restart; read the separate native report for results",
  },
  "(auth)/sign-in.tsx": {
    status: "separate-native-suite",
    evidence:
      "phone-integration: email-code-login, invalid-email-code, empty-email, and invalid-email; read the separate native report for results",
  },
  "auth/callback.tsx": {
    status: "separate-native-suite",
    evidence:
      "phone-integration: malformed-callback, first-use-onboarding, and password-replacement; read the separate native report for results",
  },
  "auth/recover.tsx": {
    status: "separate-native-suite",
    evidence:
      "phone-integration: recovery-navigation and recovery-email-request; read the separate native report for results",
  },
  "auth/update-password.tsx": {
    status: "separate-native-suite",
    evidence:
      "phone-integration: password-route-requires-recovery, password-short-and-mismatch, and password-replacement; read the separate native report for results",
  },
  "partner-invitation.tsx": {
    status: "blocked",
    evidence:
      "Invitation acceptance screen needs Auth and Edge runtime; database race tested separately",
  },
  "component-gallery.tsx": {
    status: "internal",
    evidence: "Design reference, not a user flow",
  },
};
export const deviceGaps = [
  "Android Auth, setup, sign-out, deletion, document picker/upload, export share sheet, and microphone denial are separate cases in scripts/phone-integration; this browser report does not certify them",
  "Physical camera/microphone behavior, encrypted device files, interrupted upload retry, and iOS",
  "Push delivery, enrolled biometrics, privacy cover, and OS background behavior",
  "Remaining native routes, screen-reader and large-text acceptance, calendar, and external OAuth providers",
];
