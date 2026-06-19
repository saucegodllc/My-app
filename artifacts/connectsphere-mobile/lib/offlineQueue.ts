/**
 * offlineQueue.ts
 * ---------------
 * Persist outbound chat messages to AsyncStorage so they survive connection
 * drops and app restarts. The queue is drained by ChatScreen on reconnect.
 *
 * Schema (per-chat):
 *   key: `cs.offline.queue.<chatId>`
 *   value: JSON array of QueuedMessage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export type QueuedMessage = {
  /** Client-generated UUID so we can deduplicate */
  clientId: string;
  chatId: string;
  senderId: string;
  text: string;
  /** ISO timestamp when enqueued */
  queuedAt: string;
  /** "text" | "voice" | "gif" */
  messageType: "text" | "voice" | "gif";
  /** For voice: remote URL after upload, or undefined if not yet uploaded */
  mediaUrl?: string;
};

const queueKey = (chatId: string) => `cs.offline.queue.${chatId}`;

export async function enqueueMessage(msg: QueuedMessage): Promise<void> {
  try {
    const key = queueKey(msg.chatId);
    const raw = await AsyncStorage.getItem(key);
    const existing: QueuedMessage[] = raw ? (JSON.parse(raw) as QueuedMessage[]) : [];
    // Deduplicate by clientId
    if (!existing.find((m) => m.clientId === msg.clientId)) {
      existing.push(msg);
      await AsyncStorage.setItem(key, JSON.stringify(existing));
    }
  } catch {
    // Non-critical
  }
}

export async function dequeueMessages(chatId: string): Promise<QueuedMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(chatId));
    if (!raw) return [];
    const msgs = JSON.parse(raw) as QueuedMessage[];
    await AsyncStorage.removeItem(queueKey(chatId));
    return msgs;
  } catch {
    return [];
  }
}

export async function removeFromQueue(chatId: string, clientId: string): Promise<void> {
  try {
    const key = queueKey(chatId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return;
    const filtered = (JSON.parse(raw) as QueuedMessage[]).filter((m) => m.clientId !== clientId);
    if (filtered.length === 0) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    }
  } catch {
    // Non-critical
  }
}

export async function peekQueue(chatId: string): Promise<QueuedMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(queueKey(chatId));
    return raw ? (JSON.parse(raw) as QueuedMessage[]) : [];
  } catch {
    return [];
  }
}

/** Drain all queued messages for a given chat, calling sendFn for each. */
export async function drainQueue(
  chatId: string,
  sendFn: (msg: QueuedMessage) => Promise<void>,
): Promise<void> {
  const msgs = await dequeueMessages(chatId);
  for (const msg of msgs) {
    try {
      await sendFn(msg);
    } catch {
      // Re-enqueue failed message so we don't lose it
      await enqueueMessage(msg);
    }
  }
}
