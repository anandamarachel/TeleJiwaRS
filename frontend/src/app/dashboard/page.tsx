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
    let cancelled = false;
    let requestInFlight = false;
    let hasLoaded = false;

    function refreshConsultations() {
      if (cancelled || requestInFlight || document.visibilityState === "hidden") return;
      requestInFlight = true;

      apiFetch<ConsultationSummary[]>("/patients/consultations")
        .then((rows) => {
          if (cancelled) return;

          hasLoaded = true;
          setConsultations(rows);
          setError(null);

          const activeConsultation = rows.find((consultation) => consultation.status === "active");
          if (activeConsultation) {
            router.replace(`/dashboard/chat/${activeConsultation.id}`);
          }
        })
        .catch(() => {
          if (!cancelled && !hasLoaded) {
            setError("Gagal memuat data konsultasi.");
          }
        })
        .finally(() => {
          requestInFlight = false;
        });
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refreshConsultations();
    }

    refreshConsultations();
    const interval = window.setInterval(refreshConsultations, 3000);
    window.addEventListener("focus", refreshConsultations);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshConsultations);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

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
    router.replace("/");
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
        <div>
          <p className="text-lg font-semibold text-ink-900">Telemedicine Jiwa</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-700/60">
            <span className="h-1.5 w-1.5 rounded-full bg-jade-500" /> Status diperbarui otomatis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard/profile" className="text-sm text-ink-700/70 hover:text-ink-900">
            Profil
          </Link>
          <button onClick={handleLogout} className="text-sm text-ink-700/70 hover:text-ink-900">
            Keluar
          </button>
        </div>
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
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-jade-500 bg-white px-5 py-3 text-sm font-semibold text-jade-700 shadow-sm transition hover:bg-jade-500/5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-500 focus-visible:ring-offset-2"
        >
          <span aria-hidden="true">◷</span>
          Lihat Riwayat Konsultasi
          <span aria-hidden="true">→</span>
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
