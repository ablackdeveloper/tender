export type Provider = {
  address: string;
  email: string;
  id: string;
  isPrimary: boolean;
  name: string;
  organization: string;
  phone: string;
  specialty: string;
};
export type EmergencyContact = {
  id: string;
  name: string;
  notes: string;
  phone: string;
  priority: number;
  relationship: string;
};
export type Appointment = {
  endsAt: string | null;
  id: string;
  location: string;
  providerId: string | null;
  notes: { authoredAt: string; body: string; id: string }[];
  questions: {
    answeredAt: string | null;
    id: string;
    priority: number;
    question: string;
    selectedForSummary: boolean;
    status: "answered" | "discussed" | "open" | "removed";
  }[];
  reason: string;
  startsAt: string;
  status: string;
  timezone: string;
  title: string;
};
export type Medication = {
  form: string;
  id: string;
  instructions: string;
  name: string;
  status: string;
  strength: string;
};
export type MedicationChange = {
  changeKind: string;
  details: string;
  id: string;
  medicationId: string;
  recordedOn: string;
};
export type PrivateDocument = {
  documentDate: string | null;
  documentType: string;
  id: string;
  mimeType: string;
  privacy: "private" | "shared";
  status: "failed" | "pending" | "ready";
  title: string;
};
export type CareContext = {
  appointments: Appointment[];
  contacts: EmergencyContact[];
  documents: PrivateDocument[];
  medicationChanges: MedicationChange[];
  medications: Medication[];
  providers: Provider[];
};
export type SummaryCandidate = {
  category: "medication" | "observation" | "question" | "symptom";
  date: string;
  detail: string;
  id: string;
  label: string;
};
export type HelpResource = {
  actions: { label: string; uri: string }[];
  body: string;
  id: string;
  title: string;
};
