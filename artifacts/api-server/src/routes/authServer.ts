import { Router } from "express";

const router = Router();

router.post("/auth/signup-bypass", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const clerkSecretKey = process.env.CLERK_SECRET_KEY;
    if (!clerkSecretKey) {
      res.status(500).json({ error: "Server configuration error." });
      return;
    }

    // Step 1: Create user (or find existing)
    let userId: string | undefined;

    const createResp = await fetch("https://api.clerk.com/v1/users", {
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
    const tokenResp = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clerkSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: userId }),
    });

    const tokenData = await tokenResp.json() as { token?: string; errors?: Array<{ message: string }> };

    if (!tokenResp.ok || !tokenData.token) {
      // Token creation failed — client will fall back to password sign-in
      res.json({ success: true, userId });
      return;
    }

    res.json({ success: true, userId, ticket: tokenData.token });
  } catch (err) {
    console.error("signup-bypass error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
