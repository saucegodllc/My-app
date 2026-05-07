import { Link } from "wouter";
import { Sparkles, Globe, Heart, Users, Shield, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const features = [
  {
    icon: Globe,
    title: "Connect Globally",
    desc: "Meet people from 190+ countries sharing your passions and ambitions.",
  },
  {
    icon: Heart,
    title: "Date, Befriend, Network",
    desc: "Whether you're looking for love, friendship, or career connections — we've got you.",
  },
  {
    icon: Users,
    title: "Inclusive Community",
    desc: "Open to all identities, orientations, and backgrounds. Everyone belongs here.",
  },
  {
    icon: Shield,
    title: "Safe by Design",
    desc: "Verification, reporting, and blocking tools built to keep you protected.",
  },
];

const stats = [
  { value: "12M+", label: "Members worldwide" },
  { value: "190+", label: "Countries represented" },
  { value: "4.8M", label: "Connections made" },
  { value: "16+", label: "Open to all ages 16 and up" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-primary">
            <Sparkles className="w-5 h-5" />
            ConnectSphere
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white border-0 hover:opacity-90">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-32 pb-20 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 via-transparent to-fuchsia-500/10 pointer-events-none" />
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Star className="w-3.5 h-3.5" />
            The social platform without borders
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Meet your next
            <span className="bg-gradient-to-r from-pink-500 to-fuchsia-500 bg-clip-text text-transparent"> great connection</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Dating, friendships, and professional networking — all in one vibrant global community. 
            Open to everyone 16 and older, in 190+ countries.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white border-0 hover:opacity-90 text-base px-8 h-12">
                Join ConnectSphere Free
              </Button>
            </Link>
            <Link href="/sign-in">
              <Button size="lg" variant="outline" className="text-base px-8 h-12">
                Sign In
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="py-12 px-4 bg-primary/5">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="text-3xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">Everything you need to connect</h2>
            <p className="text-muted-foreground text-lg">
              Designed for real human connections across all walks of life
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl bg-card border border-border"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gradient-to-r from-pink-500 to-fuchsia-500">
        <div className="max-w-2xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to find your people?</h2>
          <p className="text-white/80 text-lg mb-8">
            Join millions of members who've already found their connections.
          </p>
          <Link href="/sign-up">
            <Button size="lg" className="bg-white text-primary hover:bg-white/90 font-semibold px-8 h-12">
              Start for Free
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 px-4 text-center text-muted-foreground text-sm border-t">
        <p>© 2026 ConnectSphere. All rights reserved.</p>
      </footer>
    </div>
  );
}
