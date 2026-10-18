import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  Appointment,
  CareContext,
  EmergencyContact,
  HelpResource,
  Medication,
  MedicationChange,
  PrivateDocument,
  Provider,
  SummaryCandidate,
} from "@/features/care/types";
import {
  appointmentInputSchema,
  emergencyContactInputSchema,
  medicationChangeInputSchema,
  medicationInputSchema,
  providerInputSchema,
  type AppointmentInput,
  type EmergencyContactInput,
  type MedicationChangeInput,
  type MedicationInput,
  type ProviderInput,
  type DocumentUploadJob,
} from "@/schemas/care";
import { supabase } from "@/services/supabase/client";

type Table<Row> = {
  Insert: Partial<Row>;
  Relationships: [];
  Row: Row;
  Update: Partial<Row>;
};
type ProviderRow = {
  address: string | null;
  email: string | null;
  id: string;
  is_primary: boolean;
  name: string;
  organization: string | null;
  owner_id: string;
  phone: string | null;
  pregnancy_id: string;
  specialty: string | null;
};
type ContactRow = {
  id: string;
  name: string;
  notes: string | null;
  owner_id: string;
  phone: string;
  pregnancy_id: string | null;
  priority: number;
  relationship: string | null;
};
type AppointmentRow = {
  ends_at: string | null;
  id: string;
  location: string | null;
  owner_id: string;
  pregnancy_id: string;
  provider_id: string | null;
  reason: string | null;
  starts_at: string;
  status: string;
  timezone: string;
  title: string;
};
type QuestionRow = {
  answered_at: string | null;
  appointment_id: string;
  id: string;
  owner_id: string;
  position: number;
  priority: number;
  question: string;
  selected_for_summary: boolean;
  status: "answered" | "discussed" | "open" | "removed";
};
type NoteRow = {
  appointment_id: string;
  authored_at: string;
  body: string;
  id: string;
  owner_id: string;
};
type MedicationRow = {
  form: string | null;
  id: string;
  instructions: string | null;
  name: string;
  owner_id: string;
  pregnancy_id: string;
  status: string;
  strength: string | null;
};
type ChangeRow = {
  change_kind: string;
  details: string | null;
  id: string;
  medication_id: string;
  owner_id: string;
  recorded_on: string;
};
type DocumentRow = {
  appointment_id: string | null;
  byte_size: number;
  deleted_at: string | null;
  document_date: string | null;
  document_type: string;
  id: string;
  mime_type: string;
  owner_id: string;
  pregnancy_id: string;
  privacy_level: string;
  storage_bucket: string;
  storage_path: string;
  title: string;
  upload_error_code: string | null;
  upload_status: string;
};
type CheckInRow = {
  checkin_date: string;
  id: string;
  owner_id: string;
  pregnancy_id: string;
};
type SymptomLinkRow = {
  checkin_id: string;
  owner_id: string;
  severity: number | null;
  symptom_id: string;
};
type SymptomRow = { display_name: string; id: string; slug: string };
type WellnessRow = {
  checkin_id: string | null;
  observation_type: string;
  owner_id: string;
  text_value: string | null;
};
type GuidanceRow = {
  action_label: string | null;
  action_uri: string | null;
  body_markdown: string;
  display_order: number;
  emergency_action_label: string | null;
  emergency_action_uri: string | null;
  id: string;
  locale: string;
  show_on_get_help: boolean;
  title: string;
};
type CareDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      appointment_questions: Table<QuestionRow>;
      appointment_notes: Table<NoteRow>;
      appointments: Table<AppointmentRow>;
      checkin_symptoms: Table<SymptomLinkRow>;
      daily_checkins: Table<CheckInRow>;
      documents: Table<DocumentRow>;
      emergency_contacts: Table<ContactRow>;
      medication_change_records: Table<ChangeRow>;
      medications: Table<MedicationRow>;
      providers: Table<ProviderRow>;
      symptoms: Table<SymptomRow>;
      urgent_guidance: Table<GuidanceRow>;
      wellness_observations: Table<WellnessRow>;
    };
    Views: Record<string, never>;
  };
};
const client = supabase as unknown as SupabaseClient<CareDatabase>;

const providerColumns =
  "id,pregnancy_id,owner_id,name,specialty,organization,phone,email,address,is_primary";
const contactColumns =
  "id,pregnancy_id,owner_id,name,relationship,phone,priority,notes";
const appointmentColumns =
  "id,pregnancy_id,owner_id,provider_id,title,reason,status,starts_at,ends_at,timezone,location";
const questionColumns =
  "id,owner_id,appointment_id,question,position,answered_at,priority,status,selected_for_summary";
const noteColumns = "id,owner_id,appointment_id,body,authored_at";
const medicationColumns =
  "id,pregnancy_id,owner_id,name,form,strength,instructions,status";
const changeColumns = "id,owner_id,medication_id,recorded_on,change_kind,details";
const documentColumns =
  "id,pregnancy_id,owner_id,appointment_id,title,document_type,document_date,storage_bucket,storage_path,mime_type,byte_size,privacy_level,upload_status,upload_error_code,deleted_at";

function providers(rows: ProviderRow[]): Provider[] {
  return rows.map((row) => ({
    address: row.address ?? "",
    email: row.email ?? "",
    id: row.id,
    isPrimary: row.is_primary,
    name: row.name,
    organization: row.organization ?? "",
    phone: row.phone ?? "",
    specialty: row.specialty ?? "",
  }));
}
function contacts(rows: ContactRow[]): EmergencyContact[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    notes: row.notes ?? "",
    phone: row.phone,
    priority: row.priority,
    relationship: row.relationship ?? "",
  }));
}
function medications(rows: MedicationRow[]): Medication[] {
  return rows.map((row) => ({
    form: row.form ?? "",
    id: row.id,
    instructions: row.instructions ?? "",
    name: row.name,
    status: row.status,
    strength: row.strength ?? "",
  }));
}
function changes(rows: ChangeRow[]): MedicationChange[] {
  return rows.map((row) => ({
    changeKind: row.change_kind,
    details: row.details ?? "",
    id: row.id,
    medicationId: row.medication_id,
    recordedOn: row.recorded_on,
  }));
}
function documents(rows: DocumentRow[]): PrivateDocument[] {
  return rows
    .filter((row) => row.deleted_at === null)
    .map((row) => ({
      documentDate: row.document_date,
      documentType: row.document_type,
      id: row.id,
      mimeType: row.mime_type,
      privacy: row.privacy_level === "shared" ? "shared" : "private",
      status:
        row.upload_status === "ready" || row.upload_status === "failed"
          ? row.upload_status
          : "pending",
      title: row.title,
    }));
}

export const careRepository = {
  async getContext(ownerId: string, pregnancyId: string): Promise<CareContext> {
    const [
      providerResult,
      contactResult,
      appointmentResult,
      medicationResult,
      documentResult,
    ] = await Promise.all([
      client
        .from("providers")
        .select(providerColumns)
        .eq("owner_id", ownerId)
        .eq("pregnancy_id", pregnancyId)
        .order("is_primary", { ascending: false }),
      client
        .from("emergency_contacts")
        .select(contactColumns)
        .eq("owner_id", ownerId)
        .or(`pregnancy_id.eq.${pregnancyId},pregnancy_id.is.null`)
        .order("priority"),
      client
        .from("appointments")
        .select(appointmentColumns)
        .eq("owner_id", ownerId)
        .eq("pregnancy_id", pregnancyId)
        .order("starts_at", { ascending: true }),
      client
        .from("medications")
        .select(medicationColumns)
        .eq("owner_id", ownerId)
        .eq("pregnancy_id", pregnancyId)
        .order("name"),
      client
        .from("documents")
        .select(documentColumns)
        .eq("owner_id", ownerId)
        .eq("pregnancy_id", pregnancyId)
        .is("deleted_at", null),
    ]);
    for (const result of [
      providerResult,
      contactResult,
      appointmentResult,
      medicationResult,
      documentResult,
    ])
      if (result.error) throw result.error;
    const providerRows = providerResult.data ?? [];
    const contactRows = contactResult.data ?? [];
    const appointmentRows = appointmentResult.data ?? [];
    const medicationRows = medicationResult.data ?? [];
    const documentRows = documentResult.data ?? [];
    const appointmentIds = appointmentRows.map((item) => item.id);
    const medicationIds = medicationRows.map((item) => item.id);
    const [questionResult, noteResult, changeResult] = await Promise.all([
      appointmentIds.length
        ? client
            .from("appointment_questions")
            .select(questionColumns)
            .in("appointment_id", appointmentIds)
            .order("position")
        : Promise.resolve({ data: [] as QuestionRow[], error: null }),
      appointmentIds.length
        ? client
            .from("appointment_notes")
            .select(noteColumns)
            .in("appointment_id", appointmentIds)
            .order("authored_at", { ascending: false })
        : Promise.resolve({ data: [] as NoteRow[], error: null }),
      medicationIds.length
        ? client
            .from("medication_change_records")
            .select(changeColumns)
            .in("medication_id", medicationIds)
            .order("recorded_on", { ascending: false })
        : Promise.resolve({ data: [] as ChangeRow[], error: null }),
    ]);
    if (questionResult.error) throw questionResult.error;
    if (noteResult.error) throw noteResult.error;
    if (changeResult.error) throw changeResult.error;
    const questionRows = questionResult.data ?? [];
    const noteRows = noteResult.data ?? [];
    const changeRows = changeResult.data ?? [];
    const appointments: Appointment[] = appointmentRows.map((row) => ({
      endsAt: row.ends_at,
      id: row.id,
      location: row.location ?? "",
      notes: noteRows
        .filter((note) => note.appointment_id === row.id)
        .map((note) => ({
          authoredAt: note.authored_at,
          body: note.body,
          id: note.id,
        })),
      providerId: row.provider_id,
      questions: questionRows
        .filter((q) => q.appointment_id === row.id)
        .map((q) => ({
          answeredAt: q.answered_at,
          id: q.id,
          priority: q.priority,
          question: q.question,
          selectedForSummary: q.selected_for_summary,
          status: q.status,
        })),
      reason: row.reason ?? "",
      startsAt: row.starts_at,
      status: row.status,
      timezone: row.timezone,
      title: row.title,
    }));
    return {
      appointments,
      contacts: contacts(contactRows),
      documents: documents(documentRows),
      medicationChanges: changes(changeRows),
      medications: medications(medicationRows),
      providers: providers(providerRows),
    };
  },

  async addProvider(
    ownerId: string,
    pregnancyId: string,
    input: ProviderInput,
  ): Promise<void> {
    const value = providerInputSchema.parse(input);
    const { error } = await client.from("providers").insert({
      address: value.address || null,
      email: value.email || null,
      is_primary: value.isPrimary,
      name: value.name,
      organization: value.organization || null,
      owner_id: ownerId,
      phone: value.phone || null,
      pregnancy_id: pregnancyId,
      specialty: value.specialty || null,
    });
    if (error) throw error;
  },
  async addContact(
    ownerId: string,
    pregnancyId: string,
    input: EmergencyContactInput,
  ): Promise<void> {
    const value = emergencyContactInputSchema.parse(input);
    const { error } = await client.from("emergency_contacts").insert({
      name: value.name,
      notes: value.notes || null,
      owner_id: ownerId,
      phone: value.phone,
      pregnancy_id: pregnancyId,
      priority: value.priority,
      relationship: value.relationship || null,
    });
    if (error) throw error;
  },
  async addAppointment(
    ownerId: string,
    pregnancyId: string,
    input: AppointmentInput,
  ): Promise<void> {
    const value = appointmentInputSchema.parse(input);
    const { error } = await client.from("appointments").insert({
      ends_at: value.endsAt,
      location: value.location || null,
      owner_id: ownerId,
      pregnancy_id: pregnancyId,
      provider_id: value.providerId,
      reason: value.reason || null,
      starts_at: value.startsAt,
      status: "scheduled",
      timezone: value.timezone,
      title: value.title,
    });
    if (error) throw error;
  },
  async addQuestion(
    ownerId: string,
    appointmentId: string,
    question: string,
    position: number,
    priority: 1 | 2 | 3 = 1,
  ): Promise<void> {
    const normalized = question.trim();
    if (!normalized) throw new Error("question_required");
    const { error } = await client.from("appointment_questions").insert({
      appointment_id: appointmentId,
      owner_id: ownerId,
      position,
      priority,
      question: normalized,
    });
    if (error) throw error;
  },
  async addAppointmentNote(
    ownerId: string,
    appointmentId: string,
    body: string,
  ): Promise<void> {
    const normalized = body.trim();
    if (!normalized) throw new Error("note_required");
    const { error } = await client.from("appointment_notes").insert({
      appointment_id: appointmentId,
      body: normalized,
      owner_id: ownerId,
    });
    if (error) throw error;
  },
  async updateQuestion(
    ownerId: string,
    questionId: string,
    input: {
      priority?: 1 | 2 | 3;
      selectedForSummary?: boolean;
      status?: "answered" | "discussed" | "open" | "removed";
    },
  ): Promise<void> {
    const values: Partial<QuestionRow> = {};
    if (input.priority !== undefined) values.priority = input.priority;
    if (input.selectedForSummary !== undefined)
      values.selected_for_summary = input.selectedForSummary;
    if (input.status !== undefined) {
      values.status = input.status;
      values.answered_at =
        input.status === "answered" ? new Date().toISOString() : null;
    }
    const { error } = await client
      .from("appointment_questions")
      .update(values)
      .eq("owner_id", ownerId)
      .eq("id", questionId);
    if (error) throw error;
  },
  async addMedication(
    ownerId: string,
    pregnancyId: string,
    input: MedicationInput,
  ): Promise<void> {
    const value = medicationInputSchema.parse(input);
    const { error } = await client.from("medications").insert({
      form: value.form || null,
      instructions: value.instructions || null,
      name: value.name,
      owner_id: ownerId,
      pregnancy_id: pregnancyId,
      status: value.status,
      strength: value.strength || null,
    });
    if (error) throw error;
  },
  async addMedicationChange(
    ownerId: string,
    input: MedicationChangeInput,
  ): Promise<void> {
    const value = medicationChangeInputSchema.parse(input);
    const { error } = await client.from("medication_change_records").insert({
      change_kind: value.changeKind,
      details: value.details || null,
      medication_id: value.medicationId,
      owner_id: ownerId,
      recorded_on: value.recordedOn,
    });
    if (error) throw error;
  },
  async remove(
    ownerId: string,
    table:
      | "appointment_questions"
      | "appointments"
      | "emergency_contacts"
      | "medication_change_records"
      | "medications"
      | "providers",
    id: string,
  ): Promise<void> {
    const { error } = await client
      .from(table)
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", id);
    if (error) throw error;
  },

  async registerDocument(
    ownerId: string,
    pregnancyId: string,
    job: DocumentUploadJob,
  ): Promise<void> {
    const { error } = await client.from("documents").upsert({
      appointment_id: job.appointmentId,
      byte_size: job.byteSize,
      deleted_at: null,
      document_date: job.documentDate,
      document_type: job.documentType,
      id: job.documentId,
      mime_type: job.mimeType,
      owner_id: ownerId,
      pregnancy_id: pregnancyId,
      privacy_level: job.privacy,
      storage_bucket: "tender-documents",
      storage_path: job.objectPath,
      title: job.title,
      upload_error_code: null,
      upload_status: "pending",
    });
    if (error) throw error;
  },
  async updateDocumentStatus(
    ownerId: string,
    documentId: string,
    status: "failed" | "ready",
    errorCode: string | null,
  ): Promise<void> {
    const { error } = await client
      .from("documents")
      .update({ upload_error_code: errorCode, upload_status: status })
      .eq("owner_id", ownerId)
      .eq("id", documentId);
    if (error) throw error;
  },
  async getSignedDocumentUrl(documentId: string): Promise<string> {
    const { data, error } = await client
      .from("documents")
      .select(documentColumns)
      .eq("id", documentId)
      .eq("upload_status", "ready")
      .is("deleted_at", null)
      .single();
    if (error) throw error;
    const signed = await supabase.storage
      .from(data.storage_bucket)
      .createSignedUrl(data.storage_path, 60);
    if (signed.error) throw signed.error;
    return signed.data.signedUrl;
  },
  async deleteDocument(ownerId: string, documentId: string): Promise<void> {
    const { data, error } = await client
      .from("documents")
      .select(documentColumns)
      .eq("owner_id", ownerId)
      .eq("id", documentId)
      .single();
    if (error) throw error;
    if (data.upload_status === "ready") {
      const removed = await supabase.storage
        .from(data.storage_bucket)
        .remove([data.storage_path]);
      if (removed.error) throw removed.error;
    }
    const deleted = await client
      .from("documents")
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", documentId);
    if (deleted.error) throw deleted.error;
  },

  async getSummaryCandidates(
    ownerId: string,
    pregnancyId: string,
    start: string,
    end: string,
  ): Promise<SummaryCandidate[]> {
    const [checkinResult, appointmentResult, medicationResult] = await Promise.all([
      client
        .from("daily_checkins")
        .select("id,pregnancy_id,owner_id,checkin_date")
        .eq("owner_id", ownerId)
        .eq("pregnancy_id", pregnancyId)
        .gte("checkin_date", start)
        .lte("checkin_date", end),
      client
        .from("appointments")
        .select(appointmentColumns)
        .eq("owner_id", ownerId)
        .eq("pregnancy_id", pregnancyId)
        .gte("starts_at", `${start}T00:00:00.000Z`)
        .lte("starts_at", `${end}T23:59:59.999Z`),
      client
        .from("medications")
        .select(medicationColumns)
        .eq("owner_id", ownerId)
        .eq("pregnancy_id", pregnancyId),
    ]);
    if (checkinResult.error) throw checkinResult.error;
    if (appointmentResult.error) throw appointmentResult.error;
    if (medicationResult.error) throw medicationResult.error;
    const checkinRows = checkinResult.data ?? [];
    const appointmentRows = appointmentResult.data ?? [];
    const medicationRows = medicationResult.data ?? [];
    const checkinIds = checkinRows.map((row) => row.id);
    const appointmentIds = appointmentRows.map((row) => row.id);
    const medicationIds = medicationRows.map((row) => row.id);
    const [linkResult, symptomResult, wellnessResult, questionResult, changeResult] =
      await Promise.all([
        checkinIds.length
          ? client
              .from("checkin_symptoms")
              .select("checkin_id,owner_id,severity,symptom_id")
              .in("checkin_id", checkinIds)
          : Promise.resolve({ data: [] as SymptomLinkRow[], error: null }),
        client.from("symptoms").select("id,slug,display_name"),
        checkinIds.length
          ? client
              .from("wellness_observations")
              .select("checkin_id,owner_id,observation_type,text_value")
              .in("checkin_id", checkinIds)
          : Promise.resolve({ data: [] as WellnessRow[], error: null }),
        appointmentIds.length
          ? client
              .from("appointment_questions")
              .select(questionColumns)
              .in("appointment_id", appointmentIds)
          : Promise.resolve({ data: [] as QuestionRow[], error: null }),
        medicationIds.length
          ? client
              .from("medication_change_records")
              .select(changeColumns)
              .in("medication_id", medicationIds)
              .gte("recorded_on", start)
              .lte("recorded_on", end)
          : Promise.resolve({ data: [] as ChangeRow[], error: null }),
      ]);
    for (const result of [
      linkResult,
      symptomResult,
      wellnessResult,
      questionResult,
      changeResult,
    ])
      if (result.error) throw result.error;
    const linkRows = linkResult.data ?? [];
    const symptomRows = symptomResult.data ?? [];
    const wellnessRows = wellnessResult.data ?? [];
    const questionRows = questionResult.data ?? [];
    const changeRows = changeResult.data ?? [];
    const checkinDate = new Map(checkinRows.map((row) => [row.id, row.checkin_date]));
    const symptomName = new Map(symptomRows.map((row) => [row.id, row.display_name]));
    const appointmentDate = new Map(
      appointmentRows.map((row) => [row.id, row.starts_at.slice(0, 10)]),
    );
    const medicationName = new Map(medicationRows.map((row) => [row.id, row.name]));
    return [
      ...linkRows.map((row) => ({
        category: "symptom" as const,
        date: checkinDate.get(row.checkin_id) ?? start,
        detail: row.severity ? `severity recorded as ${row.severity} of 3` : "",
        id: `symptom:${row.checkin_id}:${row.symptom_id}`,
        label: symptomName.get(row.symptom_id) ?? "Recorded symptom",
      })),
      ...wellnessRows.map((row) => ({
        category: "observation" as const,
        date: checkinDate.get(row.checkin_id ?? "") ?? start,
        detail: row.text_value ?? "",
        id: `observation:${row.checkin_id}:${row.observation_type}`,
        label: row.observation_type.replaceAll("_", " "),
      })),
      ...questionRows
        .filter((row) => row.selected_for_summary && row.status !== "removed")
        .sort((left, right) => left.priority - right.priority)
        .slice(0, 3)
        .map((row) => ({
          category: "question" as const,
          date: appointmentDate.get(row.appointment_id) ?? start,
          detail: row.status === "answered" ? "marked answered by the user" : "",
          id: `question:${row.id}`,
          label: row.question,
        })),
      ...changeRows.map((row) => ({
        category: "medication" as const,
        date: row.recorded_on,
        detail: row.details ?? row.change_kind.replaceAll("_", " "),
        id: `medication:${row.id}`,
        label: medicationName.get(row.medication_id) ?? "Medication record",
      })),
    ];
  },

  async getHelpResources(locale: string): Promise<HelpResource[]> {
    const language = locale.split("-")[0] ?? "en";
    const { data, error } = await client
      .from("urgent_guidance")
      .select(
        "id,title,body_markdown,action_label,action_uri,emergency_action_label,emergency_action_uri,locale,show_on_get_help,display_order",
      )
      .eq("show_on_get_help", true)
      .in("locale", [locale, language])
      .order("display_order");
    if (error) throw error;
    return (data ?? []).map((row) => {
      const actions: HelpResource["actions"] = [];
      if (row.action_label && row.action_uri)
        actions.push({ label: row.action_label, uri: row.action_uri });
      if (row.emergency_action_label && row.emergency_action_uri)
        actions.push({
          label: row.emergency_action_label,
          uri: row.emergency_action_uri,
        });
      return {
        actions,
        body: row.body_markdown,
        id: row.id,
        title: row.title,
      };
    });
  },
};
