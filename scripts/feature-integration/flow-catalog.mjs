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
    status: "blocked",
    evidence: "Native session and onboarding redirect need Auth runtime",
  },
  "(auth)/sign-in.tsx": {
    status: "blocked",
    evidence: "Real Auth/email service integration covered; native sign-in screen still needs a device",
  },
  "auth/callback.tsx": {
    status: "blocked",
    evidence: "Production callback with real email/PKCE covered; native deep link still needs a device",
  },
  "auth/recover.tsx": {
    status: "blocked",
    evidence: "Real recovery email/session covered; native recovery screen still needs a device",
  },
  "auth/update-password.tsx": {
    status: "blocked",
    evidence: "Recovery session covered; successful password change and native screen remain open",
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
  "Camera, microphone, documents, encrypted local files, and upload retry",
  "Push delivery, permissions, app lock, privacy cover, and OS background behavior",
  "Account export file, deletion with stored files, and native sign-out cleanup (local JSON/export and empty-storage deletion covered)",
  "Native navigation, accessibility, calendar, and system share sheet",
];
