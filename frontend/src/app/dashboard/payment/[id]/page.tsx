"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, ApiError } from "@/lib/api";
import { PaymentInstructions } from "@/lib/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export default function PaymentPage() {
  return (
    <RequireAuth allowedRoles={["patient"]}>
      <PaymentContent />
    </RequireAuth>
  );
}

function PaymentContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<PaymentInstructions>(`/consultations/${id}/payment-instructions`)
      .then(setInstructions)
      .catch((err) => {
        setError(err instanceof ApiError ? err.detail : "Gagal memuat informasi pembayaran.");
      });
  }, [id]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError(null);
    const selected = event.target.files?.[0] ?? null;

    if (selected && !ACCEPTED_TYPES.includes(selected.type)) {
      setFile(null);
      event.target.value = "";
      setError("Bukti pembayaran harus berupa JPEG, PNG, atau PDF.");
      return;
    }

    if (selected && selected.size > MAX_FILE_SIZE) {
      setFile(null);
      event.target.value = "";
      setError("Ukuran bukti pembayaran maksimal 5 MB.");
      return;
    }

    setFile(selected);
  }

  async function handleSubmit() {
    if (!file) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      await apiFetch(`/consultations/${id}/payment`, {
        method: "POST",
        body: formData,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Gagal mengunggah bukti pembayaran.");
      setIsSubmitting(false);
    }
  }

  if (!instructions && !error) {
    return <StateMessage text="Memuat..." />;
  }

  if (!instructions) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-sm text-red-600" role="alert">{error}</p>
        <button onClick={() => router.push("/dashboard")} className="text-sm font-medium text-jade-700 hover:underline">
          Kembali ke dashboard
        </button>
      </div>
    );
  }

  const isRetry = instructions.consultation_status === "payment_rejected";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-lg font-semibold text-ink-900">
          {isRetry ? "Unggah Ulang Pembayaran" : "Pembayaran Konsultasi"}
        </p>
        <p className="text-sm text-ink-700/70">
          {isRetry
            ? "Bukti sebelumnya ditolak. Pastikan bukti baru terlihat jelas dan sesuai nominal."
            : "Lakukan pembayaran melalui kanal resmi rumah sakit, lalu unggah buktinya di bawah."}
        </p>
      </div>

      <div className="rounded-2xl border border-sage-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-700/70">Total pembayaran</p>
        <p className="mt-1 text-2xl font-semibold text-ink-900">
          {formatRupiah(instructions.amount)}
        </p>
        <p className="mt-3 text-xs text-ink-700/70">
          Gunakan instruksi rekening atau pembayaran resmi yang diberikan oleh rumah sakit.
        </p>
      </div>

      <div className="rounded-2xl border border-sage-200 bg-white p-6">
        <label htmlFor="payment-proof" className="text-sm font-medium text-ink-900">
          Bukti pembayaran
        </label>
        <p className="mb-3 mt-1 text-xs text-ink-700/70">JPEG, PNG, atau PDF. Maksimal 5 MB.</p>
        <input
          id="payment-proof"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          onChange={handleFileChange}
          className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-lg file:border-0 file:bg-jade-500/10 file:px-3 file:py-2 file:font-medium file:text-jade-700 hover:file:bg-jade-500/20"
        />
        {file && <p className="mt-3 text-xs text-ink-700/70">Dipilih: {file.name}</p>}
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!file || isSubmitting}
        className="rounded-lg bg-jade-500 py-2.5 text-sm font-medium text-white hover:bg-jade-600 disabled:opacity-40"
      >
        {isSubmitting ? "Mengunggah..." : isRetry ? "Unggah Bukti Baru" : "Kirim Bukti Pembayaran"}
      </button>
    </div>
  );
}

function formatRupiah(amount: string) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function StateMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center">
      <p className="text-sm text-ink-700/70">{text}</p>
    </div>
  );
}
