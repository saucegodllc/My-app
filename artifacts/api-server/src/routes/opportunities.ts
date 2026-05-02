/**
 * /api/opportunities — real-time opportunities feed for the Networking tab.
 *
 * Aggregates jobs / internships / collabs / events from a pluggable set of
 * providers, normalizes each item into one shape, dedupes by
 * (title + company + location), sorts newest-first, and serves it.
 *
 * Providers (currently mocked — swap each `fetchX` body for a real HTTP
 * call when API keys land):
 *   - ConnectSphere native posts
 *   - Adzuna           (https://developer.adzuna.com/)
 *   - USAJOBS          (https://developer.usajobs.gov/)
 *   - Greenhouse       (https://developers.greenhouse.io/job-board.html)
 *   - Lever            (https://help.lever.co/hc/en-us/articles/360045097492)
 *
 * Refresh strategy:
 *   - Initial refresh on module load.
 *   - setInterval refresh every 10 minutes.
 *   - GET /api/opportunities returns the current cached snapshot plus the
 *     `updatedAt` timestamp so the client can render "Updated just now".
 */

import { Router, type IRouter } from "express";

// ─── Types ───────────────────────────────────────────────────────────────────

type OpportunitySource =
  | "ConnectSphere"
  | "Adzuna"
  | "USAJOBS"
  | "Greenhouse"
  | "Lever";

export type Opportunity = {
  id: string;
  title: string;
  company: string;
  location: string;
  /** "Job" | "Internship" | "Collab" | "Event" | freeform from provider */
  type: string;
  source: OpportunitySource;
  applyUrl: string;
  tags: string[];
  postedAt: string;
  isRemote: boolean;
  /** Optional ConnectSphere group chat to "Join" from the card. */
  groupChatId: string | null;
};

type RawOpportunity = Partial<Opportunity> & { title: string; company: string };

// ─── Cache ───────────────────────────────────────────────────────────────────

let opportunities: Opportunity[] = [];
/** `null` until the first refresh completes — clients render this as "—". */
let lastUpdatedAt: string | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
/**
 * Single-flight guard. If a refresh is already in-flight (e.g. the 10-min
 * timer fired while a prior 12-min call is still running, or two requests
 * race on cold start), reuse that promise instead of starting a duplicate
 * that could later overwrite a newer snapshot with stale data.
 */
let inFlightRefresh: Promise<void> | null = null;

/** Source priority for dedupe ties — earlier = preferred. */
const SOURCE_PRIORITY: Record<OpportunitySource, number> = {
  ConnectSphere: 0,
  Greenhouse: 1,
  Lever: 2,
  USAJOBS: 3,
  Adzuna: 4,
};

/** Normalize a string for dedupe keys: lowercase, trim, collapse whitespace,
 *  strip light punctuation. Treats common "Remote" aliases as one bucket. */
function normalizeKeyPart(s: string): string {
  const cleaned = s
    .toLowerCase()
    .replace(/[\u2018\u2019'`"]/g, "")
    .replace(/[.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (
    cleaned === "remote" ||
    cleaned === "anywhere" ||
    cleaned === "us remote" ||
    cleaned === "remote us"
  ) {
    return "remote";
  }
  return cleaned;
}

// ─── Normalizer ──────────────────────────────────────────────────────────────

function normalizeOpportunity(
  item: RawOpportunity,
  source: OpportunitySource,
): Opportunity {
  return {
    id:
      item.id ??
      `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: item.title,
    company: item.company,
    location: item.location ?? "Remote",
    type: item.type ?? "Job",
    source,
    applyUrl: item.applyUrl ?? "#",
    tags: item.tags ?? [],
    postedAt: item.postedAt ?? new Date().toISOString(),
    isRemote: item.isRemote ?? (item.location ?? "").toLowerCase() === "remote",
    groupChatId: item.groupChatId ?? null,
  };
}

// ─── Providers (mocked) ──────────────────────────────────────────────────────
// Each provider returns the data shape its real API gives us, then we map it
// through normalizeOpportunity. Replace the literal arrays with HTTP calls.

async function fetchNativePosts(): Promise<Opportunity[]> {
  const raw: RawOpportunity[] = [
    {
      id: "native-1",
      title: "Social Media Manager",
      company: "Miami Startup",
      location: "Miami, FL",
      type: "Part-time",
      tags: ["Marketing", "Content", "Miami"],
      applyUrl: "https://connectsphere.app/posts/native-1",
      groupChatId: "group-miami-startups",
      postedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    },
    {
      id: "native-2",
      title: "Co-Founder (Technical)",
      company: "Stealth Mode",
      location: "Brickell, FL",
      type: "Collab",
      tags: ["Startup", "Equity", "AI"],
      applyUrl: "https://connectsphere.app/posts/native-2",
      groupChatId: "group-founders-mia",
      postedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: "native-3",
      title: "Rooftop Networking Mixer",
      company: "ConnectSphere x 1 Hotel",
      location: "South Beach, FL",
      type: "Event",
      tags: ["Networking", "Miami", "Rooftop"],
      applyUrl: "https://connectsphere.app/events/native-3",
      groupChatId: "group-rooftop-mixer",
      postedAt: new Date(Date.now() - 1000 * 60 * 31).toISOString(),
    },
  ];
  return raw.map((r) => normalizeOpportunity(r, "ConnectSphere"));
}

async function fetchAdzuna(): Promise<Opportunity[]> {
  // Real call would be:
  //   GET https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=...&app_key=...&where=miami
  const raw: RawOpportunity[] = [
    {
      id: "adzuna-7821",
      title: "Frontend Engineer",
      company: "Magic Leap",
      location: "Plantation, FL",
      type: "Job",
      tags: ["React", "TypeScript", "AR/VR"],
      applyUrl: "https://www.adzuna.com/job/7821",
      isRemote: false,
      postedAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
    },
    {
      id: "adzuna-9982",
      title: "Growth Marketing Lead",
      company: "Papa",
      location: "Miami, FL",
      type: "Job",
      tags: ["Growth", "Paid", "Lifecycle"],
      applyUrl: "https://www.adzuna.com/job/9982",
      postedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    },
  ];
  return raw.map((r) => normalizeOpportunity(r, "Adzuna"));
}

async function fetchUSAJOBS(): Promise<Opportunity[]> {
  // Real call: GET https://data.usajobs.gov/api/search?LocationName=Miami,FL
  const raw: RawOpportunity[] = [
    {
      id: "usajobs-114455",
      title: "Cybersecurity Analyst",
      company: "U.S. Department of Homeland Security",
      location: "Miami, FL",
      type: "Job",
      tags: ["Government", "Security", "Federal"],
      applyUrl: "https://www.usajobs.gov/job/114455",
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ];
  return raw.map((r) => normalizeOpportunity(r, "USAJOBS"));
}

async function fetchGreenhouse(): Promise<Opportunity[]> {
  // Real call: GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
  const raw: RawOpportunity[] = [
    {
      id: "gh-3344",
      title: "Product Design Intern",
      company: "Nike",
      location: "Miami, FL",
      type: "Internship",
      tags: ["Design", "Figma", "Brand"],
      applyUrl: "https://boards.greenhouse.io/nike/jobs/3344",
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
    {
      id: "gh-7711",
      title: "Software Engineer Intern",
      company: "Robinhood",
      location: "Remote",
      type: "Internship",
      tags: ["Backend", "Go", "Fintech"],
      applyUrl: "https://boards.greenhouse.io/robinhood/jobs/7711",
      isRemote: true,
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
  ];
  return raw.map((r) => normalizeOpportunity(r, "Greenhouse"));
}

async function fetchLever(): Promise<Opportunity[]> {
  // Real call: GET https://api.lever.co/v0/postings/{company}?mode=json
  const raw: RawOpportunity[] = [
    {
      id: "lever-22aa",
      title: "Founding Engineer",
      company: "Stealth (YC F25)",
      location: "Miami, FL",
      type: "Collab",
      tags: ["Founding", "Equity", "AI"],
      applyUrl: "https://jobs.lever.co/stealth/22aa",
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: "lever-88zz",
      title: "Developer Relations",
      company: "Linear",
      location: "Remote",
      type: "Job",
      tags: ["DevRel", "Content", "Community"],
      applyUrl: "https://jobs.lever.co/linear/88zz",
      isRemote: true,
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(),
    },
  ];
  return raw.map((r) => normalizeOpportunity(r, "Lever"));
}

// ─── Refresh loop ────────────────────────────────────────────────────────────

async function refreshOpportunities(): Promise<void> {
  // Single-flight: if a refresh is already running, return its promise.
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    try {
      // Run providers in parallel; tolerate individual failures so one bad
      // provider never starves the rest of the feed.
      const settled = await Promise.allSettled([
        fetchNativePosts(),
        fetchAdzuna(),
        fetchUSAJOBS(),
        fetchGreenhouse(),
        fetchLever(),
      ]);

      const all: Opportunity[] = settled.flatMap((r) =>
        r.status === "fulfilled" ? r.value : [],
      );

      // Dedupe by normalized (title + company + location). When two providers
      // collide we keep the one with the higher source priority; on a tie we
      // keep the most recently posted record. This is deterministic and
      // resilient to provider ordering changes.
      const unique = new Map<string, Opportunity>();
      for (const job of all) {
        const key = `${normalizeKeyPart(job.title)}|${normalizeKeyPart(job.company)}|${normalizeKeyPart(job.location)}`;
        const existing = unique.get(key);
        if (!existing) {
          unique.set(key, job);
          continue;
        }
        const newPri = SOURCE_PRIORITY[job.source];
        const oldPri = SOURCE_PRIORITY[existing.source];
        if (newPri < oldPri) {
          unique.set(key, job);
        } else if (newPri === oldPri) {
          // Same source — keep the newer one.
          if (new Date(job.postedAt).getTime() > new Date(existing.postedAt).getTime()) {
            unique.set(key, job);
          }
        }
      }

      opportunities = Array.from(unique.values()).sort(
        (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime(),
      );
      lastUpdatedAt = new Date().toISOString();
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

// Kick off an initial refresh and schedule the 10-minute loop. Guard the
// timer so dev-mode hot reloads don't stack up multiple intervals.
if (!refreshTimer) {
  void refreshOpportunities();
  refreshTimer = setInterval(
    () => void refreshOpportunities(),
    10 * 60 * 1000,
  );
}

// ─── Router ──────────────────────────────────────────────────────────────────

const router: IRouter = Router();

router.get("/opportunities", async (_req, res) => {
  // Cold-start guard: if the very first refresh hasn't landed yet, await it
  // (or the in-flight one) so the client never sees an epoch-empty snapshot.
  if (lastUpdatedAt === null) {
    try {
      await refreshOpportunities();
    } catch {
      /* fall through and return whatever we have */
    }
  }
  res.json({
    updatedAt: lastUpdatedAt,
    count: opportunities.length,
    opportunities,
  });
});

export default router;
