import type { PregnancyLifecycleStatus } from "@tender/domain";

export type SupportResource = {
  actionLabel: string;
  actionUri: string;
  description: string;
  id: string;
  kind: "general" | "loss" | "postpartum";
  title: string;
};

export type PregnancyLifecycleSettings = {
  compassionateMode: boolean;
  id: string;
  postpartumMode: boolean;
  status: PregnancyLifecycleStatus;
  statusBeforeArchive: PregnancyLifecycleStatus | null;
};
