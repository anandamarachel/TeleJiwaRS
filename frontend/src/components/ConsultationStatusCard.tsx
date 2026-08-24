import Link from "next/link";
import { ConsultationSummary } from "@/lib/types";

const STEP_ORDER = ["screening", "payment_pending", "ready", "active"] as const;

export function ConsultationStatusCard({ consultation }: { consultation: ConsultationSummary }) {
  const currentStepIndex = STEP_ORDER.indexOf(
    consultation.status as (typeof STEP_ORDER)[number]
  );

  return (
    <div className="rounded-2xl border border-sage-200 bg-white p-6">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium text-ink-900">Konsultasi Anda</p>
        <StatusBadge status={consultation.status} />
      </div>
      <p className="mb-5 text-xs text-ink-700/70">
        {consultation.doctor_name ? `Dokter: ${consultation.doctor_name}` : "Belum ada dokter"}
      </p>

      {consultation.status !== "payment_rejected" && (
        <div className="mb-5 flex items-center gap-1.5">
          {STEP_ORDER.map((step, i) => (
            <div
              key={step}
              className={`h-1 flex-1 rounded-full ${
                i <= currentStepIndex ? "bg-jade-500" : "bg-sage-200"
              }`}
            />
          ))}
        </div>
      )}

      <ActionForStatus consultation={consultation} />
    </div>
  );
}

function StatusBadge({ status }: { status: ConsultationSummary["status"] }) {
  const labels: Record<ConsultationSummary["status"], string> = {
    screening: "Skrining",
    payment_pending: "Menunggu Verifikasi",
    payment_rejected: "Pembayaran Ditolak",
    ready: "Siap Konsultasi",
    active: "Konsultasi Berlangsung",
    completed: "Selesai",
  };

  return (
    <span className="rounded-full bg-jade-500/10 px-2.5 py-1 text-xs font-medium text-jade-700">
      {labels[status]}
    </span>
  );
}

function ActionForStatus({ consultation }: { consultation: ConsultationSummary }) {
  switch (consultation.status) {
    case "screening":
      return (
        <Link
          href={
            consultation.screening_submitted
              ? `/dashboard/payment/${consultation.id}`
              : `/dashboard/screening/${consultation.id}`
          }
          className="block w-full rounded-lg bg-jade-500 py-2.5 text-center text-sm font-medium text-white hover:bg-jade-600"
        >
          {consultation.screening_submitted ? "Lanjutkan Pembayaran" : "Lanjutkan Skrining"}
        </Link>
      );
    case "payment_pending":
      return (
        <p className="text-sm text-ink-700/70">
          Bukti pembayaran Anda sedang diverifikasi oleh admin. Anda akan diberi tahu melalui WhatsApp.
        </p>
      );
    case "payment_rejected":
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-red-600">
            Pembayaran Anda ditolak. Silakan unggah ulang bukti pembayaran.
          </p>
          <Link
            href={`/dashboard/payment/${consultation.id}`}
            className="block w-full rounded-lg bg-jade-500 py-2.5 text-center text-sm font-medium text-white hover:bg-jade-600"
          >
            Unggah Ulang
          </Link>
        </div>
      );
    case "ready":
      return (
        <p className="text-sm text-ink-700/70">
          Pembayaran dikonfirmasi. Menunggu dokter bergabung.
        </p>
      );
    case "active":
      return (
        <Link
          href={`/dashboard/chat/${consultation.id}`}
          className="block w-full rounded-lg bg-jade-500 py-2.5 text-center text-sm font-medium text-white hover:bg-jade-600"
        >
          Buka Konsultasi
        </Link>
      );
    default:
      return null;
  }
}
