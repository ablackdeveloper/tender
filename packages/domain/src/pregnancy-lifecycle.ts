export const pregnancyLifecycleStatuses = [
  "active",
  "paused",
  "loss",
  "ended",
  "birth",
  "archived",
] as const;

export type PregnancyLifecycleStatus = (typeof pregnancyLifecycleStatuses)[number];

export type PregnancyExperience = {
  showCelebratoryContent: boolean;
  showCountdown: boolean;
  showGestationalProgress: boolean;
  showMaternalRecovery: boolean;
  showSizeComparisons: boolean;
  showWeeklyContent: boolean;
};

export function canTransitionPregnancyStatus(
  from: PregnancyLifecycleStatus,
  to: PregnancyLifecycleStatus,
  statusBeforeArchive?: PregnancyLifecycleStatus | null,
): boolean {
  if (from === to) return from !== "archived";
  if (from === "archived") return to === statusBeforeArchive;
  if (to === "archived") return true;
  if (from === "loss" || from === "ended" || from === "birth") return to === "active";
  return true;
}

export function pregnancyExperience(input: {
  compassionateMode: boolean;
  postpartumMode: boolean;
  status: PregnancyLifecycleStatus;
}): PregnancyExperience {
  const progressive = input.status === "active" && !input.compassionateMode;
  return {
    showCelebratoryContent: progressive,
    showCountdown: progressive,
    showGestationalProgress: progressive,
    showMaternalRecovery: input.status === "birth" && input.postpartumMode,
    showSizeComparisons: progressive,
    showWeeklyContent: progressive,
  };
}

export function lifecycleStatusLabel(status: PregnancyLifecycleStatus): string {
  return {
    active: "Active",
    archived: "Archived",
    birth: "Birth recorded",
    ended: "Ended",
    loss: "Loss",
    paused: "Paused",
  }[status];
}
