// Local planning records for the isolated browser preview.
import { registerSlice, matchesShape, persistMethods } from "./persistence";
export const state = {
  projects: [] as any[],
  tasks: [] as any[],
  questions: [] as any[],
  supportRequests: [] as any[],
  routes: [] as any[],
  failNext: false,
};
const planningSnapshot = () => ({
  projects: state.projects,
  tasks: state.tasks,
  questions: state.questions,
  supportRequests: state.supportRequests,
});
registerSlice(
  "planning",
  state,
  (value) => matchesShape(value, planningSnapshot()),
  planningSnapshot,
);
export const flags = new URLSearchParams(location.search);
const copy = (value: unknown) => structuredClone(value);
export async function write() {
  await new Promise((resolve) => setTimeout(resolve, 30));
  if (state.failNext) {
    state.failNext = false;
    throw new Error("Synthetic write failure");
  }
}
export const planningRepository = {
  async list() {
    return copy({
      projects: state.projects,
      tasks: state.tasks,
      supportRequests: state.supportRequests,
    });
  },
  async createList(input: any) {
    await write();
    if (state.projects.some((p) => p.id === input.projectId)) return;
    state.projects.push({
      id: input.projectId,
      title: input.title,
      status: "active",
    });
    input.tasks.forEach((title: string, i: number) =>
      state.tasks.push({
        id: `${input.projectId}-${i}`,
        projectId: input.projectId,
        title,
        status: "open",
      }),
    );
  },
  async renameTask(_owner: string, id: string, title: string) {
    await write();
    state.tasks.find((t) => t.id === id).title = title.trim();
  },
  async setTaskRemoved(_owner: string, id: string, removed: boolean) {
    await write();
    state.tasks.find((t) => t.id === id).status = removed
      ? "cancelled"
      : "open";
  },
  async setTaskStatus(_owner: string, id: string, completed: boolean) {
    await write();
    state.tasks.find((t) => t.id === id).status = completed
      ? "completed"
      : "open";
  },
  async cancelSupportRequest(_owner: string, id: string) {
    await write();
    state.supportRequests.find((item) => item.id === id).status = "cancelled";
  },
  async addProject(_owner: string, _pregnancy: string, title: string) {
    await write();
    state.projects.push({ id: crypto.randomUUID(), title, status: "active" });
  },
  async addTask(_owner: string, projectId: string, title: string) {
    await write();
    state.tasks.push({
      id: crypto.randomUUID(),
      projectId,
      title,
      status: "open",
    });
  },
  async addSupportRequest(_owner: string, _pregnancy: string, title: string) {
    await write();
    state.supportRequests.push({
      id: crypto.randomUUID(),
      title,
      status: "open",
    });
  },
};
(window as any).fixture = state;
persistMethods(planningRepository, [
  "createList",
  "renameTask",
  "setTaskRemoved",
  "setTaskStatus",
  "cancelSupportRequest",
  "addProject",
  "addTask",
  "addSupportRequest",
]);
