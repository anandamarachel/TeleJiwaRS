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

export type ScreeningQuestion = {
  id: number;
  text: string;
  order_index: number;
};
