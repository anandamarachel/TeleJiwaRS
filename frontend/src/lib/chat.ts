import { ChatMessage, ChatReadReceipt } from "@/lib/types";

export function mergeChatMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
  pendingReceipts: Map<number, string>,
) {
  const values = new Map<number, ChatMessage>();
  for (const message of [...current, ...incoming]) {
    const pendingReadAt = pendingReceipts.get(message.id);
    values.set(message.id, pendingReadAt ? { ...message, read_at: pendingReadAt } : message);
  }
  return [...values.values()].sort((a, b) => a.id - b.id);
}

export function applyReadReceipt(messages: ChatMessage[], receipt: ChatReadReceipt) {
  const readIds = new Set(receipt.message_ids);
  return messages.map((message) =>
    readIds.has(message.id) ? { ...message, read_at: receipt.read_at } : message
  );
}

export function unreadIncomingIds(
  messages: ChatMessage[],
  currentRole: "patient" | "doctor",
) {
  return messages
    .filter((message) => message.sender_role !== currentRole && !message.read_at)
    .map((message) => message.id);
}
