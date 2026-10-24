export type PlanningProject = {
  id: string;
  title: string;
  description: string | null;
  status: "active" | "completed" | "archived";
};

export type PlanningTask = {
  id: string;
  projectId: string;
  title: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
};

export type SupportRequest = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "accepted" | "resolved" | "declined" | "cancelled";
};

export type PlanningContext = {
  projects: PlanningProject[];
  supportRequests: SupportRequest[];
  tasks: PlanningTask[];
};
