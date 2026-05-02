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
  // Native posts surface curated opportunities. All applyUrls MUST be real
  // external destinations — never the parked connectsphere.app domain
  // (ad networks redirect those to junk like SearchHounds).
  const raw: RawOpportunity[] = [
    {
      id: "native-nike-design-intern",
      title: "Product Design Intern",
      company: "Nike",
      location: "Miami, FL",
      type: "Internship",
      tags: ["Design", "Figma", "Brand"],
      applyUrl: "https://www.nike.com/careers",
      groupChatId: "group-miami-design",
      postedAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    },
    {
      id: "native-yc-cofounder",
      title: "Co-Founder Match (Technical)",
      company: "Y Combinator",
      location: "Remote",
      type: "Collab",
      tags: ["Startup", "Equity", "AI"],
      applyUrl: "https://www.ycombinator.com/cofounder-matching",
      groupChatId: "group-founders-mia",
      postedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    },
    {
      id: "native-eventbrite-miami",
      title: "Miami Tech Networking Events",
      company: "Eventbrite",
      location: "Miami, FL",
      type: "Event",
      tags: ["Networking", "Miami", "Tech"],
      applyUrl: "https://www.eventbrite.com/d/fl--miami/tech/",
      groupChatId: "group-miami-events",
      postedAt: new Date(Date.now() - 1000 * 60 * 31).toISOString(),
    },
  ];
  return raw.map((r) => normalizeOpportunity(r, "ConnectSphere"));
}

// HTTP helper with a per-provider timeout so a slow upstream can't stall a
// whole refresh. Returns null on any failure (timeout / non-2xx / parse).
async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "ConnectSphere/1.0" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Best-effort job-type classifier from a free-form title. */
function classifyType(title: string, fallback = "Job"): string {
  const t = title.toLowerCase();
  if (t.includes("intern")) return "Internship";
  if (t.includes("co-founder") || t.includes("cofounder") || t.includes("founding")) return "Collab";
  if (t.includes("contract") || t.includes("contractor")) return "Contract";
  return fallback;
}

/** Pull the first N tags from a list of strings, dropping empties + dupes. */
function pickTags(values: (string | undefined | null)[], n = 3): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const trimmed = v.trim();
    if (!trimmed) continue;
    if (!out.includes(trimmed)) out.push(trimmed);
    if (out.length >= n) break;
  }
  return out;
}

// ─── Adzuna (requires API key — disabled until configured) ───────────────────

async function fetchAdzuna(): Promise<Opportunity[]> {
  // Adzuna requires app_id + app_key (free at https://developer.adzuna.com/).
  // When you set ADZUNA_APP_ID / ADZUNA_APP_KEY, swap this body for:
  //   const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${id}&app_key=${key}&where=miami&results_per_page=15&content-type=application/json`;
  // Until then, return [] so we don't pollute the feed with fake links.
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];

  type AdzunaResp = {
    results?: Array<{
      id: string | number;
      title: string;
      company?: { display_name?: string };
      location?: { display_name?: string };
      redirect_url: string;
      created?: string;
      category?: { label?: string };
    }>;
  };
  const data = await fetchJsonWithTimeout<AdzunaResp>(
    `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${id}&app_key=${key}&where=miami&results_per_page=15&content-type=application/json`,
  );
  if (!data?.results) return [];
  return data.results.map((j) =>
    normalizeOpportunity(
      {
        id: `adzuna-${j.id}`,
        title: j.title,
        company: j.company?.display_name ?? "Unknown",
        location: j.location?.display_name ?? "Remote",
        type: classifyType(j.title),
        tags: pickTags([j.category?.label]),
        applyUrl: j.redirect_url,
        postedAt: j.created ?? new Date().toISOString(),
      },
      "Adzuna",
    ),
  );
}

// ─── USAJOBS (requires API key — disabled until configured) ──────────────────

async function fetchUSAJOBS(): Promise<Opportunity[]> {
  // USAJOBS requires User-Agent (your contact email) + Authorization-Key
  // (free at https://developer.usajobs.gov/APIRequest/Index). Disabled until
  // USAJOBS_USER_AGENT + USAJOBS_API_KEY are configured.
  const ua = process.env.USAJOBS_USER_AGENT;
  const key = process.env.USAJOBS_API_KEY;
  if (!ua || !key) return [];

  type USAResp = {
    SearchResult?: {
      SearchResultItems?: Array<{
        MatchedObjectId: string;
        MatchedObjectDescriptor: {
          PositionTitle: string;
          OrganizationName: string;
          PositionURI: string;
          PositionLocationDisplay: string;
          PublicationStartDate: string;
          JobCategory?: Array<{ Name: string }>;
        };
      }>;
    };
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      "https://data.usajobs.gov/api/search?LocationName=Miami,FL&ResultsPerPage=15",
      {
        signal: ctrl.signal,
        headers: {
          Host: "data.usajobs.gov",
          "User-Agent": ua,
          "Authorization-Key": key,
        },
      },
    );
    if (!res.ok) return [];
    const data: USAResp = await res.json();
    const items = data.SearchResult?.SearchResultItems ?? [];
    return items.map((it) => {
      const d = it.MatchedObjectDescriptor;
      return normalizeOpportunity(
        {
          id: `usajobs-${it.MatchedObjectId}`,
          title: d.PositionTitle,
          company: d.OrganizationName,
          location: d.PositionLocationDisplay,
          type: "Job",
          tags: pickTags((d.JobCategory ?? []).map((c) => c.Name)),
          applyUrl: d.PositionURI,
          postedAt: d.PublicationStartDate,
        },
        "USAJOBS",
      );
    });
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

// ─── Greenhouse (LIVE — public job board API, no key required) ───────────────

/** Public Greenhouse job boards we aggregate from. Add/remove as needed.
 *  These are the company "board tokens" used by Greenhouse's hosted ATS. */
const GREENHOUSE_BOARDS = ["airbnb", "doordash", "robinhood", "discord", "figma"];

async function fetchGreenhouse(): Promise<Opportunity[]> {
  type GHResp = {
    jobs?: Array<{
      id: number;
      title: string;
      absolute_url: string;
      location?: { name?: string };
      updated_at?: string;
      departments?: Array<{ name: string }>;
      offices?: Array<{ name: string }>;
    }>;
  };

  const results = await Promise.all(
    GREENHOUSE_BOARDS.map(async (board) => {
      const data = await fetchJsonWithTimeout<GHResp>(
        `https://boards-api.greenhouse.io/v1/boards/${board}/jobs`,
      );
      if (!data?.jobs) return [];
      // Take the 3 most-recently-updated postings per company so the feed
      // stays fresh and varied without one company dominating it.
      const sorted = [...data.jobs].sort(
        (a, b) =>
          new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
      );
      return sorted.slice(0, 3).map((j) => {
        const loc = j.location?.name ?? "Remote";
        return normalizeOpportunity(
          {
            id: `gh-${board}-${j.id}`,
            title: j.title,
            // Capitalize the board token as a display name fallback.
            company: board.charAt(0).toUpperCase() + board.slice(1),
            location: loc,
            type: classifyType(j.title),
            tags: pickTags((j.departments ?? []).map((d) => d.name)),
            applyUrl: j.absolute_url,
            postedAt: j.updated_at,
            isRemote: /remote/i.test(loc),
          },
          "Greenhouse",
        );
      });
    }),
  );

  return results.flat();
}

// ─── Lever (LIVE — public postings API, no key required) ─────────────────────

/** Public Lever job sites we aggregate from (URL slug under jobs.lever.co/...). */
const LEVER_BOARDS = ["netflix", "brex", "ramp", "mixpanel", "scaleai"];

async function fetchLever(): Promise<Opportunity[]> {
  type LeverPosting = {
    id: string;
    text: string;
    hostedUrl: string;
    applyUrl?: string;
    createdAt: number;
    categories?: {
      location?: string;
      team?: string;
      commitment?: string;
      department?: string;
    };
    workplaceType?: string; // "remote" | "on-site" | "hybrid"
  };

  const results = await Promise.all(
    LEVER_BOARDS.map(async (board) => {
      const data = await fetchJsonWithTimeout<LeverPosting[]>(
        `https://api.lever.co/v0/postings/${board}?mode=json`,
      );
      if (!Array.isArray(data)) return [];
      const sorted = [...data].sort((a, b) => b.createdAt - a.createdAt);
      return sorted.slice(0, 3).map((p) => {
        const loc = p.categories?.location ?? "Remote";
        return normalizeOpportunity(
          {
            id: `lever-${board}-${p.id}`,
            title: p.text,
            company: board.charAt(0).toUpperCase() + board.slice(1),
            location: loc,
            type: classifyType(p.text, p.categories?.commitment ?? "Job"),
            tags: pickTags([p.categories?.team, p.categories?.department]),
            applyUrl: p.hostedUrl,
            postedAt: new Date(p.createdAt).toISOString(),
            isRemote: p.workplaceType === "remote" || /remote/i.test(loc),
          },
          "Lever",
        );
      });
    }),
  );

  return results.flat();
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
