export type ChatFreshnessMessage = {
  senderId?: string;
  content?: string;
  text?: string;
  system?: boolean;
};

export function hasUserMessages(messages: ChatFreshnessMessage[]): boolean {
  return messages.some((message) => {
    if (message.system || message.senderId === "system") return false;
    return Boolean((message.content ?? message.text ?? "").trim());
  });
}

export default function ChatFreshnessRoute() {
  return null;
}
