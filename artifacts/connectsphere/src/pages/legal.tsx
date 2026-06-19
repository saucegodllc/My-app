import { Link } from "wouter";
import { ShieldCheck, FileText, HeartHandshake, LifeBuoy } from "lucide-react";

type LegalPageKind = "privacy" | "terms" | "guidelines" | "safety";

const pages: Record<
  LegalPageKind,
  {
    title: string;
    eyebrow: string;
    icon: typeof ShieldCheck;
    updated: string;
    sections: Array<{ id?: string; title: string; body: string[] }>;
  }
> = {
  privacy: {
    title: "Privacy Policy",
    eyebrow: "Privacy",
    icon: ShieldCheck,
    updated: "May 29, 2026",
    sections: [
      {
        title: "What We Collect",
        body: [
          "ConnectSphere collects account identifiers, profile content, photos, messages, plans, reports, blocks, subscription status, push tokens, crash logs, and optional analytics events when you consent.",
          "Location can be approximate or precise based on your Settings choice. Camera, photo, and liveness data are used only for profile and trust features you start.",
        ],
      },
      {
        title: "How We Use Data",
        body: [
          "We use data to operate matching, chat, plans, double-date experiences, safety tooling, subscriptions, support, abuse prevention, and app reliability monitoring.",
          "Product analytics is opt-in. We do not use launch analytics for third-party advertising tracking.",
        ],
      },
      {
        id: "account-deletion",
        title: "Account Deletion And Export",
        body: [
          "You can request a data export and initiate account deletion in Settings under Privacy & Safety. Deletion removes or anonymizes profile data, photos, messages, blocks, and sessions where supported.",
          "We may retain moderation reports, payment records, and security logs when required for safety, fraud prevention, disputes, tax, or legal obligations.",
        ],
      },
      {
        title: "Contact",
        body: ["For privacy, deletion, or safety requests, contact support@connectsphere.app."],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    eyebrow: "Terms",
    icon: FileText,
    updated: "May 29, 2026",
    sections: [
      {
        title: "Using ConnectSphere",
        body: [
          "You must be old enough to use the service in your location and must provide truthful account information.",
          "You are responsible for the content you share and for treating other members with respect.",
        ],
      },
      {
        title: "Subscriptions",
        body: [
          "Premium features may be billed through Apple, Google, RevenueCat, or supported app-store payment systems. Store cancellation and refund rules apply.",
        ],
      },
      {
        title: "Safety Enforcement",
        body: [
          "We may limit, suspend, or remove accounts that violate safety rules, attempt abuse, evade blocks, or create risk for other users.",
        ],
      },
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    eyebrow: "Community",
    icon: HeartHandshake,
    updated: "May 29, 2026",
    sections: [
      {
        title: "Be Real And Respectful",
        body: [
          "Use your own identity, photos, and intentions. Do not impersonate people, manipulate users, or misrepresent what you want.",
          "Harassment, hate, threats, sexual coercion, underage content, scams, and spam are not allowed.",
        ],
      },
      {
        title: "Reports And Blocks",
        body: [
          "Use reports for safety issues and blocks when you do not want contact. Blocks are enforced across discovery, chat, invites, plans, matches, share links, and push notifications.",
        ],
      },
    ],
  },
  safety: {
    title: "Safety Center",
    eyebrow: "Safety",
    icon: LifeBuoy,
    updated: "May 29, 2026",
    sections: [
      {
        title: "Control Your Experience",
        body: [
          "You can report profiles or content, block users, adjust location precision, opt in or out of analytics, and control push notifications from Settings.",
          "For urgent danger, contact local emergency services first. ConnectSphere support can review app safety concerns at support@connectsphere.app.",
        ],
      },
      {
        title: "Meetup Safety",
        body: [
          "Meet in public, tell someone where you are going, keep your own transportation options, and leave any situation that feels wrong.",
        ],
      },
    ],
  },
};

export default function LegalPage({ kind }: { kind: LegalPageKind }) {
  const page = pages[kind];
  const Icon = page.icon;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-5 py-14">
          <Link href="/" className="text-sm font-semibold text-primary">
            ConnectSphere
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-muted-foreground">{page.eyebrow}</p>
              <h1 className="mt-1 text-4xl font-bold">{page.title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">Last updated {page.updated}</p>
            </div>
          </div>
        </div>
      </section>
      <article className="prose prose-invert mx-auto max-w-3xl px-5 py-10">
        {page.sections.map((section) => (
          <section key={section.title} id={section.id} className="scroll-mt-8">
            <h2>{section.title}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </main>
  );
}
