import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import * as Crypto from "expo-crypto";
import { type Href, useRouter } from "expo-router";
import { View } from "react-native";

import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  OfflineState,
  Skeleton,
} from "@/components/ui";
import { planningKeys, usePlanningContext } from "@/features/planning/queries";
import {
  TemplatePicker,
  type TemplateSelection,
} from "@/features/planning/template-picker";
import { togetherKeys } from "@/features/together/queries";
import { useNetworkStatus } from "@/providers/network-provider";
import { planningRepository } from "@/repositories/planning-repository";
import { useTheme } from "@/theme/theme-provider";

export function PlanningScreen({
  ownerId,
  pregnancyId,
  requestedFromUserId,
  initialTemplateId,
}: {
  ownerId: string;
  pregnancyId: string;
  requestedFromUserId: string | null;
  initialTemplateId?: string | undefined;
}) {
  const query = usePlanningContext(pregnancyId);
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();
  const router = useRouter();
  const pendingList = useRef<{ id: string; fingerprint: string } | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [supportTitle, setSupportTitle] = useState("");
  const [error, setError] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: planningKeys.all });
      await queryClient.invalidateQueries({ queryKey: togetherKeys.all });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  async function saveTemplate(selection: TemplateSelection) {
    if (!isOnline) throw new Error("offline");
    const fingerprint = JSON.stringify(selection);
    if (pendingList.current?.fingerprint !== fingerprint)
      pendingList.current = { id: Crypto.randomUUID(), fingerprint };
    await planningRepository.createList({
      ...selection,
      pregnancyId,
      projectId: pendingList.current.id,
    });
    setSelectedProjectId(pendingList.current.id);
    pendingList.current = null;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: planningKeys.all }),
      queryClient.invalidateQueries({ queryKey: togetherKeys.all }),
    ]);
  }
  if (query.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading plans" height={260} />
      </Screen>
    );
  if (query.isError || !query.data)
    return (
      <Screen>
        <ErrorState
          title="Plans unavailable"
          description="Try again when connected."
          onAction={() => void query.refetch()}
          actionLabel="Retry"
        />
      </Screen>
    );
  const data = query.data;
  const activeProject =
    data.projects.find((project) => project.id === selectedProjectId) ??
    data.projects[0];
  return (
    <Screen>
      <AppText accessibilityRole="header" variant="heading1">
        Plan
      </AppText>
      <AppText color="muted">
        Projects, practical tasks, and requests for support. Flutterings does not score
        progress, count streaks, or send guilt-based reminders.
      </AppText>
      {!isOnline ? (
        <OfflineState description="Showing cached plans. Changes require a connection." />
      ) : null}
      {error ? (
        <ErrorState
          title="Change not saved"
          description="No existing plan was replaced. Review the entry and try again."
        />
      ) : null}
      <TemplatePicker
        disabled={!isOnline || busy}
        onSave={saveTemplate}
        initialTemplateId={initialTemplateId}
      />
      <Button variant="ghost" onPress={() => router.push("/(app)/together" as Href)}>
        Review task sharing
      </Button>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Projects and tasks</AppText>
        <Button variant="ghost" onPress={() => setShowRemoved((value) => !value)}>
          {showRemoved ? "Hide removed tasks" : "Show removed tasks"}
        </Button>
        {data.projects.length === 0 ? (
          <EmptyState
            title="No projects yet"
            description="Create a project when it would be useful."
          />
        ) : (
          data.projects.map((project) => (
            <View key={project.id} style={{ gap: theme.spacing.xs }}>
              <AppText variant="heading3">{project.title}</AppText>
              <Button variant="ghost" onPress={() => setSelectedProjectId(project.id)}>
                {activeProject?.id === project.id
                  ? "Selected plan"
                  : `Add tasks to ${project.title}`}
              </Button>
              {data.tasks
                .filter(
                  (task) =>
                    task.projectId === project.id &&
                    (showRemoved || task.status !== "cancelled"),
                )
                .map((task) => (
                  <View key={task.id} style={{ gap: theme.spacing.xs }}>
                    <AppText>
                      {task.status === "cancelled" ? "Removed · " : ""}
                      {task.status === "completed" ? "Completed · " : ""}
                      {task.title}
                    </AppText>
                    <Button
                      disabled={!isOnline || busy || task.status === "cancelled"}
                      variant="ghost"
                      onPress={() =>
                        void run(() =>
                          planningRepository.setTaskStatus(
                            ownerId,
                            task.id,
                            task.status !== "completed",
                          ),
                        )
                      }
                    >
                      {task.status === "completed" ? "Reopen task" : "Mark complete"}
                    </Button>
                    {editingTaskId === task.id ? (
                      <>
                        <Field
                          label="Task title"
                          value={editedTitle}
                          maxLength={240}
                          onChangeText={setEditedTitle}
                        />
                        <Button
                          disabled={!isOnline || busy || !editedTitle.trim()}
                          onPress={() =>
                            void run(async () => {
                              await planningRepository.renameTask(
                                ownerId,
                                task.id,
                                editedTitle,
                              );
                              setEditingTaskId(null);
                            })
                          }
                        >
                          Save task title
                        </Button>
                        <Button variant="ghost" onPress={() => setEditingTaskId(null)}>
                          Cancel edit
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onPress={() => {
                          setEditingTaskId(task.id);
                          setEditedTitle(task.title);
                        }}
                      >
                        Edit task
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      disabled={!isOnline || busy}
                      onPress={() =>
                        void run(() =>
                          planningRepository.setTaskRemoved(
                            ownerId,
                            task.id,
                            task.status !== "cancelled",
                          ),
                        )
                      }
                    >
                      {task.status === "cancelled"
                        ? "Restore task"
                        : "Remove from plan"}
                    </Button>
                  </View>
                ))}
            </View>
          ))
        )}
        <Field
          label="New project"
          value={projectTitle}
          onChangeText={setProjectTitle}
        />
        <Button
          disabled={!isOnline || !projectTitle.trim()}
          onPress={() =>
            void run(async () => {
              await planningRepository.addProject(ownerId, pregnancyId, projectTitle);
              setProjectTitle("");
            })
          }
        >
          Add project
        </Button>
        {activeProject ? (
          <>
            <Field
              label={`New task in ${activeProject.title}`}
              value={taskTitle}
              onChangeText={setTaskTitle}
            />
            <Button
              disabled={!isOnline || !taskTitle.trim()}
              onPress={() =>
                void run(async () => {
                  await planningRepository.addTask(
                    ownerId,
                    activeProject.id,
                    taskTitle,
                  );
                  setTaskTitle("");
                })
              }
            >
              Add task
            </Button>
          </>
        ) : null}
      </Card>
      <Card style={{ gap: theme.spacing.sm }}>
        <AppText variant="heading2">Support requests</AppText>
        {data.supportRequests.length === 0 ? (
          <AppText color="muted">No support requests.</AppText>
        ) : (
          data.supportRequests.map((request) => (
            <View key={request.id} style={{ gap: theme.spacing.xs }}>
              <AppText>
                {request.title} · {request.status}
              </AppText>
              {request.status !== "cancelled" && request.status !== "resolved" ? (
                <Button
                  variant="ghost"
                  onPress={() =>
                    void run(() =>
                      planningRepository.cancelSupportRequest(ownerId, request.id),
                    )
                  }
                >
                  Cancel request
                </Button>
              ) : null}
            </View>
          ))
        )}
        <Field
          label="New support request"
          hint="A recipient can be selected when sharing is configured."
          value={supportTitle}
          onChangeText={setSupportTitle}
        />
        <Button
          disabled={!isOnline || !supportTitle.trim()}
          onPress={() =>
            void run(async () => {
              await planningRepository.addSupportRequest(
                ownerId,
                pregnancyId,
                supportTitle,
                requestedFromUserId,
              );
              setSupportTitle("");
            })
          }
        >
          Add support request
        </Button>
        {!requestedFromUserId ? (
          <AppText color="muted" variant="bodySmall">
            This request stays private until an active support person is connected.
          </AppText>
        ) : null}
      </Card>
    </Screen>
  );
}
