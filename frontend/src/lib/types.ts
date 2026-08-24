export type ConsultationStatus =
  | "screening"
  | "payment_pending"
  | "payment_rejected"
  | "ready"
  | "active"
  | "completed";

export type ConsultationSummary = {
  id: number;
  status: ConsultationStatus;
  screening_submitted: boolean;
  doctor_name: string | null;
  created_at: string;
  completed_at: string | null;
};

export type PaymentInstructions = {
  consultation_id: number;
  amount: string;
  consultation_status: "screening" | "payment_rejected";
};

export type ChatMessage = {
  sender_role: "patient" | "doctor";
  message: string;
  sent_at: string;
};

export type PrescriptionItem = {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string | null;
  notes: string | null;
};

export type ConsultationDetail = {
  id: number;
  status: ConsultationStatus;
  doctor_name: string | null;
  chief_complaint: string;
  screening_score: number;
  screening_result: string;
  note_text: string | null;
  prescription_items: PrescriptionItem[];
  follow_up_date: string | null;
  follow_up_instructions: string | null;
  referral_to: string | null;
  referral_reason: string | null;
  created_at: string;
  completed_at: string | null;
};

export type DoctorQueueItem = {
  consultation_id: number;
  patient_name: string;
  screening_score: number;
  screening_result: string;
  ready_since: string;
};

export type DoctorConsultation = {
  id: number;
  status: ConsultationStatus;
  patient_name: string;
  chief_complaint: string;
  screening_score: number;
  screening_result: string;
  started_at: string | null;
};

export type ScreeningQuestion = {
  id: number;
  text: string;
  order_index: number;
};
