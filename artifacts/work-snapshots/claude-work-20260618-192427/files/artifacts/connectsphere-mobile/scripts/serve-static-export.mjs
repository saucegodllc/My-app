import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".tmp-web-export");
const port = Number(process.argv[3] ?? 8123);

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
};

createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname.startsWith("/api/inbox/")) {
    const now = new Date().toISOString();
    const reactions = [
      {
        id: "qa-free-like",
        senderId: "user-sarah",
        receiverId: "user_self",
        type: "spark",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: true,
        createdAt: now,
        senderName: "Sarah",
        senderPhotoUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80",
        senderAge: 27,
        senderNeighborhood: "Wynwood",
      },
      {
        id: "qa-locked-like",
        senderId: "user-maya",
        receiverId: "user_self",
        type: "like",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: true,
        createdAt: now,
        senderName: "Maya",
        senderPhotoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80",
        senderAge: 25,
        senderNeighborhood: "Brickell",
      },
      {
        id: "qa-locked-bestie",
        senderId: "user-jules",
        receiverId: "user_self",
        type: "vibe_reaction",
        sourceType: "profile",
        status: "pending",
        isBlurredForReceiver: true,
        createdAt: now,
        senderName: "Jules",
        senderPhotoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
        senderAge: 29,
        senderNeighborhood: "Downtown",
      },
    ];
    let body = {};
    if (url.pathname.includes("/primary/")) {
      body = { conversations: [], isPremium: false };
    } else if (url.pathname.includes("/requests/")) {
      body = { requests: [], count: 0 };
    } else if (url.pathname.includes("/reactions/")) {
      body = {
        reactions,
        isPremium: false,
        counts: { spark: 1, like: 1, shot_reaction: 0, plan_like: 0, vibe_reaction: 1, total: 3 },
      };
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
    return;
  }
  const cleanPath = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, cleanPath);
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, "index.html");
  }
  res.setHeader("Content-Type", types[extname(filePath)] ?? "application/octet-stream");
  createReadStream(filePath).pipe(res);
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});
