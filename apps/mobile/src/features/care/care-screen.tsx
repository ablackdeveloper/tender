import { useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { type Href, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, View } from "react-native";

import { AppointmentDateTimeField } from "@/components/ui/calendar-field";
import { Screen } from "@/components/layout/screen";
import {
  AppText,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  OfflineState,
  SafetyCallout,
  SegmentedControl,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { careKeys, useCareContext } from "@/features/care/queries";
import type { Appointment } from "@/features/care/types";
import { formatAppointmentTime } from "@/features/care/appointment-time";
import { careRepository } from "@/repositories/care-repository";
import { documentService } from "@/services/care/document-service";
import {
  exportAppointmentToCalendar,
  type CalendarExportResult,
} from "@/services/care/calendar-service";
import { useNetworkStatus } from "@/providers/network-provider";
import { useTheme } from "@/theme/theme-provider";

const defaultAppointmentStart = new Date(Date.now() + 86_400_000).toISOString();
type CareSection = "visits" | "team" | "records";

export function CareScreen({
  ownerId,
  pregnancyId,
}: {
  ownerId: string;
  pregnancyId: string;
}) {
  const context = useCareContext(ownerId, pregnancyId);
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const { theme } = useTheme();
  const router = useRouter();
  const [appointmentTimeValid, setAppointmentTimeValid] = useState(true);
  const [currentTime] = useState(Date.now);
  const [section, setSection] = useState<CareSection>("visits");
  const [error, setError] = useState<string | null>(null);
  const [deletion, setDeletion] = useState<{
    name: string;
    detail: string;
    action: () => Promise<void>;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const requestDelete = (name: string, detail: string, action: () => Promise<void>) => {
    setDeleteError(false);
    setDeletion({ name, detail, action });
  };
  async function confirmDelete() {
    if (!deletion || deleting) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      await deletion.action();
      setDeletion(null);
      await refresh();
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
  }
  const [calendarState, setCalendarState] = useState<CalendarExportResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [provider, setProvider] = useState({ name: "", phone: "", specialty: "" });
  const [contact, setContact] = useState({ name: "", phone: "", relationship: "" });
  const [appointment, setAppointment] = useState({
    location: "",
    startsAt: defaultAppointmentStart,
    title: "",
  });
  const [question, setQuestion] = useState("");
  const [questionAppointmentId, setQuestionAppointmentId] = useState<string | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [noteAppointmentId, setNoteAppointmentId] = useState<string | null>(null);
  const [medication, setMedication] = useState({
    instructions: "",
    name: "",
    strength: "",
  });
  const [medicationId, setMedicationId] = useState<string | null>(null);
  const [medicationNote, setMedicationNote] = useState("");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentPrivacy, setDocumentPrivacy] = useState<"private" | "shared">(
    "private",
  );
  const refresh = async () => queryClient.invalidateQueries({ queryKey: careKeys.all });
  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      await refresh();
    } catch {
      setError("That care record could not be saved. Review the fields and try again.");
    }
  };

  if (context.isLoading)
    return (
      <Screen>
        <Skeleton accessibilityLabel="Loading care records" height={260} />
      </Screen>
    );
  if (context.isError || !context.data)
    return (
      <Screen>
        <ErrorState
          title="Care records unavailable"
          description="Cached records may be incomplete. Try again when connected."
          actionLabel="Retry"
          onAction={() => void context.refetch()}
        />
      </Screen>
    );
  const data = context.data;
  const nextAppointment = data.appointments.find(
    (item) =>
      item.status !== "cancelled" &&
      Date.parse(item.startsAt) >= currentTime - 21_600_000,
  );
  const pastAppointments = data.appointments
    .filter(
      (item) => item.status === "completed" || Date.parse(item.startsAt) < currentTime,
    )
    .slice(-3)
    .reverse();
  async function calendarExport(item: Appointment) {
    setCalendarState(null);
    try {
      setCalendarState(await exportAppointmentToCalendar(item));
    } catch {
      setCalendarState("unavailable");
    }
  }
  async function pickDocument() {
    if (!isOnline || !documentTitle.trim()) return;
    setError(null);
    setUploadProgress(0);
    try {
      const job = await documentService.pick({
        appointmentId: null,
        documentDate: null,
        documentId: Crypto.randomUUID(),
        documentType: "user_document",
        objectId: Crypto.randomUUID(),
        privacy: documentPrivacy,
        title: documentTitle,
      });
      if (!job) {
        setUploadProgress(null);
        return;
      }
      await documentService.upload({
        job,
        onProgress: setUploadProgress,
        ownerId,
        pregnancyId,
      });
      setDocumentTitle("");
      await refresh();
    } catch {
      setError("The document could not be uploaded. No care notes were changed.");
    } finally {
      setUploadProgress(null);
    }
  }

  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="heading1">Care</AppText>
        <AppText color="muted">
          User-recorded contacts, appointments, questions, medication lists, and private
          documents. Flutterings does not provide medical or medication instructions.
        </AppText>
      </View>
      {!isOnline ? (
        <OfflineState description="Showing cached care records. New server records and document uploads need a connection." />
      ) : null}
      {error ? (
        <Card>
          <AppText color="danger">{error}</AppText>
        </Card>
      ) : null}
      <Card elevated style={{ gap: theme.spacing.sm }}>
        <AppText color="muted" variant="label">
          NEXT USEFUL STEP
        </AppText>
        {nextAppointment ? (
          <>
            <AppText variant="heading2">Prepare for {nextAppointment.title}</AppText>
            <AppText color="muted">
              {formatAppointmentTime(
                nextAppointment.startsAt,
                nextAppointment.timezone,
              )}{" "}
              ·{" "}
              {
                nextAppointment.questions.filter((item) => item.status === "open")
                  .length
              }{" "}
              open question
              {nextAppointment.questions.filter((item) => item.status === "open")
                .length === 1
                ? ""
                : "s"}
            </AppText>
            {nextAppointment.questions
              .filter((item) => item.status === "open")
              .sort((left, right) => left.priority - right.priority)
              .slice(0, 3)
              .map((item) => (
                <AppText key={item.id}>• {item.question}</AppText>
              ))}
            <Button onPress={() => router.push("/(app)/appointment-question" as Href)}>
              Add one question
            </Button>
          </>
        ) : (
          <>
            <AppText variant="heading2">Keep care details together</AppText>
            <AppText color="muted">
              Add an appointment when it becomes useful. Nothing is required today.
            </AppText>
          </>
        )}
        <Button onPress={() => router.push("/(app)/care/summary")} variant="ghost">
          Prepare provider summary
        </Button>
      </Card>
      <SegmentedControl<CareSection>
        accessibilityLabel="Care section"
        onChange={setSection}
        options={[
          { label: "Visits", value: "visits" },
          { label: "Care team", value: "team" },
          { label: "Records", value: "records" },
        ]}
        value={section}
      />

      {section === "team" ? (
        <>
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading2">Providers</AppText>
            {data.providers.length === 0 ? (
              <AppText color="muted">No providers recorded.</AppText>
            ) : (
              data.providers.map((item) => (
                <View key={item.id} style={{ gap: theme.spacing.xs }}>
                  <AppText variant="heading3">
                    {item.name}
                    {item.isPrimary ? " · Primary" : ""}
                  </AppText>
                  <AppText>
                    {[item.specialty, item.phone, item.organization]
                      .filter(Boolean)
                      .join(" · ")}
                  </AppText>
                  {item.phone ? (
                    <Button
                      onPress={() =>
                        void Linking.openURL(
                          `tel:${item.phone.replace(/[^0-9+*#-]/gu, "")}`,
                        )
                      }
                      variant="secondary"
                    >
                      Call provider
                    </Button>
                  ) : null}
                  <Button
                    onPress={() =>
                      requestDelete(
                        item.name,
                        "This removes the provider record. Linked appointments will be kept.",
                        () => careRepository.remove(ownerId, "providers", item.id),
                      )
                    }
                    variant="ghost"
                  >
                    Delete provider record
                  </Button>
                </View>
              ))
            )}
            <Field
              label="Provider name"
              value={provider.name}
              onChangeText={(name) => setProvider((current) => ({ ...current, name }))}
            />
            <Field
              label="Phone"
              keyboardType="phone-pad"
              value={provider.phone}
              onChangeText={(phone) =>
                setProvider((current) => ({ ...current, phone }))
              }
            />
            <Field
              label="Specialty"
              value={provider.specialty}
              onChangeText={(specialty) =>
                setProvider((current) => ({ ...current, specialty }))
              }
            />
            <Button
              disabled={!isOnline || !provider.name.trim() || !provider.phone.trim()}
              onPress={() =>
                void run(async () => {
                  await careRepository.addProvider(ownerId, pregnancyId, {
                    address: "",
                    email: "",
                    isPrimary: data.providers.length === 0,
                    name: provider.name,
                    organization: "",
                    phone: provider.phone,
                    specialty: provider.specialty,
                  });
                  setProvider({ name: "", phone: "", specialty: "" });
                })
              }
            >
              Add provider record
            </Button>
          </Card>

          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading2">Emergency contacts</AppText>
            {data.contacts.length === 0 ? (
              <AppText color="muted">No personal emergency contacts recorded.</AppText>
            ) : (
              data.contacts.map((item) => (
                <View key={item.id} style={{ gap: theme.spacing.xs }}>
                  <AppText variant="heading3">{item.name}</AppText>
                  <AppText>
                    {[item.relationship, item.phone].filter(Boolean).join(" · ")}
                  </AppText>
                  <Button
                    onPress={() =>
                      void Linking.openURL(
                        `tel:${item.phone.replace(/[^0-9+*#-]/gu, "")}`,
                      )
                    }
                    variant="danger"
                  >
                    Call contact
                  </Button>
                  <Button
                    onPress={() =>
                      requestDelete(
                        item.name,
                        "This removes this contact from your care records.",
                        () =>
                          careRepository.remove(ownerId, "emergency_contacts", item.id),
                      )
                    }
                    variant="ghost"
                  >
                    Delete contact record
                  </Button>
                </View>
              ))
            )}
            <Field
              label="Contact name"
              value={contact.name}
              onChangeText={(name) => setContact((current) => ({ ...current, name }))}
            />
            <Field
              label="Phone"
              keyboardType="phone-pad"
              value={contact.phone}
              onChangeText={(phone) => setContact((current) => ({ ...current, phone }))}
            />
            <Field
              label="Relationship"
              value={contact.relationship}
              onChangeText={(relationship) =>
                setContact((current) => ({ ...current, relationship }))
              }
            />
            <Button
              disabled={!isOnline || !contact.name.trim() || !contact.phone.trim()}
              onPress={() =>
                void run(async () => {
                  await careRepository.addContact(ownerId, pregnancyId, {
                    name: contact.name,
                    notes: "",
                    phone: contact.phone,
                    priority: Math.min(data.contacts.length + 1, 20),
                    relationship: contact.relationship,
                  });
                  setContact({ name: "", phone: "", relationship: "" });
                })
              }
            >
              Add emergency contact
            </Button>
          </Card>
        </>
      ) : null}

      {section === "visits" ? (
        <>
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading2">Appointments</AppText>
            {data.appointments.length === 0 ? (
              <AppText color="muted">No appointments recorded.</AppText>
            ) : (
              data.appointments.map((item) => (
                <View key={item.id} style={{ gap: theme.spacing.xs }}>
                  <AppText variant="heading3">{item.title}</AppText>
                  <AppText>
                    {formatAppointmentTime(item.startsAt, item.timezone)}
                  </AppText>
                  {item.questions
                    .filter((entry) => entry.status !== "removed")
                    .map((entry) => (
                      <View key={entry.id} style={{ gap: theme.spacing.xxs }}>
                        <AppText>• {entry.question}</AppText>
                        <AppText color="muted" variant="caption">
                          {entry.priority === 1
                            ? "Must ask"
                            : entry.priority === 2
                              ? "If time"
                              : "Optional"}
                          {` · ${entry.status.replaceAll("_", " ")}`}
                          {entry.selectedForSummary ? " · In summary" : ""}
                        </AppText>
                        <View
                          style={{
                            flexDirection: "row",
                            flexWrap: "wrap",
                            gap: theme.spacing.xs,
                          }}
                        >
                          <Chip
                            onPress={() =>
                              void run(() =>
                                careRepository.updateQuestion(ownerId, entry.id, {
                                  selectedForSummary: !entry.selectedForSummary,
                                }),
                              )
                            }
                            selected={entry.selectedForSummary}
                          >
                            {entry.selectedForSummary
                              ? "In provider summary"
                              : "Add to provider summary"}
                          </Chip>
                          {entry.status === "open" ? (
                            <Chip
                              onPress={() =>
                                void run(() =>
                                  careRepository.updateQuestion(ownerId, entry.id, {
                                    status: "discussed",
                                  }),
                                )
                              }
                            >
                              Mark discussed
                            </Chip>
                          ) : null}
                          {entry.status === "discussed" ? (
                            <Chip
                              onPress={() =>
                                void run(() =>
                                  careRepository.updateQuestion(ownerId, entry.id, {
                                    status: "answered",
                                  }),
                                )
                              }
                            >
                              Mark answered
                            </Chip>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  <Button onPress={() => void calendarExport(item)} variant="secondary">
                    Review calendar export
                  </Button>
                  <Button
                    onPress={() =>
                      requestDelete(
                        item.title,
                        "This also removes questions and notes for this appointment.",
                        () => careRepository.remove(ownerId, "appointments", item.id),
                      )
                    }
                    variant="ghost"
                  >
                    Delete appointment record
                  </Button>
                </View>
              ))
            )}
            {calendarState === "permission_denied" ? (
              <ErrorState
                title="Calendar permission denied"
                description="The appointment remains in Flutterings. You can enable calendar access in system settings or leave it unexported."
              />
            ) : null}
            {calendarState === "unavailable" ? (
              <EmptyState
                title="Calendar export unavailable"
                description="This device or browser cannot add a local calendar event."
              />
            ) : null}
            {calendarState === "added" ? (
              <AppText color="success">
                Added after your confirmation in the system calendar.
              </AppText>
            ) : null}
            {calendarState === "canceled" ? (
              <AppText color="muted">
                Calendar export was canceled. The appointment remains only in
                Flutterings.
              </AppText>
            ) : null}
            <Field
              label="Appointment title"
              value={appointment.title}
              onChangeText={(title) =>
                setAppointment((current) => ({ ...current, title }))
              }
            />
            <AppointmentDateTimeField
              value={appointment.startsAt}
              onValidityChange={setAppointmentTimeValid}
              onChange={(startsAt) =>
                setAppointment((current) => ({ ...current, startsAt }))
              }
            />
            <Field
              label="Location"
              value={appointment.location}
              onChangeText={(location) =>
                setAppointment((current) => ({ ...current, location }))
              }
            />
            <Button
              disabled={!isOnline || !appointmentTimeValid || !appointment.title.trim()}
              onPress={() =>
                void run(async () => {
                  await careRepository.addAppointment(ownerId, pregnancyId, {
                    endsAt: null,
                    location: appointment.location,
                    providerId: null,
                    reason: "",
                    startsAt: appointment.startsAt,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
                    title: appointment.title,
                  });
                  setAppointment((current) => ({
                    ...current,
                    location: "",
                    title: "",
                  }));
                })
              }
            >
              Add appointment record
            </Button>
          </Card>

          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading2">Questions</AppText>
            {data.appointments.length === 0 ? (
              <AppText color="muted">
                Add an appointment before recording questions.
              </AppText>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: theme.spacing.xs,
                  }}
                >
                  {data.appointments.map((item) => (
                    <Chip
                      key={item.id}
                      selected={questionAppointmentId === item.id}
                      onPress={() => setQuestionAppointmentId(item.id)}
                    >
                      {item.title}
                    </Chip>
                  ))}
                </View>
                <Textarea
                  label="Question to bring"
                  value={question}
                  onChangeText={setQuestion}
                />
                <Button
                  disabled={!isOnline || !question.trim() || !questionAppointmentId}
                  onPress={() =>
                    void run(async () => {
                      if (!questionAppointmentId) return;
                      const selected = data.appointments.find(
                        (item) => item.id === questionAppointmentId,
                      );
                      await careRepository.addQuestion(
                        ownerId,
                        questionAppointmentId,
                        question,
                        selected?.questions.length ?? 0,
                      );
                      setQuestion("");
                    })
                  }
                >
                  Add question
                </Button>
              </>
            )}
          </Card>
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading2">After the visit</AppText>
            <AppText color="muted">
              Record what you heard in your own words. Flutterings does not interpret
              the note or turn it into medical advice.
            </AppText>
            {pastAppointments.length === 0 ? (
              <AppText color="muted">No past visits are available.</AppText>
            ) : (
              <>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: theme.spacing.xs,
                  }}
                >
                  {pastAppointments.map((item) => (
                    <Chip
                      key={item.id}
                      onPress={() => setNoteAppointmentId(item.id)}
                      selected={noteAppointmentId === item.id}
                    >
                      {item.title}
                    </Chip>
                  ))}
                </View>
                {pastAppointments
                  .find((item) => item.id === noteAppointmentId)
                  ?.notes.map((item) => (
                    <View key={item.id} style={{ gap: theme.spacing.xxs }}>
                      <AppText>{item.body}</AppText>
                      <AppText color="muted" variant="caption">
                        Recorded {new Date(item.authoredAt).toLocaleDateString()}
                      </AppText>
                    </View>
                  ))}
                <Textarea
                  label="Private visit note"
                  maxLength={100000}
                  onChangeText={setNote}
                  value={note}
                />
                <Button
                  disabled={!isOnline || !noteAppointmentId || !note.trim()}
                  onPress={() =>
                    void run(async () => {
                      if (!noteAppointmentId) return;
                      await careRepository.addAppointmentNote(
                        ownerId,
                        noteAppointmentId,
                        note,
                      );
                      setNote("");
                    })
                  }
                  variant="secondary"
                >
                  Save private note
                </Button>
              </>
            )}
          </Card>
        </>
      ) : null}

      {section === "records" ? (
        <>
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading2">Medications as recorded</AppText>
            <SafetyCallout>
              Flutterings only stores what you report. It does not tell you to begin,
              stop, pause, resume, or alter any medication. Contact a qualified
              professional for medication decisions.
            </SafetyCallout>
            {data.medications.length === 0 ? (
              <AppText color="muted">No medication records.</AppText>
            ) : (
              data.medications.map((item) => (
                <View key={item.id} style={{ gap: theme.spacing.xs }}>
                  <AppText variant="heading3">
                    {item.name} {item.strength}
                  </AppText>
                  <AppText color="muted">
                    Status as recorded: {item.status.replaceAll("_", " ")}
                  </AppText>
                  {item.instructions ? (
                    <AppText>Directions as recorded: {item.instructions}</AppText>
                  ) : null}
                  <Button
                    onPress={() =>
                      requestDelete(
                        item.name,
                        "This also removes the recorded changes for this medication.",
                        () => careRepository.remove(ownerId, "medications", item.id),
                      )
                    }
                    variant="ghost"
                  >
                    Delete medication record
                  </Button>
                </View>
              ))
            )}
            <Field
              label="Medication name as recorded"
              value={medication.name}
              onChangeText={(name) =>
                setMedication((current) => ({ ...current, name }))
              }
            />
            <Field
              label="Strength as recorded"
              value={medication.strength}
              onChangeText={(strength) =>
                setMedication((current) => ({ ...current, strength }))
              }
            />
            <Textarea
              label="Directions as recorded"
              value={medication.instructions}
              onChangeText={(instructions) =>
                setMedication((current) => ({ ...current, instructions }))
              }
            />
            <Button
              disabled={!isOnline || !medication.name.trim()}
              onPress={() =>
                void run(async () => {
                  await careRepository.addMedication(ownerId, pregnancyId, {
                    form: "",
                    instructions: medication.instructions,
                    name: medication.name,
                    status: "active",
                    strength: medication.strength,
                  });
                  setMedication({ instructions: "", name: "", strength: "" });
                })
              }
            >
              Add medication record
            </Button>
            {data.medications.length ? (
              <>
                <AppText variant="heading3">Medication list history</AppText>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: theme.spacing.xs,
                  }}
                >
                  {data.medications.map((item) => (
                    <Chip
                      key={item.id}
                      selected={medicationId === item.id}
                      onPress={() => setMedicationId(item.id)}
                    >
                      {item.name}
                    </Chip>
                  ))}
                </View>
                <Textarea
                  label="User-reported list update"
                  hint="Record what changed in your list without treating this as an instruction."
                  value={medicationNote}
                  onChangeText={setMedicationNote}
                />
                <Button
                  disabled={!isOnline || !medicationId}
                  onPress={() =>
                    void run(async () => {
                      if (!medicationId) return;
                      await careRepository.addMedicationChange(ownerId, {
                        changeKind: "other",
                        details: medicationNote,
                        medicationId,
                        recordedOn: new Date().toISOString().slice(0, 10),
                      });
                      setMedicationNote("");
                    })
                  }
                >
                  Record list history
                </Button>
              </>
            ) : null}
          </Card>

          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading2">Private documents</AppText>
            <AppText color="muted">
              Private by default. Titles and opaque storage metadata are stored; signed
              download links are short-lived and never saved.
            </AppText>
            {data.documents.length === 0 ? (
              <AppText color="muted">No private documents uploaded.</AppText>
            ) : (
              data.documents.map((item) => (
                <View key={item.id} style={{ gap: theme.spacing.xs }}>
                  <AppText variant="heading3">{item.title}</AppText>
                  <AppText color="muted">
                    {item.privacy === "private" ? "Private" : "Shared by care grant"} ·{" "}
                    {item.status}
                  </AppText>
                  {item.status === "ready" ? (
                    <Button
                      onPress={() =>
                        void careRepository
                          .getSignedDocumentUrl(item.id)
                          .then((url) => Linking.openURL(url))
                      }
                      variant="secondary"
                    >
                      Open private document
                    </Button>
                  ) : null}
                  <Button
                    onPress={() =>
                      requestDelete(
                        item.title,
                        "This removes the document record and its stored file.",
                        () => careRepository.deleteDocument(ownerId, item.id),
                      )
                    }
                    variant="danger"
                  >
                    Permanently delete document
                  </Button>
                </View>
              ))
            )}
            <Field
              label="Document title"
              value={documentTitle}
              onChangeText={setDocumentTitle}
            />
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              <Chip
                selected={documentPrivacy === "private"}
                onPress={() => setDocumentPrivacy("private")}
              >
                Private
              </Chip>
              <Chip
                selected={documentPrivacy === "shared"}
                onPress={() => setDocumentPrivacy("shared")}
              >
                Share by care grant
              </Chip>
            </View>
            {uploadProgress !== null ? (
              <AppText accessibilityLiveRegion="polite">
                Upload {Math.round(uploadProgress * 100)}%
              </AppText>
            ) : null}
            <Button
              disabled={!isOnline || !documentTitle.trim() || uploadProgress !== null}
              onPress={() => void pickDocument()}
            >
              Choose and upload document
            </Button>
          </Card>
        </>
      ) : null}
      <Dialog
        visible={deletion !== null}
        title="Delete this care record?"
        onClose={() => {
          if (!deleting) setDeletion(null);
        }}
        actions={
          <>
            <Button
              variant="secondary"
              disabled={deleting}
              onPress={() => setDeletion(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={!isOnline}
              onPress={() => void confirmDelete()}
            >
              Permanently delete record
            </Button>
          </>
        }
      >
        <AppText>{deletion?.name}</AppText>
        <AppText>{deletion?.detail} This cannot be undone.</AppText>
        {deleteError ? (
          <ErrorState
            title="Record not deleted"
            description="Check your connection and try again. Keep this screen open to retry."
          />
        ) : null}
      </Dialog>
    </Screen>
  );
}
