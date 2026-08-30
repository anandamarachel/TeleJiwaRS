"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, apiFetchBlob, ApiError } from "@/lib/api";
import { PaymentDecision, PaymentRejectionReason, PendingPayment } from "@/lib/types";

const rejectionReasons: { value: PaymentRejectionReason; label: string }[] = [
  { value: "proof_unreadable", label: "Bukti pembayaran tidak terbaca" },
  { value: "amount_mismatch", label: "Nominal pembayaran tidak sesuai" },
  { value: "wrong_destination", label: "Rekening tujuan tidak sesuai" },
  { value: "incomplete_information", label: "Informasi transaksi tidak lengkap" },
  { value: "payment_not_found", label: "Pembayaran belum ditemukan" },
  { value: "other", label: "Alasan lainnya" },
];

export default function AdminPaymentsPage() {
  return (
    <RequireAuth allowedRoles={["admin"]}>
      <AdminPayments />
    </RequireAuth>
  );
}

function AdminPayments() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [payments, setPayments] = useState<PendingPayment[] | null>(null);
  const [selected, setSelected] = useState<PendingPayment | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofType, setProofType] = useState<string | null>(null);
  const [loadingProof, setLoadingProof] = useState(false);
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);
  const [decision, setDecision] = useState<PaymentDecision | null>(null);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<PaymentRejectionReason | "">("");
  const [rejectionNote, setRejectionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadPayments = useCallback(async () => {
    try {
      const rows = await apiFetch<PendingPayment[]>("/admin/payments/pending");
      setPayments(rows);
      setError(null);
    } catch {
      setError("Gagal memuat pembayaran tertunda.");
    }
  }, []);

  useEffect(() => {
    apiFetch<PendingPayment[]>("/admin/payments/pending")
      .then(setPayments)
      .catch(() => setError("Gagal memuat pembayaran tertunda."));
  }, []);

  useEffect(() => {
    return () => {
      if (proofUrl) URL.revokeObjectURL(proofUrl);
    };
  }, [proofUrl]);

  async function reviewPayment(payment: PendingPayment) {
    if (proofUrl) URL.revokeObjectURL(proofUrl);
    setSelected(payment);
    setProofUrl(null);
    setProofType(null);
    setDecision(null);
    setShowRejectForm(false);
    setRejectionReason("");
    setRejectionNote("");
    setError(null);
    setLoadingProof(true);
    try {
      const blob = await apiFetchBlob(`/admin/payments/${payment.payment_id}/proof`);
      setProofType(blob.type);
      setProofUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Bukti pembayaran tidak dapat dimuat.");
    } finally {
      setLoadingProof(false);
    }
  }

  async function decide(action: "approve" | "reject") {
    if (!selected) return;
    if (action === "reject" && !rejectionReason) {
      setError("Pilih alasan penolakan pembayaran.");
      return;
    }
    if (action === "reject" && rejectionReason === "other" && !rejectionNote.trim()) {
      setError("Isi catatan tambahan untuk alasan lainnya.");
      return;
    }
    setDeciding(action);
    setError(null);
    try {
      const result = await apiFetch<PaymentDecision>(`/admin/payments/${selected.payment_id}/${action}`, {
        method: "POST",
        ...(action === "reject"
          ? { body: JSON.stringify({ reason: rejectionReason, note: rejectionNote }) }
          : {}),
      });
      setDecision(result);
      setPayments((rows) => rows?.filter((payment) => payment.payment_id !== selected.payment_id) ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Keputusan pembayaran gagal disimpan.");
      loadPayments();
    } finally {
      setDeciding(null);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Verifikasi Pembayaran</h1>
          <p className="text-sm text-ink-700/70">Tinjau bukti sebelum menyetujui atau menolak pembayaran.</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/payment-history" className="text-sm font-medium text-jade-700 hover:underline">Riwayat pembayaran</Link>
          {user?.is_super_admin && <Link href="/admin/staff" className="text-sm font-medium text-jade-700 hover:underline">Kelola staf</Link>}
          <button onClick={handleLogout} className="text-sm text-ink-700/70 hover:text-ink-900">Keluar</button>
        </div>
      </header>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600" role="alert">{error}</p>}

      <div className="grid flex-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink-900">Menunggu Verifikasi</h2>
            <button onClick={loadPayments} className="text-sm font-medium text-jade-700 hover:underline">Muat ulang</button>
          </div>
          {payments === null ? (
            <StateCard text="Memuat..." />
          ) : payments.length === 0 ? (
            <StateCard text="Tidak ada pembayaran yang menunggu verifikasi." />
          ) : (
            <div className="flex flex-col gap-3">
              {payments.map((payment) => (
                <button key={payment.payment_id} onClick={() => reviewPayment(payment)} className={`rounded-2xl border bg-white p-4 text-left transition ${selected?.payment_id === payment.payment_id ? "border-jade-500" : "border-sage-200 hover:border-jade-500"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-ink-900">{payment.patient_name}</p>
                    <span className="text-xs text-ink-700/60">#{payment.consultation_id}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-jade-700">{formatRupiah(payment.amount)}</p>
                  <p className="mt-1 text-xs text-ink-700/60">{formatDateTime(payment.uploaded_at)}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="min-h-[520px] rounded-2xl border border-sage-200 bg-white p-5">
          {!selected ? (
            <div className="flex h-full min-h-96 items-center justify-center text-center text-sm text-ink-700/70">Pilih pembayaran untuk melihat bukti.</div>
          ) : (
            <div className="flex h-full flex-col gap-4">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-semibold text-ink-900">{selected.patient_name}</h2>
                  <p className="text-xs text-ink-700/60">Konsultasi #{selected.consultation_id} · {formatRupiah(selected.amount)}</p>
                </div>
                {proofUrl && <a href={proofUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-jade-700 hover:underline">Buka ukuran penuh ↗</a>}
              </div>

              <div className="relative flex min-h-96 flex-1 items-center justify-center overflow-hidden rounded-xl bg-sage-50">
                {loadingProof && <p className="text-sm text-ink-700/70">Memuat bukti...</p>}
                {!loadingProof && proofUrl && proofType?.startsWith("image/") && <Image src={proofUrl} alt={`Bukti pembayaran ${selected.patient_name}`} fill unoptimized className="object-contain" />}
                {!loadingProof && proofUrl && proofType === "application/pdf" && <object data={proofUrl} type="application/pdf" className="h-[620px] w-full"><a href={proofUrl}>Buka PDF</a></object>}
              </div>

              {decision ? (
                <div className={`rounded-xl p-4 ${decision.status === "approved" ? "bg-jade-500/10" : "bg-clay-400/20"}`}>
                  <p className="text-sm font-medium text-ink-900">Pembayaran {decision.status === "approved" ? "disetujui" : "ditolak"}.</p>
                  {decision.rejection_reason && (
                    <p className="mt-2 text-sm text-ink-700/75">
                      <span className="font-medium text-ink-900">Alasan:</span> {decision.rejection_reason}
                    </p>
                  )}
                  {decision.rejection_note && <p className="mt-1 whitespace-pre-wrap text-sm text-ink-700/75">{decision.rejection_note}</p>}
                  {decision.whatsapp_link && <a href={decision.whatsapp_link} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg bg-jade-500 px-4 py-2 text-sm font-medium text-white">Buka WhatsApp</a>}
                </div>
              ) : showRejectForm ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <h3 className="text-sm font-semibold text-ink-900">Alasan Penolakan</h3>
                  <p className="mt-1 text-xs leading-5 text-ink-700/65">Alasan ini akan ditampilkan kepada pasien dan digunakan dalam pesan WhatsApp.</p>
                  <label htmlFor="rejection-reason" className="mt-4 block text-sm font-medium text-ink-900">Pilih alasan <span className="text-red-600">*</span></label>
                  <select
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value as PaymentRejectionReason | "")}
                    className="mt-1.5 w-full rounded-lg border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-jade-500"
                  >
                    <option value="">Pilih alasan penolakan</option>
                    {rejectionReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                  </select>
                  <label htmlFor="rejection-note" className="mt-4 block text-sm font-medium text-ink-900">Catatan tambahan <span className="font-normal text-ink-700/60">(opsional)</span></label>
                  <textarea
                    id="rejection-note"
                    value={rejectionNote}
                    onChange={(event) => setRejectionNote(event.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Contoh: Mohon unggah foto yang menampilkan tanggal dan nominal transaksi."
                    className="mt-1.5 w-full resize-y rounded-lg border border-sage-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-jade-500"
                  />
                  <p className="mt-1 text-right text-xs text-ink-700/50">{rejectionNote.length}/500</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => { setShowRejectForm(false); setError(null); }} disabled={deciding !== null} className="rounded-lg border border-sage-200 bg-white py-2.5 text-sm font-medium text-ink-900 disabled:opacity-40">Batal</button>
                    <button type="button" onClick={() => decide("reject")} disabled={deciding !== null || !rejectionReason || (rejectionReason === "other" && !rejectionNote.trim())} className="rounded-lg bg-red-700 py-2.5 text-sm font-medium text-white disabled:opacity-40">{deciding === "reject" ? "Menolak..." : "Tolak Pembayaran"}</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setShowRejectForm(true)} disabled={deciding !== null || !proofUrl} className="rounded-lg border border-red-300 py-2.5 text-sm font-medium text-red-600 disabled:opacity-40">Tolak</button>
                  <button onClick={() => decide("approve")} disabled={deciding !== null || !proofUrl} className="rounded-lg bg-jade-500 py-2.5 text-sm font-medium text-white disabled:opacity-40">{deciding === "approve" ? "Menyetujui..." : "Setujui"}</button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StateCard({ text }: { text: string }) { return <div className="rounded-2xl border border-sage-200 bg-white p-8 text-center text-sm text-ink-700/70">{text}</div>; }
function formatRupiah(value: string) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
