import { Router } from "express";

const router = Router();
const LOCAL_PLACEHOLDER_CLERK_SECRET = "sk_test_connectsphere_local";
const CLERK_API_TIMEOUT_MS = 10_000;

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

async function fetchClerk(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLERK_API_TIMEOUT_MS);

  try {
    return await fetch(`https://api.clerk.com/v1${path}`, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

router.post("/auth/signup-bypass", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey || clerkSecretKey === LOCAL_PLACEHOLDER_CLERK_SECRET) {
      res.status(503).json({
        error: "Server sign-up is not connected to Clerk yet. Add CLERK_SECRET_KEY to the API environment, then restart the API.",
      });
      return;
    }

    // Step 1: Create user (or find existing)
    let userId: string | undefined;

    const createResp = await fetchClerk("/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: [email.toLowerCase().trim()],
        password,
        skip_password_checks: true,
        username: email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 20) + "_" + Math.random().toString(36).slice(2, 6),
      }),
    });

    const createData = await createResp.json() as {
      id?: string;
      errors?: Array<{ code: string; message: string }>;
    };

    if (!createResp.ok) {
      console.error("Clerk create user failed:", JSON.stringify(createData));
      const code = createData.errors?.[0]?.code;
      if (code === "form_identifier_exists") {
        res.status(409).json({ error: "An account with this email already exists. Please sign in instead." });
        return;
      }
      res.status(400).json({ error: createData.errors?.[0]?.message ?? "Failed to create account." });
      return;
    }
    userId = createData.id;

    // Step 2: Create a one-time sign-in token so the client can authenticate instantly
    const tokenResp = await fetchClerk("/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    });

    const tokenData = await tokenResp.json() as { token?: string; errors?: Array<{ message: string }> };

    if (!tokenResp.ok || !tokenData.token) {
      // Do not leave a new account behind unless the app can start the session.
      await fetchClerk(`/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${clerkSecretKey}` },
      }).catch((deleteErr) => {
        console.error("Clerk cleanup after token failure failed:", deleteErr);
      });

      res.status(502).json({
        error: "Account setup could not start automatically. Please try again.",
      });
      return;
    }

    res.json({ success: true, userId, ticket: tokenData.token });
  } catch (err) {
    if (isAbortError(err)) {
      console.error("signup-bypass Clerk timeout:", err);
      res.status(504).json({ error: "Clerk sign-up took too long to respond. Please try again." });
      return;
    }
    console.error("signup-bypass error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
