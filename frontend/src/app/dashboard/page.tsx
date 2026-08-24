"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { ConsultationSummary } from "@/lib/types";
import { ConsultationStatusCard } from "@/components/ConsultationStatusCard";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <RequireAuth allowedRoles={["patient"]}>
      <DashboardContent />
    </RequireAuth>
  );
}

function DashboardContent() {
  const { logout } = useAuth();
  const router = useRouter();

  const [consultations, setConsultations] = useState<ConsultationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    apiFetch<ConsultationSummary[]>("/patients/consultations")
      .then(setConsultations)
      .catch(() => setError("Gagal memuat data konsultasi."));
  }, []);

  async function handleStartConsultation() {
    setIsStarting(true);
    try {
      const consultation = await apiFetch<{ id: number }>("/consultations/start", {
        method: "POST",
      });
      router.push(`/dashboard/screening/${consultation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Gagal memulai konsultasi.");
      setIsStarting(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  if (error) {
    return <StateMessage text={error} />;
  }

  if (consultations === null) {
    return <StateMessage text="Memuat..." />;
  }

  const activeConsultation = consultations.find((c) => c.status !== "completed");

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold text-ink-900">Telemedicine Jiwa</p>
        <button onClick={handleLogout} className="text-sm text-ink-700/70 hover:text-ink-900">
          Keluar
        </button>
      </div>

      {activeConsultation ? (
        <ConsultationStatusCard consultation={activeConsultation} />
      ) : (
        <div className="rounded-2xl border border-sage-200 bg-white p-6 text-center">
          <p className="mb-4 text-sm text-ink-700/70">
            Anda belum memiliki konsultasi yang sedang berjalan.
          </p>
          <button
            onClick={handleStartConsultation}
            disabled={isStarting}
            className="rounded-lg bg-jade-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-jade-600 disabled:opacity-60"
          >
            {isStarting ? "Memproses..." : "Mulai Konsultasi"}
          </button>
        </div>
      )}

      {consultations.some((c) => c.status === "completed") && (
        <Link
          href="/dashboard/history"
          className="text-center text-sm font-medium text-jade-700 hover:underline"
        >
          Lihat Riwayat Konsultasi
        </Link>
      )}
    </div>
  );
}

function StateMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center">
      <p className="text-sm text-ink-700/70">{text}</p>
    </div>
  );
}