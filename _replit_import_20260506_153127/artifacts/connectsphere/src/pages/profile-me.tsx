import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyProfile,
  useUpsertMyProfile,
  getGetMyProfileQueryKey,
} from "@workspace/api-client-react";
import { ObjectUploader } from "@workspace/object-storage-web";
import { Nav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Camera, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const INTENTS = ["dating", "friendship", "all"] as const;
const INTEREST_OPTIONS = ["Music", "Travel", "Books", "Gaming", "Cooking", "Sports", "Art", "Film", "Tech", "Fitness", "Hiking", "Photography", "Fashion", "Science", "Podcasts", "Dancing", "Food", "Yoga"];
const LANGUAGE_OPTIONS = ["English", "Spanish", "French", "Mandarin", "Arabic", "Portuguese", "Russian", "Japanese", "German", "Hindi", "Korean", "Italian"];

const schema = z.object({
  displayName: z.string().min(2).max(50),
  bio: z.string().max(500).optional(),
  birthDate: z.string().optional(),
  gender: z.string().optional(),
  location: z.string().optional(),
  country: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Profile = {
  displayName: string;
  bio?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  location?: string | null;
  country?: string | null;
  intent?: string;
  interests?: string[] | null;
  languages?: string[] | null;
  photos?: string[] | null;
  isPremium?: boolean;
};

export default function ProfileMePage() {
  const qc = useQueryClient();
  const { data: profile, isLoading } = useGetMyProfile({ query: { queryKey: getGetMyProfileQueryKey() } });
  const { mutateAsync: upsertProfile, isPending } = useUpsertMyProfile();
  const uploadUrlToPathRef = useRef<Map<string, string>>(new Map());
  const storagePath = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api/storage";

  async function getUploadParametersWithTracking(
    file: import("@uppy/core").UppyFile<Record<string, unknown>, Record<string, unknown>>
  ) {
    const res = await fetch(`${storagePath}/uploads/request-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type || "application/octet-stream" }),
    });
    if (!res.ok) throw new Error("Failed to get upload URL");
    const data = await res.json() as { uploadUrl: string; objectPath: string };
    uploadUrlToPathRef.current.set(data.uploadUrl, data.objectPath);
    return { method: "PUT" as const, url: data.uploadUrl, headers: { "Content-Type": file.type || "application/octet-stream" } };
  }

  const p = profile as Profile | undefined;

  const [intent, setIntent] = useState<"dating" | "friendship" | "all">("all");
  const [interests, setInterests] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (p) {
      reset({
        displayName: p.displayName,
        bio: p.bio ?? "",
        birthDate: p.birthDate ?? "",
        gender: p.gender ?? "",
        location: p.location ?? "",
        country: p.country ?? "",
      });
      setIntent((p.intent as typeof intent) ?? "all");
      setInterests(p.interests ?? []);
      setLanguages(p.languages ?? []);
      setPhotos(p.photos ?? []);
    }
  }, [p, reset]);

  const toggleItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  async function onSubmit(data: FormData) {
    try {
      await upsertProfile({
        data: {
          displayName: data.displayName,
          bio: data.bio,
          birthDate: data.birthDate,
          gender: data.gender,
          location: data.location,
          country: data.country,
          intent,
          interests,
          languages,
          photos,
        },
      });
      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      toast.success("Profile saved!");
    } catch {
      toast.error("Failed to save profile");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="pt-20 pb-24 md:pb-8 px-4 max-w-2xl mx-auto">
        <div className="py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Edit Profile</h1>
            <p className="text-muted-foreground text-sm">Customize how others see you</p>
          </div>
          {p?.isPremium && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white text-xs font-semibold">
              <Sparkles className="w-3 h-3" />
              Premium
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold">Photos</h2>
              <div className="flex flex-wrap gap-3">
                {photos.map((photo, idx) => (
                  <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden">
                    <img
                      src={`${import.meta.env.BASE_URL}api/storage/objects/${photo.replace(/^\/objects\//, "")}`}
                      alt="Profile photo"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {photos.length < 6 && (
                  <ObjectUploader
                    maxNumberOfFiles={6 - photos.length}
                    onGetUploadParameters={getUploadParametersWithTracking}
                    onComplete={(result) => {
                      const newPaths = (result.successful ?? [])
                        .map((f: { uploadURL?: string }) => {
                          const uploadUrl = f.uploadURL ?? "";
                          return uploadUrlToPathRef.current.get(uploadUrl) ?? "";
                        })
                        .filter(Boolean);
                      setPhotos((prev) => [...prev, ...newPaths]);
                    }}
                    buttonClassName="w-24 h-24 rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors"
                  >
                    <Camera className="w-6 h-6 text-muted-foreground" />
                  </ObjectUploader>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold">Basic Info</h2>
              <div>
                <Label htmlFor="displayName">Display Name *</Label>
                <Input id="displayName" {...register("displayName")} className="mt-1.5" />
                {errors.displayName && <p className="text-destructive text-sm mt-1">{errors.displayName.message}</p>}
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" {...register("bio")} className="mt-1.5" rows={3} placeholder="Tell people about yourself..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="birthDate">Date of Birth</Label>
                  <Input id="birthDate" type="date" {...register("birthDate")} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Input id="gender" {...register("gender")} className="mt-1.5" placeholder="e.g. Man, Woman, Non-binary" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">City / Location</Label>
                  <Input id="location" {...register("location")} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" {...register("country")} className="mt-1.5" />
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold">I'm looking for</h2>
              <div className="grid grid-cols-2 gap-3">
                {INTENTS.map((i) => (
                  <button
                    key={i} type="button"
                    onClick={() => setIntent(i)}
                    className={cn("p-3 rounded-xl border-2 text-sm font-medium capitalize transition-colors text-left",
                      intent === i ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                    )}
                  >
                    {i === "all" ? "Open to All" : i}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((item) => (
                  <button
                    key={item} type="button"
                    onClick={() => setInterests((prev) => toggleItem(prev, item))}
                    className={cn("px-3 py-1.5 rounded-full text-sm border transition-colors",
                      interests.includes(item) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"
                    )}
                  >{item}</button>
                ))}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
              <h2 className="font-semibold">Languages</h2>
              <div className="flex flex-wrap gap-2">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang} type="button"
                    onClick={() => setLanguages((prev) => toggleItem(prev, lang))}
                    className={cn("px-3 py-1.5 rounded-full text-sm border transition-colors",
                      languages.includes(lang) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"
                    )}
                  >{lang}</button>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={isPending} className="w-full h-12 text-base">
              {isPending ? "Saving..." : "Save Profile"}
              <Check className="w-4 h-4 ml-1.5" />
            </Button>
          </form>
        )}
      </main>
    </div>
  );
}
