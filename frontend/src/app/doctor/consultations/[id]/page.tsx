"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { ChatEmojiPicker } from "@/components/ChatEmojiPicker";
import { apiFetch, ApiError, getWebSocketUrl } from "@/lib/api";
import { applyReadReceipt, mergeChatMessages, unreadIncomingIds } from "@/lib/chat";
import { ChatMessage, ChatReadReceipt, DoctorConsultation } from "@/lib/types";

type PrescriptionDraft = {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes: string;
};

const emptyPrescription: PrescriptionDraft = {
  drug_name: "", dosage: "", frequency: "", duration: "", notes: "",
};

export default function DoctorConsultationPage() {
  return (
    <RequireAuth allowedRoles={["doctor"]}>
      <DoctorConsultationWorkspace />
    </RequireAuth>
  );
}

function DoctorConsultationWorkspace() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectEnabledRef = useRef(true);
  const endRef = useRef<HTMLDivElement | null>(null);
  const pendingReceiptsRef = useRef(new Map<number, string>());
  const messagesRef = useRef<ChatMessage[]>([]);

  const [consultation, setConsultation] = useState<DoctorConsultation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [connected, setConnected] = useState(false);
  const [showEndForm, setShowEndForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<DoctorConsultation>(`/doctors/consultations/${id}`)
      .then((detail) => {
        if (detail.status !== "active") {
          router.replace("/doctor/queue");
          return;
        }
        setConsultation(detail);
      })
      .catch((err) => setError(err instanceof ApiError ? err.detail : "Gagal membuka konsultasi."));
  }, [id, router]);

  useEffect(() => {
    if (!consultation) return;
    let disposed = false;
    reconnectEnabledRef.current = true;

    async function loadHistory() {
      try {
        const history = await apiFetch<ChatMessage[]>(`/consultations/${id}/messages`);
        if (!disposed) {
          setMessages((current) => mergeChatMessages(current, history, pendingReceiptsRef.current));
          markAsRead(history);
        }
      } catch (err) {
        if (!disposed) {
          setError(
            err instanceof ApiError
              ? `Gagal memuat pesan (${err.status}): ${err.detail}`
              : "Gagal memuat pesan. Pastikan backend dapat diakses.",
          );
        }
      }
    }

    function markAsRead(rows: ChatMessage[]) {
      const socket = socketRef.current;
      if (
        document.visibilityState !== "visible" ||
        !socket ||
        socket.readyState !== WebSocket.OPEN
      ) return;

      const messageIds = unreadIncomingIds(rows, "doctor");
      if (messageIds.length > 0) {
        socket.send(JSON.stringify({ type: "read", message_ids: messageIds }));
      }
    }

    function connect() {
      if (disposed) return;
      const socket = new WebSocket(getWebSocketUrl(`/ws/consultations/${id}`));
      socketRef.current = socket;
      socket.onopen = () => {
        if (disposed) return;
        setConnected(true);
        setError(null);
        loadHistory();
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as ChatMessage | ChatReadReceipt;
          if (payload.type === "read") {
            for (const messageId of payload.message_ids) {
              pendingReceiptsRef.current.set(messageId, payload.read_at);
            }
            setMessages((current) => applyReadReceipt(current, payload));
            return;
          }

          const message = payload as ChatMessage;
          setMessages((current) => mergeChatMessages(current, [message], pendingReceiptsRef.current));
          if (message.sender_role !== "doctor") markAsRead([message]);
        } catch {
          setError("Pesan baru tidak dapat dibaca.");
        }
      };
      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        setConnected(false);
        if (event.code === 1008 || event.code === 1009) {
          reconnectEnabledRef.current = false;
          setError(
            event.reason
              ? `Koneksi chat ditolak: ${event.reason}`
              : "Koneksi chat ditolak. Silakan masuk kembali dan buka konsultasi aktif.",
          );
          return;
        }
        if (!disposed && reconnectEnabledRef.current) reconnectRef.current = setTimeout(connect, 2000);
      };
      socket.onerror = () => socket.close();
    }

    loadHistory();
    connect();

    function markVisibleMessagesRead() {
      if (document.visibilityState === "visible") markAsRead(messagesRef.current);
    }
    document.addEventListener("visibilitychange", markVisibleMessagesRead);

    return () => {
      disposed = true;
      reconnectEnabledRef.current = false;
      document.removeEventListener("visibilitychange", markVisibleMessagesRead);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socketRef.current?.close();
    };
  }, [consultation, id]);

  useEffect(() => {
    messagesRef.current = messages;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ message }));
    setDraft("");
  }

  if (error && !consultation) return <StateMessage text={error} isError />;
  if (!consultation) return <StateMessage text="Memuat konsultasi..." />;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex flex-col justify-between gap-3 rounded-2xl border border-sage-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <button onClick={() => router.push("/doctor/queue")} className="text-xs font-medium text-jade-700 hover:underline">← Kembali ke antrean</button>
          <h1 className="mt-2 text-lg font-semibold text-ink-900">{consultation.patient_name}</h1>
          <p className="text-xs text-ink-700/60">Konsultasi #{consultation.id}</p>
        </div>
        <button onClick={() => setShowEndForm(true)} className="rounded-lg bg-clay-500 px-4 py-2.5 text-sm font-medium text-white hover:opacity-90">
          Akhiri Konsultasi
        </button>
      </header>

      <section className="rounded-2xl border border-jade-500/30 bg-jade-500/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-jade-700">Skrining Awal</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs text-ink-700/60">Keluhan utama</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink-900">{consultation.chief_complaint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-64">
            <ScreeningValue label="Skor" value={String(consultation.screening_score)} />
            <ScreeningValue label="Hasil" value={consultation.screening_result} />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink-700/60">Hasil skrining awal bukan diagnosis medis.</p>
      </section>

      <div className="grid min-h-[560px] flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-[520px] flex-col rounded-2xl border border-sage-200 bg-white">
          <div className="flex items-center justify-between border-b border-sage-200 px-5 py-3">
            <p className="font-medium text-ink-900">Percakapan</p>
            <span className={`text-xs font-medium ${connected ? "text-jade-700" : "text-clay-500"}`}>{connected ? "Terhubung" : "Menghubungkan..."}</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && <p className="py-8 text-center text-sm text-ink-700/70">Belum ada pesan.</p>}
            {messages.map((message) => <MessageBubble key={message.id} message={message} />)}
            <div ref={endRef} />
          </div>
          {error && <p className="px-4 text-xs text-red-600">{error}</p>}
          <form onSubmit={sendMessage} className="flex gap-2 border-t border-sage-200 p-4">
            <ChatEmojiPicker
              disabled={!connected || showEndForm}
              onSelect={(emoji) => setDraft((value) => `${value}${emoji}`)}
            />
            <input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!connected || showEndForm} aria-label="Pesan" placeholder={connected ? "Tulis pesan..." : "Menghubungkan..."} className="min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 disabled:bg-sage-50" />
            <button disabled={!connected || !draft.trim() || showEndForm} className="rounded-lg bg-jade-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">Kirim</button>
          </form>
        </section>

        <aside className="rounded-2xl border border-sage-200 bg-white p-5">
          {showEndForm ? (
            <EndConsultationForm consultationId={consultation.id} onCancel={() => setShowEndForm(false)} onCompleted={() => {
              reconnectEnabledRef.current = false;
              socketRef.current?.close();
              router.push("/doctor/queue");
            }} />
          ) : (
            <div>
              <h2 className="font-semibold text-ink-900">Penyelesaian Konsultasi</h2>
              <p className="mt-2 text-sm leading-6 text-ink-700/70">Saat konsultasi selesai, catat ringkasan klinis serta resep, tindak lanjut, atau rujukan bila diperlukan.</p>
              <button onClick={() => setShowEndForm(true)} className="mt-5 w-full rounded-lg border border-clay-500 px-4 py-2.5 text-sm font-medium text-clay-500 hover:bg-clay-400/10">Isi Ringkasan Akhir</button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function EndConsultationForm({ consultationId, onCancel, onCompleted }: { consultationId: number; onCancel: () => void; onCompleted: () => void }) {
  const [note, setNote] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([]);
  const [hasFollowUp, setHasFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [hasReferral, setHasReferral] = useState(false);
  const [referredTo, setReferredTo] = useState("");
  const [referralReason, setReferralReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const prescriptionsValid = prescriptions.every((item) => item.drug_name.trim() && item.dosage.trim() && item.frequency.trim());
  const valid = note.trim() && prescriptionsValid && (!hasFollowUp || followUpDate) && (!hasReferral || (referredTo.trim() && referralReason.trim()));

  function updatePrescription(index: number, field: keyof PrescriptionDraft, value: string) {
    setPrescriptions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/doctors/consultations/${consultationId}/end`, {
        method: "POST",
        body: JSON.stringify({
          note_text: note.trim(),
          prescription_items: prescriptions.map((item) => ({
            drug_name: item.drug_name.trim(), dosage: item.dosage.trim(), frequency: item.frequency.trim(),
            duration: item.duration.trim() || null, notes: item.notes.trim() || null,
          })),
          follow_up: hasFollowUp ? { follow_up_date: followUpDate, instructions: followUpInstructions.trim() || null } : null,
          referral: hasReferral ? { referred_to: referredTo.trim(), reason: referralReason.trim() } : null,
        }),
      });
      onCompleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Gagal mengakhiri konsultasi.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="font-semibold text-ink-900">Ringkasan Akhir</h2>
        <p className="mt-1 text-xs text-ink-700/60">Tindakan ini akan menutup chat secara permanen.</p>
      </div>
      <Field label="Catatan dokter *">
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} className={inputClass} placeholder="Ringkasan kondisi dan hasil konsultasi..." />
      </Field>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink-900">Resep</p>
          <button type="button" onClick={() => setPrescriptions((items) => [...items, { ...emptyPrescription }])} className="text-xs font-medium text-jade-700">+ Tambah obat</button>
        </div>
        <div className="mt-2 space-y-3">
          {prescriptions.map((item, index) => (
            <div key={index} className="space-y-2 rounded-xl bg-sage-50 p-3">
              <input value={item.drug_name} onChange={(e) => updatePrescription(index, "drug_name", e.target.value)} placeholder="Nama obat *" className={inputClass} />
              <div className="grid grid-cols-2 gap-2">
                <input value={item.dosage} onChange={(e) => updatePrescription(index, "dosage", e.target.value)} placeholder="Dosis *" className={inputClass} />
                <input value={item.frequency} onChange={(e) => updatePrescription(index, "frequency", e.target.value)} placeholder="Frekuensi *" className={inputClass} />
              </div>
              <input value={item.duration} onChange={(e) => updatePrescription(index, "duration", e.target.value)} placeholder="Durasi" className={inputClass} />
              <input value={item.notes} onChange={(e) => updatePrescription(index, "notes", e.target.value)} placeholder="Catatan" className={inputClass} />
              <button type="button" onClick={() => setPrescriptions((items) => items.filter((_, i) => i !== index))} className="text-xs text-red-600">Hapus obat</button>
            </div>
          ))}
        </div>
      </div>

      <OptionalSection label="Jadwalkan tindak lanjut" checked={hasFollowUp} onChange={setHasFollowUp}>
        <input type="date" min={new Date().toISOString().slice(0, 10)} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={inputClass} />
        <textarea value={followUpInstructions} onChange={(e) => setFollowUpInstructions(e.target.value)} rows={2} placeholder="Instruksi tindak lanjut" className={inputClass} />
      </OptionalSection>

      <OptionalSection label="Buat rujukan" checked={hasReferral} onChange={setHasReferral}>
        <input value={referredTo} onChange={(e) => setReferredTo(e.target.value)} placeholder="Dirujuk ke *" className={inputClass} />
        <textarea value={referralReason} onChange={(e) => setReferralReason(e.target.value)} rows={2} placeholder="Alasan rujukan *" className={inputClass} />
      </OptionalSection>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={submitting} className="flex-1 rounded-lg border border-sage-200 py-2 text-sm font-medium">Batal</button>
        <button type="submit" disabled={!valid || submitting} className="flex-1 rounded-lg bg-clay-500 py-2 text-sm font-medium text-white disabled:opacity-40">{submitting ? "Menyimpan..." : "Selesai"}</button>
      </div>
    </form>
  );
}

function OptionalSection({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return <div><label className="flex items-center gap-2 text-sm font-medium text-ink-900"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>{checked && <div className="mt-2 space-y-2">{children}</div>}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-ink-900">{label}<div className="mt-1.5">{children}</div></label>;
}

function ScreeningValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-xs text-ink-700/60">{label}</p><p className="mt-1 font-semibold text-ink-900">{value}</p></div>;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isDoctor = message.sender_role === "doctor";
  return <div className={`flex ${isDoctor ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${isDoctor ? "bg-jade-500 text-white" : "bg-sage-100 text-ink-900"}`}><p className="whitespace-pre-wrap break-words text-sm">{message.message}</p><p className={`mt-1 text-[10px] ${isDoctor ? "text-white/70" : "text-ink-700/60"}`}>{formatTime(message.sent_at)}{isDoctor && ` · ${message.read_at ? `Dibaca ${formatTime(message.read_at)}` : "Terkirim"}`}</p></div></div>;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function StateMessage({ text, isError = false }: { text: string; isError?: boolean }) {
  return <div className="flex min-h-full flex-1 items-center justify-center px-4"><p className={`text-sm ${isError ? "text-red-600" : "text-ink-700/70"}`}>{text}</p></div>;
}

const inputClass = "w-full rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500";
