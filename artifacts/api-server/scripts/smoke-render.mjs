const baseUrl = (process.env.RENDER_SMOKE_BASE_URL || process.env.API_BASE_URL || process.argv[2] || "").replace(/\/+$/, "");

if (!baseUrl) {
  console.error("Set RENDER_SMOKE_BASE_URL or pass the Render API base URL as the first argument.");
  process.exit(2);
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "application/json" },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${text.slice(0, 300)}`);
  }
  return body;
}

const health = await fetchJson("/api/healthz");
if (health?.status !== "ok") {
  throw new Error(`/api/healthz did not return status ok: ${JSON.stringify(health)}`);
}

const eventsStatus = await fetchJson("/api/events/status");
if (eventsStatus?.ok !== true) {
  throw new Error(`/api/events/status did not return ok: true: ${JSON.stringify(eventsStatus)}`);
}
if (eventsStatus?.configured !== true) {
  throw new Error("Ticketmaster is not configured in production events status.");
}
if (eventsStatus?.live !== true || Number(eventsStatus?.eventCount ?? 0) <= 0) {
  throw new Error(`Production events are not live: ${JSON.stringify(eventsStatus)}`);
}

console.log(`Render smoke passed for ${baseUrl}: ${eventsStatus.eventCount} live events.`);
