import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-pink-500/10 via-background to-fuchsia-500/10 text-center">
      <div className="flex items-center gap-2 font-bold text-xl text-primary mb-8">
        <Sparkles className="w-5 h-5" />
        ConnectSphere
      </div>
      <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
      <p className="text-xl font-semibold mb-2">Page not found</p>
      <p className="text-muted-foreground mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link href="/discover">
        <Button>Go to Discover</Button>
      </Link>
    </div>
  );
}
