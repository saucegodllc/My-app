import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Ban, CheckCircle2, Eye, ShieldAlert, UserX, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Nav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ModerationReport = {
  id: string;
  reporterUserId: string;
  reportedUserId: string;
  reason: string;
  details?: string;
  context?: string;
  targetType?: string;
  targetId?: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: string;
  resolutionNotes?: string;
};

type AuditLog = {
  id: string;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  createdAt: string;
};

function adminToken() {
  return localStorage.getItem("connectsphere.adminToken") ?? "";
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-connectsphere-admin-token": adminToken(),
      "x-connectsphere-admin-id": "web-admin",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export default function AdminModerationPage() {
  const [token, setToken] = useState(adminToken());
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLog[]>([]);
  const [selected, setSelected] = useState<ModerationReport | null>(null);
  const [notes, setNotes] = useState("");
  const openReports = useMemo(() => reports.filter((report) => report.status === "open" || report.status === "reviewing"), [reports]);

  async function load() {
    try {
      const [reportResult, auditResult] = await Promise.all([
        adminFetch<{ reports: ModerationReport[] }>("/admin/reports"),
        adminFetch<{ auditLog: AuditLog[] }>("/admin/audit-log"),
      ]);
      setReports(reportResult.reports);
      setAuditLog(auditResult.auditLog);
      setSelected((current) => current ? reportResult.reports.find((report) => report.id === current.id) ?? null : reportResult.reports[0] ?? null);
    } catch {
      toast.error("Admin token required or expired");
    }
  }

  useEffect(() => {
    if (token) void load();
  }, [token]);

  function saveToken() {
    localStorage.setItem("connectsphere.adminToken", token);
    void load();
  }

  async function updateReport(status: ModerationReport["status"]) {
    if (!selected) return;
    const result = await adminFetch<{ report: ModerationReport }>(`/admin/reports/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, resolutionNotes: notes || selected.resolutionNotes }),
    });
    setReports((items) => items.map((item) => item.id === result.report.id ? result.report : item));
    setSelected(result.report);
    toast.success(`Report ${status}`);
    void load();
  }

  async function moderateUser(action: "suspend" | "ban") {
    if (!selected) return;
    await adminFetch(`/admin/users/${selected.reportedUserId}/${action}`, {
      method: "POST",
      body: JSON.stringify({ reason: notes || selected.reason }),
    });
    toast.success(`User ${action === "ban" ? "banned" : "suspended"}`);
    void load();
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-300">
              <ShieldAlert className="h-3.5 w-3.5" />
              Admin moderation
            </div>
            <h1 className="text-3xl font-bold">Safety Queue</h1>
            <p className="text-sm text-muted-foreground">Review reports, inspect context, suspend or ban users, and leave an audit trail.</p>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Admin token" value={token} onChange={(event) => setToken(event.target.value)} className="w-56" type="password" />
            <Button onClick={saveToken}>Load</Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <div className="text-sm font-semibold">{openReports.length} open reports</div>
            </div>
            <div className="max-h-[640px] overflow-auto p-2">
              {reports.map((report, index) => (
                <motion.button
                  key={report.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.025 }}
                  onClick={() => {
                    setSelected(report);
                    setNotes(report.resolutionNotes ?? "");
                  }}
                  className={`mb-2 w-full rounded-lg border p-3 text-left transition ${selected?.id === report.id ? "border-pink-500 bg-pink-500/10" : "border-border bg-background hover:bg-muted"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant={report.priority === "urgent" || report.priority === "high" ? "destructive" : "secondary"}>{report.priority}</Badge>
                    <span className="text-xs text-muted-foreground">{report.status}</span>
                  </div>
                  <div className="font-semibold">{report.reason}</div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">{report.reportedUserId}</div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            {selected ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{selected.reason}</h2>
                    <p className="text-sm text-muted-foreground">Target: {selected.targetType ?? "profile"} / {selected.targetId ?? selected.reportedUserId}</p>
                  </div>
                  <Badge>{selected.status}</Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Reporter</div>
                    <div className="mt-1 font-mono text-sm">{selected.reporterUserId}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-background p-4">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Reported user</div>
                    <div className="mt-1 font-mono text-sm">{selected.reportedUserId}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Eye className="h-4 w-4" />
                    Context
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{selected.details || selected.context || "No extra context supplied."}</p>
                </div>

                <textarea
                  className="min-h-28 w-full rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-pink-500"
                  placeholder="Resolution notes, safety decision, or escalation context"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => updateReport("reviewing")} variant="outline">Reviewing</Button>
                  <Button onClick={() => updateReport("resolved")} className="bg-emerald-600 text-white hover:bg-emerald-700">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Resolve
                  </Button>
                  <Button onClick={() => updateReport("dismissed")} variant="secondary">
                    <XCircle className="mr-2 h-4 w-4" />
                    Dismiss
                  </Button>
                  <Button onClick={() => moderateUser("suspend")} variant="outline">
                    <UserX className="mr-2 h-4 w-4" />
                    Suspend
                  </Button>
                  <Button onClick={() => moderateUser("ban")} variant="destructive">
                    <Ban className="mr-2 h-4 w-4" />
                    Ban
                  </Button>
                </div>

                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="mb-3 text-sm font-semibold">Audit log</div>
                  <div className="space-y-2">
                    {auditLog.slice(0, 8).map((event) => (
                      <div key={event.id} className="flex items-center justify-between gap-4 text-xs">
                        <span>{event.action} {event.targetId}</span>
                        <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[420px] items-center justify-center text-muted-foreground">Load the admin queue to inspect reports.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
