"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { ConsultationDetail } from "@/lib/types";

export default function ConsultationHistoryDetailPage() {
  return (
    <RequireAuth allowedRoles={["patient"]}>
      <HistoryDetail />
    </RequireAuth>
  );
}

function HistoryDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<ConsultationDetail>(`/patients/consultations/${id}`)
      .then((detail) => {
        if (detail.status !== "completed") {
          router.replace("/dashboard");
          return;
        }
        setConsultation(detail);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.detail : "Gagal memuat ringkasan konsultasi.");
      });
  }, [id, router]);

  if (error) {
    return (
      <PageShell>
        <p className="py-12 text-center text-sm text-red-600" role="alert">{error}</p>
      </PageShell>
    );
  }

  if (!consultation) {
    return (
      <PageShell>
        <p className="py-12 text-center text-sm text-ink-700/70">Memuat...</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <header className="rounded-2xl border border-sage-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-ink-700/60">Konsultasi selesai</p>
            <h1 className="mt-1 text-xl font-semibold text-ink-900">
              {consultation.doctor_name ?? "Dokter tidak tersedia"}
            </h1>
            <p className="mt-1 text-sm text-ink-700/70">
              {formatDateTime(consultation.completed_at ?? consultation.created_at)}
            </p>
          </div>
          <span className="rounded-full bg-jade-500/10 px-2.5 py-1 text-xs font-medium text-jade-700">Selesai</span>
        </div>
        <p className="mt-5 rounded-xl bg-sage-50 p-3 text-xs text-ink-700/70">
          Ringkasan ini bersifat hanya-baca. Konsultasi dan percakapan yang telah selesai tidak dapat dibuka kembali.
        </p>
      </header>

      <Section title="Skrining Awal">
        <DetailRow label="Keluhan utama" value={consultation.chief_complaint || "Tidak tersedia"} />
        <div className="grid grid-cols-2 gap-3">
          <DetailRow label="Skor" value={String(consultation.screening_score)} />
          <DetailRow label="Hasil" value={consultation.screening_result || "Tidak tersedia"} />
        </div>
        <p className="text-xs text-ink-700/60">Hasil skrining awal bukan diagnosis medis.</p>
      </Section>

      <Section title="Catatan Dokter">
        <p className="whitespace-pre-wrap text-sm leading-6 text-ink-900">
          {consultation.note_text ?? "Tidak ada catatan dokter."}
        </p>
      </Section>

      <Section title="Resep">
        {consultation.prescription_items.length === 0 ? (
          <EmptyText text="Tidak ada resep." />
        ) : (
          <div className="flex flex-col gap-3">
            {consultation.prescription_items.map((item, index) => (
              <div key={`${item.drug_name}-${index}`} className="rounded-xl bg-sage-50 p-4">
                <p className="font-medium text-ink-900">{item.drug_name}</p>
                <p className="mt-1 text-sm text-ink-700/70">
                  {item.dosage} · {item.frequency}{item.duration ? ` · ${item.duration}` : ""}
                </p>
                {item.notes && <p className="mt-2 text-sm text-ink-700">{item.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Tindak Lanjut">
        {consultation.follow_up_date ? (
          <div className="space-y-3">
            <DetailRow label="Tanggal" value={formatDateOnly(consultation.follow_up_date)} />
            {consultation.follow_up_instructions && (
              <DetailRow label="Instruksi" value={consultation.follow_up_instructions} />
            )}
          </div>
        ) : (
          <EmptyText text="Tidak ada tindak lanjut yang dijadwalkan." />
        )}
      </Section>

      <Section title="Rujukan">
        {consultation.referral_to ? (
          <div className="space-y-3">
            <DetailRow label="Dirujuk ke" value={consultation.referral_to} />
            {consultation.referral_reason && <DetailRow label="Alasan" value={consultation.referral_reason} />}
          </div>
        ) : (
          <EmptyText text="Tidak ada rujukan." />
        )}
      </Section>
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <Link href="/dashboard/history" className="mb-2 text-sm font-medium text-jade-700 hover:underline">
        ← Kembali ke riwayat
      </Link>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-sage-200 bg-white p-6">
      <h2 className="mb-4 font-semibold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-700/60">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900">{value}</p>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm text-ink-700/70">{text}</p>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}
