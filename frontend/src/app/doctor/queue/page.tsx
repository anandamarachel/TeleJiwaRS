"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { DoctorConsultation, DoctorQueueItem } from "@/lib/types";

export default function DoctorQueuePage() {
  return (
    <RequireAuth allowedRoles={["doctor"]}>
      <DoctorQueue />
    </RequireAuth>
  );
}

function DoctorQueue() {
  const router = useRouter();
  const { logout } = useAuth();
  const [queue, setQueue] = useState<DoctorQueueItem[] | null>(null);
  const [mine, setMine] = useState<DoctorConsultation[] | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [queueRows, myRows] = await Promise.all([
        apiFetch<DoctorQueueItem[]>("/doctors/queue"),
        apiFetch<DoctorConsultation[]>("/doctors/consultations/mine"),
      ]);
      setQueue(queueRows);
      setMine(myRows);
      setError(null);
    } catch {
      setError("Gagal memuat antrean konsultasi.");
    }
  }, []);

  useEffect(() => {
    Promise.all([
      apiFetch<DoctorQueueItem[]>("/doctors/queue"),
      apiFetch<DoctorConsultation[]>("/doctors/consultations/mine"),
    ])
      .then(([queueRows, myRows]) => {
        setQueue(queueRows);
        setMine(myRows);
      })
      .catch(() => setError("Gagal memuat antrean konsultasi."));
  }, []);

  async function claimConsultation(consultationId: number) {
    setClaimingId(consultationId);
    setError(null);
    try {
      await apiFetch(`/doctors/consultations/${consultationId}/claim`, { method: "POST" });
      router.push(`/doctor/consultations/${consultationId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Gagal mengambil konsultasi.");
      setClaimingId(null);
      loadData();
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  const isLoading = queue === null || mine === null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Dashboard Dokter</h1>
          <p className="text-sm text-ink-700/70">Kelola konsultasi aktif dan antrean pasien.</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-ink-700/70 hover:text-ink-900">Keluar</button>
      </header>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600" role="alert">{error}</p>}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Konsultasi Aktif</h2>
          <span className="text-xs text-ink-700/60">{mine?.length ?? 0} pasien</span>
        </div>
        {isLoading ? (
          <StateCard text="Memuat..." />
        ) : mine.length === 0 ? (
          <StateCard text="Belum ada konsultasi aktif yang Anda tangani." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {mine.map((consultation) => (
              <button
                key={consultation.id}
                onClick={() => router.push(`/doctor/consultations/${consultation.id}`)}
                className="rounded-2xl border border-sage-200 bg-white p-5 text-left transition hover:border-jade-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-ink-900">{consultation.patient_name}</p>
                  <span className="rounded-full bg-jade-500/10 px-2 py-1 text-xs font-medium text-jade-700">Aktif</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-ink-700/70">{consultation.chief_complaint}</p>
                <p className="mt-4 text-sm font-medium text-jade-700">Buka konsultasi →</p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink-900">Antrean Tersedia</h2>
          <button onClick={loadData} className="text-sm font-medium text-jade-700 hover:underline">Muat ulang</button>
        </div>
        {isLoading ? (
          <StateCard text="Memuat..." />
        ) : queue.length === 0 ? (
          <StateCard text="Saat ini tidak ada pasien dalam antrean." />
        ) : (
          <div className="flex flex-col gap-3">
            {queue.map((item) => (
              <div key={item.consultation_id} className="rounded-2xl border border-sage-200 bg-white p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-medium text-ink-900">{item.patient_name}</p>
                    <p className="mt-1 text-sm text-ink-700/70">
                      Skrining: {item.screening_score} · {item.screening_result}
                    </p>
                    <p className="mt-1 text-xs text-ink-700/60">Menunggu sejak {formatDateTime(item.ready_since)}</p>
                  </div>
                  <button
                    onClick={() => claimConsultation(item.consultation_id)}
                    disabled={claimingId !== null}
                    className="rounded-lg bg-jade-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-jade-600 disabled:opacity-50"
                  >
                    {claimingId === item.consultation_id ? "Mengambil..." : "Ambil Konsultasi"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StateCard({ text }: { text: string }) {
  return <div className="rounded-2xl border border-sage-200 bg-white p-8 text-center text-sm text-ink-700/70">{text}</div>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}
