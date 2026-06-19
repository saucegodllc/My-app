import { useState } from "react";
import { useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfile,
  useReportUser,
  useBlockUser,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { Nav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { MapPin, Globe, Heart, Flag, UserX, BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const intentColors: Record<string, string> = {
  dating: "bg-fuchsia-500/10 text-rose-600 border-rose-200",
  friendship: "bg-blue-500/10 text-blue-600 border-blue-200",
  all: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
};

const REPORT_REASONS: Array<{ label: string; value: "spam" | "harassment" | "inappropriate_content" | "underage" | "fake_profile" | "other" }> = [
  { label: "Spam", value: "spam" },
  { label: "Harassment", value: "harassment" },
  { label: "Inappropriate Content", value: "inappropriate_content" },
  { label: "Fake Profile", value: "fake_profile" },
  { label: "Underage User", value: "underage" },
  { label: "Other", value: "other" },
];

type Profile = {
  userId: string;
  displayName: string;
  bio?: string | null;
  age?: number | null;
  gender?: string | null;
  location?: string | null;
  country?: string | null;
  intent?: string;
  interests?: string[] | null;
  languages?: string[] | null;
  photos?: string[] | null;
  isPremium?: boolean;
  isVerified?: boolean;
};

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const qc = useQueryClient();
  const [selectedReason, setSelectedReason] = useState<"spam" | "harassment" | "inappropriate_content" | "underage" | "fake_profile" | "other" | "">("");

  const { data: profile, isLoading } = useGetProfile(userId!, {
    query: { queryKey: getGetProfileQueryKey(userId!), enabled: !!userId },
  });
  const { mutateAsync: reportUser, isPending: reporting } = useReportUser();
  const { mutateAsync: blockUser, isPending: blocking } = useBlockUser();

  const p = profile as Profile | undefined;

  async function handleReport() {
    if (!selectedReason || !userId) return;
    try {
      await reportUser({ data: { reportedUserId: userId, reason: selectedReason as "spam" | "harassment" | "inappropriate_content" | "underage" | "fake_profile" | "other" } });
      toast.success("Report submitted. We'll review it shortly.");
    } catch {
      toast.error("Failed to submit report");
    }
  }

  async function handleBlock() {
    if (!userId) return;
    try {
      await blockUser({ data: { blockedUserId: userId } });
      toast.success("User blocked. They won't appear in your feed.");
    } catch {
      toast.error("Failed to block user");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="pt-20 pb-24 md:pb-8 px-4 max-w-2xl mx-auto">
        {isLoading ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="w-full h-80 rounded-3xl" />
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !p ? (
          <div className="text-center py-20 text-muted-foreground">Profile not found.</div>
        ) : (
          <div className="py-6">
            {p.photos && p.photos.length > 0 ? (
              <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden mb-5">
                <img
                  src={`${import.meta.env.BASE_URL}api/storage/objects/${(p.photos[0] ?? "").replace(/^\/objects\//, "")}`}
                  alt={p.displayName}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-full aspect-[4/3] rounded-3xl bg-gradient-to-br from-pink-950 to-fuchsia-950 flex items-center justify-center mb-5">
                <span className="text-8xl font-bold text-primary/20">{p.displayName.charAt(0)}</span>
              </div>
            )}

            <div className="flex items-start justify-between mb-3">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {p.displayName}
                  {p.age && <span className="font-normal text-muted-foreground">{p.age}</span>}
                  {p.isVerified && <BadgeCheck className="w-5 h-5 text-blue-500" />}
                </h1>
                {p.location && (
                  <p className="text-muted-foreground text-sm flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {p.location}, {p.country}
                  </p>
                )}
              </div>
              {p.intent && (
                <Badge className={cn("text-xs capitalize shrink-0 mt-1", intentColors[p.intent] ?? "")}>
                  {p.intent === "all" ? "Open to All" : p.intent}
                </Badge>
              )}
            </div>

            {p.bio && (
              <div className="bg-card border border-border rounded-2xl p-4 mb-4">
                <p className="text-foreground leading-relaxed">{p.bio}</p>
              </div>
            )}

            {p.interests && p.interests.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Interests</h2>
                <div className="flex flex-wrap gap-2">
                  {p.interests.map((interest) => (
                    <span key={interest} className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {p.languages && p.languages.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Languages</h2>
                <div className="flex flex-wrap gap-2">
                  {p.languages.map((lang) => (
                    <span key={lang} className="px-3 py-1 rounded-full border border-border text-sm flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {p.photos && p.photos.length > 1 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">More Photos</h2>
                <div className="grid grid-cols-3 gap-2">
                  {p.photos.slice(1).map((photo, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden">
                      <img
                        src={`${import.meta.env.BASE_URL}api/storage/objects/${photo.replace(/^\/objects\//, "")}`}
                        alt={`Photo ${i + 2}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 border-t border-border pt-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 text-muted-foreground">
                    <Flag className="w-4 h-4 mr-1.5" />
                    Report
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Report {p.displayName}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Select a reason for reporting this user. We take all reports seriously.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="flex flex-wrap gap-2 my-4">
                    {REPORT_REASONS.map((reason) => (
                      <button
                        key={reason.value}
                        onClick={() => setSelectedReason(reason.value)}
                        className={cn("px-3 py-1.5 rounded-full text-sm border transition-colors",
                          selectedReason === reason.value ? "bg-destructive text-destructive-foreground border-destructive" : "border-border hover:border-destructive/50"
                        )}
                      >{reason.label}</button>
                    ))}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReport} disabled={!selectedReason || reporting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Submit Report
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/20 hover:bg-destructive/5">
                    <UserX className="w-4 h-4 mr-1.5" />
                    Block
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Block {p.displayName}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      They won't be able to see your profile or appear in your discovery feed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleBlock} disabled={blocking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Block User
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
