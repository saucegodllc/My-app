export type IcebreakerContextKind = "person" | "story" | "request" | "plan" | "chat";

export type FriendIcebreakerContext = {
  kind: IcebreakerContextKind;
  currentUserName?: string;
  targetName?: string;
  interests?: string[];
  energy?: string;
  location?: string;
  storyText?: string;
  planTitle?: string;
  planType?: string;
  planLocation?: string;
  lastMessage?: string;
};

export type IcebreakerSuggestion = {
  id: string;
  text: string;
  reason: string;
};

type TextGenerator = (prompt: string, options: { max_new_tokens: number; temperature: number; do_sample: boolean }) => Promise<unknown>;

let generatorPromise: Promise<TextGenerator | null> | null = null;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstName(name: string | undefined) {
  return clean(name).split(/\s+/)[0] || "them";
}

function safeList(values: string[] | undefined, fallback: string[]) {
  const list = (values ?? []).map(clean).filter(Boolean);
  return list.length ? list.slice(0, 4) : fallback;
}

function suggestion(id: string, text: string, reason: string): IcebreakerSuggestion {
  return {
    id,
    text: text.length > 140 ? `${text.slice(0, 137).trim()}...` : text,
    reason,
  };
}

export function fallbackFriendIcebreakers(context: FriendIcebreakerContext): IcebreakerSuggestion[] {
  const name = firstName(context.targetName);
  const interests = safeList(context.interests, ["coffee", "plans"]);
  const interest = interests[0] ?? "plans";
  const second = interests[1] ?? "a low-key hang";
  const location = clean(context.location || context.planLocation) || "nearby";
  const plan = clean(context.planTitle || context.planType) || `${interest} plan`;
  const story = clean(context.storyText);

  if (context.kind === "story" && story) {
    return [
      suggestion("ice-story-1", `This sounds fun. Want to turn it into an easy plan this week?`, "Replies to their live signal."),
      suggestion("ice-story-2", `I am down for this vibe. Want company if you go?`, "Keeps it casual and friendly."),
      suggestion("ice-story-3", `That sounds like my kind of plan. Should we make it happen?`, "Makes the next step simple."),
    ];
  }

  if (context.kind === "plan") {
    return [
      suggestion("ice-plan-1", `${plan} sounds fun. Mind if I join?`, "Direct and low-pressure."),
      suggestion("ice-plan-2", `I am into ${interest}. I would be down for ${plan} in ${location}.`, "Connects shared interest to the plan."),
      suggestion("ice-plan-3", `This is exactly the kind of plan I have been trying to say yes to.`, "Adds warm personality."),
    ];
  }

  if (context.kind === "chat") {
    return [
      suggestion("ice-chat-1", `Want to make a simple plan instead of letting this stay in the chat?`, "Moves the chat toward meeting."),
      suggestion("ice-chat-2", `Coffee, walk, or ${second}? I am easy, just trying to get us outside.`, "Gives easy choices."),
      suggestion("ice-chat-3", `This week has room for one fun plan. Want to claim it?`, "Playful and simple."),
    ];
  }

  return [
    suggestion("ice-person-1", `Hey ${name}, I saw you are into ${interest}. Want to do something low-key around ${location}?`, "Uses their profile naturally."),
    suggestion("ice-person-2", `${interest} and ${second} is a strong combo. Want to make a simple plan?`, "Turns shared interests into action."),
    suggestion("ice-person-3", `You seem fun to make plans with. Want to start with ${interest} sometime this week?`, "Friendly and direct."),
  ];
}

export function buildIcebreakerPrompt(context: FriendIcebreakerContext): string {
  const interests = safeList(context.interests, ["coffee", "plans"]).join(", ");
  return [
    "Write 3 short friend-app icebreakers.",
    "Tone: fun, simple, warm, low-pressure. No flirting unless clearly dating. Avoid professional, job, or business language.",
    "Each line must be under 140 characters and should help two people start a friend chat or make a plan.",
    `Context kind: ${context.kind}`,
    `Recipient: ${clean(context.targetName) || "someone"}`,
    `Interests: ${interests}`,
    `Energy: ${clean(context.energy) || "open to plans"}`,
    `Location: ${clean(context.location || context.planLocation) || "nearby"}`,
    `Story: ${clean(context.storyText) || "none"}`,
    `Plan: ${clean(context.planTitle || context.planType) || "none"}`,
    `Last message: ${clean(context.lastMessage) || "none"}`,
    "Return only the 3 icebreakers, one per line.",
  ].join("\n");
}

export function normalizeGeneratedIcebreakers(raw: string, context: FriendIcebreakerContext): IcebreakerSuggestion[] {
  const seen = new Set<string>();
  const parsed = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d).\s"']+/, "").replace(/["']$/, "").trim())
    .filter((line) => line.length >= 8 && line.length <= 180)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return !/opportunit|networking|career/i.test(line);
    })
    .slice(0, 3)
    .map((text, index) => suggestion(`ice-ai-${index + 1}`, text, "Generated from their friend context."));

  const fallback = fallbackFriendIcebreakers(context);
  for (const item of fallback) {
    if (parsed.length >= 3) break;
    if (!seen.has(item.text.toLowerCase())) parsed.push(item);
  }
  return parsed.slice(0, 3);
}

async function loadGenerator(): Promise<TextGenerator | null> {
  try {
    const packageName = "@huggingface/transformers";
    const mod = (await import(packageName)) as any;
    if (!mod.pipeline) return null;
    if (mod.env) {
      mod.env.allowRemoteModels = true;
      mod.env.useFSCache = true;
      mod.env.cacheDir = "./.cache/huggingface";
    }
    return await mod.pipeline("text-generation", "onnx-community/gemma-3-270m-it-ONNX", { dtype: "q4" });
  } catch {
    return null;
  }
}

export async function generateFriendIcebreakers(context: FriendIcebreakerContext): Promise<IcebreakerSuggestion[]> {
  generatorPromise ??= loadGenerator();
  const generator = await generatorPromise;
  if (!generator) return fallbackFriendIcebreakers(context);

  try {
    const prompt = buildIcebreakerPrompt(context);
    const result = await generator(prompt, { max_new_tokens: 90, temperature: 0.8, do_sample: true });
    const first = Array.isArray(result) ? result[0] : result;
    const text =
      typeof first === "object" && first && "generated_text" in first
        ? String((first as { generated_text: unknown }).generated_text).replace(prompt, "")
        : String(first ?? "");
    return normalizeGeneratedIcebreakers(text, context);
  } catch {
    return fallbackFriendIcebreakers(context);
  }
}
