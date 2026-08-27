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
  const [accountCopied, setAccountCopied] = useState(false);

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

  async function copyAccountNumber() {
    await navigator.clipboard.writeText(instructions?.bank_account_number ?? "");
    setAccountCopied(true);
    window.setTimeout(() => setAccountCopied(false), 2000);
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
        <p className="mt-3 text-sm leading-6 text-ink-700/70">
          Silakan transfer sesuai total pembayaran ke rekening resmi rumah sakit berikut. Pastikan nama penerima sudah sesuai sebelum melanjutkan.
        </p>

        <dl className="mt-5 divide-y divide-sage-100 rounded-xl bg-sage-50 px-4">
          <PaymentDetail label="Bank" value={instructions.bank_name} />
          <div className="flex items-center justify-between gap-4 py-3">
            <div>
              <dt className="text-xs text-ink-700/60">Nomor rekening</dt>
              <dd className="mt-0.5 font-semibold tracking-wide text-ink-900">{instructions.bank_account_number}</dd>
            </div>
            <button
              type="button"
              onClick={copyAccountNumber}
              className="shrink-0 rounded-lg border border-sage-200 bg-white px-3 py-1.5 text-xs font-medium text-jade-700 hover:border-jade-500"
            >
              {accountCopied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <PaymentDetail label="Atas nama" value={instructions.bank_account_holder} />
        </dl>

        <div className="mt-5 rounded-xl border border-clay-400/40 bg-clay-400/10 p-4">
          <p className="text-sm font-medium text-ink-900">Setelah melakukan transfer</p>
          <p className="mt-1 text-xs leading-5 text-ink-700/70">
            Simpan bukti transaksi, lalu unggah melalui formulir di bawah. Pastikan nominal, rekening tujuan, dan status transaksi terlihat jelas.
          </p>
        </div>
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

function PaymentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <dt className="text-xs text-ink-700/60">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink-900">{value}</dd>
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
