export const EMPTY_EVENTS: readonly any[] = Object.freeze([]);

export function getEventsForScreen<T extends { events?: any[] } | undefined>(payload: T) {
  return payload?.events ?? EMPTY_EVENTS;
}

export function eventContextIdsChanged(previous: readonly string[], next: readonly string[]) {
  if (previous.length !== next.length) return true;
  return previous.some((id, index) => id !== next[index]);
}
