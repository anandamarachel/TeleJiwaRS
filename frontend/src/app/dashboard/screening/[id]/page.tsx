"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { ScreeningQuestion } from "@/lib/types";

const SCALE_LABELS = [
  "Tidak sama sekali",
  "Beberapa hari",
  "Lebih dari separuh hari",
  "Hampir setiap hari",
];

export default function ScreeningPage() {
  return (
    <RequireAuth allowedRoles={["patient"]}>
      <ScreeningContent />
    </RequireAuth>
  );
}

function ScreeningContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [questions, setQuestions] = useState<ScreeningQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<ScreeningQuestion[]>("/consultations/screening/questions")
      .then((data) => setQuestions([...data].sort((a, b) => a.order_index - b.order_index)))
      .catch(() => setError("Gagal memuat pertanyaan skrining."));
  }, []);

  const isComplete =
    questions !== null &&
    questions.every((q) => answers[q.id] !== undefined) &&
    chiefComplaint.trim().length > 0;

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await apiFetch(`/consultations/${id}/screening`, {
        method: "POST",
        body: JSON.stringify({
          chief_complaint: chiefComplaint,
          answers: Object.entries(answers).map(([question_id, score_value]) => ({
            question_id: Number(question_id),
            score_value,
          })),
        }),
      });
      router.push(`/dashboard/payment/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Gagal mengirim skrining.");
      setIsSubmitting(false);
    }
  }

  if (error && questions === null) {
    return <StateMessage text={error} />;
  }
  if (questions === null) {
    return <StateMessage text="Memuat..." />;
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-lg font-semibold text-ink-900">Skrining Awal</p>
        <p className="text-sm text-ink-700/70">
          Selama 2 minggu terakhir, seberapa sering Anda mengalami hal berikut?
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-sage-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-ink-900">
              {i + 1}. {q.text}
            </p>
            <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-2">
              {SCALE_LABELS.map((label, value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: value }))}
                  className={`flex-1 rounded-lg border px-2 py-2 text-xs transition ${
                    answers[q.id] === value
                      ? "border-jade-500 bg-jade-500/10 text-jade-700"
                      : "border-sage-200 text-ink-700/70 hover:border-jade-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="chiefComplaint" className="text-sm font-medium text-ink-900">
          Apa yang Anda rasakan atau keluhkan?
        </label>
        <textarea
          id="chiefComplaint"
          value={chiefComplaint}
          onChange={(e) => setChiefComplaint(e.target.value)}
          rows={4}
          placeholder="Ceritakan dengan kata-kata Anda sendiri..."
          className="rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isComplete || isSubmitting}
        className="rounded-lg bg-jade-500 py-2.5 text-sm font-medium text-white hover:bg-jade-600 disabled:opacity-40"
      >
        {isSubmitting ? "Mengirim..." : "Kirim Skrining"}
      </button>
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