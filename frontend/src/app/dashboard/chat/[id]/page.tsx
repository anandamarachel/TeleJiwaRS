"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { ChatEmojiPicker } from "@/components/ChatEmojiPicker";
import { apiFetch, ApiError, getWebSocketUrl } from "@/lib/api";
import { applyReadReceipt, mergeChatMessages, unreadIncomingIds } from "@/lib/chat";
import { ChatMessage, ChatReadReceipt, ConsultationStatus } from "@/lib/types";

type ConsultationDetail = {
  id: number;
  status: ConsultationStatus;
  doctor_name: string | null;
};

type ConnectionStatus = "connecting" | "connected" | "disconnected";

export default function PatientChatPage() {
  return (
    <RequireAuth allowedRoles={["patient"]}>
      <PatientChat />
    </RequireAuth>
  );
}

function PatientChat() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pendingReceiptsRef = useRef(new Map<number, string>());
  const messagesRef = useRef<ChatMessage[]>([]);

  const [consultation, setConsultation] = useState<ConsultationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConsultation() {
      try {
        const detail = await apiFetch<ConsultationDetail>(`/patients/consultations/${id}`);
        if (cancelled) return;

        if (detail.status !== "active") {
          router.replace("/dashboard");
          return;
        }

        setConsultation(detail);
      } catch {
        if (!cancelled) setError("Gagal membuka konsultasi.");
      }
    }

    loadConsultation();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  useEffect(() => {
    if (!consultation) return;

    let disposed = false;
    shouldReconnectRef.current = true;

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
              ? `Gagal memuat riwayat pesan (${err.status}): ${err.detail}`
              : "Gagal memuat riwayat pesan. Pastikan backend dapat diakses.",
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

      const messageIds = unreadIncomingIds(rows, "patient");
      if (messageIds.length > 0) {
        socket.send(JSON.stringify({ type: "read", message_ids: messageIds }));
      }
    }

    function connect() {
      if (disposed) return;

      setConnectionStatus("connecting");
      const socket = new WebSocket(getWebSocketUrl(`/ws/consultations/${id}`));
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        setConnectionStatus("connected");
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
          if (message.sender_role !== "patient") markAsRead([message]);
        } catch {
          setError("Pesan baru tidak dapat dibaca.");
        }
      };

      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed || !shouldReconnectRef.current) return;
        setConnectionStatus("disconnected");
        if (event.code === 1008 || event.code === 1009) {
          shouldReconnectRef.current = false;
          setError(
            event.reason
              ? `Koneksi chat ditolak: ${event.reason}`
              : "Koneksi chat ditolak. Silakan masuk kembali dan buka konsultasi aktif.",
          );
          return;
        }
        reconnectTimerRef.current = setTimeout(connect, 2000);
      };

      socket.onerror = () => socket.close();
    }

    loadHistory();
    connect();

    function markVisibleMessagesRead() {
      if (document.visibilityState === "visible") {
        markAsRead(messagesRef.current);
      }
    }
    document.addEventListener("visibilitychange", markVisibleMessagesRead);

    const statusTimer = setInterval(async () => {
      try {
        const detail = await apiFetch<ConsultationDetail>(`/patients/consultations/${id}`);
        if (detail.status !== "active") {
          shouldReconnectRef.current = false;
          socketRef.current?.close();
          router.replace("/dashboard");
        }
      } catch {
        // A temporary status-check failure should not interrupt an active chat.
      }
    }, 10000);

    return () => {
      disposed = true;
      shouldReconnectRef.current = false;
      clearInterval(statusTimer);
      document.removeEventListener("visibilitychange", markVisibleMessagesRead);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [consultation, id, router]);

  useEffect(() => {
    messagesRef.current = messages;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    const socket = socketRef.current;

    if (!message || !socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({ message }));
    setDraft("");
  }

  if (error && !consultation) return <StateMessage text={error} isError />;
  if (!consultation) return <StateMessage text="Memuat konsultasi..." />;

  const canSend = connectionStatus === "connected" && draft.trim().length > 0;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-sage-200 bg-white px-5 py-4">
        <div>
          <p className="font-semibold text-ink-900">Konsultasi</p>
          <p className="text-xs text-ink-700/70">
            {consultation.doctor_name ?? "Dokter Anda"}
          </p>
        </div>
        <ConnectionBadge status={connectionStatus} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-sage-200 bg-white">
        <div className="flex-1 space-y-3 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-700/70">
              Konsultasi telah aktif. Silakan mulai percakapan dengan dokter.
            </p>
          )}

          {messages.map((message, index) => (
            <MessageBubble key={message.id ?? index} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && <p className="px-4 text-xs text-red-600" role="alert">{error}</p>}

        <form onSubmit={sendMessage} className="flex gap-2 border-t border-sage-200 p-4">
          <ChatEmojiPicker
            disabled={connectionStatus !== "connected"}
            onSelect={(emoji) => setDraft((value) => `${value}${emoji}`)}
          />
          <label htmlFor="chat-message" className="sr-only">Pesan</label>
          <input
            id="chat-message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={connectionStatus !== "connected"}
            placeholder={connectionStatus === "connected" ? "Tulis pesan..." : "Menghubungkan kembali..."}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-sage-200 px-3 py-2 text-sm outline-none focus:border-jade-500 focus:ring-1 focus:ring-jade-500 disabled:bg-sage-50"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-lg bg-jade-500 px-4 py-2 text-sm font-medium text-white hover:bg-jade-600 disabled:opacity-40"
          >
            Kirim
          </button>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isPatient = message.sender_role === "patient";

  return (
    <div className={`flex ${isPatient ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${isPatient ? "bg-jade-500 text-white" : "bg-sage-100 text-ink-900"}`}>
        <p className="whitespace-pre-wrap break-words text-sm">{message.message}</p>
        <p className={`mt-1 text-[10px] ${isPatient ? "text-white/70" : "text-ink-700/60"}`}>
          {formatTime(message.sent_at)}
          {isPatient && ` · ${message.read_at ? `Dibaca ${formatTime(message.read_at)}` : "Terkirim"}`}
        </p>
      </div>
    </div>
  );
}

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  const label = status === "connected" ? "Terhubung" : status === "connecting" ? "Menghubungkan" : "Terputus";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status === "connected" ? "bg-jade-500/10 text-jade-700" : "bg-clay-400/20 text-ink-700"}`}>
      {label}
    </span>
  );
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function StateMessage({ text, isError = false }: { text: string; isError?: boolean }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4">
      <p className={`text-sm ${isError ? "text-red-600" : "text-ink-700/70"}`}>{text}</p>
    </div>
  );
}
