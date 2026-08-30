"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, apiFetchBlob, ApiError } from "@/lib/api";
import { PaymentHistoryItem, PaymentHistoryResponse } from "@/lib/types";

type StatusFilter = "" | "approved" | "rejected";
const PAGE_SIZE = 20;

export default function AdminPaymentHistoryPage() {
  return <RequireAuth allowedRoles={["admin"]}><PaymentHistory /></RequireAuth>;
}

function PaymentHistory() {
  const [result, setResult] = useState<PaymentHistoryResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openingProofId, setOpeningProofId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (statusFilter) params.set("status", statusFilter);
    apiFetch<PaymentHistoryResponse>(`/admin/payments/history?${params}`)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.detail : "Riwayat pembayaran gagal dimuat.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [offset, statusFilter]);

  async function openProof(payment: PaymentHistoryItem) {
    const proofWindow = window.open("", "_blank");
    setOpeningProofId(payment.payment_id);
    setError(null);
    try {
      const blob = await apiFetchBlob(`/admin/payments/${payment.payment_id}/proof`);
      const url = URL.createObjectURL(blob);
      if (proofWindow) {
        proofWindow.location.href = url;
      } else {
        window.open(url, "_blank");
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      proofWindow?.close();
      setError(err instanceof ApiError ? err.detail : "Bukti pembayaran tidak dapat dibuka.");
    } finally {
      setOpeningProofId(null);
    }
  }

  const firstRecord = result && result.total > 0 ? result.offset + 1 : 0;
  const lastRecord = result ? Math.min(result.offset + result.items.length, result.total) : 0;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href="/admin/payments" className="text-sm font-medium text-jade-700 hover:underline">← Kembali ke verifikasi</Link>
          <h1 className="mt-4 text-2xl font-semibold text-ink-900">Riwayat Pembayaran</h1>
          <p className="mt-1 text-sm text-ink-700/70">Catatan pembayaran yang telah disetujui atau ditolak untuk administrasi rumah sakit.</p>
        </div>
        <label className="text-sm font-medium text-ink-900">
          Status
          <select value={statusFilter} onChange={(event) => { setLoading(true); setError(null); setStatusFilter(event.target.value as StatusFilter); setOffset(0); }} className="mt-1.5 block rounded-lg border border-sage-200 bg-white px-3 py-2 text-sm outline-none focus:border-jade-500">
            <option value="">Semua status</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        </label>
      </header>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <section className="overflow-hidden rounded-2xl border border-sage-200 bg-white">
        {loading ? (
          <StateMessage text="Memuat riwayat pembayaran..." />
        ) : !result || result.items.length === 0 ? (
          <StateMessage text="Belum ada riwayat pembayaran untuk filter ini." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-sage-200 bg-sage-50 text-xs uppercase tracking-wide text-ink-700/60">
                <tr><th className="px-4 py-3">Pasien</th><th className="px-4 py-3">Konsultasi</th><th className="px-4 py-3">Jumlah</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Diverifikasi</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Bukti</th></tr>
              </thead>
              <tbody className="divide-y divide-sage-100">
                {result.items.map((payment) => (
                  <tr key={payment.payment_id} className="align-top hover:bg-sage-50/60">
                    <td className="px-4 py-4"><p className="font-medium text-ink-900">{payment.patient_name}</p><p className="mt-1 text-xs text-ink-700/60">NIK: {payment.patient_nik ?? "Belum tercatat"}</p></td>
                    <td className="px-4 py-4"><p className="font-medium text-ink-900">#{payment.consultation_id}</p><p className="mt-1 text-xs text-ink-700/60">Pembayaran #{payment.payment_id}</p></td>
                    <td className="px-4 py-4 font-semibold text-ink-900">{formatRupiah(payment.amount)}</td>
                    <td className="px-4 py-4"><StatusBadge status={payment.status} />{payment.rejection_reason && <p className="mt-2 max-w-56 text-xs text-red-700">{payment.rejection_reason}</p>}{payment.rejection_note && <p className="mt-1 max-w-56 whitespace-pre-wrap text-xs text-ink-700/65">{payment.rejection_note}</p>}</td>
                    <td className="px-4 py-4 text-xs leading-5 text-ink-700/75">{formatDateTime(payment.verified_at)}<p className="text-ink-700/50">Diunggah {formatDateTime(payment.uploaded_at)}</p></td>
                    <td className="px-4 py-4 text-ink-700/75">{payment.verified_by ?? "—"}</td>
                    <td className="px-4 py-4"><button onClick={() => openProof(payment)} disabled={openingProofId === payment.payment_id} className="rounded-lg border border-sage-200 px-3 py-2 text-xs font-medium text-jade-700 hover:border-jade-500 disabled:opacity-50">{openingProofId === payment.payment_id ? "Membuka..." : "Lihat bukti ↗"}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {result && result.total > 0 && <footer className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row"><p className="text-ink-700/60">Menampilkan {firstRecord}–{lastRecord} dari {result.total} pembayaran</p><div className="flex gap-2"><button onClick={() => { setLoading(true); setError(null); setOffset(Math.max(0, offset - PAGE_SIZE)); }} disabled={offset === 0 || loading} className="rounded-lg border border-sage-200 bg-white px-4 py-2 font-medium disabled:opacity-40">Sebelumnya</button><button onClick={() => { setLoading(true); setError(null); setOffset(offset + PAGE_SIZE); }} disabled={lastRecord >= result.total || loading} className="rounded-lg border border-sage-200 bg-white px-4 py-2 font-medium disabled:opacity-40">Berikutnya</button></div></footer>}
    </main>
  );
}

function StatusBadge({ status }: { status: PaymentHistoryItem["status"] }) { return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status === "approved" ? "bg-jade-500/10 text-jade-700" : "bg-red-50 text-red-700"}`}>{status === "approved" ? "Disetujui" : "Ditolak"}</span>; }
function StateMessage({ text }: { text: string }) { return <p className="p-10 text-center text-sm text-ink-700/65">{text}</p>; }
function formatRupiah(value: string) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
