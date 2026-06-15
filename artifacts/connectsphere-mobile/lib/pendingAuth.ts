type PendingAutoSignIn = {
  email: string;
  password: string;
  ticket?: string;
  destination: "/congrats" | "/(tabs)";
};

let pendingAutoSignIn: PendingAutoSignIn | null = null;

export function setPendingAutoSignIn(next: PendingAutoSignIn) {
  pendingAutoSignIn = next;
}

export function consumePendingAutoSignIn() {
  const next = pendingAutoSignIn;
  pendingAutoSignIn = null;
  return next;
}
