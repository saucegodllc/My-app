import { useGetProducts, useCreateCheckoutSession, useGetSubscriptionStatus, getGetProductsQueryKey, getGetSubscriptionStatusQueryKey } from "@workspace/api-client-react";
import { Nav } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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

type Price = { id: string; unitAmount: number; currency: string; interval: string | null };
type Product = { id: string; name: string; description?: string | null; prices: Price[] };

export default function PremiumPage() {
  const { data: productsData, isLoading: productsLoading } = useGetProducts({ query: { queryKey: getGetProductsQueryKey() } });
  const { data: status } = useGetSubscriptionStatus({ query: { queryKey: getGetSubscriptionStatusQueryKey() } });
  const { mutateAsync: createCheckout, isPending } = useCreateCheckoutSession();

  const products = (productsData as { products?: Product[] })?.products ?? [];
  const isPremium = (status as { isPremium?: boolean })?.isPremium;

  async function handleCheckout(priceId: string) {
    try {
      const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
      const result = await createCheckout({
        data: {
          priceId,
          successUrl: `${base}/dashboard?upgraded=true`,
          cancelUrl: `${base}/premium`,
        },
      });
      const url = (result as { url?: string })?.url;
      if (url) window.location.href = url;
    } catch {
      toast.error("Failed to start checkout. Please try again.");
    }
  }

  function formatPrice(amount: number, currency: string, interval: string | null) {
    const formatted = (amount / 100).toLocaleString("en-US", { style: "currency", currency: currency.toUpperCase() });
    return interval ? `${formatted} / ${interval}` : formatted;
  }

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

        <h2 className="text-xl font-semibold mb-4 text-center">Choose your plan</h2>

        {productsLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-48 rounded-2xl" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No subscription plans available at the moment. Check back soon!
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {products.flatMap((product) =>
              product.prices.map((price) => (
                <motion.div
                  key={price.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 rounded-2xl border-2 border-primary/20 bg-card relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-pink-500/10 to-transparent rounded-bl-full" />
                  <h3 className="font-semibold text-lg mb-1">{product.name}</h3>
                  {product.description && (
                    <p className="text-muted-foreground text-sm mb-4">{product.description}</p>
                  )}
                  <div className="text-3xl font-bold text-primary mb-1">
                    {formatPrice(price.unitAmount, price.currency, price.interval)}
                  </div>
                  {price.interval && (
                    <p className="text-xs text-muted-foreground mb-4">Billed {price.interval}ly</p>
                  )}
                  <Button
                    onClick={() => handleCheckout(price.id)}
                    disabled={isPending || !!isPremium}
                    className="w-full bg-gradient-to-r from-pink-500 to-fuchsia-500 border-0 text-white hover:opacity-90"
                  >
                    {isPremium ? "Already Premium" : isPending ? "Loading..." : "Subscribe Now"}
                    <Sparkles className="w-4 h-4 ml-1.5" />
                  </Button>
                </motion.div>
              ))
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secure payment powered by Stripe. Cancel anytime from your account settings.
        </p>
      </main>
    </div>
  );
}
