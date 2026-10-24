import type { SummaryCandidate } from "@/features/care/types";

export type ProviderSummary = {
  dateRange: { end: string; start: string };
  items: readonly SummaryCandidate[];
  title?: string;
};

function section(title: string, items: readonly SummaryCandidate[]): string[] {
  if (!items.length) return [`${title}:`, "- None selected"];
  return [
    `${title}:`,
    ...items.map(
      (item) =>
        `- ${item.date}: ${item.label}${item.detail ? ` — ${item.detail}` : ""}`,
    ),
  ];
}

export function buildProviderSummary(input: ProviderSummary): string {
  const selected = (category: SummaryCandidate["category"]) =>
    input.items.filter((item) => item.category === category);
  return [
    input.title?.trim() || "Provider visit summary",
    "USER-REPORTED — REVIEW AND EDIT BEFORE SHARING",
    `Date range: ${input.dateRange.start} through ${input.dateRange.end}`,
    "This summary reflects selections and notes recorded by the user. It is not a diagnosis, medication instruction, or complete medical record.",
    "",
    ...section("Selected symptoms", selected("symptom")),
    "",
    ...section("Selected observations", selected("observation")),
    "",
    ...section("Questions", selected("question")),
    "",
    ...section("Medication list changes as recorded", selected("medication")),
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function providerSummaryHtml(summary: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@page{margin:32px}body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#1e1a16;line-height:1.5;white-space:pre-wrap}h1{font-size:22px}</style></head><body><h1>User-reported provider summary</h1>${escapeHtml(summary)}</body></html>`;
}
