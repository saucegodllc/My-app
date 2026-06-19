import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpsertMyProfile, useGetMyProfile, getGetMyProfileQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const INTENTS = ["dating", "friendship"] as const;
const GENDERS = ["Man", "Woman", "Non-binary", "Agender", "Genderfluid", "Other", "Prefer not to say"];
const INTEREST_OPTIONS = ["Music", "Travel", "Books", "Gaming", "Cooking", "Sports", "Art", "Film", "Tech", "Fitness", "Hiking", "Photography", "Fashion", "Science", "Podcasts", "Dancing", "Food", "Yoga"];
const LANGUAGE_OPTIONS = ["English", "Spanish", "French", "Mandarin", "Arabic", "Portuguese", "Russian", "Japanese", "German", "Hindi", "Korean", "Italian"];

const step1Schema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters").max(50),
  bio: z.string().min(1, "Please write a short bio so people get to know you.").max(500),
  birthDate: z.string().refine((d) => {
    if (!d) return false;
    const age = (Date.now() - new Date(d).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    return age >= 18;
  }, "You must be at least 18 years old"),
});

function jitterCoordinate(lat: number, lng: number) {
  const r = 500 / 111320;
  const u = Math.random(), v = Math.random();
  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const dLat = w * Math.cos(t);
  const dLng = (w * Math.sin(t)) / Math.cos((lat * Math.PI) / 180);
  return { lat: lat + dLat, lng: lng + dLng };
}

const step2Schema = z.object({
  gender: z.string().min(1, "Please select a gender"),
  location: z.string().min(2, "Please enter your location").max(100),
  country: z.string().min(2, "Please enter your country").max(100),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;

const STEPS = ["About You", "Location", "Interests", "Your Goals"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { mutateAsync: upsertProfile, isPending } = useUpsertMyProfile();

  const [formData, setFormData] = useState({
    displayName: "",
    bio: "",
    birthDate: "",
    gender: "",
    location: "",
    country: "",
    intent: "dating" as "dating" | "friendship",
    interests: [] as string[],
    languages: [] as string[],
    photos: [] as string[],
  });

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<"idle" | "loading" | "granted" | "denied">("idle");
  const [locationVisibility, setLocationVisibility] = useState<"hidden" | "fuzzy" | "active">("fuzzy");
  const [communityCodeAccepted, setCommunityCodeAccepted] = useState(false);
  const [underageDenied, setUnderageDenied] = useState(false);

  function captureFuzzyLocation() {
    if (!navigator.geolocation) { setLocStatus("denied"); return; }
    setLocStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords(jitterCoordinate(pos.coords.latitude, pos.coords.longitude)); setLocStatus("granted"); },
      () => setLocStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  const step1Form = useForm<Step1>({
    resolver: zodResolver(step1Schema as any),
    defaultValues: { displayName: "", bio: "", birthDate: "" },
  });

  const step2Form = useForm<Step2>({
    resolver: zodResolver(step2Schema as any),
    defaultValues: { gender: "", location: "", country: "" },
  });

  const toggleItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((i) => i !== item) : [...arr, item];

  async function handleStep1(data: Step1) {
    const ageYears = (Date.now() - new Date(data.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageYears < 18) {
      setUnderageDenied(true);
      return;
    }
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(1);
  }

  async function handleStep2(data: Step2) {
    setFormData((prev) => ({ ...prev, ...data }));
    setStep(2);
  }

  async function handleFinish() {
    if (!communityCodeAccepted) {
      toast.error("Please accept the Miami Community Code to continue.");
      return;
    }
    try {
      await upsertProfile({
        data: {
          displayName: formData.displayName,
          bio: formData.bio,
          birthDate: formData.birthDate,
          gender: formData.gender,
          location: formData.location,
          country: formData.country,
          intent: formData.intent,
          interests: formData.interests,
          languages: formData.languages,
          photos: formData.photos,
          ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
          locationVisibility,
          acceptCommunityCode: communityCodeAccepted,
          modeData: { intent: formData.intent, gender: formData.gender },
        },
      });
      qc.invalidateQueries({ queryKey: getGetMyProfileQueryKey() });
      navigate("/discover");
    } catch {
      toast.error("Failed to save profile. Please try again.");
    }
  }

  if (underageDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-black">
        <div className="max-w-md text-center space-y-5">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/20 border border-primary/60 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white">ConnectSphere is <span className="text-primary">18+ only</span></h1>
          <p className="text-white/70 leading-relaxed">
            We're sorry — you must be at least 18 years old to use ConnectSphere. Come back when you're 18 and we'll be here.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">Go back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-pink-500/10 via-background to-fuchsia-500/10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 font-bold text-xl text-primary mb-2">
            <Sparkles className="w-5 h-5" />
            ConnectSphere
          </div>
          <p className="text-muted-foreground">Let's set up your profile</p>
        </div>

        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors",
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-1", i < step ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <form onSubmit={step1Form.handleSubmit(handleStep1)} className="space-y-5">
                  <h2 className="text-xl font-semibold">{STEPS[0]}</h2>
                  <div>
                    <Label htmlFor="displayName">Display Name *</Label>
                    <Input id="displayName" {...step1Form.register("displayName")} placeholder="How should people call you?" className="mt-1.5" />
                    {step1Form.formState.errors.displayName && <p className="text-destructive text-sm mt-1">{step1Form.formState.errors.displayName.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" {...step1Form.register("bio")} placeholder="Tell people about yourself..." className="mt-1.5" rows={3} />
                    {step1Form.formState.errors.bio && <p className="text-destructive text-sm mt-1">{step1Form.formState.errors.bio.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="birthDate">Date of Birth * (must be 18+)</Label>
                    <Input id="birthDate" type="date" {...step1Form.register("birthDate")} className="mt-1.5" />
                    {step1Form.formState.errors.birthDate && <p className="text-destructive text-sm mt-1">{step1Form.formState.errors.birthDate.message}</p>}
                  </div>
                  <Button type="submit" className="w-full">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
                </form>
              )}

              {step === 1 && (
                <form onSubmit={step2Form.handleSubmit(handleStep2)} className="space-y-5">
                  <h2 className="text-xl font-semibold">{STEPS[1]}</h2>
                  <div>
                    <Label>Gender *</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {GENDERS.map((g) => (
                        <button
                          key={g} type="button"
                          onClick={() => step2Form.setValue("gender", g, { shouldValidate: true })}
                          className={cn("px-3 py-1.5 rounded-full text-sm border transition-colors",
                            step2Form.watch("gender") === g ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"
                          )}
                        >{g}</button>
                      ))}
                    </div>
                    {step2Form.formState.errors.gender && <p className="text-destructive text-sm mt-1">{step2Form.formState.errors.gender.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="location">City / Location *</Label>
                    <Input id="location" {...step2Form.register("location")} placeholder="e.g. New York, Paris, Tokyo" className="mt-1.5" />
                    {step2Form.formState.errors.location && <p className="text-destructive text-sm mt-1">{step2Form.formState.errors.location.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input id="country" {...step2Form.register("country")} placeholder="e.g. United States, France, Japan" className="mt-1.5" />
                    {step2Form.formState.errors.country && <p className="text-destructive text-sm mt-1">{step2Form.formState.errors.country.message}</p>}
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
                    <Button type="submit" className="flex-1">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </form>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="text-xl font-semibold">{STEPS[2]}</h2>
                  <div>
                    <Label>Interests (select up to 10)</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {INTEREST_OPTIONS.map((interest) => (
                        <button
                          key={interest} type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, interests: toggleItem(prev.interests, interest) }))}
                          className={cn("px-3 py-1.5 rounded-full text-sm border transition-colors",
                            formData.interests.includes(interest) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"
                          )}
                        >{interest}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label>Languages</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <button
                          key={lang} type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, languages: toggleItem(prev.languages, lang) }))}
                          className={cn("px-3 py-1.5 rounded-full text-sm border transition-colors",
                            formData.languages.includes(lang) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"
                          )}
                        >{lang}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
                    <Button type="button" onClick={() => setStep(3)} className="flex-1">Continue <ChevronRight className="w-4 h-4 ml-1" /></Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <h2 className="text-xl font-semibold">{STEPS[3]}</h2>
                  <p className="text-muted-foreground text-sm">What are you looking for on ConnectSphere?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {INTENTS.map((intent) => (
                      <button
                        key={intent} type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, intent }))}
                        className={cn(
                          "p-4 rounded-xl border-2 text-sm font-medium capitalize transition-colors text-left",
                          formData.intent === intent ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                        )}
                      >
                        {intent.charAt(0).toUpperCase() + intent.slice(1)}
                        <p className="text-xs font-normal text-muted-foreground mt-1">
                          {intent === "dating" && "Find romantic connections"}
                          {intent === "friendship" && "Make new friends"}
                          
                        </p>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3 pt-2 border-t border-border">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Better matches (optional)</Label>
                    <button type="button" onClick={captureFuzzyLocation} disabled={locStatus === "loading"}
                      className={cn("w-full text-left p-3 rounded-xl border-2 transition-colors",
                        coords ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}>
                      <div className="text-sm font-semibold">
                        {coords ? "Fuzzy location saved ✓" : locStatus === "loading" ? "Getting location…" : locStatus === "denied" ? "Denied — tap to retry" : "Use my approximate location"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">Coordinates jittered ±500m so no one can pinpoint you.</div>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Location visibility</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: "hidden" as const, label: "Hidden", sub: "No distance" },
                        { key: "fuzzy" as const, label: "Fuzzy", sub: "±500m" },
                        { key: "active" as const, label: "Active", sub: "Live" },
                      ]).map((o) => (
                        <button key={o.key} type="button" onClick={() => setLocationVisibility(o.key)}
                          className={cn("p-3 rounded-xl border-2 text-center transition-colors",
                            locationVisibility === o.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50")}>
                          <div className="text-sm font-bold">{o.label}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{o.sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 p-4 rounded-xl border border-border bg-muted/30">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Miami Community Code</Label>
                    <p className="text-sm">Be real. Be kind. No harassment, no hate, no spam. Respect everyone's intent — dating or making friends.</p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={communityCodeAccepted} onChange={(e) => setCommunityCodeAccepted(e.target.checked)}
                        className="w-4 h-4 accent-primary" />
                      <span className="text-sm font-semibold">I agree to follow the Miami Community Code</span>
                    </label>
                  </div>

                  <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep(2)} className="flex-1"><ChevronLeft className="w-4 h-4 mr-1" />Back</Button>
                    <Button type="button" onClick={handleFinish} disabled={isPending || !communityCodeAccepted} className="flex-1">
                      {isPending ? "Saving..." : "Finish & Explore"}
                      <Sparkles className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
