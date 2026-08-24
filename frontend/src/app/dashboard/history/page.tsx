"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch } from "@/lib/api";
import { ConsultationSummary } from "@/lib/types";

export default function ConsultationHistoryPage() {
  return (
    <RequireAuth allowedRoles={["patient"]}>
      <ConsultationHistory />
    </RequireAuth>
  );
}

function ConsultationHistory() {
  const [consultations, setConsultations] = useState<ConsultationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ConsultationSummary[]>("/patients/consultations")
      .then((rows) => setConsultations(rows.filter((row) => row.status === "completed")))
      .catch(() => setError("Gagal memuat riwayat konsultasi."));
  }, []);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <header>
        <Link href="/dashboard" className="text-sm font-medium text-jade-700 hover:underline">
          ← Kembali ke dashboard
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-ink-900">Riwayat Konsultasi</h1>
        <p className="text-sm text-ink-700/70">Ringkasan konsultasi yang telah selesai.</p>
      </header>

      {error && <StateMessage text={error} isError />}
      {!error && consultations === null && <StateMessage text="Memuat..." />}
      {consultations?.length === 0 && (
        <div className="rounded-2xl border border-sage-200 bg-white p-8 text-center">
          <p className="text-sm text-ink-700/70">Belum ada konsultasi yang selesai.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {consultations?.map((consultation) => (
          <Link
            key={consultation.id}
            href={`/dashboard/history/${consultation.id}`}
            className="rounded-2xl border border-sage-200 bg-white p-5 transition hover:border-jade-500"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-ink-900">
                  {consultation.doctor_name ?? "Dokter tidak tersedia"}
                </p>
                <p className="mt-1 text-sm text-ink-700/70">
                  {formatDate(consultation.completed_at ?? consultation.created_at)}
                </p>
              </div>
              <span className="rounded-full bg-jade-500/10 px-2.5 py-1 text-xs font-medium text-jade-700">
                Selesai
              </span>
            </div>
            <p className="mt-4 text-sm font-medium text-jade-700">Lihat ringkasan →</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function StateMessage({ text, isError = false }: { text: string; isError?: boolean }) {
  return <p className={`py-8 text-center text-sm ${isError ? "text-red-600" : "text-ink-700/70"}`}>{text}</p>;
}
