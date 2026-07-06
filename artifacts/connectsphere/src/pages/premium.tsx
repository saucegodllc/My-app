import { useGetSubscriptionStatus, getGetSubscriptionStatusQueryKey } from "@workspace/api-client-react";
import { Nav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, Eye, Heart, Star, Zap, MessageCircle, Shield } from "lucide-react";
import { motion } from "framer-motion";

const premiumFeatures = [
  { icon: Eye, text: "See who liked you" },
  { icon: Heart, text: "Unlimited likes daily" },
  { icon: Star, text: "Super likes to stand out" },
  { icon: MessageCircle, text: "Message before matching" },
  { icon: Zap, text: "Boost your profile visibility" },
  { icon: Shield, text: "Advanced privacy controls" },
];

export default function PremiumPage() {
  const { data: status } = useGetSubscriptionStatus({ query: { queryKey: getGetSubscriptionStatusQueryKey() } });

  const isPremium = (status as { isPremium?: boolean })?.isPremium;

  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="pt-20 pb-24 md:pb-8 px-4 max-w-3xl mx-auto">
        <div className="py-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500/10 to-fuchsia-500/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            ConnectSphere Premium
          </div>
          <h1 className="text-3xl font-bold mb-3">Connect without limits</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Unlock the full power of ConnectSphere and find your perfect connections faster.
          </p>
        </div>

        {isPremium && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-700 font-medium">
            You're already on Premium! Enjoying all benefits.
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {premiumFeatures.map((f, i) => (
            <motion.div
              key={f.text}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-pink-500/10 to-fuchsia-500/10 flex items-center justify-center shrink-0">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="font-medium text-sm">{f.text}</span>
              <Check className="w-4 h-4 text-emerald-500 ml-auto" />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 rounded-2xl border-2 border-primary/20 bg-card relative overflow-hidden text-center"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-pink-500/10 to-transparent rounded-bl-full" />
          <h2 className="text-xl font-semibold mb-2">Subscribe in the mobile app</h2>
          <p className="text-muted-foreground text-sm mb-5 max-w-md mx-auto">
            ConnectSphere Plus purchases are handled through Apple-approved in-app purchases.
          </p>
          <Button disabled className="bg-gradient-to-r from-pink-500 to-fuchsia-500 border-0 text-white">
            {isPremium ? "Already Premium" : "Open ConnectSphere on iPhone"}
            <Sparkles className="w-4 h-4 ml-1.5" />
          </Button>
        </motion.div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Subscriptions renew and are managed through your App Store account.
        </p>
      </main>
    </div>
  );
}
