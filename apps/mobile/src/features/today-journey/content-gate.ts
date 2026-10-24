import type { ReviewedWeekContent } from "@/features/today-journey/types";

const placeholderPattern =
  /not clinically approved|synthetic fixture|example\.invalid/iu;

export type EditorialCandidate = ReviewedWeekContent & {
  articleStatus: string;
  reviewStatus: string;
  reviewValidUntil: string | null;
};

export function isReviewedContentAllowed(
  candidate: EditorialCandidate,
  now: Date,
  featureEnabled: boolean,
): boolean {
  if (!featureEnabled) return false;
  if (
    candidate.articleStatus !== "published" ||
    candidate.reviewStatus !== "approved"
  ) {
    return false;
  }
  if (!candidate.publishedAt || !candidate.reviewedAt) return false;
  if (
    candidate.reviewValidUntil &&
    new Date(candidate.reviewValidUntil).getTime() <= now.getTime()
  ) {
    return false;
  }

  const provenanceText = candidate.sources
    .flatMap((source) => [source.title, source.publisher ?? "", source.url])
    .join(" ");
  return !placeholderPattern.test(
    `${candidate.title} ${candidate.summary ?? ""} ${candidate.body} ${provenanceText}`,
  );
}

export function plainTextFromMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gmu, "")
    .replace(/[*_`>]/gu, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/gu, "$1")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}
